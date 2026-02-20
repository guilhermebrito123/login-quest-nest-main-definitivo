-- Atualizar RLS do modulo de faltas para usar internal_access_level via internal_profiles

-- colaborador_faltas
DROP POLICY IF EXISTS "Usuarios autenticados podem ler faltas" ON public.colaborador_faltas;
DROP POLICY IF EXISTS "Usuarios autorizados podem inserir faltas" ON public.colaborador_faltas;
DROP POLICY IF EXISTS "Usuarios autorizados podem atualizar faltas" ON public.colaborador_faltas;
DROP POLICY IF EXISTS "Usuarios autorizados podem deletar faltas" ON public.colaborador_faltas;

CREATE POLICY "Usuarios autenticados podem ler faltas"
ON public.colaborador_faltas
FOR SELECT
TO authenticated
USING (public.is_internal_user());

CREATE POLICY "Usuarios autorizados podem inserir faltas"
ON public.colaborador_faltas
FOR INSERT
TO authenticated
WITH CHECK (
  public.current_internal_access_level() = ANY(ARRAY[
    'admin',
    'gestor_operacoes',
    'supervisor'
  ]::public.internal_access_level[])
);

CREATE POLICY "Usuarios autorizados podem atualizar faltas"
ON public.colaborador_faltas
FOR UPDATE
TO authenticated
USING (
  public.current_internal_access_level() = ANY(ARRAY[
    'admin',
    'gestor_operacoes',
    'supervisor'
  ]::public.internal_access_level[])
)
WITH CHECK (
  public.current_internal_access_level() = ANY(ARRAY[
    'admin',
    'gestor_operacoes',
    'supervisor'
  ]::public.internal_access_level[])
);

CREATE POLICY "Usuarios autorizados podem deletar faltas"
ON public.colaborador_faltas
FOR DELETE
TO authenticated
USING (
  public.current_internal_access_level() = ANY(ARRAY[
    'admin',
    'gestor_operacoes'
  ]::public.internal_access_level[])
);

-- faltas_colaboradores_convenia
DROP POLICY IF EXISTS "Usuarios autenticados podem ler faltas_convenia" ON public.faltas_colaboradores_convenia;
DROP POLICY IF EXISTS "Usuarios autorizados podem inserir faltas_convenia" ON public.faltas_colaboradores_convenia;
DROP POLICY IF EXISTS "Usuarios autorizados podem atualizar faltas_convenia" ON public.faltas_colaboradores_convenia;
DROP POLICY IF EXISTS "Admins podem deletar faltas_convenia" ON public.faltas_colaboradores_convenia;

CREATE POLICY "Usuarios autenticados podem ler faltas_convenia"
ON public.faltas_colaboradores_convenia
FOR SELECT
TO authenticated
USING (public.is_internal_user());

CREATE POLICY "Usuarios autorizados podem inserir faltas_convenia"
ON public.faltas_colaboradores_convenia
FOR INSERT
TO authenticated
WITH CHECK (
  public.current_internal_access_level() = ANY(ARRAY[
    'admin',
    'gestor_operacoes',
    'supervisor'
  ]::public.internal_access_level[])
);

CREATE POLICY "Usuarios autorizados podem atualizar faltas_convenia"
ON public.faltas_colaboradores_convenia
FOR UPDATE
TO authenticated
USING (
  public.current_internal_access_level() = ANY(ARRAY[
    'admin',
    'gestor_operacoes',
    'supervisor'
  ]::public.internal_access_level[])
)
WITH CHECK (
  public.current_internal_access_level() = ANY(ARRAY[
    'admin',
    'gestor_operacoes',
    'supervisor'
  ]::public.internal_access_level[])
);

CREATE POLICY "Admins podem deletar faltas_convenia"
ON public.faltas_colaboradores_convenia
FOR DELETE
TO authenticated
USING (public.is_admin_user());
