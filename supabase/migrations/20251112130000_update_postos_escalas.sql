-- Atualiza a coluna jornada e adiciona campos de período aos postos de serviço
ALTER TABLE public.postos_servico
  ALTER COLUMN jornada TYPE INTEGER USING NULLIF(regexp_replace(jornada, '[^0-9]', '', 'g'), '')::INTEGER,
  ALTER COLUMN jornada DROP DEFAULT;

ALTER TABLE public.postos_servico
  ADD COLUMN IF NOT EXISTS "de" DATE,
  ADD COLUMN IF NOT EXISTS "ate" DATE;

-- Enriquecimento da tabela de escalas para refletir variações vindas dos postos
ALTER TABLE public.escalas
  ADD COLUMN IF NOT EXISTS turno TEXT,
  ADD COLUMN IF NOT EXISTS jornada INTEGER,
  ADD COLUMN IF NOT EXISTS horario_inicio TIME,
  ADD COLUMN IF NOT EXISTS horario_fim TIME,
  ADD COLUMN IF NOT EXISTS "de" DATE,
  ADD COLUMN IF NOT EXISTS "ate" DATE;
