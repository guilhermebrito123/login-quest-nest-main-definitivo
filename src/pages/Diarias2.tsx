import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
  STATUS_LABELS,
  currentMonthValue,
  normalizeStatus,
} from "./diarias/utils";
import { useDiariasTemporariasData } from "./diarias/temporariasUtils";

const STATUS_ROUTES_TEMP: Record<string, string> = {
  [STATUS.aguardando]: "/diarias2/aguardando",
  [STATUS.confirmada]: "/diarias2/confirmadas",
  [STATUS.aprovada]: "/diarias2/aprovadas",
  [STATUS.lancada]: "/diarias2/lancadas",
  [STATUS.aprovadaPagamento]: "/diarias2/aprovadas-pagamento",
  [STATUS.reprovada]: "/diarias2/reprovadas",
  [STATUS.cancelada]: "/diarias2/canceladas",
};

const STATUS_ORDER = [
  STATUS.aguardando,
  STATUS.confirmada,
  STATUS.aprovada,
  STATUS.lancada,
  STATUS.aprovadaPagamento,
  STATUS.reprovada,
  STATUS.cancelada,
];

const MOTIVO_VAGO_OPTIONS = [
  "falta justificada",
  "falta injustificada",
  "afastamento INSS",
  "férias",
  "suspensão",
  "Posto vago",
];

const initialFormState = {
  dataDiaria: "",
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
  } = useDiariasTemporariasData(selectedMonth);

  const statusCounts = useMemo(() => {
    return filteredDiarias.reduce<Record<string, number>>((acc, diaria) => {
      const key = normalizeStatus(diaria.status);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [filteredDiarias]);

  const selectedColaborador = useMemo(
    () => colaboradores.find((colaborador) => colaborador.id === formState.colaboradorId),
    [colaboradores, formState.colaboradorId],
  );

  const handleColaboradorChange = (value: string) => {
    const colaboradorSelecionado = colaboradores.find((item) => item.id === value);
    setFormState((prev) => ({
      ...prev,
      colaboradorId: value,
      postoServicoId: colaboradorSelecionado?.posto_servico_id ?? "",
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !formState.dataDiaria ||
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

    try {
      setIsSubmitting(true);
      const { error } = await supabase.from("diarias_temporarias").insert({
        data_diaria: formState.dataDiaria,
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

  const postoDescricao =
    selectedColaborador?.posto?.nome
      ? `${selectedColaborador.posto.nome}${
          selectedColaborador.posto.unidade?.nome ? ` - ${selectedColaborador.posto.unidade?.nome}` : ""
        }`
      : "";

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
                        {colaborador.posto?.nome ? ` - ${colaborador.posto.nome}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Posto de servico</Label>
                <Input value={postoDescricao} readOnly placeholder="Selecione um colaborador para carregar o posto" />
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

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {STATUS_ORDER.map((statusKey) => {
            const normalizedKey = normalizeStatus(statusKey);
            return (
              <Card key={statusKey} className="shadow-lg">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>{STATUS_LABELS[statusKey]}</span>
                    <span className="text-sm font-normal text-muted-foreground">
                      {statusCounts[normalizedKey] || 0} diaria(s)
                    </span>
                  </CardTitle>
                  <CardDescription>Acesse a lista completa deste status.</CardDescription>
                </CardHeader>
                <CardContent className="flex justify-between items-end">
                  <div className="text-sm text-muted-foreground">
                    {statusKey === STATUS.aguardando && "Confirme as diarias registradas recentemente."}
                    {statusKey === STATUS.confirmada && "Avance diarias confirmadas para aprovacao."}
                    {statusKey === STATUS.aprovada && "Prepare diarias aprovadas para lancamento."}
                    {statusKey === STATUS.lancada && "Controle as diarias lancadas para pagamento."}
                    {statusKey === STATUS.aprovadaPagamento && "Acompanhe diarias aprovadas para pagamento."}
                    {statusKey === STATUS.reprovada && "Historico de diarias reprovadas."}
                    {statusKey === STATUS.cancelada && "Historico de diarias canceladas."}
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link to={STATUS_ROUTES_TEMP[statusKey]}>Ver detalhes</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {loadingDiarias && (
          <p className="text-center text-sm text-muted-foreground">Carregando diarias temporarias...</p>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Diarias2;
