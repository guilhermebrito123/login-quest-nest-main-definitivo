import { useMemo } from "react";
import {
  AlertTriangle,
  CheckSquare,
  ClipboardList,
  KanbanSquare,
  MessageSquareMore,
  ShieldAlert,
} from "lucide-react";
import { NavLink } from "react-router-dom";

import { ChecklistModuleLayout } from "@/components/checklist/ChecklistModuleLayout";
import { ModuleToolbar, SectionCard, StatCard } from "@/components/checklist/ChecklistMvp";
import { Button } from "@/components/ui/button";
import {
  canViewActionPlans,
  canViewChecklistFeedbacks,
  canViewChecklistInstances,
  canViewChecklistKanban,
  canViewChecklistTemplates,
  filterChecklistActionPlansByScope,
  filterChecklistFeedbacksByScope,
  filterChecklistInstancesByScope,
  filterChecklistResponsibilitiesByScope,
  filterChecklistTemplatesByScope,
} from "@/lib/checklist-module";
import {
  useChecklistActionPlans,
  useChecklistFeedbacks,
  useChecklistInstances,
  useChecklistResponsibilities,
  useChecklistSupervisorScope,
  useChecklistTemplates,
} from "@/modules/checklist/hooks";

export default function ChecklistOverviewPage() {
  const { supervisorContext } = useChecklistSupervisorScope();
  const { data: templates = [], isLoading: templatesLoading } = useChecklistTemplates();
  const { data: instances = [], isLoading: instancesLoading } = useChecklistInstances();
  const { data: responsibilities = [], isLoading: responsibilitiesLoading } = useChecklistResponsibilities();
  const { data: feedbacks = [], isLoading: feedbacksLoading } = useChecklistFeedbacks();
  const { data: plans = [], isLoading: plansLoading } = useChecklistActionPlans();

  const scopedTemplates = useMemo(
    () => filterChecklistTemplatesByScope(templates, supervisorContext),
    [supervisorContext, templates],
  );
  const scopedInstances = useMemo(
    () => filterChecklistInstancesByScope(instances, supervisorContext),
    [instances, supervisorContext],
  );
  const scopedResponsibilities = useMemo(
    () => filterChecklistResponsibilitiesByScope(responsibilities, supervisorContext),
    [responsibilities, supervisorContext],
  );
  const scopedFeedbacks = useMemo(
    () => filterChecklistFeedbacksByScope(feedbacks, supervisorContext),
    [feedbacks, supervisorContext],
  );
  const scopedPlans = useMemo(
    () => filterChecklistActionPlansByScope(plans, supervisorContext),
    [plans, supervisorContext],
  );

  const stats = useMemo(
    () => ({
      templates: scopedTemplates.filter((item) => item.ativo).length,
      instanciasAbertas: scopedInstances.filter((item) =>
        ["open", "in_progress", "submitted", "under_review"].includes(item.status),
      ).length,
      tarefasBloqueadas: scopedResponsibilities.filter(
        (item) => item.ativo && item.status_kanban === "blocked",
      ).length,
      feedbacksPendentes: scopedFeedbacks.filter((item) => !item.ciente).length,
      planosAbertos: scopedPlans.filter((item) =>
        ["open", "in_progress", "waiting_validation"].includes(item.status),
      ).length,
    }),
    [scopedFeedbacks, scopedInstances, scopedPlans, scopedResponsibilities, scopedTemplates],
  );

  const pendingItems = useMemo(
    () =>
      [
        {
          label: "Instâncias aguardando ação",
          value: stats.instanciasAbertas,
          href: "/checklists/instancias",
          enabled: canViewChecklistInstances(supervisorContext),
        },
        {
          label: "Bloqueios no kanban",
          value: stats.tarefasBloqueadas,
          href: "/checklists/kanban",
          enabled: canViewChecklistKanban(supervisorContext),
        },
        {
          label: "Feedbacks pendentes",
          value: stats.feedbacksPendentes,
          href: "/checklists/feedbacks",
          enabled: canViewChecklistFeedbacks(supervisorContext),
        },
        {
          label: "Planos de ação em aberto",
          value: stats.planosAbertos,
          href: "/checklists/planos-acao",
          enabled: canViewActionPlans(supervisorContext),
        },
      ].filter((item) => item.enabled),
    [stats, supervisorContext],
  );

  const isLoading =
    templatesLoading ||
    instancesLoading ||
    responsibilitiesLoading ||
    feedbacksLoading ||
    plansLoading;

  return (
    <ChecklistModuleLayout
      title="Checklist"
      description="Resumo operacional do módulo para supervisão diária."
      currentPath="/checklists"
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {canViewChecklistTemplates(supervisorContext) ? (
          <StatCard
            title="Templates ativos"
            value={isLoading ? "..." : stats.templates}
            description="Modelos prontos para gerar novas instâncias."
            icon={<ClipboardList className="h-5 w-5" />}
          />
        ) : null}
        {canViewChecklistInstances(supervisorContext) ? (
          <StatCard
            title="Instâncias abertas"
            value={isLoading ? "..." : stats.instanciasAbertas}
            description="Execuções em andamento, envio ou revisão."
            icon={<CheckSquare className="h-5 w-5" />}
          />
        ) : null}
        {canViewChecklistKanban(supervisorContext) ? (
          <StatCard
            title="Kanban bloqueado"
            value={isLoading ? "..." : stats.tarefasBloqueadas}
            description="Tarefas com impedimento ativo."
            icon={<KanbanSquare className="h-5 w-5" />}
          />
        ) : null}
        {canViewChecklistFeedbacks(supervisorContext) ? (
          <StatCard
            title="Feedback pendente"
            value={isLoading ? "..." : stats.feedbacksPendentes}
            description="Mensagens que ainda exigem ciência."
            icon={<MessageSquareMore className="h-5 w-5" />}
          />
        ) : null}
        {canViewActionPlans(supervisorContext) ? (
          <StatCard
            title="Planos em aberto"
            value={isLoading ? "..." : stats.planosAbertos}
            description="Tratativas corretivas em andamento."
            icon={<ShieldAlert className="h-5 w-5" />}
          />
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
        <SectionCard
          title="Pendências prioritárias"
          description="Atalhos para o que precisa de ação mais rápida do supervisor."
        >
          <div className="space-y-3">
            {pendingItems.map((item) => (
              <div
                key={item.label}
                className="flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <p className="font-medium">{item.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.value} item(ns) no seu escopo.
                  </p>
                </div>
                <Button asChild variant="outline">
                  <NavLink to={item.href}>Abrir</NavLink>
                </Button>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Atalhos do módulo"
          description="Fluxos principais do MVP."
        >
          <ModuleToolbar className="border-0 bg-transparent p-0 shadow-none">
            <div className="grid w-full gap-2">
              {canViewChecklistTemplates(supervisorContext) ? (
                <Button asChild variant="outline" className="justify-start">
                  <NavLink to="/checklists/templates">Gerenciar templates</NavLink>
                </Button>
              ) : null}
              {canViewChecklistInstances(supervisorContext) ? (
                <Button asChild variant="outline" className="justify-start">
                  <NavLink to="/checklists/instancias">Operar instâncias</NavLink>
                </Button>
              ) : null}
              {canViewChecklistKanban(supervisorContext) ? (
                <Button asChild variant="outline" className="justify-start">
                  <NavLink to="/checklists/kanban">Acompanhar kanban</NavLink>
                </Button>
              ) : null}
              {canViewChecklistFeedbacks(supervisorContext) ? (
                <Button asChild variant="outline" className="justify-start">
                  <NavLink to="/checklists/feedbacks">Abrir inbox de feedback</NavLink>
                </Button>
              ) : null}
              {canViewActionPlans(supervisorContext) ? (
                <Button asChild variant="outline" className="justify-start">
                  <NavLink to="/checklists/planos-acao">Acompanhar planos de ação</NavLink>
                </Button>
              ) : null}
            </div>
          </ModuleToolbar>
        </SectionCard>
      </div>

      <SectionCard
        title="Últimos sinais do dia"
        description="Resumo enxuto para decidir onde atuar primeiro."
      >
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border p-4">
            <p className="text-sm font-medium">Execução</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {stats.instanciasAbertas > 0
                ? `${stats.instanciasAbertas} instâncias seguem ativas no seu escopo.`
                : "Nenhuma instância aberta no momento."}
            </p>
          </div>
          <div className="rounded-2xl border p-4">
            <p className="text-sm font-medium">Risco operacional</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {stats.tarefasBloqueadas > 0 ? (
                <>
                  <AlertTriangle className="mr-1 inline h-4 w-4" />
                  Há bloqueios no kanban que merecem atenção.
                </>
              ) : (
                "Sem bloqueios no kanban agora."
              )}
            </p>
          </div>
          <div className="rounded-2xl border p-4">
            <p className="text-sm font-medium">Tratativas</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {stats.planosAbertos > 0
                ? `${stats.planosAbertos} planos de ação seguem em andamento.`
                : "Nenhum plano de ação em aberto."}
            </p>
          </div>
        </div>
      </SectionCard>
    </ChecklistModuleLayout>
  );
}
