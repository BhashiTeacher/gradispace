const router    = require('express').Router();
const multer    = require('multer');
const pdfParse  = require('pdf-parse');
const db        = require('../db');
const { requireAuth }              = require('../middleware/auth');
const { checkAiLimit, requirePlan } = require('../middleware/plan');

// Single multer instance; per-endpoint limits validated in handlers
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ── Claude API ────────────────────────────────────────────────────────────────
async function callClaude(messages, system) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 8192, system, messages }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${err}`);
  }
  return res.json();
}

// ── JSON salvager ─────────────────────────────────────────────────────────────
function salvageJSON(raw) {
  let text = raw.replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/```\s*$/,'').trim();
  try { return JSON.parse(text); } catch {}
  const start = text.indexOf('[');
  if (start === -1) throw new Error('AI did not return a JSON array.');
  text = text.slice(start);
  const objects = [];
  let depth = 0, objStart = -1, inString = false, escape = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') { if (depth === 1) objStart = i; depth++; }
    else if (ch === '}') {
      depth--;
      if (depth === 1 && objStart !== -1) {
        try { objects.push(JSON.parse(text.slice(objStart, i + 1))); } catch {}
        objStart = -1;
      }
    } else if (ch === '[') depth++;
    else if (ch === ']') depth--;
  }
  if (!objects.length) throw new Error('Could not parse any questions from AI response.');
  return objects;
}

async function incrementAiUsage(teacherId) {
  await db.query('UPDATE teachers SET ai_usage_month=ai_usage_month+1 WHERE id=$1', [teacherId]);
}

// ── Generate system prompt ────────────────────────────────────────────────────
function buildGenerateSystem(n, difficulty, subject, topic, gradeLevel) {
  return `You are an expert exam question writer for ${subject || 'general'} at ${gradeLevel || 'school'} level.
Generate exactly ${n} questions at ${difficulty} difficulty.
Return ONLY a valid JSON array:
[{
  "type": "mcq" | "short_answer",
  "stem": "question text",
  "options": [{"letter":"A","text":"..."},{"letter":"B","text":"..."},{"letter":"C","text":"..."},{"letter":"D","text":"..."}],
  "answer": "A",
  "part": "Part 1",
  "partInstruction": "For each question, choose the correct answer.",
  "subject": "${subject || ''}",
  "gradeLevel": "${gradeLevel || ''}",
  "topic": "${topic || ''}",
  "difficulty": "${difficulty}"
}]
For short_answer questions omit options and answer. No markdown, no explanation, just the JSON array.`;
}

// ── Scanned PDF helper ────────────────────────────────────────────────────────
// Converts up to 5 pages to PNG via pdf2pic (needs ImageMagick+Ghostscript).
// Falls back to Claude's native document API if conversion fails.
async function generateFromScannedPdf({ buffer, fromPage, toPage, totalPages, n, difficulty, subject, topic, gradeLevel }) {
  const effectiveTo = Math.min(toPage, totalPages, fromPage + 4);
  const pageLabel   = `pages ${fromPage}–${effectiveTo}`;
  const system      = buildGenerateSystem(n, difficulty, subject, topic, gradeLevel);

  try {
    const { fromBuffer } = require('pdf2pic');
    const convert = fromBuffer(buffer, { density: 150, format: 'png', width: 1200, height: 1600 });

    const pageImages = [];
    for (let page = fromPage; page <= effectiveTo; page++) {
      const result = await convert(page, { responseType: 'base64' });
      if (result?.base64) pageImages.push(result.base64);
    }
    if (!pageImages.length) throw new Error('pdf2pic returned no images');

    console.log('[PDF] Vision: converted', pageImages.length, 'pages to PNG');
    const aiRes = await callClaude([{
      role: 'user',
      content: [
        ...pageImages.map(b64 => ({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: b64 } })),
        { type: 'text', text: `Generate ${n} ${difficulty} exam questions from these ${pageImages.length} scanned page(s) (${pageLabel}).${topic ? ` Topic: ${topic}.` : ''}` },
      ],
    }], system);
    return aiRes.content?.[0]?.text || '';
  } catch (convErr) {
    console.log('[PDF] pdf2pic unavailable:', convErr.message, '→ Claude document API');
    const base64 = buffer.toString('base64');
    const aiRes = await callClaude([{
      role: 'user',
      content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
        { type: 'text', text: `Generate ${n} ${difficulty} exam questions from ${pageLabel} of this scanned document.${topic ? ` Topic: ${topic}.` : ''}` },
      ],
    }], system);
    return aiRes.content?.[0]?.text || '';
  }
}

// ── POST /api/v1/ai/generate ──────────────────────────────────────────────────
router.post('/generate', requireAuth, checkAiLimit, async (req, res, next) => {
  try {
    const { content, subject, topic, gradeLevel, difficulty = 'medium', count = 10, types = ['mcq'] } = req.body;
    if (!content) return res.status(400).json({ error: 'validation_error', message: 'content is required.' });

    const system = `You are an expert exam question writer for ${subject || 'general'} at ${gradeLevel || 'school'} level.
Generate exactly ${count} questions at ${difficulty} difficulty on the topic: ${topic || subject || 'the provided content'}.
Types requested: ${types.join(', ')}.
Return ONLY a valid JSON array of question objects with this structure:
[{
  "type": "mcq" | "short_answer",
  "stem": "question text",
  "options": [{"letter":"A","text":"..."},{"letter":"B","text":"..."},{"letter":"C","text":"..."}],
  "answer": "A",
  "part": "Part 1",
  "partInstruction": "For each question, choose the correct answer.",
  "subject": "${subject||''}",
  "gradeLevel": "${gradeLevel||''}",
  "topic": "${topic||''}",
  "difficulty": "${difficulty}"
}]
For short_answer questions omit options and answer. No markdown, no explanation, just the JSON array.`;

    const aiRes    = await callClaude([{ role: 'user', content }], system);
    const raw      = aiRes.content?.[0]?.text || '';
    const questions = salvageJSON(raw);

    await incrementAiUsage(req.teacherId);
    const { rows } = await db.query('SELECT ai_usage_month FROM teachers WHERE id=$1', [req.teacherId]);
    const used = rows[0]?.ai_usage_month || 0;
    res.json({ questions, usage: { used, limit: req.aiRemaining !== undefined ? used + req.aiRemaining : null } });
  } catch (err) { next(err); }
});

// ── POST /api/v1/ai/import-pdf ────────────────────────────────────────────────
// mode=generate → one or more PDFs with per-file page ranges → generate N questions
// (no mode)     → single PDF → extract existing questions
router.post(
  '/import-pdf',
  requireAuth,
  checkAiLimit,
  upload.fields([{ name: 'file', maxCount: 1 }, { name: 'pdfs', maxCount: 3 }]),
  async (req, res, next) => {
    try {
      console.log('[PDF Import] mode:', req.body.mode, '| fields:', Object.keys(req.files || {}));

      if (req.body.mode === 'generate') {
        // Support both old single-file ('file') and new multi-file ('pdfs') clients
        const pdfFiles = req.files?.pdfs || req.files?.file || [];
        if (!pdfFiles.length) return res.status(400).json({ error: 'validation_error', message: 'No PDFs uploaded.' });

        const totalSize = pdfFiles.reduce((s, f) => s + f.size, 0);
        if (totalSize > 20 * 1024 * 1024) return res.status(400).json({ error: 'validation_error', message: 'Total PDF size must be under 20 MB.' });

        const { difficulty = 'medium', subject, topic, gradeLevel, instructions = '' } = req.body;
        const n         = Math.min(Math.max(parseInt(req.body.count) || 10, 1), 50);
        const fromPages = req.body.fromPages ? JSON.parse(req.body.fromPages) : [parseInt(req.body.fromPage) || 1];
        const toPages   = req.body.toPages   ? JSON.parse(req.body.toPages)   : [parseInt(req.body.toPage)   || 999];

        console.log('[PDF Import] files:', pdfFiles.map(f => f.originalname), '| pages:', fromPages, '-', toPages);

        // Build combined Claude content from all PDFs
        const contentItems = [];
        const textSections = [];

        for (let i = 0; i < pdfFiles.length; i++) {
          const pdfFile  = pdfFiles[i];
          const fp       = parseInt(fromPages[i]) || 1;
          const tp       = parseInt(toPages[i])   || 999;

          const textScan  = await pdfParse(pdfFile.buffer);
          const isScanned = !textScan.text || textScan.text.trim().length < 100;
          console.log(`[PDF ${i + 1}/${pdfFiles.length}] "${pdfFile.originalname}" pages:${textScan.numpages} scanned:${isScanned}`);

          if (isScanned) {
            // Scanned PDF — send as Claude document (fallback handles page range via prompt)
            const base64 = pdfFile.buffer.toString('base64');
            contentItems.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } });
            contentItems.push({ type: 'text', text: `(Above document: "${pdfFile.originalname}", please focus on pages ${fp}–${Math.min(tp, textScan.numpages)})` });
          } else {
            // Text PDF — extract page range
            let currentPage = 0;
            const data = await pdfParse(pdfFile.buffer, {
              pagerender(pageData) {
                currentPage++;
                if (currentPage >= fp && currentPage <= tp) {
                  return pageData.getTextContent().then(tc => tc.items.map(it => it.str).join(' '));
                }
                return Promise.resolve('');
              },
            });
            let docText = data.text.trim();
            if (!docText) {
              const pages = data.text.split('\f');
              docText = pages.slice(fp - 1, tp).join('\n').trim() || data.text.trim();
            }
            if (docText) {
              textSections.push(`=== "${pdfFile.originalname}" (pages ${fp}–${Math.min(tp, data.numpages)}) ===\n${docText}`);
            }
          }
        }

        if (textSections.length) {
          contentItems.push({ type: 'text', text: textSections.join('\n\n') });
        }

        if (!contentItems.length) {
          return res.status(400).json({ error: 'validation_error', message: 'Could not extract content from the provided PDFs.' });
        }

        contentItems.push({
          type: 'text',
          text: `Based on all the document content above, generate ${n} ${difficulty} exam questions.${topic ? ` Topic: ${topic}.` : ''}${instructions ? ` Additional instructions: ${instructions}` : ''}`,
        });

        const aiRes     = await callClaude([{ role: 'user', content: contentItems }], buildGenerateSystem(n, difficulty, subject, topic, gradeLevel));
        const raw       = aiRes.content?.[0]?.text || '';
        const questions = salvageJSON(raw);

        await incrementAiUsage(req.teacherId);
        const { rows } = await db.query('SELECT ai_usage_month FROM teachers WHERE id=$1', [req.teacherId]);
        const used = rows[0]?.ai_usage_month || 0;
        return res.json({ questions, usage: { used, limit: req.aiRemaining !== undefined ? used + req.aiRemaining : null } });
      }

      // Extract mode (single PDF → find existing questions)
      const singleFile = req.files?.file?.[0];
      if (!singleFile) return res.status(400).json({ error: 'validation_error', message: 'No PDF uploaded.' });
      if (singleFile.size > 20 * 1024 * 1024) return res.status(400).json({ error: 'validation_error', message: 'PDF must be under 20 MB.' });

      const base64 = singleFile.buffer.toString('base64');
      const system  = `You are an expert at extracting exam questions from PDF documents.
Extract all questions from the document and return ONLY a valid JSON array with this structure:
[{
  "type": "mcq" | "short_answer",
  "stem": "question text",
  "options": [{"letter":"A","text":"..."},...],
  "answer": "A",
  "part": "Part 1",
  "partInstruction": "instruction text if present",
  "stimulus": {"type":"notice|sign|message|text","body":"stimulus text if present"}
}]
Preserve all stimulus/context boxes. No markdown. Just the JSON array.`;

      const aiRes = await callClaude([{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
          { type: 'text', text: 'Extract all questions from this exam paper.' },
        ],
      }], system);

      const raw       = aiRes.content?.[0]?.text || '';
      const questions = salvageJSON(raw);

      await incrementAiUsage(req.teacherId);
      const { rows } = await db.query('SELECT ai_usage_month FROM teachers WHERE id=$1', [req.teacherId]);
      const used = rows[0]?.ai_usage_month || 0;
      res.json({ questions, usage: { used, limit: req.aiRemaining !== undefined ? used + req.aiRemaining : null } });
    } catch (err) { next(err); }
  }
);

// ── POST /api/v1/ai/from-image ────────────────────────────────────────────────
// Accepts up to 10 images (JPEG/PNG/WebP) or 1 PDF (treated as scanned).
router.post('/from-image', requireAuth, checkAiLimit, upload.array('images', 10), async (req, res, next) => {
  try {
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ error: 'validation_error', message: 'No files uploaded.' });

    const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const allowed     = [...IMAGE_TYPES, 'application/pdf'];

    for (const f of files) {
      if (!allowed.includes(f.mimetype))
        return res.status(400).json({ error: 'validation_error', message: `${f.originalname}: must be JPEG, PNG, WebP, or PDF.` });
      if (f.mimetype === 'application/pdf' && f.size > 10 * 1024 * 1024)
        return res.status(400).json({ error: 'validation_error', message: `${f.originalname}: PDF must be under 10 MB.` });
      if (f.mimetype !== 'application/pdf' && f.size > 2 * 1024 * 1024)
        return res.status(400).json({ error: 'validation_error', message: `${f.originalname}: image must be under 2 MB.` });
    }
    const totalSize = files.reduce((s, f) => s + f.size, 0);
    if (totalSize > 10 * 1024 * 1024)
      return res.status(400).json({ error: 'validation_error', message: 'Total size must be under 10 MB.' });

    const { subject, topic, gradeLevel, difficulty = 'medium', count = 10, instructions = '' } = req.body;
    const n = Math.min(Math.max(parseInt(count) || 10, 1), 50);

    // If any file is a PDF, route it through the scanned helper
    const pdfFile = files.find(f => f.mimetype === 'application/pdf');
    if (pdfFile) {
      const textScan = await pdfParse(pdfFile.buffer);
      const raw       = await generateFromScannedPdf({
        buffer: pdfFile.buffer,
        fromPage: 1, toPage: 5, totalPages: textScan.numpages,
        n, difficulty, subject, topic, gradeLevel,
      });
      const questions = salvageJSON(raw);
      await incrementAiUsage(req.teacherId);
      const { rows } = await db.query('SELECT ai_usage_month FROM teachers WHERE id=$1', [req.teacherId]);
      const used = rows[0]?.ai_usage_month || 0;
      return res.json({ questions, isScanned: true, usage: { used, limit: req.aiRemaining !== undefined ? used + req.aiRemaining : null } });
    }

    // All images — send in one Claude Vision request
    const system = buildGenerateSystem(n, difficulty, subject, topic, gradeLevel);
    const aiRes = await callClaude([{
      role: 'user',
      content: [
        ...files.map(f => ({ type: 'image', source: { type: 'base64', media_type: f.mimetype, data: f.buffer.toString('base64') } })),
        { type: 'text', text: `These are ${files.length} image(s) from a ${subject || 'subject'} resource. Generate ${n} ${difficulty} exam questions from the content across all these images.${topic ? ` Topic: ${topic}.` : ''}${instructions ? ` Additional instructions: ${instructions}` : ''}` },
      ],
    }], system);

    const raw       = aiRes.content?.[0]?.text || '';
    const questions = salvageJSON(raw);

    await incrementAiUsage(req.teacherId);
    const { rows } = await db.query('SELECT ai_usage_month FROM teachers WHERE id=$1', [req.teacherId]);
    const used = rows[0]?.ai_usage_month || 0;
    res.json({ questions, usage: { used, limit: req.aiRemaining !== undefined ? used + req.aiRemaining : null } });
  } catch (err) { next(err); }
});

// ── POST /api/v1/ai/import-paper ─────────────────────────────────────────────
// Convert a scanned/photographed exam paper into electronic GradiSpace questions.
// Pro+ only. Accepts up to 10 images (JPEG/PNG) and/or up to 3 PDFs.
router.post(
  '/import-paper',
  requireAuth,
  requirePlan('pro', 'school'),
  upload.fields([{ name: 'images', maxCount: 10 }, { name: 'pdfs', maxCount: 3 }]),
  async (req, res, next) => {
    try {
      const images = req.files?.images || [];
      const pdfs   = req.files?.pdfs   || [];
      if (!images.length && !pdfs.length) {
        return res.status(400).json({ error: 'validation_error', message: 'No files uploaded.' });
      }

      for (const f of images) {
        if (f.size > 2 * 1024 * 1024)
          return res.status(400).json({ error: 'validation_error', message: `${f.originalname}: images must be under 2 MB each.` });
      }

      const { subject = '', gradeLevel = '', instructions = '' } = req.body;

      const system = `You are converting a physical exam paper into electronic format.
Your task is to EXTRACT and PRESERVE the exact questions from this exam paper.
Do NOT generate new questions — only extract what is already there.

Subject: ${subject || 'Not specified'}
Grade Level: ${gradeLevel || 'Not specified'}
Teacher instructions: ${instructions || 'None'}

For each question found:
- Preserve the exact question text and numbering
- Identify the question type: "mcq" or "short_answer"
- Extract all answer options exactly as written
- If correct answers are visible on the paper, include them
- If it is a matching/grid question (e.g. "match the person to the statement"), convert each row to an individual MCQ where the column headers become the answer options (A, B, C...)
- Preserve any reading passages or stimulus blocks as a passage object linked to related questions
- Mark any question you are uncertain about with "_uncertain": true

Return ONLY a valid JSON array:
[{
  "type": "mcq",
  "stem": "exact question text",
  "options": [{"letter": "A", "text": "..."}, {"letter": "B", "text": "..."}, {"letter": "C", "text": "..."}],
  "answer": "A",
  "passage": {"title": "...", "text": "..."},
  "_uncertain": false
}]
Omit "passage" if not present. For short_answer omit "options". No markdown, no explanation, only the JSON array.`;

      const contentItems = [];

      for (const f of images) {
        const mt = f.mimetype === 'image/jpg' ? 'image/jpeg' : f.mimetype;
        contentItems.push({ type: 'image', source: { type: 'base64', media_type: mt, data: f.buffer.toString('base64') } });
      }

      for (const f of pdfs) {
        contentItems.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: f.buffer.toString('base64') } });
      }

      contentItems.push({ type: 'text', text: 'Extract all questions from this exam paper exactly as they appear. Return only the JSON array.' });

      const aiRes     = await callClaude([{ role: 'user', content: contentItems }], system);
      const raw       = aiRes.content?.[0]?.text || '';
      const questions = salvageJSON(raw);

      await incrementAiUsage(req.teacherId);
      const { rows } = await db.query('SELECT ai_usage_month FROM teachers WHERE id=$1', [req.teacherId]);
      const used = rows[0]?.ai_usage_month || 0;
      res.json({ questions, usage: { used, limit: null } });
    } catch (err) { next(err); }
  }
);

module.exports = router;
