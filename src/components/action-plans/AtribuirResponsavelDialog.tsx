import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Loader2, UserPlus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useAtribuirResponsavel, type PlanoAcaoResponsavelItem } from "@/hooks/usePlanosAcao";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type CollaboratorOption = {
  userId: string;
  fullName: string;
  email: string;
};

type AtribuirResponsavelDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planoId: string;
  costCenterId?: string | null;
  responsaveis?: PlanoAcaoResponsavelItem[];
};

async function fetchAssignableCollaborators(costCenterId: string) {
  const { data, error } = await supabase
    .from("colaborador_profiles")
    .select(`
      user_id,
      usuarios:usuarios!colaborador_profiles_user_id_fkey (
        id,
        full_name,
        email,
        role
      )
    `)
    .eq("cost_center_id", costCenterId)
    .eq("ativo", true);

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((item) => {
      const usuario = Array.isArray(item.usuarios) ? item.usuarios[0] : item.usuarios;

      if (!usuario || usuario.role !== "colaborador") {
        return null;
      }

      return {
        userId: item.user_id,
        fullName: usuario.full_name ?? usuario.email,
        email: usuario.email,
      } satisfies CollaboratorOption;
    })
    .filter((item): item is CollaboratorOption => !!item)
    .sort((left, right) => left.fullName.localeCompare(right.fullName, "pt-BR"));
}

export function AtribuirResponsavelDialog({
  open,
  onOpenChange,
  planoId,
  costCenterId,
  responsaveis = [],
}: AtribuirResponsavelDialogProps) {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const atribuirResponsavel = useAtribuirResponsavel();

  const collaboratorsQuery = useQuery({
    queryKey: ["planos-acao", "assignable-collaborators", costCenterId ?? "none"],
    queryFn: () => fetchAssignableCollaborators(costCenterId!),
    enabled: open && !!costCenterId,
  });

  const activeResponsibleIds = useMemo(
    () =>
      new Set(
        responsaveis
          .filter((responsavel) => responsavel.ativo)
          .map((responsavel) => responsavel.assigned_user_id),
      ),
    [responsaveis],
  );

  const inactiveResponsibleIds = useMemo(
    () =>
      new Set(
        responsaveis
          .filter((responsavel) => !responsavel.ativo)
          .map((responsavel) => responsavel.assigned_user_id),
      ),
    [responsaveis],
  );

  const collaboratorOptions = useMemo(
    () =>
      (collaboratorsQuery.data ?? []).filter(
        (collaborator) => !activeResponsibleIds.has(collaborator.userId),
      ),
    [activeResponsibleIds, collaboratorsQuery.data],
  );

  const selectedCollaborator =
    collaboratorOptions.find((collaborator) => collaborator.userId === selectedUserId) ?? null;
  const selectedIsInactive = selectedUserId ? inactiveResponsibleIds.has(selectedUserId) : false;

  async function handleSubmit() {
    if (!selectedUserId) {
      toast.error("Selecione um colaborador para atribuir.");
      return;
    }

    try {
      await atribuirResponsavel.mutateAsync({
        planoAcaoId: planoId,
        assignedUserId: selectedUserId,
      });

      toast.success(
        selectedIsInactive
          ? "Responsável reativado com sucesso."
          : "Responsável atribuído com sucesso.",
      );
      setSelectedUserId("");
      onOpenChange(false);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível atribuir o responsável.";
      toast.error(message);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setSelectedUserId("");
          setComboboxOpen(false);
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Atribuir responsável</DialogTitle>
          <DialogDescription>
            A lista considera apenas colaboradores ativos do mesmo centro de custo da instância.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {!costCenterId ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Não foi possível identificar o centro de custo deste plano.
            </p>
          ) : collaboratorsQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <>
              <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                  >
                    <span className="truncate text-left">
                      {selectedCollaborator
                        ? `${selectedCollaborator.fullName} • ${selectedCollaborator.email}`
                        : "Selecionar colaborador"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[420px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar colaborador..." />
                    <CommandList>
                      <CommandEmpty>Nenhum colaborador elegível encontrado.</CommandEmpty>
                      <CommandGroup>
                        {collaboratorOptions.map((collaborator) => (
                          <CommandItem
                            key={collaborator.userId}
                            value={`${collaborator.fullName} ${collaborator.email}`}
                            onSelect={() => {
                              setSelectedUserId(collaborator.userId);
                              setComboboxOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                collaborator.userId === selectedUserId
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                            <div className="min-w-0">
                              <p className="truncate">{collaborator.fullName}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {collaborator.email}
                                {inactiveResponsibleIds.has(collaborator.userId)
                                  ? " • vínculo inativo"
                                  : ""}
                              </p>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {!collaboratorOptions.length ? (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Não há colaboradores elegíveis para atribuição ou reativação neste centro de custo.
                </p>
              ) : null}
            </>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={
              atribuirResponsavel.isPending ||
              !selectedUserId ||
              !costCenterId ||
              collaboratorsQuery.isLoading
            }
          >
            {atribuirResponsavel.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="mr-2 h-4 w-4" />
            )}
            {selectedIsInactive ? "Reativar" : "Atribuir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
