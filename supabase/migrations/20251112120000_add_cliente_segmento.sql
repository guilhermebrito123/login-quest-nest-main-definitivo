-- Adiciona o campo segmento na tabela de clientes
ALTER TABLE public.clientes
ADD COLUMN IF NOT EXISTS segmento TEXT;
