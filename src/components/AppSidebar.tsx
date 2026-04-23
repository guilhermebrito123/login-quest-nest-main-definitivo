import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Briefcase,
  Calendar,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FileText,
  FolderTree,
  Fuel,
  Headphones,
  History,
  KeyRound,
  Landmark,
  LayoutDashboard,
  Lock,
  LogOut,
  MapPin,
  MessageSquare,
  Package,
  UserCheck,
  UserCircle,
  UserCog,
  Users,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAccessContext } from "@/hooks/useAccessContext";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { useChecklistSupervisorScope } from "@/modules/checklist/hooks";
import type { ChecklistSupervisorContext } from "@/modules/checklist/types";
import {
  canAccessChecklistModule,
  canViewActionPlans,
  canViewChecklistAudit,
  canViewChecklistFeedbacks,
  canViewChecklistInstances,
  canViewChecklistKanban,
  canViewChecklistReviews,
  canViewChecklistTasks,
  canViewChecklistTeams,
  canViewChecklistTemplates,
} from "@/lib/checklist-module";
import { canOperateInternalModules } from "@/lib/internalAccess";

type MenuChild = {
  title: string;
  url: string;
  status?: string;
  isVisible?: (context: ChecklistSupervisorContext) => boolean;
};

type MenuItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: MenuChild[];
  statusCountsKey?: "diarias" | "diariasTemporarias" | "horaExtra";
  badge?: string;
  requiresInternalOperational?: boolean;
  requiresAdmin?: boolean;
  requiresChecklistModule?: boolean;
};

type UserRole = "candidato" | "colaborador" | "perfil_interno";

const diariasChildren: MenuChild[] = [
  {
    title: "Aguardando confirmacao",
    url: "/diarias/aguardando",
    status: "Aguardando confirmacao",
  },
  { title: "Confirmadas", url: "/diarias/confirmadas", status: "Confirmada" },
  { title: "Financeiro", url: "/diarias/aprovadas", status: "Aprovada" },
  {
    title: "Lancadas",
    url: "/diarias/lancadas",
    status: "Lançada para pagamento",
  },
  { title: "Reprovadas", url: "/diarias/reprovadas" },
  { title: "Canceladas", url: "/diarias/canceladas" },
  { title: "Pagas", url: "/diarias/pagas" },
];

const diariasTemporariasChildren: MenuChild[] = [
  {
    title: "Aguardando confirmacao",
    url: "/cobertura/diarias/aguardando",
    status: "Aguardando confirmacao",
  },
  { title: "Confirmadas", url: "/cobertura/diarias/confirmadas", status: "Confirmada" },
  { title: "Financeiro", url: "/cobertura/diarias/aprovadas", status: "Aprovada" },
  {
    title: "Lancadas",
    url: "/cobertura/diarias/lancadas",
    status: "Lançada para pagamento",
  },
  { title: "Pagas", url: "/cobertura/diarias/pagas" },
  { title: "Reprovadas", url: "/cobertura/diarias/reprovadas" },
  { title: "Canceladas", url: "/cobertura/diarias/canceladas" },
  { title: "Logs", url: "/cobertura/diarias/logs" },
];

const horaExtraChildren: MenuChild[] = [
  { title: "Pendentes", url: "/cobertura/hora-extra/pendentes", status: "pendente" },
  { title: "Confirmadas", url: "/cobertura/hora-extra/confirmadas", status: "confirmada" },
  { title: "Aprovadas", url: "/cobertura/hora-extra/aprovadas", status: "aprovada" },
  { title: "Reprovadas", url: "/cobertura/hora-extra/reprovadas", status: "reprovada" },
  { title: "Canceladas", url: "/cobertura/hora-extra/canceladas", status: "cancelada" },
  { title: "Dashboard", url: "/cobertura/hora-extra/dashboard" },
];

const checklistChildren: MenuChild[] = [
  { title: "Visao geral", url: "/checklists" },
  {
    title: "Equipes",
    url: "/checklists/equipes",
    isVisible: canViewChecklistTeams,
  },
  {
    title: "Templates",
    url: "/checklists/templates",
    isVisible: canViewChecklistTemplates,
  },
  {
    title: "Instancias",
    url: "/checklists/instancias",
    isVisible: canViewChecklistInstances,
  },
  {
    title: "Avaliacoes",
    url: "/checklists/avaliacoes",
    isVisible: canViewChecklistReviews,
  },
  {
    title: "Tarefas",
    url: "/checklists/tarefas",
    isVisible: canViewChecklistTasks,
  },
  {
    title: "Kanban",
    url: "/checklists/kanban",
    isVisible: canViewChecklistKanban,
  },
  {
    title: "Feedback",
    url: "/checklists/feedbacks",
    isVisible: canViewChecklistFeedbacks,
  },
  {
    title: "Plano de acao",
    url: "/checklists/planos-acao",
    isVisible: canViewActionPlans,
  },
  {
    title: "Auditoria",
    url: "/checklists/auditoria",
    isVisible: canViewChecklistAudit,
  },
];

const menuItems: MenuItem[] = [
  {
    title: "Recuperacao de acesso",
    url: "/admin/recuperacoes",
    icon: KeyRound,
    requiresAdmin: true,
  },
  { title: "Minha conta", url: "/minha-conta", icon: UserCog },
  { title: "Dados empresariais", url: "/dados-empresariais", icon: Briefcase },
  { title: "Dashboard 24/7", url: "/dashboard-24h", icon: LayoutDashboard },
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Gestao de usuarios", url: "/users", icon: Users },
  { title: "Chamados", url: "/chamados", icon: MessageSquare },
  {
    title: "Historico de chamados",
    url: "/chamados/historico",
    icon: History,
    requiresInternalOperational: true,
  },
  { title: "Contratos", url: "/contratos", icon: FileText },
  { title: "Mesa de operacoes", url: "/mesa-operacoes", icon: Headphones },
  { title: "Ordens de servico", url: "/ordens-servico", icon: ClipboardList },
  { title: "Colaboradores", url: "/colaboradores", icon: UserCheck },
  { title: "Centros de custo", url: "/centros-custo", icon: FolderTree },
  { title: "Locais", url: "/locais-centro-custo", icon: MapPin },
  { title: "Postos de servico", url: "/postos-servico", icon: Fuel },
  { title: "Diaristas", url: "/diaristas", icon: UserCircle },
  { title: "Diaristas restritos", url: "/diaristas-restritos", icon: Lock },
  { title: "Diaristas logs", url: "/diaristas/logs", icon: FileText },
  {
    title: "Diarias (Cobertura)",
    url: "/cobertura/diarias",
    icon: Calendar,
    children: diariasTemporariasChildren,
    statusCountsKey: "diariasTemporarias",
  },
  {
    title: "Hora extra",
    url: "/cobertura/hora-extra",
    icon: Clock,
    children: horaExtraChildren,
    statusCountsKey: "horaExtra",
  },
  { title: "Controladoria", url: "/controladoria", icon: Landmark },
  { title: "Faltas", url: "/faltas", icon: AlertTriangle },
  { title: "Ativos", url: "/ativos", icon: Package },
  { title: "Estoque", url: "/estoque", icon: Package },
  { title: "Planos de acao", url: "/planos-acao", icon: ClipboardList },
  {
    title: "Checklist",
    url: "/checklists",
    icon: ClipboardCheck,
    children: checklistChildren,
    requiresChecklistModule: true,
  },
];

export function AppSidebar() {
  const { open } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { session } = useSession();
  const { accessContext } = useAccessContext();
  const { supervisorContext } = useChecklistSupervisorScope();
  const currentPath = location.pathname;
  const [diariasCounts, setDiariasCounts] = useState<Record<string, number>>({});
  const [diariasTemporariasCounts, setDiariasTemporariasCounts] = useState<Record<string, number>>(
    {},
  );
  const [horaExtraCounts, setHoraExtraCounts] = useState<Record<string, number>>({});
  const [recoveryPendingCount, setRecoveryPendingCount] = useState(0);
  const [enterprisePending, setEnterprisePending] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (!session) {
      return () => {
        isMounted = false;
      };
    }

    const fetchCounts = async (children: MenuChild[], tableName: string) => {
      const statuses = children.filter((child) => child.status);
      if (statuses.length === 0) return {};

      const results = await Promise.all(
        statuses.map(async (child) => {
          const { count, error } = await supabase
            .from(tableName)
            .select("id", { count: "exact", head: true })
            .eq("status", child.status);

          if (error) throw error;
          return { status: child.status!, count: count || 0 };
        }),
      );

      const next: Record<string, number> = {};
      results.forEach(({ status, count }) => {
        next[status] = count;
      });
      return next;
    };

    const loadCounts = async () => {
      try {
        const [origCounts, temporariasCounts, horasExtrasCounts] = await Promise.all([
          fetchCounts(diariasChildren, "diarias"),
          fetchCounts(diariasTemporariasChildren, "diarias_temporarias"),
          fetchCounts(horaExtraChildren, "horas_extras"),
        ]);

        if (!isMounted) return;
        setDiariasCounts(origCounts);
        setDiariasTemporariasCounts(temporariasCounts);
        setHoraExtraCounts(horasExtrasCounts);
      } catch (error) {
        console.error("Erro ao carregar contagens de diarias:", error);
      }
    };

    void loadCounts();

    return () => {
      isMounted = false;
    };
  }, [session?.user?.id]);

  useEffect(() => {
    let active = true;

    const loadRecoveryPendingCount = async () => {
      if (!session || accessContext.accessLevel !== "admin") {
        if (active) setRecoveryPendingCount(0);
        return;
      }

      const { count, error } = await supabase
        .from("account_recovery_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");

      if (error) {
        console.error("Erro ao carregar pedidos pendentes de recuperacao:", error);
        return;
      }

      if (active) {
        setRecoveryPendingCount(count || 0);
      }
    };

    void loadRecoveryPendingCount();

    return () => {
      active = false;
    };
  }, [accessContext.accessLevel, session]);

  useEffect(() => {
    let active = true;

    const checkEnterprisePending = async () => {
      try {
        const user = session?.user;
        if (!user) return;

        const { data: profile } = await supabase
          .from("usuarios")
          .select("role, email, full_name, phone")
          .eq("id", user.id)
          .maybeSingle();

        const role = (profile?.role as UserRole | null) ?? null;
        if (!role) return;

        let pending = false;
        const filled = (value?: string | null) => !!value && value.toString().trim().length > 0;

        if (role === "candidato") {
          const { data } = await supabase
            .from("candidatos")
            .select("nome_completo, email, telefone, celular, cidade, estado, curriculo_path")
            .eq("user_id", user.id)
            .maybeSingle();

          pending =
            !data ||
            !filled(data.nome_completo) ||
            !filled(data.email) ||
            !(filled(data.telefone) || filled(data.celular)) ||
            !filled(data.cidade) ||
            !filled(data.estado) ||
            !filled(data.curriculo_path);
        } else if (role === "colaborador") {
          const { data } = await supabase
            .from("colaboradores")
            .select("nome_completo, email, cpf, telefone, cargo, status_colaborador")
            .eq("user_id", user.id)
            .maybeSingle();

          pending =
            !data ||
            !filled(data.nome_completo) ||
            !filled(data.email) ||
            !filled(data.cpf) ||
            !filled(data.telefone) ||
            !filled(data.cargo) ||
            !filled(data.status_colaborador);
        } else if (role === "perfil_interno") {
          const { data } = await supabase
            .from("internal_profiles")
            .select("nome_completo, email, phone, cpf, cargo, nivel_acesso")
            .eq("user_id", user.id)
            .maybeSingle();

          pending =
            !data ||
            !filled(data.nome_completo) ||
            !filled(data.email) ||
            !filled(data.phone) ||
            !filled(data.cpf) ||
            !filled(data.cargo) ||
            !filled(data.nivel_acesso);
        }

        if (active) setEnterprisePending(pending);
      } catch (error) {
        console.error("Erro ao verificar pendencias empresariais:", error);
      }
    };

    void checkEnterprisePending();

    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  const computedMenuItems = useMemo(
    () =>
      menuItems
        .filter((item) => {
          if (item.requiresAdmin && accessContext.accessLevel !== "admin") {
            return false;
          }

          if (item.requiresChecklistModule && !canAccessChecklistModule(supervisorContext)) {
            return false;
          }

          if (!item.requiresInternalOperational) return true;

          return (
            accessContext.role === "perfil_interno" &&
            canOperateInternalModules(accessContext.accessLevel)
          );
        })
        .map((item) => {
          const nextItem = {
            ...item,
            children: item.children?.filter(
              (child) => !child.isVisible || child.isVisible(supervisorContext),
            ),
          };

          if (item.url === "/dados-empresariais") {
            return { ...nextItem, badge: enterprisePending ? "!" : undefined };
          }

          if (item.url === "/admin/recuperacoes") {
            return {
              ...nextItem,
              badge: recoveryPendingCount > 0 ? String(recoveryPendingCount) : undefined,
            };
          }

          return nextItem;
        }),
    [accessContext, enterprisePending, recoveryPendingCount, supervisorContext],
  );

  const isActive = (path: string, exact = true) =>
    exact ? currentPath === path : currentPath === path || currentPath.startsWith(`${path}/`);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logout realizado com sucesso");
    navigate("/auth");
  };

  return (
    <Sidebar className={open ? "w-64" : "w-16"} collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className={!open ? "hidden" : ""}>
            Facilities Center
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {computedMenuItems.map((item) => {
                const hasChildren = Array.isArray(item.children) && item.children.length > 0;
                const itemActive = hasChildren ? isActive(item.url, false) : isActive(item.url);
                const countsMap =
                  item.statusCountsKey === "diariasTemporarias"
                    ? diariasTemporariasCounts
                    : item.statusCountsKey === "horaExtra"
                      ? horaExtraCounts
                      : diariasCounts;

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={itemActive}>
                      <NavLink
                        to={item.url}
                        end={!hasChildren}
                        className="flex items-center gap-3 hover:bg-accent"
                        activeClassName="bg-accent text-accent-foreground font-medium"
                      >
                        <item.icon className="h-5 w-5" />
                        {open && <span className="flex-1">{item.title}</span>}
                        {item.badge && (
                          <span className="ml-auto inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-amber-500 px-2 text-[10px] font-semibold text-white">
                            {item.badge}
                          </span>
                        )}
                      </NavLink>
                    </SidebarMenuButton>

                    {hasChildren && open && itemActive && (
                      <ul className="ml-6 mt-1 space-y-1 border-l pl-3">
                        {item.children.map((child) => (
                          <SidebarMenuItem key={child.title}>
                            <SidebarMenuButton asChild isActive={isActive(child.url)}>
                              <NavLink
                                to={child.url}
                                end
                                className="flex w-full items-center justify-between gap-2 text-sm hover:bg-accent"
                                activeClassName="bg-accent text-accent-foreground font-medium"
                              >
                                <span className="truncate">{child.title}</span>
                                {child.status &&
                                  (countsMap[child.status] ?? 0) > 0 &&
                                  !(
                                    item.statusCountsKey === "horaExtra" &&
                                    child.status !== "pendente" &&
                                    child.status !== "confirmada"
                                  ) && (
                                    <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                                      {countsMap[child.status]}
                                    </span>
                                  )}
                              </NavLink>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                      </ul>
                    )}
                  </SidebarMenuItem>
                );
              })}

              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleLogout}>
                  <LogOut className="h-5 w-5" />
                  {open && <span>Sair</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
