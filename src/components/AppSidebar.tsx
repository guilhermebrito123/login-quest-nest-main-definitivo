import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
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
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
};

const diariasChildren = [
  { title: "Aguardando confirmação", url: "/diarias/aguardando", status: "Aguardando confirmacao" },
  { title: "Confirmadas", url: "/diarias/confirmadas", status: "Confirmada" },
  { title: "Aprovadas", url: "/diarias/aprovadas", status: "Aprovada" },
  { title: "Lançadas", url: "/diarias/lancadas", status: "Lançada para pagamento" },
  { title: "Aprovadas p/ pagamento", url: "/diarias/aprovadas-pagamento" },
  { title: "Reprovadas", url: "/diarias/reprovadas" },
  { title: "Canceladas", url: "/diarias/canceladas" },
];

const menuItems: MenuItem[] = [
  { title: "Dashboard 24/7", url: "/dashboard-24h", icon: LayoutDashboard },
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Contratos", url: "/contratos", icon: FileText },
  { title: "Mesa de Operações", url: "/mesa-operacoes", icon: Headphones },
  { title: "Chamados", url: "/chamados", icon: MessageSquare },
  { title: "Ordens de Serviço", url: "/ordens-servico", icon: ClipboardList },
  { title: "Colaboradores", url: "/colaboradores", icon: UserCheck },
  { title: "Diaristas", url: "/diaristas", icon: UserCircle },
  { title: "Diarias", url: "/diarias", icon: Calendar, children: diariasChildren },
  { title: "Ativos", url: "/ativos", icon: Package },
  { title: "Estoque", url: "/estoque", icon: Package },
  { title: "Checklists", url: "/checklists", icon: ClipboardCheck },
  { title: "Execuções de Checklist", url: "/checklist-execucoes", icon: ListOrdered },
  { title: "Responder Checklist", url: "/checklist-respostas", icon: ListOrdered },
  { title: "Respostas registradas", url: "/checklist-respostas-lista", icon: ListChecks },
];

export function AppSidebar() {
  const { open } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const [diariasCounts, setDiariasCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let isMounted = true;

    const loadCounts = async () => {
      const statusesWithBadge = diariasChildren.filter((child) => child.status);
      if (statusesWithBadge.length === 0) return;

      try {
        const results = await Promise.all(
          statusesWithBadge.map(async (child) => {
            const { count, error } = await supabase
              .from("diarias")
              .select("id", { count: "exact", head: true })
              .eq("status", child.status);
            if (error) throw error;
            return { status: child.status!, count: count || 0 };
          }),
        );

        if (!isMounted) return;
        const next: Record<string, number> = {};
        results.forEach(({ status, count }) => {
          next[status] = count;
        });
        setDiariasCounts(next);
      } catch (error) {
        console.error("Erro ao carregar contagens de diárias:", error);
      }
    };

    loadCounts();
    return () => {
      isMounted = false;
    };
  }, []);

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
              {menuItems.map((item) => {
                const hasChildren = Array.isArray(item.children) && item.children.length > 0;
                const itemActive = hasChildren ? isActive(item.url, false) : isActive(item.url);
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
                        {open && <span>{item.title}</span>}
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
                                {child.status && (diariasCounts[child.status] ?? 0) > 0 && (
                                  <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                                    {diariasCounts[child.status]}
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
