-- Keep existing mini-exams intact while allowing extended CEFR practice sessions.
ALTER TABLE public.mini_exams
  DROP CONSTRAINT IF EXISTS mini_exams_duration_minutes_check;
ALTER TABLE public.mini_exams
  ADD CONSTRAINT mini_exams_duration_minutes_check
  CHECK (duration_minutes IN (15, 20, 35, 45));
