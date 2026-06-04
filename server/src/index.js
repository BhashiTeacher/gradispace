require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const rateLimit   = require('express-rate-limit');

const app = express();

// ── CORS ─────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = new Set([
  'https://gradispace.com',
  'https://www.gradispace.com',
  'https://gradispace.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
]);
// Also accept whatever CLIENT_URL is set to in the environment
if (process.env.CLIENT_URL) ALLOWED_ORIGINS.add(process.env.CLIENT_URL);

app.use(cors({
  origin(origin, cb) {
    // Allow non-browser clients (curl, mobile, same-origin) that send no Origin header
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.has(origin)) return cb(null, true);
    cb(Object.assign(new Error(`CORS: origin not allowed — ${origin}`), { status: 403 }));
  },
  credentials: true,
  exposedHeaders: ['Content-Disposition'],
}));

// ── Security headers ─────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));

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

// ── 404 for unmatched API routes ─────────────────────────────────
// Must be before the error handler so stray /api/* paths return JSON,
// not an HTML page (frontend is on Vercel — no static files here).
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'not_found', message: 'API endpoint not found.' });
});

// ── Global error handler ─────────────────────────────────────────
app.use((err, _req, res, _next) => {
  // Multer file-size rejection
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'file_too_large',
      message: 'PDF must be under 20MB. For large documents, upload specific pages or chapters only.',
    });
  }
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    error:   err.code    || 'server_error',
    message: status < 500 ? err.message : (process.env.NODE_ENV === 'production' ? 'Something went wrong.' : err.message),
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Gradispace API running on port ${PORT}`));
