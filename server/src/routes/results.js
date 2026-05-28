const router  = require('express').Router();
const db      = require('../db');
const ExcelJS = require('exceljs');
const { requireAuth } = require('../middleware/auth');
const { requirePlan } = require('../middleware/plan');

// GET /api/v1/results
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { examId, studentEmail, gradeLevel, subject, dateFrom, dateTo, needsReview, page = 1, limit = 50 } = req.query;
    const conditions = ['e.teacher_id=$1', 's.submitted_at IS NOT NULL'];
    const params = [req.teacherId];
    let i = 2;
    if (examId)       { conditions.push(`s.exam_id=$${i++}`);        params.push(examId); }
    if (studentEmail) { conditions.push(`s.student_email=$${i++}`);  params.push(studentEmail.toLowerCase()); }
    if (gradeLevel)   { conditions.push(`e.grade_level=$${i++}`);    params.push(gradeLevel); }
    if (subject)      { conditions.push(`e.subject=$${i++}`);        params.push(subject); }
    if (dateFrom)     { conditions.push(`s.submitted_at>=$${i++}`);  params.push(dateFrom); }
    if (dateTo)       { conditions.push(`s.submitted_at<=$${i++}`);  params.push(dateTo); }
    if (needsReview === 'true') { conditions.push(`s.requires_review=true AND s.review_completed=false`); }

    const where  = 'WHERE ' + conditions.join(' AND ');
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [data, count] = await Promise.all([
      db.query(`
        SELECT s.id, e.title AS exam_title, e.subject AS exam_subject,
               s.student_name, s.student_class, s.student_email,
               s.submitted_at, s.time_taken, s.correct, s.total, s.pct, s.grade,
               s.requires_review, s.review_completed
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

// GET /api/v1/results/export  — download XLSX or CSV (Pro)
router.get('/export', requireAuth, requirePlan('pro', 'school'), async (req, res, next) => {
  try {
    const { examId, studentEmail, gradeLevel, subject, dateFrom, dateTo, format = 'xlsx' } = req.query;
    const conditions = ['e.teacher_id=$1', 's.submitted_at IS NOT NULL'];
    const params = [req.teacherId];
    let i = 2;
    if (examId)       { conditions.push(`s.exam_id=$${i++}`);        params.push(examId); }
    if (studentEmail) { conditions.push(`s.student_email=$${i++}`);  params.push(studentEmail.toLowerCase()); }
    if (gradeLevel)   { conditions.push(`e.grade_level=$${i++}`);    params.push(gradeLevel); }
    if (subject)      { conditions.push(`e.subject=$${i++}`);        params.push(subject); }
    if (dateFrom)     { conditions.push(`s.submitted_at>=$${i++}`);  params.push(dateFrom); }
    if (dateTo)       { conditions.push(`s.submitted_at<=$${i++}`);  params.push(dateTo); }

    const { rows } = await db.query(`
      SELECT s.id, e.title AS exam_title, e.subject AS exam_subject,
             s.student_name, s.student_class, s.student_email,
             s.submitted_at, s.time_taken, s.correct, s.total, s.pct, s.grade,
             s.requires_review, s.review_completed
      FROM submissions s
      JOIN exams e ON e.id=s.exam_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY s.submitted_at DESC
      LIMIT 5000
    `, params);

    const columns = [
      { key: 'exam_title',      header: 'Exam' },
      { key: 'exam_subject',    header: 'Subject' },
      { key: 'student_name',    header: 'Student Name' },
      { key: 'student_class',   header: 'Class' },
      { key: 'student_email',   header: 'Email' },
      { key: 'submitted_at',    header: 'Submitted At' },
      { key: 'time_taken',      header: 'Time Taken (s)' },
      { key: 'correct',         header: 'Correct' },
      { key: 'total',           header: 'Total' },
      { key: 'pct',             header: 'Score (%)' },
      { key: 'grade',           header: 'Grade' },
      { key: 'review_status',   header: 'Review Status' },
    ];

    const dataRows = rows.map(r => ({
      ...r,
      submitted_at: r.submitted_at ? new Date(r.submitted_at).toISOString().replace('T', ' ').slice(0, 19) : '',
      review_status: r.requires_review
        ? (r.review_completed ? 'Reviewed' : 'Needs Review')
        : 'N/A',
    }));

    if (format === 'csv') {
      const escape = v => {
        if (v === null || v === undefined) return '';
        const s = String(v);
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const header = columns.map(c => c.header).join(',');
      const body   = dataRows.map(r => columns.map(c => escape(r[c.key])).join(',')).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="results.csv"');
      return res.end(`${header}\n${body}`);
    }

    // XLSX
    const wb = new ExcelJS.Workbook();
    wb.creator = 'GradiSpace';
    const ws = wb.addWorksheet('Results');
    ws.columns = columns.map(c => ({ header: c.header, key: c.key, width: 20 }));
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003865' } };
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    dataRows.forEach(r => ws.addRow(columns.map(c => r[c.key] ?? '')));

    const buffer = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="results.xlsx"');
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
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

// GET /api/v1/results/:id/for-review  — full detail with short-answer review data (Pro)
router.get('/:id/for-review', requireAuth, requirePlan('pro', 'school'), async (req, res, next) => {
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
      SELECT q.id, COALESCE(eq.stem, q.stem) AS stem,
             COALESCE(eq.answer, q.answer) AS answer,
             COALESCE(eq.type, q.type) AS type,
             eq.order_num, eq.part
      FROM exam_questions eq
      JOIN questions q ON q.id=eq.question_id
      WHERE eq.exam_id=$1 ORDER BY eq.order_num
    `, [sub.exam_id]);

    const { rows: overrideRows } = await db.query(
      'SELECT * FROM submission_answer_overrides WHERE submission_id=$1',
      [sub.id]
    );
    const overrideMap = {};
    overrideRows.forEach(o => { overrideMap[o.question_id] = o; });

    const detail = qRows.map(q => ({
      questionId: q.id,
      stem: q.stem,
      type: q.type,
      part: q.part,
      given: answers[q.id] ?? null,
      correct: q.answer,
      isCorrect: q.type === 'short_answer' ? null : answers[q.id] === q.answer,
      override: overrideMap[q.id] || null,
    }));

    res.json({ result: sub, answers: detail });
  } catch (err) { next(err); }
});

// POST /api/v1/results/:id/review  — save overrides and finalise (Pro)
router.post('/:id/review', requireAuth, requirePlan('pro', 'school'), async (req, res, next) => {
  try {
    const { overrides = [] } = req.body;

    const { rows } = await db.query(`
      SELECT s.*, e.id AS exam_id FROM submissions s
      JOIN exams e ON e.id=s.exam_id
      WHERE s.id=$1 AND e.teacher_id=$2
    `, [req.params.id, req.teacherId]);
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    const sub = rows[0];

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Upsert overrides (delete + insert per question)
      for (const o of overrides) {
        await client.query(
          'DELETE FROM submission_answer_overrides WHERE submission_id=$1 AND question_id=$2',
          [sub.id, o.questionId]
        );
        await client.query(
          'INSERT INTO submission_answer_overrides(submission_id, question_id, override_marks, teacher_note) VALUES($1,$2,$3,$4)',
          [sub.id, o.questionId, o.overrideMarks, o.teacherNote || null]
        );
      }

      // Recalculate score using all overrides
      const { rows: qRows } = await client.query(`
        SELECT q.id, COALESCE(eq.answer, q.answer) AS answer,
               COALESCE(eq.type, q.type) AS type, eq.part
        FROM exam_questions eq JOIN questions q ON q.id=eq.question_id
        WHERE eq.exam_id=$1 ORDER BY eq.order_num
      `, [sub.exam_id]);

      const { rows: allOverrides } = await client.query(
        'SELECT * FROM submission_answer_overrides WHERE submission_id=$1', [sub.id]
      );
      const overrideMap = {};
      allOverrides.forEach(o => { overrideMap[o.question_id] = o; });

      const answers = sub.answers || {};
      let correct = 0;
      const breakdown = {};
      const norm = s => (s || '').toString().trim().toLowerCase();

      qRows.forEach(q => {
        const part = q.part || 'Part 1';
        if (!breakdown[part]) breakdown[part] = { correct: 0, total: 0 };
        breakdown[part].total++;
        const given = answers[q.id] ?? null;
        const override = overrideMap[q.id];
        let isCorrect;
        if (override) {
          isCorrect = parseFloat(override.override_marks) > 0;
        } else if (q.type === 'short_answer') {
          isCorrect = q.answer && norm(given) === norm(q.answer);
        } else {
          isCorrect = given === q.answer;
        }
        if (isCorrect) { correct++; breakdown[part].correct++; }
      });

      const total = qRows.length;
      const pct   = total ? Math.round((correct / total) * 100) : 0;
      const grade = pct >= 80 ? 'Excellent' : pct >= 60 ? 'Good' : pct >= 40 ? 'Keep Practising' : 'Try Again';

      await client.query(`
        UPDATE submissions SET
          correct=$1, total=$2, pct=$3, grade=$4, breakdown=$5,
          review_completed=true, reviewed_at=NOW(), reviewed_by=$6
        WHERE id=$7
      `, [correct, total, pct, grade, JSON.stringify(breakdown), req.teacherId, sub.id]);

      await client.query('COMMIT');
      res.json({ ok: true, correct, total, pct, grade });
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  } catch (err) { next(err); }
});

// GET /api/v1/results/:id/detail  — full question-by-question breakdown for teacher (Pro)
router.get('/:id/detail', requireAuth, requirePlan('pro', 'school'), async (req, res, next) => {
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
      SELECT q.id,
             COALESCE(eq.stem, q.stem)     AS stem,
             COALESCE(eq.answer, q.answer) AS answer,
             COALESCE(eq.type, q.type)     AS type,
             COALESCE(eq.options, q.options) AS options,
             eq.order_num, eq.part
      FROM exam_questions eq
      JOIN questions q ON q.id=eq.question_id
      WHERE eq.exam_id=$1 ORDER BY eq.order_num
    `, [sub.exam_id]);

    const { rows: overrideRows } = await db.query(
      'SELECT * FROM submission_answer_overrides WHERE submission_id=$1',
      [sub.id]
    );
    const overrideMap = {};
    overrideRows.forEach(o => { overrideMap[o.question_id] = o; });

    const norm = s => (s || '').toString().trim().toLowerCase();
    const detail = qRows.map(q => {
      const given    = answers[q.id] ?? null;
      const override = overrideMap[q.id] || null;
      let isCorrect;
      if (override) {
        isCorrect = parseFloat(override.override_marks) > 0;
      } else if (q.type === 'short_answer') {
        isCorrect = q.answer ? norm(given) === norm(q.answer) : null;
      } else {
        isCorrect = given !== null ? given === q.answer : false;
      }
      return {
        questionId: q.id,
        stem:       q.stem,
        type:       q.type,
        part:       q.part,
        options:    q.options || [],
        given,
        correct:    q.answer,
        isCorrect,
        override:   override ? { override_marks: override.override_marks, teacher_note: override.teacher_note } : null,
      };
    });

    res.json({ result: sub, answers: detail });
  } catch (err) { next(err); }
});

module.exports = router;
