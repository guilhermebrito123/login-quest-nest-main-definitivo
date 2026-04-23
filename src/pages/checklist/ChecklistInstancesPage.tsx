import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Save } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "react-router-dom";

import { NovoPlanoDialog } from "@/components/action-plans/NovoPlanoDialog";
import {
  ChecklistAccessStateCard,
  ChecklistModuleLayout,
} from "@/components/checklist/ChecklistModuleLayout";
import { ChecklistField } from "@/components/checklist/ChecklistField";
import {
  EmptyState,
  EntityTable,
  FeedbackList,
  FilterBar,
  FormDrawer,
  PanelToggleButton,
  SectionCard,
  SidePanel,
  TimelineList,
} from "@/components/checklist/ChecklistMvp";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { usePlanosAcao } from "@/hooks/usePlanosAcao";
import { supabase } from "@/integrations/supabase/client";
import {
  canEditChecklistRecord,
  canEvaluateChecklistRecord,
  canManageChecklistInstances,
  canViewChecklistInstances,
  checklistInstanceStatusLabels,
  checklistReviewDecisionLabels,
  checklistTaskResponseTypeLabels,
  filterChecklistFeedbacksByScope,
  filterChecklistInstancesByScope,
  filterChecklistTemplatesByScope,
  getChecklistAuthUidRequiredMessage,
  getChecklistPermissionMessage,
  isAutomaticFeedback,
  isChecklistAuthUidRequiredError,
  isChecklistPermissionError,
  reviewResultOptions,
  type ChecklistInstanceStatus,
  type ChecklistReviewDecision,
} from "@/lib/checklist-module";
import {
  checklistQueryKeys,
  useChecklistFeedbacks,
  useChecklistInstanceTasks,
  useChecklistInstances,
  useChecklistResponsibilityHistory,
  useChecklistReview,
  useChecklistReviewItems,
  useChecklistSupervisorScope,
  useChecklistTemplates,
} from "@/modules/checklist/hooks";
import { checklistInstancesService, checklistReviewsService } from "@/modules/checklist/services";
import { ChecklistInstanceStatusBadge, ChecklistKanbanStatusBadge } from "@/modules/checklist/components";
import { toDateTimeLocal } from "@/modules/checklist/helpers";
import type { ChecklistInstanceListItem, ChecklistReviewItemListItem } from "@/modules/checklist/types";

type InstanceFormState = {
  checklist_template_id: string;
  titulo_snapshot: string;
  descricao_snapshot: string;
  observacao_snapshot: string;
  cost_center_id: string;
  local_id: string;
  agendado_para: string;
  prazo_em: string;
  status: ChecklistInstanceStatus;
  exige_plano_acao: boolean;
};

type ReviewFormState = {
  decisao: ChecklistReviewDecision;
  comentario_avaliacao: string;
  plano_acao_necessario: boolean;
};

type ReviewDraftItem = {
  id?: string;
  resultado_conformidade: "" | "conforme" | "nao_conforme" | "nao_aplicavel";
  nota: string;
  feedback: string;
};

const EMPTY_REVIEW_ITEMS: ChecklistReviewItemListItem[] = [];

const initialInstanceForm: InstanceFormState = {
  checklist_template_id: "",
  titulo_snapshot: "",
  descricao_snapshot: "",
  observacao_snapshot: "",
  cost_center_id: "",
  local_id: "",
  agendado_para: "",
  prazo_em: "",
  status: "open",
  exige_plano_acao: false,
};

const initialReviewForm: ReviewFormState = {
  decisao: "approved",
  comentario_avaliacao: "",
  plano_acao_necessario: false,
};

export default function ChecklistInstancesPage() {
  const queryClient = useQueryClient();
  const { supervisorContext } = useChecklistSupervisorScope();
  const canManagePage = canManageChecklistInstances(supervisorContext);

  const {
    data: instances = [],
    isLoading,
    error: instancesError,
    refetch,
  } = useChecklistInstances();
  const { data: templates = [], error: templatesError } = useChecklistTemplates();
  const { data: feedbacks = [], error: feedbacksError } = useChecklistFeedbacks();

  const [selectedInstanceId, setSelectedInstanceId] = useState("");
  const [editingInstanceId, setEditingInstanceId] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ChecklistInstanceStatus | "all">("all");
  const [instanceForm, setInstanceForm] = useState<InstanceFormState>(initialInstanceForm);
  const [reviewForm, setReviewForm] = useState<ReviewFormState>(initialReviewForm);
  const [reviewItemsDraft, setReviewItemsDraft] = useState<Record<string, ReviewDraftItem>>({});
  const [savingInstance, setSavingInstance] = useState(false);
  const [savingReview, setSavingReview] = useState(false);
  const [instanceFormOpen, setInstanceFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [novoPlanoDialogOpen, setNovoPlanoDialogOpen] = useState(false);
  const [novoPlanoContext, setNovoPlanoContext] = useState<{
    checklistInstanciaId: string;
    checklistAvaliacaoId: string;
    costCenterId: string | null;
  } | null>(null);

  const scopedInstances = useMemo(
    () => filterChecklistInstancesByScope(instances, supervisorContext),
    [instances, supervisorContext],
  );
  const scopedTemplates = useMemo(
    () => filterChecklistTemplatesByScope(templates, supervisorContext),
    [supervisorContext, templates],
  );
  const scopedFeedbacks = useMemo(
    () => filterChecklistFeedbacksByScope(feedbacks, supervisorContext),
    [feedbacks, supervisorContext],
  );

  useEffect(() => {
    if (!scopedInstances.length) {
      setSelectedInstanceId("");
      setDetailOpen(false);
      return;
    }

    const selectedStillVisible = scopedInstances.some((instance) => instance.id === selectedInstanceId);
    if (!selectedStillVisible) {
      setSelectedInstanceId(scopedInstances[0].id);
    }
  }, [scopedInstances, selectedInstanceId]);

  const selectedInstance =
    scopedInstances.find((item) => item.id === selectedInstanceId) ?? scopedInstances[0] ?? null;
  const canEditSelectedInstance = selectedInstance
    ? canEditChecklistRecord(supervisorContext, selectedInstance.cost_center_id)
    : false;
  const canReviewSelectedInstance = selectedInstance
    ? canEvaluateChecklistRecord(supervisorContext, selectedInstance.cost_center_id)
    : false;
  const canStartInstanceCreation = canManagePage;
  const canEditCurrentInstance =
    editingInstanceId && selectedInstance?.id === editingInstanceId
      ? canEditSelectedInstance
      : canManagePage &&
        (!instanceForm.cost_center_id || canEditChecklistRecord(supervisorContext, instanceForm.cost_center_id));
  const canSelectTemplateForInstance = editingInstanceId ? canEditCurrentInstance : canStartInstanceCreation;
  const hasScopedTemplateSelected =
    !!instanceForm.checklist_template_id && !!instanceForm.cost_center_id && canEditCurrentInstance;

  const instanceId = selectedInstance?.id ?? "";
  const {
    data: instanceTasks = [],
    error: instanceTasksError,
    refetch: refetchInstanceTasks,
  } = useChecklistInstanceTasks(instanceId);
  const {
    data: taskHistory = [],
    error: taskHistoryError,
    refetch: refetchTaskHistory,
  } = useChecklistResponsibilityHistory(instanceId);
  const { data: instanceActionPlans = [] } = usePlanosAcao(
    { checklistInstanciaId: instanceId },
    { enabled: !!instanceId },
  );
  const { data: review, error: reviewError, refetch: refetchReview } = useChecklistReview(instanceId);
  const {
    data: reviewItemsData,
    error: reviewItemsError,
    refetch: refetchReviewItems,
  } = useChecklistReviewItems(review?.id ?? "");
  const reviewItems = reviewItemsData ?? EMPTY_REVIEW_ITEMS;

  const filteredInstances = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return scopedInstances.filter((instance) => {
      const matchesSearch =
        !normalized ||
        instance.titulo_snapshot.toLowerCase().includes(normalized) ||
        (instance.template?.titulo ?? "").toLowerCase().includes(normalized) ||
        (instance.local?.nome ?? "").toLowerCase().includes(normalized);
      const matchesStatus = statusFilter === "all" || instance.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [scopedInstances, search, statusFilter]);
  const selectedTemplateForForm = useMemo(
    () =>
      scopedTemplates.find((template) => template.id === instanceForm.checklist_template_id) ?? null,
    [instanceForm.checklist_template_id, scopedTemplates],
  );

  const automaticFeedbacks = useMemo(() => {
    const taskIds = new Set(instanceTasks.map((task) => task.id));
    return scopedFeedbacks.filter(
      (feedback) =>
        !!feedback.checklist_avaliacao_item_id &&
        taskIds.has(feedback.checklist_instancia_tarefa_id) &&
        isAutomaticFeedback(feedback),
    );
  }, [instanceTasks, scopedFeedbacks]);

  const loadError =
    instancesError ??
    templatesError ??
    feedbacksError ??
    instanceTasksError ??
    taskHistoryError ??
    reviewError ??
    reviewItemsError;

  useEffect(() => {
    if (!review) {
      setReviewForm(initialReviewForm);
      setReviewItemsDraft({});
      return;
    }

    setReviewForm({
      decisao: review.decisao,
      comentario_avaliacao: review.comentario_avaliacao ?? "",
      plano_acao_necessario: review.plano_acao_necessario,
    });
  }, [review]);

  useEffect(() => {
    const nextDraft = Object.fromEntries(
      reviewItems.map((item) => [
        item.checklist_instancia_tarefa_id,
        {
          id: item.id,
          resultado_conformidade: item.resultado_conformidade as ReviewDraftItem["resultado_conformidade"],
          nota: item.nota != null ? String(item.nota) : "",
          feedback: item.feedback ?? "",
        },
      ]),
    );
    setReviewItemsDraft(nextDraft);
  }, [reviewItems]);

  function applyTemplateDefaults(templateId: string) {
    const template = scopedTemplates.find((item) => item.id === templateId);
    if (!template) return;

    setInstanceForm((current) => ({
      ...current,
      checklist_template_id: templateId,
      titulo_snapshot: template.titulo,
      descricao_snapshot: template.descricao ?? "",
      observacao_snapshot: template.observacao ?? "",
      cost_center_id: template.cost_center_id,
      local_id: template.local_id,
      exige_plano_acao: template.exige_plano_acao,
    }));
  }

  function populateInstanceForm(instance: ChecklistInstanceListItem) {
    setInstanceForm({
      checklist_template_id: instance.checklist_template_id,
      titulo_snapshot: instance.titulo_snapshot,
      descricao_snapshot: instance.descricao_snapshot ?? "",
      observacao_snapshot: instance.observacao_snapshot ?? "",
      cost_center_id: instance.cost_center_id,
      local_id: instance.local_id,
      agendado_para: toDateTimeLocal(instance.agendado_para),
      prazo_em: toDateTimeLocal(instance.prazo_em),
      status: instance.status,
      exige_plano_acao: instance.exige_plano_acao,
    });
  }

  function resetInstanceForm() {
    setInstanceForm(initialInstanceForm);
    setEditingInstanceId("");
  }

  function startCreateInstance() {
    resetInstanceForm();
    setInstanceFormOpen(true);
  }

  function startEditInstance(instance?: ChecklistInstanceListItem | null) {
    if (!instance || !canEditChecklistRecord(supervisorContext, instance.cost_center_id)) return;
    setSelectedInstanceId(instance.id);
    setEditingInstanceId(instance.id);
    populateInstanceForm(instance);
    setInstanceFormOpen(true);
  }

  function openInstance(instanceIdToOpen: string) {
    setSelectedInstanceId(instanceIdToOpen);
    setDetailOpen(true);
  }

  function updateReviewItem(taskId: string, patch: Partial<ReviewDraftItem>) {
    setReviewItemsDraft((current) => ({
      ...current,
      [taskId]: {
        resultado_conformidade: "",
        nota: "",
        feedback: "",
        ...current[taskId],
        ...patch,
      },
    }));
  }

  async function refreshAll(targetInstanceId = instanceId, targetReviewId = review?.id ?? "") {
    await Promise.all([
      refetch(),
      targetInstanceId ? refetchInstanceTasks() : Promise.resolve(),
      targetInstanceId ? refetchTaskHistory() : Promise.resolve(),
      targetInstanceId ? refetchReview() : Promise.resolve(),
      targetReviewId ? refetchReviewItems() : Promise.resolve(),
      queryClient.invalidateQueries({ queryKey: checklistQueryKeys.instances }),
      queryClient.invalidateQueries({ queryKey: ["checklist", "instance-tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["checklist", "responsibilities"] }),
      queryClient.invalidateQueries({ queryKey: ["checklist", "responsibilities", "history"] }),
      queryClient.invalidateQueries({ queryKey: ["checklist", "review"] }),
      queryClient.invalidateQueries({ queryKey: ["checklist", "review-items"] }),
      queryClient.invalidateQueries({ queryKey: checklistQueryKeys.feedbacks }),
    ]);
  }

  async function handleInstanceSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!supervisorContext.userId || !canEditCurrentInstance) {
      toast.error(getChecklistPermissionMessage("salvar a instancia"));
      return;
    }

    const template = scopedTemplates.find((item) => item.id === instanceForm.checklist_template_id);
    if (!template) {
      toast.error("Selecione um template.");
      return;
    }

    const payload = {
      titulo_snapshot: instanceForm.titulo_snapshot.trim(),
      descricao_snapshot: instanceForm.descricao_snapshot.trim() || null,
      observacao_snapshot: instanceForm.observacao_snapshot.trim() || null,
      agendado_para: instanceForm.agendado_para ? new Date(instanceForm.agendado_para).toISOString() : null,
      prazo_em: instanceForm.prazo_em ? new Date(instanceForm.prazo_em).toISOString() : null,
      status: instanceForm.status,
      exige_plano_acao: instanceForm.exige_plano_acao,
    };

    try {
      setSavingInstance(true);
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error(getChecklistAuthUidRequiredMessage());

      if (editingInstanceId) {
        await checklistInstancesService.update(editingInstanceId, payload);
        setSelectedInstanceId(editingInstanceId);
        toast.success("Instancia atualizada.");
      } else {
        const created = await checklistInstancesService.create({
          ...payload,
          checklist_template_id: template.id,
          template_versao: template.versao,
          criado_por_user_id: user.id,
          cost_center_id: instanceForm.cost_center_id,
          local_id: instanceForm.local_id,
        });
        setSelectedInstanceId(created.id);
        setDetailOpen(true);
        toast.success("Instancia criada.");
        resetInstanceForm();
        setInstanceFormOpen(false);
        await refreshAll(created.id);
        return;
      }

      resetInstanceForm();
      setInstanceFormOpen(false);
      await refreshAll();
    } catch (error) {
      console.error("Erro ao salvar instancia:", error);
      toast.error(
        isChecklistAuthUidRequiredError(error)
          ? getChecklistAuthUidRequiredMessage()
          : isChecklistPermissionError(error)
          ? getChecklistPermissionMessage("salvar a instancia")
          : "Nao foi possivel salvar a instancia.",
      );
    } finally {
      setSavingInstance(false);
    }
  }

  async function handleReviewSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!supervisorContext.userId || !instanceId || !canReviewSelectedInstance) {
      toast.error(getChecklistPermissionMessage("salvar a avaliacao"));
      return;
    }

    try {
      setSavingReview(true);
      const saved = await checklistReviewsService.upsertReview({
        reviewId: review?.id,
        instanceId,
        avaliadoPorUserId: supervisorContext.userId,
        decisao: reviewForm.decisao,
        comentarioAvaliacao: reviewForm.comentario_avaliacao.trim() || null,
        planoAcaoNecessario: reviewForm.plano_acao_necessario,
      });

      const reviewId = review?.id || saved?.id;
      if (!reviewId) {
        throw new Error("Avaliacao criada sem retorno de ID.");
      }

      const payload = instanceTasks
        .map((task) => {
          const item = reviewItemsDraft[task.id];
          if (!item?.resultado_conformidade) return null;
          return {
            id: item.id,
            checklist_avaliacao_id: reviewId,
            checklist_instancia_tarefa_id: task.id,
            resultado_conformidade: item.resultado_conformidade,
            nota: item.nota ? Number(item.nota) : null,
            feedback: item.feedback.trim() || null,
          };
        })
        .filter(Boolean) as Array<{
          id?: string;
          checklist_avaliacao_id: string;
          checklist_instancia_tarefa_id: string;
          resultado_conformidade: "conforme" | "nao_conforme" | "nao_aplicavel";
          nota: number | null;
          feedback: string | null;
        }>;

      if (payload.length) {
        await checklistReviewsService.upsertItems(reviewId, payload);
      }

      await refreshAll();

      /* auto-open do plano de acao removido
        const existingPlan = instanceActionPlans.find(
          (plan) => plan.checklist_instancia_id === instanceId,
        );

        if (existingPlan) {
          toast.info("Esta instância já possui um plano de ação vinculado.");
        } else {
          setNovoPlanoContext({
            checklistInstanciaId: instanceId,
            checklistAvaliacaoId: reviewId,
            costCenterId: selectedInstance?.cost_center_id ?? null,
          });
          setNovoPlanoDialogOpen(true);
        }
      */

      toast.success("Avaliacao salva.");
    } catch (error) {
      console.error("Erro ao salvar avaliacao:", error);
      toast.error(
        isChecklistPermissionError(error)
          ? getChecklistPermissionMessage("salvar a avaliacao")
          : "Nao foi possivel salvar a avaliacao.",
      );
    } finally {
      setSavingReview(false);
    }
  }

  const instanceDetailContent = selectedInstance ? (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-muted/20 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="font-medium">{selectedInstance.titulo_snapshot}</p>
            <p className="text-xs text-muted-foreground">
              {selectedInstance.template?.titulo || "Template nao informado"}{" "}
              {selectedInstance.local?.nome ? `• ${selectedInstance.local.nome}` : ""}
            </p>
          </div>
          <ChecklistInstanceStatusBadge status={selectedInstance.status} />
        </div>

        {(selectedInstance.descricao_snapshot || selectedInstance.observacao_snapshot) ? (
          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            {selectedInstance.descricao_snapshot ? (
              <p className="whitespace-pre-line">{selectedInstance.descricao_snapshot}</p>
            ) : null}
            {selectedInstance.observacao_snapshot ? (
              <p className="whitespace-pre-line">{selectedInstance.observacao_snapshot}</p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {selectedInstance.cost_center?.name ? (
            <Badge variant="outline">{selectedInstance.cost_center.name}</Badge>
          ) : null}
          {selectedInstance.equipe?.nome ? (
            <Badge variant="outline">Equipe do template: {selectedInstance.equipe.nome}</Badge>
          ) : null}
          {selectedInstance.prazo_em ? (
            <Badge variant="secondary">
              Prazo: {new Date(selectedInstance.prazo_em).toLocaleString("pt-BR")}
            </Badge>
          ) : null}
          {selectedInstance.exige_plano_acao ? <Badge>Exige plano de acao</Badge> : null}
        </div>

        {canEditSelectedInstance ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => startEditInstance(selectedInstance)}>
              Editar instancia
            </Button>
            {canReviewSelectedInstance &&
            (selectedInstance.exige_plano_acao || review?.plano_acao_necessario) ? (
              instanceActionPlans[0] ? (
                <Button asChild type="button" size="sm" variant="outline">
                  <Link to={`/planos-acao/${instanceActionPlans[0].id}`}>
                    Abrir plano de acao
                  </Link>
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (!review?.id) {
                      toast.error("Salve a avaliacao antes de criar o plano de acao.");
                      return;
                    }

                    setNovoPlanoContext({
                      checklistInstanciaId: selectedInstance.id,
                      checklistAvaliacaoId: review.id,
                      costCenterId: selectedInstance.cost_center_id,
                    });
                    setNovoPlanoDialogOpen(true);
                  }}
                >
                  Criar plano de acao
                </Button>
              )
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        <div>
          <p className="font-medium">Snapshot de tarefas</p>
          <p className="text-xs text-muted-foreground">Tarefas e responsaveis da instancia selecionada.</p>
        </div>

        {instanceTasks.length ? (
          <div className="space-y-3">
            {instanceTasks.map((task) => (
              <div key={task.id} className="rounded-2xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-medium">{task.titulo_snapshot}</p>
                    {task.descricao_snapshot ? (
                      <p className="text-xs text-muted-foreground">{task.descricao_snapshot}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">Ordem {task.ordem}</Badge>
                    <Badge variant="secondary">
                      {checklistTaskResponseTypeLabels[task.tipo_resposta_snapshot]}
                    </Badge>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  {task.responsaveis.length ? (
                    task.responsaveis.map((item) => (
                      <div key={item.id} className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <ChecklistKanbanStatusBadge status={item.status_kanban} />
                        <span>{item.assigned_user?.full_name || item.assigned_user_id}</span>
                        <Badge variant={item.ativo ? "secondary" : "outline"}>
                          {item.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">Sem responsaveis vinculados.</p>
        )}
      </div>
    </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Sem tarefas"
            description="Selecione uma instancia com snapshot disponivel para consultar as tarefas."
            className="min-h-[140px]"
          />
        )}
      </div>

      <div className="space-y-3">
        <div>
          <p className="font-medium">Historico de kanban</p>
          <p className="text-xs text-muted-foreground">Mudancas recentes nas tarefas desta instancia.</p>
        </div>

        <TimelineList
          items={taskHistory
            .slice()
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .map((entry) => ({
              id: entry.id,
              title: entry.task?.titulo_snapshot || entry.checklist_instancia_tarefa_id,
              meta: `${entry.changed_by?.full_name || entry.changed_by_user_id} • ${new Date(entry.created_at).toLocaleString("pt-BR")}`,
              badge: (
                <div className="flex flex-wrap items-center gap-2">
                  {entry.status_anterior ? (
                    <ChecklistKanbanStatusBadge status={entry.status_anterior} />
                  ) : (
                    <Badge variant="outline">Sem anterior</Badge>
                  )}
                  <span className="text-xs text-muted-foreground">-&gt;</span>
                  <ChecklistKanbanStatusBadge status={entry.status_novo} />
                </div>
              ),
              body: (
                <div className="space-y-2">
                  <p>Responsavel: {entry.assigned_user?.full_name || entry.assigned_user_id}</p>
                  {entry.motivo ? <p className="whitespace-pre-line">{entry.motivo}</p> : null}
                </div>
              ),
            }))}
          emptyMessage="Nenhuma mudanca de kanban registrada para esta instancia."
        />
      </div>

      <div className="space-y-4">
        <div>
          <p className="font-medium">Avaliacao</p>
          <p className="text-xs text-muted-foreground">Revisao da instancia e registro por tarefa.</p>
        </div>

        {instanceId ? (
          canReviewSelectedInstance ? (
            <form className="space-y-4 rounded-2xl border p-4" onSubmit={handleReviewSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <ChecklistField label="Decisao" tooltip="Resultado final da avaliacao." />
                  <Select
                    value={reviewForm.decisao}
                    onValueChange={(value: ChecklistReviewDecision) =>
                      setReviewForm((current) => ({ ...current, decisao: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a decisao" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(checklistReviewDecisionLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between rounded-2xl border p-3">
                  <div>
                    <p className="text-sm font-medium">Plano de acao necessario</p>
                    <p className="text-xs text-muted-foreground">Sinaliza tratamento corretivo.</p>
                  </div>
                  <Switch
                    checked={reviewForm.plano_acao_necessario}
                    onCheckedChange={(checked) =>
                      setReviewForm((current) => ({ ...current, plano_acao_necessario: checked }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <ChecklistField label="Comentario geral" tooltip="Parecer consolidado da avaliacao." />
                <Textarea
                  value={reviewForm.comentario_avaliacao}
                  onChange={(event) =>
                    setReviewForm((current) => ({ ...current, comentario_avaliacao: event.target.value }))
                  }
                  rows={4}
                />
              </div>

              <div className="space-y-3">
                {instanceTasks.map((task) => {
                  const item = reviewItemsDraft[task.id] || {
                    resultado_conformidade: "",
                    nota: "",
                    feedback: "",
                  };

                  return (
                    <div key={task.id} className="rounded-2xl border p-4">
                      <div className="mb-3 space-y-1">
                        <p className="font-medium">{task.titulo_snapshot}</p>
                        <p className="text-xs text-muted-foreground">
                          {checklistTaskResponseTypeLabels[task.tipo_resposta_snapshot]}
                        </p>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <ChecklistField label="Resultado" tooltip="Situacao avaliada da tarefa." />
                          <Select
                            value={item.resultado_conformidade || undefined}
                            onValueChange={(value: ReviewDraftItem["resultado_conformidade"]) =>
                              updateReviewItem(task.id, { resultado_conformidade: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o resultado" />
                            </SelectTrigger>
                            <SelectContent>
                              {reviewResultOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <ChecklistField label="Nota" tooltip="Pontuacao, quando aplicavel." />
                          <Input
                            type="number"
                            step="0.01"
                            value={item.nota}
                            onChange={(event) => updateReviewItem(task.id, { nota: event.target.value })}
                          />
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        <ChecklistField label="Feedback" tooltip="Observacao especifica da tarefa." />
                        <Textarea
                          value={item.feedback}
                          onChange={(event) => updateReviewItem(task.id, { feedback: event.target.value })}
                          rows={3}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <Button type="submit" disabled={savingReview}>
                <Save className="mr-2 h-4 w-4" />
                {savingReview ? "Salvando..." : review ? "Atualizar avaliacao" : "Registrar avaliacao"}
              </Button>
            </form>
          ) : review ? (
            <div className="rounded-2xl border p-4">
              <div className="flex flex-wrap gap-2">
                <Badge>{checklistReviewDecisionLabels[review.decisao]}</Badge>
                {review.plano_acao_necessario ? <Badge variant="secondary">Plano de acao necessario</Badge> : null}
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {review.comentario_avaliacao || "Sem comentario geral registrado."}
              </p>
            </div>
          ) : (
            <EmptyState
              title="Sem avaliacao"
              description="Nenhuma avaliacao registrada para esta instancia."
              className="min-h-[140px]"
            />
          )
        ) : (
          <EmptyState
            title="Selecione uma instancia"
            description="Abra uma instancia para consultar ou registrar a avaliacao."
            className="min-h-[140px]"
          />
        )}
      </div>

      <div className="space-y-3">
        <div>
          <p className="font-medium">Feedbacks automaticos</p>
          <p className="text-xs text-muted-foreground">Sinais gerados a partir da avaliacao das tarefas.</p>
        </div>

        <FeedbackList
          items={automaticFeedbacks.map((feedback) => ({
            id: feedback.id,
            title: feedback.destinatario?.full_name || feedback.destinatario_user_id,
            message: feedback.mensagem,
            unread: !feedback.ciente,
            meta: (
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">Automatico</Badge>
                <Badge variant={feedback.ciente ? "secondary" : "default"}>
                  {feedback.ciente ? "Ciente" : "Aguardando ciencia"}
                </Badge>
                <span>{new Date(feedback.created_at).toLocaleString("pt-BR")}</span>
              </div>
            ),
          }))}
          emptyMessage="Nenhum feedback automatico encontrado para esta instancia."
        />
      </div>
    </div>
  ) : (
    <EmptyState
      title="Selecione uma instancia"
      description="Use a lista para abrir a instancia e visualizar tarefas, avaliacao e historico."
    />
  );

  return (
    <ChecklistModuleLayout
      title="Instancias"
      description="Acompanhe as execucoes do checklist em um fluxo de lista principal, detalhe contextual e avaliacao da instancia."
      currentPath="/checklists/instancias"
      canAccessPage={canViewChecklistInstances}
      actions={
        <>
          <Button variant="outline" onClick={() => void refreshAll()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
          {canManagePage ? (
            <Button onClick={startCreateInstance}>
              <Save className="mr-2 h-4 w-4" />
              Nova instancia
            </Button>
          ) : null}
        </>
      }
    >
      {loadError && isChecklistPermissionError(loadError) ? (
        <ChecklistAccessStateCard
          title="Leitura bloqueada pelo banco"
          description={getChecklistPermissionMessage("carregar instancias")}
        />
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_420px]">
            <SectionCard
              title="Lista de instancias"
              description="Use os filtros para encontrar a execucao e abra o detalhe para revisar tarefas, respostas e avaliacao."
              actions={selectedInstance ? <PanelToggleButton onClick={() => setDetailOpen(true)} /> : null}
            >
              <div className="space-y-4">
                <FilterBar className="items-stretch md:items-center">
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar por titulo, template ou local"
                    className="md:max-w-sm"
                  />
                  <Select
                    value={statusFilter}
                    onValueChange={(value: ChecklistInstanceStatus | "all") => setStatusFilter(value)}
                  >
                    <SelectTrigger className="w-full md:w-56">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      {Object.entries(checklistInstanceStatusLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FilterBar>

                <EntityTable>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Instancia</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Template</TableHead>
                      <TableHead>Equipe</TableHead>
                      <TableHead className="text-right">Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          Carregando instancias...
                        </TableCell>
                      </TableRow>
                    ) : filteredInstances.length ? (
                      filteredInstances.map((instance) => {
                        const canEditInstance = canEditChecklistRecord(
                          supervisorContext,
                          instance.cost_center_id,
                        );

                        return (
                          <TableRow
                            key={instance.id}
                            className={instance.id === selectedInstance?.id ? "bg-accent/40" : undefined}
                          >
                            <TableCell>
                              <div className="space-y-1">
                                <p className="font-medium">{instance.titulo_snapshot}</p>
                                <p className="text-xs text-muted-foreground">
                                  {instance.local?.nome || "Local nao informado"}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <ChecklistInstanceStatusBadge status={instance.status} />
                            </TableCell>
                            <TableCell>{instance.template?.titulo || "-"}</TableCell>
                            <TableCell>{instance.equipe?.nome || "Derivada do template"}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button type="button" size="sm" variant="outline" onClick={() => openInstance(instance.id)}>
                                  Abrir
                                </Button>
                                {canManagePage ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => startEditInstance(instance)}
                                    disabled={!canEditInstance}
                                  >
                                    Editar
                                  </Button>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="p-6">
                          <EmptyState
                            title="Nenhuma instancia encontrada"
                            description="Ajuste os filtros ou crie uma nova instancia para iniciar a operacao."
                            className="min-h-[140px] border-0 bg-transparent p-0"
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </EntityTable>
              </div>
            </SectionCard>

            <SidePanel
              open={detailOpen}
              onOpenChange={setDetailOpen}
              title={selectedInstance?.titulo_snapshot || "Detalhe da instancia"}
              description="Resumo, tarefas, historico, respostas de revisao e feedbacks da instancia."
            >
              {instanceDetailContent}
            </SidePanel>
          </div>

          <FormDrawer
            open={instanceFormOpen}
            onOpenChange={(open) => {
              setInstanceFormOpen(open);
              if (!open) resetInstanceForm();
            }}
            title={editingInstanceId ? "Editar instancia" : "Nova instancia"}
            description="Preencha os dados principais. Tarefas e responsaveis continuam vindo do snapshot da instancia."
          >
            {canManagePage ? (
              <form className="space-y-6" onSubmit={handleInstanceSubmit}>
                <div className="space-y-2">
                  <ChecklistField label="Template" tooltip="Template base usado para gerar a instancia." />
                  <Select
                    value={instanceForm.checklist_template_id}
                    onValueChange={(value) => applyTemplateDefaults(value)}
                    disabled={!canSelectTemplateForInstance}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o template" />
                    </SelectTrigger>
                    <SelectContent>
                      {scopedTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.titulo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <ChecklistField label="Titulo snapshot" tooltip="Titulo congelado na instancia." />
                    <Input
                      value={instanceForm.titulo_snapshot}
                      onChange={(event) =>
                        setInstanceForm((current) => ({ ...current, titulo_snapshot: event.target.value }))
                      }
                      disabled={!hasScopedTemplateSelected}
                    />
                  </div>

                  <div className="rounded-2xl border bg-muted/20 p-4">
                    <p className="text-sm font-medium">Equipe responsavel</p>
                    <p className="mt-1 text-sm">
                      {selectedTemplateForForm?.equipe?.nome || "Selecione um template para ver a equipe."}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      A equipe vem apenas do template. O banco gera o snapshot das tarefas e sincroniza os
                      responsaveis automaticamente com base nos membros ativos dessa equipe.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <ChecklistField label="Descricao" tooltip="Contexto operacional desta instancia." />
                  <Textarea
                    value={instanceForm.descricao_snapshot}
                    onChange={(event) =>
                      setInstanceForm((current) => ({ ...current, descricao_snapshot: event.target.value }))
                    }
                    rows={3}
                    disabled={!hasScopedTemplateSelected}
                  />
                </div>

                <div className="space-y-2">
                  <ChecklistField label="Observacao" tooltip="Orientacoes adicionais para a execucao." />
                  <Textarea
                    value={instanceForm.observacao_snapshot}
                    onChange={(event) =>
                      setInstanceForm((current) => ({ ...current, observacao_snapshot: event.target.value }))
                    }
                    rows={3}
                    disabled={!hasScopedTemplateSelected}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <ChecklistField label="Agendado para" tooltip="Data planejada para inicio." />
                    <Input
                      type="datetime-local"
                      value={instanceForm.agendado_para}
                      onChange={(event) =>
                        setInstanceForm((current) => ({ ...current, agendado_para: event.target.value }))
                      }
                      disabled={!hasScopedTemplateSelected}
                    />
                  </div>

                  <div className="space-y-2">
                    <ChecklistField label="Prazo" tooltip="Data limite da instancia." />
                    <Input
                      type="datetime-local"
                      value={instanceForm.prazo_em}
                      onChange={(event) =>
                        setInstanceForm((current) => ({ ...current, prazo_em: event.target.value }))
                      }
                      disabled={!hasScopedTemplateSelected}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <ChecklistField label="Status" tooltip="Estado operacional da instancia." />
                    <Select
                      value={instanceForm.status}
                      onValueChange={(value: ChecklistInstanceStatus) =>
                        setInstanceForm((current) => ({ ...current, status: value }))
                      }
                      disabled={!hasScopedTemplateSelected}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o status" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(checklistInstanceStatusLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border p-4">
                    <div>
                      <p className="text-sm font-medium">Exige plano de acao</p>
                      <p className="text-xs text-muted-foreground">Ative se esta instancia pode gerar tratamento.</p>
                    </div>
                    <Switch
                      checked={instanceForm.exige_plano_acao}
                      onCheckedChange={(checked) =>
                        setInstanceForm((current) => ({ ...current, exige_plano_acao: checked }))
                      }
                      disabled={!hasScopedTemplateSelected}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setInstanceFormOpen(false);
                      resetInstanceForm();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={savingInstance}>
                    <Save className="mr-2 h-4 w-4" />
                    {savingInstance ? "Salvando..." : editingInstanceId ? "Salvar alteracoes" : "Criar instancia"}
                  </Button>
                </div>
              </form>
            ) : (
              <EmptyState
                title="Gerenciamento indisponivel"
                description="Seu perfil atual pode consultar as instancias visiveis, mas nao pode criar ou editar."
              />
            )}
          </FormDrawer>

          {novoPlanoContext ? (
            <NovoPlanoDialog
              open={novoPlanoDialogOpen}
              onOpenChange={(open) => {
                setNovoPlanoDialogOpen(open);
                if (!open) {
                  setNovoPlanoContext(null);
                }
              }}
              checklistInstanciaId={novoPlanoContext.checklistInstanciaId}
              checklistAvaliacaoId={novoPlanoContext.checklistAvaliacaoId}
              costCenterId={novoPlanoContext.costCenterId}
            />
          ) : null}
        </>
      )}
    </ChecklistModuleLayout>
  );
}
