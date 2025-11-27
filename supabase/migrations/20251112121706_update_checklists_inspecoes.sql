BEGIN;

-- Garantir novo atributo checklist direto na tabela de inspeções
ALTER TABLE public.inspecoes
  ADD COLUMN IF NOT EXISTS checklist TEXT;

UPDATE public.inspecoes
SET checklist = COALESCE(checklist, 'Sem checklist informado');

ALTER TABLE public.inspecoes
  ALTER COLUMN checklist SET NOT NULL;

-- Como a entidade inspeção não se relaciona mais com checklists, removemos as tabelas de junção
DROP TABLE IF EXISTS public.inspecoes_checklist_itens CASCADE;
DROP TABLE IF EXISTS public.inspecoes_checklists CASCADE;

COMMIT;
