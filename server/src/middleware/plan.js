const db = require('../db');

const LIMITS = {
  free:   { exams: 3,   bankSize: 50,  aiPerMonth: 10,  uploads: false, analytics: false, closedExams: false, groups: false },
  pro:    { exams: null, bankSize: null, aiPerMonth: null, uploads: true, analytics: true, closedExams: true, groups: true },
  school: { exams: null, bankSize: null, aiPerMonth: null, uploads: true, analytics: true, closedExams: true, groups: true },
};

function requirePlan(...allowedPlans) {
  return (req, res, next) => {
    if (!allowedPlans.includes(req.teacherPlan)) {
      return res.status(403).json({
        error: 'plan_limit',
        message: `This feature requires a ${allowedPlans.join(' or ')} plan.`,
        upgradeUrl: '/billing'
      });
    }
    next();
  };
}

async function checkExamLimit(req, res, next) {
  const limits = LIMITS[req.teacherPlan];
  if (limits.exams === null) return next();
  const { rows } = await db.query('SELECT COUNT(*) FROM exams WHERE teacher_id=$1', [req.teacherId]);
  if (parseInt(rows[0].count) >= limits.exams) {
    return res.status(403).json({
      error: 'plan_limit',
      message: `Free plan is limited to ${limits.exams} exams. Upgrade to Pro for unlimited exams.`,
      upgradeUrl: '/billing'
    });
  }
  next();
}

async function checkBankLimit(req, res, next) {
  const limits = LIMITS[req.teacherPlan];
  if (limits.bankSize === null) return next();
  const count = req.body.questions?.length || 1;
  const { rows } = await db.query(
    'SELECT COUNT(*) FROM questions WHERE teacher_id=$1 AND in_bank=true', [req.teacherId]
  );
  if (parseInt(rows[0].count) + count > limits.bankSize) {
    return res.status(403).json({
      error: 'plan_limit',
      message: `Free plan is limited to ${limits.bankSize} question bank entries.`,
      upgradeUrl: '/billing'
    });
  }
  next();
}

async function checkAiLimit(req, res, next) {
  const { rows } = await db.query('SELECT ai_usage_month, ai_usage_reset_at, plan FROM teachers WHERE id=$1', [req.teacherId]);
  const teacher = rows[0];
  if (!teacher) return res.status(401).json({ error: 'unauthorized' });

  const limits = LIMITS[teacher.plan];
  if (limits.aiPerMonth === null) return next();

  // Reset counter if new calendar month
  const resetAt = new Date(teacher.ai_usage_reset_at);
  const now     = new Date();
  if (now.getFullYear() !== resetAt.getFullYear() || now.getMonth() !== resetAt.getMonth()) {
    await db.query(
      'UPDATE teachers SET ai_usage_month=0, ai_usage_reset_at=date_trunc(\'month\',NOW()) WHERE id=$1',
      [req.teacherId]
    );
    teacher.ai_usage_month = 0;
  }

  if (teacher.ai_usage_month >= limits.aiPerMonth) {
    return res.status(403).json({
      error: 'plan_limit',
      message: `Free plan allows ${limits.aiPerMonth} AI generations per month.`,
      upgradeUrl: '/billing'
    });
  }

  req.aiRemaining = limits.aiPerMonth - teacher.ai_usage_month;
  next();
}

module.exports = { requirePlan, checkExamLimit, checkBankLimit, checkAiLimit, LIMITS };
