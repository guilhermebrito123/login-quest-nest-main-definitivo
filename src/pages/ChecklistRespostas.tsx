import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ClipboardList, RefreshCw, Send } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type ExecucaoStatus = Database["public"]["Enums"]["status_execucao"];
type ExecucaoRow = Database["public"]["Tables"]["execucao_checklist"]["Row"];
type ExecucaoItemRow = Database["public"]["Tables"]["execucao_checklist_item"]["Row"];
type RespostaExecucaoRow = Database["public"]["Tables"]["resposta_execucao_checklist"]["Row"];
type RespostaItemRow = Database["public"]["Tables"]["resposta_execucao_checklist_item"]["Row"];
type ChecklistSummary = Pick<Database["public"]["Tables"]["checklist"]["Row"], "id" | "nome">;
type ChecklistItemSummary = Pick<
  Database["public"]["Tables"]["checklist_item"]["Row"],
  "id" | "descricao" | "ordem"
>;
type ProfileSummary = Pick<Database["public"]["Tables"]["profiles"]["Row"], "id" | "full_name">;

type ExecucaoWithRelations = ExecucaoRow & {
  checklist?: ChecklistSummary | null;
  supervisor?: ProfileSummary | null;
};

type ExecucaoItemWithDetails = ExecucaoItemRow & {
  checklist_item?: ChecklistItemSummary | null;
  resposta?: RespostaItemRow | null;
};

interface ExecucaoRespostaForm {
  resposta: string;
  conforme: boolean;
  observacoes: string;
  foto: string;
}

interface ItemRespostaForm {
  resposta: string;
  conforme: boolean;
  observacoes: string;
  foto: string;
}

const statusLabels: Record<ExecucaoStatus, string> = {
  ativo: "Ativo",
  concluido: "Concluído",
  atrasado: "Atrasado",
  cancelado: "Cancelado",
};

const selectableExecutionStatuses: ExecucaoStatus[] = ["ativo", "atrasado"];

const ChecklistRespostas = () => {
  const [execucoes, setExecucoes] = useState<ExecucaoWithRelations[]>([]);
  const [selectedExecucaoId, setSelectedExecucaoId] = useState<string>("");
  const [execucaoResposta, setExecucaoResposta] = useState<RespostaExecucaoRow | null>(null);
  const [execucaoItems, setExecucaoItems] = useState<ExecucaoItemWithDetails[]>([]);
  const [itemResponses, setItemResponses] = useState<Record<string, ItemRespostaForm>>({});
  const [execucaoResponseForm, setExecucaoResponseForm] = useState<ExecucaoRespostaForm>({
    resposta: "",
    conforme: true,
    observacoes: "",
    foto: "",
  });
  const [loading, setLoading] = useState(true);
  const [contextLoading, setContextLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ExecucaoStatus | "all">("all");

  useEffect(() => {
    loadExecucoes();
  }, []);

  useEffect(() => {
    if (selectedExecucaoId) {
      loadExecucaoContext(selectedExecucaoId);
    } else {
      setExecucaoItems([]);
      setExecucaoResposta(null);
    }
  }, [selectedExecucaoId]);

  const loadExecucoes = async () => {
    try {
      const { data, error } = await supabase
        .from("execucao_checklist")
        .select(
          `
          *,
          checklist:checklist ( id, nome ),
          supervisor:profiles ( id, full_name )
        `
        )
        .order("data_prevista", { ascending: false });

      if (error) throw error;
      setExecucoes((data as ExecucaoWithRelations[]) ?? []);
    } catch (error) {
      console.error("Erro ao carregar execuções:", error);
      toast.error("Não foi possível carregar as execuções.");
    } finally {
      setLoading(false);
    }
  };

  const loadExecucaoContext = async (execucaoId: string) => {
    try {
      setContextLoading(true);
      const { data: itensData, error: itensError } = await supabase
        .from("execucao_checklist_item")
        .select(
          `
          *,
          checklist_item:checklist_item ( id, descricao, ordem )
        `
        )
        .eq("execucao_checklist_id", execucaoId)
        .order("ordem", { foreignTable: "checklist_item", ascending: true });

      if (itensError) throw itensError;

      const itemIds = (itensData ?? []).map((item) => item.id);
      let respostasItens: RespostaItemRow[] = [];

      if (itemIds.length > 0) {
        const { data: respData, error: respError } = await supabase
          .from("resposta_execucao_checklist_item")
          .select("*")
          .in("execucao_checklist_item_id", itemIds);

        if (respError) throw respError;
        respostasItens = respData as RespostaItemRow[];
      }

      const respostaMap = new Map(respostasItens.map((resp) => [resp.execucao_checklist_item_id, resp]));
      setExecucaoItems(
        (itensData as ExecucaoItemWithDetails[])?.map((item) => ({
          ...item,
          resposta: respostaMap.get(item.id) ?? null,
        })) ?? []
      );

      setItemResponses((prev) => {
        const next = { ...prev };
        (itensData || []).forEach((item) => {
          const existing = respostaMap.get(item.id);
          next[item.id] = {
            resposta: existing?.resposta ?? "",
            conforme: existing?.conforme ?? true,
            observacoes: existing?.observacoes ?? "",
            foto: existing?.foto ?? "",
          };
        });
        return next;
      });

      const { data: respExec, error: respExecError } = await supabase
        .from("resposta_execucao_checklist")
        .select("*")
        .eq("execucao_checklist_id", execucaoId)
        .order("registrado_em", { ascending: false })
        .limit(1);

      if (respExecError) throw respExecError;
      setExecucaoResposta((respExec?.[0] as RespostaExecucaoRow) ?? null);
    } catch (error) {
      console.error("Erro ao carregar detalhes da execução:", error);
      toast.error("Não foi possível carregar os detalhes da execução selecionada.");
    } finally {
      setContextLoading(false);
    }
  };

  const handleExecucaoResponse = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedExecucaoId) {
      toast.error("Selecione uma execução.");
      return;
    }
    if (!execucaoResponseForm.resposta) {
      toast.error("Descreva a resposta da execução.");
      return;
    }

    try {
      const { error } = await supabase.from("resposta_execucao_checklist").insert({
        execucao_checklist_id: selectedExecucaoId,
        resposta: execucaoResponseForm.resposta,
        conforme: execucaoResponseForm.conforme,
        observacoes: execucaoResponseForm.observacoes || null,
        foto: execucaoResponseForm.foto || null,
      });

      if (error) throw error;
      toast.success("Resposta registrada.");
      await loadExecucaoContext(selectedExecucaoId);
    } catch (error) {
      console.error("Erro ao registrar resposta:", error);
      toast.error("Não foi possível registrar a resposta.");
    }
  };

  const handleItemResponse = async (itemId: string) => {
    if (!selectedExecucaoId) {
      toast.error("Selecione uma execução.");
      return;
    }

    const form = itemResponses[itemId];
    if (!form || !form.resposta) {
      toast.error("Informe a resposta do item.");
      return;
    }

    try {
      const { error } = await supabase.from("resposta_execucao_checklist_item").insert({
        execucao_checklist_item_id: itemId,
        resposta: form.resposta,
        conforme: form.conforme,
        observacoes: form.observacoes || null,
        foto: form.foto || null,
      });
      if (error) throw error;
      toast.success("Resposta do item registrada.");
      await loadExecucaoContext(selectedExecucaoId);
    } catch (error) {
      console.error("Erro ao responder item:", error);
      toast.error("Não foi possível registrar a resposta do item.");
    }
  };

  const filteredExecucoes = useMemo(
    () =>
      execucoes
        .filter((execucao) => selectableExecutionStatuses.includes(execucao.status))
        .filter((execucao) => (statusFilter === "all" ? true : execucao.status === statusFilter)),
    [execucoes, statusFilter]
  );

  useEffect(() => {
    if (selectedExecucaoId && !filteredExecucoes.some((execucao) => execucao.id === selectedExecucaoId)) {
      setSelectedExecucaoId("");
    }
  }, [filteredExecucoes, selectedExecucaoId]);

  const selectedExecucao = filteredExecucoes.find((execucao) => execucao.id === selectedExecucaoId);

  const badgeVariant = (status: ExecucaoStatus) => {
    if (status === "concluido") return "default";
    if (status === "cancelado") return "secondary";
    if (status === "atrasado") return "destructive";
    return "outline";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Respostas de checklist</h1>
            <p className="text-muted-foreground">
              Registre respostas das execuções e acompanhe o progresso item a item.
            </p>
          </div>
          <div className="flex gap-2">
            <Select
              value={statusFilter}
              onValueChange={(value: ExecucaoStatus | "all") => setStatusFilter(value)}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Filtrar status" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="all">Todas</SelectItem>
                {selectableExecutionStatuses.map((value) => (
                  <SelectItem key={value} value={value}>
                    {statusLabels[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={loadExecucoes}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Selecione a execução</CardTitle>
            <CardDescription>Escolha uma execução para responder e ver o progresso.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedExecucaoId} onValueChange={(value) => setSelectedExecucaoId(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a execução" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                {filteredExecucoes.map((execucao) => (
                  <SelectItem key={execucao.id} value={execucao.id}>
                    {execucao.checklist?.nome || execucao.id} -{" "}
                    {execucao.data_prevista
                      ? format(new Date(execucao.data_prevista), "dd/MM/yyyy", { locale: ptBR })
                      : "Sem data"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedExecucao && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <ClipboardList className="h-5 w-5" />
                      {selectedExecucao.checklist?.nome || "Checklist"}
                    </CardTitle>
                    <CardDescription>Dados básicos da execução</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Status:</span>
                      <Badge variant={badgeVariant(selectedExecucao.status)} className="capitalize">
                        {statusLabels[selectedExecucao.status]}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Data prevista:</span>
                      <span>
                        {selectedExecucao.data_prevista
                          ? format(new Date(selectedExecucao.data_prevista), "dd/MM/yyyy", { locale: ptBR })
                          : "-"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Finalizado em:</span>
                      <span>
                        {selectedExecucao.finalizado_em
                          ? format(new Date(selectedExecucao.finalizado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })
                          : "-"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Supervisor:</span>
                      <span>{selectedExecucao.supervisor?.full_name || "-"}</span>
                    </div>
                    {execucaoResposta && (
                      <div className="rounded-md border bg-muted/30 p-3 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={execucaoResposta.conforme ? "default" : "destructive"}>
                            {execucaoResposta.conforme ? "Conforme" : "Não conforme"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {execucaoResposta.registrado_em
                              ? format(new Date(execucaoResposta.registrado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })
                              : ""}
                          </span>
                        </div>
                        <p className="text-sm">{execucaoResposta.resposta}</p>
                        {execucaoResposta.observacoes && (
                          <p className="text-xs text-muted-foreground">{execucaoResposta.observacoes}</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Resposta da execução</CardTitle>
                    <CardDescription>Registro geral (opcional) da execução.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form className="space-y-3" onSubmit={handleExecucaoResponse}>
                      <div className="space-y-2">
                        <Label>Resposta</Label>
                        <Textarea
                          value={execucaoResponseForm.resposta}
                          onChange={(e) =>
                            setExecucaoResponseForm((prev) => ({ ...prev, resposta: e.target.value }))
                          }
                          placeholder="Resumo da execução, observações gerais..."
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Conformidade</Label>
                          <Select
                            value={execucaoResponseForm.conforme ? "true" : "false"}
                            onValueChange={(value) =>
                              setExecucaoResponseForm((prev) => ({ ...prev, conforme: value === "true" }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-popover">
                              <SelectItem value="true">Conforme</SelectItem>
                              <SelectItem value="false">Não conforme</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Foto (URL)</Label>
                          <Input
                            value={execucaoResponseForm.foto}
                            onChange={(e) =>
                              setExecucaoResponseForm((prev) => ({ ...prev, foto: e.target.value }))
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Observações</Label>
                        <Textarea
                          value={execucaoResponseForm.observacoes}
                          onChange={(e) =>
                            setExecucaoResponseForm((prev) => ({ ...prev, observacoes: e.target.value }))
                          }
                        />
                      </div>
                      <Button type="submit" disabled={contextLoading}>
                        <Send className="h-4 w-4 mr-2" />
                        Registrar resposta
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>

        {selectedExecucao && (
          <Card>
            <CardHeader>
              <CardTitle>Itens da execução</CardTitle>
              <CardDescription>Responda cada item e acompanhe o status individual.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ordem</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Resposta</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {execucaoItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.checklist_item?.ordem ?? "-"}</TableCell>
                      <TableCell className="font-medium">{item.checklist_item?.descricao || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={badgeVariant(item.status)} className="capitalize">
                          {statusLabels[item.status]}
                        </Badge>
                        {item.resposta && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            Registrado em{" "}
                            {item.resposta.registrado_em
                              ? format(new Date(item.resposta.registrado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })
                              : "-"}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <Input
                            placeholder="Resposta"
                            value={itemResponses[item.id]?.resposta || ""}
                            onChange={(e) =>
                              setItemResponses((prev) => ({
                                ...prev,
                                [item.id]: { ...(prev[item.id] || defaultItemForm), resposta: e.target.value },
                              }))
                            }
                          />
                          <Select
                            value={itemResponses[item.id]?.conforme ? "true" : "false"}
                            onValueChange={(value) =>
                              setItemResponses((prev) => ({
                                ...prev,
                                [item.id]: { ...(prev[item.id] || defaultItemForm), conforme: value === "true" },
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Conformidade" />
                            </SelectTrigger>
                            <SelectContent className="bg-popover">
                              <SelectItem value="true">Conforme</SelectItem>
                              <SelectItem value="false">Não conforme</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            placeholder="Observações"
                            value={itemResponses[item.id]?.observacoes || ""}
                            onChange={(e) =>
                              setItemResponses((prev) => ({
                                ...prev,
                                [item.id]: { ...(prev[item.id] || defaultItemForm), observacoes: e.target.value },
                              }))
                            }
                          />
                          <Input
                            placeholder="Foto (URL)"
                            value={itemResponses[item.id]?.foto || ""}
                            onChange={(e) =>
                              setItemResponses((prev) => ({
                                ...prev,
                                [item.id]: { ...(prev[item.id] || defaultItemForm), foto: e.target.value },
                              }))
                            }
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" onClick={() => handleItemResponse(item.id)} disabled={contextLoading}>
                          <Send className="h-4 w-4 mr-2" />
                          Enviar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {execucaoItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Nenhum item encontrado para esta execução.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

const defaultItemForm: ItemRespostaForm = {
  resposta: "",
  conforme: true,
  observacoes: "",
  foto: "",
};

export default ChecklistRespostas;
