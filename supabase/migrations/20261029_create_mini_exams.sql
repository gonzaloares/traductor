-- Independent mini-exam attempts: scores never change spaced-repetition data.
CREATE TABLE IF NOT EXISTS public.mini_exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text NOT NULL CHECK (level IN ('A1','A2','B1','B2','C1','C2')),
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active','completed')),
  duration_minutes smallint NOT NULL CHECK (duration_minutes IN (15,20)),
  paper jsonb NOT NULL,
  answers jsonb,
  result jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS mini_exams_state_started_idx ON public.mini_exams (state,started_at DESC);
CREATE INDEX IF NOT EXISTS mini_exams_completed_at_idx ON public.mini_exams (completed_at DESC);
ALTER TABLE public.mini_exams ENABLE ROW LEVEL SECURITY;
-- No direct anon/authenticated access. The PIN-protected Edge Function uses service_role.
REVOKE ALL ON public.mini_exams FROM anon, authenticated;
