import { Constants, type Json } from "@/integrations/supabase/types";
import type {
  ActionPlanNonconformityClass,
  ActionPlanStatus,
  ChecklistFeedbackListItem,
  ChecklistInstanceStatus,
  ChecklistPageSectionKey,
  ChecklistResponseDraft,
  ChecklistResponseRenderer,
  ChecklistReviewDecision,
  ChecklistTaskKanbanStatus,
  ChecklistTaskResponsePayload,
  ChecklistTaskResponseType,
  ChecklistTemplateStatus,
  ModuleRecurrenceType,
  ReviewConformityResult,
} from "@/modules/checklist/types";

export const checklistTemplateStatusOptions = [
  ...Constants.public.Enums.checklist_template_status,
] as ChecklistTemplateStatus[];

export const checklistInstanceStatusOptions = [
  ...Constants.public.Enums.checklist_instance_status,
] as ChecklistInstanceStatus[];

export const checklistTaskResponseTypeOptions = [
  ...Constants.public.Enums.checklist_task_response_type,
] as ChecklistTaskResponseType[];

export const checklistTaskKanbanStatusOptions = [
  ...Constants.public.Enums.checklist_task_kanban_status,
] as ChecklistTaskKanbanStatus[];

export const checklistReviewDecisionOptions = [
  ...Constants.public.Enums.checklist_review_decision,
] as ChecklistReviewDecision[];

export const actionPlanStatusOptions = [
  ...Constants.public.Enums.action_plan_status,
] as ActionPlanStatus[];

export const recurrenceOptions = [
  ...Constants.public.Enums.module_recurrence_type,
] as ModuleRecurrenceType[];

export const checklistTemplateStatusLabels: Record<ChecklistTemplateStatus, string> = {
  draft: "Rascunho",
  published: "Publicado",
  archived: "Arquivado",
};

export const checklistInstanceStatusLabels: Record<ChecklistInstanceStatus, string> = {
  scheduled: "Agendado",
  open: "Aberto",
  in_progress: "Em andamento",
  submitted: "Enviado",
  under_review: "Em revisão",
  reviewed: "Revisado",
  awaiting_action_plan: "Aguardando plano",
  closed: "Fechado",
  cancelled: "Cancelado",
};

export const checklistTaskResponseTypeLabels: Record<ChecklistTaskResponseType, string> = {
  conformity_radio: "Conformidade",
  text: "Texto curto",
  textarea: "Texto longo",
  number: "Número",
  score: "Pontuação",
  boolean: "Sim ou não",
  single_select: "Seleção única",
  multi_select: "Múltipla escolha",
  date: "Data",
  datetime: "Data e hora",
  time: "Hora",
};

export const checklistTaskKanbanStatusLabels: Record<ChecklistTaskKanbanStatus, string> = {
  pending: "Pendente",
  doing: "Em andamento",
  blocked: "Bloqueado",
  ignored: "Ignorado",
  done: "Concluído",
  closed: "Fechado automaticamente",
};

export const checklistReviewDecisionLabels: Record<ChecklistReviewDecision, string> = {
  approved: "Aprovado",
  rejected: "Reprovado",
  needs_action_plan: "Exige plano de ação",
  needs_adjustment: "Precisa de ajuste",
};

export const actionPlanStatusLabels: Record<ActionPlanStatus, string> = {
  open: "Aberto",
  in_progress: "Em andamento",
  waiting_validation: "Aguardando validação",
  done: "Concluído",
  cancelled: "Cancelado",
};

export const recurrenceLabels: Record<ModuleRecurrenceType, string> = {
  one_time: "Única",
  daily: "Diária",
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
};

export const reviewConformityLabels: Record<ReviewConformityResult, string> = {
  conforme: "Conforme",
  nao_conforme: "Não conforme",
  nao_aplicavel: "Não aplicável",
};

export const actionPlanNonconformityLabels: Record<ActionPlanNonconformityClass, string> = {
  organizacao: "Organização",
  limpeza: "Limpeza",
  conservacao: "Conservação",
  manutencao_predial: "Manutenção predial",
  manutencao_equipamentos: "Manutenção de equipamentos",
  infraestrutura: "Infraestrutura",
  instalacoes_eletricas: "Instalações elétricas",
  instalacoes_hidraulicas: "Instalações hidráulicas",
  ti_sistemas: "TI - Sistemas",
  ti_hardware: "TI - Hardware",
  ti_rede: "TI - Rede",
  seguranca_trabalho: "Segurança do trabalho",
  seguranca_patrimonial: "Segurança patrimonial",
  epi: "EPI",
  epc: "EPC",
  sinalizacao: "Sinalização",
  acessibilidade: "Acessibilidade",
  ergonomia: "Ergonomia",
  saude_ocupacional: "Saúde ocupacional",
  treinamentos: "Treinamentos",
  competencia_tecnica: "Competência técnica",
  documentacao: "Documentação",
  procedimentos: "Procedimentos",
  qualidade: "Qualidade",
  processos_operacionais: "Processos operacionais",
  produtividade: "Produtividade",
  comunicacao: "Comunicação",
  lideranca: "Liderança",
  dimensionamento_equipe: "Dimensionamento de equipe",
  comportamento_conduta: "Comportamento e conduta",
  disciplina_operacional: "Disciplina operacional",
  atendimento_cliente: "Atendimento ao cliente",
  fornecedores: "Fornecedores",
  materiais_insumos: "Materiais e insumos",
  estoque_armazenamento: "Estoque e armazenamento",
  transporte_logistica: "Transporte e logística",
  meio_ambiente: "Meio ambiente",
  residuos_descartes: "Resíduos e descartes",
  conformidade_legal: "Conformidade legal",
  compliance: "Compliance",
  auditoria_controles: "Auditoria e controles",
  financeiro_orcamento: "Financeiro e orçamento",
  planejamento: "Planejamento",
  continuidade_operacional: "Continuidade operacional",
  risco: "Risco",
  incidente_ocorrencia: "Incidente e ocorrência",
  outros: "Outros",
};

export const kanbanBoardOrder: ChecklistTaskKanbanStatus[] = [
  "pending",
  "doing",
  "blocked",
  "ignored",
  "done",
  "closed",
];

export const reviewResultOptions = (
  Object.entries(reviewConformityLabels) as Array<[ReviewConformityResult, string]>
).map(([value, label]) => ({ value, label }));

export const checklistModuleSections: Array<{
  key: ChecklistPageSectionKey;
  label: string;
  path: string;
}> = [
  { key: "visao-geral", label: "Visão geral", path: "/checklists" },
  { key: "equipes", label: "Equipes", path: "/checklists/equipes" },
  { key: "templates", label: "Templates", path: "/checklists/templates" },
  { key: "instancias", label: "Instâncias", path: "/checklists/instancias" },
  { key: "avaliacoes", label: "Avaliacoes", path: "/checklists/avaliacoes" },
  { key: "kanban", label: "Kanban", path: "/checklists/kanban" },
  { key: "feedbacks", label: "Feedback", path: "/checklists/feedbacks" },
  { key: "planos-acao", label: "Plano de ação", path: "/checklists/planos-acao" },
];

export function getKanbanLabel(status: ChecklistTaskKanbanStatus) {
  return checklistTaskKanbanStatusLabels[status];
}

export function isEditableInstance(status: ChecklistInstanceStatus) {
  return status === "open" || status === "in_progress";
}

export function isClosedTask(status: ChecklistTaskKanbanStatus) {
  return status === "closed";
}

export function isDoneTask(status: ChecklistTaskKanbanStatus) {
  return status === "done";
}

export function getResponseRenderer(
  responseType: ChecklistTaskResponseType,
): ChecklistResponseRenderer {
  return responseType;
}

export function isAutomaticFeedback(feedback: Pick<ChecklistFeedbackListItem, "checklist_avaliacao_item_id">) {
  return !!feedback.checklist_avaliacao_item_id;
}

export function parseChecklistConfigOptions(config: Json | null) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return [];
  }

  const record = config as Record<string, Json | undefined>;
  const candidateKeys = ["options", "choices", "items", "values", "valores"];

  for (const key of candidateKeys) {
    const value = record[key];
    if (!Array.isArray(value)) continue;

    const options = value
      .map((entry) => {
        if (typeof entry === "string") return entry;
        if (entry && typeof entry === "object" && !Array.isArray(entry)) {
          const optionRecord = entry as Record<string, Json | undefined>;
          if (typeof optionRecord.label === "string") return optionRecord.label;
          if (typeof optionRecord.value === "string") return optionRecord.value;
        }
        return null;
      })
      .filter((entry): entry is string => !!entry);

    if (options.length > 0) return options;
  }

  return [];
}

export function formatChecklistTaskResponseValue(payload?: {
  resposta_texto: string | null;
  resposta_numero: number | null;
  resposta_boolean: boolean | null;
  resposta_data: string | null;
  resposta_datetime: string | null;
  resposta_json: Json | null;
}) {
  if (!payload) return "Sem resposta";
  if (payload.resposta_texto) return payload.resposta_texto;
  if (typeof payload.resposta_numero === "number") return String(payload.resposta_numero);
  if (typeof payload.resposta_boolean === "boolean") {
    return payload.resposta_boolean ? "Sim" : "Não";
  }
  if (payload.resposta_data) return payload.resposta_data;
  if (payload.resposta_datetime) return new Date(payload.resposta_datetime).toLocaleString("pt-BR");
  if (Array.isArray(payload.resposta_json)) return payload.resposta_json.join(", ");
  if (payload.resposta_json && typeof payload.resposta_json === "object") {
    return JSON.stringify(payload.resposta_json);
  }
  return "Sem resposta";
}

export function toDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

export function buildResponsePayload(
  renderer: ChecklistResponseRenderer,
  draft: ChecklistResponseDraft,
): ChecklistTaskResponsePayload {
  const payload: ChecklistTaskResponsePayload = {
    resposta_texto: null,
    resposta_numero: null,
    resposta_boolean: null,
    resposta_data: null,
    resposta_datetime: null,
    resposta_json: null,
    comentario_resposta: draft.comment.trim() || null,
  };

  switch (renderer) {
    case "text":
    case "textarea":
    case "single_select":
    case "conformity_radio":
      payload.resposta_texto = draft.text.trim() || draft.singleSelect.trim() || null;
      return payload;
    case "time":
      payload.resposta_texto = draft.time.trim() || null;
      return payload;
    case "number":
    case "score":
      payload.resposta_numero = draft.number || draft.score ? Number(draft.number || draft.score) : null;
      return payload;
    case "boolean":
      payload.resposta_boolean =
        draft.boolean === "" ? null : draft.boolean === "true";
      return payload;
    case "date":
      payload.resposta_data = draft.date || null;
      return payload;
    case "datetime":
      payload.resposta_datetime = draft.datetime
        ? new Date(draft.datetime).toISOString()
        : null;
      return payload;
    case "multi_select":
      payload.resposta_json = draft.multiSelect;
      return payload;
    default:
      payload.resposta_json = draft.json.trim() ? (JSON.parse(draft.json) as Json) : null;
      return payload;
  }
}

export function getFeedbackOriginLabel(feedback: ChecklistFeedbackListItem) {
  return isAutomaticFeedback(feedback) ? "Automático" : "Manual";
}
export function isChecklistAuthUidRequiredError(error: unknown) {
  const message =
    typeof (error as { message?: unknown })?.message === "string"
      ? String((error as { message: string }).message).toLowerCase()
      : "";

  return message.includes("auth.uid()") || message.includes("assigned_by_user_id not null");
}

export function getChecklistAuthUidRequiredMessage() {
  return "Sua sessao expirou. Entre novamente para concluir essa acao, porque o banco precisa de um usuario autenticado para sincronizar os responsaveis automaticamente.";
}
