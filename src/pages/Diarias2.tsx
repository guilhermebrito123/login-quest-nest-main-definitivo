import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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


  const initialFormState = {
    dataDiaria: "",
    horarioInicio: "",
    horarioFim: "",
    intervalo: "",
    colaboradorNome: "",
    postoServico: "",
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

    if (!formState.postoServico || !formState.valorDiaria || !formState.diaristaId || !formState.motivoVago) {
      toast.error("Preencha posto, diarista, valor e motivo.");
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
    if (isMotivoLicencaNojo && !formState.colaboradorNome) {
      toast.error("Informe o colaborador falecido.");
      return;
    }

    if (isMotivoVagaEmAberto) {
      if (formState.demissao === null) {
        toast.error("Informe se e demissao.");
        return;
      }
      if (formState.demissao === true && !formState.colaboradorDemitidoNome) {
        toast.error("Informe o colaborador demitido.");
        return;
      }
      if (formState.demissao === false && formState.licencaNojo === null) {
        toast.error("Informe se e licenca nojo.");
        return;
      }
      if (formState.demissao === false && formState.licencaNojo === true && !formState.colaboradorNome) {
        toast.error("Informe o colaborador falecido.");
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
    const postoServicoValue = toUpperOrNull(formState.postoServico);
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
        posto_servico_id: null,
        posto_servico: postoServicoValue,
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
          <Input
            type="month"
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
            className="w-auto"
          />
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
                <Label>Data da diaria</Label>
                <Input
                  type="date"
                  required
                  value={formState.dataDiaria}
                  onChange={(event) => setFormState((prev) => ({ ...prev, dataDiaria: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Horario de inicio</Label>
                <Input
                  type="time"
                  required
                  value={formState.horarioInicio}
                  onChange={(event) => setFormState((prev) => ({ ...prev, horarioInicio: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Horario de fim</Label>
                <Input
                  type="time"
                  required
                  value={formState.horarioFim}
                  onChange={(event) => setFormState((prev) => ({ ...prev, horarioFim: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Intervalo (minutos)</Label>
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
                <Label>Motivo</Label>
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
                  <Label>Colaborador ausente</Label>
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
                  <Label>Colaborador falecido</Label>
                  <Input
                    required
                    value={formState.colaboradorNome}
                    onChange={(event) => handleColaboradorNomeChange(event.target.value)}
                    placeholder="Nome do colaborador falecido"
                  />
                </div>
              )}

              {isMotivoVagaEmAberto && (
                <>
                  <div className="space-y-2">
                  <Label>E demissao?</Label>
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
                      <Label>E licenca nojo?</Label>
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
                      <Label>Colaborador falecido</Label>
                      <Input
                        required
                        value={formState.colaboradorNome}
                        onChange={(event) => handleColaboradorNomeChange(event.target.value)}
                        placeholder="Nome do colaborador falecido"
                      />
                    </div>
                  )}

                  {formState.demissao === true && (
                    <div className="space-y-2">
                      <Label>Colaborador demitido</Label>
                      <Input
                        required
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
                <Label>Posto de servico</Label>
                <Input
                  value={formState.postoServico}
                  onChange={(event) => setFormState((prev) => ({ ...prev, postoServico: event.target.value }))}
                  placeholder="Nome do posto"
                />
              </div>

              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select
                  required
                  value={formState.clienteId}
                  onValueChange={(value) => setFormState((prev) => ({ ...prev, clienteId: value }))}
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
                <Label>Valor da diaria</Label>
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
                <Label>Diarista responsavel</Label>
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
                <Label>Observacao</Label>
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
