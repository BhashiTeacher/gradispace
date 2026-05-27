const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const db     = require('../db');

// GET /api/v1/student/exam/:token
router.get('/exam/:token', async (req, res, next) => {
  try {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(req.params.token)) {
      return res.status(404).json({ error: 'not_found', message: 'Exam not found or not published.' });
    }
    const { rows } = await db.query(
      'SELECT e.*, t.name AS teacher_name FROM exams e JOIN teachers t ON t.id=e.teacher_id WHERE e.access_token=$1 AND e.published=true',
      [req.params.token]
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found', message: 'Exam not found or not published.' });
    const exam = rows[0];

    const { rows: qRows } = await db.query(`
      SELECT q.id, eq.order_num, eq.part AS part, eq.part_instruction,
             COALESCE(eq.type, q.type) AS type,
             COALESCE(eq.stem, q.stem) AS stem,
             COALESCE(eq.options, q.options) AS options,
             COALESCE(eq.image_url, q.image_url) AS image_url,
             COALESCE(eq.audio_url, q.audio_url) AS audio_url,
             eq.audio_play_limit,
             COALESCE(eq.video_url, q.video_url) AS video_url,
             COALESCE(eq.passage, q.passage) AS passage,
             COALESCE(eq.stimulus, q.stimulus) AS stimulus
      FROM exam_questions eq
      JOIN questions q ON q.id=eq.question_id
      WHERE eq.exam_id=$1
      ORDER BY eq.order_num
    `, [exam.id]);

    // Strip correct answers and audio URLs (URL served via play endpoint for limit tracking)
    const questions = qRows.map(q => {
      const { answer: _a, stem_hash: _h, audio_url, ...safe } = q;
      return { ...safe, has_audio: !!audio_url };
    });

    res.json({
      exam: {
        id: exam.id, title: exam.title, subject: exam.subject,
        gradeLevel: exam.grade_level, duration: exam.duration,
        examType: exam.exam_type, description: exam.description,
        resultView: exam.result_view || 'summary',
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

// POST /api/v1/student/exam/:token/audio-play
router.post('/exam/:token/audio-play', async (req, res, next) => {
  try {
    const { sessionToken, questionId } = req.body;
    if (!sessionToken || !questionId)
      return res.status(400).json({ error: 'validation_error', message: 'sessionToken and questionId are required.' });

    const { rows: sRows } = await db.query(
      'SELECT s.*, e.id AS eid FROM submissions s JOIN exams e ON e.id=s.exam_id WHERE s.session_token=$1 AND e.access_token=$2',
      [sessionToken, req.params.token]
    );
    if (!sRows[0]) return res.status(404).json({ error: 'not_found' });
    const sub = sRows[0];
    if (sub.submitted_at) return res.status(409).json({ error: 'already_submitted' });

    const { rows: eqRows } = await db.query(
      `SELECT COALESCE(eq.audio_url, q.audio_url) AS audio_url, eq.audio_play_limit
       FROM exam_questions eq JOIN questions q ON q.id=eq.question_id
       WHERE eq.exam_id=$1 AND q.id=$2`,
      [sub.eid, questionId]
    );
    if (!eqRows[0] || !eqRows[0].audio_url)
      return res.status(404).json({ error: 'not_found', message: 'No audio for this question.' });

    const { audio_url, audio_play_limit } = eqRows[0];
    const audioPlays = sub.audio_plays || {};
    const currentPlays = audioPlays[questionId] || 0;

    if (audio_play_limit !== null && currentPlays >= audio_play_limit) {
      return res.status(403).json({
        error: 'play_limit_reached',
        message: 'Maximum plays reached.',
        playsUsed: currentPlays,
        playsLimit: audio_play_limit,
      });
    }

    const newPlays = currentPlays + 1;
    await db.query(
      'UPDATE submissions SET audio_plays=$1 WHERE session_token=$2',
      [JSON.stringify({ ...audioPlays, [questionId]: newPlays }), sessionToken]
    );

    res.json({ audioUrl: audio_url, playsUsed: newPlays, playsLimit: audio_play_limit });
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
