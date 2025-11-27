BEGIN;

ALTER TABLE public.checklists
DROP COLUMN IF EXISTS contrato_id,
DROP COLUMN IF EXISTS periodicidade,
DROP COLUMN IF EXISTS ativo,
ADD COLUMN IF NOT EXISTS descricao TEXT,
ADD COLUMN IF NOT EXISTS tipo TEXT CHECK (tipo IN ('operacional','seguranca','qualidade','auditoria','outros')),
ADD COLUMN IF NOT EXISTS unidade_id UUID REFERENCES public.unidades(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ativo';

UPDATE public.checklists
SET status = COALESCE(status, 'ativo');

ALTER TABLE public.checklists
ALTER COLUMN status SET NOT NULL;

COMMIT;
