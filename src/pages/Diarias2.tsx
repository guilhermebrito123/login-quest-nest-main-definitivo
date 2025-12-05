import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

const MOTIVO_VAGO_OPTIONS = [
  "falta injustificada",
];

const initialFormState = {
  dataDiaria: "",
  horarioInicio: "",
  horarioFim: "",
  intervalo: "",
  colaboradorId: "",
  postoServicoId: "",
  valorDiaria: "",
  diaristaId: "",
  motivoVago: "falta injustificada",
};

const Diarias2 = () => {
  const [selectedMonth, setSelectedMonth] = useState(currentMonthValue);
  const [formState, setFormState] = useState(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    colaboradores,
    diaristas,
    filteredDiarias,
    refetchDiarias,
    loadingDiarias,
    postoMap,
  } = useDiariasTemporariasData(selectedMonth);

  const postoOptions = useMemo(() => {
    const map = new Map<string, string>();
    colaboradores.forEach((colaborador) => {
      if (colaborador.posto_servico_id && colaborador.posto?.nome) {
        const unidade = colaborador.posto.unidade?.nome ? ` - ${colaborador.posto.unidade.nome}` : "";
        map.set(colaborador.posto_servico_id, `${colaborador.posto.nome}${unidade}`);
      }
    });
    return Array.from(map.entries()).map(([id, descricao]) => ({ id, descricao }));
  }, [colaboradores]);

  const getClienteInfoFromPosto = (postoInfo: any) => {
    const contrato = postoInfo?.unidade?.contrato;
    if (contrato?.cliente_id || contrato?.clientes?.razao_social) {
      return {
        id: contrato.cliente_id ?? "",
        nome: contrato.clientes?.razao_social || "Cliente não informado",
      };
    }
    return null;
  };

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
      if (!clienteInfo) return;

      const valor =
        typeof diaria.valor_diaria === "number"
          ? diaria.valor_diaria
          : Number(diaria.valor_diaria) || 0;

      const key = clienteInfo.id || clienteInfo.nome;

      if (statusNorm === normalizedPaga) {
        const current = recebidos.get(key);
        recebidos.set(key, { nome: clienteInfo.nome, total: (current?.total || 0) + valor });
        return;
      }
      if (statusNorm === normalizedCancelada || statusNorm === normalizedReprovada) return;

      const current = receber.get(key);
      receber.set(key, { nome: clienteInfo.nome, total: (current?.total || 0) + valor });
    });

    return {
      clienteReceberTotals: Array.from(receber.values()).sort((a, b) => a.nome.localeCompare(b.nome)),
      clienteRecebidosTotals: Array.from(recebidos.values()).sort((a, b) => a.nome.localeCompare(b.nome)),
    };
  }, [filteredDiarias, normalizedCancelada, normalizedPaga, normalizedReprovada, postoMap]);

  const handleColaboradorChange = (value: string) => {
    setFormState((prev) => ({
      ...prev,
      colaboradorId: value,
      postoServicoId: "",
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !formState.dataDiaria ||
      !formState.horarioInicio ||
      !formState.horarioFim ||
      !formState.colaboradorId ||
      !formState.postoServicoId ||
      !formState.valorDiaria ||
      !formState.diaristaId ||
      !formState.motivoVago
    ) {
      toast.error("Preencha todos os campos para registrar a diaria.");
      return;
    }

    const valorNumber = Number(formState.valorDiaria);
    if (Number.isNaN(valorNumber) || valorNumber <= 0) {
      toast.error("Informe um valor valido para a diaria.");
      return;
    }

    const intervaloNumber =
      formState.intervalo === "" ? null : Number(formState.intervalo);
    if (intervaloNumber !== null && (Number.isNaN(intervaloNumber) || intervaloNumber < 0)) {
      toast.error("Informe um intervalo valido (minutos).");
      return;
    }

    try {
      setIsSubmitting(true);
      const { error } = await supabase.from("diarias_temporarias").insert({
        data_diaria: formState.dataDiaria,
        horario_inicio: formState.horarioInicio,
        horario_fim: formState.horarioFim,
        intervalo: intervaloNumber,
        colaborador_ausente: formState.colaboradorId,
        posto_servico_id: formState.postoServicoId,
        valor_diaria: valorNumber,
        diarista_id: formState.diaristaId,
        motivo_vago: formState.motivoVago,
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
                  value={formState.dataDiaria}
                  onChange={(event) => setFormState((prev) => ({ ...prev, dataDiaria: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Horario de inicio</Label>
                <Input
                  type="time"
                  value={formState.horarioInicio}
                  onChange={(event) => setFormState((prev) => ({ ...prev, horarioInicio: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Horario de fim</Label>
                <Input
                  type="time"
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
                  placeholder="Opcional"
                />
              </div>

              <div className="space-y-2">
                <Label>Motivo</Label>
                <Select
                  value={formState.motivoVago}
                  onValueChange={(value) => setFormState((prev) => ({ ...prev, motivoVago: value }))}
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

              <div className="space-y-2">
                <Label>Colaborador ausente</Label>
                <Select value={formState.colaboradorId} onValueChange={handleColaboradorChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o colaborador" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72 overflow-y-auto">
                    {colaboradores.length === 0 && (
                      <SelectItem value="none" disabled>
                        Nenhum colaborador alocado encontrado
                      </SelectItem>
                    )}
                    {colaboradores.map((colaborador) => (
                      <SelectItem key={colaborador.id} value={colaborador.id}>
                        {colaborador.nome_completo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Posto de servico</Label>
                <Select
                  value={formState.postoServicoId}
                  onValueChange={(value) => setFormState((prev) => ({ ...prev, postoServicoId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o posto de servico" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72 overflow-y-auto">
                    {postoOptions.length === 0 ? (
                      <SelectItem value="none" disabled>
                        Nenhum posto encontrado
                      </SelectItem>
                    ) : (
                      postoOptions.map((posto) => (
                        <SelectItem key={posto.id} value={posto.id}>
                          {posto.descricao}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Valor da diaria</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formState.valorDiaria}
                  onChange={(event) => setFormState((prev) => ({ ...prev, valorDiaria: event.target.value }))}
                  placeholder="0,00"
                />
              </div>

              <div className="space-y-2">
                <Label>Diarista responsavel</Label>
                <Select
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
