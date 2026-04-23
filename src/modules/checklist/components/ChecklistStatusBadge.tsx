import { Badge } from "@/components/ui/badge";
import {
  actionPlanStatusLabels,
  checklistInstanceStatusLabels,
  checklistTaskKanbanStatusLabels,
  checklistTemplateStatusLabels,
} from "@/modules/checklist/helpers";
import type {
  ActionPlanStatus,
  ChecklistInstanceStatus,
  ChecklistTaskKanbanStatus,
  ChecklistTemplateStatus,
} from "@/modules/checklist/types";

export function ChecklistTemplateStatusBadge({ status }: { status: ChecklistTemplateStatus }) {
  return (
    <Badge variant={status === "published" ? "default" : "secondary"}>
      {checklistTemplateStatusLabels[status]}
    </Badge>
  );
}

export function ChecklistInstanceStatusBadge({ status }: { status: ChecklistInstanceStatus }) {
  const variant = status === "closed" || status === "cancelled" ? "secondary" : "outline";
  return <Badge variant={variant}>{checklistInstanceStatusLabels[status]}</Badge>;
}

export function ChecklistKanbanStatusBadge({ status }: { status: ChecklistTaskKanbanStatus }) {
  const variant =
    status === "done" ? "default" : status === "closed" ? "secondary" : "outline";
  return <Badge variant={variant}>{checklistTaskKanbanStatusLabels[status]}</Badge>;
}

export function ChecklistActionPlanStatusBadge({ status }: { status: ActionPlanStatus }) {
  return <Badge variant={status === "done" ? "default" : "outline"}>{actionPlanStatusLabels[status]}</Badge>;
}

