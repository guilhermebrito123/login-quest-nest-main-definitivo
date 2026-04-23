import { Constants, type Json } from "@/integrations/supabase/types";
import type {
  ActionPlanNonconformityClass,
  ChecklistConfigOption,
  ActionPlanStatus,
  ChecklistFeedbackListItem,
  ChecklistInstanceTaskWithResponses,
  ChecklistInstanceStatus,
  ChecklistPageSectionKey,
  ChecklistResponseDraft,
  ChecklistResponseInputValue,
  ChecklistResponseRenderer,
  ChecklistReviewDecision,
  ChecklistTaskKanbanStatus,
  ChecklistTaskResponse,
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

const checklistResponseColumnByType = {
  conformity_radio: "resposta_texto",
  text: "resposta_texto",
  textarea: "resposta_texto",
  number: "resposta_numero",
  score: "resposta_numero",
  boolean: "resposta_boolean",
  single_select: "resposta_texto",
  multi_select: "resposta_json",
  date: "resposta_data",
  datetime: "resposta_datetime",
  time: "resposta_texto",
} as const;

function isJsonObject(value: Json | null): value is Record<string, Json | undefined> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeChecklistConfigOption(value: Json): ChecklistConfigOption | null {
  if (typeof value === "string") {
    return {
      label: value,
      value,
    };
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const option = value as Record<string, Json | undefined>;
  const normalizedValue =
    typeof option.value === "string"
      ? option.value
      : typeof option.id === "string"
        ? option.id
        : typeof option.label === "string"
          ? option.label
          : null;

  const label =
    typeof option.label === "string"
      ? option.label
      : typeof option.nome === "string"
        ? option.nome
        : normalizedValue;

  if (!normalizedValue || !label) {
    return null;
  }

  return {
    label,
    value: normalizedValue,
  };
}

export function getChecklistResponseColumn(responseType: ChecklistTaskResponseType) {
  return checklistResponseColumnByType[responseType];
}

export function isAutomaticFeedback(feedback: Pick<ChecklistFeedbackListItem, "checklist_avaliacao_item_id">) {
  return !!feedback.checklist_avaliacao_item_id;
}

export function parseChecklistConfigOptions(config: Json | null) {
  return parseChecklistConfigChoiceOptions(config).map((option) => option.value);
}

export function parseChecklistConfigChoiceOptions(config: Json | null): ChecklistConfigOption[] {
  if (!isJsonObject(config)) {
    return [];
  }

  const candidateKeys = ["options", "choices", "items", "values", "valores", "opcoes"];

  for (const key of candidateKeys) {
    const value = config[key];
    if (!Array.isArray(value)) continue;

    const options = value
      .map(normalizeChecklistConfigOption)
      .filter((entry): entry is ChecklistConfigOption => !!entry);

    if (options.length > 0) return options;
  }

  return [];
}

export function parseChecklistConfigStep(config: Json | null, fallback = 1) {
  if (!isJsonObject(config)) {
    return fallback;
  }

  const step = config.step;
  if (typeof step === "number" && Number.isFinite(step) && step > 0) {
    return step;
  }

  if (typeof step === "string") {
    const parsed = Number(step);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return fallback;
}

export function getChecklistResponseValue(
  responseType: ChecklistTaskResponseType,
  response?: Pick<
    ChecklistTaskResponse,
    | "resposta_boolean"
    | "resposta_data"
    | "resposta_datetime"
    | "resposta_json"
    | "resposta_numero"
    | "resposta_texto"
  > | null,
): ChecklistResponseInputValue {
  if (!response) {
    return responseType === "multi_select" ? [] : null;
  }

  switch (responseType) {
    case "boolean":
      return response.resposta_boolean;
    case "number":
    case "score":
      return response.resposta_numero;
    case "date":
      return response.resposta_data;
    case "datetime":
      return response.resposta_datetime;
    case "multi_select":
      return Array.isArray(response.resposta_json)
        ? response.resposta_json.filter((item): item is string => typeof item === "string")
        : [];
    case "conformity_radio":
    case "text":
    case "textarea":
    case "single_select":
    case "time":
      return response.resposta_texto;
    default:
      return null;
  }
}

export function hasChecklistResponseValue(
  responseType: ChecklistTaskResponseType,
  value: ChecklistResponseInputValue,
) {
  switch (responseType) {
    case "boolean":
      return typeof value === "boolean";
    case "number":
    case "score":
      return typeof value === "number" && Number.isFinite(value);
    case "multi_select":
      return Array.isArray(value) && value.length > 0;
    case "date":
    case "datetime":
    case "conformity_radio":
    case "text":
    case "textarea":
    case "single_select":
    case "time":
      return typeof value === "string" && value.trim().length > 0;
    default:
      return false;
  }
}

export function hasChecklistTaskResponse(
  response?: Pick<
    ChecklistTaskResponse,
    | "resposta_boolean"
    | "resposta_data"
    | "resposta_datetime"
    | "resposta_json"
    | "resposta_numero"
    | "resposta_texto"
  > | null,
) {
  if (!response) return false;

  return (
    typeof response.resposta_boolean === "boolean" ||
    typeof response.resposta_numero === "number" ||
    !!response.resposta_texto ||
    !!response.resposta_data ||
    !!response.resposta_datetime ||
    (Array.isArray(response.resposta_json) && response.resposta_json.length > 0) ||
    (!!response.resposta_json &&
      typeof response.resposta_json === "object" &&
      !Array.isArray(response.resposta_json))
  );
}

export function getLatestChecklistTaskResponse(task: Pick<ChecklistInstanceTaskWithResponses, "respostas">) {
  return [...task.respostas].sort((left, right) =>
    right.updated_at.localeCompare(left.updated_at),
  )[0] ?? null;
}

export function isChecklistTaskAnswered(task: ChecklistInstanceTaskWithResponses) {
  const response = getLatestChecklistTaskResponse(task);
  return hasChecklistTaskResponse(response);
}

type ChecklistTaskValidationTarget = Pick<
  ChecklistInstanceTaskWithResponses,
  | "config_json_snapshot"
  | "nota_max"
  | "nota_min"
  | "obrigatoria"
  | "tipo_resposta_snapshot"
>;

export function validateChecklistTaskResponseInput(
  task: ChecklistTaskValidationTarget,
  value: ChecklistResponseInputValue,
) {
  const { tipo_resposta_snapshot: responseType } = task;

  if (task.obrigatoria && !hasChecklistResponseValue(responseType, value)) {
    return "Esta tarefa exige uma resposta antes de continuar.";
  }

  if (!hasChecklistResponseValue(responseType, value)) {
    return null;
  }

  if ((responseType === "number" || responseType === "score") && typeof value === "number") {
    if (task.nota_min != null && value < task.nota_min) {
      return `O valor mínimo permitido é ${task.nota_min}.`;
    }
    if (task.nota_max != null && value > task.nota_max) {
      return `O valor máximo permitido é ${task.nota_max}.`;
    }
  }

  if (
    (responseType === "single_select" ||
      responseType === "multi_select" ||
      responseType === "conformity_radio") &&
    task.config_json_snapshot
  ) {
    const validOptions = parseChecklistConfigChoiceOptions(task.config_json_snapshot).map(
      (option) => option.value,
    );

    if (validOptions.length > 0) {
      if (responseType === "multi_select" && Array.isArray(value)) {
        const invalid = value.find((entry) => !validOptions.includes(entry));
        if (invalid) {
          return "Selecione apenas opções válidas para esta tarefa.";
        }
      }

      if (
        (responseType === "single_select" || responseType === "conformity_radio") &&
        typeof value === "string" &&
        !validOptions.includes(value)
      ) {
        return "Selecione uma opção válida para esta tarefa.";
      }
    }
  }

  if (
    (responseType === "date" || responseType === "datetime") &&
    typeof value === "string" &&
    Number.isNaN(new Date(value).getTime())
  ) {
    return responseType === "date"
      ? "Informe uma data válida."
      : "Informe uma data e hora válidas.";
  }

  return null;
}

export function buildSnapshotResponsePayload(args: {
  task: ChecklistTaskValidationTarget;
  value: ChecklistResponseInputValue;
  comment?: string | null;
}): ChecklistTaskResponsePayload {
  const payload: ChecklistTaskResponsePayload = {
    resposta_texto: null,
    resposta_numero: null,
    resposta_boolean: null,
    resposta_data: null,
    resposta_datetime: null,
    resposta_json: null,
    comentario_resposta: args.comment?.trim() ? args.comment.trim() : null,
  };

  switch (args.task.tipo_resposta_snapshot) {
    case "boolean":
      payload.resposta_boolean = typeof args.value === "boolean" ? args.value : null;
      return payload;
    case "number":
    case "score":
      payload.resposta_numero = typeof args.value === "number" ? args.value : null;
      return payload;
    case "date":
      payload.resposta_data = typeof args.value === "string" && args.value ? args.value : null;
      return payload;
    case "datetime":
      payload.resposta_datetime =
        typeof args.value === "string" && args.value ? new Date(args.value).toISOString() : null;
      return payload;
    case "multi_select":
      payload.resposta_json = Array.isArray(args.value) ? args.value : null;
      return payload;
    case "conformity_radio":
    case "text":
    case "textarea":
    case "single_select":
    case "time":
      payload.resposta_texto =
        typeof args.value === "string" && args.value.trim() ? args.value.trim() : null;
      return payload;
    default:
      return payload;
  }
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
