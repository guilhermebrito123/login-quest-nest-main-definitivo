import type { AccessContext } from "@/hooks/useAccessContext";
import { Constants } from "@/integrations/supabase/types";
import type { Database, Enums, Json, Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type ChecklistTemplate = Tables<"checklist_templates">;
export type ChecklistTemplateInsert = TablesInsert<"checklist_templates">;
export type ChecklistTemplateUpdate = TablesUpdate<"checklist_templates">;
export type ChecklistTemplateTask = Tables<"checklist_template_tarefas">;
export type ChecklistTemplateTaskInsert = TablesInsert<"checklist_template_tarefas">;
export type ChecklistTemplateTaskUpdate = TablesUpdate<"checklist_template_tarefas">;

export type ChecklistInstance = Tables<"checklist_instancias">;
export type ChecklistInstanceInsert = TablesInsert<"checklist_instancias">;
export type ChecklistInstanceUpdate = TablesUpdate<"checklist_instancias">;
export type ChecklistInstanceTask = Tables<"checklist_instancia_tarefas">;
export type ChecklistInstanceTaskUpdate = TablesUpdate<"checklist_instancia_tarefas">;

export type ChecklistTaskResponsible = Tables<"checklist_tarefa_responsaveis">;
export type ChecklistTaskResponsibleInsert = TablesInsert<"checklist_tarefa_responsaveis">;
export type ChecklistTaskResponsibleUpdate = TablesUpdate<"checklist_tarefa_responsaveis">;
export type ChecklistTaskResponse = Tables<"checklist_tarefa_respostas">;
export type ChecklistTaskResponseInsert = TablesInsert<"checklist_tarefa_respostas">;
export type ChecklistTaskResponseUpdate = TablesUpdate<"checklist_tarefa_respostas">;
export type ChecklistTaskStatusHistory = Tables<"checklist_tarefa_status_historico">;

export type ChecklistReview = Tables<"checklist_avaliacoes">;
export type ChecklistReviewInsert = TablesInsert<"checklist_avaliacoes">;
export type ChecklistReviewUpdate = TablesUpdate<"checklist_avaliacoes">;
export type ChecklistReviewItem = Tables<"checklist_avaliacao_itens">;
export type ChecklistReviewItemInsert = TablesInsert<"checklist_avaliacao_itens">;
export type ChecklistReviewItemUpdate = TablesUpdate<"checklist_avaliacao_itens">;
export type ChecklistFeedback = Tables<"checklist_feedbacks">;
export type ChecklistFeedbackInsert = TablesInsert<"checklist_feedbacks">;
export type ChecklistFeedbackUpdate = TablesUpdate<"checklist_feedbacks">;

export type ActionPlan = Tables<"planos_acao">;
export type ActionPlanInsert = TablesInsert<"planos_acao">;
export type ActionPlanUpdate = TablesUpdate<"planos_acao">;
export type ActionPlanResponsible = Tables<"plano_acao_responsaveis">;
export type ActionPlanResponsibleInsert = TablesInsert<"plano_acao_responsaveis">;
export type ActionPlanUpdateEntry = Tables<"plano_acao_atualizacoes">;
export type ActionPlanUpdateEntryInsert = TablesInsert<"plano_acao_atualizacoes">;

export type ChecklistTeam = Tables<"module_equipes">;
export type ChecklistTeamInsert = TablesInsert<"module_equipes">;
export type ChecklistTeamUpdate = TablesUpdate<"module_equipes">;
export type ChecklistTeamCostCenter = Tables<"module_equipe_cost_centers">;
export type ChecklistTeamCostCenterInsert = TablesInsert<"module_equipe_cost_centers">;
export type ChecklistTeamMember = Tables<"module_equipe_membros">;
export type ChecklistTeamMemberInsert = TablesInsert<"module_equipe_membros">;
export type ChecklistTeamMemberUpdate = TablesUpdate<"module_equipe_membros">;

export type CostCenter = Tables<"cost_center">;
export type CostCenterLocal = Tables<"cost_center_locais">;
export type UserRow = Tables<"usuarios">;
export type UserPublicRow = Tables<"usuarios_public">;
export type InternalProfileCostCenter = Tables<"internal_profile_cost_centers">;
export type ColaboradorProfile = Tables<"colaborador_profiles">;

export type ChecklistTemplateStatus = Enums<"checklist_template_status">;
export type ChecklistInstanceStatus = Enums<"checklist_instance_status">;
export type ChecklistTaskResponseType = Enums<"checklist_task_response_type">;
export type ChecklistTaskKanbanStatus = Enums<"checklist_task_kanban_status">;
export type ChecklistReviewDecision = Enums<"checklist_review_decision">;
export type ActionPlanStatus = Enums<"action_plan_status">;
export type ActionPlanNonconformityClass = Enums<"action_plan_nonconformity_class">;
export type ModuleRecurrenceType = Enums<"module_recurrence_type">;
export type TeamScope = ChecklistTeam["escopo"];
export type ReviewConformityResult =
  | "conforme"
  | "nao_conforme"
  | "nao_aplicavel";

export type EnumConstant<T extends readonly string[]> = T[number];

export type ChecklistTemplateStatusOption = EnumConstant<
  typeof Constants.public.Enums.checklist_template_status
>;
export type ChecklistInstanceStatusOption = EnumConstant<
  typeof Constants.public.Enums.checklist_instance_status
>;
export type ChecklistKanbanStatusOption = EnumConstant<
  typeof Constants.public.Enums.checklist_task_kanban_status
>;
export type ChecklistResponseTypeOption = EnumConstant<
  typeof Constants.public.Enums.checklist_task_response_type
>;
export type ChecklistReviewDecisionOption = EnumConstant<
  typeof Constants.public.Enums.checklist_review_decision
>;
export type ActionPlanStatusOption = EnumConstant<
  typeof Constants.public.Enums.action_plan_status
>;
export type ModuleRecurrenceTypeOption = EnumConstant<
  typeof Constants.public.Enums.module_recurrence_type
>;

export type ChecklistLookupOption = {
  id: string;
  label: string;
  description?: string | null;
  parentId?: string | null;
  active?: boolean;
};

export type ChecklistActionPlanAssignableUser =
  Database["public"]["Functions"]["get_action_plan_assignable_users"]["Returns"][number];

export type ChecklistTemplateListItem = ChecklistTemplate & {
  cost_center: Pick<CostCenter, "id" | "name"> | null;
  local: Pick<CostCenterLocal, "id" | "nome"> | null;
  equipe: Pick<ChecklistTeam, "id" | "nome" | "ativo" | "escopo"> | null;
};

export type ChecklistTemplateTaskListItem = ChecklistTemplateTask;

export type ChecklistTeamListItem = ChecklistTeam & {
  cost_centers: Array<ChecklistTeamCostCenter & { cost_center: Pick<CostCenter, "id" | "name"> | null }>;
  members_count: number;
};

export type ChecklistTeamMemberListItem = ChecklistTeamMember & {
  user: Pick<UserRow, "id" | "full_name" | "email" | "role"> | null;
};

export type ChecklistInstanceListItem = ChecklistInstance & {
  template:
    | (Pick<ChecklistTemplate, "id" | "titulo" | "status" | "versao" | "equipe_responsavel_id"> & {
        equipe: Pick<ChecklistTeam, "id" | "nome" | "ativo" | "escopo"> | null;
      })
    | null;
  cost_center: Pick<CostCenter, "id" | "name"> | null;
  local: Pick<CostCenterLocal, "id" | "nome"> | null;
  equipe: Pick<ChecklistTeam, "id" | "nome" | "ativo"> | null;
};

export type ChecklistInstanceTaskResponsibility = ChecklistTaskResponsible & {
  assigned_user: Pick<UserRow, "id" | "full_name" | "email"> | null;
};

export type ChecklistInstanceTaskListItem = ChecklistInstanceTask & {
  responsaveis: ChecklistInstanceTaskResponsibility[];
};

export type ChecklistResponsibilityListItem = ChecklistTaskResponsible & {
  assigned_user: Pick<UserRow, "id" | "full_name" | "email"> | null;
  task: (ChecklistInstanceTask & {
    instance: Pick<
      ChecklistInstance,
      "id" | "titulo_snapshot" | "status" | "prazo_em" | "cost_center_id"
    > | null;
  }) | null;
};

export type ChecklistReviewListItem = ChecklistReview & {
  instance: Pick<ChecklistInstance, "id" | "titulo_snapshot" | "status" | "cost_center_id"> | null;
  reviewer: Pick<UserRow, "id" | "full_name" | "email"> | null;
};

export type ChecklistReviewItemListItem = ChecklistReviewItem & {
  task: Pick<ChecklistInstanceTask, "id" | "titulo_snapshot" | "ordem" | "tipo_resposta_snapshot"> | null;
};

export type ChecklistTaskStatusHistoryListItem = ChecklistTaskStatusHistory & {
  changed_by: Pick<UserRow, "id" | "full_name" | "email"> | null;
  assigned_user: Pick<UserRow, "id" | "full_name" | "email"> | null;
  task: Pick<ChecklistInstanceTask, "id" | "titulo_snapshot" | "checklist_instancia_id"> | null;
};

export type ChecklistFeedbackListItem = ChecklistFeedback & {
  autor: Pick<UserRow, "id" | "full_name" | "email"> | null;
  destinatario: Pick<UserRow, "id" | "full_name" | "email"> | null;
  task: (Pick<ChecklistInstanceTask, "id" | "titulo_snapshot" | "checklist_instancia_id"> & {
    instance: Pick<ChecklistInstance, "id" | "titulo_snapshot" | "cost_center_id"> | null;
  }) | null;
  avaliacao_item: Pick<ChecklistReviewItem, "id" | "resultado_conformidade" | "nota"> | null;
};

export type ChecklistActionPlanListItem = ActionPlan & {
  instance: Pick<ChecklistInstance, "id" | "titulo_snapshot" | "status" | "cost_center_id"> | null;
  review: Pick<ChecklistReview, "id" | "decisao" | "plano_acao_necessario"> | null;
  team: Pick<ChecklistTeam, "id" | "nome" | "ativo"> | null;
  responsaveis: Array<
    ActionPlanResponsible & {
      assigned_user: Pick<UserRow, "id" | "full_name" | "email"> | null;
    }
  >;
  updates: Array<
    ActionPlanUpdateEntry & {
      autor: Pick<UserRow, "id" | "full_name" | "email"> | null;
    }
  >;
};

export type ChecklistOverviewStats = {
  templates: number;
  instanciasAbertas: number;
  tarefasPendentes: number;
  tarefasBloqueadas: number;
  tarefasFechadas: number;
  feedbacksPendentes: number;
  planosAbertos: number;
};

export type ChecklistResponseRenderer =
  | "text"
  | "textarea"
  | "number"
  | "boolean"
  | "date"
  | "datetime"
  | "time"
  | "single_select"
  | "multi_select"
  | "score"
  | "conformity_radio";

export type ChecklistResponseDraft = {
  text: string;
  number: string;
  boolean: "" | "true" | "false";
  date: string;
  datetime: string;
  time: string;
  singleSelect: string;
  multiSelect: string[];
  score: string;
  comment: string;
  json: string;
};

export type ChecklistTaskResponsePayload = {
  resposta_texto: string | null;
  resposta_numero: number | null;
  resposta_boolean: boolean | null;
  resposta_data: string | null;
  resposta_datetime: string | null;
  resposta_json: Json | null;
  comentario_resposta: string | null;
};

export type ChecklistSupervisorActor =
  | "anonymous"
  | "colaborador"
  | "internal"
  | "supervisor"
  | "admin";

export type ChecklistPermissionAction =
  | "visualizar"
  | "editar"
  | "avaliar"
  | "moverKanban"
  | "gerenciarEquipes"
  | "gerenciarMembros"
  | "gerenciarVinculosEquipe";

export type ChecklistSupervisorPermissions = Record<ChecklistPermissionAction, boolean>;

export type ChecklistSupervisorContext = {
  actor: ChecklistSupervisorActor;
  userId: string | null;
  role: AccessContext["role"];
  accessLevel: AccessContext["accessLevel"];
  isLoading: boolean;
  isAdmin: boolean;
  isSupervisor: boolean;
  isInternal: boolean;
  isColaborador: boolean;
  hasModuleAccess: boolean;
  allowedCostCenterIds: string[];
  hasScopedCostCenters: boolean;
  permissions: ChecklistSupervisorPermissions;
};

export type ChecklistKanbanAbilityInput = {
  accessContext: AccessContext;
  supervisorContext: ChecklistSupervisorContext;
  assignedUserId: string;
  isActive: boolean;
  canAlterStatus: boolean;
  instanceStatus: ChecklistInstanceStatus;
  costCenterId?: string | null;
};

export type ChecklistPageSectionKey =
  | "visao-geral"
  | "equipes"
  | "templates"
  | "instancias"
  | "avaliacoes"
  | "tarefas"
  | "kanban"
  | "feedbacks"
  | "planos-acao"
  | "auditoria";
