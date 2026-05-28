const router      = require('express').Router();
const PDFDocument = require('pdfkit');
const db          = require('../db');
const { requireAuth }              = require('../middleware/auth');
const { checkExamLimit, requirePlan } = require('../middleware/plan');

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
    const { stem, options, answer, type, audioUrl, audioPlayLimit, videoUrl } = req.body;
    const { rowCount } = await db.query(
      'SELECT 1 FROM exams WHERE id=$1 AND teacher_id=$2', [req.params.examId, req.teacherId]
    );
    if (!rowCount) return res.status(404).json({ error: 'not_found' });
    await db.query(`
      UPDATE exam_questions SET
        stem=$1, options=$2, answer=$3, type=$4, audio_url=$5, audio_play_limit=$6, video_url=$7
      WHERE exam_id=$8 AND question_id=$9`,
      [stem || null,
       options != null ? JSON.stringify(options) : null,
       answer || null,
       type || null,
       audioUrl || null,
       audioPlayLimit != null ? parseInt(audioPlayLimit) : null,
       videoUrl || null,
       req.params.examId, req.params.questionId]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// GET /api/v1/exams/:id/print-pdf  — generate printable exam paper (Pro)
router.get('/:id/print-pdf', requireAuth, requirePlan('pro', 'school'), async (req, res, next) => {
  try {
    const { rows: eRows } = await db.query(`
      SELECT e.*, t.name AS teacher_name, t.portal_title, t.brand_colour
      FROM exams e JOIN teachers t ON t.id=e.teacher_id
      WHERE e.id=$1 AND e.teacher_id=$2
    `, [req.params.id, req.teacherId]);
    if (!eRows[0]) return res.status(404).json({ error: 'not_found' });
    const exam = eRows[0];

    const { rows: qRows } = await db.query(`
      SELECT COALESCE(eq.type, q.type) AS type,
             COALESCE(eq.stem, q.stem) AS stem,
             COALESCE(eq.options, q.options) AS options,
             COALESCE(eq.passage, q.passage) AS passage,
             COALESCE(eq.stimulus, q.stimulus) AS stimulus,
             eq.part, eq.part_instruction
      FROM exam_questions eq
      JOIN questions q ON q.id=eq.question_id
      WHERE eq.exam_id=$1 ORDER BY eq.order_num
    `, [exam.id]);

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 60, left: 50, right: 50 },
      bufferPages: true,
    });

    const safeName = (exam.title || 'exam').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_').slice(0, 50);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}_paper.pdf"`);
    doc.pipe(res);

    const W = doc.page.width - 100;  // content width
    const L = 50;                    // left margin
    const brand = /^#[0-9a-f]{3,6}$/i.test(exam.brand_colour || '') ? exam.brand_colour : '#003865';
    const PAGE_H = doc.page.height;
    const SAFE_BOTTOM = PAGE_H - 65;

    function needPage(est = 80) {
      if (doc.y + est > SAFE_BOTTOM) doc.addPage();
    }

    // ─── Header ──────────────────────────────────────────────────────────────
    doc.rect(L, 38, W, 3).fill(brand);
    doc.y = 49;

    const school = (exam.portal_title || exam.teacher_name || '').trim();
    if (school) {
      doc.font('Helvetica').fontSize(8).fillColor('#888888')
         .text(school.toUpperCase(), L, doc.y, { width: W, align: 'center' });
      doc.y += 4;
    }

    doc.font('Helvetica-Bold').fontSize(18).fillColor('#111111')
       .text(exam.title, L, doc.y, { width: W, align: 'center' });
    doc.moveDown(0.25);

    const meta = [
      exam.subject,
      exam.grade_level ? `Grade ${exam.grade_level}` : '',
      exam.duration    ? `${exam.duration} min`        : '',
      `${qRows.length} question${qRows.length !== 1 ? 's' : ''}`,
    ].filter(Boolean).join('   ·   ');
    doc.font('Helvetica').fontSize(9).fillColor('#666666')
       .text(meta, L, doc.y, { width: W, align: 'center' });
    doc.moveDown(0.65);

    doc.moveTo(L, doc.y).lineTo(L + W, doc.y).lineWidth(0.5).strokeColor('#CCCCCC').stroke();
    doc.moveDown(0.55);

    // ─── Student details box ──────────────────────────────────────────────────
    const boxY = doc.y;
    doc.moveTo(L, boxY).lineTo(L + W, boxY).lineWidth(0.5).strokeColor('#CCCCCC').stroke();
    doc.moveTo(L, boxY + 26).lineTo(L + W, boxY + 26).lineWidth(0.5).strokeColor('#CCCCCC').stroke();
    doc.font('Helvetica').fontSize(9).fillColor('#444444')
       .text('Name:', L + 6, boxY + 8, { lineBreak: false, width: 32 });
    doc.moveTo(L + 40, boxY + 22).lineTo(L + 220, boxY + 22).lineWidth(0.5).strokeColor('#AAAAAA').stroke();
    doc.font('Helvetica').fontSize(9).fillColor('#444444')
       .text('Class / Index:', L + 228, boxY + 8, { lineBreak: false, width: 72 });
    doc.moveTo(L + 302, boxY + 22).lineTo(L + W, boxY + 22).lineWidth(0.5).strokeColor('#AAAAAA').stroke();
    doc.y = boxY + 32;

    if (exam.description) {
      doc.moveDown(0.4);
      doc.font('Helvetica-Oblique').fontSize(9).fillColor('#444444')
         .text(`Instructions: ${exam.description}`, L, doc.y, { width: W });
    }
    doc.moveDown(0.75);
    doc.moveTo(L, doc.y).lineTo(L + W, doc.y).lineWidth(0.5).strokeColor('#CCCCCC').stroke();
    doc.moveDown(0.8);

    // ─── Questions ────────────────────────────────────────────────────────────
    let currentPart = null;
    let qNum = 0;

    for (const q of qRows) {
      const part = q.part || 'Part 1';

      // Part header
      if (part !== currentPart) {
        currentPart = part;
        needPage(65);
        if (qNum > 0) doc.moveDown(0.5);
        doc.font('Helvetica-Bold').fontSize(11).fillColor(brand)
           .text(part, L, doc.y, { width: W });
        if (q.part_instruction) {
          doc.font('Helvetica-Oblique').fontSize(9).fillColor('#555555')
             .text(q.part_instruction, L + 8, doc.y, { width: W - 8 });
        }
        doc.moveDown(0.3);
        doc.moveTo(L, doc.y).lineTo(L + W, doc.y).lineWidth(0.3).strokeColor('#E2E8F0').stroke();
        doc.moveDown(0.5);
      }

      qNum++;
      needPage(80);

      // Stimulus
      if (q.stimulus && (q.stimulus.title || q.stimulus.text)) {
        if (q.stimulus.title) {
          doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#1E40AF')
             .text(q.stimulus.title, L + 8, doc.y, { width: W - 8 });
        }
        if (q.stimulus.text) {
          doc.font('Helvetica-Oblique').fontSize(8.5).fillColor('#374151')
             .text(q.stimulus.text, L + 8, doc.y, { width: W - 8 });
        }
        doc.moveDown(0.35);
      } else if (q.passage && (q.passage.title || q.passage.text)) {
        if (q.passage.title) {
          doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#374151')
             .text(q.passage.title, L + 8, doc.y, { width: W - 8 });
        }
        if (q.passage.text) {
          doc.font('Helvetica-Oblique').fontSize(8.5).fillColor('#444444')
             .text(q.passage.text, L + 8, doc.y, { width: W - 8 });
        }
        doc.moveDown(0.3);
      }

      // Question number + stem
      const stemY = doc.y;
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#111111')
         .text(`${qNum}.`, L, stemY, { width: 22, lineBreak: false });
      doc.font('Helvetica').fontSize(10).fillColor('#111111')
         .text(q.stem, L + 24, stemY, { width: W - 24 });
      doc.moveDown(0.4);

      // MCQ options
      if (q.type === 'mcq' && Array.isArray(q.options)) {
        for (const opt of q.options) {
          if (!opt.text) continue;
          needPage(22);
          const oy = doc.y;
          doc.circle(L + 32, oy + 5.5, 4).lineWidth(0.5).strokeColor('#999999').stroke();
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#666666')
             .text(opt.letter, L + 29.5, oy + 1.5, { lineBreak: false, width: 9 });
          doc.font('Helvetica').fontSize(9.5).fillColor('#222222')
             .text(opt.text, L + 45, oy, { width: W - 45 });
          doc.moveDown(0.15);
        }
      }

      // Short answer lines
      if (q.type === 'short_answer') {
        for (let i = 0; i < 4; i++) {
          needPage(24);
          const lY = doc.y + 16;
          doc.moveTo(L + 24, lY).lineTo(L + W, lY)
             .lineWidth(0.5).dash(3, { space: 4 }).strokeColor('#BBBBBB').stroke().undash();
          doc.y = lY + 6;
        }
      }

      doc.moveDown(0.8);
    }

    // ─── Page numbers ─────────────────────────────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      const fy = PAGE_H - 42;
      doc.moveTo(L, fy).lineTo(L + W, fy).lineWidth(0.3).strokeColor('#DDDDDD').stroke();
      doc.font('Helvetica').fontSize(8).fillColor('#AAAAAA')
         .text(`${exam.title}   ·   Page ${i + 1} of ${range.count}`, L, fy + 7, { width: W, align: 'center' });
    }

    doc.end();
  } catch (err) { next(err); }
});

module.exports = router;
