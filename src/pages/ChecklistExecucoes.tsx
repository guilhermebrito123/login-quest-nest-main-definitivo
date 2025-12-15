import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clock, Edit2, Plus, RefreshCw, Trash2, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { toBrazilDateISOString } from "@/lib/dateUtils";

type ExecucaoRow = Database["public"]["Tables"]["execucao_checklist"]["Row"];
type ExecucaoInsert = Database["public"]["Tables"]["execucao_checklist"]["Insert"];
type ExecucaoStatus = Database["public"]["Enums"]["status_execucao"];
type ChecklistSummary = Pick<Database["public"]["Tables"]["checklist"]["Row"], "id" | "nome" | "periodicidade">;
type ChecklistItem = Pick<Database["public"]["Tables"]["checklist_item"]["Row"], "id" | "checklist_id">;
type ProfileSummary = Pick<Database["public"]["Tables"]["usuarios"]["Row"], "id" | "full_name">;
type ContratoSummary = Pick<Database["public"]["Tables"]["contratos"]["Row"], "id" | "negocio" | "conq_perd">;
type UnidadeSummary = Pick<Database["public"]["Tables"]["unidades"]["Row"], "id" | "nome" | "contrato_id">;

type ExecucaoWithRelations = ExecucaoRow & {
  checklist?: ChecklistSummary | null;
  supervisor?: ProfileSummary | null;
  contrato?: ContratoSummary | null;
  unidade?: UnidadeSummary | null;
};

interface ExecucaoForm {
  checklist_id: string;
  data_prevista: string;
  supervisor_id: string;
  status: ExecucaoStatus;
  contrato_id: string;
  unidade_id: string;
}

const statusLabels: Record<ExecucaoStatus, string> = {
  ativo: "Ativo",
  concluido: "Concluido",
  atrasado: "Atrasado",
  cancelado: "Cancelado",
};

const formStatusOptions: Array<[ExecucaoStatus, string]> = Object.entries(statusLabels).filter(
  ([value]) => value !== "concluido"
) as Array<[ExecucaoStatus, string]>;

const initialFormData: ExecucaoForm = {
  checklist_id: "none",
  data_prevista: "",
  supervisor_id: "none",
  status: "ativo",
  contrato_id: "none",
  unidade_id: "none",
};

const statusConfirmMessages: Record<ExecucaoStatus, string> = {
  ativo: "Deseja reabrir esta execução como ativa?",
  concluido: "Deseja marcar esta execução como concluída?",
  atrasado: "Deseja marcar esta execução como atrasada?",
  cancelado: "Deseja cancelar esta execução?",
};

const ChecklistExecucoes = () => {
  const [execucoes, setExecucoes] = useState<ExecucaoWithRelations[]>([]);
  const [checklists, setChecklists] = useState<ChecklistSummary[]>([]);
  const [supervisores, setSupervisores] = useState<ProfileSummary[]>([]);
  const [contratos, setContratos] = useState<ContratoSummary[]>([]);
  const [unidades, setUnidades] = useState<UnidadeSummary[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ExecucaoStatus | "all">("all");
  const [formData, setFormData] = useState<ExecucaoForm>(initialFormData);

  useEffect(() => {
    void loadInitial();
  }, []);

  const loadInitial = async () => {
    try {
      await Promise.all([loadChecklists(), loadSupervisores(), loadContratos(), loadUnidades(), loadExecucoes()]);
    } catch (error) {
      console.error("Erro ao carregar execucoes:", error);
      toast.error("Não foi possível carregar as execuções de checklist.");
    } finally {
      setLoading(false);
    }
  };

  const loadChecklists = async () => {
    const { data, error } = await supabase.from("checklist").select("id, nome, periodicidade").order("nome");
    if (error) throw error;
    setChecklists((data as ChecklistSummary[]) ?? []);
  };

  const loadContratos = async () => {
    const { data, error } = await supabase.from("contratos").select("id, negocio, conq_perd").order("negocio");
    if (error) throw error;
    setContratos((data as ContratoSummary[]) ?? []);
  };

  const loadUnidades = async () => {
    const { data, error } = await supabase.from("unidades").select("id, nome, contrato_id").order("nome");
    if (error) throw error;
    setUnidades((data as UnidadeSummary[]) ?? []);
  };

  const loadSupervisores = async () => {
    const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "supervisor");

    let supervisorQuery = supabase.from("usuarios").select("id, full_name");
    if (roles && roles.length > 0) {
      supervisorQuery = supervisorQuery.in(
        "id",
        roles.map((role) => role.user_id)
      );
    }

    const { data, error } = await supervisorQuery;
    if (error) throw error;
    setSupervisores((data as ProfileSummary[]) ?? []);
  };

  const loadExecucoes = async () => {
    const { data, error } = await supabase
      .from("execucao_checklist")
        .select(
          `
          id,
          checklist_id,
        data_prevista,
        supervisor_id,
        status,
        contrato_id,
        unidade_id,
        finalizado_em,
        created_at,
        updated_at,
          checklist:checklist ( id, nome, periodicidade ),
          supervisor:usuarios ( id, full_name ),
          contrato:contratos ( id, negocio, conq_perd ),
          unidade:unidades ( id, nome, contrato_id )
        `
        )
      .order("data_prevista", { ascending: false });

    if (error) throw error;
    setExecucoes((data as ExecucaoWithRelations[]) ?? []);
  };

  const loadChecklistItems = async (checklistId: string) => {
    const { data, error } = await supabase
      .from("checklist_item")
      .select("id, checklist_id")
      .eq("checklist_id", checklistId);

    if (error) throw error;
    return (data as ChecklistItem[]) ?? [];
  };

  const createExecutionItems = async (
    execucaoId: string,
    checklistId: string,
    dataPrevista: string,
    contratoId: string | null,
    unidadeId: string | null
  ) => {
    const items = await loadChecklistItems(checklistId);
    if (items.length === 0) return;

    const payload = items.map((item) => ({
      execucao_checklist_id: execucaoId,
      checklist_item_id: item.id,
      data_prevista: dataPrevista,
      status: "ativo" as ExecucaoStatus,
      contrato_id: contratoId,
      unidade_id: unidadeId,
    }));

    await supabase.from("execucao_checklist_item").insert(payload);
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setEditingId(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (formData.checklist_id === "none" || !formData.data_prevista) {
      toast.error("Selecione um checklist e a data prevista.");
      return;
    }

    const contratoId = formData.contrato_id === "none" ? null : formData.contrato_id;
    const unidadeId = formData.unidade_id === "none" ? null : formData.unidade_id;
    const dataPrevistaBrazil = toBrazilDateISOString(formData.data_prevista);

    const payload: ExecucaoInsert = {
      checklist_id: formData.checklist_id,
      data_prevista: dataPrevistaBrazil,
      supervisor_id: formData.supervisor_id === "none" ? null : formData.supervisor_id,
      status: formData.status,
      contrato_id: contratoId,
      unidade_id: unidadeId,
    };

    try {
      setSaving(true);
      if (editingId) {
        const { error } = await supabase.from("execucao_checklist").update(payload).eq("id", editingId);
        if (error) throw error;
        toast.success("Execução atualizada.");
      } else {
        const { data, error } = await supabase
          .from("execucao_checklist")
          .insert(payload)
          .select("id, checklist_id, data_prevista, contrato_id, unidade_id")
          .single();
        if (error) throw error;
        if (data) {
          await createExecutionItems(
            data.id,
            data.checklist_id,
            data.data_prevista,
            data.contrato_id ?? null,
            data.unidade_id ?? null
          );
        }
        toast.success("Execução criada.");
      }

      await loadExecucoes();
      resetForm();
    } catch (error) {
      console.error("Erro ao salvar execução:", error);
      toast.error("Não foi possível salvar a execução.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (execucao: ExecucaoWithRelations) => {
    const checklistNome = execucao.checklist?.nome || "esta execução";
    if (!window.confirm(`Deseja editar a execução do checklist "${checklistNome}"?`)) {
      return;
    }
    setEditingId(execucao.id);
    setFormData({
      checklist_id: execucao.checklist_id,
      data_prevista: formatInputDate(execucao.data_prevista),
      supervisor_id: execucao.supervisor_id ?? "none",
      status: execucao.status,
      contrato_id: execucao.contrato_id ?? "none",
      unidade_id: execucao.unidade_id ?? "none",
    });
  };

  const handleStatusUpdate = async (id: string, status: ExecucaoStatus) => {
    const message = statusConfirmMessages[status] ?? `Deseja alterar o status para ${statusLabels[status]}?`;
    if (!window.confirm(message)) return;
    try {
      const { error } = await supabase.from("execucao_checklist").update({ status }).eq("id", id);
      if (error) throw error;
      toast.success("Status atualizado.");
      await loadExecucoes();
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      toast.error("Não foi possível atualizar o status.");
    }
  };

  const handleDelete = async (execucao: ExecucaoWithRelations) => {
    const checklistNome = execucao.checklist?.nome || execucao.id;
    if (!window.confirm(`Confirma a exclusão da execução "${checklistNome}"?`)) {
      return;
    }
    try {
      setDeletingId(execucao.id);

      const { data: itens } = await supabase
        .from("execucao_checklist_item")
        .select("id")
        .eq("execucao_checklist_id", execucao.id);

      const itemIds = (itens || []).map((item) => item.id);

      if (itemIds.length > 0) {
        const { error: respItensError } = await supabase
          .from("resposta_execucao_checklist_item")
          .delete()
          .in("execucao_checklist_item_id", itemIds);
        if (respItensError) throw respItensError;
      }

      const { error: respExecError } = await supabase
        .from("resposta_execucao_checklist")
        .delete()
        .eq("execucao_checklist_id", execucao.id);
      if (respExecError) throw respExecError;

      const { error: itensError } = await supabase
        .from("execucao_checklist_item")
        .delete()
        .eq("execucao_checklist_id", execucao.id);
      if (itensError) throw itensError;

      const { error: execError } = await supabase.from("execucao_checklist").delete().eq("id", execucao.id);
      if (execError) throw execError;

      toast.success("Execução excluída.");
      await loadExecucoes();
    } catch (error) {
      console.error("Erro ao excluir execução:", error);
      toast.error("Não foi possível excluir a execução.");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredExecucoes = useMemo(() => {
    return execucoes.filter((execucao) => statusFilter === "all" || execucao.status === statusFilter);
  }, [execucoes, statusFilter]);

  const badgeVariant = (status: ExecucaoStatus) => {
    switch (status) {
      case "concluido":
        return "default" as const;
      case "atrasado":
        return "destructive" as const;
      case "cancelado":
        return "secondary" as const;
      default:
        return "outline" as const;
    }
  };

  const unidadesFiltradas = useMemo(() => {
    if (formData.contrato_id === "none") return unidades;
    return unidades.filter((u) => u.contrato_id === formData.contrato_id);
  }, [formData.contrato_id, unidades]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>{editingId ? "Editar execução" : "Nova execução"}</CardTitle>
              <CardDescription>Checklist, contrato/unidade, data e supervisor.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label>Checklist</Label>
                  <Select
                    value={formData.checklist_id}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, checklist_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o checklist" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="none">Selecione...</SelectItem>
                      {checklists.map((checklist) => (
                        <SelectItem key={checklist.id} value={checklist.id}>
                          {checklist.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Contrato</Label>
                  <Select
                    value={formData.contrato_id}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        contrato_id: value,
                        unidade_id: value === "none" ? "none" : prev.unidade_id,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o contrato" />
                    </SelectTrigger>
                     <SelectContent className="bg-popover">
                       <SelectItem value="none">Sem contrato</SelectItem>
                       {contratos.map((contrato) => (
                         <SelectItem key={contrato.id} value={contrato.id}>
                          {contrato.negocio} ({contrato.conq_perd})
                          </SelectItem>
                       ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Unidade</Label>
                  <Select
                    value={formData.unidade_id}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, unidade_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a unidade" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="none">Sem unidade</SelectItem>
                      {unidadesFiltradas.map((unidade) => (
                        <SelectItem key={unidade.id} value={unidade.id}>
                          {unidade.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Data prevista</Label>
                  <Input
                    type="date"
                    value={formData.data_prevista}
                    onChange={(e) => setFormData((prev) => ({ ...prev, data_prevista: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Supervisor</Label>
                  <Select
                    value={formData.supervisor_id}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, supervisor_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o supervisor" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="none">Sem supervisor</SelectItem>
                      {supervisores.map((perfil) => (
                        <SelectItem key={perfil.id} value={perfil.id}>
                          {perfil.full_name || perfil.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: ExecucaoStatus) => {
                      if (value === "concluido") return;
                      setFormData((prev) => ({ ...prev, status: value }));
                    }}
                    disabled={formData.status === "concluido"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {(formData.status === "concluido"
                        ? [...formStatusOptions, ["concluido", statusLabels.concluido]]
                        : formStatusOptions
                      ).map(([value, label]) => (
                        <SelectItem key={value} value={value} disabled={value === "concluido"}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={saving}>
                    {saving ? "Salvando..." : editingId ? "Atualizar" : "Agendar"}
                  </Button>
                  {editingId && (
                    <Button type="button" variant="secondary" onClick={resetForm}>
                      Cancelar
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Execuções cadastradas</CardTitle>
              <CardDescription>Visualize status e vínculos de contrato/unidade.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <Select value={statusFilter} onValueChange={(value: ExecucaoStatus | "all") => setStatusFilter(value)}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Filtrar status" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="all">Todos</SelectItem>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-sm text-muted-foreground">
                  {filteredExecucoes.length} execução(ões) encontrada(s)
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Checklist</TableHead>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Data prevista</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Finalizado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExecucoes.map((execucao) => (
                    <TableRow key={execucao.id}>
                      <TableCell className="font-medium">{execucao.checklist?.nome || "-"}</TableCell>
                      <TableCell>
                        {execucao.contrato?.negocio ? (
                            <div className="flex flex-col">
                            <span>{execucao.contrato.negocio}</span>
                            <span className="text-xs text-muted-foreground">Ano: {execucao.contrato.conq_perd}</span>
                            </div>
                          ) : (
                          <span className="text-muted-foreground">Sem contrato</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {execucao.unidade?.nome ? (
                          <div className="flex flex-col">
                            <span>{execucao.unidade.nome}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Sem unidade</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {execucao.data_prevista
                          ? format(new Date(execucao.data_prevista), "dd/MM/yyyy", { locale: ptBR })
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={badgeVariant(execucao.status)} className="capitalize">
                          {statusLabels[execucao.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {execucao.finalizado_em
                          ? format(new Date(execucao.finalizado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="icon" variant="ghost" onClick={() => handleEdit(execucao)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleStatusUpdate(execucao.id, "cancelado")}>
                            <XCircle className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleStatusUpdate(execucao.id, "atrasado")}>
                            <Clock className="h-4 w-4" />
                          </Button>
                          {execucao.status !== "concluido" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDelete(execucao)}
                              disabled={deletingId === execucao.id}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredExecucoes.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        Nenhuma execução encontrada.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ChecklistExecucoes;
  const formatInputDate = (value: string) => {
    if (!value) return "";
    return value.includes("T") ? value.split("T")[0] : value;
  };

