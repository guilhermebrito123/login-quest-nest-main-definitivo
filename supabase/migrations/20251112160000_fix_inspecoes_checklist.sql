-- Garante que a coluna checklist exista conforme o schema oficial
ALTER TABLE public.inspecoes
ADD COLUMN IF NOT EXISTS checklist TEXT;

UPDATE public.inspecoes
SET checklist = COALESCE(checklist, checklist_nome)
WHERE checklist IS NULL;

ALTER TABLE public.inspecoes
ALTER COLUMN checklist SET NOT NULL;

ALTER TABLE public.inspecoes
ALTER COLUMN checklist TYPE TEXT;

ALTER TABLE public.inspecoes
DROP COLUMN IF EXISTS checklist_nome;
