-- Remove o campo segmento da tabela de clientes
ALTER TABLE public.clientes
DROP COLUMN IF EXISTS segmento;
