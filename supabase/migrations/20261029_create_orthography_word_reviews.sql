-- Automatically detected spelling mistakes, reviewed separately from sentence SRS.
-- A unique normalized word key prevents repeated cards for the same word.
CREATE TABLE IF NOT EXISTS public.orthography_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word_key TEXT NOT NULL UNIQUE,
  correct_word TEXT NOT NULL,
  wrong_example TEXT NOT NULL,
  meaning_es TEXT NOT NULL,
  context_fr TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('A1','A2','B1','B2')),
  mastery_score SMALLINT NOT NULL DEFAULT 0 CHECK (mastery_score BETWEEN 0 AND 5),
  times_practiced INTEGER NOT NULL DEFAULT 0 CHECK (times_practiced >= 0),
  misspellings_count INTEGER NOT NULL DEFAULT 1 CHECK (misspellings_count >= 1),
  state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active','dismissed')),
  next_review_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.orthography_words ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.orthography_words FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.orthography_words TO service_role;
CREATE INDEX IF NOT EXISTS orthography_words_review_idx ON public.orthography_words (state, next_review_at, mastery_score);
