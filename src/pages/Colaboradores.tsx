import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {

  Select,

  SelectContent,

  SelectItem,

  SelectTrigger,

  SelectValue,

} from "@/components/ui/select";

import {

  Table,

  TableBody,

  TableCell,

  TableHead,

  TableHeader,

  TableRow,

} from "@/components/ui/table";

import { Badge } from "@/components/ui/badge";

import {
  Plus,
  Search,
  Edit,
  Trash2,
  Calendar,
  CalendarPlus,
  MapPin,
  Unlink,
  History,
  Info,
} from "lucide-react";

import { ColaboradorForm } from "@/components/colaboradores/ColaboradorForm";


import { RequisitosMissingDialog } from "@/components/colaboradores/RequisitosMissingDialog";

import { AtribuirEscalaDialog } from "@/components/colaboradores/AtribuirEscalaDialog";

import { AtribuirUnidadeDialog } from "@/components/colaboradores/AtribuirUnidadeDialog";

import { CalendarioPresencaDialog } from "@/components/colaboradores/CalendarioPresencaDialog";

import { PresencaDialog } from "@/components/colaboradores/PresencaDialog";

import { format } from "date-fns";

import { ptBR } from "date-fns/locale";

import { DashboardLayout } from "@/components/DashboardLayout";

import { toast } from "sonner";
import { agendarOcupacaoPosto } from "@/lib/ocupacao";

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

import {

  Dialog,

  DialogContent,

  DialogDescription,

  DialogHeader,

  DialogTitle,

} from "@/components/ui/dialog";



const STATUS_POSTO_LABELS: Record<string, string> = {

  vago: "Vago",

  ocupado: "Ocupado",

  vago_temporariamente: "Vago temporariamente",

  ocupado_temporariamente: "Ocupado temporariamente",

  presenca_confirmada: "Presenca confirmada",

  ocupacao_agendada: "Ocupacao agendada",
  inativo: "Inativo",

};



const STATUS_POSTO_BADGE: Record<string, "default" | "secondary" | "outline" | "destructive"> = {

  vago: "secondary",

  ocupado: "default",

  vago_temporariamente: "outline",

  ocupado_temporariamente: "outline",

  presenca_confirmada: "default",

  ocupacao_agendada: "outline",
  inativo: "outline",

};

const STATUS_COLABORADOR_LABELS: Record<string, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
};

const STATUS_COLABORADOR_BADGE: Record<string, "default" | "secondary"> = {
  ativo: "default",
  inativo: "secondary",
};



const parseDbDate = (date: string) => new Date(`${date}T00:00:00`);
const MOTIVOS_VAGO = [
  "falta justificada",
  "falta injustificada",
  "afastamento INSS",
  "f\u00e9rias",
  "suspens\u00e3o",
  "Posto vago",
];
const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";
const normalizeMotivoVago = (motivo: string) => {
  const cleaned = motivo?.replace(/_/g, " ").trim().toLowerCase();
  switch (cleaned) {
    case "falta justificada":
      return "falta justificada";
    case "falta injustificada":
      return "falta injustificada";
    case "afastamento inss":
      return "afastamento INSS";
    case "f?rias":
    case "ferias":
      return "f?rias";
    case "suspens?o":
    case "suspensao":
      return "suspens?o";
    case "posto vago":
      return "Posto vago";
    default:
      return motivo?.replace(/_/g, " ").trim();
  }
};


const getStatusLabel = (status?: string | null) => {

  if (!status) return "Sem status";

  if (status === "ativo") return "Ocupado";

  return STATUS_POSTO_LABELS[status] || status;

};


const getStatusBadge = (status?: string | null): "default" | "secondary" | "outline" | "destructive" => {

  if (!status) return "outline";

  if (status === "ativo") return "default";

  return STATUS_POSTO_BADGE[status] || "outline";

};



export default function Colaboradores() {
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");

  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [alocacaoFilter, setAlocacaoFilter] = useState<string>("all");

  const [cargoFilter, setCargoFilter] = useState<string>("all");

  const [unidadeFilter, setUnidadeFilter] = useState<string>("all");

  const [showForm, setShowForm] = useState(false);

  const [editingColaborador, setEditingColaborador] = useState<any>(null);


  const [showRequisitosMissing, setShowRequisitosMissing] = useState(false);

  const [missingEntities, setMissingEntities] = useState<string[]>([]);

  const [escalaColaborador, setEscalaColaborador] = useState<any>(null);

  const [unidadeColaborador, setUnidadeColaborador] = useState<any>(null);

  const [calendarioColaborador, setCalendarioColaborador] = useState<any>(null);
  const [presencaColaborador, setPresencaColaborador] = useState<any>(null);

const [escalaVisualizada, setEscalaVisualizada] = useState<{
    colaborador: any;
    postoId: string | null;
    dias: {
      id?: string;
      data: string;
      status: string | null;
      motivo_vago?: string | null;
    }[];
  } | null>(null);

  const [colaboradorDetalhe, setColaboradorDetalhe] = useState<any>(null);
  const [motivoVagoPorDia, setMotivoVagoPorDia] = useState<Record<string, string>>({});
  const [agendamento, setAgendamento] = useState<{
    tipo: "desvincular" | "vincular";
    colaborador: any;
  } | null>(null);
  const [agendamentoForm, setAgendamentoForm] = useState({
    data: "",
    postoDestino: "",
  });
  const [agendamentoLoading, setAgendamentoLoading] = useState(false);
  const [datasDisponiveisVinculacao, setDatasDisponiveisVinculacao] = useState<string[]>([]);



  const { data: colaboradores, refetch } = useQuery({

    queryKey: ["colaboradores", statusFilter, unidadeFilter, alocacaoFilter, cargoFilter],

    queryFn: async () => {

      let query = supabase

        .from("colaboradores")

        .select(

          `

          *,

          unidade:unidades(id, nome, contratos(id, negocio, conq_perd)),

          escala:escalas(nome, tipo),

          posto:postos_servico(

            id,

            nome,

            status,
            ultimo_dia_atividade,

            unidade:unidades(id, nome, contratos(id, negocio, conq_perd))

          )

        `

        )

        .order("nome_completo");



      if (statusFilter !== "all") {

        query = query.eq("status_colaborador", statusFilter);

      }

      if (unidadeFilter !== "all") {

        query = query.eq("unidade_id", unidadeFilter);

      }

      if (alocacaoFilter === "alocado") {

        query = query.not("posto_servico_id", "is", null);

      } else if (alocacaoFilter === "nao_alocado") {

        query = query.is("posto_servico_id", null);

      }

      if (cargoFilter !== "all") {

        query = query.eq("cargo", cargoFilter);

      }



      const { data, error } = await query;

      if (error) throw error;

      return data;

    },

  });



  const { data: unidades } = useQuery({

    queryKey: ["unidades"],

    queryFn: async () => {

      const { data, error } = await supabase

        .from("unidades")

        .select("id, nome")
        .order("nome");

      if (error) throw error;

      return data;

    },

  });

  const { data: postosDisponiveis = [] } = useQuery({
    queryKey: ["postos-disponiveis-agendamento"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("postos_servico")
        .select("id, nome, status")
        .eq("status", "vago")
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const carregarDatasDisponiveis = async (postoId: string) => {
      try {
        const hoje = format(new Date(), "yyyy-MM-dd");
        const { data, error } = await supabase
          .from("dias_trabalho")
          .select("data")
          .eq("posto_servico_id", postoId)
          .is("colaborador_id", null)
          .gte("data", hoje)
          .order("data");
        if (error) throw error;
        const datas = data?.map((item: { data: string }) => item.data) ?? [];
        setDatasDisponiveisVinculacao(datas);
        setAgendamentoForm((prev) => ({
          ...prev,
          data: datas[0] ?? "",
        }));
      } catch (error: any) {
        toast.error(error.message || "Erro ao carregar dias disponíveis para o posto.");
        setDatasDisponiveisVinculacao([]);
        setAgendamentoForm((prev) => ({ ...prev, data: "" }));
      }
    };

    if (agendamento?.tipo === "vincular" && agendamentoForm.postoDestino) {
      carregarDatasDisponiveis(agendamentoForm.postoDestino);
    } else if (agendamento?.tipo === "vincular") {
      setDatasDisponiveisVinculacao([]);
      setAgendamentoForm((prev) => ({ ...prev, data: "" }));
    }
  }, [agendamento?.tipo, agendamentoForm.postoDestino]);



  const filteredColaboradores = colaboradores?.filter(

    (colab) =>

      colab.nome_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||

      colab.cpf?.includes(searchTerm) ||

      colab.email?.toLowerCase().includes(searchTerm.toLowerCase())

  );

  const statusOptions = Array.from(
    new Set(
      ["ativo", "inativo"].concat(
        (colaboradores ?? [])
          .map((colab) => colab.status_colaborador)
          .filter((status): status is string => Boolean(status))
      )
    )
  );

  const cargoOptions = Array.from(
    new Set(
      (colaboradores ?? [])
        .map((colab) => colab.cargo)
        .filter((cargo): cargo is string => Boolean(cargo))
    )
  );

  const totalColaboradores = filteredColaboradores?.length ?? 0;



  const handleEdit = (colaborador: any) => {

    if (!window.confirm(`Deseja editar o colaborador ${colaborador.nome_completo}?`)) {

      return;

    }

    setEditingColaborador(colaborador);

    setShowForm(true);

  };



  const handleDelete = async (id: string) => {

    if (!window.confirm("Tem certeza que deseja excluir este colaborador?")) {

      return;

    }

    try {

      const { error } = await supabase

        .from("colaboradores")

        .delete()

        .eq("id", id);



      if (error) throw error;

      toast.success("Colaborador excluÃÂ­do com sucesso");

      refetch();

    } catch (error: any) {

      toast.error(error.message || "Erro ao excluir colaborador");

    }

  };



  const handleDesvincularPosto = async (colaborador: any) => {

    if (!window.confirm("Deseja realmente desvincular o colaborador do posto atual?")) {

      return;

    }

    try {

      const { error } = await supabase

        .from("colaboradores")

        .update({ posto_servico_id: null })

        .eq("id", colaborador.id);



      if (error) throw error;

      toast.success("Posto de serviÃÂ§o desvinculado com sucesso");

      refetch();

    } catch (error: any) {

      toast.error(error.message || "Erro ao desvincular posto de serviÃÂ§o");

    }

  };



  const handleNewColaborador = () => {

    if (!window.confirm("Deseja cadastrar um novo colaborador?")) {

      return;

    }

    // Verificar requisitos

    const missing = [];

    if (!unidades || unidades.length === 0) missing.push("Unidades");



    if (missing.length > 0) {

      setMissingEntities(missing);

      setShowRequisitosMissing(true);

      return;

    }



    setShowForm(true);

  };



  const handleVerEscala = async (colaborador: any) => {
    if (!colaborador.posto_servico_id) {
      toast.error("Colaborador nao esta vinculado a um posto no momento.");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("dias_trabalho")
        .select("id, data, status, motivo_vago")
        .eq("posto_servico_id", colaborador.posto_servico_id)
        .order("data");

      if (error) throw error;

      setEscalaVisualizada({
        colaborador,
        postoId: colaborador.posto_servico_id,
        dias: data || [],
      });
    } catch (error: any) {
      toast.error(error.message || "Erro ao carregar escala do colaborador");
    }
  };

  const handleConfirmarPresencaEscala = async (diaId: string) => {
    try {
      const { error } = await supabase.rpc("confirmar_presenca", {
        p_dia_trabalho_id: diaId,
        p_novo_status: "presenca_confirmada",
      });

      if (error) throw error;

      setEscalaVisualizada((prev) =>
        prev
          ? {
              ...prev,
              dias: prev.dias.map((dia) =>
                dia.id === diaId ? { ...dia, status: "presenca_confirmada" } : dia
              ),
            }
          : prev
      );

      toast.success("Presença confirmada com sucesso.");
    } catch (error: any) {
      toast.error(error.message || "Erro ao confirmar presença.");
    }
  };

  const openAgendamento = (tipo: "desvincular" | "vincular", colaborador: any) => {
    setAgendamento({ tipo, colaborador });
    setAgendamentoForm({
      data: tipo === "desvincular" ? new Date().toISOString().split("T")[0] : "",
      postoDestino: "",
    });
    setDatasDisponiveisVinculacao([]);
  };

  const handleAgendamentoSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!agendamento) return;
    if (!agendamentoForm.data) {
      toast.error("Selecione uma data para o agendamento.");
      return;
    }
    if (agendamento.tipo === "vincular" && !agendamentoForm.postoDestino) {
      toast.error("Selecione o posto de destino para a vinculação.");
      return;
    }
    if (
      agendamento.tipo === "vincular" &&
      (!agendamentoForm.data || !datasDisponiveisVinculacao.includes(agendamentoForm.data))
    ) {
      toast.error("Selecione uma data disponível para o posto escolhido.");
      return;
    }

    setAgendamentoLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Usuário não autenticado");

      const payload: Record<string, any> = {
        colaborador_id: agendamento.colaborador.id,
        status: "agendado",
        created_by: user.id,
        posto_servico_id_origem: agendamento.colaborador.posto_servico_id,
      };

      if (agendamento.tipo === "desvincular") {
        payload.data_desvinculacao = agendamentoForm.data;
      } else {
        payload.data_vinculacao = agendamentoForm.data;
        payload.posto_servico_id_destino = agendamentoForm.postoDestino;

        await agendarOcupacaoPosto({
          postoId: agendamentoForm.postoDestino,
          colaboradorId: agendamento.colaborador.id,
          data: agendamentoForm.data,
          usuarioId: user.id,
        });
      }

      const { error } = await supabase
        .from("colaborador_movimentacoes_posto")
        .insert([payload]);

      if (error) throw error;
      await Promise.all([
        refetch(),
        queryClient.invalidateQueries({ queryKey: ["colaboradores"] }),
        queryClient.invalidateQueries({ queryKey: ["postos-disponiveis-agendamento"] }),
      ]);

      toast.success(
        agendamento.tipo === "desvincular"
          ? "Desvinculação agendada com sucesso."
          : "Vinculação agendada com sucesso."
      );
      setAgendamento(null);
      setAgendamentoForm({ data: "", postoDestino: "" });
    } catch (error: any) {
      toast.error(error.message || "Erro ao agendar movimentação.");
    } finally {
      setAgendamentoLoading(false);
    }
  };

  const handleMarcarDiaVago = async (diaData: string) => {
    if (!escalaVisualizada?.postoId) {
      toast.error("Nao foi possivel identificar o posto para atualizar o dia.");
      return;
    }
    const motivo = motivoVagoPorDia[diaData];
    if (!motivo) {
      toast.error("Selecione um motivo para marcar o dia como vago.");
      return;
    }
    const motivoNormalizado = normalizeMotivoVago(motivo);
    const novoStatus = escalaVisualizada.colaborador?.id ? "vago_temporariamente" : "vago";

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error: updateDiasError } = await supabase
        .from("dias_trabalho")
        .update({ status: novoStatus, motivo_vago: motivoNormalizado })
        .eq("posto_servico_id", escalaVisualizada.postoId)
        .eq("data", diaData);

      if (updateDiasError) throw updateDiasError;

      const { error: upsertDiaVagoError } = await supabase
        .from("posto_dias_vagos")
        .upsert({
          posto_servico_id: escalaVisualizada.postoId,
          colaborador_id: escalaVisualizada.colaborador?.id ?? null,
          data: diaData,
          motivo: motivoNormalizado,
          created_by: user?.id ?? SYSTEM_USER_ID,
        });

      if (upsertDiaVagoError) throw upsertDiaVagoError;

      setEscalaVisualizada((prev) =>
        prev
          ? {
              ...prev,
              dias: prev.dias.map((d) =>
                d.data === diaData
                  ? {
                      ...d,
                      status: novoStatus,
                      motivo_vago: motivoNormalizado,
                    }
                  : d
              ),
            }
          : prev
      );
      await queryClient.invalidateQueries({ queryKey: ["posto-dias-vagos"] });

      toast.success("Dia marcado como vago.");
    } catch (error: any) {
      toast.error(error.message || "Erro ao marcar dia vago.");
    }
  };



  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Colaboradores</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie cadastros, alocacoes e presencas dos colaboradores.
            </p>
          </div>
          <Button onClick={handleNewColaborador} className="w-full md:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Novo colaborador
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="search-colaboradores">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="search-colaboradores"
                placeholder="Nome, CPF ou email"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {statusOptions.map((status) => (
                  <SelectItem key={status} value={status}>
                    {STATUS_COLABORADOR_LABELS[status] || status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Alocação</Label>
            <Select value={alocacaoFilter} onValueChange={setAlocacaoFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="alocado">Alocados</SelectItem>
                <SelectItem value="nao_alocado">N�o alocados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Cargo</Label>
            <Select value={cargoFilter} onValueChange={setCargoFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {cargoOptions.map((cargo) => (
                  <SelectItem key={cargo} value={cargo}>
                    {cargo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 lg:col-span-2">
            <Label>Unidade</Label>
            <Select value={unidadeFilter} onValueChange={setUnidadeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {unidades?.map((unidade) => (
                  <SelectItem key={unidade.id} value={unidade.id}>
                    {unidade.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-md border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
            <div>
              <p className="text-sm font-semibold">
                {totalColaboradores} {totalColaboradores === 1 ? "colaborador" : "colaboradores"}
              </p>
              <p className="text-xs text-muted-foreground">
                {filteredColaboradores && totalColaboradores !== colaboradores?.length
                  ? "Exibindo resultados com filtros aplicados"
                  : "Exibindo todos os colaboradores disponíveis"}
              </p>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Posto</TableHead>
                <TableHead className="w-[360px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredColaboradores?.length ? (
                filteredColaboradores.map((colaborador) => (
                  <TableRow
                    key={colaborador.id}
                    className="cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onClick={() => setColaboradorDetalhe(colaborador)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setColaboradorDetalhe(colaborador);
                      }
                    }}
                  >
                    <TableCell className="align-top">
                      <div className="space-y-2 rounded-md border border-transparent p-2 transition group-hover:border-muted">
                        <p className="font-semibold leading-tight">{colaborador.nome_completo}</p>
                        {colaborador.status_colaborador && (
                          <Badge
                            variant={STATUS_COLABORADOR_BADGE[colaborador.status_colaborador] || "outline"}
                            className="capitalize"
                          >
                            {STATUS_COLABORADOR_LABELS[colaborador.status_colaborador] ||
                              colaborador.status_colaborador}
                          </Badge>
                        )}

                      </div>
                    </TableCell>

                    <TableCell className="align-top">
                      {colaborador.posto ? (
                        <div className="space-y-1 text-sm">
                          <p className="font-medium">{colaborador.posto.nome}</p>
                          {colaborador.posto.unidade?.nome && (
                            <p className="text-xs text-muted-foreground">
                              Unidade: {colaborador.posto.unidade.nome}
                            </p>
                          )}
                          {colaborador.posto.ultimo_dia_atividade && (
                            <p className="text-xs text-muted-foreground">
                              �ltimo dia: {format(parseDbDate(colaborador.posto.ultimo_dia_atividade), "dd/MM/yyyy", { locale: ptBR })}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Sem posto associado</p>
                      )}
                    </TableCell>

                    <TableCell className="align-top">
                      <div className="flex flex-wrap gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(event) => {
                            event.stopPropagation();
                            setColaboradorDetalhe(colaborador);
                          }}
                          title="Ver detalhes"
                        >
                          <Info className="h-4 w-4" />
                          <span className="sr-only">Ver detalhes</span>
                        </Button>
                        {!colaborador.posto_servico_id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(event) => {
                              event.stopPropagation();
                              setUnidadeColaborador(colaborador);
                            }}
                            title="Atribuir unidade"
                          >
                            <MapPin className="h-4 w-4" />
                            <span className="sr-only">Atribuir unidade</span>
                          </Button>
                        )}
                        {!colaborador.posto_servico_id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(event) => {
                              event.stopPropagation();
                              openAgendamento("vincular", colaborador);
                            }}
                            title="Agendar ocupa��o"
                          >
                            <CalendarPlus className="h-4 w-4" />
                            <span className="sr-only">Agendar ocupa��o</span>
                          </Button>
                        )}
                        {colaborador.posto_servico_id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDesvincularPosto(colaborador);
                            }}
                            title="Desvincular do posto"
                          >
                            <Unlink className="h-4 w-4" />
                            <span className="sr-only">Desvincular do posto</span>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleVerEscala(colaborador);
                          }}
                          disabled={!colaborador.posto_servico_id}
                          title="Visualizar escala prevista"
                        >
                          <Calendar className="h-4 w-4" />
                          <span className="sr-only">Visualizar escala prevista</span>
                        </Button>
                        {/*<Button
                          variant="ghost"
                          size="icon"
                          onClick={(event) => {
                            event.stopPropagation();
                            setCalendarioColaborador(colaborador);
                          }}
                          title="Hist�rico de presen�a"
                        >
                          <History className="h-4 w-4" />
                          <span className="sr-only">Hist�rico de presen�a</span>
                        </Button>*/}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleEdit(colaborador);
                          }}
                          title="Editar colaborador"
                        >
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Editar colaborador</span>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Excluir colaborador"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                              <span className="sr-only">Excluir colaborador</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar exclus�o</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir este colaborador?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(colaborador.id)}>
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    Nenhum colaborador encontrado com os filtros selecionados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {showForm && (

          <ColaboradorForm

            open={showForm}

            onClose={() => {

              setShowForm(false);

              setEditingColaborador(null);

            }}

            colaborador={editingColaborador}

            onSuccess={() => {

              setShowForm(false);

              setEditingColaborador(null);

              refetch();

            }}

          />

        )}



        {showRequisitosMissing && (

          <RequisitosMissingDialog

            open={showRequisitosMissing}

            onClose={() => setShowRequisitosMissing(false)}

            missingEntities={missingEntities}

          />

        )}



        {escalaColaborador && (

          <AtribuirEscalaDialog

            open={!!escalaColaborador}

            onClose={() => setEscalaColaborador(null)}

            colaborador={escalaColaborador}

            onSuccess={refetch}

          />

        )}



        {unidadeColaborador && (

          <AtribuirUnidadeDialog

            open={!!unidadeColaborador}

            onClose={() => setUnidadeColaborador(null)}

            colaborador={unidadeColaborador}

            onSuccess={refetch}

          />

        )}



{/*        {calendarioColaborador && (

          <CalendarioPresencaDialog

            open={!!calendarioColaborador}

            onClose={() => setCalendarioColaborador(null)}

            colaborador={calendarioColaborador}

          />

        )}*/}


        {presencaColaborador && (

          <PresencaDialog

            open={!!presencaColaborador}

            colaborador={presencaColaborador}

            onClose={() => setPresencaColaborador(null)}

            onSuccess={refetch}

          />

        )}



        {agendamento && (

          <Dialog

            open={!!agendamento}

            onOpenChange={(open) => {

              if (!open) setAgendamento(null);

            }}

          >

            <DialogContent>

              <DialogHeader>

                <DialogTitle>

                  {agendamento.tipo === "desvincular"

                    ? "Agendar desvinculação"

                    : "Agendar vinculação"}

                </DialogTitle>

                <DialogDescription>

                  {agendamento.colaborador.nome_completo}

                </DialogDescription>

              </DialogHeader>

              <form className="space-y-4" onSubmit={handleAgendamentoSubmit}>

                {agendamento.tipo === "vincular" ? (
                  <>
                    <div className="space-y-2">
                      <Label>Posto de destino</Label>
                      <Select
                        value={agendamentoForm.postoDestino}
                        onValueChange={(value) =>
                          setAgendamentoForm((prev) => ({ ...prev, postoDestino: value, data: "" }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o posto" />
                        </SelectTrigger>
                        <SelectContent className="max-h-72 overflow-y-auto">
                          {postosDisponiveis.length === 0 ? (
                            <SelectItem value="none" disabled>
                              Nenhum posto vago disponível
                            </SelectItem>
                          ) : (
                            postosDisponiveis.map((posto: any) => (
                              <SelectItem key={posto.id} value={posto.id}>
                                {posto.nome}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Data disponível</Label>
                      <Select
                        value={agendamentoForm.data}
                        onValueChange={(value) =>
                          setAgendamentoForm((prev) => ({ ...prev, data: value }))
                        }
                        disabled={datasDisponiveisVinculacao.length === 0}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              datasDisponiveisVinculacao.length === 0
                                ? "Selecione um posto para listar as datas"
                                : "Selecione a data"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent className="max-h-72 overflow-y-auto">
                          {datasDisponiveisVinculacao.map((data) => (
                            <SelectItem key={data} value={data}>
                              {format(new Date(`${data}T00:00:00`), "dd/MM/yyyy", { locale: ptBR })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {agendamentoForm.postoDestino && datasDisponiveisVinculacao.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          Nenhuma data disponível para o posto selecionado.
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <Label>Data</Label>
                    <Input
                      type="date"
                      value={agendamentoForm.data}
                      min={new Date().toISOString().split("T")[0]}
                      onChange={(e) =>
                        setAgendamentoForm((prev) => ({ ...prev, data: e.target.value }))
                      }
                      required
                    />
                  </div>
                )}

                <div className="flex justify-end gap-2">

                  <Button type="button" variant="outline" onClick={() => setAgendamento(null)}>

                    Cancelar

                  </Button>

                  <Button
                    type="submit"
                    disabled={
                      agendamentoLoading ||
                      (agendamento?.tipo === "vincular" && !agendamentoForm.data)
                    }
                  >

                    {agendamentoLoading ? "Salvando..." : "Confirmar agendamento"}

                  </Button>

                </div>

              </form>

            </DialogContent>

          </Dialog>

        )}



        <Dialog

          open={!!escalaVisualizada}

          onOpenChange={(open) => {

            if (!open) setEscalaVisualizada(null);

          }}

        >

          <DialogContent>

            <DialogHeader>

              <DialogTitle>

                Escala prevista - {escalaVisualizada?.colaborador?.nome_completo}

              </DialogTitle>

              <DialogDescription>

                Dias cadastrados na tabela de dias de trabalho para este colaborador.

              </DialogDescription>

            </DialogHeader>

            {escalaVisualizada ? (

              escalaVisualizada.dias.length > 0 ? (

                <div className="space-y-2 max-h-64 overflow-y-auto">

                  {escalaVisualizada.dias.map((dia) => (

                    <div

                      key={dia.id || `${escalaVisualizada.colaborador.id}-${dia.data}`}

                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"

                    >

                      <span>

                        {format(parseDbDate(dia.data), "dd/MM/yyyy", { locale: ptBR })}

                      </span>

                      <div className="flex flex-col items-end gap-2">
                        {dia.status && (
                          <Badge variant={getStatusBadge(dia.status)} className="capitalize">
                            {getStatusLabel(dia.status)}
                          </Badge>
                        )}
                        {dia.motivo_vago && (
                          <span className="text-xs text-muted-foreground">
                            Motivo: {dia.motivo_vago}
                          </span>
                        )}
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <Select
                            value={motivoVagoPorDia[dia.data] || ""}
                            onValueChange={(value) =>
                              setMotivoVagoPorDia((prev) => ({ ...prev, [dia.data]: value }))
                            }
                          >
                            <SelectTrigger className="w-[160px]">
                              <SelectValue placeholder="Motivo" />
                            </SelectTrigger>
                            <SelectContent>
                              {MOTIVOS_VAGO.map((motivo) => (
                                <SelectItem key={motivo} value={motivo}>
                                  {motivo}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleMarcarDiaVago(dia.data)}>
                              Marcar vago
                            </Button>
                            {/*{dia.status !== "presenca_confirmada" && (
                              <Button size="sm" onClick={() => handleConfirmarPresencaEscala(dia.id)}>
                                Confirmar presença
                              </Button>
                            )}*/}
                          </div>
                        </div>
                      </div>

                    </div>

                  ))}

                </div>

              ) : (

                <p className="text-sm text-muted-foreground">

                  Nenhum dia de trabalho encontrado para este colaborador.

                </p>

              )

            ) : null}

          </DialogContent>

        </Dialog>



        <Dialog

          open={!!colaboradorDetalhe}

          onOpenChange={(open) => {

            if (!open) setColaboradorDetalhe(null);

          }}

        >

          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">

            <DialogHeader>

              <DialogTitle>

                {colaboradorDetalhe?.nome_completo || "Colaborador"}

              </DialogTitle>

              <DialogDescription>

                Informações completas do colaborador

              </DialogDescription>

            </DialogHeader>



            {colaboradorDetalhe && (

              <div className="space-y-4">

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                  <div>

                    <p className="text-xs text-muted-foreground">Email</p>

                    <p className="font-medium">{colaboradorDetalhe.email || "-"}</p>

                  </div>

                  <div>

                    <p className="text-xs text-muted-foreground">Telefone</p>

                    <p className="font-medium">{colaboradorDetalhe.telefone || "-"}</p>

                  </div>

                  <div>

                    <p className="text-xs text-muted-foreground">Status</p>

                    <p className="font-medium">
                      {STATUS_COLABORADOR_LABELS[colaboradorDetalhe.status_colaborador || ""] ||
                        colaboradorDetalhe.status_colaborador ||
                        "-"}
                    </p>

                  </div>

                  <div>

                    <p className="text-xs text-muted-foreground">Cargo</p>

                    <p className="font-medium">{colaboradorDetalhe.cargo || "-"}</p>

                  </div>

                  <div>

                    <p className="text-xs text-muted-foreground">Tipo / Escala</p>

                    <p className="font-medium">

                      {colaboradorDetalhe.escala?.tipo

                        ? colaboradorDetalhe.escala.tipo

                        : "efetivo"}

                    </p>

                  </div>

                </div>



                <div className="rounded-md border p-4 space-y-2">

                  <p className="font-semibold">Alocação</p>

                  {colaboradorDetalhe.posto_servico_id ? (

                    <div className="space-y-1 text-sm">

                      <p>

                        <span className="font-medium">Posto: </span>

                        {colaboradorDetalhe.posto?.nome || "-"}

                      </p>

                      <p>

                        <span className="font-medium">Status do Posto: </span>

                        {STATUS_POSTO_LABELS[colaboradorDetalhe.posto?.status || "vago"] || "vago"}

                      </p>

                      <p>

                        <span className="font-medium">Unidade: </span>

                        {colaboradorDetalhe.posto?.unidade?.nome ||

                          colaboradorDetalhe.unidade?.nome ||

                          "-"}

                      </p>

                      <p>

                        <span className="font-medium">Contrato: </span>

                        {colaboradorDetalhe.posto?.unidade?.contratos
                          ? `${colaboradorDetalhe.posto.unidade.contratos.negocio} (${colaboradorDetalhe.posto.unidade.contratos.conq_perd})`
                          : colaboradorDetalhe.unidade?.contratos
                          ? `${colaboradorDetalhe.unidade.contratos.negocio} (${colaboradorDetalhe.unidade.contratos.conq_perd})`
                          : "-"}

                      </p>

                    </div>

                  ) : (

                    <p className="text-sm text-muted-foreground">

                      Não alocado a um posto de serviço.

                    </p>

                  )}

                </div>

              </div>

            )}

          </DialogContent>

        </Dialog>

      </div>

    </DashboardLayout>

  );

}


