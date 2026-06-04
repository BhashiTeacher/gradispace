const router    = require('express').Router();
const multer    = require('multer');
const pdfParse  = require('pdf-parse');
const db        = require('../db');
const { requireAuth }  = require('../middleware/auth');
const { checkAiLimit } = require('../middleware/plan');

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
// Converts up to 5 pages to PNG images via pdf2pic (needs ImageMagick + Ghostscript),
// then sends them to Claude Vision. Falls back to Claude's native PDF document API
// if the conversion fails (e.g. system binaries not available).
async function generateFromScannedPdf({ buffer, fromPage, toPage, totalPages, n, difficulty, subject, topic, gradeLevel }) {
  const effectiveTo = Math.min(toPage, totalPages, fromPage + 4); // cap at 5 pages
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
    // Claude's document API handles both text and scanned PDFs natively
    console.log('[PDF] pdf2pic unavailable:', convErr.message, '→ Claude document API fallback');
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
// mode=generate → detect scanned vs text, generate N questions
// (no mode)     → extract existing questions from the PDF
router.post('/import-pdf', requireAuth, checkAiLimit, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'validation_error', message: 'No PDF uploaded.' });
    if (req.file.size > 20 * 1024 * 1024) return res.status(400).json({ error: 'validation_error', message: 'PDF must be under 20 MB.' });

    console.log('[PDF Import] file:', req.file.originalname, req.file.size, '| mode:', req.body.mode);
    console.log('[PDF Import] fromPage:', req.body.fromPage, 'toPage:', req.body.toPage);

    if (req.body.mode === 'generate') {
      const { difficulty = 'medium', subject, topic, gradeLevel } = req.body;
      const n        = Math.min(Math.max(parseInt(req.body.count) || 10, 1), 50);
      const fromPage = parseInt(req.body.fromPage) || 1;
      const toPage   = parseInt(req.body.toPage)   || 999;

      // Detect scanned vs text PDF
      const textScan  = await pdfParse(req.file.buffer);
      const isScanned = !textScan.text || textScan.text.trim().length < 100;
      console.log('[PDF] Total pages:', textScan.numpages, '| Scanned:', isScanned, '| Text len:', textScan.text?.trim().length ?? 0);

      let raw;
      if (isScanned) {
        console.log('[PDF] Scanned PDF detected — switching to vision mode');
        raw = await generateFromScannedPdf({
          buffer: req.file.buffer,
          fromPage, toPage, totalPages: textScan.numpages,
          n, difficulty, subject, topic, gradeLevel,
        });
      } else {
        // Text PDF — pagerender range slice with \f fallback
        let currentPage = 0;
        const data = await pdfParse(req.file.buffer, {
          pagerender(pageData) {
            currentPage++;
            if (currentPage >= fromPage && currentPage <= toPage) {
              return pageData.getTextContent().then(tc => tc.items.map(i => i.str).join(' '));
            }
            return Promise.resolve('');
          },
        });

        let docText = data.text.trim();
        if (!docText) {
          const pages = data.text.split('\f');
          docText = pages.slice(fromPage - 1, toPage).join('\n').trim() || data.text.trim();
          console.log('[PDF] \\f fallback — pages found:', pages.length, 'docText len:', docText.length);
        }
        console.log('[PDF] Text extraction: range', fromPage, '-', toPage, '| len:', docText.length);

        if (!docText) {
          return res.status(400).json({ error: 'validation_error', message: 'Could not extract text from this PDF. It may be a scanned document — re-upload and it will be processed automatically.' });
        }

        const pageRange = `pages ${fromPage} to ${Math.min(toPage, data.numpages)}`;
        const aiRes = await callClaude([{
          role: 'user',
          content: `Generate ${n} exam questions from ${pageRange} of this document:\n\n${docText}${topic ? `\n\nFocus on the topic: ${topic}` : ''}`,
        }], buildGenerateSystem(n, difficulty, subject, topic, gradeLevel));
        raw = aiRes.content?.[0]?.text || '';
      }

      const questions = salvageJSON(raw);
      await incrementAiUsage(req.teacherId);
      const { rows } = await db.query('SELECT ai_usage_month FROM teachers WHERE id=$1', [req.teacherId]);
      const used = rows[0]?.ai_usage_month || 0;
      return res.json({ questions, isScanned, usage: { used, limit: req.aiRemaining !== undefined ? used + req.aiRemaining : null } });
    }

    // Default: extract existing questions (sends full PDF to Claude as a document)
    const base64 = req.file.buffer.toString('base64');
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
});

// ── POST /api/v1/ai/from-image ────────────────────────────────────────────────
// Accepts JPEG/PNG/GIF/WebP images and PDFs (treated as scanned, pages 1-5).
router.post('/from-image', requireAuth, checkAiLimit, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'validation_error', message: 'No file uploaded.' });

    const isPdf    = req.file.mimetype === 'application/pdf';
    const allowed  = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!allowed.includes(req.file.mimetype))
      return res.status(400).json({ error: 'validation_error', message: 'File must be JPEG, PNG, GIF, WebP, or PDF.' });

    const sizeLimit = isPdf ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
    if (req.file.size > sizeLimit)
      return res.status(400).json({ error: 'validation_error', message: isPdf ? 'PDF must be under 10 MB.' : 'Image must be under 5 MB.' });

    const { subject, topic, gradeLevel, difficulty = 'medium', count = 10 } = req.body;
    const n = Math.min(Math.max(parseInt(count) || 10, 1), 50);

    if (isPdf) {
      const textScan = await pdfParse(req.file.buffer);
      console.log('[From-Image PDF] pages:', textScan.numpages, '— processing as scanned');
      const raw       = await generateFromScannedPdf({
        buffer: req.file.buffer,
        fromPage: 1, toPage: 5, totalPages: textScan.numpages,
        n, difficulty, subject, topic, gradeLevel,
      });
      const questions = salvageJSON(raw);
      await incrementAiUsage(req.teacherId);
      const { rows } = await db.query('SELECT ai_usage_month FROM teachers WHERE id=$1', [req.teacherId]);
      const used = rows[0]?.ai_usage_month || 0;
      return res.json({ questions, isScanned: true, usage: { used, limit: req.aiRemaining !== undefined ? used + req.aiRemaining : null } });
    }

    // Regular image
    const base64 = req.file.buffer.toString('base64');
    const system  = `You are an expert exam question writer for ${subject || 'general'} at ${gradeLevel || 'school'} level.
Examine the image carefully and generate exactly ${n} multiple-choice questions at ${difficulty} difficulty.
The questions must test understanding of the specific content shown in the image.
Return ONLY a valid JSON array:
[{
  "type": "mcq",
  "stem": "question text",
  "options": [{"letter":"A","text":"..."},{"letter":"B","text":"..."},{"letter":"C","text":"..."},{"letter":"D","text":"..."}],
  "answer": "A",
  "subject": "${subject || ''}",
  "gradeLevel": "${gradeLevel || ''}",
  "topic": "${topic || ''}",
  "difficulty": "${difficulty}"
}]
No markdown, no explanation, just the JSON array.`;

    const aiRes = await callClaude([{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: req.file.mimetype, data: base64 } },
        { type: 'text', text: `Generate ${n} exam questions based on this image.${topic ? ` Topic: ${topic}.` : ''}` },
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

module.exports = router;
