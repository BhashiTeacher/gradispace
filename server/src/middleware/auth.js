const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'unauthorized', message: 'Missing token.' });
  }
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    req.teacherId = payload.sub;
    req.teacherPlan = payload.plan || 'free';
    next();
  } catch {
    return res.status(401).json({ error: 'unauthorized', message: 'Invalid or expired token.' });
  }
}

module.exports = { requireAuth };
