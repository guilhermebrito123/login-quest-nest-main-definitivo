import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, RefreshCw, Save, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  ChecklistAccessStateCard,
  ChecklistModuleLayout,
} from "@/components/checklist/ChecklistModuleLayout";
import {
  ActionPlanSummary,
  AssignmentList,
  EmptyState,
  EntityTable,
  FilterBar,
  FormDrawer,
  PanelToggleButton,
  SectionCard,
  SidePanel,
  TimelineList,
} from "@/components/checklist/ChecklistMvp";
import { ChecklistField } from "@/components/checklist/ChecklistField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import {
  actionPlanNonconformityLabels,
  actionPlanStatusLabels,
  canManageChecklistActionPlan,
  canManageActionPlans,
  canPostChecklistActionPlanUpdate,
  canViewActionPlans,
  checklistReviewDecisionLabels,
  filterChecklistActionPlansByScope,
  filterChecklistReviewsByScope,
  filterChecklistTeamsByScope,
  getChecklistPermissionMessage,
  isChecklistPermissionError,
  type ActionPlanNonconformityClass,
  type ActionPlanStatus,
} from "@/lib/checklist-module";
import {
  checklistQueryKeys,
  useChecklistActionPlans,
  useChecklistReviews,
  useChecklistSupervisorScope,
  useChecklistTeams,
} from "@/modules/checklist/hooks";
import { checklistActionPlansService } from "@/modules/checklist/services";
import { ChecklistActionPlanStatusBadge } from "@/modules/checklist/components";
import type { ChecklistActionPlanListItem } from "@/modules/checklist/types";

type PlanFormState = {
  checklist_avaliacao_id: string;
  checklist_instancia_id: string;
  equipe_responsavel_id: string;
  nao_conformidades_resumo: string;
  classe_nao_conformidade: ActionPlanNonconformityClass;
  acao_proposta: string;
  prazo_em: string;
  status: ActionPlanStatus;
};

type UpdateFormState = {
  comentario: string;
  progresso_percentual: string;
  status_novo: ActionPlanStatus;
};

const initialPlanForm: PlanFormState = {
  checklist_avaliacao_id: "",
  checklist_instancia_id: "",
  equipe_responsavel_id: "",
  nao_conformidades_resumo: "",
  classe_nao_conformidade: "organizacao",
  acao_proposta: "",
  prazo_em: "",
  status: "open",
};

const initialUpdateForm: UpdateFormState = {
  comentario: "",
  progresso_percentual: "",
  status_novo: "in_progress",
};

type PlanResponsibleManagementState = {
  canManage: boolean;
  assignables: ChecklistActionPlanAssignableUser[];
};

type ChecklistActionPlanAssignableUser = {
  user_id: string;
  nome: string;
  email: string | null;
};

async function loadPlanResponsibleManagement(
  plan: ChecklistActionPlanListItem | null,
  canManage: boolean,
): Promise<PlanResponsibleManagementState> {
  if (!plan) {
    return { canManage: false, assignables: [] };
  }

  if (!canManage || !plan.instance?.cost_center_id) {
    return { canManage, assignables: [] };
  }

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
    .eq("cost_center_id", plan.instance.cost_center_id)
    .eq("ativo", true);

  if (error) throw error;

  const assignables = (data ?? [])
    .map((item) => {
      const usuario = Array.isArray(item.usuarios) ? item.usuarios[0] : item.usuarios;
      if (!usuario || usuario.role !== "colaborador") {
        return null;
      }

      return {
        user_id: item.user_id,
        nome: usuario.full_name ?? usuario.email ?? item.user_id,
        email: usuario.email ?? null,
      } satisfies ChecklistActionPlanAssignableUser;
    })
    .filter((item): item is ChecklistActionPlanAssignableUser => !!item)
    .sort((left, right) => left.nome.localeCompare(right.nome, "pt-BR"));

  return {
    canManage,
    assignables,
  };
}

function isBlockedResponsibleAssignment(error: unknown) {
  const message =
    typeof (error as { message?: unknown })?.message === "string"
      ? String((error as { message: string }).message)
      : "";
  const code =
    typeof (error as { code?: unknown })?.code === "string"
      ? String((error as { code: string }).code)
      : "";

  return (
    message.includes("Apenas colaboradores ativos vinculados") ||
    code === "42501" ||
    message.toLowerCase().includes("row-level security")
  );
}

export default function ChecklistActionPlansPage() {
  const queryClient = useQueryClient();
  const { supervisorContext } = useChecklistSupervisorScope();
  const canManagePage = canManageActionPlans(supervisorContext);

  const {
    data: plans = [],
    isLoading,
    error: plansError,
    refetch,
  } = useChecklistActionPlans();
  const { data: reviews = [], error: reviewsError } = useChecklistReviews();
  const { data: teams = [], error: teamsError } = useChecklistTeams();

  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ActionPlanStatus | "all">("all");
  const [planForm, setPlanForm] = useState<PlanFormState>(initialPlanForm);
  const [updateForm, setUpdateForm] = useState<UpdateFormState>(initialUpdateForm);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("");
  const [savingPlan, setSavingPlan] = useState(false);
  const [savingAssignee, setSavingAssignee] = useState(false);
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [loadingResponsibleManagement, setLoadingResponsibleManagement] = useState(false);
  const [canManageResponsibleSection, setCanManageResponsibleSection] = useState<boolean | null>(null);
  const [assignableUsers, setAssignableUsers] = useState<ChecklistActionPlanAssignableUser[]>([]);
  const [responsibleManagementError, setResponsibleManagementError] = useState<string | null>(null);
  const [planFormOpen, setPlanFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const scopedPlans = useMemo(
    () => filterChecklistActionPlansByScope(plans, supervisorContext),
    [plans, supervisorContext],
  );
  const scopedReviews = useMemo(
    () => filterChecklistReviewsByScope(reviews, supervisorContext),
    [reviews, supervisorContext],
  );
  const scopedTeams = useMemo(
    () => filterChecklistTeamsByScope(teams, supervisorContext),
    [supervisorContext, teams],
  );

  useEffect(() => {
    if (!scopedPlans.length) {
      setSelectedPlanId("");
      setDetailOpen(false);
      return;
    }

    const selectedStillVisible = scopedPlans.some((plan) => plan.id === selectedPlanId);
    if (!selectedStillVisible) {
      setSelectedPlanId(scopedPlans[0].id);
    }
  }, [scopedPlans, selectedPlanId]);

  const selectedPlan = scopedPlans.find((plan) => plan.id === selectedPlanId) ?? scopedPlans[0] ?? null;
  const canManageSelectedPlan = selectedPlan
    ? canManageChecklistActionPlan(supervisorContext, selectedPlan)
    : false;
  const canPostSelectedPlanUpdate = selectedPlan
    ? canPostChecklistActionPlanUpdate(supervisorContext, selectedPlan)
    : false;
  const activeResponsibles = useMemo(
    () =>
      selectedPlan
        ? [...selectedPlan.responsaveis]
            .filter((responsavel) => responsavel.ativo)
            .sort(
              (left, right) =>
                new Date(right.atribuido_em).getTime() - new Date(left.atribuido_em).getTime(),
            )
        : [],
    [selectedPlan],
  );
  const isSelectedPlanResponsible = activeResponsibles.some(
    (responsavel) => responsavel.assigned_user_id === supervisorContext.userId,
  );
  const activeResponsibleIds = useMemo(
    () => new Set(activeResponsibles.map((responsavel) => responsavel.assigned_user_id)),
    [activeResponsibles],
  );
  const availableAssignableUsers = useMemo(
    () => assignableUsers.filter((user) => !activeResponsibleIds.has(user.user_id)),
    [activeResponsibleIds, assignableUsers],
  );
  const assignableUsersById = useMemo(
    () => new Map(assignableUsers.map((user) => [user.user_id, user])),
    [assignableUsers],
  );
  const canManagePlanResponsibles = canManageResponsibleSection === true;

  const filteredPlans = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return scopedPlans.filter((plan) => {
      const matchesSearch =
        !normalized ||
        plan.nao_conformidades_resumo.toLowerCase().includes(normalized) ||
        plan.acao_proposta.toLowerCase().includes(normalized) ||
        (plan.instance?.titulo_snapshot ?? "").toLowerCase().includes(normalized);
      const matchesStatus = statusFilter === "all" || plan.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [scopedPlans, search, statusFilter]);

  const reviewOptions = scopedReviews.filter((review) => {
    const existingPlan = scopedPlans.some((plan) => plan.checklist_avaliacao_id === review.id);
    return !existingPlan || review.id === planForm.checklist_avaliacao_id;
  });

  const loadError = plansError ?? reviewsError ?? teamsError;

  function setReviewSelection(reviewId: string) {
    const review = scopedReviews.find((item) => item.id === reviewId);
    if (!review) return;
    setPlanForm((current) => ({
      ...current,
      checklist_avaliacao_id: review.id,
      checklist_instancia_id: review.checklist_instancia_id,
    }));
  }

  function resetPlanForm() {
    setPlanForm(initialPlanForm);
  }

  function startCreatePlan() {
    resetPlanForm();
    setPlanFormOpen(true);
  }

  function openPlan(planIdToOpen: string) {
    setSelectedPlanId(planIdToOpen);
    setDetailOpen(true);
  }

  useEffect(() => {
    setSelectedAssigneeId("");

    if (!selectedPlan) {
      setCanManageResponsibleSection(null);
      setAssignableUsers([]);
      setResponsibleManagementError(null);
      setLoadingResponsibleManagement(false);
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        setLoadingResponsibleManagement(true);
        setResponsibleManagementError(null);
        const { canManage, assignables } = await loadPlanResponsibleManagement(
          selectedPlan,
          canManageSelectedPlan,
        );

        if (cancelled) return;
        setCanManageResponsibleSection(canManage);
        setAssignableUsers(assignables);
      } catch (error) {
        if (cancelled) return;

        const message =
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar permissoes e colaboradores do plano.";

        setCanManageResponsibleSection(null);
        setAssignableUsers([]);
        setResponsibleManagementError(message);
        toast.error(message);
      } finally {
        if (!cancelled) {
          setLoadingResponsibleManagement(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [canManageSelectedPlan, selectedPlan]);

  async function refreshAll() {
    await Promise.all([
      refetch(),
      queryClient.invalidateQueries({ queryKey: checklistQueryKeys.actionPlans }),
      queryClient.invalidateQueries({ queryKey: checklistQueryKeys.reviews }),
    ]);

    if (!selectedPlan) return;

    try {
      const { canManage, assignables } = await loadPlanResponsibleManagement(
        selectedPlan,
        canManageSelectedPlan,
      );
      setCanManageResponsibleSection(canManage);
      setAssignableUsers(assignables);
      setResponsibleManagementError(null);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Nao foi possivel recarregar permissoes e colaboradores do plano.";

      setCanManageResponsibleSection(null);
      setAssignableUsers([]);
      setResponsibleManagementError(message);
      toast.error(message);
    }
  }

  async function handlePlanSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!supervisorContext.userId || !canManagePage) {
      toast.error(getChecklistPermissionMessage("criar o plano de acao"));
      return;
    }

    try {
      setSavingPlan(true);
      const created = await checklistActionPlansService.create({
        checklist_instancia_id: planForm.checklist_instancia_id,
        checklist_avaliacao_id: planForm.checklist_avaliacao_id,
        equipe_responsavel_id: planForm.equipe_responsavel_id,
        nao_conformidades_resumo: planForm.nao_conformidades_resumo.trim(),
        classe_nao_conformidade: planForm.classe_nao_conformidade,
        acao_proposta: planForm.acao_proposta.trim(),
        prazo_em: new Date(planForm.prazo_em).toISOString(),
        status: planForm.status,
        criado_por_user_id: supervisorContext.userId,
      });

      setSelectedPlanId(created.id);
      setDetailOpen(true);
      await refreshAll();
      resetPlanForm();
      setPlanFormOpen(false);
      toast.success("Plano de acao criado.");
    } catch (error) {
      console.error("Erro ao criar plano de acao:", error);
      toast.error(
        isChecklistPermissionError(error)
          ? getChecklistPermissionMessage("criar o plano de acao")
          : "Nao foi possivel criar o plano de acao.",
      );
    } finally {
      setSavingPlan(false);
    }
  }

  async function handleAssignResponsible() {
    if (!selectedPlan || !selectedAssigneeId || !canManagePlanResponsibles) {
      toast.error(getChecklistPermissionMessage("atribuir responsavel"));
      return;
    }

    try {
      setSavingAssignee(true);
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Sessao expirada. Faca login novamente.");

      const { error } = await supabase.from("plano_acao_responsaveis").insert({
        plano_acao_id: selectedPlan.id,
        assigned_user_id: selectedAssigneeId,
        assigned_by_user_id: user.id,
        ativo: true,
      });

      if (error) throw error;

      setSelectedAssigneeId("");
      await refreshAll();
      toast.success("Responsavel atribuido.");
    } catch (error) {
      console.error("Erro ao atribuir responsavel:", error);
      toast.error(
        isBlockedResponsibleAssignment(error)
          ? "Esse usuario nao pode ser atribuido (precisa ser colaborador ativo do centro de custo deste plano)."
          : error instanceof Error
            ? error.message
            : "Nao foi possivel atribuir o responsavel.",
      );
    } finally {
      setSavingAssignee(false);
    }
  }

  async function handleRemoveResponsible(responsibleId: string) {
    if (!selectedPlan || !canManagePlanResponsibles) {
      toast.error(getChecklistPermissionMessage("remover responsavel"));
      return;
    }

    try {
      setSavingAssignee(true);
      const { error } = await supabase
        .from("plano_acao_responsaveis")
        .update({ ativo: false })
        .eq("id", responsibleId);

      if (error) throw error;

      await refreshAll();
      toast.success("Responsavel removido.");
    } catch (error) {
      console.error("Erro ao remover responsavel:", error);
      toast.error(
        isChecklistPermissionError(error)
          ? getChecklistPermissionMessage("remover responsavel")
          : "Nao foi possivel remover o responsavel.",
      );
    } finally {
      setSavingAssignee(false);
    }
  }

  async function handleUpdateSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!supervisorContext.userId || !selectedPlan || !canPostSelectedPlanUpdate) {
      toast.error(getChecklistPermissionMessage("registrar atualizacao"));
      return;
    }

    try {
      setSavingUpdate(true);
      await checklistActionPlansService.addUpdate({
        plano_acao_id: selectedPlan.id,
        autor_user_id: supervisorContext.userId,
        status_anterior: selectedPlan.status,
        status_novo: updateForm.status_novo,
        comentario: updateForm.comentario.trim() || null,
        progresso_percentual: updateForm.progresso_percentual ? Number(updateForm.progresso_percentual) : null,
      });
      setUpdateForm(initialUpdateForm);
      await refreshAll();
      toast.success("Atualizacao registrada.");
    } catch (error) {
      console.error("Erro ao registrar atualizacao:", error);
      toast.error(
        isChecklistPermissionError(error)
          ? getChecklistPermissionMessage("registrar atualizacao")
          : "Nao foi possivel registrar a atualizacao.",
      );
    } finally {
      setSavingUpdate(false);
    }
  }

  async function handleStatusChange(status: ActionPlanStatus) {
    if (!selectedPlan || !canManageSelectedPlan) {
      toast.error(getChecklistPermissionMessage("atualizar o status do plano"));
      return;
    }
    try {
      setUpdatingStatus(true);
      await checklistActionPlansService.updateStatus(selectedPlan.id, status);
      await refreshAll();
      toast.success("Status do plano atualizado.");
    } catch (error) {
      console.error("Erro ao atualizar status do plano:", error);
      toast.error(
        isChecklistPermissionError(error)
          ? getChecklistPermissionMessage("atualizar o status do plano")
          : "Nao foi possivel atualizar o status do plano.",
      );
    } finally {
      setUpdatingStatus(false);
    }
  }

  const detailContent = selectedPlan ? (
    <div className="space-y-6">
      <ActionPlanSummary
        title={selectedPlan.instance?.titulo_snapshot || "Plano selecionado"}
        status={<ChecklistActionPlanStatusBadge status={selectedPlan.status} />}
        meta={
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {selectedPlan.team?.nome ? <span>{selectedPlan.team.nome}</span> : null}
            {selectedPlan.prazo_em ? <span>Prazo: {new Date(selectedPlan.prazo_em).toLocaleString("pt-BR")}</span> : null}
          </div>
        }
        description={
          <div className="space-y-3">
            <p className="whitespace-pre-line">{selectedPlan.nao_conformidades_resumo}</p>
            <div className="rounded-2xl border bg-background p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Acao proposta</p>
              <p className="mt-1 whitespace-pre-line">{selectedPlan.acao_proposta}</p>
            </div>
          </div>
        }
        footer={
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">
              {actionPlanNonconformityLabels[selectedPlan.classe_nao_conformidade]}
            </Badge>
            {selectedPlan.review ? (
              <Badge variant="secondary">{checklistReviewDecisionLabels[selectedPlan.review.decisao]}</Badge>
            ) : null}
          </div>
        }
      />

      <div className="space-y-4">
        <div>
          <p className="font-medium">Responsaveis do plano</p>
          <p className="text-xs text-muted-foreground">
            Apenas colaboradores ativos do centro de custo do plano podem ser atribuidos.
          </p>
        </div>

        {loadingResponsibleManagement ? (
          <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
            Carregando permissoes e colaboradores elegiveis...
          </div>
        ) : responsibleManagementError ? (
          <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
            {responsibleManagementError}
          </div>
        ) : canManagePlanResponsibles ? (
          <div className="rounded-2xl border p-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="space-y-2">
                <ChecklistField
                  label="Adicionar responsavel"
                  tooltip="A lista vem apenas da RPC com colaboradores ativos do centro de custo do plano."
                />
                {assignableUsers.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-3 text-sm text-muted-foreground">
                    Nenhum colaborador ativo neste centro de custo.
                  </div>
                ) : availableAssignableUsers.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-3 text-sm text-muted-foreground">
                    Todos os colaboradores elegiveis ja foram atribuidos.
                  </div>
                ) : (
                  <Select value={selectedAssigneeId} onValueChange={setSelectedAssigneeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o colaborador" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableAssignableUsers.map((user) => (
                        <SelectItem key={user.user_id} value={user.user_id}>
                          {user.nome}{user.email ? ` • ${user.email}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  onClick={() => void handleAssignResponsible()}
                  disabled={!selectedAssigneeId || savingAssignee || availableAssignableUsers.length === 0}
                >
                  {savingAssignee ? "Salvando..." : "Atribuir"}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
            Apenas administradores e supervisores do centro de custo deste plano podem gerenciar responsaveis.
          </div>
        )}

        <TooltipProvider>
          <AssignmentList
            items={activeResponsibles.map((responsavel) => {
              const assignableUser = assignableUsersById.get(responsavel.assigned_user_id);
              const isLegacyResponsible =
                !loadingResponsibleManagement && !responsibleManagementError && !assignableUser;
              const responsibleName =
                responsavel.assigned_user?.full_name ??
                assignableUser?.nome ??
                responsavel.assigned_user_id;
              const responsibleEmail = responsavel.assigned_user?.email ?? assignableUser?.email ?? null;

              return {
                id: responsavel.id,
                title: responsibleName,
                subtitle: `${responsibleEmail ?? "Sem email"} • Atribuido em ${new Date(responsavel.atribuido_em).toLocaleString("pt-BR")}`,
                badge: (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>Ativo</Badge>
                    {isLegacyResponsible ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="gap-1 text-muted-foreground">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Legado
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          Este responsavel foi atribuido antes da regra atual e pode nao pertencer mais ao centro de custo do plano.
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                  </div>
                ),
                actions: canManagePlanResponsibles ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void handleRemoveResponsible(responsavel.id)}
                    disabled={savingAssignee}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remover
                  </Button>
                ) : undefined,
              };
            })}
            emptyMessage={
              isSelectedPlanResponsible
                ? "Nenhum outro responsavel visivel para o seu perfil."
                : "Nenhum responsavel vinculado a este plano."
            }
          />
        </TooltipProvider>
      </div>

      <div className="space-y-4">
        <div>
          <p className="font-medium">Atualizacoes e status</p>
          <p className="text-xs text-muted-foreground">Acompanhe o progresso e registre a evolucao do plano.</p>
        </div>

        {canManageSelectedPlan ? (
          <div className="rounded-2xl border p-4">
            <div className="space-y-2">
              <ChecklistField label="Status geral do plano" tooltip="Atualiza o status principal do plano." />
              <Select
                value={selectedPlan.status}
                onValueChange={(value: ActionPlanStatus) => void handleStatusChange(value)}
              >
                <SelectTrigger className="max-w-xs">
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(actionPlanStatusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {updatingStatus ? (
                <p className="text-xs text-muted-foreground">Atualizando status...</p>
              ) : null}
            </div>
          </div>
        ) : null}

        {canPostSelectedPlanUpdate ? (
          <form className="space-y-4 rounded-2xl border p-4" onSubmit={handleUpdateSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <ChecklistField label="Novo status" tooltip="Status registrado nesta atualizacao." />
                <Select
                  value={updateForm.status_novo}
                  onValueChange={(value: ActionPlanStatus) =>
                    setUpdateForm((current) => ({ ...current, status_novo: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(actionPlanStatusLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <ChecklistField label="Progresso (%)" tooltip="Percentual estimado de evolucao." />
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={updateForm.progresso_percentual}
                  onChange={(event) =>
                    setUpdateForm((current) => ({ ...current, progresso_percentual: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <ChecklistField label="Comentario" tooltip="Resumo do que foi feito, bloqueios ou proximo passo." />
              <Textarea
                value={updateForm.comentario}
                onChange={(event) =>
                  setUpdateForm((current) => ({ ...current, comentario: event.target.value }))
                }
                rows={4}
              />
            </div>

            <Button type="submit" disabled={savingUpdate}>
              <Save className="mr-2 h-4 w-4" />
              {savingUpdate ? "Registrando..." : "Registrar atualizacao"}
            </Button>
          </form>
        ) : (
          <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
            Apenas administradores, supervisores autorizados ou responsaveis ativos podem registrar atualizacoes neste plano.
          </div>
        )}

        <TimelineList
          items={selectedPlan.updates
            .slice()
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .map((update) => ({
              id: update.id,
              title: update.autor?.full_name || update.autor_user_id,
              meta: new Date(update.created_at).toLocaleString("pt-BR"),
              badge: (
                <div className="flex flex-wrap gap-2">
                  {update.status_novo ? <Badge>{actionPlanStatusLabels[update.status_novo]}</Badge> : null}
                  {update.progresso_percentual != null ? (
                    <Badge variant="secondary">{update.progresso_percentual}%</Badge>
                  ) : null}
                </div>
              ),
              body: update.comentario ? <p className="whitespace-pre-line">{update.comentario}</p> : undefined,
            }))}
          emptyMessage="Nenhuma atualizacao registrada para este plano."
        />
      </div>
    </div>
  ) : (
    <EmptyState
      title="Selecione um plano"
      description="Use a lista para abrir o plano e acompanhar responsaveis, status e atualizacoes."
    />
  );

  return (
    <ChecklistModuleLayout
      title="Planos de acao"
      description="Acompanhe os fluxos corretivos do checklist com lista principal, detalhe contextual e atribuicao controlada por permissao."
      currentPath="/checklists/planos-acao"
      canAccessPage={canViewActionPlans}
      actions={
        <>
          <Button variant="outline" onClick={() => void refreshAll()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
          {canManagePage ? (
            <Button onClick={startCreatePlan}>
              <Save className="mr-2 h-4 w-4" />
              Novo plano
            </Button>
          ) : null}
        </>
      }
    >
      {loadError && isChecklistPermissionError(loadError) ? (
        <ChecklistAccessStateCard
          title="Leitura bloqueada pelo banco"
          description={getChecklistPermissionMessage("carregar planos de acao")}
        />
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_420px]">
            <SectionCard
              title="Lista de planos"
              description="Filtre os planos e abra o detalhe para gerenciar responsaveis, atualizacoes e status."
              actions={selectedPlan ? <PanelToggleButton onClick={() => setDetailOpen(true)} /> : null}
            >
              <div className="space-y-4">
                <FilterBar className="items-stretch md:items-center">
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar por instancia, resumo ou acao proposta"
                    className="md:max-w-sm"
                  />
                  <Select
                    value={statusFilter}
                    onValueChange={(value: ActionPlanStatus | "all") => setStatusFilter(value)}
                  >
                    <SelectTrigger className="w-full md:w-56">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      {Object.entries(actionPlanStatusLabels).map(([value, label]) => (
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
                      <TableHead>Classe</TableHead>
                      <TableHead>Prazo</TableHead>
                      <TableHead className="text-right">Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          Carregando planos...
                        </TableCell>
                      </TableRow>
                    ) : filteredPlans.length ? (
                      filteredPlans.map((plan) => (
                        <TableRow
                          key={plan.id}
                          className={plan.id === selectedPlan?.id ? "bg-accent/40" : undefined}
                        >
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-medium">{plan.instance?.titulo_snapshot || "-"}</p>
                              <p className="text-xs text-muted-foreground">{plan.team?.nome || "Equipe nao informada"}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <ChecklistActionPlanStatusBadge status={plan.status} />
                          </TableCell>
                          <TableCell>{actionPlanNonconformityLabels[plan.classe_nao_conformidade]}</TableCell>
                          <TableCell>{new Date(plan.prazo_em).toLocaleString("pt-BR")}</TableCell>
                          <TableCell className="text-right">
                            <Button type="button" size="sm" variant="outline" onClick={() => openPlan(plan.id)}>
                              Abrir
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="p-6">
                          <EmptyState
                            title="Nenhum plano encontrado"
                            description="Ajuste os filtros ou crie um novo plano a partir de uma avaliacao."
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
              title={selectedPlan?.instance?.titulo_snapshot || "Detalhe do plano"}
              description="Resumo do plano, responsaveis, status e historico de atualizacoes."
            >
              {detailContent}
            </SidePanel>
          </div>

          <FormDrawer
            open={planFormOpen}
            onOpenChange={(open) => {
              setPlanFormOpen(open);
              if (!open) resetPlanForm();
            }}
            title="Novo plano de acao"
            description="Crie o plano a partir de uma avaliacao existente e defina equipe, prazo e tratamento."
          >
            {canManagePage ? (
              <form className="space-y-6" onSubmit={handlePlanSubmit}>
                <div className="space-y-2">
                  <ChecklistField label="Avaliacao vinculada" tooltip="Cada avaliacao pode originar no maximo um plano." />
                  <Select value={planForm.checklist_avaliacao_id} onValueChange={setReviewSelection}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a avaliacao" />
                    </SelectTrigger>
                    <SelectContent>
                      {reviewOptions.map((review) => (
                        <SelectItem key={review.id} value={review.id}>
                          {(review.instance?.titulo_snapshot || review.checklist_instancia_id) +
                            " • " +
                            checklistReviewDecisionLabels[review.decisao]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <ChecklistField label="Equipe responsavel" tooltip="Equipe que conduz o tratamento do plano." />
                  <Select
                    value={planForm.equipe_responsavel_id}
                    onValueChange={(value) =>
                      setPlanForm((current) => ({ ...current, equipe_responsavel_id: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a equipe" />
                    </SelectTrigger>
                    <SelectContent>
                      {scopedTeams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <ChecklistField label="Resumo das nao conformidades" tooltip="Problema principal que originou o plano." />
                  <Textarea
                    value={planForm.nao_conformidades_resumo}
                    onChange={(event) =>
                      setPlanForm((current) => ({ ...current, nao_conformidades_resumo: event.target.value }))
                    }
                    rows={4}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <ChecklistField label="Classe" tooltip="Classificacao principal da nao conformidade." />
                    <Select
                      value={planForm.classe_nao_conformidade}
                      onValueChange={(value: ActionPlanNonconformityClass) =>
                        setPlanForm((current) => ({ ...current, classe_nao_conformidade: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a classe" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(actionPlanNonconformityLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <ChecklistField label="Prazo" tooltip="Data limite do plano." />
                    <Input
                      type="datetime-local"
                      value={planForm.prazo_em}
                      onChange={(event) => setPlanForm((current) => ({ ...current, prazo_em: event.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <ChecklistField label="Acao proposta" tooltip="Tratamento planejado para a nao conformidade." />
                  <Textarea
                    value={planForm.acao_proposta}
                    onChange={(event) =>
                      setPlanForm((current) => ({ ...current, acao_proposta: event.target.value }))
                    }
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <ChecklistField label="Status inicial" tooltip="Estado inicial do plano." />
                  <Select
                    value={planForm.status}
                    onValueChange={(value: ActionPlanStatus) =>
                      setPlanForm((current) => ({ ...current, status: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(actionPlanStatusLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setPlanFormOpen(false);
                      resetPlanForm();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      savingPlan ||
                      !planForm.checklist_avaliacao_id ||
                      !planForm.equipe_responsavel_id ||
                      !planForm.nao_conformidades_resumo.trim() ||
                      !planForm.acao_proposta.trim() ||
                      !planForm.prazo_em
                    }
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {savingPlan ? "Salvando..." : "Criar plano"}
                  </Button>
                </div>
              </form>
            ) : (
              <EmptyState
                title="Gerenciamento indisponivel"
                description="Seu perfil atual pode consultar os planos visiveis, mas nao pode criar novos registros."
              />
            )}
          </FormDrawer>
        </>
      )}
    </ChecklistModuleLayout>
  );
}
