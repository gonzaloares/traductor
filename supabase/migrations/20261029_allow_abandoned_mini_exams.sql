ALTER TABLE public.mini_exams DROP CONSTRAINT IF EXISTS mini_exams_state_check;
ALTER TABLE public.mini_exams ADD CONSTRAINT mini_exams_state_check
  CHECK (state IN ('active','completed','abandoned'));