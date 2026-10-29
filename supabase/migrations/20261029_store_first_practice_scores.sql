-- Save the AI score (0–100) for the FIRST correction of each practice encounter.
-- Repeated corrections keep the same practice_id and do not distort progress.
-- Scores recorded before this migration cannot be reconstructed.
CREATE TABLE IF NOT EXISTS public.practice_scores (
  practice_id UUID PRIMARY KEY,
  sentence_id UUID NOT NULL REFERENCES public.sentences(id) ON DELETE CASCADE,
  level TEXT NOT NULL CHECK (level IN ('A1', 'A2', 'B1', 'B2')),
  score SMALLINT NOT NULL CHECK (score BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.practice_scores ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.practice_scores FROM anon, authenticated;
GRANT SELECT, INSERT ON public.practice_scores TO service_role;
CREATE INDEX IF NOT EXISTS practice_scores_date_idx ON public.practice_scores (created_at, practice_id);
CREATE INDEX IF NOT EXISTS practice_scores_level_date_idx ON public.practice_scores (level, created_at, practice_id);
