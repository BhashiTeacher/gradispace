const router = require('express').Router();
const multer    = require('multer');
const pdfParse  = require('pdf-parse');
const db     = require('../db');
const { requireAuth }   = require('../middleware/auth');
const { checkAiLimit }  = require('../middleware/plan');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

async function callClaude(messages, system) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 8192,
      system,
      messages,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${err}`);
  }
  return res.json();
}

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

// POST /api/v1/ai/generate
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

    const aiRes = await callClaude([{ role: 'user', content }], system);
    const raw = aiRes.content?.[0]?.text || '';
    const questions = salvageJSON(raw);

    await incrementAiUsage(req.teacherId);
    const { rows } = await db.query('SELECT ai_usage_month FROM teachers WHERE id=$1', [req.teacherId]);
    const used = rows[0]?.ai_usage_month || 0;

    res.json({ questions, usage: { used, limit: req.aiRemaining !== undefined ? used + req.aiRemaining : null } });
  } catch (err) { next(err); }
});

// POST /api/v1/ai/import-pdf  (mode=generate → AI-generate questions; default → extract existing questions)
router.post('/import-pdf', requireAuth, checkAiLimit, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'validation_error', message: 'No PDF uploaded.' });
    if (req.file.size > 20 * 1024 * 1024) return res.status(400).json({ error: 'validation_error', message: 'PDF must be under 20 MB.' });

    console.log('[PDF Import] body keys:', Object.keys(req.body));
    console.log('[PDF Import] file:', req.file?.originalname, req.file?.size);
    console.log('[PDF Import] fromPage:', req.body.fromPage, 'toPage:', req.body.toPage);

    if (req.body.mode === 'generate') {
      const { difficulty = 'medium', subject, topic, gradeLevel } = req.body;
      const n           = Math.min(Math.max(parseInt(req.body.count) || 10, 1), 50);
      const fromPage    = parseInt(req.body.fromPage) || 1;
      const toPage      = parseInt(req.body.toPage)   || 999;

      // pagerender callback: return text for pages in range, '' otherwise.
      // data.text in pdf-parse@1.1.1 is the concatenation of all return values.
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

      console.log('[PDF] Total pages:', data.numpages);
      console.log('[PDF] Requested range:', fromPage, 'to', toPage);
      console.log('[PDF] pagerender text length:', data.text.trim().length);

      // Fallback: if pagerender yielded nothing, split full text by form-feed chars
      let docText = data.text.trim();
      if (!docText) {
        const pages = data.text.split('\f');
        docText = pages.slice(fromPage - 1, toPage).join('\n').trim() || data.text.trim();
        console.log('[PDF] Fallback \\f split used, pages found:', pages.length, 'docText length:', docText.length);
      }

      const pageRange = `pages ${fromPage} to ${Math.min(toPage, data.numpages)}`;

      if (!docText) {
        return res.status(400).json({ error: 'validation_error', message: 'Could not extract text from this PDF. It may be a scanned image — try the Image mode instead.' });
      }

      const system = `You are an expert exam question writer for ${subject || 'general'} at ${gradeLevel || 'school'} level.
Generate exactly ${n} questions at ${difficulty} difficulty based on the provided document content.
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

      const aiRes = await callClaude([{
        role: 'user',
        content: `Generate ${n} exam questions from ${pageRange} of this document:\n\n${docText}${topic ? `\n\nFocus on the topic: ${topic}` : ''}`,
      }], system);

      const raw       = aiRes.content?.[0]?.text || '';
      const questions = salvageJSON(raw);

      await incrementAiUsage(req.teacherId);
      const { rows } = await db.query('SELECT ai_usage_month FROM teachers WHERE id=$1', [req.teacherId]);
      const used = rows[0]?.ai_usage_month || 0;
      return res.json({ questions, usage: { used, limit: req.aiRemaining !== undefined ? used + req.aiRemaining : null } });
    }

    // Default: extract existing questions from the PDF (send document directly to Claude)
    const base64 = req.file.buffer.toString('base64');
    const system = `You are an expert at extracting exam questions from PDF documents.
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
        { type: 'text', text: 'Extract all questions from this exam paper.' }
      ]
    }], system);

    const raw       = aiRes.content?.[0]?.text || '';
    const questions = salvageJSON(raw);

    await incrementAiUsage(req.teacherId);
    const { rows } = await db.query('SELECT ai_usage_month FROM teachers WHERE id=$1', [req.teacherId]);
    const used = rows[0]?.ai_usage_month || 0;
    res.json({ questions, usage: { used, limit: req.aiRemaining !== undefined ? used + req.aiRemaining : null } });
  } catch (err) { next(err); }
});

// POST /api/v1/ai/from-image
router.post('/from-image', requireAuth, checkAiLimit, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'validation_error', message: 'No image uploaded.' });
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowed.includes(req.file.mimetype))
      return res.status(400).json({ error: 'validation_error', message: 'Image must be JPEG, PNG, GIF, or WebP.' });
    if (req.file.size > 5 * 1024 * 1024)
      return res.status(400).json({ error: 'validation_error', message: 'Image must be under 5 MB.' });

    const { subject, topic, gradeLevel, difficulty = 'medium', count = 10 } = req.body;
    const n = Math.min(Math.max(parseInt(count) || 10, 1), 50);
    const base64 = req.file.buffer.toString('base64');

    const system = `You are an expert exam question writer for ${subject || 'general'} at ${gradeLevel || 'school'} level.
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
        { type: 'text', text: `Generate ${n} exam questions based on this image.${topic ? ` Topic: ${topic}.` : ''}` }
      ],
    }], system);

    const raw = aiRes.content?.[0]?.text || '';
    const questions = salvageJSON(raw);

    await incrementAiUsage(req.teacherId);
    const { rows } = await db.query('SELECT ai_usage_month FROM teachers WHERE id=$1', [req.teacherId]);
    const used = rows[0]?.ai_usage_month || 0;
    res.json({ questions, usage: { used, limit: req.aiRemaining !== undefined ? used + req.aiRemaining : null } });
  } catch (err) { next(err); }
});

module.exports = router;
