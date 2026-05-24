const router  = require('express').Router();
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db      = require('../db');
const { requireAuth } = require('../middleware/auth');
const { LIMITS }      = require('../middleware/plan');
const { sendPasswordReset, sendWelcome } = require('../lib/email');

function signToken(teacher) {
  return jwt.sign(
    { sub: teacher.id, plan: teacher.plan },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
  );
}

// POST /api/v1/auth/signup
router.post('/signup', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'validation_error', message: 'name, email and password are required.' });
    if (password.length < 8) return res.status(400).json({ error: 'validation_error', message: 'Password must be at least 8 characters.' });

    const existing = await db.query('SELECT id FROM teachers WHERE email=$1', [email.toLowerCase()]);
    if (existing.rows.length) return res.status(409).json({ error: 'duplicate', message: 'An account with this email already exists.' });

    const hash = await bcrypt.hash(password, 12);
    const { rows } = await db.query(
      'INSERT INTO teachers(name,email,password_hash) VALUES($1,$2,$3) RETURNING id,name,email,plan,created_at',
      [name.trim(), email.toLowerCase(), hash]
    );
    const teacher = rows[0];

    // Fire-and-forget — never block signup if email fails
    sendWelcome(teacher.name, teacher.email).catch(err =>
      console.error('[email] welcome failed:', err.message)
    );

    res.status(201).json({ token: signToken(teacher), teacher });
  } catch (err) { next(err); }
});

// POST /api/v1/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'validation_error', message: 'email and password are required.' });

    const { rows } = await db.query('SELECT * FROM teachers WHERE email=$1', [email.toLowerCase()]);
    const teacher = rows[0];
    if (!teacher || !(await bcrypt.compare(password, teacher.password_hash))) {
      return res.status(401).json({ error: 'unauthorized', message: 'Invalid email or password.' });
    }
    res.json({ token: signToken(teacher), teacher: { id: teacher.id, name: teacher.name, email: teacher.email, plan: teacher.plan } });
  } catch (err) { next(err); }
});

// GET /api/v1/auth/me
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const [teacherRes, examRes, bankRes, subRes] = await Promise.all([
      db.query(
        'SELECT id,name,email,plan,plan_status,ai_usage_month,created_at FROM teachers WHERE id=$1',
        [req.teacherId]
      ),
      db.query('SELECT COUNT(*) FROM exams WHERE teacher_id=$1', [req.teacherId]),
      db.query('SELECT COUNT(*) FROM questions WHERE teacher_id=$1 AND in_bank=true', [req.teacherId]),
      db.query(
        'SELECT COUNT(*) FROM submissions s JOIN exams e ON s.exam_id=e.id WHERE e.teacher_id=$1 AND s.submitted_at IS NOT NULL',
        [req.teacherId]
      ),
    ]);

    const t = teacherRes.rows[0];
    if (!t) return res.status(404).json({ error: 'not_found' });

    const limits = LIMITS[t.plan] || LIMITS.free;

    res.json({
      id:                t.id,
      name:              t.name,
      email:             t.email,
      plan:              t.plan,
      plan_status:       t.plan_status,
      created_at:        t.created_at,
      examCount:         parseInt(examRes.rows[0].count),
      questionBankCount: parseInt(bankRes.rows[0].count),
      submissionCount:   parseInt(subRes.rows[0].count),
      aiUsage: {
        used:  t.ai_usage_month,
        limit: limits.aiPerMonth,
      },
    });
  } catch (err) { next(err); }
});

// POST /api/v1/auth/forgot-password
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'validation_error', message: 'email is required.' });
    const token = uuidv4();
    const exp   = new Date(Date.now() + 3600_000); // 1 hour
    // Only send if the account exists — but always return OK (no enumeration)
    const { rows } = await db.query(
      'UPDATE teachers SET reset_token=$1, reset_token_exp=$2 WHERE email=$3 RETURNING name',
      [token, exp, email.toLowerCase()]
    );
    if (rows[0]) {
      const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
      sendPasswordReset(email.toLowerCase(), resetUrl).catch(err =>
        console.error('[email] password reset failed:', err.message)
      );
    }
    res.json({ ok: true }); // always ok — no enumeration
  } catch (err) { next(err); }
});

// POST /api/v1/auth/reset-password
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'validation_error', message: 'Valid token and newPassword (min 8 chars) required.' });
    }
    const { rows } = await db.query('SELECT id FROM teachers WHERE reset_token=$1 AND reset_token_exp > NOW()', [token]);
    if (!rows[0]) return res.status(400).json({ error: 'validation_error', message: 'Invalid or expired reset link.' });
    const hash = await bcrypt.hash(newPassword, 12);
    await db.query('UPDATE teachers SET password_hash=$1, reset_token=NULL, reset_token_exp=NULL WHERE id=$2', [hash, rows[0].id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
