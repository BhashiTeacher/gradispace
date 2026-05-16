const router = require('express').Router();
const multer = require('multer');
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

// POST /api/v1/ai/import-pdf
router.post('/import-pdf', requireAuth, checkAiLimit, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'validation_error', message: 'No PDF uploaded.' });
    if (req.file.size > 20 * 1024 * 1024) return res.status(400).json({ error: 'validation_error', message: 'PDF must be under 20 MB.' });

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

    const raw = aiRes.content?.[0]?.text || '';
    const questions = salvageJSON(raw);

    await incrementAiUsage(req.teacherId);
    const { rows } = await db.query('SELECT ai_usage_month FROM teachers WHERE id=$1', [req.teacherId]);
    const used = rows[0]?.ai_usage_month || 0;

    res.json({ questions, usage: { used, limit: req.aiRemaining !== undefined ? used + req.aiRemaining : null } });
  } catch (err) { next(err); }
});

module.exports = router;
