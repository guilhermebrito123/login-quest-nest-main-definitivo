import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { actionPlanClassOptions, getActionPlanClassLabel } from "@/lib/action-plans";
import { cn } from "@/lib/utils";
import type { ActionPlanNonconformityClass } from "@/modules/checklist/types";

type ActionPlanClassComboboxProps = {
  value?: ActionPlanNonconformityClass | null;
  onChange: (value: ActionPlanNonconformityClass) => void;
  placeholder?: string;
  disabled?: boolean;
};

export function ActionPlanClassCombobox({
  value,
  onChange,
  placeholder = "Selecione a classe",
  disabled = false,
}: ActionPlanClassComboboxProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className="w-full justify-between"
          disabled={disabled}
        >
          <span className="truncate text-left">
            {value ? getActionPlanClassLabel(value) : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar classe..." />
          <CommandList>
            <CommandEmpty>Nenhuma classe encontrada.</CommandEmpty>
            <CommandGroup>
              {actionPlanClassOptions.map(([optionValue, label]) => (
                <CommandItem
                  key={optionValue}
                  value={`${optionValue} ${label}`}
                  onSelect={() => onChange(optionValue)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      optionValue === value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
