import { useMemo, useState } from "react";
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
} from "./diarias/utils";
import { useDiariasTemporariasData } from "./diarias/temporariasUtils";

const MOTIVO_VAGO_VAGA_EM_ABERTO = "VAGA EM ABERTO (COBERTURA SALÁRIO)";
const MOTIVO_VAGO_LICENCA_NOJO_FALECIMENTO = "LICENÇA NOJO (FALECIMENTO)";

const MOTIVO_VAGO_OPTIONS = [
  MOTIVO_VAGO_VAGA_EM_ABERTO,
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
    colaboradorNome: "",
    postoServicoId: "",
    clienteId: "",
    valorDiaria: "",
  diaristaId: "",
  motivoVago: MOTIVO_VAGO_OPTIONS[0],
  demissao: null as boolean | null,
  licencaNojo: null as boolean | null,
  colaboradorDemitidoNome: "",
  observacao: "",
};

const Diarias2 = () => {
  const [selectedMonth, setSelectedMonth] = useState(currentMonthValue);
  const [formState, setFormState] = useState(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    diaristas,
    clientes,
    clienteMap,
    filteredDiarias,
    refetchDiarias,
    loadingDiarias,
    postoMap,
    diarias,
  } = useDiariasTemporariasData(selectedMonth);
  const postosOptions = Array.from(postoMap.values()).map((p: any) => ({
    id: p.id,
    nome: p.nome || "Sem nome",
    cliente_id: p.cliente_id,
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
    return null;
  };

  const isMotivoVagaEmAberto =
    formState.motivoVago.toUpperCase() === MOTIVO_VAGO_VAGA_EM_ABERTO.toUpperCase();
  const isMotivoLicencaNojo =
    formState.motivoVago.toUpperCase() === MOTIVO_VAGO_LICENCA_NOJO_FALECIMENTO.toUpperCase();
  const normalizedCancelada = normalizeStatus(STATUS.cancelada);
  const normalizedReprovada = normalizeStatus(STATUS.reprovada);
  const normalizedPaga = normalizeStatus(STATUS.paga);

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

  const handleColaboradorNomeChange = (value: string) => {
    setFormState((prev) => ({
      ...prev,
      colaboradorNome: value,
    }));
  };

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

    if (!formState.clienteId) {
      toast.error("Selecione o cliente.");
      return;
    }

    const clienteIdNumber = Number(formState.clienteId);
    if (!Number.isFinite(clienteIdNumber)) {
      toast.error("Cliente invalido.");
      return;
    }

    if (!isMotivoVagaEmAberto && !isMotivoLicencaNojo && !formState.colaboradorNome) {
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
      if (formState.demissao === false && formState.licencaNojo === null) {
        toast.error("Informe se e licenca nojo.");
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

    const colaboradorAusente = null;
    const colaboradorNomeUpper = toUpperOrNull(formState.colaboradorNome);
    const clienteIdValue = clienteIdNumber;
    const demissaoValue = isMotivoVagaEmAberto ? formState.demissao : null;
    const licencaNojoValue =
      isMotivoVagaEmAberto && demissaoValue === false ? formState.licencaNojo === true : false;
    const novoPostoValue =
      isMotivoVagaEmAberto && demissaoValue === false
        ? !(formState.licencaNojo === true)
        : isMotivoVagaEmAberto
          ? false
          : false;
    const colaboradorFalecido =
      (isMotivoLicencaNojo || (isMotivoVagaEmAberto && licencaNojoValue)) && colaboradorNomeUpper
        ? colaboradorNomeUpper
        : null;
    const colaboradorAusenteNome =
      isMotivoVagaEmAberto || isMotivoLicencaNojo ? null : colaboradorNomeUpper;
    const colaboradorDemitidoValue = null;
    const colaboradorDemitidoNomeValue =
      isMotivoVagaEmAberto && demissaoValue === true
        ? toUpperOrNull(formState.colaboradorDemitidoNome)
        : null;
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
        colaborador_ausente: colaboradorAusente,
        colaborador_ausente_nome: colaboradorAusenteNome,
        colaborador_falecido: colaboradorFalecido,
        posto_servico_id: formState.postoServicoId || null,
        posto_servico: null,
        cliente_id: clienteIdValue,
        valor_diaria: valorNumber,
        diarista_id: formState.diaristaId,
        motivo_vago: motivoVagoValue,
        demissao: demissaoValue,
        licenca_nojo: licencaNojoValue,
        novo_posto: novoPostoValue,
        colaborador_demitido: colaboradorDemitidoValue,
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
                  tooltip="Tempo total de intervalo em minutos. Deixe vazio se nao houver."
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
                <TooltipLabel label="Motivo" tooltip="Motivo da ausencia ou da vaga em aberto." />
                <Select
                  required
                  value={formState.motivoVago}
                  onValueChange={(value) => {
                    const isVagaAberto = value.toUpperCase() === MOTIVO_VAGO_VAGA_EM_ABERTO;
                    const isLicencaNojo =
                      value.toUpperCase() === MOTIVO_VAGO_LICENCA_NOJO_FALECIMENTO.toUpperCase();
                    setFormState((prev) => ({
                      ...prev,
                      motivoVago: value,
                      colaboradorNome: isVagaAberto || isLicencaNojo ? "" : prev.colaboradorNome,
                      demissao: null,
                      licencaNojo: null,
                      colaboradorDemitidoNome: "",
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

              {!isMotivoVagaEmAberto && !isMotivoLicencaNojo && (
                <div className="space-y-2">
                  <TooltipLabel
                    label="Colaborador ausente"
                    tooltip="Nome do colaborador que sera coberto pela diaria."
                  />
                  <Input
                    required
                    value={formState.colaboradorNome}
                    onChange={(event) => handleColaboradorNomeChange(event.target.value)}
                    placeholder="Nome do colaborador ausente"
                  />
                </div>
              )}

              {isMotivoLicencaNojo && (
                <div className="space-y-2">
                  <TooltipLabel
                    label="Colaborador falecido (opcional)"
                    tooltip="Informe o colaborador falecido, se quiser registrar."
                  />
                  <Input
                    value={formState.colaboradorNome}
                    onChange={(event) => handleColaboradorNomeChange(event.target.value)}
                    placeholder="Nome do colaborador falecido"
                  />
                </div>
              )}

              {isMotivoVagaEmAberto && (
                <>
                  <div className="space-y-2">
                    <TooltipLabel
                      label="E demissao?"
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
                          licencaNojo: value === "true" ? null : prev.licencaNojo,
                          colaboradorDemitidoNome: value === "true" ? prev.colaboradorDemitidoNome : "",
                          colaboradorNome:
                            value === "true" ? "" : prev.colaboradorNome,
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

                  {formState.demissao === false && (
                    <div className="space-y-2">
                      <TooltipLabel
                        label="E licenca nojo?"
                        tooltip="Marque se o afastamento e licenca nojo."
                      />
                      <Select
                        required
                        value={
                          formState.licencaNojo === null
                            ? ""
                            : formState.licencaNojo
                              ? "true"
                              : "false"
                        }
                        onValueChange={(value) =>
                          setFormState((prev) => ({
                            ...prev,
                            licencaNojo: value === "" ? null : value === "true",
                            colaboradorNome: value === "true" ? prev.colaboradorNome : "",
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
                  )}

                  {formState.demissao === false && formState.licencaNojo === true && (
                    <div className="space-y-2">
                      <TooltipLabel
                        label="Colaborador falecido (opcional)"
                        tooltip="Informe o colaborador falecido, se quiser registrar."
                      />
                      <Input
                        value={formState.colaboradorNome}
                        onChange={(event) => handleColaboradorNomeChange(event.target.value)}
                        placeholder="Nome do colaborador falecido"
                      />
                    </div>
                  )}

                  {formState.demissao === true && (
                    <div className="space-y-2">
                      <TooltipLabel
                        label="Colaborador demitido (opcional)"
                        tooltip="Use para registrar quem foi demitido (CASO NÃO SAIBA, NÃO PRECISA PREENCHER)."
                      />
                      <Input
                        value={formState.colaboradorDemitidoNome}
                        onChange={(event) =>
                          setFormState((prev) => ({
                            ...prev,
                            colaboradorDemitidoNome: event.target.value,
                          }))
                        }
                        placeholder="Nome do colaborador demitido"
                      />
                    </div>
                  )}
                </>
              )}

              <div className="space-y-2">
                <TooltipLabel label="Cliente" tooltip="Cliente associado a diaria." />
                <Select
                  required
                  value={formState.clienteId}
                  onValueChange={(value) =>
                    setFormState((prev) => ({
                      ...prev,
                      clienteId: value,
                      postoServicoId: "",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72 overflow-y-auto">
                    {clientes.map((cliente) => (
                      <SelectItem key={cliente.id} value={cliente.id.toString()}>
                        {cliente.nome_fantasia || cliente.razao_social || cliente.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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
                    setFormState((prev) => ({
                      ...prev,
                      postoServicoId: value,
                      clienteId: posto?.cliente_id ? posto.cliente_id.toString() : prev.clienteId,
                    }));
                  }}
                  disabled={!formState.clienteId}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        formState.clienteId ? "Selecione o posto" : "Escolha o cliente primeiro"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className="max-h-64 overflow-y-auto">
                    {postosOptions
                      .filter(
                        (posto) =>
                          !formState.clienteId ||
                          (posto.cliente_id && posto.cliente_id.toString() === formState.clienteId),
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
                    {diaristas.map((diarista) => (
                      <SelectItem key={diarista.id} value={diarista.id}>
                        {diarista.nome_completo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <TooltipLabel
                  label="Observacao"
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
