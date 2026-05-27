const router = require('express').Router();
const db     = require('../db');
const { requireAuth }    = require('../middleware/auth');
const { checkExamLimit } = require('../middleware/plan');

// GET /api/v1/exams
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { subject, gradeLevel, published, groupId, page = 1, limit = 20 } = req.query;
    const conditions = ['e.teacher_id=$1'];
    const params = [req.teacherId];
    let i = 2;
    if (subject)    { conditions.push(`e.subject=$${i++}`);     params.push(subject); }
    if (gradeLevel) { conditions.push(`e.grade_level=$${i++}`); params.push(gradeLevel); }
    if (published !== undefined) { conditions.push(`e.published=$${i++}`); params.push(published === 'true'); }
    if (groupId) {
      conditions.push(`e.id IN (SELECT exam_id FROM exam_group_exams WHERE group_id=$${i++})`);
      params.push(groupId);
    }
    const where  = 'WHERE ' + conditions.join(' AND ');
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [dataRes, countRes] = await Promise.all([
      db.query(`
        SELECT e.*,
          (SELECT COUNT(*) FROM exam_questions WHERE exam_id=e.id)   AS question_count,
          (SELECT COUNT(*) FROM submissions WHERE exam_id=e.id AND submitted_at IS NOT NULL) AS submission_count
        FROM exams e ${where}
        ORDER BY e.created_at DESC
        LIMIT $${i} OFFSET $${i+1}
      `, [...params, parseInt(limit), offset]),
      db.query(`SELECT COUNT(*) FROM exams e ${where}`, params),
    ]);

    const total = parseInt(countRes.rows[0].count);
    res.json({ exams: dataRes.rows, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { next(err); }
});

// POST /api/v1/exams
router.post('/', requireAuth, checkExamLimit, async (req, res, next) => {
  try {
    const { title, subject, topic, gradeLevel, duration, description, examType = 'open', questions = [] } = req.body;
    if (!title) return res.status(400).json({ error: 'validation_error', message: 'title is required.' });

    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        'INSERT INTO exams(teacher_id,title,subject,topic,grade_level,duration,description,exam_type) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
        [req.teacherId, title, subject, topic, gradeLevel, duration || 45, description, examType]
      );
      const exam = rows[0];

      // Attach questions if provided
      if (questions.length) {
        for (let idx = 0; idx < questions.length; idx++) {
          const q = questions[idx];
          const qId = typeof q === 'string' ? q : q.questionId;
          await client.query(
            'INSERT INTO exam_questions(exam_id,question_id,order_num,part,part_instruction) VALUES($1,$2,$3,$4,$5)',
            [exam.id, qId, idx, q.part || 'Part 1', q.partInstruction || null]
          );
        }
      }
      await client.query('COMMIT');
      res.status(201).json({ exam });
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  } catch (err) { next(err); }
});

// GET /api/v1/exams/:id
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { rows: eRows } = await db.query('SELECT * FROM exams WHERE id=$1 AND teacher_id=$2', [req.params.id, req.teacherId]);
    if (!eRows[0]) return res.status(404).json({ error: 'not_found' });
    const { rows: qRows } = await db.query(`
      SELECT q.id, q.difficulty, q.subject, q.topic, q.grade_level, q.in_bank,
             q.in_bank AS from_question_bank,
             eq.order_num,
             eq.part AS eq_part,
             COALESCE(eq.part_instruction, '') AS eq_part_instruction,
             COALESCE(eq.type, q.type) AS type,
             COALESCE(eq.stem, q.stem) AS stem,
             COALESCE(eq.options, q.options) AS options,
             COALESCE(eq.answer, q.answer) AS answer,
             COALESCE(eq.passage, q.passage) AS passage,
             COALESCE(eq.stimulus, q.stimulus) AS stimulus,
             COALESCE(eq.image_url, q.image_url) AS image_url,
             COALESCE(eq.audio_url, q.audio_url) AS audio_url,
             eq.audio_play_limit,
             COALESCE(eq.video_url, q.video_url) AS video_url
      FROM exam_questions eq
      JOIN questions q ON q.id = eq.question_id
      WHERE eq.exam_id=$1
      ORDER BY eq.order_num
    `, [req.params.id]);
    res.json({ exam: eRows[0], questions: qRows });
  } catch (err) { next(err); }
});

// PUT /api/v1/exams/:id
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const allowed = ['title','subject','topic','grade_level','duration','description','exam_type','result_view'];
    const sets = [];
    const vals = [];
    let i = 1;
    for (const [k, v] of Object.entries(req.body)) {
      const col = k === 'gradeLevel' ? 'grade_level' : k === 'examType' ? 'exam_type' : k === 'resultView' ? 'result_view' : k;
      if (allowed.includes(col)) { sets.push(`${col}=$${i++}`); vals.push(v); }
    }
    if (!sets.length) return res.status(400).json({ error: 'validation_error', message: 'No valid fields to update.' });
    sets.push(`updated_at=NOW()`);
    vals.push(req.params.id, req.teacherId);
    const { rows } = await db.query(
      `UPDATE exams SET ${sets.join(',')} WHERE id=$${i} AND teacher_id=$${i+1} RETURNING *`, vals
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json({ exam: rows[0] });
  } catch (err) { next(err); }
});

// DELETE /api/v1/exams/:id
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const { rowCount } = await db.query('DELETE FROM exams WHERE id=$1 AND teacher_id=$2', [req.params.id, req.teacherId]);
    if (!rowCount) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// POST /api/v1/exams/:id/publish
router.post('/:id/publish', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'UPDATE exams SET published=true, updated_at=NOW() WHERE id=$1 AND teacher_id=$2 RETURNING *',
      [req.params.id, req.teacherId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    const exam = rows[0];
    const studentLink = `${process.env.CLIENT_URL}/e/${exam.access_token}`;
    res.json({ exam, studentLink });
  } catch (err) { next(err); }
});

// POST /api/v1/exams/:id/unpublish
router.post('/:id/unpublish', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'UPDATE exams SET published=false, updated_at=NOW() WHERE id=$1 AND teacher_id=$2 RETURNING *',
      [req.params.id, req.teacherId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json({ exam: rows[0] });
  } catch (err) { next(err); }
});

// PUT /api/v1/exams/:id/questions  — replace question list with snapshots
router.put('/:id/questions', requireAuth, async (req, res, next) => {
  try {
    const { questions = [] } = req.body;
    const { rowCount } = await db.query('SELECT 1 FROM exams WHERE id=$1 AND teacher_id=$2', [req.params.id, req.teacherId]);
    if (!rowCount) return res.status(404).json({ error: 'not_found' });

    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM exam_questions WHERE exam_id=$1', [req.params.id]);
      for (let idx = 0; idx < questions.length; idx++) {
        const q = questions[idx];
        await client.query(`
          INSERT INTO exam_questions(
            exam_id,question_id,order_num,part,part_instruction,
            stem,options,answer,type,passage,image_url,audio_url,video_url,stimulus,audio_play_limit
          ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
          [req.params.id, q.questionId, idx, q.part || 'Part 1', q.partInstruction || null,
           q.stem || null,
           q.options != null ? JSON.stringify(q.options) : null,
           q.answer || null,
           q.type || null,
           q.passage != null ? JSON.stringify(q.passage) : null,
           q.imageUrl || null,
           q.audioUrl || null,
           q.videoUrl || null,
           q.stimulus != null ? JSON.stringify(q.stimulus) : null,
           q.audioPlayLimit != null ? parseInt(q.audioPlayLimit) : null]
        );
      }
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }

    const { rows } = await db.query(`
      SELECT q.id, q.difficulty, q.subject, q.topic, q.grade_level, q.in_bank,
             eq.order_num, eq.part AS eq_part,
             COALESCE(eq.type, q.type) AS type,
             COALESCE(eq.stem, q.stem) AS stem,
             COALESCE(eq.options, q.options) AS options,
             COALESCE(eq.answer, q.answer) AS answer,
             COALESCE(eq.passage, q.passage) AS passage
      FROM exam_questions eq JOIN questions q ON q.id=eq.question_id
      WHERE eq.exam_id=$1 ORDER BY eq.order_num
    `, [req.params.id]);
    res.json({ questions: rows });
  } catch (err) { next(err); }
});

// PUT /api/v1/exams/:examId/questions/:questionId  — update exam snapshot only (no questions table touch)
router.put('/:examId/questions/:questionId', requireAuth, async (req, res, next) => {
  try {
    const { stem, options, answer, type, audioUrl, audioPlayLimit } = req.body;
    const { rowCount } = await db.query(
      'SELECT 1 FROM exams WHERE id=$1 AND teacher_id=$2', [req.params.examId, req.teacherId]
    );
    if (!rowCount) return res.status(404).json({ error: 'not_found' });
    await db.query(`
      UPDATE exam_questions SET
        stem=$1, options=$2, answer=$3, type=$4, audio_url=$5, audio_play_limit=$6
      WHERE exam_id=$7 AND question_id=$8`,
      [stem || null,
       options != null ? JSON.stringify(options) : null,
       answer || null,
       type || null,
       audioUrl || null,
       audioPlayLimit != null ? parseInt(audioPlayLimit) : null,
       req.params.examId, req.params.questionId]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
