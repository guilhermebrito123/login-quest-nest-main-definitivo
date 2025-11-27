import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { AlertCircle, Users, CalendarOff } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { getEfetivoPlanejadoAjustado } from "@/lib/postos";
import { agendarOcupacaoPosto } from "@/lib/ocupacao";

type StatusDiaria =
  | "Aguardando confirmacao"
  | "Confirmada"
  | "Aprovada"
  | "Lançada para pagamento"
  | "Aprovada para pagamento"
  | "Cancelada";

interface DiariaResumo {
  id: string;
  status: StatusDiaria;
  valor: number;
  diarista?: {
    id: string;
    nome_completo: string;
    telefone: string;
  };
}

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

const parseDateFromDB = (dateStr: string) => {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

interface GestaoCoberturaDialogProps {
  open: boolean;
  onClose: () => void;
}

interface PostoVago {
  id: string;
  nome: string;
  codigo: string;
  funcao: string;
  efetivo_planejado: number;
  efetivo_atual: number;
  unidadeId?: string | null;
  unidade: {
    id?: string | null;
    nome: string;
    codigo: string;
    contrato: {
      nome: string;
      codigo: string;
    } | null;
  };
}

interface DiaVago {
  id: string;
  data: string;
  motivo: string | null;
  postoId: string;
  diarias: DiariaResumo[];
  posto: {
    id?: string;
    nome: string;
    codigo: string;
    valor_diaria?: number | null;
    unidade: {
      nome: string;
      contrato: {
        nome: string;
        codigo: string;
      } | null;
    };
  };
  colaborador: {
    nome_completo: string;
    cargo: string;
  } | null;
}

interface ColaboradorReserva {
  id: string;
  nome_completo: string;
  cargo: string;
  funcao: string;
}

interface Diarista {
  id: string;
  nome_completo: string;
  telefone: string;
  cidade: string | null;
}

const isMotivoPostoVago = (motivo?: string | null) =>
  motivo?.toLowerCase().trim() === "posto vago";

export function GestaoCoberturaDialog({ open, onClose }: GestaoCoberturaDialogProps) {
  const [loading, setLoading] = useState(true);
  const [postosVagos, setPostosVagos] = useState<PostoVago[]>([]);
  const [diasVagos, setDiasVagos] = useState<DiaVago[]>([]);
  const [colaboradoresReserva, setColaboradoresReserva] = useState<ColaboradorReserva[]>([]);
  const [diaristas, setDiaristas] = useState<Diarista[]>([]);
  const [filterPosto, setFilterPosto] = useState<string>("all");
  const [filterData, setFilterData] = useState<Date | undefined>(undefined);
  const [filterDia, setFilterDia] = useState<string>("all");
  const [postos, setPostos] = useState<{ id: string; nome: string; codigo: string }[]>([]);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedDiaParaCadastro, setSelectedDiaParaCadastro] = useState<DiaVago | null>(null);
  const [selectedDiaristaId, setSelectedDiaristaId] = useState("");
  const [savingDiaria, setSavingDiaria] = useState(false);
  const [ocupacaoModalOpen, setOcupacaoModalOpen] = useState(false);
  const [selectedDiaParaOcupacao, setSelectedDiaParaOcupacao] = useState<DiaVago | null>(null);
  const [selectedColaboradorReservaId, setSelectedColaboradorReservaId] = useState("");
  const [savingOcupacao, setSavingOcupacao] = useState(false);
  const [agendarPostoModalOpen, setAgendarPostoModalOpen] = useState(false);
  const [selectedPostoParaAgendamento, setSelectedPostoParaAgendamento] = useState<PostoVago | null>(null);
  const [datasDisponiveisPosto, setDatasDisponiveisPosto] = useState<string[]>([]);
  const [selectedDataPosto, setSelectedDataPosto] = useState("");
  const [selectedColaboradorPosto, setSelectedColaboradorPosto] = useState("");
  const [savingAgendamentoPosto, setSavingAgendamentoPosto] = useState(false);
  const [atribuirPostoModalOpen, setAtribuirPostoModalOpen] = useState(false);
  const [selectedPostoParaAtribuicao, setSelectedPostoParaAtribuicao] = useState<PostoVago | null>(null);
  const [selectedColaboradorParaAtribuicao, setSelectedColaboradorParaAtribuicao] = useState("");
  const [savingAtribuirPosto, setSavingAtribuirPosto] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      loadData();
    }
    if (!open) {
      setAssignModalOpen(false);
      setSelectedDiaParaCadastro(null);
      setSelectedDiaristaId("");
      setOcupacaoModalOpen(false);
      setSelectedDiaParaOcupacao(null);
      setSelectedColaboradorReservaId("");
      setSavingOcupacao(false);
      setAgendarPostoModalOpen(false);
      setSelectedPostoParaAgendamento(null);
      setDatasDisponiveisPosto([]);
      setSelectedDataPosto("");
      setSelectedColaboradorPosto("");
      setSavingAgendamentoPosto(false);
      setAtribuirPostoModalOpen(false);
      setSelectedPostoParaAtribuicao(null);
      setSelectedColaboradorParaAtribuicao("");
      setSavingAtribuirPosto(false);
    }
  }, [open]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadPostosVagos(), loadDiasVagos(), loadPostos(), loadColaboradoresReserva(), loadDiaristas()]);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadPostos = async () => {
    const { data, error } = await supabase
      .from("postos_servico")
      .select("id, nome, codigo")
      .in("status", ["vago", "vago_temporariamente"])
      .order("nome");

    if (error) throw error;
    setPostos(data || []);
  };

  const loadPostosVagos = async () => {
    // Get all active postos with their units
    const { data: postosData, error: postosError } = await supabase
      .from("postos_servico")
      .select(`
        id,
        nome,
        codigo,
        funcao,
        escala,
        unidade_id,
        unidades (
          id,
          nome,
          codigo,
          contratos (
            nome,
            codigo
          )
        )
      `)
      .in("status", ["vago", "vago_temporariamente"]);

    if (postosError) throw postosError;

    // For each posto, count colaboradores
    const postosVagosData: PostoVago[] = [];
    
    for (const posto of postosData || []) {
      const { data: colabsData } = await supabase
        .from("colaboradores")
        .select("id")
        .eq("posto_servico_id", posto.id)
        .eq("status_colaborador", "ativo");

      const efetivoAtual = colabsData?.length || 0;
      const efetivoNecessario = getEfetivoPlanejadoAjustado(posto);

      if (efetivoAtual < efetivoNecessario) {
        postosVagosData.push({
          id: posto.id,
          nome: posto.nome,
          codigo: posto.codigo,
          funcao: posto.funcao,
          efetivo_planejado: efetivoNecessario,
          efetivo_atual: efetivoAtual,
          unidadeId: posto.unidade_id,
          unidade: {
            id: posto.unidades?.id ?? null,
            nome: posto.unidades?.nome || "Sem unidade",
            codigo: posto.unidades?.codigo || "",
            contrato: posto.unidades?.contratos
              ? {
                  nome: posto.unidades.contratos.nome,
                  codigo: posto.unidades.contratos.codigo,
                }
              : null,
          },
        });
      }
    }

    setPostosVagos(postosVagosData);
  };

  const loadDiasVagos = async () => {
    const { data, error } = await supabase
      .from("posto_dias_vagos")
      .select(`
        id,
        data,
        motivo,
        posto_servico_id,
        postos_servico (
          id,
          nome,
          codigo,
          valor_diaria,
          unidades (
            nome,
            contratos (
              nome,
              codigo
            )
          )
        ),
        colaboradores (
          nome_completo,
          cargo
        ),
        diarias:diarias_posto_dia_vago_id_fkey (
          id,
          status,
          valor,
          diaristas (
            id,
            nome_completo,
            telefone
          )
        )
      `)
      .gte("data", new Date().toISOString().split("T")[0])
      .order("data");

    if (error) throw error;

    const diasVagosData: DiaVago[] = (data || []).map((item: any) => ({
      id: item.id,
      data: item.data,
      motivo: item.motivo,
      postoId: item.posto_servico_id,
      posto: {
        id: item.postos_servico?.id,
        nome: item.postos_servico?.nome || "Desconhecido",
        codigo: item.postos_servico?.codigo || "",
        valor_diaria: item.postos_servico?.valor_diaria ?? null,
        unidade: {
          nome: item.postos_servico?.unidades?.nome || "Sem unidade",
          contrato: item.postos_servico?.unidades?.contratos
            ? {
                nome: item.postos_servico.unidades.contratos.nome,
                codigo: item.postos_servico.unidades.contratos.codigo,
              }
            : null,
        },
      },
      colaborador: item.colaboradores
        ? {
            nome_completo: item.colaboradores.nome_completo,
            cargo: item.colaboradores.cargo || "Sem cargo",
          }
        : null,
      diarias:
        item.diarias?.map((diaria: any) => ({
          id: diaria.id,
          status: diaria.status as StatusDiaria,
          valor: diaria.valor || 0,
          diarista: diaria.diaristas
            ? {
                id: diaria.diaristas.id,
                nome_completo: diaria.diaristas.nome_completo,
                telefone: diaria.diaristas.telefone,
              }
            : undefined,
        })) || [],
    }));

    const diasSemDiaria = diasVagosData.filter((dia) => dia.diarias.length === 0);
    setDiasVagos(diasSemDiaria);
  };

  const loadColaboradoresReserva = async () => {
    const { data, error } = await supabase
      .from("colaboradores")
      .select("id, nome_completo, cargo")
      .is("posto_servico_id", null)
      .eq("status_colaborador", "ativo")
      .order("nome_completo");

    if (error) throw error;

    const reservasData: ColaboradorReserva[] = (data || []).map((colab) => ({
      id: colab.id,
      nome_completo: colab.nome_completo,
      cargo: colab.cargo || "Sem cargo",
      funcao: colab.cargo || "Sem função",
    }));

    setColaboradoresReserva(reservasData);
  };

  const loadDiaristas = async () => {
    const { data, error } = await supabase
      .from("diaristas")
      .select("id, nome_completo, telefone, cidade")
      .eq("status", "ativo")
      .order("nome_completo");

    if (error) throw error;

    setDiaristas(data || []);
  };

  const openCadastroDiariaDialog = (dia: DiaVago) => {
    setSelectedDiaParaCadastro(dia);
    setSelectedDiaristaId("");
    setAssignModalOpen(true);
  };

  const closeCadastroDiariaDialog = () => {
    setAssignModalOpen(false);
    setSelectedDiaParaCadastro(null);
    setSelectedDiaristaId("");
  };

  const openAgendamentoOcupacaoDialog = (dia: DiaVago) => {
    setSelectedDiaParaOcupacao(dia);
    setSelectedColaboradorReservaId("");
    setOcupacaoModalOpen(true);
  };

  const closeAgendamentoOcupacaoDialog = () => {
    setOcupacaoModalOpen(false);
    setSelectedDiaParaOcupacao(null);
    setSelectedColaboradorReservaId("");
  };

  const handleAgendarOcupacaoDia = async () => {
    if (!selectedDiaParaOcupacao) return;
    if (!selectedColaboradorReservaId) {
      toast({
        title: "Selecione um colaborador",
        description: "Escolha um colaborador de reserva para ocupar este dia.",
        variant: "destructive",
      });
      return;
    }
    if (!selectedDiaParaOcupacao.postoId) {
      toast({
        title: "Posto n\u00e3o encontrado",
        description: "N\u00e3o foi poss\u00edvel identificar o posto deste dia.",
        variant: "destructive",
      });
      return;
    }

    setSavingOcupacao(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usu\u00e1rio n\u00e3o autenticado");

      await agendarOcupacaoPosto({
        postoId: selectedDiaParaOcupacao.postoId,
        colaboradorId: selectedColaboradorReservaId,
        data: selectedDiaParaOcupacao.data,
        usuarioId: user.id,
      });

      const colaboradorSelecionado = colaboradoresReserva.find(
        (colab) => colab.id === selectedColaboradorReservaId
      );

      toast({
        title: "Ocupa\u00e7\u00e3o agendada",
        description: colaboradorSelecionado
          ? `${colaboradorSelecionado.nome_completo} iniciar\u00e1 em ${format(
              parseDateFromDB(selectedDiaParaOcupacao.data),
              "dd/MM/yyyy",
              { locale: ptBR }
            )}.`
          : "Ocupa\u00e7\u00e3o confirmada para o dia selecionado.",
      });

      closeAgendamentoOcupacaoDialog();
      await Promise.all([
        loadDiasVagos(),
        loadPostosVagos(),
        loadPostos(),
        loadColaboradoresReserva(),
      ]);
    } catch (error: any) {
      toast({
        title: "Erro ao agendar ocupa\u00e7\u00e3o",
        description: error?.message || "N\u00e3o foi poss\u00edvel agendar a ocupa\u00e7\u00e3o.",
        variant: "destructive",
      });
    } finally {
      setSavingOcupacao(false);
    }
  };

  const openAgendamentoPostoDialog = async (posto: PostoVago) => {
    setSelectedPostoParaAgendamento(posto);
    setAgendarPostoModalOpen(true);
    setSelectedColaboradorPosto("");
    setSelectedDataPosto("");
    try {
      const hoje = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("dias_trabalho")
        .select("data")
        .eq("posto_servico_id", posto.id)
        .is("colaborador_id", null)
        .gte("data", hoje)
        .order("data");
      if (error) throw error;
      const datas = data?.map((item: { data: string }) => item.data) ?? [];
      setDatasDisponiveisPosto(datas);
      if (datas.length > 0) {
        setSelectedDataPosto(datas[0]);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar datas",
        description: error?.message || "N\u00e3o foi poss\u00edvel listar os dias dispon\u00edveis.",
        variant: "destructive",
      });
      setDatasDisponiveisPosto([]);
    }
  };

  const closeAgendamentoPostoDialog = () => {
    setAgendarPostoModalOpen(false);
    setSelectedPostoParaAgendamento(null);
    setDatasDisponiveisPosto([]);
    setSelectedColaboradorPosto("");
    setSelectedDataPosto("");
  };

  const handleAgendarOcupacaoPostoVago = async () => {
    if (!selectedPostoParaAgendamento) return;
    if (!selectedColaboradorPosto) {
      toast({
        title: "Selecione um colaborador",
        description: "Escolha um colaborador de reserva para assumir o posto.",
        variant: "destructive",
      });
      return;
    }
    if (!selectedDataPosto) {
      toast({
        title: "Selecione uma data",
        description: "Escolha um dia dispon\u00edvel da agenda do posto.",
        variant: "destructive",
      });
      return;
    }

    setSavingAgendamentoPosto(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usu\u00e1rio n\u00e3o autenticado");

      await agendarOcupacaoPosto({
        postoId: selectedPostoParaAgendamento.id,
        colaboradorId: selectedColaboradorPosto,
        data: selectedDataPosto,
        usuarioId: user.id,
      });

      const colaborador = colaboradoresReserva.find(
        (c) => c.id === selectedColaboradorPosto
      );

      toast({
        title: "Ocupação agendada",
        description: colaborador
          ? `${colaborador.nome_completo} iniciar\u00e1 em ${format(
              parseDateFromDB(selectedDataPosto),
              "dd/MM/yyyy",
              { locale: ptBR }
            )}.`
          : "Ocupa\u00e7\u00e3o confirmada para a data selecionada.",
      });

      closeAgendamentoPostoDialog();
      await Promise.all([loadPostosVagos(), loadDiasVagos(), loadColaboradoresReserva()]);
    } catch (error: any) {
      toast({
        title: "Erro ao agendar ocupa\u00e7\u00e3o",
        description: error?.message || "N\u00e3o foi poss\u00edvel agendar a ocupa\u00e7\u00e3o.",
        variant: "destructive",
      });
    } finally {
      setSavingAgendamentoPosto(false);
    }
  };

  const openAtribuirPostoDialog = (posto: PostoVago) => {
    setSelectedPostoParaAtribuicao(posto);
    setSelectedColaboradorParaAtribuicao("");
    setAtribuirPostoModalOpen(true);
  };

  const closeAtribuirPostoDialog = () => {
    setAtribuirPostoModalOpen(false);
    setSelectedPostoParaAtribuicao(null);
    setSelectedColaboradorParaAtribuicao("");
  };

  const handleAtribuirPosto = async () => {
    if (!selectedPostoParaAtribuicao) return;
    if (!selectedColaboradorParaAtribuicao) {
      toast({
        title: "Selecione um colaborador",
        description: "Escolha um colaborador de reserva para assumir o posto.",
        variant: "destructive",
      });
      return;
    }

    setSavingAtribuirPosto(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usu\u00e1rio n\u00e3o autenticado");

      const hoje = new Date().toISOString().split("T")[0];
      let dataInicial = hoje;
      const { data: diasDisponiveis, error: diasError } = await supabase
        .from("dias_trabalho")
        .select("data")
        .eq("posto_servico_id", selectedPostoParaAtribuicao.id)
        .gte("data", hoje)
        .order("data")
        .limit(1);
      if (diasError) throw diasError;
      if (diasDisponiveis && diasDisponiveis.length > 0) {
        dataInicial = diasDisponiveis[0].data;
      }

      await agendarOcupacaoPosto({
        postoId: selectedPostoParaAtribuicao.id,
        colaboradorId: selectedColaboradorParaAtribuicao,
        data: dataInicial,
        usuarioId: user.id,
      });

      const colaborador = colaboradoresReserva.find(
        (colab) => colab.id === selectedColaboradorParaAtribuicao
      );

      toast({
        title: "Posto atribuído",
        description: colaborador
          ? `${colaborador.nome_completo} foi alocado ao posto ${
              selectedPostoParaAtribuicao.nome
            } a partir de ${format(parseDateFromDB(dataInicial), "dd/MM/yyyy", {
              locale: ptBR,
            })}.`
          : "Posto atribuído com sucesso.",
      });

      closeAtribuirPostoDialog();
      await Promise.all([loadPostosVagos(), loadDiasVagos(), loadColaboradoresReserva(), loadPostos()]);
      try {
        await queryClient.invalidateQueries({ queryKey: ["colaboradores"] });
        await queryClient.invalidateQueries({ queryKey: ["postos-disponiveis-agendamento"] });
      } catch {
        // ignore cache errors
      }
    } catch (error: any) {
      toast({
        title: "Erro ao atribuir posto",
        description: error?.message || "N\u00e3o foi poss\u00edvel concluir a atribui\u00e7\u00e3o.",
        variant: "destructive",
      });
    } finally {
      setSavingAtribuirPosto(false);
    }
  };

  const handleCadastrarDiaria = async () => {
    if (!selectedDiaParaCadastro) return;
    if (!selectedDiaristaId) {
      toast({
        title: "Selecione um diarista",
        description: "Escolha um diarista para registrar a di\u00e1ria.",
        variant: "destructive",
      });
      return;
    }

    setSavingDiaria(true);
    try {
      const dia = selectedDiaParaCadastro;
      const { data: conflito, error: conflitoError } = await supabase
        .from("diarias")
        .select(
          `
            id,
            posto_dia_vago:posto_dia_vago_id (
              data
            )
          `
        )
        .eq("diarista_id", selectedDiaristaId)
        .eq("posto_dia_vago.data", dia.data)
        .limit(1);

      if (conflitoError) throw conflitoError;
      if (conflito && conflito.length > 0) {
        toast({
          title: "Conflito de data",
          description: "Este diarista já possui uma diária cadastrada para esta data.",
          variant: "destructive",
        });
        setSavingDiaria(false);
        return;
      }

      const payload: Record<string, unknown> = {
        posto_dia_vago_id: dia.id,
        diarista_id: selectedDiaristaId,
      };

      if (dia.posto?.valor_diaria !== undefined && dia.posto?.valor_diaria !== null) {
        payload.valor = dia.posto.valor_diaria;
      }

      const { error } = await supabase.from("diarias").insert(payload);
      if (error) throw error;

      toast({
        title: "Diária cadastrada",
        description: "Diarista vinculado ao dia selecionado.",
      });
      closeCadastroDiariaDialog();
      await loadDiasVagos();
    } catch (error: any) {
      toast({
        title: "Erro ao cadastrar diária",
        description: error?.message || "Não foi possível registrar a diária.",
        variant: "destructive",
      });
    } finally {
      setSavingDiaria(false);
    }
  };

  const filteredPostosVagos = postosVagos.filter((posto) => {
    if (filterPosto !== "all" && posto.id !== filterPosto) return false;
    return true;
  });

  const filteredDiasVagos = diasVagos.filter((dia) => {
    if (filterPosto !== "all") {
      const postoMatch = postos.find((p) => p.id === filterPosto);
      if (postoMatch && dia.posto.codigo !== postoMatch.codigo) return false;
    }
    if (filterData) {
      const diaDate = parseDateFromDB(dia.data);
      if (
        diaDate.getDate() !== filterData.getDate() ||
        diaDate.getMonth() !== filterData.getMonth() ||
        diaDate.getFullYear() !== filterData.getFullYear()
      ) {
        return false;
      }
    }
    if (filterDia !== "all" && dia.data !== filterDia) return false;
    return true;
  });

  const uniqueDias = Array.from(new Set(diasVagos.map((dia) => dia.data))).sort();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <AlertCircle className="h-6 w-6 text-orange-500" />
            Gestão de Cobertura
          </DialogTitle>
          <DialogDescription>
            Monitore postos vagos e dias com ausências programadas
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Filtros</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium mb-2 block">Posto</label>
                <Select value={filterPosto} onValueChange={setFilterPosto}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os postos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os postos</SelectItem>
                    {postos.map((posto) => (
                      <SelectItem key={posto.id} value={posto.id}>
                        {posto.codigo} - {posto.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium mb-2 block">Data</label>
                <Calendar
                  mode="single"
                  selected={filterData}
                  onSelect={setFilterData}
                  className="border rounded-md"
                  locale={ptBR}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium mb-2 block">Filtrar por dia específico</label>
                <Select value={filterDia} onValueChange={setFilterDia}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os dias" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os dias</SelectItem>
                    {uniqueDias.map((dia) => (
                      <SelectItem key={dia} value={dia}>
                        {format(parseDateFromDB(dia), "dd/MM/yyyy", { locale: ptBR })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Postos Vagos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-red-500" />
                Postos Vagos ({filteredPostosVagos.length})
              </CardTitle>
              <CardDescription>
                Postos com vagas não preenchidas
              </CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                  <p className="text-sm text-muted-foreground">Carregando...</p>
                ) : filteredPostosVagos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum posto vago encontrado
                  </p>
                ) : (
                  <div className="space-y-3">
                    {filteredPostosVagos.map((posto) => (
                      <Card
                        key={posto.id}
                        className="border-red-200 bg-red-100 dark:bg-red-900/50 dark:border-red-800"
                      >
                        <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold">{posto.nome}</h4>
                              <Badge variant="outline">{posto.codigo}</Badge>
                            </div>
                            <div className="space-y-1 mb-2">
                              {posto.unidade.contrato && (
                                <p className="text-sm text-muted-foreground">
                                  <span className="font-medium">Contrato:</span> {posto.unidade.contrato.codigo} - {posto.unidade.contrato.nome}
                                </p>
                              )}
                              <p className="text-sm text-muted-foreground">
                                <span className="font-medium">Unidade:</span> {posto.unidade.nome} • {posto.funcao}
                              </p>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-sm">
                                <span className="text-muted-foreground">Efetivo atual: </span>
                                <span className="font-medium text-red-500">
                                  {posto.efetivo_atual}
                                </span>
                              </div>
                              <div className="text-sm">
                                <span className="text-muted-foreground">Efetivo necessário: </span>
                                <span className="font-medium">
                                  {posto.efetivo_planejado}
                                </span>
                              </div>
                              <Badge variant="destructive">
                                Faltam {posto.efetivo_planejado - posto.efetivo_atual} colaboradores
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openAgendamentoPostoDialog(posto)}
                            disabled={colaboradoresReserva.length === 0}
                            title={
                              colaboradoresReserva.length === 0
                                ? "Nenhum colaborador de reserva disponível"
                                : "Agendar ocupação para este posto"
                            }
                          >
                            Agendar ocupação
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openAtribuirPostoDialog(posto)}
                            disabled={colaboradoresReserva.length === 0}
                            title={
                              colaboradoresReserva.length === 0
                                ? "Nenhum colaborador de reserva disponível"
                                : "Atribuir posto diretamente a um colaborador"
                            }
                          >
                            Atribuir posto
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {/* Reservas Técnicas Disponíveis */}
                  {colaboradoresReserva.length > 0 && (
                    <div className="mt-6 pt-6 border-t">
                      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <Users className="h-5 w-5 text-green-500" />
                        Reservas Técnicas Disponíveis ({colaboradoresReserva.length})
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {colaboradoresReserva.map((colab) => (
                          <Card key={colab.id} className="border-green-200">
                            <CardContent className="p-3">
                              <div>
                                <h4 className="font-semibold text-sm mb-1">
                                  {colab.nome_completo}
                                </h4>
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className="text-xs">
                                    {colab.cargo}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs bg-green-50">
                                    Disponível
                                  </Badge>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dias Vagos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarOff className="h-5 w-5 text-orange-500" />
                Dias Vagos ({filteredDiasVagos.length})
              </CardTitle>
              <CardDescription>
                Dias com ausências programadas de colaboradores
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : filteredDiasVagos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum dia vago encontrado
                </p>
              ) : (
                  <div className="space-y-3">
                    {filteredDiasVagos.map((dia) => {
                        const podeAgendarOcupacao = isMotivoPostoVago(dia.motivo);
                        return (
                          <Card
                            key={dia.id}
                            className="border-orange-200 bg-orange-100 dark:bg-orange-900/50 dark:border-orange-800"
                          >
                            <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold">
                                {format(parseDateFromDB(dia.data), "dd 'de' MMMM 'de' yyyy", {
                                  locale: ptBR,
                                })}
                              </h4>
                              <Badge variant="outline">{dia.posto.codigo}</Badge>
                            </div>
                            <div className="space-y-1 mb-2">
                              {dia.posto.unidade.contrato && (
                                <p className="text-sm text-muted-foreground">
                                  <span className="font-medium">Contrato:</span> {dia.posto.unidade.contrato.codigo} - {dia.posto.unidade.contrato.nome}
                                </p>
                              )}
                              <p className="text-sm text-muted-foreground">
                                <span className="font-medium">Unidade:</span> {dia.posto.unidade.nome} • {dia.posto.nome}
                              </p>
                            </div>
                            {dia.colaborador ? (
                              <div className="space-y-1">
                                <div className="text-sm">
                                  <span className="text-muted-foreground">Colaborador: </span>
                                  <span className="font-medium">
                                    {dia.colaborador.nome_completo}
                                  </span>
                                </div>
                                <div className="text-sm">
                                  <span className="text-muted-foreground">Cargo: </span>
                                  <span className="font-medium">
                                    {dia.colaborador.cargo}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground italic">
                                Sem colaborador atribuído
                              </p>
                            )}
                            {dia.motivo && (
                              <div className="mt-2 text-sm">
                                <span className="text-muted-foreground">Motivo: </span>
                                <Badge variant="secondary">
                                  {dia.motivo === 'falta_justificada' ? 'Falta Justificada' :
                                   dia.motivo === 'falta_injustificada' ? 'Falta Injustificada' :
                                   dia.motivo === 'pedido' ? 'Pedido' :
                                   dia.motivo === 'afastamento_inss' ? 'Afastamento INSS' :
                                   dia.motivo === 'folga' ? 'Folga' :
                                   dia.motivo === 'ferias' ? 'Férias' :
                                   dia.motivo === 'suspensao' ? 'Suspensão' :
                                   dia.motivo}
                                </Badge>
                              </div>
                            )}
                            <div className="mt-3">
                              {dia.diarias.length > 0 ? (
                                <div className="space-y-2">
                                  <p className="text-sm font-medium">
                                    Diarias cadastradas ({dia.diarias.length})
                                  </p>
                                  <div className="space-y-2">
                                    {dia.diarias.map((diaria) => (
                                      <div key={diaria.id} className="rounded-md border px-3 py-2 text-sm">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                          <Badge variant="outline">{diaria.status}</Badge>
                                          <span className="font-semibold">
                                            {currencyFormatter.format(Number(diaria.valor) || 0)}
                                          </span>
                                        </div>
                                        {diaria.diarista && (
                                          <p className="text-xs text-muted-foreground mt-1">
                                            Diarista: {diaria.diarista.nome_completo}
                                            {diaria.diarista.telefone ? (
                                              <span> - {diaria.diarista.telefone}</span>
                                            ) : null}
                                          </p>
                                        )}
                                        <div className="mt-2 text-xs text-muted-foreground space-y-1">
                                          <p>
                                            Data:{" "}
                                            {format(parseDateFromDB(dia.data), "dd/MM/yyyy", { locale: ptBR })}
                                          </p>
                                          <p>
                                            Posto: {dia.posto.nome} {dia.posto.codigo ? `(${dia.posto.codigo})` : ""}
                                          </p>
                                          <p>Unidade: {dia.posto.unidade?.nome || "Sem unidade"}</p>
                                          <p>Motivo do dia: {dia.motivo || "Não informado"}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground">
                                  Nenhuma diaria cadastrada para este dia
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex w-full flex-col gap-2 sm:w-auto">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openCadastroDiariaDialog(dia)}
                            >
                              Cadastrar diária
                            </Button>
                            {podeAgendarOcupacao && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => openAgendamentoOcupacaoDialog(dia)}
                                disabled={colaboradoresReserva.length === 0}
                                title={
                                  colaboradoresReserva.length === 0
                                    ? "Nenhum colaborador de reserva disponível"
                                    : "Agendar ocupação para este dia"
                                }
                              >
                                Agendar ocupação
                              </Button>
                            )}
                          </div>
                        </div>
                        </CardContent>
                      </Card>
                    );
                  })}

                  {/* Diaristas Disponíveis */}
                  {diaristas.length > 0 && (
                    <div className="mt-6 pt-6 border-t">
                      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <Users className="h-5 w-5 text-blue-500" />
                        Diaristas Disponíveis ({diaristas.length})
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {diaristas.map((diarista) => (
                          <Card key={diarista.id} className="border-blue-200">
                            <CardContent className="p-3">
                              <div>
                                <h4 className="font-semibold text-sm mb-2">
                                  {diarista.nome_completo}
                                </h4>
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="text-muted-foreground">Telefone:</span>
                                    <span className="font-medium">{diarista.telefone}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="text-muted-foreground">Cidade:</span>
                                    <span className="font-medium">{diarista.cidade || "Não informada"}</span>
                                  </div>
                                </div>
                                <Badge variant="outline" className="text-xs bg-blue-50 mt-2">
                                  Diarista
                                </Badge>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Dialog open={assignModalOpen} onOpenChange={(isOpen) => (isOpen ? null : closeCadastroDiariaDialog())}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar diária para o dia selecionado</DialogTitle>
              <DialogDescription>
                Escolha um diarista disponível para assumir o dia vago informado. O sistema impede
                duplicidades na mesma data.
              </DialogDescription>
            </DialogHeader>
            {selectedDiaParaCadastro ? (
              <div className="space-y-4">
                <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground space-y-1">
                  <p>
                    <span className="font-medium text-foreground">Data:</span>{" "}
                    {format(parseDateFromDB(selectedDiaParaCadastro.data), "dd/MM/yyyy", {
                      locale: ptBR,
                    })}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Posto:</span>{" "}
                    {selectedDiaParaCadastro.posto.nome}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Unidade:</span>{" "}
                    {selectedDiaParaCadastro.posto.unidade?.nome || "Sem unidade"}
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Selecionar diarista</label>
                  <Select value={selectedDiaristaId} onValueChange={setSelectedDiaristaId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um diarista" />
                    </SelectTrigger>
                    <SelectContent>
                      {diaristas.length === 0 ? (
                        <SelectItem value="" disabled>
                          Nenhum diarista dispon\u00edvel
                        </SelectItem>
                      ) : (
                        diaristas.map((diarista) => (
                          <SelectItem key={diarista.id} value={diarista.id}>
                            {diarista.nome_completo}
                            {diarista.cidade ? ` - ${diarista.cidade}` : ""}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Selecione um dia vago para registrar a diária.</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeCadastroDiariaDialog}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleCadastrarDiaria}
                disabled={!selectedDiaParaCadastro || !selectedDiaristaId || savingDiaria}
              >
                {savingDiaria ? "Salvando..." : "Registrar di\u00e1ria"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog
          open={ocupacaoModalOpen}
          onOpenChange={(isOpen) => (isOpen ? null : closeAgendamentoOcupacaoDialog())}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agendar ocupação para o dia selecionado</DialogTitle>
              <DialogDescription>
                Escolha um colaborador de reserva para iniciar no posto na data escolhida.
              </DialogDescription>
            </DialogHeader>
            {selectedDiaParaOcupacao ? (
              <div className="space-y-4">
                <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground space-y-1">
                  <p>
                    <span className="font-medium text-foreground">Data:</span>{" "}
                    {format(parseDateFromDB(selectedDiaParaOcupacao.data), "dd/MM/yyyy", {
                      locale: ptBR,
                    })}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Posto:</span>{" "}
                    {selectedDiaParaOcupacao.posto.nome}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Unidade:</span>{" "}
                    {selectedDiaParaOcupacao.posto.unidade?.nome || "Sem unidade"}
                  </p>
                </div>
                {colaboradoresReserva.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum colaborador de reserva disponível no momento.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Selecionar colaborador</label>
                    <Select
                      value={selectedColaboradorReservaId}
                      onValueChange={setSelectedColaboradorReservaId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um colaborador" />
                      </SelectTrigger>
                      <SelectContent>
                        {colaboradoresReserva.map((colab) => (
                          <SelectItem key={colab.id} value={colab.id}>
                            {colab.nome_completo}
                            {colab.cargo ? ` - ${colab.cargo}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Selecione um dia vago para agendar a ocupação.
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeAgendamentoOcupacaoDialog}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleAgendarOcupacaoDia}
                disabled={
                  !selectedDiaParaOcupacao ||
                  !selectedColaboradorReservaId ||
                  savingOcupacao ||
                  colaboradoresReserva.length === 0
                }
              >
                {savingOcupacao ? "Agendando..." : "Agendar ocupação"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog
          open={agendarPostoModalOpen}
          onOpenChange={(isOpen) => (isOpen ? null : closeAgendamentoPostoDialog())}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agendar ocupação para o posto</DialogTitle>
              <DialogDescription>
                Escolha um colaborador de reserva e um dia disponível da agenda do posto.
              </DialogDescription>
            </DialogHeader>
            {selectedPostoParaAgendamento ? (
              <div className="space-y-4">
                <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground space-y-1">
                  <p>
                    <span className="font-medium text-foreground">Posto:</span>{" "}
                    {selectedPostoParaAgendamento.nome} ({selectedPostoParaAgendamento.codigo})
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Unidade:</span>{" "}
                    {selectedPostoParaAgendamento.unidade.nome}
                  </p>
                </div>
                {colaboradoresReserva.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum colaborador de reserva disponível no momento.
                  </p>
                ) : (
                  <>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Colaborador reserva</p>
                      <Select
                        value={selectedColaboradorPosto}
                        onValueChange={setSelectedColaboradorPosto}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o colaborador" />
                        </SelectTrigger>
                        <SelectContent>
                          {colaboradoresReserva.map((colab) => (
                            <SelectItem key={colab.id} value={colab.id}>
                              {colab.nome_completo}
                              {colab.cargo ? ` - ${colab.cargo}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Dia disponível</p>
                      <Select
                        value={selectedDataPosto}
                        onValueChange={setSelectedDataPosto}
                        disabled={datasDisponiveisPosto.length === 0}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              datasDisponiveisPosto.length === 0
                                ? "Nenhum dia disponível"
                                : "Selecione o dia"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent className="max-h-56 overflow-y-auto">
                          {datasDisponiveisPosto.map((data) => (
                            <SelectItem key={data} value={data}>
                              {format(parseDateFromDB(data), "dd/MM/yyyy", { locale: ptBR })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {datasDisponiveisPosto.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          Nenhum dia sem colaborador encontrado em dias_trabalho.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Selecione um posto vago para agendar a ocupação.
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeAgendamentoPostoDialog}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleAgendarOcupacaoPostoVago}
                disabled={
                  !selectedPostoParaAgendamento ||
                  !selectedColaboradorPosto ||
                  !selectedDataPosto ||
                  savingAgendamentoPosto ||
                  colaboradoresReserva.length === 0 ||
                  datasDisponiveisPosto.length === 0
                }
              >
                {savingAgendamentoPosto ? "Agendando..." : "Agendar ocupação"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog
          open={atribuirPostoModalOpen}
          onOpenChange={(isOpen) => (isOpen ? null : closeAtribuirPostoDialog())}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Atribuir posto ao colaborador</DialogTitle>
              <DialogDescription>
                Selecionar um colaborador de reserva para assumir imediatamente este posto de servi\u00e7o.
              </DialogDescription>
            </DialogHeader>
            {selectedPostoParaAtribuicao ? (
              <div className="space-y-4">
                <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground space-y-1">
                  <p>
                    <span className="font-medium text-foreground">Unidade:</span>{" "}
                    {selectedPostoParaAtribuicao.unidade.codigo} - {selectedPostoParaAtribuicao.unidade.nome}
                  </p>
                  {selectedPostoParaAtribuicao.unidade.contrato && (
                    <p>
                      <span className="font-medium text-foreground">Contrato:</span>{" "}
                      {selectedPostoParaAtribuicao.unidade.contrato.codigo} -{" "}
                      {selectedPostoParaAtribuicao.unidade.contrato.nome}
                    </p>
                  )}
                </div>
                {colaboradoresReserva.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum colaborador de reserva disponível.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Colaborador reserva</p>
                    <Select
                      value={selectedColaboradorParaAtribuicao}
                      onValueChange={setSelectedColaboradorParaAtribuicao}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o colaborador" />
                      </SelectTrigger>
                      <SelectContent>
                        {colaboradoresReserva.map((colab) => (
                          <SelectItem key={colab.id} value={colab.id}>
                            {colab.nome_completo}
                            {colab.cargo ? ` - ${colab.cargo}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Selecione um posto vago para atribuir.
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeAtribuirPostoDialog}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleAtribuirPosto}
                disabled={
                  !selectedPostoParaAtribuicao ||
                  !selectedColaboradorParaAtribuicao ||
                  savingAtribuirPosto ||
                  colaboradoresReserva.length === 0
                }
              >
                {savingAtribuirPosto ? "Atribuindo..." : "Confirmar atribuição"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
