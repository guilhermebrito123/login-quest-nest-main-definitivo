-- Adiciona coluna checklist_nome em inspecoes
ALTER TABLE public.inspecoes
ADD COLUMN IF NOT EXISTS checklist_nome TEXT;
