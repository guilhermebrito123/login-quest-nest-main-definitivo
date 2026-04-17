DROP POLICY IF EXISTS "chamados_select" ON public.chamados;
CREATE POLICY "chamados_select"
  ON public.chamados
  FOR SELECT
  TO authenticated
  USING (
    is_internal_user()
    OR solicitante_id = auth.uid()
  );

DROP POLICY IF EXISTS "interacoes_select" ON public.chamado_interacoes;
CREATE POLICY "interacoes_select"
  ON public.chamado_interacoes
  FOR SELECT
  TO authenticated
  USING (
    is_internal_user()
    OR EXISTS (
      SELECT 1
      FROM public.chamados c
      WHERE c.id = chamado_id
        AND c.solicitante_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "interacoes_insert" ON public.chamado_interacoes;
CREATE POLICY "interacoes_insert"
  ON public.chamado_interacoes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    autor_id = auth.uid()
    AND (
      is_internal_user()
      OR EXISTS (
        SELECT 1
        FROM public.chamados c
        WHERE c.id = chamado_id
          AND c.solicitante_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "anexos_select" ON public.chamado_anexos;
CREATE POLICY "anexos_select"
  ON public.chamado_anexos
  FOR SELECT
  TO authenticated
  USING (
    is_internal_user()
    OR EXISTS (
      SELECT 1
      FROM public.chamados c
      WHERE c.id = chamado_id
        AND c.solicitante_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "anexos_insert" ON public.chamado_anexos;
CREATE POLICY "anexos_insert"
  ON public.chamado_anexos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND (
      is_internal_user()
      OR EXISTS (
        SELECT 1
        FROM public.chamados c
        WHERE c.id = chamado_id
          AND c.solicitante_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "historico_select" ON public.chamado_historico;
CREATE POLICY "historico_select"
  ON public.chamado_historico
  FOR SELECT
  TO authenticated
  USING (
    is_internal_user()
    OR EXISTS (
      SELECT 1
      FROM public.chamados c
      WHERE c.id = chamado_id
        AND c.solicitante_id = auth.uid()
    )
  );
