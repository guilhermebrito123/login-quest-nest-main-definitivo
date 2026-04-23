import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  getActionPlanStatusClasses,
  getActionPlanStatusLabel,
} from "@/lib/action-plans";
import type { ActionPlanStatus } from "@/modules/checklist/types";

type ActionPlanStatusBadgeProps = {
  status: ActionPlanStatus;
  className?: string;
};

export function ActionPlanStatusBadge({
  status,
  className,
}: ActionPlanStatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(getActionPlanStatusClasses(status), className)}
    >
      {getActionPlanStatusLabel(status)}
    </Badge>
  );
}
