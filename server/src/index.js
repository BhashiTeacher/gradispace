require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const rateLimit   = require('express-rate-limit');
const path        = require('path');

const app = express();

// ── Security ────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true,
}));

// ── Stripe webhook needs raw body — mount BEFORE json() ─────────
const billingRoutes = require('./routes/billing');
app.use('/api/v1/billing/webhook', express.raw({ type: 'application/json' }), billingRoutes.webhook);

// ── Body parsing ────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));

// ── Rate limiting ───────────────────────────────────────────────
const makeLimit = (max) => rateLimit({ windowMs: 60_000, max, standardHeaders: true, legacyHeaders: false });
app.use('/api/v1/student', makeLimit(60));
app.use('/api/v1/auth',    makeLimit(20));
app.use('/api/v1',         makeLimit(120));

// ── API routes ──────────────────────────────────────────────────
app.use('/api/v1/auth',      require('./routes/auth'));
app.use('/api/v1/exams',     require('./routes/exams'));
app.use('/api/v1/questions', require('./routes/questions'));
app.use('/api/v1/groups',    require('./routes/groups'));
app.use('/api/v1/upload',    require('./routes/upload'));
app.use('/api/v1/ai',        require('./routes/ai'));
app.use('/api/v1/student',   require('./routes/student'));
app.use('/api/v1/results',   require('./routes/results'));
app.use('/api/v1/billing',   billingRoutes.router);
app.use('/api/v1/settings',  require('./routes/settings'));

// ── Health check ────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// ── Serve frontend in production ─────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../client')));
  app.get('*', (_req, res) => res.sendFile(path.join(__dirname, '../../client/index.html')));
}

// ── Global error handler ─────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.code || 'server_error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong.' : err.message,
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Gradispace API running on port ${PORT}`));
