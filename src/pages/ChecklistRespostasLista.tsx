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
import { RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

type ExecucaoStatus = Database["public"]["Enums"]["status_execucao"];
type RespostaExecucaoRow = Database["public"]["Tables"]["resposta_execucao_checklist"]["Row"];
type ExecucaoRow = Database["public"]["Tables"]["execucao_checklist"]["Row"];
type ChecklistSummary = Pick<Database["public"]["Tables"]["checklist"]["Row"], "id" | "nome">;
type ProfileSummary = Pick<Database["public"]["Tables"]["profiles"]["Row"], "id" | "full_name">;

type RespostaWithRelations = RespostaExecucaoRow & {
  execucao?: (ExecucaoRow & {
    checklist?: ChecklistSummary | null;
    supervisor?: ProfileSummary | null;
  }) | null;
};

const statusLabels: Record<ExecucaoStatus, string> = {
  ativo: "Ativo",
  concluido: "Concluído",
  atrasado: "Atrasado",
  cancelado: "Cancelado",
};

const ChecklistRespostasLista = () => {
  const [respostas, setRespostas] = useState<RespostaWithRelations[]>([]);
  const [checklists, setChecklists] = useState<ChecklistSummary[]>([]);
  const [supervisores, setSupervisores] = useState<ProfileSummary[]>([]);
  const [supervisorFilter, setSupervisorFilter] = useState<string>("all");
  const [checklistFilter, setChecklistFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadInitial();
  }, []);

  const loadInitial = async () => {
    setLoading(true);
    try {
      await Promise.all([loadRespostas(), loadChecklists(), loadSupervisores()]);
    } catch (error) {
      console.error("Erro ao carregar respostas:", error);
      toast.error("Não foi possível carregar as respostas das execuções.");
    } finally {
      setLoading(false);
    }
  };

  const loadRespostas = async () => {
    const { data, error } = await supabase
      .from("resposta_execucao_checklist")
      .select(
        `
        id,
        resposta,
        conforme,
        observacoes,
        foto,
        registrado_em,
        execucao:execucao_checklist (
          id,
          checklist_id,
          supervisor_id,
          status,
          data_prevista,
          finalizado_em,
          checklist:checklist ( id, nome ),
          supervisor:profiles ( id, full_name )
        )
      `
      )
      .order("registrado_em", { ascending: false });

    if (error) throw error;
    setRespostas((data as RespostaWithRelations[]) ?? []);
  };

  const loadChecklists = async () => {
    const { data, error } = await supabase.from("checklist").select("id, nome").order("nome");
    if (error) throw error;
    setChecklists((data as ChecklistSummary[]) ?? []);
  };

  const loadSupervisores = async () => {
    const { data, error } = await supabase.from("profiles").select("id, full_name").order("full_name");
    if (error) throw error;
    setSupervisores((data as ProfileSummary[]) ?? []);
  };

  const filteredRespostas = useMemo(() => {
    const fromDate = dateFrom ? new Date(dateFrom) : null;
    const toDate = dateTo ? new Date(dateTo) : null;

    return respostas.filter((resp) => {
      const supervisorMatch =
        supervisorFilter === "all" || resp.execucao?.supervisor_id === supervisorFilter;
      const checklistMatch =
        checklistFilter === "all" || resp.execucao?.checklist_id === checklistFilter;

      const regDate = resp.registrado_em ? new Date(resp.registrado_em) : null;
      const dateMatch =
        (!fromDate || (regDate && regDate >= fromDate)) &&
        (!toDate || (regDate && regDate <= toDate));

      return supervisorMatch && checklistMatch && dateMatch;
    });
  }, [respostas, supervisorFilter, checklistFilter, dateFrom, dateTo]);

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
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Respostas das execuções</h1>
            <p className="text-muted-foreground">
              Histórico de respostas de execuções de checklist com filtros por supervisor, checklist e data.
            </p>
          </div>
          <Button variant="outline" onClick={loadInitial}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>Refine a listagem de respostas.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Supervisor</Label>
              <Select value={supervisorFilter} onValueChange={setSupervisorFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Supervisor" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="all">Todos</SelectItem>
                  {supervisores.map((sup) => (
                    <SelectItem key={sup.id} value={sup.id}>
                      {sup.full_name || sup.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Checklist</Label>
              <Select value={checklistFilter} onValueChange={setChecklistFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Checklist" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="all">Todos</SelectItem>
                  {checklists.map((chk) => (
                    <SelectItem key={chk.id} value={chk.id}>
                      {chk.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data inicial</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Data final</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Respostas registradas</CardTitle>
            <CardDescription>Listagem com supervisor, checklist e data.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">{filteredRespostas.length} resposta(s) encontrada(s)</div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Checklist</TableHead>
                  <TableHead>Supervisor</TableHead>
                  <TableHead>Conformidade</TableHead>
                  <TableHead>Resposta</TableHead>
                  <TableHead>Registrado em</TableHead>
                  <TableHead>Observações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRespostas.map((resp) => (
                  <TableRow key={resp.id}>
                    <TableCell className="font-medium">{resp.execucao?.checklist?.nome || "-"}</TableCell>
                    <TableCell>{resp.execucao?.supervisor?.full_name || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={resp.conforme ? "default" : "destructive"}>
                        {resp.conforme ? "Conforme" : "Não conforme"}
                      </Badge>
                      <div className="text-xs text-muted-foreground">
                        {statusLabels[resp.execucao?.status as ExecucaoStatus] || "-"}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs whitespace-pre-wrap text-sm">{resp.resposta}</TableCell>
                    <TableCell>
                      {resp.registrado_em
                        ? format(new Date(resp.registrado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })
                        : "-"}
                    </TableCell>
                    <TableCell className="max-w-xs whitespace-pre-wrap text-sm">
                      {resp.observacoes || "-"}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredRespostas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Nenhuma resposta encontrada.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ChecklistRespostasLista;
