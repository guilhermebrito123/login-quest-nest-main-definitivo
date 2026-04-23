import { useMemo, useState } from "react";
import { RefreshCw, Save, Unlink, UserPlus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  ChecklistAccessStateCard,
  ChecklistModuleLayout,
} from "@/components/checklist/ChecklistModuleLayout";
import {
  AssignmentList,
  EmptyState,
  EntityTable,
  FilterBar,
  FormDrawer,
  PanelToggleButton,
  SectionCard,
  SidePanel,
  StatusBadge,
} from "@/components/checklist/ChecklistMvp";
import { ChecklistField } from "@/components/checklist/ChecklistField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  canManageChecklistMembers,
  canManageChecklistTeam,
  canManageChecklistTeamCostCenters,
  canManageChecklistTeams,
  canViewChecklistTeams,
  filterChecklistCostCenterOptionsByScope,
  filterChecklistTeamsByScope,
  getChecklistAuthUidRequiredMessage,
  getChecklistPermissionMessage,
  isChecklistAuthUidRequiredError,
  isChecklistPermissionError,
} from "@/lib/checklist-module";
import {
  checklistQueryKeys,
  useChecklistCostCenters,
  useChecklistSupervisorScope,
  useChecklistTeamMembers,
  useChecklistTeams,
  useEligibleChecklistCollaborators,
} from "@/modules/checklist/hooks";
import { checklistTeamMembersService, checklistTeamsService } from "@/modules/checklist/services";

type EquipeEscopo = "global_admin" | "cost_center";

type TeamFormState = {
  nome: string;
  descricao: string;
  escopo: EquipeEscopo;
  ativo: boolean;
  cost_center_id: string;
};

const initialForm: TeamFormState = {
  nome: "",
  descricao: "",
  escopo: "cost_center",
  ativo: true,
  cost_center_id: "",
};

const escopoLabels: Record<EquipeEscopo, string> = {
  cost_center: "Centro de custo",
  global_admin: "Global administrativo",
};

export default function ChecklistTeamsPage() {
  const queryClient = useQueryClient();
  const { supervisorContext } = useChecklistSupervisorScope();
  const canManagePage = canManageChecklistTeams(supervisorContext);
  const isAdmin = supervisorContext.isAdmin;

  const {
    data: teams = [],
    isLoading: loadingTeams,
    error: teamsError,
    refetch: refetchTeams,
  } = useChecklistTeams();
  const { data: costCenters = [], error: costCentersError } = useChecklistCostCenters();

  const [search, setSearch] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [editingTeamId, setEditingTeamId] = useState("");
  const [form, setForm] = useState<TeamFormState>(initialForm);
  const [selectedCostCenterId, setSelectedCostCenterId] = useState("");
  const [selectedMemberCostCenterId, setSelectedMemberCostCenterId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const [linking, setLinking] = useState(false);
  const [savingMember, setSavingMember] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const scopedTeams = useMemo(
    () => filterChecklistTeamsByScope(teams, supervisorContext),
    [supervisorContext, teams],
  );
  const selectedTeam = scopedTeams.find((team) => team.id === selectedTeamId) ?? scopedTeams[0] ?? null;
  const editingTeam = scopedTeams.find((team) => team.id === editingTeamId) ?? null;
  const canEditSelectedTeam = selectedTeam ? canManageChecklistTeam(supervisorContext, selectedTeam) : false;
  const canManageSelectedTeamLinks = selectedTeam
    ? canManageChecklistTeamCostCenters(supervisorContext, selectedTeam)
    : false;
  const canEditCurrentForm = editingTeamId ? !!editingTeam && canManageChecklistTeam(supervisorContext, editingTeam) : canManagePage;
  const editingPrimaryCostCenterLink = editingTeam?.cost_centers[0] ?? null;
  const canReplacePrimaryCostCenter = !editingTeamId || (editingTeam?.cost_centers.length ?? 0) <= 1;

  const visibleCostCenters = useMemo(
    () => filterChecklistCostCenterOptionsByScope(costCenters, supervisorContext),
    [costCenters, supervisorContext],
  );

  const teamId = selectedTeam?.id ?? "";
  const selectedTeamCostCenterIds = new Set(
    (selectedTeam?.cost_centers ?? []).map((item) => item.cost_center_id),
  );
  const teamLinkedCostCenters = visibleCostCenters.filter((item) =>
    selectedTeamCostCenterIds.has(item.id),
  );
  const selectedMemberScopeId = selectedTeamCostCenterIds.has(selectedMemberCostCenterId)
    ? selectedMemberCostCenterId
    : teamLinkedCostCenters[0]?.id ?? "";

  const {
    data: members = [],
    error: membersError,
  } = useChecklistTeamMembers(teamId, selectedMemberScopeId || undefined);
  const {
    data: eligibleUsers = [],
    error: eligibleUsersError,
  } = useEligibleChecklistCollaborators(selectedMemberScopeId || undefined);

  const canManageSelectedMembers =
    !!selectedTeam &&
    !!selectedMemberScopeId &&
    canManageChecklistMembers(supervisorContext, selectedTeam, selectedMemberScopeId);

  const filteredTeams = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return scopedTeams.filter((team) => {
      if (!normalized) return true;
      return (
        team.nome.toLowerCase().includes(normalized) ||
        (team.descricao ?? "").toLowerCase().includes(normalized) ||
        escopoLabels[team.escopo as EquipeEscopo].toLowerCase().includes(normalized)
      );
    });
  }, [scopedTeams, search]);

  const availableCostCenters = visibleCostCenters.filter(
    (item) =>
      !selectedTeamCostCenterIds.has(item.id) &&
      (!selectedTeam || canManageChecklistTeamCostCenters(supervisorContext, selectedTeam, item.id)),
  );

  const activeMembers = members.filter((member) => member.ativo);
  const inactiveMembers = members.filter((member) => !member.ativo);
  const availableUsers = eligibleUsers.filter(
    (user) => !activeMembers.some((member) => member.user_id === user.id),
  );

  const loadError = teamsError ?? costCentersError ?? membersError ?? eligibleUsersError;

  function resetForm() {
    setForm(initialForm);
    setEditingTeamId("");
  }

  function startEdit() {
    if (!selectedTeam || !canEditSelectedTeam) return;
    setEditingTeamId(selectedTeam.id);
    setForm({
      nome: selectedTeam.nome,
      descricao: selectedTeam.descricao ?? "",
      escopo: selectedTeam.escopo as EquipeEscopo,
      ativo: selectedTeam.ativo,
      cost_center_id: selectedTeam.cost_centers[0]?.cost_center_id ?? "",
    });
    setSelectedMemberCostCenterId(selectedTeam.cost_centers[0]?.cost_center_id ?? "");
    setSelectedUserId("");
    setSelectedTeamId(selectedTeam.id);
    setFormOpen(true);
  }

  function startCreate() {
    resetForm();
    setFormOpen(true);
  }

  async function refreshAll(syncAssignments = false) {
    await Promise.all([
      refetchTeams(),
      queryClient.invalidateQueries({
        queryKey: checklistQueryKeys.teamMembers(teamId, selectedMemberScopeId || undefined),
      }),
      queryClient.invalidateQueries({
        queryKey: checklistQueryKeys.eligibleCollaborators(selectedMemberScopeId || undefined),
      }),
      syncAssignments
        ? queryClient.invalidateQueries({ queryKey: checklistQueryKeys.instances })
        : Promise.resolve(),
      syncAssignments
        ? queryClient.invalidateQueries({ queryKey: ["checklist", "instance-tasks"] })
        : Promise.resolve(),
      syncAssignments
        ? queryClient.invalidateQueries({ queryKey: checklistQueryKeys.responsibilities })
        : Promise.resolve(),
      syncAssignments
        ? queryClient.invalidateQueries({ queryKey: checklistQueryKeys.archivedResponsibilities })
        : Promise.resolve(),
      syncAssignments
        ? queryClient.invalidateQueries({ queryKey: ["checklist", "responsibilities", "history"] })
        : Promise.resolve(),
    ]);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!supervisorContext.userId || !canEditCurrentForm) {
      toast.error(getChecklistPermissionMessage("salvar a equipe"));
      return;
    }

    if (!form.nome.trim()) {
      toast.error("Informe o nome da equipe.");
      return;
    }

    if (form.escopo === "cost_center" && !form.cost_center_id) {
      toast.error("Selecione o centro de custo principal da equipe.");
      return;
    }

    try {
      setSaving(true);

      if (editingTeamId) {
        await checklistTeamsService.update(editingTeamId, {
          nome: form.nome.trim(),
          descricao: form.descricao.trim() || null,
          escopo: form.escopo,
          ativo: form.ativo,
        });

        if (form.escopo === "cost_center" && form.cost_center_id) {
          if (!editingPrimaryCostCenterLink) {
            await checklistTeamsService.linkCostCenter(editingTeamId, form.cost_center_id);
          } else if (
            editingTeam?.cost_centers.length === 1 &&
            editingPrimaryCostCenterLink.cost_center_id !== form.cost_center_id
          ) {
            await checklistTeamsService.unlinkCostCenter(editingPrimaryCostCenterLink.id);
            await checklistTeamsService.linkCostCenter(editingTeamId, form.cost_center_id);
          } else if (
            editingTeam?.cost_centers.length > 1 &&
            !selectedTeamCostCenterIds.has(form.cost_center_id)
          ) {
            await checklistTeamsService.linkCostCenter(editingTeamId, form.cost_center_id);
          }
        }

        toast.success("Equipe atualizada.");
      } else {
        const created = await checklistTeamsService.create({
          nome: form.nome.trim(),
          descricao: form.descricao.trim() || null,
          criada_por_user_id: supervisorContext.userId,
          escopo: form.escopo,
          ativo: form.ativo,
          cost_center_id: form.escopo === "cost_center" ? form.cost_center_id : null,
        });
        setSelectedTeamId(created.id);
        setSelectedMemberCostCenterId(form.cost_center_id);
        toast.success("Equipe criada.");
      }

      resetForm();
      setFormOpen(false);
      await refreshAll(true);
    } catch (error) {
      console.error("Erro ao salvar equipe:", error);
      toast.error(
        isChecklistAuthUidRequiredError(error)
          ? getChecklistAuthUidRequiredMessage()
          : isChecklistPermissionError(error)
          ? getChecklistPermissionMessage("salvar a equipe")
          : "Não foi possível salvar a equipe.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleLinkCostCenter() {
    if (!selectedTeam || !selectedCostCenterId || !canManageSelectedTeamLinks) {
      toast.error(getChecklistPermissionMessage("vincular centro de custo"));
      return;
    }

    try {
      setLinking(true);
      await checklistTeamsService.linkCostCenter(selectedTeam.id, selectedCostCenterId);
      if (!selectedMemberScopeId) {
        setSelectedMemberCostCenterId(selectedCostCenterId);
      }
      setSelectedCostCenterId("");
      await refreshAll(true);
      toast.success("Centro de custo vinculado.");
    } catch (error) {
      console.error("Erro ao vincular centro de custo:", error);
      toast.error(
        isChecklistAuthUidRequiredError(error)
          ? getChecklistAuthUidRequiredMessage()
          : isChecklistPermissionError(error)
          ? getChecklistPermissionMessage("vincular centro de custo")
          : "Não foi possível vincular o centro de custo.",
      );
    } finally {
      setLinking(false);
    }
  }

  async function handleUnlinkCostCenter(linkId: string) {
    if (
      !selectedTeam ||
      !canManageChecklistTeamCostCenters(
        supervisorContext,
        selectedTeam,
        selectedTeam.cost_centers.find((item) => item.id === linkId)?.cost_center_id,
      )
    ) {
      toast.error(getChecklistPermissionMessage("remover vínculo de centro de custo"));
      return;
    }

    try {
      setLinking(true);
      await checklistTeamsService.unlinkCostCenter(linkId);
      await refreshAll();
      toast.success("Vínculo removido.");
    } catch (error) {
      console.error("Erro ao remover vínculo:", error);
      toast.error(
        isChecklistAuthUidRequiredError(error)
          ? getChecklistAuthUidRequiredMessage()
          : isChecklistPermissionError(error)
          ? getChecklistPermissionMessage("remover vínculo de centro de custo")
          : "Não foi possível remover o vínculo.",
      );
    } finally {
      setLinking(false);
    }
  }

  async function handleAddMember() {
    if (
      !selectedTeam ||
      !selectedUserId ||
      !selectedMemberScopeId ||
      !supervisorContext.userId ||
      !canManageSelectedMembers
    ) {
      toast.error(getChecklistPermissionMessage("adicionar membro"));
      return;
    }

    try {
      setSavingMember(true);
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error(getChecklistAuthUidRequiredMessage());

      await checklistTeamMembersService.add({
        equipe_id: selectedTeam.id,
        user_id: selectedUserId,
        cost_center_id: selectedMemberScopeId,
        added_by_user_id: user.id,
      });
      setSelectedUserId("");
      await refreshAll(true);
      toast.success("Membro adicionado. Novas instâncias usarão a trigger de autoatribuição.");
    } catch (error) {
      console.error("Erro ao adicionar membro:", error);
      toast.error(
        isChecklistAuthUidRequiredError(error)
          ? getChecklistAuthUidRequiredMessage()
          : isChecklistPermissionError(error)
          ? getChecklistPermissionMessage("adicionar membro")
          : "Não foi possível adicionar o membro.",
      );
    } finally {
      setSavingMember(false);
    }
  }

  async function handleToggleMember(memberId: string, ativo: boolean) {
    if (!canManageSelectedMembers) {
      toast.error(getChecklistPermissionMessage("atualizar membro"));
      return;
    }

    try {
      setSavingMember(true);
      if (ativo) {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;
        if (!user) throw new Error(getChecklistAuthUidRequiredMessage());
      }
      await checklistTeamMembersService.setActive(memberId, ativo);
      await refreshAll(true);
      toast.success(
        ativo
          ? "Membro reativado. Responsaveis de tarefas abertas foram sincronizados."
          : "Membro desativado. Responsaveis de tarefas abertas foram sincronizados.",
      );
    } catch (error) {
      console.error("Erro ao atualizar membro:", error);
      toast.error(
        isChecklistAuthUidRequiredError(error)
          ? getChecklistAuthUidRequiredMessage()
          : isChecklistPermissionError(error)
          ? getChecklistPermissionMessage("atualizar membro")
          : "Não foi possível atualizar o membro.",
      );
    } finally {
      setSavingMember(false);
    }
  }

  return (
    <ChecklistModuleLayout
      title="Equipes"
      description="Lista operacional de equipes com vínculo de centros de custo e membros em detalhe contextual."
      currentPath="/checklists/equipes"
      canAccessPage={canViewChecklistTeams}
      actions={
        <>
          <Button variant="outline" onClick={() => void refreshAll()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
          {canManagePage ? (
            <Button onClick={startCreate}>
              <UserPlus className="mr-2 h-4 w-4" />
              Nova equipe
            </Button>
          ) : null}
        </>
      }
    >
      {loadError && isChecklistPermissionError(loadError) ? (
        <ChecklistAccessStateCard
          title="Leitura bloqueada pelo banco"
          description={getChecklistPermissionMessage("carregar equipes")}
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <SectionCard
            title="Equipes cadastradas"
            description="A equipe selecionada controla autoatribuição nas novas instâncias do checklist."
          >
            <div className="space-y-4">
              <FilterBar>
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nome, descrição ou escopo"
                />
              </FilterBar>

              <EntityTable>
                <TableHeader>
                  <TableRow>
                    <TableHead>Equipe</TableHead>
                    <TableHead>Escopo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>CCs</TableHead>
                    <TableHead>Membros</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingTeams ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Carregando equipes...
                      </TableCell>
                    </TableRow>
                  ) : filteredTeams.length ? (
                    filteredTeams.map((team) => {
                      const teamEditable = canManageChecklistTeam(supervisorContext, team);

                      return (
                        <TableRow key={team.id} className={team.id === (selectedTeam?.id ?? "") ? "bg-muted/40" : undefined}>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-medium">{team.nome}</p>
                              <p className="text-xs text-muted-foreground">{team.descricao || "Sem descrição"}</p>
                            </div>
                          </TableCell>
                          <TableCell>{escopoLabels[team.escopo as EquipeEscopo]}</TableCell>
                          <TableCell>
                            <StatusBadge variant={team.ativo ? "default" : "secondary"}>
                              {team.ativo ? "Ativa" : "Inativa"}
                            </StatusBadge>
                          </TableCell>
                          <TableCell>{team.cost_centers.length}</TableCell>
                          <TableCell>{team.members_count}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <PanelToggleButton
                                label="Detalhe"
                                onClick={() => {
                                  setSelectedTeamId(team.id);
                                  setSelectedMemberCostCenterId(team.cost_centers[0]?.cost_center_id ?? "");
                                  setSelectedUserId("");
                                  setDetailOpen(true);
                                }}
                              />
                              {canManagePage ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedTeamId(team.id);
                                    setSelectedMemberCostCenterId(team.cost_centers[0]?.cost_center_id ?? "");
                                    setSelectedUserId("");
                                    if (teamEditable) {
                                      setEditingTeamId(team.id);
                                      setForm({
                                        nome: team.nome,
                                        descricao: team.descricao ?? "",
                                        escopo: team.escopo as EquipeEscopo,
                                        ativo: team.ativo,
                                        cost_center_id: team.cost_centers[0]?.cost_center_id ?? "",
                                      });
                                      setFormOpen(true);
                                    }
                                  }}
                                  disabled={!teamEditable}
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
                      <TableCell colSpan={6} className="p-4">
                        <EmptyState title="Sem equipes" description="Nenhuma equipe encontrada." />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </EntityTable>
            </div>
          </SectionCard>

          <SidePanel
            open={!!selectedTeam && detailOpen}
            onOpenChange={setDetailOpen}
            title={selectedTeam ? selectedTeam.nome : "Detalhe da equipe"}
            description="Centros de custo, membros e ações contextuais."
          >
            {selectedTeam ? (
              <div className="space-y-6">
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge variant={selectedTeam.ativo ? "default" : "secondary"}>
                      {selectedTeam.ativo ? "Ativa" : "Inativa"}
                    </StatusBadge>
                    <StatusBadge>{escopoLabels[selectedTeam.escopo as EquipeEscopo]}</StatusBadge>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {selectedTeam.descricao || "Sem descrição cadastrada."}
                  </p>
                </div>

                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  Alteracoes nos membros ativos desta equipe atualizam automaticamente os responsaveis
                  das tarefas em instancias abertas vinculadas aos templates da equipe.
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Centros de custo vinculados</p>
                    <Badge variant="secondary">{selectedTeam.cost_centers.length}</Badge>
                  </div>

                  {selectedTeam.escopo === "cost_center" && canManageSelectedTeamLinks ? (
                    <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                      <Select value={selectedCostCenterId} onValueChange={setSelectedCostCenterId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Adicionar centro de custo" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableCostCenters.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        onClick={() => void handleLinkCostCenter()}
                        disabled={!selectedCostCenterId || linking}
                      >
                        {linking ? "Salvando..." : "Vincular"}
                      </Button>
                    </div>
                  ) : null}

                  <AssignmentList
                    emptyMessage="Nenhum centro de custo vinculado."
                    items={selectedTeam.cost_centers.map((link) => ({
                      id: link.id,
                      title: link.cost_center?.name || link.cost_center_id,
                      subtitle: link.cost_center_id,
                      actions:
                        canManageChecklistTeamCostCenters(
                          supervisorContext,
                          selectedTeam,
                          link.cost_center_id,
                        ) && selectedTeam.escopo === "cost_center" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void handleUnlinkCostCenter(link.id)}
                            disabled={linking}
                          >
                            <Unlink className="mr-2 h-4 w-4" />
                            Remover
                          </Button>
                        ) : undefined,
                    }))}
                  />
                </div>

                <div className="space-y-4">
                  <div className="grid gap-3">
                    <Select
                      value={selectedMemberScopeId}
                      onValueChange={(value) => {
                        setSelectedMemberCostCenterId(value);
                        setSelectedUserId("");
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Escopo dos membros" />
                      </SelectTrigger>
                      <SelectContent>
                        {teamLinkedCostCenters.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {canManageSelectedMembers && selectedMemberScopeId ? (
                      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Adicionar colaborador" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableUsers.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          onClick={() => void handleAddMember()}
                          disabled={!selectedUserId || savingMember}
                        >
                          <UserPlus className="mr-2 h-4 w-4" />
                          {savingMember ? "Salvando..." : "Adicionar"}
                        </Button>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                        Membros desta equipe ficam visíveis no seu escopo, mas não editáveis.
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Membros ativos</p>
                      <Badge variant="secondary">{activeMembers.length}</Badge>
                    </div>
                    <AssignmentList
                      emptyMessage="Nenhum membro ativo."
                      items={activeMembers.map((member) => ({
                        id: member.id,
                        title: member.user?.full_name || member.user_id,
                        subtitle: member.user?.email || member.cost_center_id,
                        actions: canManageSelectedMembers ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void handleToggleMember(member.id, false)}
                            disabled={savingMember}
                          >
                            Desativar
                          </Button>
                        ) : undefined,
                      }))}
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Membros inativos</p>
                      <Badge variant="outline">{inactiveMembers.length}</Badge>
                    </div>
                    <AssignmentList
                      emptyMessage="Nenhum membro inativo."
                      items={inactiveMembers.map((member) => ({
                        id: member.id,
                        title: member.user?.full_name || member.user_id,
                        subtitle: member.user?.email || member.cost_center_id,
                        actions: canManageSelectedMembers ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void handleToggleMember(member.id, true)}
                            disabled={savingMember}
                          >
                            Reativar
                          </Button>
                        ) : undefined,
                      }))}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState
                title="Selecione uma equipe"
                description="Abra uma linha da lista para visualizar centros de custo e membros."
                className="min-h-[240px]"
              />
            )}
          </SidePanel>

          <FormDrawer
            open={formOpen}
            onOpenChange={setFormOpen}
            title={editingTeamId ? "Editar equipe" : "Nova equipe"}
            description="Use o escopo correto. Para supervisor, a edição fica restrita aos centros de custo vinculados."
          >
            {canManagePage ? (
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <ChecklistField
                    label="Nome da equipe"
                    tooltip="Nome operacional exibido em templates, instâncias e planos de ação."
                  />
                  <Input
                    value={form.nome}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, nome: event.target.value }))
                    }
                    placeholder="Ex.: Equipe Limpeza Hospitalar"
                    disabled={!canEditCurrentForm}
                  />
                </div>

                {isAdmin ? (
                  <div className="space-y-2">
                    <ChecklistField
                      label="Escopo"
                      tooltip="Equipe global é administrativa; equipe de centro de custo participa do fluxo operacional."
                    />
                    <Select
                      value={form.escopo}
                      onValueChange={(value: EquipeEscopo) =>
                        setForm((current) => ({ ...current, escopo: value }))
                      }
                      disabled={!canEditCurrentForm || !canReplacePrimaryCostCenter}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o escopo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cost_center">{escopoLabels.cost_center}</SelectItem>
                        <SelectItem value="global_admin">{escopoLabels.global_admin}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="rounded-md border bg-muted/30 p-3 text-sm">
                    <p className="font-medium text-foreground">Escopo fixo</p>
                    <p className="text-muted-foreground">{escopoLabels.cost_center}</p>
                  </div>
                )}

                {form.escopo === "cost_center" ? (
                  <div className="space-y-2">
                    <ChecklistField
                      label="Centro de custo principal"
                      tooltip="Também será usado para validar os membros da equipe."
                    />
                    <Select
                      value={form.cost_center_id}
                      onValueChange={(value) =>
                        setForm((current) => ({ ...current, cost_center_id: value }))
                      }
                      disabled={!canEditCurrentForm}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o centro de custo" />
                      </SelectTrigger>
                      <SelectContent>
                        {visibleCostCenters.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {editingTeamId && !canReplacePrimaryCostCenter ? (
                      <p className="text-xs text-muted-foreground">
                        Esta equipe já possui múltiplos vínculos em `module_equipe_cost_centers`.
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="space-y-2">
                  <ChecklistField
                    label="Descrição"
                    tooltip="Texto livre para explicar quando essa equipe deve ser usada."
                  />
                  <Textarea
                    value={form.descricao}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, descricao: event.target.value }))
                    }
                    rows={4}
                    disabled={!canEditCurrentForm}
                  />
                </div>

                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">Equipe ativa</p>
                    <p className="text-xs text-muted-foreground">
                      Equipes inativas saem das novas seleções, mas preservam histórico.
                    </p>
                  </div>
                  <Switch
                    checked={form.ativo}
                    onCheckedChange={(checked) =>
                      setForm((current) => ({ ...current, ativo: checked }))
                    }
                    disabled={!canEditCurrentForm}
                  />
                </div>

                {!canEditCurrentForm ? (
                  <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    Esta equipe está visível no seu escopo, mas não é editável porque possui vínculos fora dos centros de custo que você gerencia.
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={saving || !canEditCurrentForm}>
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? "Salvando..." : editingTeamId ? "Atualizar equipe" : "Criar equipe"}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Limpar
                  </Button>
                </div>
              </form>
            ) : (
              <EmptyState
                title="Sem permissão"
                description="Edição restrita a supervisores com escopo válido e administradores."
                className="min-h-[180px]"
              />
            )}
          </FormDrawer>
        </div>
      )}
    </ChecklistModuleLayout>
  );
}
