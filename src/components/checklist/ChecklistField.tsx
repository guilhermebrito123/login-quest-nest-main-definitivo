import { Info } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type ChecklistFieldProps = {
  label: string;
  tooltip: string;
  htmlFor?: string;
};

export function ChecklistField({ label, tooltip, htmlFor }: ChecklistFieldProps) {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex h-4 w-4 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            aria-label={`Ajuda sobre ${label}`}
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-64 text-sm leading-relaxed">{tooltip}</TooltipContent>
      </Tooltip>
    </div>
  );
}
