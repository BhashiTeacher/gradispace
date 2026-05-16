-- Gradispace PostgreSQL schema
-- Run via: psql $DATABASE_URL -f schema.sql

-- ── Extensions ──────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- for full-text search on questions

-- ── Teachers ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teachers (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              TEXT NOT NULL,
  email             TEXT UNIQUE NOT NULL,
  password_hash     TEXT NOT NULL,
  plan              TEXT NOT NULL DEFAULT 'free',   -- free | pro | school
  plan_status       TEXT NOT NULL DEFAULT 'active', -- active | trialing | past_due | canceled
  stripe_customer_id TEXT,
  stripe_sub_id     TEXT,
  plan_expires_at   TIMESTAMPTZ,
  ai_usage_month    INTEGER NOT NULL DEFAULT 0,     -- resets each calendar month
  ai_usage_reset_at TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', NOW()),
  reset_token       TEXT,
  reset_token_exp   TIMESTAMPTZ,
  portal_title      TEXT,
  brand_colour      TEXT DEFAULT '#003865',
  sheets_url        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Questions ───────────────────────────────────────────────────
-- Each row is a question owned by one teacher.
-- Adding it to question bank = in_bank = true.
CREATE TABLE IF NOT EXISTS questions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id       UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  in_bank          BOOLEAN NOT NULL DEFAULT false,
  type             TEXT NOT NULL DEFAULT 'mcq',     -- mcq | short_answer
  stem             TEXT NOT NULL,
  stem_hash        TEXT,                            -- SHA256 of stem for dedup
  options          JSONB,                           -- [{letter, text}, ...]
  answer           TEXT,                            -- mcq correct letter
  part             TEXT DEFAULT 'Part 1',
  part_instruction TEXT,
  passage          JSONB,                           -- {title, text} or {people:[{name,text}]}
  stimulus         JSONB,                           -- {type, body, title, ...}
  image_url        TEXT,
  audio_url        TEXT,
  video_url        TEXT,                            -- YouTube URL
  subject          TEXT,
  grade_level      TEXT,
  topic            TEXT,
  tags             TEXT[],
  difficulty       TEXT DEFAULT 'medium',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS questions_teacher_idx ON questions(teacher_id);
CREATE INDEX IF NOT EXISTS questions_bank_idx    ON questions(teacher_id, in_bank);
CREATE INDEX IF NOT EXISTS questions_subject_idx ON questions(teacher_id, subject, grade_level, topic);
CREATE INDEX IF NOT EXISTS questions_stem_gin    ON questions USING gin(stem gin_trgm_ops);

-- ── Exams ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exams (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id       UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  subject          TEXT,
  topic            TEXT,
  grade_level      TEXT,
  duration         INTEGER NOT NULL DEFAULT 45,     -- minutes
  description      TEXT,
  exam_type        TEXT NOT NULL DEFAULT 'open',    -- open | closed
  published        BOOLEAN NOT NULL DEFAULT false,
  access_token     UUID UNIQUE DEFAULT uuid_generate_v4(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS exams_teacher_idx       ON exams(teacher_id);
CREATE INDEX IF NOT EXISTS exams_access_token_idx  ON exams(access_token);

-- ── Exam ↔ Questions (ordered) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS exam_questions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id          UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question_id      UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  order_num        INTEGER NOT NULL DEFAULT 0,
  part             TEXT,
  part_instruction TEXT,
  UNIQUE(exam_id, question_id)
);
CREATE INDEX IF NOT EXISTS eq_exam_idx ON exam_questions(exam_id, order_num);

-- ── Exam Groups ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exam_groups (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id       UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  description      TEXT,
  grade_level      TEXT,
  subject          TEXT,
  access_token     UUID UNIQUE DEFAULT uuid_generate_v4(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS groups_teacher_idx       ON exam_groups(teacher_id);
CREATE INDEX IF NOT EXISTS groups_access_token_idx  ON exam_groups(access_token);

-- ── Exam Group ↔ Exams ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exam_group_exams (
  group_id         UUID NOT NULL REFERENCES exam_groups(id) ON DELETE CASCADE,
  exam_id          UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  PRIMARY KEY(group_id, exam_id)
);

-- ── Exam Sessions (student submissions) ─────────────────────────
CREATE TABLE IF NOT EXISTS submissions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id          UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  session_token    UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
  student_name     TEXT NOT NULL,
  student_class    TEXT,
  student_email    TEXT,
  student_phone    TEXT,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at     TIMESTAMPTZ,
  answers          JSONB,   -- { questionId: "A" | "free text" }
  correct          INTEGER,
  total            INTEGER,
  pct              INTEGER,
  grade            TEXT,
  time_taken       TEXT,
  breakdown        JSONB    -- { "Part 1": { correct, total } }
);
CREATE INDEX IF NOT EXISTS sub_exam_idx   ON submissions(exam_id);
CREATE INDEX IF NOT EXISTS sub_email_idx  ON submissions(exam_id, student_email);
CREATE INDEX IF NOT EXISTS sub_session_idx ON submissions(session_token);

-- ── Password reset tokens (separate index for quick lookups) ────
CREATE INDEX IF NOT EXISTS teacher_reset_token_idx ON teachers(reset_token);
