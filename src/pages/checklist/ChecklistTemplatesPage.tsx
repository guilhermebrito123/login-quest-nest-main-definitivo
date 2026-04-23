import { useMemo, useState } from "react";
import { RefreshCw, Save } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  ChecklistAccessStateCard,
  ChecklistModuleLayout,
} from "@/components/checklist/ChecklistModuleLayout";
import {
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
  canEditChecklistRecord,
  canManageChecklistTemplates,
  canViewChecklistTemplates,
  checklistTaskResponseTypeLabels,
  checklistTemplateStatusLabels,
  filterChecklistCostCenterOptionsByScope,
  filterChecklistTeamsByScope,
  filterChecklistTemplatesByScope,
  getChecklistAuthUidRequiredMessage,
  getChecklistPermissionMessage,
  isChecklistAuthUidRequiredError,
  isChecklistPermissionError,
  recurrenceLabels,
  type ChecklistTaskResponseType,
  type ChecklistTemplateStatus,
  type ModuleRecurrenceType,
} from "@/lib/checklist-module";
import {
  checklistQueryKeys,
  useChecklistCostCenters,
  useChecklistLocais,
  useChecklistSupervisorScope,
  useChecklistTeams,
  useChecklistTemplateTasks,
  useChecklistTemplates,
} from "@/modules/checklist/hooks";
import { checklistTemplateTasksService, checklistTemplatesService } from "@/modules/checklist/services";
import { ChecklistTemplateStatusBadge } from "@/modules/checklist/components";
import { parseChecklistConfigOptions, toDateTimeLocal } from "@/modules/checklist/helpers";

type TemplateFormState = {
  titulo: string;
  descricao: string;
  observacao: string;
  status: ChecklistTemplateStatus;
  recorrencia: ModuleRecurrenceType;
  recorrencia_intervalo: string;
  inicia_em: string;
  encerra_em: string;
  prazo_padrao_horas: string;
  exige_plano_acao: boolean;
  ativo: boolean;
  cost_center_id: string;
  local_id: string;
  equipe_responsavel_id: string;
};

type TaskFormState = {
  titulo: string;
  descricao: string;
  ajuda: string;
  ordem: string;
  tipo_resposta: ChecklistTaskResponseType;
  obrigatoria: boolean;
  permite_comentario: boolean;
  permite_anexo: boolean;
  nota_min: string;
  nota_max: string;
  config_json: string;
};

const initialTemplateForm: TemplateFormState = {
  titulo: "",
  descricao: "",
  observacao: "",
  status: "draft",
  recorrencia: "one_time",
  recorrencia_intervalo: "1",
  inicia_em: "",
  encerra_em: "",
  prazo_padrao_horas: "",
  exige_plano_acao: false,
  ativo: true,
  cost_center_id: "",
  local_id: "",
  equipe_responsavel_id: "",
};

const initialTaskForm: TaskFormState = {
  titulo: "",
  descricao: "",
  ajuda: "",
  ordem: "1",
  tipo_resposta: "conformity_radio",
  obrigatoria: true,
  permite_comentario: true,
  permite_anexo: false,
  nota_min: "",
  nota_max: "",
  config_json: "",
};

const taskResponseTypeOptionsForTemplateForm: ChecklistTaskResponseType[] = [
  "conformity_radio",
  "text",
  "textarea",
  "boolean",
];

export default function ChecklistTemplatesPage() {
  const queryClient = useQueryClient();
  const { supervisorContext } = useChecklistSupervisorScope();
  const canManagePage = canManageChecklistTemplates(supervisorContext);

  const {
    data: templates = [],
    isLoading,
    error: templatesError,
    refetch,
  } = useChecklistTemplates();
  const { data: templateCostCenters = [], error: costCentersError } = useChecklistCostCenters();
  const { data: locais = [], error: locaisError } = useChecklistLocais();
  const { data: teams = [], error: teamsError } = useChecklistTeams();

  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [editingTemplateId, setEditingTemplateId] = useState("");
  const [editingTaskId, setEditingTaskId] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ChecklistTemplateStatus | "all">("all");
  const [templateForm, setTemplateForm] = useState<TemplateFormState>(initialTemplateForm);
  const [taskForm, setTaskForm] = useState<TaskFormState>(initialTaskForm);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [templateFormOpen, setTemplateFormOpen] = useState(false);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const scopedTemplates = useMemo(
    () => filterChecklistTemplatesByScope(templates, supervisorContext),
    [supervisorContext, templates],
  );
  const scopedTeams = useMemo(
    () => filterChecklistTeamsByScope(teams, supervisorContext),
    [supervisorContext, teams],
  );
  const visibleCostCenters = useMemo(
    () => filterChecklistCostCenterOptionsByScope(templateCostCenters, supervisorContext),
    [supervisorContext, templateCostCenters],
  );

  const selectedTemplate =
    scopedTemplates.find((item) => item.id === selectedTemplateId) ?? scopedTemplates[0] ?? null;
  const canEditSelectedTemplate = selectedTemplate
    ? canEditChecklistRecord(supervisorContext, selectedTemplate.cost_center_id)
    : false;
  const canEditCurrentTemplate =
    editingTemplateId && selectedTemplate?.id === editingTemplateId
      ? canEditSelectedTemplate
      : canManagePage;

  const templateId = selectedTemplate?.id ?? "";
  const {
    data: templateTasks = [],
    error: templateTasksError,
    refetch: refetchTasks,
  } = useChecklistTemplateTasks(templateId);

  const filteredTemplates = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return scopedTemplates.filter((template) => {
      const matchesSearch =
        !normalized ||
        template.titulo.toLowerCase().includes(normalized) ||
        (template.cost_center?.name ?? "").toLowerCase().includes(normalized) ||
        (template.local?.nome ?? "").toLowerCase().includes(normalized);

      const matchesStatus = statusFilter === "all" || template.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [scopedTemplates, search, statusFilter]);

  const filteredLocais = useMemo(() => {
    if (!templateForm.cost_center_id) return [];
    return locais.filter((item) => item.parentId === templateForm.cost_center_id);
  }, [locais, templateForm.cost_center_id]);

  const filteredTeams = useMemo(() => {
    if (!templateForm.cost_center_id) return scopedTeams;
    return scopedTeams.filter((team) =>
      team.cost_centers.some((item) => item.cost_center_id === templateForm.cost_center_id),
    );
  }, [scopedTeams, templateForm.cost_center_id]);

  const availableTeamOptions = filteredTeams.map((team) => ({
    id: team.id,
    label: team.nome,
  }));

  const selectedTeamMembersCount = scopedTeams.find(
    (team) => team.id === (templateForm.equipe_responsavel_id || selectedTemplate?.equipe_responsavel_id),
  )?.members_count;
  const isChangingResponsibleTeam =
    !!editingTemplateId &&
    !!selectedTemplate &&
    templateForm.equipe_responsavel_id !== "" &&
    templateForm.equipe_responsavel_id !== selectedTemplate.equipe_responsavel_id;

  const loadError =
    templatesError ??
    costCentersError ??
    locaisError ??
    teamsError ??
    templateTasksError;

  function resetTemplateForm() {
    setTemplateForm(initialTemplateForm);
    setEditingTemplateId("");
  }

  function resetTaskForm() {
    setTaskForm(initialTaskForm);
    setEditingTaskId("");
  }

  function startEditTemplate() {
    if (!selectedTemplate || !canEditSelectedTemplate) return;
    setEditingTemplateId(selectedTemplate.id);
    setSelectedTemplateId(selectedTemplate.id);
    setTemplateForm({
      titulo: selectedTemplate.titulo,
      descricao: selectedTemplate.descricao ?? "",
      observacao: selectedTemplate.observacao ?? "",
      status: selectedTemplate.status,
      recorrencia: selectedTemplate.recorrencia,
      recorrencia_intervalo: String(selectedTemplate.recorrencia_intervalo ?? 1),
      inicia_em: toDateTimeLocal(selectedTemplate.inicia_em),
      encerra_em: toDateTimeLocal(selectedTemplate.encerra_em),
      prazo_padrao_horas:
        selectedTemplate.prazo_padrao_horas != null ? String(selectedTemplate.prazo_padrao_horas) : "",
      exige_plano_acao: selectedTemplate.exige_plano_acao,
      ativo: selectedTemplate.ativo,
      cost_center_id: selectedTemplate.cost_center_id,
      local_id: selectedTemplate.local_id,
      equipe_responsavel_id: selectedTemplate.equipe_responsavel_id,
    });
    setTemplateFormOpen(true);
  }

  function startEditTask(task: (typeof templateTasks)[number]) {
    if (!canEditSelectedTemplate) return;
    setEditingTaskId(task.id);
    setTaskForm({
      titulo: task.titulo,
      descricao: task.descricao ?? "",
      ajuda: task.ajuda ?? "",
      ordem: String(task.ordem),
      tipo_resposta: task.tipo_resposta,
      obrigatoria: task.obrigatoria,
      permite_comentario: task.permite_comentario,
      permite_anexo: task.permite_anexo,
      nota_min: task.nota_min != null ? String(task.nota_min) : "",
      nota_max: task.nota_max != null ? String(task.nota_max) : "",
      config_json: task.config_json ? JSON.stringify(task.config_json, null, 2) : "",
    });
    setTaskFormOpen(true);
  }

  function startCreateTemplate() {
    resetTemplateForm();
    setTemplateFormOpen(true);
  }

  function startCreateTask() {
    resetTaskForm();
    setTaskFormOpen(true);
  }

  async function refreshAll(syncOpenInstances = false) {
    await Promise.all([
      refetch(),
      refetchTasks(),
      queryClient.invalidateQueries({ queryKey: checklistQueryKeys.templates }),
      queryClient.invalidateQueries({ queryKey: checklistQueryKeys.templateTasks(templateId) }),
      syncOpenInstances
        ? queryClient.invalidateQueries({ queryKey: checklistQueryKeys.instances })
        : Promise.resolve(),
      syncOpenInstances
        ? queryClient.invalidateQueries({ queryKey: ["checklist", "instance-tasks"] })
        : Promise.resolve(),
      syncOpenInstances
        ? queryClient.invalidateQueries({ queryKey: checklistQueryKeys.responsibilities })
        : Promise.resolve(),
      syncOpenInstances
        ? queryClient.invalidateQueries({ queryKey: checklistQueryKeys.archivedResponsibilities })
        : Promise.resolve(),
      syncOpenInstances
        ? queryClient.invalidateQueries({ queryKey: ["checklist", "responsibilities", "history"] })
        : Promise.resolve(),
    ]);
  }

  async function handleTemplateSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!supervisorContext.userId || !canEditCurrentTemplate) {
      toast.error(getChecklistPermissionMessage("salvar o template"));
      return;
    }

    if (
      !templateForm.cost_center_id ||
      !templateForm.local_id ||
      !templateForm.equipe_responsavel_id
    ) {
      toast.error("Preencha centro de custo, local e equipe responsável.");
      return;
    }

    const payload = {
      titulo: templateForm.titulo.trim(),
      descricao: templateForm.descricao.trim() || null,
      observacao: templateForm.observacao.trim() || null,
      status: templateForm.status,
      recorrencia: templateForm.recorrencia,
      recorrencia_intervalo: Number(templateForm.recorrencia_intervalo || 1),
      inicia_em: templateForm.inicia_em ? new Date(templateForm.inicia_em).toISOString() : null,
      encerra_em: templateForm.encerra_em ? new Date(templateForm.encerra_em).toISOString() : null,
      prazo_padrao_horas: templateForm.prazo_padrao_horas
        ? Number(templateForm.prazo_padrao_horas)
        : null,
      exige_plano_acao: templateForm.exige_plano_acao,
      ativo: templateForm.ativo,
      cost_center_id: templateForm.cost_center_id,
      local_id: templateForm.local_id,
      equipe_responsavel_id: templateForm.equipe_responsavel_id,
    };

    try {
      setSavingTemplate(true);
      const syncOpenInstances = isChangingResponsibleTeam;
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error(getChecklistAuthUidRequiredMessage());

      if (editingTemplateId) {
        await checklistTemplatesService.update(editingTemplateId, payload);
        toast.success("Template atualizado.");
      } else {
        const created = await checklistTemplatesService.create({
          ...payload,
          criado_por_user_id: user.id,
        });
        setSelectedTemplateId(created.id);
        toast.success("Template criado.");
      }

      resetTemplateForm();
      setTemplateFormOpen(false);
      await refreshAll(syncOpenInstances);
    } catch (error) {
      console.error("Erro ao salvar template:", error);
      toast.error(
        isChecklistAuthUidRequiredError(error)
          ? getChecklistAuthUidRequiredMessage()
          : isChecklistPermissionError(error)
          ? getChecklistPermissionMessage("salvar o template")
          : "Não foi possível salvar o template.",
      );
    } finally {
      setSavingTemplate(false);
    }
  }

  async function handleTaskSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!templateId || !canEditSelectedTemplate) {
      toast.error(getChecklistPermissionMessage("salvar a tarefa-base"));
      return;
    }

    try {
      setSavingTask(true);
      const payload = {
        checklist_template_id: templateId,
        titulo: taskForm.titulo.trim(),
        descricao: taskForm.descricao.trim() || null,
        ajuda: taskForm.ajuda.trim() || null,
        ordem: Number(taskForm.ordem || 1),
        tipo_resposta: taskForm.tipo_resposta,
        obrigatoria: taskForm.obrigatoria,
        permite_comentario: taskForm.permite_comentario,
        permite_anexo: taskForm.permite_anexo,
        nota_min: taskForm.nota_min ? Number(taskForm.nota_min) : null,
        nota_max: taskForm.nota_max ? Number(taskForm.nota_max) : null,
        config_json: taskForm.config_json.trim() ? JSON.parse(taskForm.config_json) : null,
      };

      if (editingTaskId) {
        await checklistTemplateTasksService.update(editingTaskId, payload);
        toast.success("Tarefa do template atualizada.");
      } else {
        await checklistTemplateTasksService.create(payload);
        toast.success("Tarefa do template criada.");
      }

      resetTaskForm();
      setTaskFormOpen(false);
      await refreshAll();
    } catch (error) {
      console.error("Erro ao salvar tarefa do template:", error);
      toast.error(
        isChecklistPermissionError(error)
          ? getChecklistPermissionMessage("salvar a tarefa-base")
          : "Não foi possível salvar a tarefa do template.",
      );
    } finally {
      setSavingTask(false);
    }
  }

  async function removeTask(taskId: string) {
    if (!canEditSelectedTemplate) {
      toast.error(getChecklistPermissionMessage("remover a tarefa-base"));
      return;
    }

    try {
      await checklistTemplateTasksService.remove(taskId);
      await refreshAll();
      toast.success("Tarefa removida.");
    } catch (error) {
      console.error("Erro ao remover tarefa:", error);
      toast.error(
        isChecklistPermissionError(error)
          ? getChecklistPermissionMessage("remover a tarefa-base")
          : "Não foi possível remover a tarefa.",
      );
    }
  }

  return (
    <ChecklistModuleLayout
      title="Templates"
      description="Lista de templates com detalhe contextual e tarefas-base no mesmo fluxo."
      currentPath="/checklists/templates"
      canAccessPage={canViewChecklistTemplates}
      actions={
        <>
          <Button variant="outline" onClick={() => void refreshAll()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
          {canManagePage ? <Button onClick={startCreateTemplate}>Novo template</Button> : null}
        </>
      }
    >
      {loadError && isChecklistPermissionError(loadError) ? (
        <ChecklistAccessStateCard
          title="Leitura bloqueada pelo banco"
          description={getChecklistPermissionMessage("carregar templates")}
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <SectionCard
            title="Templates cadastrados"
            description="Selecione um template para ver as tarefas-base e editar os dados estruturais."
          >
            <div className="space-y-4">
              <FilterBar>
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por título, local ou centro de custo"
                />
                <Select
                  value={statusFilter}
                  onValueChange={(value: ChecklistTemplateStatus | "all") => setStatusFilter(value)}
                >
                  <SelectTrigger className="w-full md:w-56">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    {Object.entries(checklistTemplateStatusLabels).map(([value, label]) => (
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
                    <TableHead>Template</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Recorrência</TableHead>
                    <TableHead>Local</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Carregando templates...
                      </TableCell>
                    </TableRow>
                  ) : filteredTemplates.length ? (
                    filteredTemplates.map((template) => {
                      const canEditTemplate = canEditChecklistRecord(
                        supervisorContext,
                        template.cost_center_id,
                      );

                      return (
                        <TableRow key={template.id} className={template.id === (selectedTemplate?.id ?? "") ? "bg-muted/40" : undefined}>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-medium">{template.titulo}</p>
                              <p className="text-xs text-muted-foreground">
                                {template.cost_center?.name || template.cost_center_id}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <ChecklistTemplateStatusBadge status={template.status} />
                          </TableCell>
                          <TableCell>
                            {recurrenceLabels[template.recorrencia]} x {template.recorrencia_intervalo}
                          </TableCell>
                          <TableCell>{template.local?.nome || "-"}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <PanelToggleButton
                                label="Detalhe"
                                onClick={() => {
                                  setSelectedTemplateId(template.id);
                                  setDetailOpen(true);
                                }}
                              />
                              {canManagePage ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedTemplateId(template.id);
                                    if (canEditTemplate) {
                                      setEditingTemplateId(template.id);
                                      setTemplateForm({
                                        titulo: template.titulo,
                                        descricao: template.descricao ?? "",
                                        observacao: template.observacao ?? "",
                                        status: template.status,
                                        recorrencia: template.recorrencia,
                                        recorrencia_intervalo: String(template.recorrencia_intervalo ?? 1),
                                        inicia_em: toDateTimeLocal(template.inicia_em),
                                        encerra_em: toDateTimeLocal(template.encerra_em),
                                        prazo_padrao_horas:
                                          template.prazo_padrao_horas != null
                                            ? String(template.prazo_padrao_horas)
                                            : "",
                                        exige_plano_acao: template.exige_plano_acao,
                                        ativo: template.ativo,
                                        cost_center_id: template.cost_center_id,
                                        local_id: template.local_id,
                                        equipe_responsavel_id: template.equipe_responsavel_id,
                                      });
                                      setTemplateFormOpen(true);
                                    }
                                  }}
                                  disabled={!canEditTemplate}
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
                      <TableCell colSpan={5} className="p-4">
                        <EmptyState title="Sem templates" description="Nenhum template encontrado." />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </EntityTable>
            </div>
          </SectionCard>

          <SidePanel
            open={!!selectedTemplate && detailOpen}
            onOpenChange={setDetailOpen}
            title={selectedTemplate ? selectedTemplate.titulo : "Detalhe do template"}
            description="Configuração principal e tarefas-base do template."
          >
            {selectedTemplate ? (
              <div className="space-y-6">
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <div className="flex flex-wrap gap-2">
                    <ChecklistTemplateStatusBadge status={selectedTemplate.status} />
                    <StatusBadge>{selectedTemplate.local?.nome || "Sem local"}</StatusBadge>
                    <StatusBadge variant="secondary">{selectedTemplate.equipe?.nome || "Sem equipe"}</StatusBadge>
                  </div>
                  <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
                    <div>Centro de custo: {selectedTemplate.cost_center?.name || selectedTemplate.cost_center_id}</div>
                    <div>Recorrência: {recurrenceLabels[selectedTemplate.recorrencia]} x {selectedTemplate.recorrencia_intervalo}</div>
                    <div>Membros ativos da equipe: {selectedTeamMembersCount ?? 0}</div>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {selectedTemplate.descricao || "Sem descrição cadastrada."}
                  </p>
                </div>

                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  Alterar a equipe responsavel do template reatribui automaticamente os responsaveis
                  das instancias abertas vinculadas a este template.
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Tarefas-base</p>
                    {canEditSelectedTemplate ? (
                      <Button type="button" size="sm" onClick={startCreateTask}>
                        Nova tarefa
                      </Button>
                    ) : null}
                  </div>

                  {templateTasks.length ? (
                    <div className="space-y-3">
                      {templateTasks.map((task) => (
                        <div key={task.id} className="rounded-2xl border p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-medium">{task.titulo}</p>
                              <p className="text-xs text-muted-foreground">
                                Ordem {task.ordem} • {checklistTaskResponseTypeLabels[task.tipo_resposta]}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {task.obrigatoria ? <Badge variant="secondary">Obrigatória</Badge> : null}
                              {task.permite_comentario ? <Badge variant="outline">Comentário</Badge> : null}
                              {task.permite_anexo ? <Badge variant="outline">Anexo</Badge> : null}
                            </div>
                          </div>
                          {task.descricao ? (
                            <p className="mt-3 text-sm text-muted-foreground">{task.descricao}</p>
                          ) : null}
                          {parseChecklistConfigOptions(task.config_json).length ? (
                            <p className="mt-2 text-xs text-muted-foreground">
                              {parseChecklistConfigOptions(task.config_json).length} opção(ões) configuradas.
                            </p>
                          ) : null}
                          {canEditSelectedTemplate ? (
                            <div className="mt-3 flex gap-2">
                              <Button type="button" size="sm" variant="outline" onClick={() => startEditTask(task)}>
                                Editar
                              </Button>
                              <Button type="button" size="sm" variant="outline" onClick={() => void removeTask(task.id)}>
                                Remover
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="Sem tarefas-base"
                      description="Selecione um template editável para cadastrar tarefas-base."
                      className="min-h-[140px]"
                    />
                  )}
                </div>
              </div>
            ) : (
              <EmptyState
                title="Selecione um template"
                description="Abra uma linha da lista para ver os detalhes e as tarefas-base."
                className="min-h-[220px]"
              />
            )}
          </SidePanel>

          <FormDrawer
            open={templateFormOpen}
            onOpenChange={setTemplateFormOpen}
            title={editingTemplateId ? "Editar template" : "Novo template"}
            description="Supervisor edita apenas templates dentro do próprio escopo."
          >
            {canManagePage ? (
              <form className="space-y-4" onSubmit={handleTemplateSubmit}>
                <div className="space-y-2">
                  <ChecklistField label="Título" tooltip="Nome principal do template." />
                  <Input
                    value={templateForm.titulo}
                    onChange={(event) =>
                      setTemplateForm((current) => ({ ...current, titulo: event.target.value }))
                    }
                    placeholder="Ex.: Checklist de abertura do turno"
                    disabled={!canEditCurrentTemplate}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <ChecklistField label="Status" tooltip="Rascunho, publicado ou arquivado." />
                    <Select
                      value={templateForm.status}
                      onValueChange={(value: ChecklistTemplateStatus) =>
                        setTemplateForm((current) => ({ ...current, status: value }))
                      }
                      disabled={!canEditCurrentTemplate}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o status" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(checklistTemplateStatusLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <ChecklistField label="Recorrência" tooltip="A recorrência é processada pelo banco." />
                    <Select
                      value={templateForm.recorrencia}
                      onValueChange={(value: ModuleRecurrenceType) =>
                        setTemplateForm((current) => ({ ...current, recorrencia: value }))
                      }
                      disabled={!canEditCurrentTemplate}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a recorrência" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(recurrenceLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    type="number"
                    min="1"
                    value={templateForm.recorrencia_intervalo}
                    onChange={(event) =>
                      setTemplateForm((current) => ({ ...current, recorrencia_intervalo: event.target.value }))
                    }
                    disabled={!canEditCurrentTemplate}
                    placeholder="Intervalo"
                  />
                  <Input
                    type="number"
                    min="0"
                    value={templateForm.prazo_padrao_horas}
                    onChange={(event) =>
                      setTemplateForm((current) => ({ ...current, prazo_padrao_horas: event.target.value }))
                    }
                    disabled={!canEditCurrentTemplate}
                    placeholder="Prazo padrão (horas)"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    type="datetime-local"
                    value={templateForm.inicia_em}
                    onChange={(event) =>
                      setTemplateForm((current) => ({ ...current, inicia_em: event.target.value }))
                    }
                    disabled={!canEditCurrentTemplate}
                  />
                  <Input
                    type="datetime-local"
                    value={templateForm.encerra_em}
                    onChange={(event) =>
                      setTemplateForm((current) => ({ ...current, encerra_em: event.target.value }))
                    }
                    disabled={!canEditCurrentTemplate}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <Select
                    value={templateForm.cost_center_id}
                    onValueChange={(value) =>
                      setTemplateForm((current) => ({
                        ...current,
                        cost_center_id: value,
                        local_id: "",
                        equipe_responsavel_id: "",
                      }))
                    }
                    disabled={!canEditCurrentTemplate}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Centro de custo" />
                    </SelectTrigger>
                    <SelectContent>
                      {visibleCostCenters.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={templateForm.local_id}
                    onValueChange={(value) =>
                      setTemplateForm((current) => ({ ...current, local_id: value }))
                    }
                    disabled={!canEditCurrentTemplate}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Local" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredLocais.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={templateForm.equipe_responsavel_id}
                    onValueChange={(value) =>
                      setTemplateForm((current) => ({ ...current, equipe_responsavel_id: value }))
                    }
                    disabled={!canEditCurrentTemplate}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Equipe responsável" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTeamOptions.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  Alterar a equipe responsavel do template reatribui automaticamente os responsaveis
                  das instancias abertas. O frontend apenas salva o template e refaz o carregamento.
                </div>

                <div className="space-y-2">
                  <Textarea
                    value={templateForm.descricao}
                    onChange={(event) =>
                      setTemplateForm((current) => ({ ...current, descricao: event.target.value }))
                    }
                    rows={3}
                    disabled={!canEditCurrentTemplate}
                    placeholder="Descrição"
                  />
                </div>

                <div className="space-y-2">
                  <Textarea
                    value={templateForm.observacao}
                    onChange={(event) =>
                      setTemplateForm((current) => ({ ...current, observacao: event.target.value }))
                    }
                    rows={3}
                    disabled={!canEditCurrentTemplate}
                    placeholder="Observação"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <span className="text-sm">Exige plano de ação</span>
                    <Switch
                      checked={templateForm.exige_plano_acao}
                      onCheckedChange={(checked) =>
                        setTemplateForm((current) => ({ ...current, exige_plano_acao: checked }))
                      }
                      disabled={!canEditCurrentTemplate}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <span className="text-sm">Ativo</span>
                    <Switch
                      checked={templateForm.ativo}
                      onCheckedChange={(checked) =>
                        setTemplateForm((current) => ({ ...current, ativo: checked }))
                      }
                      disabled={!canEditCurrentTemplate}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={savingTemplate || !canEditCurrentTemplate}>
                    <Save className="mr-2 h-4 w-4" />
                    {savingTemplate ? "Salvando..." : editingTemplateId ? "Atualizar template" : "Criar template"}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetTemplateForm}>
                    Limpar
                  </Button>
                </div>
              </form>
            ) : (
              <EmptyState
                title="Sem permissão"
                description="Criação e edição de templates são restritas a supervisores com escopo válido e administradores."
                className="min-h-[180px]"
              />
            )}
          </FormDrawer>

          <FormDrawer
            open={taskFormOpen}
            onOpenChange={setTaskFormOpen}
            title={editingTaskId ? "Editar tarefa-base" : "Nova tarefa-base"}
            description="A tarefa-base será copiada pelo banco quando a instância nascer."
          >
            {canManagePage ? (
              <form className="space-y-4" onSubmit={handleTaskSubmit}>
                <div className="space-y-2">
                  <ChecklistField label="Título da tarefa" tooltip="Texto principal que aparecerá no snapshot." />
                  <Input
                    value={taskForm.titulo}
                    onChange={(event) =>
                      setTaskForm((current) => ({ ...current, titulo: event.target.value }))
                    }
                    disabled={!templateId || !canEditSelectedTemplate}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    type="number"
                    min="1"
                    value={taskForm.ordem}
                    onChange={(event) =>
                      setTaskForm((current) => ({ ...current, ordem: event.target.value }))
                    }
                    disabled={!canEditSelectedTemplate}
                    placeholder="Ordem"
                  />
                  <Select
                    value={taskForm.tipo_resposta}
                    onValueChange={(value: ChecklistTaskResponseType) =>
                      setTaskForm((current) => ({ ...current, tipo_resposta: value }))
                    }
                    disabled={!canEditSelectedTemplate}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Tipo de resposta" />
                    </SelectTrigger>
                    <SelectContent>
                      {taskResponseTypeOptionsForTemplateForm.map((value) => (
                        <SelectItem key={value} value={value}>
                          {checklistTaskResponseTypeLabels[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Textarea
                  value={taskForm.descricao}
                  onChange={(event) =>
                    setTaskForm((current) => ({ ...current, descricao: event.target.value }))
                  }
                  rows={3}
                  disabled={!canEditSelectedTemplate}
                  placeholder="Descrição"
                />
                <Textarea
                  value={taskForm.ajuda}
                  onChange={(event) =>
                    setTaskForm((current) => ({ ...current, ajuda: event.target.value }))
                  }
                  rows={3}
                  disabled={!canEditSelectedTemplate}
                  placeholder="Ajuda operacional"
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={taskForm.nota_min}
                    onChange={(event) =>
                      setTaskForm((current) => ({ ...current, nota_min: event.target.value }))
                    }
                    disabled={!canEditSelectedTemplate}
                    placeholder="Nota mínima"
                  />
                  <Input
                    type="number"
                    step="0.01"
                    value={taskForm.nota_max}
                    onChange={(event) =>
                      setTaskForm((current) => ({ ...current, nota_max: event.target.value }))
                    }
                    disabled={!canEditSelectedTemplate}
                    placeholder="Nota máxima"
                  />
                </div>

                <Textarea
                  value={taskForm.config_json}
                  onChange={(event) =>
                    setTaskForm((current) => ({ ...current, config_json: event.target.value }))
                  }
                  rows={5}
                  placeholder='Ex.: { "options": ["Conforme", "Não conforme"] }'
                  disabled={!canEditSelectedTemplate}
                />

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <span className="text-sm">Obrigatória</span>
                    <Switch
                      checked={taskForm.obrigatoria}
                      onCheckedChange={(checked) =>
                        setTaskForm((current) => ({ ...current, obrigatoria: checked }))
                      }
                      disabled={!canEditSelectedTemplate}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <span className="text-sm">Comentário</span>
                    <Switch
                      checked={taskForm.permite_comentario}
                      onCheckedChange={(checked) =>
                        setTaskForm((current) => ({ ...current, permite_comentario: checked }))
                      }
                      disabled={!canEditSelectedTemplate}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <span className="text-sm">Anexo</span>
                    <Switch
                      checked={taskForm.permite_anexo}
                      onCheckedChange={(checked) =>
                        setTaskForm((current) => ({ ...current, permite_anexo: checked }))
                      }
                      disabled={!canEditSelectedTemplate}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={!templateId || savingTask || !canEditSelectedTemplate}>
                    {savingTask ? "Salvando..." : editingTaskId ? "Atualizar tarefa" : "Criar tarefa"}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetTaskForm}>
                    Limpar
                  </Button>
                </div>
              </form>
            ) : (
              <EmptyState
                title="Sem permissão"
                description="Edição das tarefas-base também segue as permissões do template e do centro de custo."
                className="min-h-[180px]"
              />
            )}
          </FormDrawer>
        </div>
      )}
    </ChecklistModuleLayout>
  );
}
