import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  ChecklistAccessStateCard,
  ChecklistModuleLayout,
} from "@/components/checklist/ChecklistModuleLayout";
import { FeedbackList, FilterBar, SectionCard } from "@/components/checklist/ChecklistMvp";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAccessContext } from "@/hooks/useAccessContext";
import {
  canViewChecklistFeedbacks,
  filterChecklistFeedbacksByScope,
  getChecklistPermissionMessage,
  getFeedbackOriginLabel,
  isAutomaticFeedback,
  isChecklistPermissionError,
} from "@/lib/checklist-module";
import { checklistQueryKeys, useChecklistFeedbacks, useChecklistSupervisorScope } from "@/modules/checklist/hooks";
import { checklistFeedbacksService } from "@/modules/checklist/services";

type FeedbackFilter = "all" | "pending" | "aware" | "automatic" | "manual";

export default function ChecklistFeedbacksPage() {
  const queryClient = useQueryClient();
  const { accessContext } = useAccessContext();
  const { supervisorContext } = useChecklistSupervisorScope();
  const {
    data: feedbacks = [],
    isLoading,
    error,
    refetch,
  } = useChecklistFeedbacks();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FeedbackFilter>("all");
  const [updatingId, setUpdatingId] = useState("");

  const scopedFeedbacks = useMemo(
    () => filterChecklistFeedbacksByScope(feedbacks, supervisorContext),
    [feedbacks, supervisorContext],
  );

  const visibleFeedbacks = useMemo(() => {
    const normalized = search.trim().toLowerCase();

    return scopedFeedbacks.filter((feedback) => {
      const matchesSearch =
        !normalized ||
        feedback.mensagem.toLowerCase().includes(normalized) ||
        feedback.task?.titulo_snapshot?.toLowerCase().includes(normalized) ||
        feedback.autor?.full_name?.toLowerCase().includes(normalized) ||
        feedback.destinatario?.full_name?.toLowerCase().includes(normalized);

      const matchesFilter =
        filter === "all" ||
        (filter === "pending" && !feedback.ciente) ||
        (filter === "aware" && feedback.ciente) ||
        (filter === "automatic" && isAutomaticFeedback(feedback)) ||
        (filter === "manual" && !isAutomaticFeedback(feedback));

      return matchesSearch && matchesFilter;
    });
  }, [filter, scopedFeedbacks, search]);

  async function handleMarkAware(feedbackId: string) {
    try {
      setUpdatingId(feedbackId);
      await checklistFeedbacksService.markAware(feedbackId);
      await queryClient.invalidateQueries({ queryKey: checklistQueryKeys.feedbacks });
      toast.success("Feedback marcado como ciente.");
    } catch (loadError) {
      console.error("Erro ao marcar feedback como ciente:", loadError);
      toast.error(
        isChecklistPermissionError(loadError)
          ? getChecklistPermissionMessage("marcar o feedback como ciente")
          : "Não foi possível marcar o feedback como ciente.",
      );
    } finally {
      setUpdatingId("");
    }
  }

  return (
    <ChecklistModuleLayout
      title="Feedback"
      description="Inbox operacional com foco em leitura rápida e ciência pendente."
      currentPath="/checklists/feedbacks"
      canAccessPage={canViewChecklistFeedbacks}
      actions={
        <Button variant="outline" onClick={() => void refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      }
    >
      {error && isChecklistPermissionError(error) ? (
        <ChecklistAccessStateCard
          title="Leitura bloqueada pelo banco"
          description={getChecklistPermissionMessage("carregar feedbacks")}
        />
      ) : (
        <SectionCard
          title="Inbox de feedbacks"
          description="Use os filtros para priorizar o que ainda exige ação."
        >
          <div className="space-y-4">
            <FilterBar>
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por mensagem, tarefa, autor ou destinatário"
              />
              <Select value={filter} onValueChange={(value: FeedbackFilter) => setFilter(value)}>
                <SelectTrigger className="w-full md:w-56">
                  <SelectValue placeholder="Filtro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Sem ciência</SelectItem>
                  <SelectItem value="aware">Ciente</SelectItem>
                  <SelectItem value="automatic">Automático</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </FilterBar>

            {isLoading ? (
              <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                Carregando feedbacks...
              </div>
            ) : (
              <FeedbackList
                emptyMessage="Nenhum feedback encontrado com os filtros atuais."
                items={visibleFeedbacks.map((feedback) => {
                  const isRecipient = feedback.destinatario_user_id === accessContext.userId;

                  return {
                    id: feedback.id,
                    title: feedback.task?.titulo_snapshot || "Tarefa sem título",
                    message: feedback.mensagem,
                    unread: !feedback.ciente,
                    meta: (
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <Badge variant={feedback.ciente ? "secondary" : "default"}>
                          {feedback.ciente ? "Ciente" : "Aguardando ciência"}
                        </Badge>
                        <Badge variant="outline">{getFeedbackOriginLabel(feedback)}</Badge>
                        <span>{new Date(feedback.created_at).toLocaleString("pt-BR")}</span>
                      </div>
                    ),
                    footer: (
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="grid gap-1 text-xs text-muted-foreground">
                          <span>
                            Autor: {feedback.autor?.full_name || feedback.autor?.email || feedback.autor_user_id}
                          </span>
                          <span>
                            Destinatário:{" "}
                            {feedback.destinatario?.full_name ||
                              feedback.destinatario?.email ||
                              feedback.destinatario_user_id}
                          </span>
                        </div>
                        {!feedback.ciente && isRecipient ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void handleMarkAware(feedback.id)}
                            disabled={updatingId === feedback.id}
                          >
                            {updatingId === feedback.id ? "Atualizando..." : "Marcar como ciente"}
                          </Button>
                        ) : null}
                      </div>
                    ),
                  };
                })}
              />
            )}
          </div>
        </SectionCard>
      )}
    </ChecklistModuleLayout>
  );
}
