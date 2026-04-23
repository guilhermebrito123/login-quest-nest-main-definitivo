import type {
  ActionPlanUpdateEntry,
  ChecklistActionPlanListItem,
  ChecklistFeedbackListItem,
  ChecklistInstanceListItem,
  ChecklistInstanceTaskListItem,
  ChecklistInstanceTaskResponsibility,
  ChecklistLookupOption,
  ChecklistResponsibilityListItem,
  ChecklistReviewItemListItem,
  ChecklistReviewListItem,
  ChecklistTaskStatusHistoryListItem,
  ChecklistTeamListItem,
  ChecklistTeamMemberListItem,
  ChecklistTemplateListItem,
} from "@/modules/checklist/types";

function pickRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export function mapLookupOptions<T extends { id: string }>(
  rows: T[],
  getLabel: (row: T) => string,
  getParentId?: (row: T) => string | null | undefined,
): ChecklistLookupOption[] {
  return rows.map((row) => ({
    id: row.id,
    label: getLabel(row),
    parentId: getParentId ? getParentId(row) ?? null : null,
  }));
}

export function mapChecklistTemplate(item: any): ChecklistTemplateListItem {
  return {
    ...item,
    cost_center: pickRelation(item.cost_center),
    local: pickRelation(item.local),
    equipe: pickRelation(item.equipe),
  };
}

export function mapChecklistTeam(item: any): ChecklistTeamListItem {
  const costCenters = ((item.cost_centers ?? []) as any[]).map((link) => ({
    ...link,
    cost_center: pickRelation(link.cost_center),
  }));

  return {
    ...item,
    cost_centers: costCenters,
    members_count: Number(item.members_count ?? 0),
  };
}

export function mapChecklistTeamMember(item: any): ChecklistTeamMemberListItem {
  return {
    ...item,
    user: pickRelation(item.user),
  };
}

export function mapChecklistInstance(item: any): ChecklistInstanceListItem {
  const template = pickRelation(item.template);
  const templateTeam = template ? pickRelation((template as any).equipe) : null;

  return {
    ...item,
    template: template
      ? {
          ...template,
          equipe: templateTeam,
        }
      : null,
    cost_center: pickRelation(item.cost_center),
    local: pickRelation(item.local),
    equipe: templateTeam
      ? {
          id: templateTeam.id,
          nome: templateTeam.nome,
          ativo: templateTeam.ativo,
        }
      : null,
  };
}

export function mapChecklistTaskResponsibility(item: any): ChecklistInstanceTaskResponsibility {
  return {
    ...item,
    assigned_user: pickRelation(item.assigned_user),
  };
}

export function mapChecklistInstanceTask(item: any): ChecklistInstanceTaskListItem {
  return {
    ...item,
    responsaveis: ((item.responsaveis ?? []) as any[]).map(mapChecklistTaskResponsibility),
  };
}

export function mapChecklistResponsibility(item: any): ChecklistResponsibilityListItem {
  const task = pickRelation(item.task);
  return {
    ...item,
    assigned_user: pickRelation(item.assigned_user),
    task: task
      ? {
          ...task,
          instance: pickRelation(task.instance),
        }
      : null,
  };
}

export function mapChecklistReview(item: any): ChecklistReviewListItem {
  return {
    ...item,
    instance: pickRelation(item.instance),
    reviewer: pickRelation(item.reviewer),
  };
}

export function mapChecklistReviewItem(item: any): ChecklistReviewItemListItem {
  return {
    ...item,
    task: pickRelation(item.task),
  };
}

export function mapChecklistFeedback(item: any): ChecklistFeedbackListItem {
  const task = pickRelation(item.task);
  return {
    ...item,
    autor: pickRelation(item.autor),
    destinatario: pickRelation(item.destinatario),
    task: task
      ? {
          ...task,
          instance: pickRelation(task.instance),
        }
      : null,
    avaliacao_item: pickRelation(item.avaliacao_item),
  };
}

export function mapChecklistTaskStatusHistory(item: any): ChecklistTaskStatusHistoryListItem {
  return {
    ...item,
    changed_by: pickRelation(item.changed_by),
    assigned_user: pickRelation(item.assigned_user),
    task: pickRelation(item.task),
  };
}

function mapActionPlanUpdate(item: any): ActionPlanUpdateEntry & {
  autor: ChecklistActionPlanListItem["updates"][number]["autor"];
} {
  return {
    ...(item as ActionPlanUpdateEntry),
    autor: pickRelation(item.autor),
  };
}

export function mapChecklistActionPlan(item: any): ChecklistActionPlanListItem {
  return {
    ...item,
    instance: pickRelation(item.instance),
    review: pickRelation(item.review),
    team: pickRelation(item.team),
    responsaveis: ((item.responsaveis ?? []) as any[]).map((responsavel) => ({
      ...responsavel,
      assigned_user: pickRelation(responsavel.assigned_user),
    })),
    updates: ((item.updates ?? []) as any[]).map(mapActionPlanUpdate),
  };
}
