import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Mail, Phone, User, Trash2, Edit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

interface ClienteCardProps {
  cliente: {
    id: string;
    razao_social: string;
    nome_fantasia: string | null;
    cnpj: string;
    contato_nome: string | null;
    contato_email: string | null;
    contato_telefone: string | null;
    itens_adicionais: string | null;
  };
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

type Subitem = {
  id: string;
  nome: string;
  valor_unitario: number | null;
  observacao: string | null;
  created_at?: string;
};

const ClienteCard = ({ cliente, onSelect, onEdit, onDelete }: ClienteCardProps) => {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [subitens, setSubitens] = useState<Subitem[]>([]);
  const [loadingSubitens, setLoadingSubitens] = useState(false);
  const [savingSubitem, setSavingSubitem] = useState(false);
  const [updatingSubitemId, setUpdatingSubitemId] = useState<string | null>(null);
  const [subitemForm, setSubitemForm] = useState({
    nome: "",
    valor_unitario: "",
    observacao: "",
  });
  const [subitemEdits, setSubitemEdits] = useState<Record<string, { nome: string; valor_unitario: string; observacao: string }>>({});

  const handleDelete = async () => {
    try {
      // Check for related contracts
      const clienteId = Number(cliente.id) || cliente.id;
      const { data: contratos } = await supabase
        .from("contratos")
        .select("id")
        .eq("cliente_id", clienteId)
        .limit(1);

      if (contratos && contratos.length > 0) {
        toast({
          title: "Não é possível excluir",
          description: "Este cliente possui contratos relacionados. Exclua os contratos primeiro.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from("clientes")
        .delete()
        .eq("id", clienteId);

      if (error) throw error;

      toast({
        title: "Cliente excluído",
        description: "Cliente excluído com sucesso",
      });
      onDelete();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (detailsOpen && cliente.itens_adicionais) {
      fetchSubitens();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailsOpen, cliente.id, cliente.itens_adicionais]);

  useEffect(() => {
    if (editOpen && cliente.itens_adicionais) {
      fetchSubitens();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editOpen, cliente.id, cliente.itens_adicionais]);

  const fetchSubitens = async () => {
    try {
      setLoadingSubitens(true);
      const clienteId = Number(cliente.id) || cliente.id;
      const { data, error } = await supabase
        .from("subitens")
        .select("id, nome, valor_unitario, observacao, created_at")
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const list = (data as Subitem[]) || [];
      setSubitens(list);
      const mapped: Record<string, { nome: string; valor_unitario: string; observacao: string }> = {};
      list.forEach((item) => {
        mapped[item.id] = {
          nome: item.nome || "",
          valor_unitario: item.valor_unitario != null ? item.valor_unitario.toString() : "",
          observacao: item.observacao || "",
        };
      });
      setSubitemEdits(mapped);
    } catch (error: any) {
      toast({
        title: "Erro ao buscar subitens",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingSubitens(false);
    }
  };

  const handleAddSubitem = async () => {
    if (!subitemForm.nome.trim()) {
      toast({
        title: "Informe o nome",
        description: "O campo nome do subitem é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSavingSubitem(true);
      const clienteId = Number(cliente.id) || cliente.id;
      const valor = subitemForm.valor_unitario
        ? parseFloat(subitemForm.valor_unitario.replace(",", "."))
        : null;

      const { data, error } = await supabase
        .from("subitens")
        .insert({
          nome: subitemForm.nome.trim(),
          cliente_id: clienteId,
          valor_unitario: valor,
          observacao: subitemForm.observacao.trim() || null,
        })
        .select("id, nome, valor_unitario, observacao, created_at")
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSubitens((prev) => [data as Subitem, ...prev]);
      }

      setSubitemForm({ nome: "", valor_unitario: "", observacao: "" });
      toast({ title: "Subitem adicionado" });
    } catch (error: any) {
      toast({
        title: "Erro ao adicionar subitem",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingSubitem(false);
    }
  };

  const handleDeleteSubitem = async (id: string) => {
    try {
      const { error } = await supabase.from("subitens").delete().eq("id", id);
      if (error) throw error;
      setSubitens((prev) => prev.filter((item) => item.id !== id));
      setSubitemEdits((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      toast({ title: "Subitem removido" });
    } catch (error: any) {
      toast({
        title: "Erro ao remover subitem",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleUpdateSubitem = async (id: string) => {
    const edits = subitemEdits[id];
    if (!edits) return;
    if (!edits.nome.trim()) {
      toast({
        title: "Informe o nome",
        description: "O campo nome do subitem é obrigatório.",
        variant: "destructive",
      });
      return;
    }
    try {
      setUpdatingSubitemId(id);
      const valor = edits.valor_unitario ? parseFloat(edits.valor_unitario.replace(",", ".")) : null;
      const { data, error } = await supabase
        .from("subitens")
        .update({
          nome: edits.nome.trim(),
          valor_unitario: valor,
          observacao: edits.observacao.trim() || null,
        })
        .eq("id", id)
        .select("id, nome, valor_unitario, observacao, created_at")
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setSubitens((prev) => prev.map((item) => (item.id === id ? (data as Subitem) : item)));
      }
      toast({ title: "Subitem atualizado" });
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar subitem",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUpdatingSubitemId(null);
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow cursor-pointer">
      <CardHeader onClick={onSelect}>
        <div className="flex items-start gap-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">{cliente.razao_social}</CardTitle>
            {cliente.nome_fantasia && (
              <p className="text-xs text-muted-foreground">{cliente.nome_fantasia}</p>
            )}
            <p className="text-sm text-muted-foreground">{cliente.cnpj}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {cliente.contato_nome && (
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{cliente.contato_nome}</span>
            </div>
          )}
          {cliente.contato_email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{cliente.contato_email}</span>
            </div>
          )}
          {cliente.contato_telefone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{cliente.contato_telefone}</span>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={(e) => {
                e.stopPropagation();
                setDetailsOpen(true);
              }}
          >
            Detalhes
          </Button>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>{cliente.razao_social}</DialogTitle>
                <DialogDescription>
                  Informações do cliente e itens adicionais.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Nome fantasia</p>
                    <p className="font-medium">{cliente.nome_fantasia || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">CNPJ</p>
                    <p className="font-medium">{cliente.cnpj}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Contato</p>
                    <p className="font-medium">{cliente.contato_nome || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Telefone</p>
                    <p className="font-medium">{cliente.contato_telefone || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Email</p>
                    <p className="font-medium">{cliente.contato_email || "-"}</p>
                  </div>
                </div>

                {cliente.itens_adicionais ? (
                  <div className="space-y-3 rounded-md border p-3">
                    <div>
                      <p className="text-muted-foreground text-sm">Itens adicionais</p>
                      <p className="font-medium break-words">{cliente.itens_adicionais}</p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm">Subitens</h4>
                      {loadingSubitens ? (
                        <p className="text-sm text-muted-foreground">Carregando subitens...</p>
                      ) : subitens.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum subitem cadastrado.</p>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {subitens.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-start justify-between gap-2 rounded-md border px-3 py-2"
                            >
                              <div className="space-y-1 text-sm">
                                <p className="font-medium">{item.nome}</p>
                                {item.valor_unitario != null && (
                                  <p className="text-muted-foreground">
                                    Valor: R$ {item.valor_unitario.toFixed(2)}
                                  </p>
                                )}
                                {item.observacao && (
                                  <p className="text-muted-foreground break-words">
                                    {item.observacao}
                                  </p>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleDeleteSubitem(item.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <p className="font-semibold text-sm">Adicionar subitem</p>
                      <Input
                        placeholder="Nome do subitem"
                        value={subitemForm.nome}
                        onChange={(e) => setSubitemForm((prev) => ({ ...prev, nome: e.target.value }))}
                      />
                      <Input
                        placeholder="Valor unitário (opcional)"
                        type="number"
                        step="0.01"
                        value={subitemForm.valor_unitario}
                        onChange={(e) =>
                          setSubitemForm((prev) => ({ ...prev, valor_unitario: e.target.value }))
                        }
                      />
                      <Textarea
                        placeholder="Observação (opcional)"
                        value={subitemForm.observacao}
                        onChange={(e) =>
                          setSubitemForm((prev) => ({ ...prev, observacao: e.target.value }))
                        }
                      />
                      <Button onClick={handleAddSubitem} disabled={savingSubitem}>
                        {savingSubitem ? "Salvando..." : "Adicionar subitem"}
                      </Button>
                    </div>

                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhum item adicional definido para este cliente.
                  </p>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailsOpen(false)}>
                  Fechar
                </Button>
              </DialogFooter>
          </DialogContent>
          </Dialog>
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={(e) => {
                e.stopPropagation();
                setEditOpen(true);
              }}
            >
              <Edit className="h-3 w-3 mr-1" />
              Editar
            </Button>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Editar cliente e subitens</DialogTitle>
                <DialogDescription>
                  Ajuste os dados do cliente na tela própria e edite subitens vinculados aqui.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex justify-between items-center gap-2 rounded-md border p-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Dados do cliente</p>
                    <p className="font-medium">{cliente.razao_social}</p>
                  </div>
                  <Button variant="secondary" onClick={onEdit}>
                    Abrir edição do cliente
                  </Button>
                </div>

                {cliente.itens_adicionais ? (
                  <div className="space-y-3 rounded-md border p-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Itens adicionais</p>
                      <p className="font-medium break-words">{cliente.itens_adicionais}</p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm">Subitens</h4>
                      {loadingSubitens ? (
                        <p className="text-sm text-muted-foreground">Carregando subitens...</p>
                      ) : subitens.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum subitem cadastrado.</p>
                      ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                          {subitens.map((item) => {
                            const edit = subitemEdits[item.id] || { nome: "", valor_unitario: "", observacao: "" };
                            return (
                              <div
                                key={item.id}
                                className="space-y-2 rounded-md border px-3 py-2"
                              >
                                <Input
                                  placeholder="Nome"
                                  value={edit.nome}
                                  onChange={(e) =>
                                    setSubitemEdits((prev) => ({
                                      ...prev,
                                      [item.id]: { ...edit, nome: e.target.value },
                                    }))
                                  }
                                />
                                <Input
                                  placeholder="Valor unitário (opcional)"
                                  type="number"
                                  step="0.01"
                                  value={edit.valor_unitario}
                                  onChange={(e) =>
                                    setSubitemEdits((prev) => ({
                                      ...prev,
                                      [item.id]: { ...edit, valor_unitario: e.target.value },
                                    }))
                                  }
                                />
                                <Textarea
                                  placeholder="Observação (opcional)"
                                  value={edit.observacao}
                                  onChange={(e) =>
                                    setSubitemEdits((prev) => ({
                                      ...prev,
                                      [item.id]: { ...edit, observacao: e.target.value },
                                    }))
                                  }
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleUpdateSubitem(item.id)}
                            disabled={updatingSubitemId === item.id}
                          >
                            {updatingSubitemId === item.id ? "Salvando..." : "Salvar"}
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhum item adicional definido para este cliente.
                  </p>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setEditOpen(false)}>
                  Fechar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" onClick={(e) => e.stopPropagation()}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
};

export default ClienteCard;
