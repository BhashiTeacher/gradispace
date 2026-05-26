const router = require('express').Router();
const crypto = require('crypto');
const db     = require('../db');
const { requireAuth }      = require('../middleware/auth');
const { checkBankLimit, LIMITS } = require('../middleware/plan');

function stemHash(stem) {
  return crypto.createHash('sha256').update((stem || '').trim().toLowerCase()).digest('hex');
}

// GET /api/v1/questions
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { subject, gradeLevel, topic, type, search, page = 1, limit = 50 } = req.query;
    const conditions = ['teacher_id=$1', 'in_bank=true'];
    const params = [req.teacherId];
    let i = 2;
    if (subject)    { conditions.push(`subject=$${i++}`);     params.push(subject); }
    if (gradeLevel) { conditions.push(`grade_level=$${i++}`); params.push(gradeLevel); }
    if (topic)      { conditions.push(`topic=$${i++}`);       params.push(topic); }
    if (type)       { conditions.push(`type=$${i++}`);        params.push(type); }
    if (search)     { conditions.push(`stem ILIKE $${i++}`);  params.push(`%${search}%`); }

    const where  = 'WHERE ' + conditions.join(' AND ');
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [data, count] = await Promise.all([
      db.query(`SELECT id,type,stem,options,answer,subject,grade_level,topic,tags,image_url,audio_url,video_url,difficulty,created_at
                FROM questions ${where} ORDER BY created_at DESC LIMIT $${i} OFFSET $${i+1}`,
        [...params, parseInt(limit), offset]),
      db.query(`SELECT COUNT(*) FROM questions ${where}`, params),
    ]);
    const total = parseInt(count.rows[0].count);
    res.json({ questions: data.rows, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { next(err); }
});

// GET /api/v1/questions/filters
router.get('/filters', requireAuth, async (req, res, next) => {
  try {
    const { subject } = req.query;
    const base = 'WHERE teacher_id=$1 AND in_bank=true';
    const subjectClause = subject ? ' AND subject=$2' : '';
    const topicParams = subject ? [req.teacherId, subject] : [req.teacherId];

    const [subjectsRes, topicsRes, gradesRes] = await Promise.all([
      db.query(
        `SELECT DISTINCT subject FROM questions ${base} AND subject IS NOT NULL ORDER BY subject`,
        [req.teacherId]
      ),
      db.query(
        `SELECT DISTINCT topic FROM questions ${base}${subjectClause} AND topic IS NOT NULL ORDER BY topic`,
        topicParams
      ),
      db.query(
        `SELECT DISTINCT grade_level FROM questions ${base} AND grade_level IS NOT NULL ORDER BY grade_level`,
        [req.teacherId]
      ),
    ]);

    res.json({
      subjects:    subjectsRes.rows.map(r => r.subject),
      topics:      topicsRes.rows.map(r => r.topic),
      gradeLevels: gradesRes.rows.map(r => r.grade_level),
    });
  } catch (err) { next(err); }
});

// POST /api/v1/questions  — single question
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const q = req.body;
    if (!q.stem) return res.status(400).json({ error: 'validation_error', message: 'stem is required.' });

    const inBank = q.inBank === true;

    if (inBank) {
      const { rows: t } = await db.query('SELECT plan FROM teachers WHERE id=$1', [req.teacherId]);
      const plan = t[0]?.plan || 'free';
      const limit = LIMITS[plan]?.bankSize ?? LIMITS.free.bankSize;
      if (limit !== null) {
        const { rows: c } = await db.query('SELECT COUNT(*) FROM questions WHERE teacher_id=$1 AND in_bank=true', [req.teacherId]);
        if (parseInt(c[0].count) >= limit) {
          return res.status(403).json({ error: 'limit_reached', message: `Question bank limit of ${limit} reached. Upgrade to add more.` });
        }
      }
    }

    const hash = stemHash(q.stem);
    const { rows } = await db.query(`
      INSERT INTO questions(teacher_id,in_bank,type,stem,stem_hash,options,answer,
        passage,stimulus,image_url,audio_url,video_url,subject,grade_level,topic,tags,difficulty)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      RETURNING *`,
      [req.teacherId, inBank, q.type||'mcq', q.stem, hash,
       JSON.stringify(q.options||[]), q.answer||null,
       JSON.stringify(q.passage||null), JSON.stringify(q.stimulus||null),
       q.imageUrl||null, q.audioUrl||null, q.videoUrl||null,
       q.subject||null, q.gradeLevel||null, q.topic||null,
       q.tags||[], q.difficulty||'medium']
    );
    res.status(201).json({ question: rows[0] });
  } catch (err) { next(err); }
});

// POST /api/v1/questions/bulk
router.post('/bulk', requireAuth, checkBankLimit, async (req, res, next) => {
  try {
    const { questions = [] } = req.body;
    if (!questions.length) return res.status(400).json({ error: 'validation_error', message: 'questions array is required.' });

    const existing = await db.query('SELECT stem_hash FROM questions WHERE teacher_id=$1 AND in_bank=true', [req.teacherId]);
    const existingHashes = new Set(existing.rows.map(r => r.stem_hash));

    const added = [];
    let skipped = 0;

    for (const q of questions) {
      if (!q.stem) continue;
      const hash = stemHash(q.stem);
      if (existingHashes.has(hash)) { skipped++; continue; }
      const { rows } = await db.query(`
        INSERT INTO questions(teacher_id,in_bank,type,stem,stem_hash,options,answer,
          passage,stimulus,image_url,audio_url,video_url,subject,grade_level,topic,tags,difficulty)
        VALUES($1,true,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        RETURNING *`,
        [req.teacherId, q.type||'mcq', q.stem, hash,
         JSON.stringify(q.options||[]), q.answer||null,
         JSON.stringify(q.passage||null), JSON.stringify(q.stimulus||null),
         q.imageUrl||null, q.audioUrl||null, q.videoUrl||null,
         q.subject||null, q.gradeLevel||null, q.topic||null,
         q.tags||[], q.difficulty||'medium']
      );
      added.push(rows[0]);
      existingHashes.add(hash);
    }
    res.status(201).json({ added: added.length, skipped, questions: added });
  } catch (err) { next(err); }
});

// GET /api/v1/questions/:id
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM questions WHERE id=$1 AND teacher_id=$2', [req.params.id, req.teacherId]);
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json({ question: rows[0] });
  } catch (err) { next(err); }
});

// PUT /api/v1/questions/:id
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const allowed = { stem:'stem', options:'options', answer:'answer', type:'type',
      inBank:'in_bank', passage:'passage', stimulus:'stimulus',
      imageUrl:'image_url', audioUrl:'audio_url', videoUrl:'video_url',
      subject:'subject', gradeLevel:'grade_level', topic:'topic', tags:'tags', difficulty:'difficulty' };
    const sets = []; const vals = []; let i = 1;
    const jsonbCols = new Set(['options', 'passage', 'stimulus']);
    for (const [k, col] of Object.entries(allowed)) {
      if (req.body[k] !== undefined) {
        sets.push(`${col}=$${i++}`);
        let v = req.body[k];
        if (jsonbCols.has(col) && v !== null && typeof v === 'object') v = JSON.stringify(v);
        vals.push(v);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'validation_error', message: 'No valid fields.' });
    sets.push('updated_at=NOW()');
    vals.push(req.params.id, req.teacherId);
    const { rows } = await db.query(
      `UPDATE questions SET ${sets.join(',')} WHERE id=$${i} AND teacher_id=$${i+1} RETURNING *`, vals
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json({ question: rows[0] });
  } catch (err) { next(err); }
});

// DELETE /api/v1/questions/:id
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const { rows: usages } = await db.query(
      'SELECT 1 FROM exam_questions WHERE question_id=$1 LIMIT 1', [req.params.id]
    );
    if (usages.length) {
      // Question is used in an exam — soft-delete by removing from bank only
      const { rowCount } = await db.query(
        'UPDATE questions SET in_bank=false WHERE id=$1 AND teacher_id=$2', [req.params.id, req.teacherId]
      );
      if (!rowCount) return res.status(404).json({ error: 'not_found' });
    } else {
      const { rowCount } = await db.query(
        'DELETE FROM questions WHERE id=$1 AND teacher_id=$2', [req.params.id, req.teacherId]
      );
      if (!rowCount) return res.status(404).json({ error: 'not_found' });
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
