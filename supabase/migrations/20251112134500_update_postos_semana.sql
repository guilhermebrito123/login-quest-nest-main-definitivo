-- Converte os campos de/até para texto (dias da semana) e adiciona jornada semanal
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'postos_servico'
      AND column_name = 'de' AND data_type = 'date'
  ) THEN
    EXECUTE $conv$
      ALTER TABLE public.postos_servico
        ALTER COLUMN de TYPE TEXT USING CASE
          WHEN de IS NULL THEN NULL
          ELSE CASE EXTRACT(DOW FROM de)
            WHEN 0 THEN 'domingo'
            WHEN 1 THEN 'segunda'
            WHEN 2 THEN 'terca'
            WHEN 3 THEN 'quarta'
            WHEN 4 THEN 'quinta'
            WHEN 5 THEN 'sexta'
            WHEN 6 THEN 'sabado'
          END
        END,
        ALTER COLUMN ate TYPE TEXT USING CASE
          WHEN ate IS NULL THEN NULL
          ELSE CASE EXTRACT(DOW FROM ate)
            WHEN 0 THEN 'domingo'
            WHEN 1 THEN 'segunda'
            WHEN 2 THEN 'terca'
            WHEN 3 THEN 'quarta'
            WHEN 4 THEN 'quinta'
            WHEN 5 THEN 'sexta'
            WHEN 6 THEN 'sabado'
          END
        END;
    $conv$;
  END IF;
END $$;

ALTER TABLE public.postos_servico
  ADD COLUMN IF NOT EXISTS jornada_semanal TEXT;

UPDATE public.postos_servico
SET jornada_semanal = CASE
  WHEN de IS NOT NULL AND ate IS NOT NULL AND de <> '' AND ate <> '' THEN
    CASE WHEN de = ate THEN de ELSE de || ' à ' || ate END
  WHEN de IS NOT NULL AND de <> '' THEN de
  WHEN ate IS NOT NULL AND ate <> '' THEN ate
  ELSE NULL
END
WHERE jornada_semanal IS NULL;

-- Ajusta as colunas equivalentes na tabela de escalas modelo
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'escalas'
      AND column_name = 'de' AND data_type = 'date'
  ) THEN
    EXECUTE $conv$
      ALTER TABLE public.escalas
        ALTER COLUMN de TYPE TEXT USING CASE
          WHEN de IS NULL THEN NULL
          ELSE CASE EXTRACT(DOW FROM de)
            WHEN 0 THEN 'domingo'
            WHEN 1 THEN 'segunda'
            WHEN 2 THEN 'terca'
            WHEN 3 THEN 'quarta'
            WHEN 4 THEN 'quinta'
            WHEN 5 THEN 'sexta'
            WHEN 6 THEN 'sabado'
          END
        END,
        ALTER COLUMN ate TYPE TEXT USING CASE
          WHEN ate IS NULL THEN NULL
          ELSE CASE EXTRACT(DOW FROM ate)
            WHEN 0 THEN 'domingo'
            WHEN 1 THEN 'segunda'
            WHEN 2 THEN 'terca'
            WHEN 3 THEN 'quarta'
            WHEN 4 THEN 'quinta'
            WHEN 5 THEN 'sexta'
            WHEN 6 THEN 'sabado'
          END
        END;
    $conv$;
  END IF;
END $$;
