import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  ChecklistAccessStateCard,
  ChecklistModuleLayout,
} from "@/components/checklist/ChecklistModuleLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAccessContext } from "@/hooks/useAccessContext";
import {
  canViewChecklistTasks,
  checklistInstanceStatusLabels,
  checklistTaskKanbanStatusLabels,
  checklistTaskResponseTypeLabels,
  filterChecklistFeedbacksByScope,
  filterChecklistResponsibilitiesByScope,
  formatChecklistTaskResponseValue,
  getChecklistPermissionMessage,
  getFeedbackOriginLabel,
  getResponseRenderer,
  isAutomaticFeedback,
  isChecklistPermissionError,
  isEditableInstance,
  type ChecklistResponseDraft,
  type ChecklistTaskKanbanStatus,
} from "@/lib/checklist-module";
import {
  checklistQueryKeys,
  useChecklistFeedbacks,
  useChecklistLatestResponse,
  useChecklistResponsibilities,
  useChecklistSupervisorScope,
} from "@/modules/checklist/hooks";
import { ChecklistKanbanStatusBadge, ChecklistResponseInput } from "@/modules/checklist/components";
import { checklistFeedbacksService, checklistResponsesService } from "@/modules/checklist/services";
import { buildResponsePayload } from "@/modules/checklist/helpers";

const initialResponseDraft: ChecklistResponseDraft = {
  text: "",
  number: "",
  boolean: "",
  date: "",
  datetime: "",
  time: "",
  singleSelect: "",
  multiSelect: [],
  score: "",
  comment: "",
  json: "",
};

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

export default function ChecklistTasksPage() {
  const queryClient = useQueryClient();
  const { accessContext } = useAccessContext();
  const { supervisorContext } = useChecklistSupervisorScope();
  const {
    data: responsibilities = [],
    isLoading,
    error: responsibilitiesError,
    refetch,
  } = useChecklistResponsibilities();
  const {
    data: feedbacks = [],
    error: feedbacksError,
    refetch: refetchFeedbacks,
  } = useChecklistFeedbacks();

  const [selectedResponsibilityId, setSelectedResponsibilityId] = useState("");
  const [statusFilter, setStatusFilter] = useState<ChecklistTaskKanbanStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [updatingFeedbackId, setUpdatingFeedbackId] = useState("");
  const [draft, setDraft] = useState<ChecklistResponseDraft>(initialResponseDraft);

  const scopedResponsibilities = useMemo(
    () => filterChecklistResponsibilitiesByScope(responsibilities, supervisorContext),
    [responsibilities, supervisorContext],
  );
  const scopedFeedbacks = useMemo(
    () => filterChecklistFeedbacksByScope(feedbacks, supervisorContext),
    [feedbacks, supervisorContext],
  );

  const selectedResponsibility =
    scopedResponsibilities.find((item) => item.id === selectedResponsibilityId) ??
    scopedResponsibilities[0] ??
    null;

  const selectedTask = selectedResponsibility?.task ?? null;
  const {
    data: latestResponse,
    error: latestResponseError,
    refetch: refetchResponse,
  } = useChecklistLatestResponse(selectedResponsibility?.id ?? "");

  const taskFeedbacks = useMemo(() => {
    if (!selectedTask) return [];
    return scopedFeedbacks.filter((feedback) => feedback.checklist_instancia_tarefa_id === selectedTask.id);
  }, [scopedFeedbacks, selectedTask]);

  const filteredResponsibilities = useMemo(() => {
    const normalized = search.trim().toLowerCase();

    return scopedResponsibilities.filter((item) => {
      const matchesSearch =
        !normalized ||
        item.task?.titulo_snapshot.toLowerCase().includes(normalized) ||
        item.task?.instance?.titulo_snapshot.toLowerCase().includes(normalized) ||
        item.assigned_user?.full_name?.toLowerCase().includes(normalized);

      const matchesStatus = statusFilter === "all" || item.status_kanban === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [scopedResponsibilities, search, statusFilter]);

  const isInstanceEditable =
    !!selectedTask?.instance?.status && isEditableInstance(selectedTask.instance.status);
  const canRespond =
    !!selectedResponsibility &&
    isInstanceEditable &&
    (
      (
        selectedResponsibility.assigned_user_id === accessContext.userId &&
        selectedResponsibility.ativo
      ) ||
      (accessContext.isAdmin && !!latestResponse)
    );

  const loadError = responsibilitiesError ?? feedbacksError ?? latestResponseError;

  useEffect(() => {
    if (!selectedResponsibility) {
      setDraft(initialResponseDraft);
      return;
    }

    setSelectedResponsibilityId((current) => current || selectedResponsibility.id);
  }, [selectedResponsibility]);

  useEffect(() => {
    if (!latestResponse) {
      setDraft(initialResponseDraft);
      return;
    }

    const multiSelect = Array.isArray(latestResponse.resposta_json)
      ? latestResponse.resposta_json.filter((item): item is string => typeof item === "string")
      : [];

    setDraft({
      text: latestResponse.resposta_texto || "",
      number: latestResponse.resposta_numero != null ? String(latestResponse.resposta_numero) : "",
      boolean:
        typeof latestResponse.resposta_boolean === "boolean"
          ? (String(latestResponse.resposta_boolean) as "true" | "false")
          : "",
      date: latestResponse.resposta_data || "",
      datetime: toDateTimeLocal(latestResponse.resposta_datetime),
      time: latestResponse.resposta_texto || "",
      singleSelect: latestResponse.resposta_texto || "",
      multiSelect,
      score: latestResponse.resposta_numero != null ? String(latestResponse.resposta_numero) : "",
      comment: latestResponse.comentario_resposta || "",
      json:
        latestResponse.resposta_json && !multiSelect.length
          ? JSON.stringify(latestResponse.resposta_json, null, 2)
          : "",
    });
  }, [latestResponse]);

  async function refreshAll() {
    await Promise.all([
      refetch(),
      refetchResponse(),
      refetchFeedbacks(),
      queryClient.invalidateQueries({ queryKey: checklistQueryKeys.responsibilities }),
      queryClient.invalidateQueries({ queryKey: checklistQueryKeys.feedbacks }),
    ]);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedResponsibility || !selectedTask || !accessContext.userId) return;

    if (!canRespond) {
      toast.error(getChecklistPermissionMessage("salvar a resposta"));
      return;
    }

    try {
      setSaving(true);
      const payload = buildResponsePayload(
        getResponseRenderer(selectedTask.tipo_resposta_snapshot),
        draft,
      );

      await checklistResponsesService.save({
        existingId: latestResponse?.id,
        checklist_instancia_tarefa_id: selectedTask.id,
        tarefa_responsavel_id: selectedResponsibility.id,
        respondido_por_user_id: latestResponse?.respondido_por_user_id ?? accessContext.userId,
        payload,
      });

      await refreshAll();
      toast.success("Resposta registrada.");
    } catch (error) {
      console.error("Erro ao salvar resposta:", error);
      toast.error(
        isChecklistPermissionError(error)
          ? getChecklistPermissionMessage("salvar a resposta")
          : "Não foi possível salvar a resposta. Verifique se a instância ainda está editável.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkAware(feedbackId: string) {
    try {
      setUpdatingFeedbackId(feedbackId);
      await checklistFeedbacksService.markAware(feedbackId);
      await refreshAll();
      toast.success("Feedback marcado como ciente.");
    } catch (error) {
      console.error("Erro ao marcar feedback como ciente:", error);
      toast.error(
        isChecklistPermissionError(error)
          ? getChecklistPermissionMessage("marcar o feedback como ciente")
          : "Não foi possível confirmar o feedback.",
      );
    } finally {
      setUpdatingFeedbackId("");
    }
  }

  return (
    <ChecklistModuleLayout
      title="Respostas"
      description="Execução por snapshot da instância, com renderização por `tipo_resposta_snapshot`, bloqueio quando a instância não é editável e feedback integrado ao fluxo."
      currentPath="/checklists/tarefas"
      canAccessPage={canViewChecklistTasks}
      actions={
        <Button variant="outline" onClick={() => void refreshAll()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      }
    >
      {loadError && isChecklistPermissionError(loadError) ? (
        <ChecklistAccessStateCard
          title="Leitura bloqueada pelo banco"
          description={getChecklistPermissionMessage("carregar as respostas")}
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1.2fr_1.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>Tarefas atribuídas</CardTitle>
              <CardDescription>
                Lista baseada em `checklist_tarefa_responsaveis`, sem deduzir responsáveis manualmente no frontend.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row">
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por tarefa, instância ou responsável"
                />
                <Select
                  value={statusFilter}
                  onValueChange={(value: ChecklistTaskKanbanStatus | "all") => setStatusFilter(value)}
                >
                  <SelectTrigger className="w-full md:w-56">
                    <SelectValue placeholder="Status kanban" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    {Object.entries(checklistTaskKanbanStatusLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tarefa</TableHead>
                      <TableHead>Instância</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Abrir</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          Carregando tarefas...
                        </TableCell>
                      </TableRow>
                    ) : filteredResponsibilities.length ? (
                      filteredResponsibilities.map((item) => (
                        <TableRow
                          key={item.id}
                          className={item.id === (selectedResponsibility?.id ?? "") ? "bg-accent/40" : undefined}
                        >
                          <TableCell className="font-medium">{item.task?.titulo_snapshot || "-"}</TableCell>
                          <TableCell>{item.task?.instance?.titulo_snapshot || "-"}</TableCell>
                          <TableCell>{item.assigned_user?.full_name || item.assigned_user_id}</TableCell>
                          <TableCell>
                            <ChecklistKanbanStatusBadge status={item.status_kanban} />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button type="button" size="sm" variant="outline" onClick={() => setSelectedResponsibilityId(item.id)}>
                              Abrir
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          Nenhuma tarefa encontrada.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Responder tarefa</CardTitle>
                <CardDescription>
                  {selectedTask
                    ? `${selectedTask.instance?.titulo_snapshot || "Instância"} • ${
                        checklistInstanceStatusLabels[selectedTask.instance?.status || "open"]
                      }`
                    : "Selecione uma atribuição para responder."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedTask && selectedResponsibility ? (
                  <form className="space-y-4" onSubmit={handleSubmit}>
                    <div className="rounded-md border p-4">
                      <p className="font-medium">{selectedTask.titulo_snapshot}</p>
                      {selectedTask.descricao_snapshot ? (
                        <p className="mt-1 text-sm text-muted-foreground">{selectedTask.descricao_snapshot}</p>
                      ) : null}
                      {selectedTask.ajuda_snapshot ? (
                        <p className="mt-3 rounded-md bg-muted p-3 text-sm">{selectedTask.ajuda_snapshot}</p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="secondary">
                          {checklistTaskResponseTypeLabels[selectedTask.tipo_resposta_snapshot]}
                        </Badge>
                        {selectedTask.obrigatoria ? <Badge variant="outline">Obrigatória</Badge> : null}
                        <ChecklistKanbanStatusBadge status={selectedResponsibility.status_kanban} />
                      </div>
                    </div>

                    <ChecklistResponseInput
                      responseType={selectedTask.tipo_resposta_snapshot}
                      config={selectedTask.config_json_snapshot}
                      draft={draft}
                      onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
                    />

                    {selectedTask.permite_comentario ? (
                      <div className="space-y-2">
                        <Label>Comentário</Label>
                        <Textarea
                          value={draft.comment}
                          onChange={(event) => setDraft((current) => ({ ...current, comment: event.target.value }))}
                          rows={3}
                        />
                      </div>
                    ) : null}

                    {latestResponse ? (
                      <div className="rounded-md border p-4 text-sm text-muted-foreground">
                        Última resposta registrada: {formatChecklistTaskResponseValue(latestResponse)}.
                      </div>
                    ) : null}

                    {canRespond ? (
                      <Button type="submit" disabled={saving}>
                        {saving ? "Salvando..." : latestResponse ? "Atualizar resposta" : "Registrar resposta"}
                      </Button>
                    ) : (
                      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                        Resposta bloqueada. O banco só permite inserir para o responsável ativo e,
                        em atualização, também para admin com a instância em `open` ou `in_progress`.
                      </div>
                    )}
                  </form>
                ) : (
                  <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    Selecione uma tarefa para responder.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Feedbacks da tarefa</CardTitle>
                <CardDescription>
                  Feedback automático vem da avaliação por item. Feedback manual não possui vínculo com `checklist_avaliacao_item_id`.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {taskFeedbacks.length ? (
                  taskFeedbacks.map((feedback) => {
                    const isRecipient = feedback.destinatario_user_id === accessContext.userId;

                    return (
                      <div key={feedback.id} className="rounded-md border p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant={feedback.ciente ? "secondary" : "default"}>
                              {feedback.ciente ? "Ciente" : "Aguardando ciência"}
                            </Badge>
                            <Badge variant="outline">{getFeedbackOriginLabel(feedback)}</Badge>
                            {isAutomaticFeedback(feedback) ? (
                              <Badge variant="outline">Avaliação automática</Badge>
                            ) : null}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(feedback.created_at).toLocaleString("pt-BR")}
                          </span>
                        </div>
                        <p className="mt-3 whitespace-pre-line text-sm">{feedback.mensagem}</p>
                        {!feedback.ciente && isRecipient ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="mt-3"
                            onClick={() => void handleMarkAware(feedback.id)}
                            disabled={updatingFeedbackId === feedback.id}
                          >
                            {updatingFeedbackId === feedback.id ? "Atualizando..." : "Marcar como ciente"}
                          </Button>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    Nenhum feedback para a tarefa selecionada.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </ChecklistModuleLayout>
  );
}
