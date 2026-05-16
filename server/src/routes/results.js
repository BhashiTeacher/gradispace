const router = require('express').Router();
const db     = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requirePlan } = require('../middleware/plan');

// GET /api/v1/results
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { examId, studentEmail, gradeLevel, subject, dateFrom, dateTo, page = 1, limit = 50 } = req.query;
    const conditions = ['e.teacher_id=$1', 's.submitted_at IS NOT NULL'];
    const params = [req.teacherId];
    let i = 2;
    if (examId)       { conditions.push(`s.exam_id=$${i++}`);        params.push(examId); }
    if (studentEmail) { conditions.push(`s.student_email=$${i++}`);  params.push(studentEmail.toLowerCase()); }
    if (gradeLevel)   { conditions.push(`e.grade_level=$${i++}`);    params.push(gradeLevel); }
    if (subject)      { conditions.push(`e.subject=$${i++}`);        params.push(subject); }
    if (dateFrom)     { conditions.push(`s.submitted_at>=$${i++}`);  params.push(dateFrom); }
    if (dateTo)       { conditions.push(`s.submitted_at<=$${i++}`);  params.push(dateTo); }

    const where  = 'WHERE ' + conditions.join(' AND ');
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [data, count] = await Promise.all([
      db.query(`
        SELECT s.id, e.title AS exam_title, e.subject AS exam_subject,
               s.student_name, s.student_class, s.student_email,
               s.submitted_at, s.time_taken, s.correct, s.total, s.pct, s.grade
        FROM submissions s
        JOIN exams e ON e.id=s.exam_id
        ${where}
        ORDER BY s.submitted_at DESC
        LIMIT $${i} OFFSET $${i+1}
      `, [...params, parseInt(limit), offset]),
      db.query(`SELECT COUNT(*) FROM submissions s JOIN exams e ON e.id=s.exam_id ${where}`, params),
    ]);
    const total = parseInt(count.rows[0].count);
    res.json({ results: data.rows, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { next(err); }
});

// GET /api/v1/results/stats
router.get('/stats', requireAuth, requirePlan('pro', 'school'), async (req, res, next) => {
  try {
    const { examId, groupId } = req.query;
    let examFilter = '';
    const params = [req.teacherId];
    let i = 2;
    if (examId)  { examFilter = `AND s.exam_id=$${i++}`;   params.push(examId); }
    if (groupId) { examFilter = `AND s.exam_id IN (SELECT exam_id FROM exam_group_exams WHERE group_id=$${i++})`; params.push(groupId); }

    const { rows } = await db.query(`
      SELECT
        COUNT(*)::int                                        AS submission_count,
        ROUND(AVG(pct))::int                                 AS average_pct,
        MAX(pct)::int                                        AS highest_pct,
        MIN(pct)::int                                        AS lowest_pct,
        COUNT(*) FILTER (WHERE pct BETWEEN 0  AND 20)::int  AS d0_20,
        COUNT(*) FILTER (WHERE pct BETWEEN 21 AND 40)::int  AS d21_40,
        COUNT(*) FILTER (WHERE pct BETWEEN 41 AND 60)::int  AS d41_60,
        COUNT(*) FILTER (WHERE pct BETWEEN 61 AND 80)::int  AS d61_80,
        COUNT(*) FILTER (WHERE pct BETWEEN 81 AND 100)::int AS d81_100,
        COUNT(*) FILTER (WHERE grade='Excellent')::int       AS grade_excellent,
        COUNT(*) FILTER (WHERE grade='Good')::int            AS grade_good,
        COUNT(*) FILTER (WHERE grade='Keep Practising')::int AS grade_keep,
        COUNT(*) FILTER (WHERE grade='Try Again')::int       AS grade_try
      FROM submissions s
      JOIN exams e ON e.id=s.exam_id
      WHERE e.teacher_id=$1 AND s.submitted_at IS NOT NULL ${examFilter}
    `, params);

    const r = rows[0];
    res.json({
      submissionCount: r.submission_count,
      averagePct: r.average_pct,
      highestPct: r.highest_pct,
      lowestPct:  r.lowest_pct,
      distribution: [
        { range: '0–20',   count: r.d0_20 },
        { range: '21–40',  count: r.d21_40 },
        { range: '41–60',  count: r.d41_60 },
        { range: '61–80',  count: r.d61_80 },
        { range: '81–100', count: r.d81_100 },
      ],
      gradeBreakdown: { Excellent: r.grade_excellent, Good: r.grade_good, 'Keep Practising': r.grade_keep, 'Try Again': r.grade_try },
    });
  } catch (err) { next(err); }
});

// GET /api/v1/results/student/:email
router.get('/student/:email', requireAuth, requirePlan('pro', 'school'), async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT s.id, e.title AS exam_title, e.subject, s.submitted_at, s.pct, s.grade, s.student_name, s.student_class
      FROM submissions s
      JOIN exams e ON e.id=s.exam_id
      WHERE e.teacher_id=$1 AND s.student_email=$2 AND s.submitted_at IS NOT NULL
      ORDER BY s.submitted_at
    `, [req.teacherId, req.params.email.toLowerCase()]);

    res.json({
      student: { email: req.params.email, name: rows[0]?.student_name, class: rows[0]?.student_class },
      submissions: rows,
      progressChart: rows.map(r => ({ date: r.submitted_at, pct: r.pct, examTitle: r.exam_title })),
    });
  } catch (err) { next(err); }
});

// GET /api/v1/results/:id
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT s.*, e.title AS exam_title, e.subject AS exam_subject
      FROM submissions s JOIN exams e ON e.id=s.exam_id
      WHERE s.id=$1 AND e.teacher_id=$2
    `, [req.params.id, req.teacherId]);
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    const sub = rows[0];
    const answers = sub.answers || {};
    const { rows: qRows } = await db.query(`
      SELECT q.id, q.stem, q.answer FROM exam_questions eq
      JOIN questions q ON q.id=eq.question_id WHERE eq.exam_id=$1 ORDER BY eq.order_num
    `, [sub.exam_id]);
    const detail = qRows.map(q => ({
      questionId: q.id, stem: q.stem, given: answers[q.id] ?? null,
      correct: q.answer, isCorrect: answers[q.id] === q.answer,
    }));
    res.json({ result: sub, answers: detail });
  } catch (err) { next(err); }
});

// DELETE /api/v1/results/:id
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const { rowCount } = await db.query(
      'DELETE FROM submissions s USING exams e WHERE s.id=$1 AND s.exam_id=e.id AND e.teacher_id=$2',
      [req.params.id, req.teacherId]
    );
    if (!rowCount) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
