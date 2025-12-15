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

type AppRole = Database["public"]["Enums"]["app_role"];
type ProfileRow = Database["public"]["Tables"]["usuarios"]["Row"];

interface UserWithRole extends ProfileRow {
  role: AppRole;
  superior_name?: string | null;
}

const roleOptions: AppRole[] = [
  "admin",
  "gestor_operacoes",
  "supervisor",
  "analista_centro_controle",
  "tecnico",
  "cliente_view",
];

const roleLabels: Record<AppRole, string> = {
  admin: "Administrador",
  gestor_operacoes: "Gestor de Operacoes",
  supervisor: "Supervisor",
  analista_centro_controle: "Analista Centro Controle",
  tecnico: "Tecnico",
  cliente_view: "Cliente (Visualizacao)",
};

const getRoleBadgeColor = (role: AppRole) => {
  const colors: Record<AppRole, string> = {
    admin: "bg-red-500",
    gestor_operacoes: "bg-purple-500",
    supervisor: "bg-blue-500",
    analista_centro_controle: "bg-cyan-500",
    tecnico: "bg-green-500",
    cliente_view: "bg-gray-500",
  };
  return colors[role] || "bg-gray-500";
};

const UserManagement = () => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserWithRole[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);
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

      const { data: roleData, error: roleError } = await supabase
        .from("usuarios")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (roleError) throw roleError;

      if (roleData?.role !== "admin") {
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
          updated_at
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
          role: user.role as AppRole,
          superior: user.superior ?? null,
          created_at: user.created_at,
          updated_at: user.updated_at,
          superior_name: user.superior ? nameMap.get(user.superior) ?? null : null,
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

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    const userName = users.find((u) => u.id === userId)?.full_name || "o usuario";
    const confirmed = window.confirm(
      `Confirmar alteracao de perfil para ${userName}? O novo perfil sera: ${roleLabels[newRole]}.`
    );
    if (!confirmed) return;

    setUpdatingRoleId(userId);
    try {
      const { error } = await supabase
        .from("usuarios")
        .update({ role: newRole })
        .eq("id", userId);

      if (error) throw error;

      toast({
        title: "Perfil atualizado",
        description: "O perfil do usuario foi alterado com sucesso.",
      });

      setUsers((prev) =>
        prev.map((user) => (user.id === userId ? { ...user, role: newRole } : user))
      );
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

  const handleSuperiorChange = async (userId: string, superiorId: string | null) => {
    const userName = users.find((u) => u.id === userId)?.full_name || "o usuario";
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
                    <label className="text-sm font-medium">Perfil de acesso</label>
                    <Select
                      value={user.role}
                      onValueChange={(value) => handleRoleChange(user.id, value as AppRole)}
                      disabled={updatingRoleId === user.id}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o perfil" />
                      </SelectTrigger>
                      <SelectContent>
                        {roleOptions.map((value) => (
                          <SelectItem key={value} value={value}>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${getRoleBadgeColor(value)}`} />
                              {roleLabels[value]}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Badge className={`${getRoleBadgeColor(user.role)} text-white`}>
                      {roleLabels[user.role]}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Superior imediato</label>
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
