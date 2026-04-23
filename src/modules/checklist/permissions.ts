import type { AccessContext } from "@/hooks/useAccessContext";
import { checklistModuleSections, isEditableInstance } from "@/modules/checklist/helpers";
import type {
  ChecklistActionPlanListItem,
  ChecklistFeedbackListItem,
  ChecklistInstanceListItem,
  ChecklistKanbanAbilityInput,
  ChecklistPageSectionKey,
  ChecklistResponsibilityListItem,
  ChecklistReviewListItem,
  ChecklistSupervisorContext,
  ChecklistTeamListItem,
  ChecklistTemplateListItem,
} from "@/modules/checklist/types";

function uniqueCostCenters(costCenterIds: Array<string | null | undefined>) {
  return Array.from(new Set(costCenterIds.filter((item): item is string => !!item)));
}

export function buildChecklistSupervisorContext(
  accessContext: AccessContext,
  allowedCostCenterIds: string[] = [],
  isLoading = false,
): ChecklistSupervisorContext {
  const isAdmin = accessContext.accessLevel === "admin";
  const isSupervisor =
    accessContext.role === "perfil_interno" && accessContext.accessLevel === "supervisor";
  const hasModuleAccess =
    accessContext.role === "colaborador" ||
    (accessContext.role === "perfil_interno" && accessContext.accessLevel !== "cliente_view");
  const normalizedCostCenterIds = uniqueCostCenters([
    ...allowedCostCenterIds,
    accessContext.colaboradorCostCenterId,
  ]);

  return {
    actor: isAdmin
      ? "admin"
      : isSupervisor
        ? "supervisor"
        : accessContext.role === "colaborador"
          ? "colaborador"
          : accessContext.role === "perfil_interno"
            ? "internal"
            : "anonymous",
    userId: accessContext.userId,
    role: accessContext.role,
    accessLevel: accessContext.accessLevel,
    isLoading,
    isAdmin,
    isSupervisor,
    isInternal: accessContext.isInternal,
    isColaborador: accessContext.isColaborador,
    hasModuleAccess,
    allowedCostCenterIds: normalizedCostCenterIds,
    hasScopedCostCenters: isAdmin || !isSupervisor || normalizedCostCenterIds.length > 0,
    permissions: {
      visualizar: hasModuleAccess && (!isSupervisor || normalizedCostCenterIds.length > 0 || isLoading),
      editar: isAdmin || (isSupervisor && normalizedCostCenterIds.length > 0),
      avaliar: isAdmin || (isSupervisor && normalizedCostCenterIds.length > 0),
      moverKanban: isAdmin || (isSupervisor && normalizedCostCenterIds.length > 0),
      gerenciarEquipes: isAdmin || (isSupervisor && normalizedCostCenterIds.length > 0),
      gerenciarMembros: isAdmin || (isSupervisor && normalizedCostCenterIds.length > 0),
      gerenciarVinculosEquipe: isAdmin || (isSupervisor && normalizedCostCenterIds.length > 0),
    },
  };
}

export function canAccessChecklistModule(context: ChecklistSupervisorContext) {
  return context.hasModuleAccess && (!context.isSupervisor || context.hasScopedCostCenters);
}

export function canAccessChecklistPage(
  context: ChecklistSupervisorContext,
  page: ChecklistPageSectionKey,
) {
  if (page === "auditoria") return context.isAdmin;
  if (page === "equipes") return context.isAdmin || (context.isSupervisor && context.hasScopedCostCenters);
  if (
    page === "templates" ||
    page === "instancias" ||
    page === "avaliacoes" ||
    page === "tarefas" ||
    page === "kanban"
  ) {
    return (
      context.isAdmin ||
      (context.isSupervisor && context.hasScopedCostCenters) ||
      context.isColaborador
    );
  }
  if (page === "feedbacks" || page === "planos-acao") {
    return canAccessChecklistModule(context);
  }
  return canAccessChecklistModule(context);
}

export function canViewChecklistTeams(context: ChecklistSupervisorContext) {
  return canAccessChecklistPage(context, "equipes");
}

export function canManageChecklistTeams(context: ChecklistSupervisorContext) {
  return context.permissions.gerenciarEquipes;
}

export function canViewChecklistTemplates(context: ChecklistSupervisorContext) {
  return canAccessChecklistPage(context, "templates");
}

export function canManageChecklistTemplates(context: ChecklistSupervisorContext) {
  return context.permissions.editar;
}

export function canViewChecklistInstances(context: ChecklistSupervisorContext) {
  return canAccessChecklistPage(context, "instancias");
}

export function canManageChecklistInstances(context: ChecklistSupervisorContext) {
  return context.permissions.editar;
}

export function canViewChecklistReviews(context: ChecklistSupervisorContext) {
  return canAccessChecklistPage(context, "avaliacoes");
}

export function canReviewChecklistInstance(context: ChecklistSupervisorContext) {
  return context.permissions.avaliar;
}

export function canViewChecklistTasks(context: ChecklistSupervisorContext) {
  return canAccessChecklistPage(context, "tarefas");
}

export function canViewChecklistKanban(context: ChecklistSupervisorContext) {
  return canAccessChecklistPage(context, "kanban");
}

export function canViewChecklistFeedbacks(context: ChecklistSupervisorContext) {
  return canAccessChecklistPage(context, "feedbacks");
}

export function canViewActionPlans(context: ChecklistSupervisorContext) {
  return canAccessChecklistPage(context, "planos-acao");
}

export function canManageActionPlans(context: ChecklistSupervisorContext) {
  return context.permissions.editar;
}

export function canViewChecklistActionPlan(
  context: ChecklistSupervisorContext,
  plan: Pick<ChecklistActionPlanListItem, "instance" | "responsaveis">,
) {
  if (canViewChecklistRecord(context, plan.instance?.cost_center_id)) return true;
  if (!context.userId) return false;
  return plan.responsaveis.some((responsavel) => responsavel.assigned_user_id === context.userId);
}

export function canManageChecklistActionPlan(
  context: ChecklistSupervisorContext,
  plan: Pick<ChecklistActionPlanListItem, "instance">,
) {
  return canEditChecklistRecord(context, plan.instance?.cost_center_id);
}

export function canPostChecklistActionPlanUpdate(
  context: ChecklistSupervisorContext,
  plan: Pick<ChecklistActionPlanListItem, "instance" | "responsaveis">,
) {
  if (canManageChecklistActionPlan(context, plan)) return true;
  if (!context.userId) return false;
  return plan.responsaveis.some(
    (responsavel) => responsavel.assigned_user_id === context.userId && responsavel.ativo,
  );
}

export function canViewChecklistAudit(context: ChecklistSupervisorContext) {
  return canAccessChecklistPage(context, "auditoria");
}

export function getChecklistVisibleSections(context: ChecklistSupervisorContext) {
  return checklistModuleSections.filter((section) => canAccessChecklistPage(context, section.key));
}

export function canAccessChecklistCostCenter(
  context: ChecklistSupervisorContext,
  costCenterId?: string | null,
) {
  if (context.isAdmin) return true;
  if (!costCenterId) return false;
  if (context.isSupervisor || context.isColaborador) {
    return context.allowedCostCenterIds.includes(costCenterId);
  }
  return false;
}

export function canViewChecklistRecord(
  context: ChecklistSupervisorContext,
  costCenterId?: string | null,
) {
  if (!context.permissions.visualizar) return false;
  return canAccessChecklistCostCenter(context, costCenterId);
}

export function canEditChecklistRecord(
  context: ChecklistSupervisorContext,
  costCenterId?: string | null,
) {
  if (!context.permissions.editar) return false;
  return canAccessChecklistCostCenter(context, costCenterId);
}

export function canEvaluateChecklistRecord(
  context: ChecklistSupervisorContext,
  costCenterId?: string | null,
) {
  if (!context.permissions.avaliar) return false;
  return canAccessChecklistCostCenter(context, costCenterId);
}

export function canMoveChecklistKanbanRecord(
  context: ChecklistSupervisorContext,
  costCenterId?: string | null,
) {
  if (!context.permissions.moverKanban) return false;
  return canAccessChecklistCostCenter(context, costCenterId);
}

export function canViewChecklistTeam(
  context: ChecklistSupervisorContext,
  team: Pick<ChecklistTeamListItem, "escopo" | "cost_centers">,
) {
  if (context.isAdmin) return true;
  if (!context.isSupervisor || team.escopo !== "cost_center") return false;
  const teamCostCenterIds = uniqueCostCenters(team.cost_centers.map((item) => item.cost_center_id));
  return teamCostCenterIds.some((costCenterId) => context.allowedCostCenterIds.includes(costCenterId));
}

export function canManageChecklistTeam(
  context: ChecklistSupervisorContext,
  team: Pick<ChecklistTeamListItem, "escopo" | "cost_centers">,
) {
  if (context.isAdmin) return true;
  if (!context.permissions.gerenciarEquipes || team.escopo !== "cost_center") return false;
  const teamCostCenterIds = uniqueCostCenters(team.cost_centers.map((item) => item.cost_center_id));
  return (
    teamCostCenterIds.length > 0 &&
    teamCostCenterIds.every((costCenterId) => context.allowedCostCenterIds.includes(costCenterId))
  );
}

export function canManageChecklistTeamCostCenters(
  context: ChecklistSupervisorContext,
  team: Pick<ChecklistTeamListItem, "escopo">,
  costCenterId?: string | null,
) {
  if (context.isAdmin) return true;
  if (!context.permissions.gerenciarVinculosEquipe || team.escopo !== "cost_center") return false;
  if (!costCenterId) return true;
  return canAccessChecklistCostCenter(context, costCenterId);
}

export function canManageChecklistMembers(
  context: ChecklistSupervisorContext,
  team: Pick<ChecklistTeamListItem, "escopo" | "cost_centers">,
  memberCostCenterId?: string | null,
) {
  if (!context.permissions.gerenciarMembros || !canManageChecklistTeam(context, team)) return false;
  if (!memberCostCenterId) return false;
  const linkedCostCenterIds = uniqueCostCenters(team.cost_centers.map((item) => item.cost_center_id));
  return (
    linkedCostCenterIds.includes(memberCostCenterId) &&
    context.allowedCostCenterIds.includes(memberCostCenterId)
  );
}

export const canView = canViewChecklistRecord;
export const canEdit = canEditChecklistRecord;
export const canManageTeam = canManageChecklistTeam;
export const canManageTeamMembers = canManageChecklistMembers;
export const canManageInstance = canEditChecklistRecord;
export const canMoveTaskKanban = canMoveChecklistKanbanRecord;
export const canReviewChecklist = canEvaluateChecklistRecord;
export const canManageActionPlan = canEditChecklistRecord;

export function filterChecklistTeamsByScope(
  teams: ChecklistTeamListItem[],
  context: ChecklistSupervisorContext,
) {
  if (context.isAdmin) return teams;
  return teams.filter((team) => canViewChecklistTeam(context, team));
}

export function filterChecklistTemplatesByScope(
  templates: ChecklistTemplateListItem[],
  context: ChecklistSupervisorContext,
) {
  if (context.isAdmin) return templates;
  return templates.filter((template) => canViewChecklistRecord(context, template.cost_center_id));
}

export function filterChecklistInstancesByScope(
  instances: ChecklistInstanceListItem[],
  context: ChecklistSupervisorContext,
) {
  if (context.isAdmin) return instances;
  return instances.filter((instance) => canViewChecklistRecord(context, instance.cost_center_id));
}

export function filterChecklistResponsibilitiesByScope(
  responsibilities: ChecklistResponsibilityListItem[],
  context: ChecklistSupervisorContext,
) {
  if (context.isAdmin) return responsibilities;
  return responsibilities.filter((item) =>
    canViewChecklistRecord(context, item.task?.instance?.cost_center_id),
  );
}

export function filterChecklistReviewsByScope(
  reviews: ChecklistReviewListItem[],
  context: ChecklistSupervisorContext,
) {
  if (context.isAdmin) return reviews;
  return reviews.filter((review) => canViewChecklistRecord(context, review.instance?.cost_center_id));
}

export function filterChecklistFeedbacksByScope(
  feedbacks: ChecklistFeedbackListItem[],
  context: ChecklistSupervisorContext,
) {
  if (context.isAdmin) return feedbacks;
  return feedbacks.filter((feedback) => {
    if (context.userId) {
      const isDirectParticipant =
        feedback.autor_user_id === context.userId || feedback.destinatario_user_id === context.userId;
      if (isDirectParticipant) return true;
    }

    return canViewChecklistRecord(context, feedback.task?.instance?.cost_center_id);
  });
}

export function filterChecklistActionPlansByScope(
  plans: ChecklistActionPlanListItem[],
  context: ChecklistSupervisorContext,
) {
  if (context.isAdmin) return plans;
  return plans.filter((plan) => canViewChecklistActionPlan(context, plan));
}

export function filterChecklistCostCenterOptionsByScope<
  T extends {
    id: string;
  },
>(items: T[], context: ChecklistSupervisorContext) {
  if (context.isAdmin) return items;
  return items.filter((item) => context.allowedCostCenterIds.includes(item.id));
}

export function isChecklistPermissionError(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";
  const normalizedMessage = message.toLowerCase();

  return (
    code === "42501" ||
    code === "PGRST301" ||
    normalizedMessage.includes("row-level security") ||
    normalizedMessage.includes("permission denied") ||
    normalizedMessage.includes("forbidden")
  );
}

export function getChecklistPermissionMessage(action: string) {
  return `Ação não autorizada para o seu escopo atual. A permissão final continua no banco e pode ter sido bloqueada por RLS durante ${action}.`;
}

export function getChecklistModuleAccessMessage(context: ChecklistSupervisorContext) {
  if (context.isSupervisor && !context.hasScopedCostCenters) {
    return "Supervisor sem centros de custo vinculados em `internal_profile_cost_centers` não pode operar o módulo checklist.";
  }

  return "Seu perfil não possui acesso a esta área do módulo checklist.";
}

export function canUserMoveKanban(input: ChecklistKanbanAbilityInput) {
  const {
    accessContext,
    supervisorContext,
    assignedUserId,
    isActive,
    canAlterStatus,
    instanceStatus,
    costCenterId,
  } = input;

  if (canMoveChecklistKanbanRecord(supervisorContext, costCenterId)) {
    return true;
  }

  return (
    accessContext.userId === assignedUserId &&
    isActive &&
    canAlterStatus &&
    isEditableInstance(instanceStatus)
  );
}
