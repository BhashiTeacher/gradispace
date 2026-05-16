const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const db     = require('../db');

// GET /api/v1/student/exam/:token
router.get('/exam/:token', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT e.*, t.name AS teacher_name FROM exams e JOIN teachers t ON t.id=e.teacher_id WHERE e.access_token=$1 AND e.published=true',
      [req.params.token]
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found', message: 'Exam not found or not published.' });
    const exam = rows[0];

    const { rows: qRows } = await db.query(`
      SELECT q.id, eq.order_num, eq.part AS part, eq.part_instruction,
             q.type, q.stem, q.options, q.image_url, q.audio_url, q.video_url,
             q.passage, q.stimulus, q.part_instruction AS q_part_instruction
      FROM exam_questions eq
      JOIN questions q ON q.id=eq.question_id
      WHERE eq.exam_id=$1
      ORDER BY eq.order_num
    `, [exam.id]);

    // Strip correct answers
    const questions = qRows.map(q => {
      const { answer: _a, stem_hash: _h, ...safe } = q;
      return safe;
    });

    res.json({
      exam: {
        id: exam.id, title: exam.title, subject: exam.subject,
        gradeLevel: exam.grade_level, duration: exam.duration,
        examType: exam.exam_type, description: exam.description,
      },
      questions,
      teacher: { name: exam.teacher_name },
    });
  } catch (err) { next(err); }
});

// POST /api/v1/student/exam/:token/start
router.post('/exam/:token/start', async (req, res, next) => {
  try {
    const { studentName, studentClass, email, phone } = req.body;
    if (!studentName) return res.status(400).json({ error: 'validation_error', message: 'studentName is required.' });

    const { rows } = await db.query(
      'SELECT * FROM exams WHERE access_token=$1 AND published=true', [req.params.token]
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    const exam = rows[0];

    // Closed exam: block duplicate email
    if (exam.exam_type === 'closed') {
      if (!email) return res.status(400).json({ error: 'validation_error', message: 'Email is required for this exam.' });
      const dupe = await db.query(
        'SELECT id FROM submissions WHERE exam_id=$1 AND student_email=$2 AND submitted_at IS NOT NULL',
        [exam.id, email.toLowerCase()]
      );
      if (dupe.rows.length) {
        return res.status(409).json({ error: 'already_submitted', message: 'This email has already completed this exam.' });
      }
    }

    const sessionToken = uuidv4();
    await db.query(
      'INSERT INTO submissions(exam_id,session_token,student_name,student_class,student_email,student_phone) VALUES($1,$2,$3,$4,$5,$6)',
      [exam.id, sessionToken, studentName, studentClass||null, email ? email.toLowerCase() : null, phone||null]
    );
    res.json({ sessionToken, startedAt: new Date().toISOString() });
  } catch (err) { next(err); }
});

// POST /api/v1/student/exam/:token/submit
router.post('/exam/:token/submit', async (req, res, next) => {
  try {
    const { sessionToken, answers = {} } = req.body;
    if (!sessionToken) return res.status(400).json({ error: 'validation_error', message: 'sessionToken is required.' });

    const { rows: sRows } = await db.query(
      'SELECT s.*, e.id AS eid FROM submissions s JOIN exams e ON e.id=s.exam_id WHERE s.session_token=$1 AND e.access_token=$2',
      [sessionToken, req.params.token]
    );
    if (!sRows[0]) return res.status(404).json({ error: 'not_found', message: 'Session not found.' });
    const sub = sRows[0];
    if (sub.submitted_at) return res.status(409).json({ error: 'already_submitted' });

    // Grade
    const { rows: qRows } = await db.query(`
      SELECT q.id, q.type, q.answer, eq.part
      FROM exam_questions eq JOIN questions q ON q.id=eq.question_id
      WHERE eq.exam_id=$1 ORDER BY eq.order_num
    `, [sub.exam_id]);

    let correct = 0;
    const breakdown = {};
    const answerDetail = {};

    qRows.forEach(q => {
      const part = q.part || 'Part 1';
      if (!breakdown[part]) breakdown[part] = { correct: 0, total: 0 };
      breakdown[part].total++;
      const given = answers[q.id] ?? null;
      const isShort = q.type === 'short_answer';
      const isCorrect = !isShort && given === q.answer;
      if (isCorrect) { correct++; breakdown[part].correct++; }
      answerDetail[q.id] = { given, correct: q.answer, isCorrect: isShort ? null : isCorrect };
    });

    const total = qRows.length;
    const pct   = total ? Math.round((correct / total) * 100) : 0;
    const grade = pct >= 80 ? 'Excellent' : pct >= 60 ? 'Good' : pct >= 40 ? 'Keep Practising' : 'Try Again';
    const now   = new Date();
    const started = new Date(sub.started_at);
    const elapsed  = Math.floor((now - started) / 1000);
    const timeTaken = `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;

    await db.query(`
      UPDATE submissions SET
        submitted_at=NOW(), answers=$1, correct=$2, total=$3, pct=$4, grade=$5, time_taken=$6, breakdown=$7
      WHERE session_token=$8
    `, [JSON.stringify(answers), correct, total, pct, grade, timeTaken, JSON.stringify(breakdown), sessionToken]);

    res.json({ result: { correct, total, pct, grade, timeTaken, breakdown, answers: answerDetail } });
  } catch (err) { next(err); }
});

// GET /api/v1/student/group/:token
router.get('/group/:token', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT g.*, t.name AS teacher_name FROM exam_groups g JOIN teachers t ON t.id=g.teacher_id WHERE g.access_token=$1',
      [req.params.token]
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    const group = rows[0];
    const { rows: exams } = await db.query(`
      SELECT e.id, e.title, e.subject, e.duration, e.description, e.access_token,
             (SELECT COUNT(*) FROM exam_questions WHERE exam_id=e.id) AS question_count
      FROM exam_group_exams ege
      JOIN exams e ON e.id=ege.exam_id
      WHERE ege.group_id=$1 AND e.published=true
      ORDER BY e.created_at
    `, [group.id]);
    res.json({
      group: { id: group.id, name: group.name, gradeLevel: group.grade_level, subject: group.subject },
      exams,
      teacher: { name: group.teacher_name },
    });
  } catch (err) { next(err); }
});

module.exports = router;
