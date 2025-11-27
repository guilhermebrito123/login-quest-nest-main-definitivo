BEGIN;

-- Remove estruturas antigas para reconstruir o modelo de inspeções
DROP TABLE IF EXISTS public.inspecoes_checklist_itens CASCADE;
DROP TABLE IF EXISTS public.inspecoes_checklists CASCADE;
DROP TABLE IF EXISTS public.inspecoes CASCADE;

-- Tabela principal de inspeções
CREATE TABLE public.inspecoes (
  id BIGSERIAL PRIMARY KEY,
  unidade_id UUID NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  posto_id UUID NOT NULL REFERENCES public.postos_servico(id) ON DELETE CASCADE,
  dia_inspecao TIMESTAMPTZ NOT NULL,
  responsavel UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT responsavel_com_perfil_valido CHECK (
    public.has_role(responsavel, 'supervisor'::public.app_role) OR
    public.has_role(responsavel, 'gestor_operacoes'::public.app_role) OR
    public.has_role(responsavel, 'admin'::public.app_role)
  )
);

CREATE INDEX idx_inspecoes_unidade_id ON public.inspecoes(unidade_id);
CREATE INDEX idx_inspecoes_posto_id ON public.inspecoes(posto_id);
CREATE INDEX idx_inspecoes_dia_inspecao ON public.inspecoes(dia_inspecao);

CREATE TRIGGER update_inspecoes_updated_at
BEFORE UPDATE ON public.inspecoes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Relação N:N entre inspeções e checklists
CREATE TABLE public.inspecoes_checklists (
  id BIGSERIAL PRIMARY KEY,
  inspecao_id BIGINT NOT NULL REFERENCES public.inspecoes(id) ON DELETE CASCADE,
  checklist_id BIGINT NOT NULL REFERENCES public.checklists(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX inspecoes_checklists_inspecao_checklist_uidx
  ON public.inspecoes_checklists (inspecao_id, checklist_id);

-- Relação opcional N:N entre inspeções e itens de checklist
CREATE TABLE public.inspecoes_checklist_itens (
  id BIGSERIAL PRIMARY KEY,
  inspecao_id BIGINT NOT NULL REFERENCES public.inspecoes(id) ON DELETE CASCADE,
  checklist_item_id UUID NOT NULL REFERENCES public.checklist_itens(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX inspecoes_checklist_itens_inspecao_item_uidx
  ON public.inspecoes_checklist_itens (inspecao_id, checklist_item_id);

-- Garantir que a tabela de checklists esteja alinhada com o requisito
ALTER TABLE public.checklists
  ALTER COLUMN nome SET NOT NULL,
  ALTER COLUMN periodicidade SET NOT NULL;

-- Habilitar RLS
ALTER TABLE public.inspecoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspecoes_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspecoes_checklist_itens ENABLE ROW LEVEL SECURITY;

-- Policies para inspeções
CREATE POLICY "Supervisores e acima podem ler inspecoes" ON public.inspecoes
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'gestor_operacoes') OR
    public.has_role(auth.uid(), 'supervisor')
  );

CREATE POLICY "Supervisores e acima podem inserir inspecoes" ON public.inspecoes
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'gestor_operacoes') OR
    public.has_role(auth.uid(), 'supervisor')
  );

CREATE POLICY "Supervisores e acima podem atualizar inspecoes" ON public.inspecoes
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'gestor_operacoes') OR
    public.has_role(auth.uid(), 'supervisor')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'gestor_operacoes') OR
    public.has_role(auth.uid(), 'supervisor')
  );

CREATE POLICY "Supervisores e acima podem deletar inspecoes" ON public.inspecoes
  FOR DELETE TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'gestor_operacoes') OR
    public.has_role(auth.uid(), 'supervisor')
  );

-- Policies para tabelas de relacionamento
CREATE POLICY "Supervisores e acima podem gerenciar inspecoes_checklists"
  ON public.inspecoes_checklists
  FOR ALL TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'gestor_operacoes') OR
    public.has_role(auth.uid(), 'supervisor')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'gestor_operacoes') OR
    public.has_role(auth.uid(), 'supervisor')
  );

CREATE POLICY "Supervisores e acima podem gerenciar inspecoes_checklist_itens"
  ON public.inspecoes_checklist_itens
  FOR ALL TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'gestor_operacoes') OR
    public.has_role(auth.uid(), 'supervisor')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'gestor_operacoes') OR
    public.has_role(auth.uid(), 'supervisor')
  );

COMMIT;
