import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Building2, Search, Shield, UserCog, Trash2 } from "lucide-react";
import { requiresInternalCostCenterScope } from "@/lib/internalAccess";

type UserType = Database["public"]["Enums"]["user_type"];
type AccessLevel = Database["public"]["Enums"]["internal_access_level"];
type ProfileRow = Database["public"]["Tables"]["usuarios"]["Row"];
type ColaboradorProfileRow = Database["public"]["Tables"]["colaborador_profiles"]["Row"];
type ColaboradorCargoRow = Database["public"]["Tables"]["module_colaborador_cargos"]["Row"];
type CostCenterRow = Database["public"]["Tables"]["cost_center"]["Row"];
type InternalProfileCostCenterRow =
  Database["public"]["Tables"]["internal_profile_cost_centers"]["Row"];

interface UserWithRole extends ProfileRow {
  role: UserType;
  accessLevel?: AccessLevel | null;
  superior_name?: string | null;
  cpf?: string | null;
  colaboradorProfile?: Pick<ColaboradorProfileRow, "cost_center_id" | "ativo" | "observacoes"> | null;
  colaboradorCargo?: Pick<
    ColaboradorCargoRow,
    "cargo_nome" | "area_nome" | "descricao" | "ativo"
  > | null;
  colaborador_cost_center_name?: string | null;
  internalCostCenters: Pick<InternalProfileCostCenterRow, "cost_center_id">[];
  internal_cost_center_names: string[];
}

type ColaboradorDraft = {
  cost_center_id: string;
  ativo: boolean;
  observacoes: string;
  cargo_nome: string;
  area_nome: string;
  descricao_cargo: string;
  cargo_ativo: boolean;
};

const EMPTY_COLABORADOR_DRAFT: ColaboradorDraft = {
  cost_center_id: "",
  ativo: true,
  observacoes: "",
  cargo_nome: "",
  area_nome: "",
  descricao_cargo: "",
  cargo_ativo: true,
};

const EMPTY_INTERNAL_COST_CENTER_IDS: string[] = [];

const userTypeOptions: UserType[] = ["candidato", "colaborador", "perfil_interno"];
const userTypeLabels: Record<UserType, string> = {
  candidato: "Candidato",
  colaborador: "Colaborador",
  perfil_interno: "Perfil interno",
};

const getUserTypeBadgeColor = (type: UserType) => {
  const colors: Record<UserType, string> = {
    candidato: "bg-gray-500",
    colaborador: "bg-blue-500",
    perfil_interno: "bg-indigo-600",
  };
  return colors[type] || "bg-gray-500";
};

const accessLevelOptions: AccessLevel[] = [
  "admin",
  "gestor_operacoes",
  "supervisor",
  "assistente_operacoes",
  "analista_centro_controle",
  "tecnico",
  "assistente_financeiro",
  "gestor_financeiro",
  "cliente_view",
];

const accessLevelLabels: Record<AccessLevel, string> = {
  admin: "Administrador",
  gestor_operacoes: "Gestor de Operacoes",
  supervisor: "Supervisor",
  assistente_operacoes: "Assistente de Operacoes",
  analista_centro_controle: "Analista Centro Controle",
  tecnico: "Tecnico",
  assistente_financeiro: "Assistente Financeiro",
  gestor_financeiro: "Gestor Financeiro",
  cliente_view: "Cliente (Visualizacao)",
};

const getAccessBadgeColor = (level: AccessLevel) => {
  const colors: Record<AccessLevel, string> = {
    admin: "bg-red-500",
    gestor_operacoes: "bg-purple-500",
    supervisor: "bg-blue-500",
    assistente_operacoes: "bg-sky-500",
    analista_centro_controle: "bg-cyan-500",
    tecnico: "bg-green-500",
    assistente_financeiro: "bg-amber-500",
    gestor_financeiro: "bg-orange-600",
    cliente_view: "bg-gray-500",
  };
  return colors[level] || "bg-gray-500";
};

const toggleValue = (values: string[], value: string) =>
  values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

const UserManagement = () => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenterRow[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserWithRole[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);
  const [updatingAccessId, setUpdatingAccessId] = useState<string | null>(null);
  const [updatingSuperiorId, setUpdatingSuperiorId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [colaboradorDialogOpen, setColaboradorDialogOpen] = useState(false);
  const [selectedColaboradorUser, setSelectedColaboradorUser] = useState<UserWithRole | null>(null);
  const [colaboradorDraft, setColaboradorDraft] = useState<ColaboradorDraft>(EMPTY_COLABORADOR_DRAFT);
  const [savingColaboradorRole, setSavingColaboradorRole] = useState(false);
  const [internalScopeDialogOpen, setInternalScopeDialogOpen] = useState(false);
  const [selectedInternalScopeUser, setSelectedInternalScopeUser] = useState<UserWithRole | null>(null);
  const [selectedInternalCostCenterIds, setSelectedInternalCostCenterIds] = useState<string[]>(
    EMPTY_INTERNAL_COST_CENTER_IDS
  );
  const [savingInternalScope, setSavingInternalScope] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAdminAndLoadUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [searchTerm, users]);

  const checkAdminAndLoadUsers = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: profileAccess, error: profileError } = await supabase
        .from("internal_profiles")
        .select("nivel_acesso")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (profileAccess?.nivel_acesso !== "admin") {
        toast({
          title: "Acesso negado",
          description: "Apenas administradores podem acessar esta pagina.",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      setIsAdmin(true);
      setAdminUserId(user.id);
      const centers = await loadCostCenters();
      await loadUsers(centers);
    } catch (error) {
      console.error("Erro ao verificar permissao:", error);
      toast({
        title: "Erro ao verificar permissao",
        description: "Nao foi possivel validar seu acesso.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async (centers: CostCenterRow[] = costCenters) => {
    try {
      const { data, error } = await supabase
        .from("usuarios")
        .select(`
          id,
          email,
          full_name,
          phone,
          role,
          superior,
          created_at,
          updated_at,
          internal_profiles (
            nivel_acesso,
            cpf
          ),
          internal_profile_cost_centers!internal_profile_cost_centers_user_id_fkey (
            cost_center_id
          ),
          colaborador_profiles!colaborador_profiles_user_id_fkey (
            cost_center_id,
            ativo,
            observacoes
          ),
          module_colaborador_cargos!module_colaborador_cargos_user_id_fkey (
            cargo_nome,
            area_nome,
            descricao,
            ativo
          )
        `)
        .order("full_name", { ascending: true });

      if (error) throw error;

      const nameMap = new Map<string, string | null>();
      (data || []).forEach((u: any) => {
        nameMap.set(u.id, u.full_name ?? null);
      });

      const usersWithRoles: UserWithRole[] =
        data?.map((user: any) => {
          const internalProfile = Array.isArray(user.internal_profiles)
            ? user.internal_profiles[0] ?? null
            : user.internal_profiles ?? null;
          const colaboradorProfile = Array.isArray(user.colaborador_profiles)
            ? user.colaborador_profiles[0] ?? null
            : user.colaborador_profiles ?? null;
          const colaboradorCargo = Array.isArray(user.module_colaborador_cargos)
            ? user.module_colaborador_cargos[0] ?? null
            : user.module_colaborador_cargos ?? null;
          const internalCostCenters = Array.isArray(user.internal_profile_cost_centers)
            ? user.internal_profile_cost_centers
            : user.internal_profile_cost_centers
              ? [user.internal_profile_cost_centers]
              : [];

          return {
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            phone: user.phone,
            role: user.role as UserType,
            accessLevel: internalProfile?.nivel_acesso || null,
            superior: user.superior ?? null,
            created_at: user.created_at,
            updated_at: user.updated_at,
            superior_name: user.superior ? nameMap.get(user.superior) ?? null : null,
            cpf: internalProfile?.cpf || null,
            colaboradorProfile,
            colaboradorCargo,
            colaborador_cost_center_name:
              centers.find((center) => center.id === colaboradorProfile?.cost_center_id)?.name ?? null,
            internalCostCenters,
            internal_cost_center_names: internalCostCenters
              .map((link: Pick<InternalProfileCostCenterRow, "cost_center_id">) =>
                centers.find((center) => center.id === link.cost_center_id)?.name ?? null
              )
              .filter((name: string | null): name is string => !!name),
          };
        }) || [];

      setUsers(usersWithRoles);
      setFilteredUsers(usersWithRoles);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar usuarios",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const loadCostCenters = async () => {
    const { data, error } = await supabase.from("cost_center").select("*").order("name");
    if (error) throw error;
    const nextCenters = (data || []) as CostCenterRow[];
    setCostCenters(nextCenters);
    return nextCenters;
  };

  const filterUsers = () => {
    if (!searchTerm.trim()) {
      setFilteredUsers(users);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = users.filter((user) => {
      const emailMatch = user.email?.toLowerCase().includes(term);
      const nameMatch = user.full_name?.toLowerCase().includes(term);
      return emailMatch || nameMatch;
    });
    setFilteredUsers(filtered);
  };

  const clearInternalCostCenterScope = async (userId: string) => {
    const { error } = await supabase
      .from("internal_profile_cost_centers")
      .delete()
      .eq("user_id", userId);

    if (error) throw error;
  };

  const handleOpenInternalScopeDialog = (user: UserWithRole) => {
    if (user.role !== "perfil_interno") return;
    if (!requiresInternalCostCenterScope(user.accessLevel)) {
      toast({
        title: "Escopo não aplicável",
        description: "Somente perfis internos operacionais usam vínculo por centro de custo.",
        variant: "destructive",
      });
      return;
    }

    setSelectedInternalScopeUser(user);
    setSelectedInternalCostCenterIds(user.internalCostCenters.map((link) => link.cost_center_id));
    setInternalScopeDialogOpen(true);
  };

  const handleSaveInternalScope = async () => {
    if (!selectedInternalScopeUser || !adminUserId) return;

    if (
      requiresInternalCostCenterScope(selectedInternalScopeUser.accessLevel) &&
      selectedInternalCostCenterIds.length === 0
    ) {
      toast({
        title: "Selecione ao menos um centro de custo",
        description: "Perfis internos operacionais precisam de ao menos um vínculo ativo.",
        variant: "destructive",
      });
      return;
    }

    setSavingInternalScope(true);
    try {
      const currentIds = new Set(
        selectedInternalScopeUser.internalCostCenters.map((link) => link.cost_center_id)
      );
      const nextIds = new Set(selectedInternalCostCenterIds);
      const idsToDelete = [...currentIds].filter((id) => !nextIds.has(id));
      const rowsToInsert = [...nextIds]
        .filter((id) => !currentIds.has(id))
        .map((costCenterId) => ({
          user_id: selectedInternalScopeUser.id,
          cost_center_id: costCenterId,
          created_by: adminUserId,
        }));

      if (idsToDelete.length > 0) {
        const { error } = await supabase
          .from("internal_profile_cost_centers")
          .delete()
          .eq("user_id", selectedInternalScopeUser.id)
          .in("cost_center_id", idsToDelete);

        if (error) throw error;
      }

      if (rowsToInsert.length > 0) {
        const { error } = await supabase
          .from("internal_profile_cost_centers")
          .insert(rowsToInsert);

        if (error) throw error;
      }

      toast({
        title: "Escopo atualizado",
        description: "Os vínculos de centro de custo foram salvos com sucesso.",
      });

      setInternalScopeDialogOpen(false);
      setSelectedInternalScopeUser(null);
      setSelectedInternalCostCenterIds(EMPTY_INTERNAL_COST_CENTER_IDS);
      await loadUsers();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar escopo",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingInternalScope(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserType) => {
    const current = users.find((u) => u.id === userId);
    if (!current || current.role === newRole) return;

    if (newRole === "colaborador") {
      setSelectedColaboradorUser(current);
      setColaboradorDraft({
        cost_center_id: current.colaboradorProfile?.cost_center_id ?? "",
        ativo: current.colaboradorProfile?.ativo ?? true,
        observacoes: current.colaboradorProfile?.observacoes ?? "",
        cargo_nome: current.colaboradorCargo?.cargo_nome ?? "",
        area_nome: current.colaboradorCargo?.area_nome ?? "",
        descricao_cargo: current.colaboradorCargo?.descricao ?? "",
        cargo_ativo: current.colaboradorCargo?.ativo ?? true,
      });
      setColaboradorDialogOpen(true);
      return;
    }

    const userName = current?.full_name || "o usuario";
    const confirmed = window.confirm(
      `Confirmar alteracao de perfil para ${userName}? O novo perfil sera: ${userTypeLabels[newRole]}.`
    );
    if (!confirmed) return;

    setUpdatingRoleId(userId);
    try {
      const updatePayload =
        newRole === "perfil_interno" ? { role: newRole } : { role: newRole, superior: null };
      const { error } = await supabase.from("usuarios").update(updatePayload).eq("id", userId);
      if (error) throw error;

      if (newRole !== "perfil_interno") {
        await clearInternalCostCenterScope(userId);
        const { error: deleteInternalError } = await supabase
          .from("internal_profiles")
          .delete()
          .eq("user_id", userId);
        if (deleteInternalError) throw deleteInternalError;
      }

      if (current.role === "colaborador") {
        const { error: deleteColaboradorProfileError } = await supabase
          .from("colaborador_profiles")
          .delete()
          .eq("user_id", userId);
        if (deleteColaboradorProfileError) throw deleteColaboradorProfileError;

        const { error: deleteColaboradorCargoError } = await supabase
          .from("module_colaborador_cargos")
          .delete()
          .eq("user_id", userId);
        if (deleteColaboradorCargoError) throw deleteColaboradorCargoError;
      }

      toast({
        title: "Perfil atualizado",
        description: "O perfil do usuario foi alterado com sucesso.",
      });

      await loadUsers();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar perfil",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUpdatingRoleId(null);
    }
  };

  const handleConfirmColaboradorRole = async () => {
    if (!selectedColaboradorUser || !adminUserId) return;
    if (!colaboradorDraft.cost_center_id) {
      toast({
        title: "Centro de custo obrigatório",
        description: "Selecione o centro de custo do colaborador.",
        variant: "destructive",
      });
      return;
    }
    if (!colaboradorDraft.cargo_nome.trim()) {
      toast({
        title: "Cargo obrigatorio",
        description: "Informe o cargo do usuario colaborador.",
        variant: "destructive",
      });
      return;
    }

    setSavingColaboradorRole(true);
    setUpdatingRoleId(selectedColaboradorUser.id);
    try {
      const { error: rpcError } = await supabase.rpc("definir_usuario_como_colaborador", {
        p_user_id: selectedColaboradorUser.id,
        p_cost_center_id: colaboradorDraft.cost_center_id,
      });
      if (rpcError) throw rpcError;

      const { error: updateColaboradorProfileError } = await supabase
        .from("colaborador_profiles")
        .update({
          ativo: colaboradorDraft.ativo,
          observacoes: colaboradorDraft.observacoes.trim() || null,
          updated_by: adminUserId,
        })
        .eq("user_id", selectedColaboradorUser.id);
      if (updateColaboradorProfileError) throw updateColaboradorProfileError;

      const { error: upsertCargoError } = await supabase
        .from("module_colaborador_cargos")
        .upsert(
          {
            user_id: selectedColaboradorUser.id,
            cargo_nome: colaboradorDraft.cargo_nome.trim(),
            area_nome: colaboradorDraft.area_nome.trim() || null,
            descricao: colaboradorDraft.descricao_cargo.trim() || null,
            ativo: colaboradorDraft.cargo_ativo,
          },
          { onConflict: "user_id" },
        );
      if (upsertCargoError) throw upsertCargoError;

      const { error: clearInternalProfileError } = await supabase
        .from("internal_profiles")
        .delete()
        .eq("user_id", selectedColaboradorUser.id);
      if (clearInternalProfileError) throw clearInternalProfileError;

      await clearInternalCostCenterScope(selectedColaboradorUser.id);

      const { error: clearSuperiorError } = await supabase
        .from("usuarios")
        .update({ superior: null })
        .eq("id", selectedColaboradorUser.id);
      if (clearSuperiorError) throw clearSuperiorError;

      toast({
        title: "Usuário promovido a colaborador",
        description: "Perfil e vínculo com centro de custo atualizados com sucesso.",
      });

      setColaboradorDialogOpen(false);
      setSelectedColaboradorUser(null);
      setColaboradorDraft(EMPTY_COLABORADOR_DRAFT);
      await loadUsers();
    } catch (error: any) {
      toast({
        title: "Erro ao definir colaborador",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingColaboradorRole(false);
      setUpdatingRoleId(null);
    }
  };

  const handleOpenColaboradorDialog = (user: UserWithRole) => {
    setSelectedColaboradorUser(user);
    setColaboradorDraft({
      cost_center_id: user.colaboradorProfile?.cost_center_id ?? "",
      ativo: user.colaboradorProfile?.ativo ?? true,
      observacoes: user.colaboradorProfile?.observacoes ?? "",
      cargo_nome: user.colaboradorCargo?.cargo_nome ?? "",
      area_nome: user.colaboradorCargo?.area_nome ?? "",
      descricao_cargo: user.colaboradorCargo?.descricao ?? "",
      cargo_ativo: user.colaboradorCargo?.ativo ?? true,
    });
    setColaboradorDialogOpen(true);
  };

  const handleAccessLevelChange = async (userId: string, newLevel: AccessLevel) => {
    const userName = users.find((u) => u.id === userId)?.full_name || "o usuario";
    const confirmed = window.confirm(
      `Confirmar nivel de acesso para ${userName}? Novo nivel: ${accessLevelLabels[newLevel]}.`,
    );
    if (!confirmed) return;

    setUpdatingAccessId(userId);
    try {
      const { error } = await supabase
        .from("internal_profiles")
        .upsert({ user_id: userId, nivel_acesso: newLevel }, { onConflict: "user_id" });
      if (error) throw error;

      if (!requiresInternalCostCenterScope(newLevel)) {
        await clearInternalCostCenterScope(userId);
      }

      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId
            ? {
                ...user,
                accessLevel: newLevel,
                internalCostCenters: requiresInternalCostCenterScope(newLevel)
                  ? user.internalCostCenters
                  : [],
                internal_cost_center_names: requiresInternalCostCenterScope(newLevel)
                  ? user.internal_cost_center_names
                  : [],
              }
            : user
        ),
      );
      toast({
        title: "Nivel de acesso atualizado",
        description: "O nivel de acesso interno foi salvo.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar nivel de acesso",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUpdatingAccessId(null);
    }
  };

  const handleSuperiorChange = async (userId: string, superiorId: string | null) => {
    const currentUser = users.find((u) => u.id === userId);
    if (!currentUser || currentUser.role !== "perfil_interno") {
      toast({
        title: "Superior indisponivel",
        description: "Apenas perfis internos podem ter superior definido.",
        variant: "destructive",
      });
      return;
    }

    const userName = currentUser.full_name || "o usuario";
    const superiorName = superiorId
      ? users.find((u) => u.id === superiorId)?.full_name || "superior selecionado"
      : "Sem superior";
    const confirmed = window.confirm(
      `Confirmar definicao de superior para ${userName}?\nNovo superior: ${superiorName}.`
    );
    if (!confirmed) return;

    setUpdatingSuperiorId(userId);
    try {
      const { error } = await supabase
        .from("usuarios")
        .update({ superior: superiorId || null })
        .eq("id", userId);

      if (error) throw error;

      const superiorNameResolved =
        superiorId ? users.find((u) => u.id === superiorId)?.full_name ?? null : null;

      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, superior: superiorId, superior_name: superiorNameResolved } : user
        )
      );

      toast({
        title: "Superior atualizado",
        description: "Superior definido com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar superior",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUpdatingSuperiorId(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setDeletingId(userId);
    try {
      const { error } = await supabase.from("usuarios").delete().eq("id", userId);
      if (error) throw error;

      setUsers((prev) => prev.filter((user) => user.id !== userId));
      setFilteredUsers((prev) => prev.filter((user) => user.id !== userId));

      toast({
        title: "Usuario removido",
        description: "O usuario foi excluido com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao excluir usuario",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card shadow-sm">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-primary to-accent rounded-lg">
                <Building2 className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Gestao de Usuarios</h1>
                <p className="text-sm text-muted-foreground">
                  Apenas administradores podem gerenciar perfis, cargos e superiores.
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-bold">Controle de permissoes e hierarquia</h2>
            </div>
            <p className="text-muted-foreground mb-6">
              Ajuste o papel de cada usuario, defina seu superior direto e, se necessario, remova usuarios.
            </p>

            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredUsers.map((user) => (
              <Card key={user.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <UserCog className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">
                          {user.full_name || "Sem nome"}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {user.email}
                        </CardDescription>
                        {user.phone && (
                          <p className="text-xs text-muted-foreground">{user.phone}</p>
                        )}
                      </div>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          disabled={deletingId === user.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir usuario</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acao nao pode ser desfeita. Deseja remover o usuario {user.full_name || user.email}?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteUser(user.id)}
                            disabled={deletingId === user.id}
                          >
                            {deletingId === user.id ? "Excluindo..." : "Excluir"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tipo de usuario</label>
                    <Select
                      value={user.role}
                      onValueChange={(value) => handleRoleChange(user.id, value as UserType)}
                      disabled={updatingRoleId === user.id}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {userTypeOptions.map((value) => (
                          <SelectItem key={value} value={value}>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${getUserTypeBadgeColor(value)}`} />
                              {userTypeLabels[value]}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Badge className={`${getUserTypeBadgeColor(user.role)} text-white`}>
                      {userTypeLabels[user.role]}
                    </Badge>
                  </div>

                  {user.role === "perfil_interno" && (
                    <>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Nivel de acesso interno</label>
                        <Select
                          value={user.accessLevel || ""}
                          onValueChange={(value) => handleAccessLevelChange(user.id, value as AccessLevel)}
                          disabled={updatingAccessId === user.id}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o nivel" />
                          </SelectTrigger>
                          <SelectContent>
                            {accessLevelOptions.map((value) => (
                              <SelectItem key={value} value={value}>
                                <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${getAccessBadgeColor(value)}`} />
                                  {accessLevelLabels[value]}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {user.accessLevel && (
                          <Badge className={`${getAccessBadgeColor(user.accessLevel)} text-white`}>
                            {accessLevelLabels[user.accessLevel]}
                          </Badge>
                        )}
                      </div>

                      <div className="space-y-3 rounded-md border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <label className="text-sm font-medium">Escopo por centro de custo</label>
                            <p className="text-xs text-muted-foreground">
                              Admin tem acesso total. Perfis operacionais precisam de vÃ­nculos explÃ­citos.
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenInternalScopeDialog(user)}
                            disabled={!requiresInternalCostCenterScope(user.accessLevel) || savingInternalScope}
                          >
                            Gerenciar
                          </Button>
                        </div>

                        {requiresInternalCostCenterScope(user.accessLevel) ? (
                          user.internal_cost_center_names.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {user.internal_cost_center_names.map((centerName) => (
                                <Badge key={`${user.id}-${centerName}`} variant="secondary">
                                  {centerName}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-amber-700">
                              Nenhum centro de custo vinculado para este perfil operacional.
                            </p>
                          )
                        ) : user.accessLevel === "admin" ? (
                          <p className="text-xs text-muted-foreground">
                            Administradores nÃ£o dependem de vÃ­nculo por centro de custo.
                          </p>
                        ) : user.accessLevel === "cliente_view" ? (
                          <p className="text-xs text-muted-foreground">
                            Cliente view nÃ£o utiliza escopo operacional por centro de custo.
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Defina primeiro o nÃ­vel de acesso interno para configurar o escopo.
                          </p>
                        )}
                      </div>
                    </>
                  )}

                  {user.role === "colaborador" && (
                    <div className="space-y-3 rounded-md border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <label className="text-sm font-medium">Perfil de colaborador</label>
                          <p className="text-xs text-muted-foreground">
                            Defina centro de custo, status e cargo operacional do colaborador.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenColaboradorDialog(user)}
                          disabled={savingColaboradorRole}
                        >
                          Editar
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Centro de custo: {user.colaborador_cost_center_name || "Não vinculado"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Status: {user.colaboradorProfile?.ativo ? "Ativo" : "Inativo"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Cargo: {user.colaboradorCargo?.cargo_nome || "Nao definido"}
                      </p>
                      {user.colaboradorCargo?.area_nome && (
                        <p className="text-sm text-muted-foreground">
                          Area: {user.colaboradorCargo.area_nome}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        Cargo ativo: {user.colaboradorCargo?.ativo ? "Sim" : "Nao"}
                      </p>
                      {user.colaboradorCargo?.descricao && (
                        <p className="text-sm text-muted-foreground">
                          Descricao do cargo: {user.colaboradorCargo.descricao}
                        </p>
                      )}
                      {user.colaboradorProfile?.observacoes && (
                        <p className="text-sm text-muted-foreground">
                          Observações: {user.colaboradorProfile.observacoes}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Superior imediato</label>
                    {user.role === "perfil_interno" ? (
                      <>
                        <Select
                          value={user.superior || "none"}
                          onValueChange={(value) => handleSuperiorChange(user.id, value === "none" ? null : value)}
                          disabled={updatingSuperiorId === user.id}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o superior" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sem superior</SelectItem>
                            {users
                              .filter((u) => u.id !== user.id)
                              .map((candidate) => (
                                <SelectItem key={candidate.id} value={candidate.id}>
                                  {candidate.full_name || candidate.email}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        {user.superior_name && (
                          <p className="text-xs text-muted-foreground">
                            Atual: {user.superior_name}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Nao aplicavel para candidatos ou colaboradores.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredUsers.length === 0 && (
            <Card className="mt-8">
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  Nenhum usuario encontrado com os filtros aplicados.
                </p>
              </CardContent>
            </Card>
          )}
        </main>

        <Dialog
          open={colaboradorDialogOpen}
          onOpenChange={(open) => {
            setColaboradorDialogOpen(open);
            if (!open) {
              setSelectedColaboradorUser(null);
              setColaboradorDraft(EMPTY_COLABORADOR_DRAFT);
            }
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Definir usuário como colaborador</DialogTitle>
              <DialogDescription>
                Informe os dados obrigatórios do perfil de colaborador antes de concluir a troca de role.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Usuário</label>
                <Input
                  value={selectedColaboradorUser?.full_name || selectedColaboradorUser?.email || ""}
                  disabled
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Centro de custo</label>
                <Select
                  value={colaboradorDraft.cost_center_id}
                  onValueChange={(value) =>
                    setColaboradorDraft((prev) => ({ ...prev, cost_center_id: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o centro de custo" />
                  </SelectTrigger>
                  <SelectContent>
                    {costCenters.map((center) => (
                      <SelectItem key={center.id} value={center.id}>
                        {center.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Cargo</label>
                  <Input
                    value={colaboradorDraft.cargo_nome}
                    onChange={(event) =>
                      setColaboradorDraft((prev) => ({ ...prev, cargo_nome: event.target.value }))
                    }
                    placeholder="Ex.: Auxiliar operacional"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Area</label>
                  <Input
                    value={colaboradorDraft.area_nome}
                    onChange={(event) =>
                      setColaboradorDraft((prev) => ({ ...prev, area_nome: event.target.value }))
                    }
                    placeholder="Ex.: Operacoes"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Descricao do cargo</label>
                <Textarea
                  rows={3}
                  value={colaboradorDraft.descricao_cargo}
                  onChange={(event) =>
                    setColaboradorDraft((prev) => ({
                      ...prev,
                      descricao_cargo: event.target.value,
                    }))
                  }
                  placeholder="Resumo das responsabilidades ou observacoes do cargo."
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Observações</label>
                <Textarea
                  rows={4}
                  value={colaboradorDraft.observacoes}
                  onChange={(event) =>
                    setColaboradorDraft((prev) => ({ ...prev, observacoes: event.target.value }))
                  }
                  placeholder="Informações adicionais sobre o vínculo do colaborador."
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm">
                  <Switch
                    checked={colaboradorDraft.ativo}
                    onCheckedChange={(checked) =>
                      setColaboradorDraft((prev) => ({ ...prev, ativo: checked }))
                    }
                  />
                  Perfil de colaborador ativo
                </label>

                <label className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm">
                  <Switch
                    checked={colaboradorDraft.cargo_ativo}
                    onCheckedChange={(checked) =>
                      setColaboradorDraft((prev) => ({ ...prev, cargo_ativo: checked }))
                    }
                  />
                  Cargo ativo no modulo
                </label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setColaboradorDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleConfirmColaboradorRole} disabled={savingColaboradorRole}>
                {savingColaboradorRole ? "Salvando..." : "Confirmar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={internalScopeDialogOpen}
          onOpenChange={(open) => {
            setInternalScopeDialogOpen(open);
            if (!open) {
              setSelectedInternalScopeUser(null);
              setSelectedInternalCostCenterIds(EMPTY_INTERNAL_COST_CENTER_IDS);
            }
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Vincular centros de custo</DialogTitle>
              <DialogDescription>
                Defina os centros de custo disponÃ­veis para o perfil interno operacional selecionado.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">UsuÃ¡rio</label>
                <Input
                  value={selectedInternalScopeUser?.full_name || selectedInternalScopeUser?.email || ""}
                  disabled
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Centros de custo vinculados</label>
                <div className="max-h-80 space-y-2 overflow-auto rounded-md border p-3">
                  {costCenters.length > 0 ? (
                    costCenters.map((center) => {
                      const checked = selectedInternalCostCenterIds.includes(center.id);

                      return (
                        <label
                          key={center.id}
                          className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() =>
                              setSelectedInternalCostCenterIds((prev) => toggleValue(prev, center.id))
                            }
                          />
                          <span>{center.name}</span>
                        </label>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nenhum centro de custo cadastrado.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setInternalScopeDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveInternalScope} disabled={savingInternalScope}>
                {savingInternalScope ? "Salvando..." : "Salvar vínculos"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default UserManagement;
