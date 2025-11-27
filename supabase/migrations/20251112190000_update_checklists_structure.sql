BEGIN;

ALTER TABLE public.checklists
ADD COLUMN IF NOT EXISTS contrato_id UUID REFERENCES public.contratos(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS unidade_id UUID REFERENCES public.unidades(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE;

UPDATE public.checklists
SET ativo = TRUE
WHERE ativo IS NULL;

ALTER TABLE public.checklists
ALTER COLUMN ativo SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_checklists_contrato_id ON public.checklists(contrato_id);
CREATE INDEX IF NOT EXISTS idx_checklists_unidade_id ON public.checklists(unidade_id);

COMMIT;
