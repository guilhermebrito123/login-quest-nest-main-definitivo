import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  STATUS,
  currentMonthValue,
  normalizeStatus,
  currencyFormatter,
  formatDate,
} from "./diarias/utils";
import { useDiariasTemporariasData } from "./diarias/temporariasUtils";

const MOTIVO_VAGO_VAGA_EM_ABERTO = "VAGA EM ABERTO (COBERTURA SALÁRIO)";
const MOTIVO_VAGO_LICENCA_NOJO_FALECIMENTO = "LICENÇA NOJO (FALECIMENTO)";
const MOTIVO_VAGO_SERVICO_EXTRA = "SERVIÇO EXTRA";
const RESERVA_TECNICA_NAME = "RESERVA TÉCNICA";

const MOTIVO_VAGO_OPTIONS = [
  MOTIVO_VAGO_VAGA_EM_ABERTO,
  MOTIVO_VAGO_SERVICO_EXTRA,
  "FALTA INJUSTIFICADA",
  "LICENÇA MATERNIDADE",
  "LICENÇA PATERNIDADE",
  "LICENÇA CASAMENTO",
  MOTIVO_VAGO_LICENCA_NOJO_FALECIMENTO,
  "AFASTAMENTO INSS",
  "FÉRIAS",
  "SUSPENSÃO",
];
const toUpperOrNull = (value: string | null | undefined) => {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed.toUpperCase() : null;
};
const toTrimOrNull = (value: string | null | undefined) => {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed : null;
};
const stripNonDigits = (value?: string | null) => (value ?? "").replace(/\D/g, "");
const TEST_DIARISTA_NAMES = new Set(["guilherme guerra", "james bond", "cris ronaldo"]);
const TEST_DIARISTA_CPFS = new Set(["01999999999", "01999999998"]);
const isTestDiarista = (diarista: any) => {
  const name = (diarista?.nome_completo || "").trim().toLowerCase();
  const cpfDigits = stripNonDigits(diarista?.cpf);
  return TEST_DIARISTA_NAMES.has(name) || TEST_DIARISTA_CPFS.has(cpfDigits);
};
const getConveniaColaboradorNome = (colaborador?: {
  name?: string | null;
  last_name?: string | null;
  social_name?: string | null;
  id?: string;
} | null) => {
  if (!colaborador) return "-";
  const base = (colaborador.social_name || colaborador.name || "").trim();
  const last = (colaborador.last_name || "").trim();
  const full = [base, last].filter(Boolean).join(" ").trim();
  return full || colaborador.name || colaborador.id || "-";
};

const TooltipLabel = ({
  label,
  tooltip,
  htmlFor,
}: { label: string; tooltip: string; htmlFor?: string }) => (
  <div className="flex items-center gap-2">
    <Label className="cursor-default" htmlFor={htmlFor}>
      {label}
    </Label>
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="h-6 w-6 rounded-full border border-amber-400 bg-amber-50 text-[11px] font-bold text-amber-900 shadow-sm hover:bg-amber-100"
          aria-label={`Ajuda: ${label}`}
        >
          i
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-[260px] bg-amber-50 text-amber-900 shadow-md">
        <span className="font-semibold">Ajuda: </span>
        <span>{tooltip}</span>
      </TooltipContent>
    </Tooltip>
  </div>
);
const initialFormState = {
  dataDiaria: "",
  horarioInicio: "",
  horarioFim: "",
  intervalo: "",
  colaboradorAusenteId: "",
  postoServicoId: "",
  unidade: "",
  centroCustoId: "",
  valorDiaria: "",
  diaristaId: "",
  motivoVago: MOTIVO_VAGO_OPTIONS[0],
  demissao: null as boolean | null,
  colaboradorDemitidoId: "",
  observacao: "",
};

type FaltaResumo = {
  id: number;
  colaborador_id: string;
  diaria_temporaria_id: number;
  created_at: string;
  motivo?: string | null;
};

const Diarias2 = () => {
  const [selectedMonth, setSelectedMonth] = useState(currentMonthValue);
  const [formState, setFormState] = useState(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const {
    diaristas,
    clienteMap,
    colaboradoresMap,
    colaboradoresConvenia,
    colaboradoresConveniaMap,
    costCenters,
    filteredDiarias,
    refetchDiarias,
    loadingDiarias,
    postoMap,
    diarias,
  } = useDiariasTemporariasData(selectedMonth);
  const diariaMap = useMemo(() => {
    const map = new Map<string, any>();
    diarias.forEach((diaria) => {
      map.set(String(diaria.id), diaria);
    });
    return map;
  }, [diarias]);
  const { data: blacklist = [] } = useQuery({
    queryKey: ["blacklist"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blacklist")
        .select("diarista_id, motivo");
      if (error) throw error;
      return data || [];
    },
  });
  const { data: faltasResumo } = useQuery({
    queryKey: ["faltas-pendentes-resumo"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("colaborador_faltas")
        .select("id", { count: "exact", head: true })
        .is("justificada_em", null);
      if (error) throw error;

      const { data, error: listError } = await supabase
        .from("colaborador_faltas")
        .select("id, colaborador_id, diaria_temporaria_id, created_at, motivo")
        .is("justificada_em", null)
        .order("created_at", { ascending: false })
        .limit(5);
      if (listError) throw listError;

      return { count: count || 0, recent: (data || []) as FaltaResumo[] };
    },
  });
  const blacklistMap = useMemo(() => {
    const map = new Map<string, { motivo?: string | null }>();
    (blacklist || []).forEach((item: any) => {
      if (item?.diarista_id) {
        map.set(item.diarista_id, { motivo: item.motivo ?? null });
      }
    });
    return map;
  }, [blacklist]);
  const postosOptions = Array.from(postoMap.values()).map((p: any) => ({
    id: p.id,
    nome: p.nome || "Sem nome",
    cliente_id: p.cliente_id,
    cost_center_id: p.cost_center_id,
  }));
  const getClienteInfoFromPosto = (postoInfo: any) => {
    const contrato = postoInfo?.unidade?.contrato;
    if (contrato?.cliente_id || contrato?.clientes?.nome_fantasia || contrato?.clientes?.razao_social) {
      return {
        id: contrato.cliente_id ?? "",
        nome:
          contrato.clientes?.nome_fantasia ||
          contrato.clientes?.razao_social ||
          "Cliente nao informado",
      };
    }
    if (postoInfo?.cliente_id !== null && postoInfo?.cliente_id !== undefined) {
      const clienteId = Number(postoInfo.cliente_id);
      const nome = Number.isFinite(clienteId) ? clienteMap.get(clienteId) : null;
      return {
        id: postoInfo.cliente_id ?? "",
        nome: nome || "Cliente nao informado",
      };
    }
    return null;
  };

  const motivoVagoUpper = formState.motivoVago.toUpperCase();
  const isMotivoVagaEmAberto =
    motivoVagoUpper === MOTIVO_VAGO_VAGA_EM_ABERTO.toUpperCase();
  const isMotivoSemColaborador =
    isMotivoVagaEmAberto || motivoVagoUpper === MOTIVO_VAGO_SERVICO_EXTRA;
  const normalizedCancelada = normalizeStatus(STATUS.cancelada);
  const normalizedReprovada = normalizeStatus(STATUS.reprovada);
  const normalizedPaga = normalizeStatus(STATUS.paga);

  const reservaTecnicaCostCenterId = useMemo(() => {
    const target = costCenters.find(
      (center) =>
        (center.name || "").trim().toUpperCase() === RESERVA_TECNICA_NAME,
    );
    return target?.id || "";
  }, [costCenters]);

  const colaboradoresConveniaByCentroCusto = useMemo(() => {
    const base = colaboradoresConvenia.filter((colaborador) => colaborador?.id);
    if (!formState.centroCustoId) return base;
    return base.filter(
      (colaborador) =>
        colaborador.cost_center_id === formState.centroCustoId ||
        (reservaTecnicaCostCenterId &&
          colaborador.cost_center_id === reservaTecnicaCostCenterId),
    );
  }, [colaboradoresConvenia, formState.centroCustoId, reservaTecnicaCostCenterId]);

  const { clienteReceberTotals, clienteRecebidosTotals } = useMemo(() => {
    const receber = new Map<string, { nome: string; total: number }>();
    const recebidos = new Map<string, { nome: string; total: number }>();

    filteredDiarias.forEach((diaria) => {
      const statusNorm = normalizeStatus(diaria.status);
      const postoInfo =
        diaria.posto || (diaria.posto_servico_id ? postoMap.get(diaria.posto_servico_id) : null);
      const clienteInfo = getClienteInfoFromPosto(postoInfo);
      const clienteNome =
        (typeof diaria.cliente_id === "number" && clienteMap.get(diaria.cliente_id)) ||
        clienteInfo?.nome ||
        "";
      if (!clienteNome) return;

      const valor =
        typeof diaria.valor_diaria === "number"
          ? diaria.valor_diaria
          : Number(diaria.valor_diaria) || 0;

      const key =
        (typeof diaria.cliente_id === "number" && diaria.cliente_id.toString()) ||
        clienteInfo?.id?.toString() ||
        clienteNome;

      if (statusNorm === normalizedPaga) {
        const current = recebidos.get(key);
        recebidos.set(key, { nome: clienteNome, total: (current?.total || 0) + valor });
        return;
      }
      if (statusNorm === normalizedCancelada || statusNorm === normalizedReprovada) return;

      const current = receber.get(key);
      receber.set(key, { nome: clienteNome, total: (current?.total || 0) + valor });
    });

    return {
      clienteReceberTotals: Array.from(receber.values()).sort((a, b) => a.nome.localeCompare(b.nome)),
      clienteRecebidosTotals: Array.from(recebidos.values()).sort((a, b) => a.nome.localeCompare(b.nome)),
    };
  }, [filteredDiarias, normalizedCancelada, normalizedPaga, normalizedReprovada, postoMap, clienteMap]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formState.dataDiaria || !formState.horarioInicio || !formState.horarioFim) {
      toast.error("Preencha data e horarios da diaria.");
      return;
    }

    if (!formState.valorDiaria || !formState.diaristaId || !formState.motivoVago) {
      toast.error("Preencha diarista, valor e motivo.");
      return;
    }
    const blacklistEntry = blacklistMap.get(formState.diaristaId);
    if (blacklistEntry) {
      const motivo = blacklistEntry.motivo ? `: ${blacklistEntry.motivo}` : "";
      toast.error(`Diarista esta na blacklist${motivo}`);
      return;
    }

    if (!formState.centroCustoId) {
      toast.error("Selecione o centro de custo.");
      return;
    }

    if (!isMotivoSemColaborador && !toTrimOrNull(formState.colaboradorAusenteId)) {
      toast.error("Informe o colaborador ausente.");
      return;
    }

    if (!formState.postoServicoId) {
      toast.error("Selecione o posto de servico.");
      return;
    }

    if (isMotivoVagaEmAberto) {
      if (formState.demissao === null) {
        toast.error("Informe se e demissao.");
        return;
      }
      if (
        formState.demissao === true &&
        !toTrimOrNull(formState.colaboradorDemitidoId)
      ) {
        toast.error("Informe o colaborador demitido.");
        return;
      }
    }

    const valorNumber = Number(formState.valorDiaria);
    if (Number.isNaN(valorNumber) || valorNumber <= 0) {
      toast.error("Informe um valor valido para a diaria.");
      return;
    }

    const intervaloNumber = formState.intervalo === "" ? null : Number(formState.intervalo);
    if (intervaloNumber !== null && (Number.isNaN(intervaloNumber) || intervaloNumber < 0)) {
      toast.error("Informe um intervalo valido (minutos).");
      return;
    }

    const postoInfo = formState.postoServicoId ? postoMap.get(formState.postoServicoId) : null;
    const clienteInfoFromPosto = getClienteInfoFromPosto(postoInfo);
    const clienteIdValue = clienteInfoFromPosto?.id ?? "";
    const clienteIdNumber = Number(clienteIdValue);
    if (!Number.isFinite(clienteIdNumber)) {
      toast.error("Cliente invalido.");
      return;
    }
    const unidadeValue =
      toUpperOrNull(formState.unidade) || toUpperOrNull(postoInfo?.unidade?.nome);
    if (!unidadeValue) {
      toast.error("Informe a unidade.");
      return;
    }
    const centroCustoIdValue = formState.centroCustoId || null;
    const demissaoValue = isMotivoVagaEmAberto ? formState.demissao : null;
    const novoPostoValue = isMotivoVagaEmAberto
      ? demissaoValue
        ? false
        : true
      : null;
    const colaboradorAusenteId = !isMotivoSemColaborador
      ? toTrimOrNull(formState.colaboradorAusenteId)
      : null;
    const colaboradorDemitidoId =
      isMotivoVagaEmAberto && demissaoValue === true
        ? toTrimOrNull(formState.colaboradorDemitidoId)
        : null;
    const colaboradorAusenteInfo = colaboradorAusenteId
      ? colaboradoresConveniaMap.get(colaboradorAusenteId)
      : null;
    const colaboradorDemitidoInfo = colaboradorDemitidoId
      ? colaboradoresConveniaMap.get(colaboradorDemitidoId)
      : null;
    const colaboradorAusenteNome = toUpperOrNull(
      getConveniaColaboradorNome(colaboradorAusenteInfo),
    );
    const colaboradorDemitidoNomeValue = toUpperOrNull(
      getConveniaColaboradorNome(colaboradorDemitidoInfo),
    );
    const observacaoValue = toUpperOrNull(formState.observacao);
    const motivoVagoValue = (formState.motivoVago || "").toUpperCase();

    const diaristaOcupado = diarias.some(
      (diaria) =>
        diaria.diarista_id === formState.diaristaId && diaria.data_diaria === formState.dataDiaria,
    );
    if (diaristaOcupado) {
      toast.error("O diarista escolhido ja tem diarias cadastradas para essa data");
      return;
    }

    try {
      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const userId = userData?.user?.id;
      if (!userId) {
        toast.error("Nao foi possivel identificar o usuario logado.");
        return;
      }
      setIsSubmitting(true);
      const { error } = await supabase.from("diarias_temporarias").insert({
        data_diaria: formState.dataDiaria,
        horario_inicio: formState.horarioInicio,
        horario_fim: formState.horarioFim,
        intervalo: intervaloNumber,
        colaborador_ausente: null,
        colaborador_ausente_convenia: colaboradorAusenteId,
        colaborador_ausente_nome: colaboradorAusenteNome,
        posto_servico_id: formState.postoServicoId || null,
        unidade: unidadeValue,
        cliente_id: clienteIdNumber,
        centro_custo_id: centroCustoIdValue,
        valor_diaria: valorNumber,
        diarista_id: formState.diaristaId,
        motivo_vago: motivoVagoValue,
        demissao: demissaoValue,
        novo_posto: novoPostoValue,
        colaborador_demitido: null,
        colaborador_demitido_convenia: colaboradorDemitidoId,
        colaborador_demitido_nome: colaboradorDemitidoNomeValue,
        observacao: observacaoValue,
        criado_por: userId,
      });
      if (error) throw error;

      toast.success("Diaria registrada com sucesso.");
      setFormState(initialFormState);
      await refetchDiarias();
    } catch (error: any) {
      toast.error(error.message || "Nao foi possivel registrar a diaria.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-muted-foreground uppercase tracking-wide">Gestao de diarias</p>
            <h1 className="text-3xl font-bold">Diarias (versão 1.0.0)</h1>
            <p className="text-sm text-muted-foreground">
              Registre diarias em casos de ausencia utilizando colaboradores alocados.
            </p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Input
                aria-label="Filtro de mes"
                type="month"
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(event.target.value)}
                className="w-auto"
              />
            </TooltipTrigger>
            <TooltipContent>Selecione o mes para filtrar as diarias exibidas.</TooltipContent>
          </Tooltip>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Registrar diaria</CardTitle>
            <CardDescription>
              Informe a data, o colaborador ausente, o posto e o diarista responsavel. O status inicial sera aguardando confirmacao.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <TooltipLabel label="Data da diaria" tooltip="Dia em que a diaria sera realizada." />
                <Input
                  type="date"
                  required
                  value={formState.dataDiaria}
                  onChange={(event) => setFormState((prev) => ({ ...prev, dataDiaria: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <TooltipLabel
                  label="Horario de inicio"
                  tooltip="Horario em que o diarista deve iniciar a diaria."
                />
                <Input
                  type="time"
                  required
                  value={formState.horarioInicio}
                  onChange={(event) => setFormState((prev) => ({ ...prev, horarioInicio: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <TooltipLabel label="Horario de fim" tooltip="Horario previsto para encerrar a diaria." />
                <Input
                  type="time"
                  required
                  value={formState.horarioFim}
                  onChange={(event) => setFormState((prev) => ({ ...prev, horarioFim: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <TooltipLabel
                  label="Intervalo (minutos) - opcional"
                  tooltip="Tempo total de intervalo em minutos. Deixe vazio caso não tenha essa informação."
                />
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={formState.intervalo}
                  onChange={(event) => setFormState((prev) => ({ ...prev, intervalo: event.target.value }))}
                  placeholder="Em minutos"
                />
              </div>

              <div className="space-y-2">
                <TooltipLabel label="Centro de custo" tooltip="Centro de custo associado a diaria." />
                <Select
                  required
                  value={formState.centroCustoId}
                  onValueChange={(value) =>
                    setFormState((prev) => ({
                      ...prev,
                      centroCustoId: value,
                      postoServicoId: "",
                      colaboradorAusenteId: "",
                      colaboradorDemitidoId: "",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o centro de custo" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72 overflow-y-auto">
                    {costCenters.map((centro) => (
                      <SelectItem key={centro.id} value={centro.id}>
                        {centro.name || centro.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <TooltipLabel label="Motivo" tooltip="Motivo que levou a necessidade da diária." />
                <Select
                  required
                  value={formState.motivoVago}
                  onValueChange={(value) => {
                    const upperValue = value.toUpperCase();
                    const isSemColaborador =
                      upperValue === MOTIVO_VAGO_VAGA_EM_ABERTO.toUpperCase() ||
                      upperValue === MOTIVO_VAGO_SERVICO_EXTRA;
                    setFormState((prev) => ({
                      ...prev,
                      motivoVago: value,
                      colaboradorAusenteId: isSemColaborador
                        ? ""
                        : prev.colaboradorAusenteId,
                      demissao: null,
                      colaboradorDemitidoId: "",
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o motivo" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64 overflow-y-auto">
                    {MOTIVO_VAGO_OPTIONS.map((motivo) => (
                      <SelectItem key={motivo} value={motivo}>
                        {motivo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!isMotivoSemColaborador && (
                <div className="space-y-2">
                  <TooltipLabel
                    label="Colaborador ausente"
                    tooltip="Colaborador que sera coberto pela diaria."
                  />
                  <Select
                    required
                    value={formState.colaboradorAusenteId}
                    onValueChange={(value) =>
                      setFormState((prev) => ({ ...prev, colaboradorAusenteId: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o colaborador" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72 overflow-y-auto">
                      {colaboradoresConveniaByCentroCusto.length === 0 && (
                        <SelectItem value="none" disabled>
                          Nenhum colaborador encontrado
                        </SelectItem>
                      )}
                      {colaboradoresConveniaByCentroCusto.map((colaborador) => (
                        <SelectItem key={colaborador.id} value={colaborador.id}>
                          {getConveniaColaboradorNome(colaborador)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {isMotivoVagaEmAberto && (
                <>
                  <div className="space-y-2">
                    <TooltipLabel
                      label="É demissao?"
                      tooltip="Indique se a vaga em aberto ocorreu por demissao."
                    />
                    <Select
                      required
                      value={
                        formState.demissao === null ? "" : formState.demissao ? "true" : "false"
                      }
                      onValueChange={(value) =>
                        setFormState((prev) => ({
                          ...prev,
                          demissao: value === "" ? null : value === "true",
                          colaboradorDemitidoId: value === "true" ? prev.colaboradorDemitidoId : "",
                          colaboradorAusenteId: "",
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma opcao" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Sim</SelectItem>
                        <SelectItem value="false">Nao</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>



                  {formState.demissao === true && (
                    <div className="space-y-2">
                      <TooltipLabel
                        label="Colaborador demitido"
                        tooltip="Obrigatorio quando for demissao."
                      />
                      <Select
                        required
                        value={formState.colaboradorDemitidoId}
                        onValueChange={(value) =>
                          setFormState((prev) => ({
                            ...prev,
                            colaboradorDemitidoId: value,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o colaborador" />
                        </SelectTrigger>
                        <SelectContent className="max-h-72 overflow-y-auto">
                          {colaboradoresConveniaByCentroCusto.length === 0 && (
                            <SelectItem value="none" disabled>
                              Nenhum colaborador encontrado
                            </SelectItem>
                          )}
                          {colaboradoresConveniaByCentroCusto.map((colaborador) => (
                            <SelectItem key={colaborador.id} value={colaborador.id}>
                              {getConveniaColaboradorNome(colaborador)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              )}

              <div className="space-y-2">
                <TooltipLabel
                  label="Posto de servico"
                  tooltip="Posto onde o diarista vai atuar nesta diaria."
                />
                <Select
                  required
                  value={formState.postoServicoId}
                  onValueChange={(value) => {
                    const posto = postosOptions.find((p) => p.id === value);
                    const postoInfo = value ? postoMap.get(value) : null;
                    const unidadeFromPosto = postoInfo?.unidade?.nome || "";
                    setFormState((prev) => {
                      const nextCentroCustoId = posto?.cost_center_id
                        ? posto.cost_center_id.toString()
                        : prev.centroCustoId;
                      const shouldResetColaboradores = nextCentroCustoId !== prev.centroCustoId;
                      return {
                        ...prev,
                        postoServicoId: value,
                        centroCustoId: nextCentroCustoId,
                        unidade: toTrimOrNull(prev.unidade) ? prev.unidade : unidadeFromPosto,
                        colaboradorAusenteId: shouldResetColaboradores
                          ? ""
                          : prev.colaboradorAusenteId,
                        colaboradorDemitidoId: shouldResetColaboradores
                          ? ""
                          : prev.colaboradorDemitidoId,
                      };
                    });
                  }}
                  disabled={!formState.centroCustoId}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        formState.centroCustoId
                          ? "Selecione o posto"
                          : "Escolha o centro de custo primeiro"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className="max-h-64 overflow-y-auto">
                    {postosOptions
                      .filter(
                        (posto) =>
                          !formState.centroCustoId ||
                          (posto.cost_center_id &&
                            posto.cost_center_id.toString() === formState.centroCustoId),
                      )
                      .map((posto) => (
                        <SelectItem key={posto.id} value={posto.id}>
                          {posto.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <TooltipLabel
                  label="Unidade"
                  tooltip="Informe a unidade em que a diaria sera realizada."
                />
                <Input
                  required
                  value={formState.unidade}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, unidade: event.target.value }))
                  }
                  placeholder="Nome da unidade"
                />
              </div>

              <div className="space-y-2">
                <TooltipLabel label="Valor da diaria" tooltip="Valor combinado para a diaria." />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={formState.valorDiaria}
                  onChange={(event) => setFormState((prev) => ({ ...prev, valorDiaria: event.target.value }))}
                  placeholder="0,00"
                />
              </div>

              <div className="space-y-2">
                <TooltipLabel
                  label="Diarista responsavel"
                  tooltip="Diarista que executara a diaria."
                />
                <Select
                  required
                  value={formState.diaristaId}
                  onValueChange={(value) => setFormState((prev) => ({ ...prev, diaristaId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o diarista" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72 overflow-y-auto">
                    {diaristas.length === 0 && (
                      <SelectItem value="none" disabled>
                        Nenhum diarista encontrado
                      </SelectItem>
                    )}
                    {diaristas.map((diarista) => {
                      const isBlacklisted = blacklistMap.has(diarista.id);
                      const isRestrito = diarista.status === "restrito";
                      const isTest = isTestDiarista(diarista);
                      const statusLabels = [
                        isBlacklisted ? "Blacklist" : null,
                        isRestrito ? "Restrito" : null,
                      ].filter(Boolean);
                      const statusSuffix =
                        statusLabels.length > 0 ? ` (${statusLabels.join(" / ")})` : "";
                      const cpfLabel = diarista.cpf ? ` - ${diarista.cpf}` : " - CPF nao informado";
                      const reservaLabel = diarista.reserva_tecnica ? " - Reserva técnica" : "";
                      return (
                        <SelectItem
                          key={diarista.id}
                          value={diarista.id}
                          disabled={isBlacklisted || isRestrito}
                          className={
                            isTest
                              ? "bg-yellow-200 text-yellow-900 data-[highlighted]:bg-yellow-300 data-[highlighted]:text-yellow-900"
                              : ""
                          }
                        >
                          {diarista.nome_completo}
                          {cpfLabel}
                          {reservaLabel}
                          {statusSuffix}
                          {isTest && (
                            <span className="ml-2 rounded-full bg-yellow-300 px-2 py-0.5 text-[10px] font-semibold text-yellow-900">
                              Diarista teste (nao compoe a base real de diaristas)
                            </span>
                          )}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <TooltipLabel
                  label="Observacao (opcional)"
                  tooltip="Observacoes adicionais ou instrucoes relevantes."
                />
                <Textarea
                  value={formState.observacao}
                  onChange={(event) => setFormState((prev) => ({ ...prev, observacao: event.target.value }))}
                  placeholder="Opcional"
                />
              </div>

              <div className="md:col-span-2 flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Registrando..." : "Cadastrar diaria"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-lg border border-amber-200">
          <CardHeader>
            <CardTitle>Faltas pendentes</CardTitle>
            <CardDescription>
              {faltasResumo?.count
                ? `${faltasResumo.count} falta(s) aguardando justificativa.`
                : "Nenhuma falta pendente no momento."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {faltasResumo?.recent?.length ? (
              <div className="space-y-2 text-sm">
                {faltasResumo.recent.map((falta) => {
                  const diariaInfo = diariaMap.get(String(falta.diaria_temporaria_id));
                  const colaboradorInfo = colaboradoresMap.get(falta.colaborador_id);
                  return (
                    <div
                      key={falta.id}
                      className="flex flex-col gap-1 rounded-md border border-amber-100 bg-amber-50 px-3 py-2 md:flex-row md:items-center md:justify-between"
                    >
                      <span className="font-medium">
                        {colaboradorInfo?.nome_completo || falta.colaborador_id}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(diariaInfo?.data_diaria)} • Diaria #{falta.diaria_temporaria_id}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Sem faltas pendentes para exibir.
              </p>
            )}
            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={() => navigate("/faltas")}>
                Abrir modulo de faltas
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-2">Total a receber por cliente</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {clienteReceberTotals.length === 0 ? (
                <Card className="shadow-lg border border-red-300 bg-red-300">
                  <CardContent className="py-6">
                    <p className="text-sm text-muted-foreground">
                      Nenhum cliente com diarias a receber no periodo selecionado.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                clienteReceberTotals.map((cliente) => (
                  <Card key={cliente.nome} className="shadow-lg border border-red-300 bg-red-300">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center justify-between">
                        <span>{cliente.nome}</span>
                        <span className="text-sm font-normal text-muted-foreground">
                          {currencyFormatter.format(cliente.total)}
                        </span>
                      </CardTitle>
                      <CardDescription>
                        Soma de diarias nao pagas, nao canceladas e nao reprovadas.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      Somatorio das diarias do cliente no mes filtrado.
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">Valores recebidos (pagas)</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {clienteRecebidosTotals.length === 0 ? (
                <Card className="shadow-lg border border-green-300 bg-green-500">
                  <CardContent className="py-6">
                    <p className="text-sm text-muted-foreground">Nenhum pagamento encontrado no periodo.</p>
                  </CardContent>
                </Card>
              ) : (
                clienteRecebidosTotals.map((cliente) => (
                  <Card key={cliente.nome} className="shadow-lg border border-green-300 bg-green-300">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center justify-between">
                        <span>{cliente.nome}</span>
                        <span className="text-sm font-normal text-muted-foreground">
                          {currencyFormatter.format(cliente.total)}
                        </span>
                      </CardTitle>
                      <CardDescription>Total de diarias com status paga.</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      Somatorio das diarias pagas do cliente no mes filtrado.
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>

        {loadingDiarias && (
          <p className="text-center text-sm text-muted-foreground">Carregando diarias temporarias...</p>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Diarias2;
