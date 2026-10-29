-- Use the original Spanish exercise as the reliable spelling hint.
-- Previous AI-generated one-word glosses could contain false translations.
ALTER TABLE public.orthography_words ADD COLUMN IF NOT EXISTS context_es TEXT;
UPDATE public.orthography_words
SET context_es = CASE word_key
    WHEN 'coûte' THEN '¿Cuánto cuesta este libro?'
    WHEN 'fatigués' THEN 'Estamos cansados.'
    WHEN 'sœur' THEN 'Mi hermana es médica.'
    ELSE context_es END,
    meaning_es = CASE WHEN word_key = 'coûte' AND lower(meaning_es) = 'costa'
      THEN 'cuesta' ELSE meaning_es END
WHERE word_key IN ('coûte', 'fatigués', 'sœur');
