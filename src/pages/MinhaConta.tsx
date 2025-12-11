import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { DashboardLayout } from "@/components/DashboardLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, ShieldOff, Trash2, UserCog } from "lucide-react";

type Profile = Tables<"profiles">;

export default function MinhaConta() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userId, setUserId] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        navigate("/auth");
        return;
      }

      setUserId(user.id);
      setAuthEmail(user.email || "");

      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileError) {
        throw profileError;
      }

      setProfile(data);
    } catch (error: any) {
      console.error("Erro ao carregar perfil", error);
      toast.error(error.message || "Nao foi possivel carregar seus dados");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile || !userId) return;

    setSaving(true);
    try {
      const trimmedEmail = profile.email?.trim();
      if (!trimmedEmail) {
        throw new Error("Informe um email valido");
      }

      const updates = {
        full_name: profile.full_name?.trim() || null,
        phone: profile.phone?.trim() || null,
        email: trimmedEmail,
      };

      if (trimmedEmail !== authEmail) {
        const { error: authError } = await supabase.auth.updateUser({
          email: trimmedEmail,
        });

        if (authError) {
          throw authError;
        }

        setAuthEmail(trimmedEmail);
      }

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", userId);

      if (error) {
        throw error;
      }

      setProfile((current) => (current ? { ...current, ...updates } : current));
      toast.success("Dados atualizados");
    } catch (error: any) {
      console.error("Erro ao atualizar perfil", error);
      toast.error(error.message || "Nao foi possivel salvar as alteracoes");
    } finally {
      setSaving(false);
    }
  };

  const handlePrepareDelete = () => {
    if (!password.trim()) {
      toast.error("Digite sua senha para continuar");
      return;
    }

    setConfirmDeleteOpen(true);
  };

  const handleDeleteAccount = async () => {
    if (!profile?.email) {
      toast.error("Email do perfil nao encontrado");
      return;
    }

    setDeleting(true);
    try {
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password,
      });

      if (reauthError) {
        throw reauthError;
      }

      const { data, error } = await supabase.functions.invoke("delete-account");

      if (error) {
        throw error;
      }

      if (data?.profileDeleted === false && data?.profileError) {
        toast.warning(
          "Conta removida do acesso. Nao foi possivel limpar todos os dados do perfil."
        );
      } else {
        toast.success("Conta excluida com sucesso");
      }

      setDeleteDialogOpen(false);
      setConfirmDeleteOpen(false);
      setPassword("");
      await supabase.auth.signOut();
      navigate("/auth");
    } catch (error: any) {
      console.error("Erro ao excluir conta", error);
      toast.error(error.message || "Nao foi possivel excluir a conta");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Preferencias</p>
            <h1 className="text-3xl font-semibold">Minha conta</h1>
            <p className="text-muted-foreground">
              Visualize e edite seus dados pessoais. Senha, id e datas de
              criacao/atualizacao sao mantidos fora desta tela.
            </p>
          </div>
          <div className="p-3 rounded-full bg-primary/10">
            <UserCog className="h-6 w-6 text-primary" />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Dados do perfil</CardTitle>
            <CardDescription>
              Informacoes carregadas da tabela de profiles do usuario logado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Carregando dados...</span>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleUpdateProfile}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Nome completo</Label>
                    <Input
                      id="full_name"
                      value={profile?.full_name || ""}
                      onChange={(event) =>
                        setProfile((current) =>
                          current
                            ? { ...current, full_name: event.target.value }
                            : current
                        )
                      }
                      disabled={saving}
                      placeholder="Seu nome"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profile?.email || ""}
                      onChange={(event) =>
                        setProfile((current) =>
                          current
                            ? { ...current, email: event.target.value }
                            : current
                        )
                      }
                      disabled={saving}
                      placeholder="seu@email.com"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    value={profile?.phone || ""}
                    onChange={(event) =>
                      setProfile((current) =>
                        current
                          ? { ...current, phone: event.target.value }
                          : current
                      )
                    }
                    disabled={saving}
                    placeholder="(00) 00000-0000"
                  />
                  <p className="text-xs text-muted-foreground">
                    Telefone atual: {profile?.phone || "Nao informado"}
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={loadProfile}
                    disabled={saving}
                  >
                    Recarregar
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      "Salvar alteracoes"
                    )}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <ShieldOff className="h-5 w-5" />
              Zona de risco
            </CardTitle>
            <CardDescription>
              Remova permanentemente seu acesso. Voce precisara informar sua
              senha antes de confirmar.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              Esta acao remove seu usuario autenticado e tenta limpar os dados
              do seu perfil. Avalie antes de prosseguir.
            </div>
            <Button
              variant="destructive"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir conta
            </Button>
          </CardContent>
        </Card>

        <Dialog
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            setDeleteDialogOpen(open);
            if (!open) {
              setPassword("");
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Confirmar identidade</DialogTitle>
              <DialogDescription>
                Digite sua senha para habilitar a exclusao da conta.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="delete-password">Senha</Label>
              <Input
                id="delete-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Sua senha atual"
                disabled={deleting}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
                disabled={deleting}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handlePrepareDelete}
                disabled={deleting}
              >
                Continuar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Deseja mesmo excluir a conta?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta operacao nao pode ser desfeita. Confirme para finalizar a
                exclusao definitiva.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleDeleteAccount}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  "Sim, excluir"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
