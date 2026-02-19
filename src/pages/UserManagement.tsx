import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
import { useToast } from "@/hooks/use-toast";
import { Building2, Search, Shield, UserCog, Trash2 } from "lucide-react";

type UserType = Database["public"]["Enums"]["user_type"];
type AccessLevel = Database["public"]["Enums"]["internal_access_level"];
type ProfileRow = Database["public"]["Tables"]["usuarios"]["Row"];

interface UserWithRole extends ProfileRow {
  role: UserType;
  accessLevel?: AccessLevel | null;
  superior_name?: string | null;
  cpf?: string | null;
}

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

const UserManagement = () => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserWithRole[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);
  const [updatingAccessId, setUpdatingAccessId] = useState<string | null>(null);
  const [updatingSuperiorId, setUpdatingSuperiorId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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
      await loadUsers();
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

  const loadUsers = async () => {
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
          )
        `)
        .order("full_name", { ascending: true });

      if (error) throw error;

      const nameMap = new Map<string, string | null>();
      (data || []).forEach((u: any) => {
        nameMap.set(u.id, u.full_name ?? null);
      });

      const usersWithRoles: UserWithRole[] =
        data?.map((user: any) => ({
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          phone: user.phone,
          role: user.role as UserType,
          accessLevel: user.internal_profiles?.[0]?.nivel_acesso || null,
          superior: user.superior ?? null,
          created_at: user.created_at,
          updated_at: user.updated_at,
          superior_name: user.superior ? nameMap.get(user.superior) ?? null : null,
          cpf: user.internal_profiles?.[0]?.cpf || null,
        })) || [];

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

  const handleRoleChange = async (userId: string, newRole: UserType) => {
    const current = users.find((u) => u.id === userId);
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

      setUsers((prev) =>
        prev.map((user) => (user.id === userId ? { ...user, accessLevel: newLevel } : user)),
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
      </div>
    </DashboardLayout>
  );
};

export default UserManagement;
