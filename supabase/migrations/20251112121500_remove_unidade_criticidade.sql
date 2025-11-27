-- Remove a coluna criticidade da tabela unidades
ALTER TABLE public.unidades
DROP COLUMN IF EXISTS criticidade;
