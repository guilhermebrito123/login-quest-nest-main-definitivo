import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Users,
  UserCog,
  FileText,
  Headphones,
  ClipboardList,
  UserCheck,
  LogOut,
  Calendar,
  MessageSquare,
  Package,
  UserCircle,
  ClipboardCheck,
  ListChecks,
  ListOrdered,
  Briefcase,
  Lock,
  AlertTriangle,
  FolderTree,
  Fuel,
  Clock,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSession } from "@/hooks/useSession";

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

type MenuItem = {
  title: string;
  url: string;
  icon: any;
  children?: { title: string; url: string; status?: string }[];
  statusCountsKey?: "diarias" | "diariasTemporarias" | "horaExtra";
  badge?: string;
};
type UserRole = "candidato" | "colaborador" | "perfil_interno";

const diariasChildren = [
  {
    title: "Aguardando confirmação",
    url: "/diarias/aguardando",
    status: "Aguardando confirmacao",
  },
  { title: "Confirmadas", url: "/diarias/confirmadas", status: "Confirmada" },
  { title: "Financeiro", url: "/diarias/aprovadas", status: "Aprovada" },
  {
    title: "Lançadas",
    url: "/diarias/lancadas",
    status: "Lançada para pagamento",
  },
  { title: "Reprovadas", url: "/diarias/reprovadas" },
  { title: "Canceladas", url: "/diarias/canceladas" },
  { title: "Pagas", url: "/diarias/pagas" },
];

const diariasTemporariasChildren = [
  {
    title: "Aguardando confirmação",
    url: "/cobertura/diarias/aguardando",
    status: "Aguardando confirmacao",
  },
  { title: "Confirmadas", url: "/cobertura/diarias/confirmadas", status: "Confirmada" },
  { title: "Financeiro", url: "/cobertura/diarias/aprovadas", status: "Aprovada" },
  {
    title: "Lançadas",
    url: "/cobertura/diarias/lancadas",
    status: "Lançada para pagamento",
  },
  { title: "Pagas", url: "/cobertura/diarias/pagas" },
  { title: "Reprovadas", url: "/cobertura/diarias/reprovadas" },
  { title: "Canceladas", url: "/cobertura/diarias/canceladas" },
  { title: "Logs", url: "/cobertura/diarias/logs" },
];

const horaExtraChildren = [
  { title: "Pendentes", url: "/cobertura/hora-extra/pendentes", status: "pendente" },
  { title: "Confirmadas", url: "/cobertura/hora-extra/confirmadas", status: "confirmada" },
  { title: "Aprovadas", url: "/cobertura/hora-extra/aprovadas", status: "aprovada" },
  { title: "Reprovadas", url: "/cobertura/hora-extra/reprovadas", status: "reprovada" },
  { title: "Canceladas", url: "/cobertura/hora-extra/canceladas", status: "cancelada" },
];

const menuItems: MenuItem[] = [
  { title: "Minha conta", url: "/minha-conta", icon: UserCog },
  { title: "Dados empresariais", url: "/dados-empresariais", icon: Briefcase },
  { title: "Dashboard 24/7", url: "/dashboard-24h", icon: LayoutDashboard },
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Gestão de Usuários", url: "/users", icon: Users },
  { title: "Contratos", url: "/contratos", icon: FileText },
  { title: "Mesa de Operações", url: "/mesa-operacoes", icon: Headphones },
  { title: "Chamados", url: "/chamados", icon: MessageSquare },
  { title: "Ordens de Serviço", url: "/ordens-servico", icon: ClipboardList },
  { title: "Colaboradores", url: "/colaboradores", icon: UserCheck },
  { title: "Centros de Custo", url: "/centros-custo", icon: FolderTree },
  { title: "Postos de Servico", url: "/postos-servico", icon: Fuel },
  { title: "Diaristas✅", url: "/diaristas", icon: UserCircle },
  { title: "Diaristas🔒", url: "/diaristas-restritos", icon: Lock },
  { title: "Diaristas logs", url: "/diaristas/logs", icon: FileText },
  { title: "Cobertura", url: "/cobertura", icon: Calendar },
  //{ title: "Diarias (versão futura)", url: "/diarias", icon: Calendar, children: diariasChildren, statusCountsKey: "diarias" },
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
  { title: "Faltas", url: "/faltas", icon: AlertTriangle },
  { title: "Ativos", url: "/ativos", icon: Package },
  { title: "Estoque", url: "/estoque", icon: Package },
  { title: "Checklists", url: "/checklists", icon: ClipboardCheck },
  {
    title: "Execuções de Checklist",
    url: "/checklist-execucoes",
    icon: ListOrdered,
  },
  {
    title: "Responder Checklist",
    url: "/checklist-respostas",
    icon: ListOrdered,
  },
  {
    title: "Respostas registradas",
    url: "/checklist-respostas-lista",
    icon: ListChecks,
  },
];

export function AppSidebar() {
  const { open } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { session } = useSession();
  const currentPath = location.pathname;
  const [diariasCounts, setDiariasCounts] = useState<Record<string, number>>(
    {}
  );
  const [diariasTemporariasCounts, setDiariasTemporariasCounts] = useState<
    Record<string, number>
  >({});
  const [horaExtraCounts, setHoraExtraCounts] = useState<Record<string, number>>(
    {}
  );
  const [enterprisePending, setEnterprisePending] = useState(false);
  useEffect(() => {
    let isMounted = true;
    if (!session) {
      return () => {
        isMounted = false;
      };
    }

    const fetchCounts = async (
      children: { title: string; url: string; status?: string }[],
      tableName: string
    ) => {
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
        })
      );
      const next: Record<string, number> = {};
      results.forEach(({ status, count }) => {
        next[status] = count;
      });
      return next;
    };

    const loadCounts = async () => {
      try {
        const [origCounts, temporariasCounts, horasExtrasCounts] =
          await Promise.all([
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

    loadCounts();
    return () => {
      isMounted = false;
    };
  }, [session?.user?.id]);

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
        const filled = (v?: string | null) => !!v && v.toString().trim().length > 0;

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

    checkEnterprisePending();
    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  const computedMenuItems = useMemo(
    () =>
      menuItems.map((item) =>
        item.url === "/dados-empresariais" && enterprisePending
          ? { ...item, badge: "!" }
          : item
      ),
    [enterprisePending]
  );

  const isActive = (path: string, exact = true) =>
    exact
      ? currentPath === path
      : currentPath === path || currentPath.startsWith(`${path}/`);

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
                const hasChildren =
                  Array.isArray(item.children) && item.children.length > 0;
                const itemActive = hasChildren
                  ? isActive(item.url, false)
                  : isActive(item.url);
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
                            <SidebarMenuButton
                              asChild
                              isActive={isActive(child.url)}
                            >
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
