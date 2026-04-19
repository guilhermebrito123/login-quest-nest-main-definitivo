import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Copy, KeyRound, Loader2, RefreshCw, ShieldCheck, ShieldX } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface RecoveryRequest {
  id: string;
  user_id: string | null;
  requested_identifier: string;
  status: string;
  reason: string | null;
  opened_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  rejection_reason: string | null;
  ip: string | null;
  usuario?: { full_name: string | null; email: string } | null;
}

const statusLabels: Record<string, { label: string; variant: NonNullable<BadgeProps["variant"]> }> = {
  pending: { label: "Pendente", variant: "secondary" },
  approved: { label: "Aprovado", variant: "default" },
  rejected: { label: "Rejeitado", variant: "destructive" },
  consumed: { label: "Concluido", variant: "outline" },
  expired: { label: "Expirado", variant: "outline" },
};

const RecuperacoesAdmin = () => {
  const [requests, setRequests] = useState<RecoveryRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; requestId: string | null }>({
    open: false,
    requestId: null,
  });
  const [rejectReason, setRejectReason] = useState("");
  const [approvedDialog, setApprovedDialog] = useState<{
    open: boolean;
    link: string;
    expiresInMinutes: number;
  }>({ open: false, link: "", expiresInMinutes: 0 });
  const { toast } = useToast();

  const checkAdmin = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setIsAdmin(false);
      return false;
    }

    const { data: profile } = await supabase
      .from("internal_profiles")
      .select("nivel_acesso")
      .eq("user_id", user.id)
      .maybeSingle();

    const admin = profile?.nivel_acesso === "admin";
    setIsAdmin(admin);
    return admin;
  };

  const loadRequests = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("account_recovery_requests")
      .select("*")
      .order("opened_at", { ascending: false })
      .limit(100);

    if (error) {
      toast({
        title: "Erro ao carregar pedidos",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const userIds = [...new Set((data || []).map((row) => row.user_id).filter(Boolean))] as string[];
    let usuariosMap: Record<string, { full_name: string | null; email: string }> = {};

    if (userIds.length > 0) {
      const { data: usuarios } = await supabase
        .from("usuarios")
        .select("id, full_name, email")
        .in("id", userIds);

      usuariosMap = Object.fromEntries(
        (usuarios || []).map((usuario) => [usuario.id, { full_name: usuario.full_name, email: usuario.email }]),
      );
    }

    setRequests(
      (data || []).map((row) => ({
        ...row,
        usuario: row.user_id ? usuariosMap[row.user_id] ?? null : null,
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    void (async () => {
      const admin = await checkAdmin();
      if (admin) {
        await loadRequests();
      } else {
        setLoading(false);
      }
    })();
  }, []);

  const handleApprove = async (requestId: string) => {
    setActionLoading(requestId);

    try {
      const { data, error } = await supabase.functions.invoke("approve-manual-recovery", {
        body: { requestId, approve: true },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const fullLink = `${window.location.origin}${data.recovery_link}`;

      setApprovedDialog({
        open: true,
        link: fullLink,
        expiresInMinutes: data.expires_in_minutes,
      });

      toast({
        title: "Pedido aprovado",
        description: "O usuario foi notificado e o link foi gerado.",
      });

      await loadRequests();
    } catch (error: any) {
      toast({
        title: "Erro ao aprovar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectDialog.requestId) return;

    setActionLoading(rejectDialog.requestId);

    try {
      const { data, error } = await supabase.functions.invoke("approve-manual-recovery", {
        body: {
          requestId: rejectDialog.requestId,
          approve: false,
          rejectionReason: rejectReason || null,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Pedido rejeitado",
        description: "O usuario sera notificado.",
      });

      setRejectDialog({ open: false, requestId: null });
      setRejectReason("");
      await loadRequests();
    } catch (error: any) {
      toast({
        title: "Erro ao rejeitar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(approvedDialog.link);
    toast({ title: "Link copiado!" });
  };

  if (isAdmin === null || loading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <Card className="m-6">
          <CardHeader>
            <CardTitle>Acesso negado</CardTitle>
            <CardDescription>Apenas administradores podem acessar esta pagina.</CardDescription>
          </CardHeader>
        </Card>
      </DashboardLayout>
    );
  }

  const pendingCount = requests.filter((request) => request.status === "pending").length;

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold">
              <KeyRound className="h-7 w-7 text-primary" />
              Pedidos de Recuperacao de Acesso
            </h1>
            <p className="mt-1 text-muted-foreground">
              {pendingCount} pendente{pendingCount !== 1 ? "s" : ""} de analise
            </p>
          </div>
          <Button variant="outline" onClick={() => void loadRequests()} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Identificador</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Aberto em</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      Nenhum pedido de recuperacao encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  requests.map((request) => {
                    const status = statusLabels[request.status] ?? {
                      label: request.status,
                      variant: "outline" as const,
                    };
                    const isPending = request.status === "pending";
                    const userExists = !!request.user_id;

                    return (
                      <TableRow key={request.id}>
                        <TableCell>
                          {request.usuario ? (
                            <div>
                              <div className="font-medium">{request.usuario.full_name ?? "-"}</div>
                              <div className="text-xs text-muted-foreground">{request.usuario.email}</div>
                            </div>
                          ) : (
                            <span className="italic text-muted-foreground">Conta nao encontrada</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{request.requested_identifier}</TableCell>
                        <TableCell className="max-w-xs truncate" title={request.reason ?? undefined}>
                          {request.reason || <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(request.opened_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                        <TableCell className="space-x-2 text-right">
                          {isPending && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => void handleApprove(request.id)}
                                disabled={!userExists || actionLoading === request.id}
                                title={!userExists ? "Conta nao encontrada - nao e possivel aprovar" : ""}
                              >
                                {actionLoading === request.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <ShieldCheck className="mr-1 h-4 w-4" />
                                    Aprovar
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => setRejectDialog({ open: true, requestId: request.id })}
                                disabled={actionLoading === request.id}
                              >
                                <ShieldX className="mr-1 h-4 w-4" />
                                Rejeitar
                              </Button>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <AlertDialog
        open={rejectDialog.open}
        onOpenChange={(open) => !open && setRejectDialog({ open: false, requestId: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rejeitar pedido de recuperacao?</AlertDialogTitle>
            <AlertDialogDescription>
              O usuario sera notificado de que o pedido foi rejeitado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Motivo (opcional)</Label>
            <Textarea
              id="reject-reason"
              placeholder="Ex: Identidade nao confirmada..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleReject()} className="bg-destructive hover:bg-destructive/90">
              Rejeitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={approvedDialog.open}
        onOpenChange={(open) => !open && setApprovedDialog({ open: false, link: "", expiresInMinutes: 0 })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pedido aprovado</DialogTitle>
            <DialogDescription>
              O usuario recebeu uma notificacao no sistema com o link para definir uma nova senha.
              Voce tambem pode copiar o link abaixo e enviar por canal interno seguro.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Link de redefinicao (valido por {approvedDialog.expiresInMinutes} minutos)</Label>
            <div className="flex gap-2">
              <input
                readOnly
                value={approvedDialog.link}
                className="flex-1 rounded-md border bg-muted px-3 py-2 text-sm font-mono"
              />
              <Button size="icon" variant="outline" onClick={() => void copyLink()}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setApprovedDialog({ open: false, link: "", expiresInMinutes: 0 })}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default RecuperacoesAdmin;
