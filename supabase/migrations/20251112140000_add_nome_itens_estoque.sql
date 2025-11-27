-- Adiciona coluna nome em itens_estoque
ALTER TABLE public.itens_estoque
ADD COLUMN IF NOT EXISTS nome TEXT;

UPDATE public.itens_estoque
SET nome = COALESCE(nome, descricao)
WHERE nome IS NULL OR nome = '';

ALTER TABLE public.itens_estoque
ALTER COLUMN nome SET NOT NULL;
