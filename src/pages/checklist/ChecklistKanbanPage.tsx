import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  ChecklistAccessStateCard,
  ChecklistModuleLayout,
} from "@/components/checklist/ChecklistModuleLayout";
import { EmptyState, KanbanCard, SectionCard } from "@/components/checklist/ChecklistMvp";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAccessContext } from "@/hooks/useAccessContext";
import {
  canUserMoveKanban,
  canViewChecklistKanban,
  checklistTaskKanbanStatusLabels,
  filterChecklistResponsibilitiesByScope,
  getChecklistPermissionMessage,
  isChecklistPermissionError,
  kanbanBoardOrder,
  type ChecklistTaskKanbanStatus,
} from "@/lib/checklist-module";
import {
  checklistQueryKeys,
  useArchivedChecklistResponsibilities,
  useChecklistResponsibilities,
  useChecklistSupervisorScope,
} from "@/modules/checklist/hooks";
import { ChecklistKanbanStatusBadge } from "@/modules/checklist/components";
import { checklistResponsibilitiesService } from "@/modules/checklist/services";

export default function ChecklistKanbanPage() {
  const queryClient = useQueryClient();
  const { accessContext } = useAccessContext();
  const { supervisorContext } = useChecklistSupervisorScope();
  const {
    data: cards = [],
    isLoading,
    error: cardsError,
    refetch,
  } = useChecklistResponsibilities();
  const {
    data: archivedCards = [],
    error: archivedError,
    refetch: refetchArchived,
  } = useArchivedChecklistResponsibilities();
  const [updatingId, setUpdatingId] = useState("");
  const [draggingCardId, setDraggingCardId] = useState("");

  const scopedCards = useMemo(
    () => filterChecklistResponsibilitiesByScope(cards, supervisorContext),
    [cards, supervisorContext],
  );
  const scopedArchivedCards = useMemo(
    () => filterChecklistResponsibilitiesByScope(archivedCards, supervisorContext),
    [archivedCards, supervisorContext],
  );

  const groupedCards = useMemo(() => {
    return Object.fromEntries(
      kanbanBoardOrder.map((status) => [
        status,
        scopedCards.filter((card) => card.status_kanban === status),
      ]),
    ) as Record<ChecklistTaskKanbanStatus, typeof scopedCards>;
  }, [scopedCards]);

  const loadError = cardsError ?? archivedError;

  const refetchBoard = async () => {
    await Promise.all([
      refetch(),
      refetchArchived(),
      queryClient.invalidateQueries({ queryKey: checklistQueryKeys.responsibilities }),
      queryClient.invalidateQueries({ queryKey: checklistQueryKeys.archivedResponsibilities }),
    ]);
  };

  const canEditCard = (card: (typeof scopedCards)[number]) =>
    canUserMoveKanban({
      accessContext,
      supervisorContext,
      assignedUserId: card.assigned_user_id,
      isActive: card.ativo,
      canAlterStatus: card.pode_alterar_status,
      instanceStatus: card.task?.instance?.status ?? "open",
      costCenterId: card.task?.instance?.cost_center_id,
    });

  const formatDueLabel = (prazoEm?: string | null) =>
    prazoEm ? `Prazo: ${new Date(prazoEm).toLocaleString("pt-BR")}` : undefined;

  async function changeStatus(cardId: string, nextStatus: ChecklistTaskKanbanStatus) {
    const card = scopedCards.find((item) => item.id === cardId);
    if (!card || !card.task?.id || !supervisorContext.userId) return;

    if (!canEditCard(card)) {
      toast.error(getChecklistPermissionMessage("mover o kanban"));
      return;
    }

    try {
      setUpdatingId(cardId);

      const allowed = await checklistResponsibilitiesService.checkKanbanPermission(
        supervisorContext.userId,
        card.task.id,
      );

      if (!allowed) {
        await refetchBoard();
        toast.error("O banco não permite alterar esta tarefa neste momento.");
        return;
      }

      await checklistResponsibilitiesService.updateKanbanStatus(cardId, nextStatus);
      await refetchBoard();
      toast.success("Status do kanban atualizado.");
    } catch (error) {
      console.error("Erro ao atualizar status do kanban:", error);
      await refetchBoard();
      toast.error(
        isChecklistPermissionError(error)
          ? getChecklistPermissionMessage("mover o kanban")
          : "Não foi possível atualizar o status da tarefa.",
      );
    } finally {
      setUpdatingId("");
    }
  }

  async function archiveCard(cardId: string) {
    const card = scopedCards.find((item) => item.id === cardId);
    if (!card) return;
    if (!["done", "closed"].includes(card.status_kanban)) {
      toast.error("Arquive apenas tarefas em `done` ou `closed`.");
      return;
    }
    if (!canEditCard(card)) {
      toast.error(getChecklistPermissionMessage("arquivar a tarefa"));
      return;
    }

    try {
      setUpdatingId(cardId);
      await checklistResponsibilitiesService.setActive(cardId, false);
      await refetchBoard();
      toast.success("Tarefa arquivada.");
    } catch (error) {
      console.error("Erro ao arquivar tarefa:", error);
      toast.error(
        isChecklistPermissionError(error)
          ? getChecklistPermissionMessage("arquivar a tarefa")
          : "Não foi possível arquivar a tarefa.",
      );
    } finally {
      setUpdatingId("");
    }
  }

  async function restoreCard(cardId: string) {
    const card = scopedArchivedCards.find((item) => item.id === cardId);
    if (!card || !canEditCard(card)) {
      toast.error(getChecklistPermissionMessage("restaurar a tarefa"));
      return;
    }

    try {
      setUpdatingId(cardId);
      await checklistResponsibilitiesService.setActive(cardId, true, "pending");
      await refetchBoard();
      toast.success("Tarefa restaurada para `pending`.");
    } catch (error) {
      console.error("Erro ao restaurar tarefa:", error);
      toast.error(
        isChecklistPermissionError(error)
          ? getChecklistPermissionMessage("restaurar a tarefa")
          : "Não foi possível restaurar a tarefa.",
      );
    } finally {
      setUpdatingId("");
    }
  }

  return (
    <ChecklistModuleLayout
      title="Kanban"
      description="Quadro por responsável com distinção explícita entre `done` e `closed`, permissão local por escopo do supervisor e fallback de erro RLS no update."
      currentPath="/checklists/kanban"
      canAccessPage={canViewChecklistKanban}
      actions={
        <Button variant="outline" onClick={() => void refetchBoard()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      }
    >
      {loadError && isChecklistPermissionError(loadError) ? (
        <ChecklistAccessStateCard
          title="Leitura bloqueada pelo banco"
          description={getChecklistPermissionMessage("carregar o kanban")}
        />
      ) : (
        <>
          <div className="hidden gap-4 overflow-x-auto pb-2 xl:flex">
            {kanbanBoardOrder.map((status) => (
              <Card
                key={status}
                className="min-h-[240px] w-[360px] min-w-[360px] shrink-0"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const cardId = event.dataTransfer.getData("text/plain");
                  if (!cardId) return;
                  void changeStatus(cardId, status);
                  setDraggingCardId("");
                }}
              >
                <CardHeader>
                  <CardTitle className="text-base">{checklistTaskKanbanStatusLabels[status]}</CardTitle>
                  <CardDescription>
                    {groupedCards[status]?.length || 0} item(ns)
                    {status === "done" ? " • concluído manualmente" : ""}
                    {status === "closed" ? " • fechado automaticamente pelo banco" : ""}
                    {draggingCardId ? " • solte aqui para mover" : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isLoading ? (
                    <div className="text-sm text-muted-foreground">Carregando...</div>
                  ) : groupedCards[status]?.length ? (
                    groupedCards[status].map((card) => {
                      const canEdit = canEditCard(card);

                      return (
                        <div
                          key={card.id}
                          className="w-full rounded-md border p-3"
                          draggable={canEdit}
                          onDragStart={(event) => {
                            if (!canEdit) return;
                            event.dataTransfer.setData("text/plain", card.id);
                            setDraggingCardId(card.id);
                          }}
                          onDragEnd={() => setDraggingCardId("")}
                        >
                          <KanbanCard
                            title={card.task?.titulo_snapshot || "-"}
                            subtitle={card.task?.instance?.titulo_snapshot || "Instância não identificada"}
                            responsible={card.assigned_user?.full_name || card.assigned_user_id}
                            dueLabel={formatDueLabel(card.task?.instance?.prazo_em)}
                            badges={
                              <>
                                <ChecklistKanbanStatusBadge status={card.status_kanban} />
                                <Badge variant="outline">Instância {card.task?.instance?.status || "-"}</Badge>
                              </>
                            }
                            actions={
                              canEdit ? (
                                <div className="flex flex-wrap gap-2">
                                  <Select
                                    value={card.status_kanban}
                                    onValueChange={(value: ChecklistTaskKanbanStatus) => void changeStatus(card.id, value)}
                                    disabled={updatingId === card.id}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {kanbanBoardOrder.map((option) => (
                                        <SelectItem key={option} value={option}>
                                          {checklistTaskKanbanStatusLabels[option]}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  {["done", "closed"].includes(card.status_kanban) ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => void archiveCard(card.id)}
                                      disabled={updatingId === card.id}
                                    >
                                      Arquivar
                                    </Button>
                                  ) : null}
                                </div>
                              ) : (
                                <div className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
                                  Edição desabilitada na UI para este card.
                                </div>
                              )
                            }
                          />
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                      Nenhuma tarefa nesta coluna.
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="space-y-4 xl:hidden">
            {kanbanBoardOrder.map((status) => (
              <SectionCard
                key={status}
                title={checklistTaskKanbanStatusLabels[status]}
                description={`${groupedCards[status]?.length || 0} item(ns)`}
              >
                {isLoading ? (
                  <div className="text-sm text-muted-foreground">Carregando...</div>
                ) : groupedCards[status]?.length ? (
                  <div className="space-y-3">
                    {groupedCards[status].map((card) => {
                      const canEdit = canEditCard(card);
                      return (
                        <KanbanCard
                          key={card.id}
                          title={card.task?.titulo_snapshot || "-"}
                          subtitle={card.task?.instance?.titulo_snapshot || "Instância não identificada"}
                          responsible={card.assigned_user?.full_name || card.assigned_user_id}
                          dueLabel={formatDueLabel(card.task?.instance?.prazo_em)}
                          badges={
                            <>
                              <ChecklistKanbanStatusBadge status={card.status_kanban} />
                              <Badge variant="outline">Instância {card.task?.instance?.status || "-"}</Badge>
                            </>
                          }
                          actions={
                            canEdit ? (
                              <div className="flex flex-wrap gap-2">
                                <Select
                                  value={card.status_kanban}
                                  onValueChange={(value: ChecklistTaskKanbanStatus) => void changeStatus(card.id, value)}
                                  disabled={updatingId === card.id}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {kanbanBoardOrder.map((option) => (
                                      <SelectItem key={option} value={option}>
                                        {checklistTaskKanbanStatusLabels[option]}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {["done", "closed"].includes(card.status_kanban) ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => void archiveCard(card.id)}
                                    disabled={updatingId === card.id}
                                  >
                                    Arquivar
                                  </Button>
                                ) : null}
                              </div>
                            ) : undefined
                          }
                        />
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState
                    title="Coluna vazia"
                    description="Nenhuma tarefa nesta coluna."
                    className="min-h-[120px]"
                  />
                )}
              </SectionCard>
            ))}
          </div>

          <SectionCard
            title="Arquivadas"
            description="Histórico removido do quadro principal. Ao restaurar, o item volta para `pending`."
          >
            <div className="space-y-3">
              {isLoading ? (
                <div className="text-sm text-muted-foreground">Carregando...</div>
              ) : scopedArchivedCards.length ? (
                scopedArchivedCards.map((card) => (
                  <KanbanCard
                    key={card.id}
                    title={card.task?.titulo_snapshot || "-"}
                    subtitle={card.task?.instance?.titulo_snapshot || "Instância não identificada"}
                    responsible={card.assigned_user?.full_name || card.assigned_user_id}
                    dueLabel={formatDueLabel(card.task?.instance?.prazo_em)}
                    badges={<ChecklistKanbanStatusBadge status={card.status_kanban} />}
                    actions={
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void restoreCard(card.id)}
                        disabled={updatingId === card.id || !canEditCard(card)}
                      >
                        Restaurar
                      </Button>
                    }
                  />
                ))
              ) : (
                <EmptyState
                  title="Sem arquivadas"
                  description="Nenhuma tarefa arquivada."
                  className="min-h-[120px]"
                />
              )}
            </div>
          </SectionCard>
        </>
      )}
    </ChecklistModuleLayout>
  );
}
