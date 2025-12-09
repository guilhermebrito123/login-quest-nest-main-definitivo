import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  STATUS,
  currentMonthValue,
  formatDate,
  useDiariasData,
  normalizeStatus,
  currencyFormatter,
} from "./diarias/utils";
import { agendarOcupacaoPosto } from "@/lib/ocupacao";

export default function Diarias() {
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(currentMonthValue);
  const [formState, setFormState] = useState({
    postoDiaVagoId: "",
    diaristaId: "",
    valor: "",
  });
  const [ocupacaoForm, setOcupacaoForm] = useState({
    diaVagoId: "",
    colaboradorId: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ocupacaoLoading, setOcupacaoLoading] = useState(false);
  const [colaboradoresReserva, setColaboradoresReserva] = useState<
    { id: string; nome_completo: string; cargo: string | null }[]
  >([]);

  const {
    availableDiasVagos,
    diaristas,
    filteredDiarias,
    refetchDiarias,
    refetchDiasVagos,
    loadingDiarias,
    postoDiaVagoMap,
  } = useDiariasData(selectedMonth);

  const diaristasParaExibicao = useMemo(() => {
    const ativos = diaristas.filter((d) =>
      d.status ? d.status.toLowerCase() === "ativo" : true
    );
    return ativos.length > 0 ? ativos : diaristas;
  }, [diaristas]);

  const normalizedCancelada = normalizeStatus(STATUS.cancelada);
  const normalizedReprovada = normalizeStatus(STATUS.reprovada);
  const normalizedPaga = normalizeStatus(STATUS.paga);

  const { clienteReceberTotals, clienteRecebidosTotals } = useMemo(() => {
    const receber = new Map<string, { nome: string; total: number }>();
    const recebidos = new Map<string, { nome: string; total: number }>();

    filteredDiarias.forEach((diaria) => {
      const statusNorm = normalizeStatus(diaria.status);
      const diaInfo =
        postoDiaVagoMap.get(diaria.posto_dia_vago_id) ?? diaria.posto_dia_vago ?? null;
      const contrato = diaInfo?.posto?.unidade?.contrato;
      const clienteId = contrato?.cliente_id ?? "";
      const clienteNome =
        contrato?.clientes?.nome_fantasia ||
        contrato?.clientes?.razao_social ||
        "Cliente não informado";
      const key = clienteId || clienteNome;
      const valor =
        typeof diaria.valor === "number" ? diaria.valor : Number(diaria.valor) || 0;

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
  }, [filteredDiarias, normalizedCancelada, normalizedPaga, normalizedReprovada, postoDiaVagoMap]);
  const handleDiaVagoSelect = (value: string) => {
    const selecionado = availableDiasVagos.find((dia) => dia.id === value);
    const novoValor = selecionado?.posto?.valor_diaria;
    setFormState((prev) => ({
      ...prev,
      postoDiaVagoId: value,
      valor:
        novoValor !== null && novoValor !== undefined
          ? novoValor.toString()
          : "",
    }));
  };

  const loadReservasTecnicas = async () => {
    const { data, error } = await supabase
      .from("colaboradores")
      .select("id, nome_completo, cargo")
      .is("posto_servico_id", null)
      .or("status_colaborador.eq.ativo,status.eq.ativo")
      .order("nome_completo");

    if (error) {
      toast.error("Erro ao carregar colaboradores de reserva.");
      return;
    }

    setColaboradoresReserva(data || []);
  };

  useEffect(() => {
    loadReservasTecnicas();
  }, []);

  const handleCreateDiaria = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formState.postoDiaVagoId || !formState.diaristaId || !formState.valor) {
      toast.error("Selecione o dia vago e diarista.");
      return;
    }

    setIsSubmitting(true);
    try {
      const valorNumber = Number(formState.valor);
      if (Number.isNaN(valorNumber) || valorNumber <= 0) {
        toast.error("Valor da diária inválido.");
        setIsSubmitting(false);
        return;
      }

      const diaSelecionado = postoDiaVagoMap.get(formState.postoDiaVagoId);
      const dataNova = diaSelecionado?.data;

      if (dataNova) {
        const diaristaJaPossuiMesmaData = filteredDiarias.some((diaria) => {
          if (diaria.diarista_id !== formState.diaristaId) return false;
          const diaExistente = postoDiaVagoMap.get(diaria.posto_dia_vago_id);
          return diaExistente?.data === dataNova;
        });

        if (diaristaJaPossuiMesmaData) {
          toast.error("O diarista já possui uma diária cadastrada para esta data.");
          setIsSubmitting(false);
          return;
        }
      }

      const { error } = await supabase.from("diarias").insert({
        posto_dia_vago_id: formState.postoDiaVagoId,
        diarista_id: formState.diaristaId,
        valor: valorNumber,
      });

      if (error) throw error;

      toast.success("Diária registrada com sucesso.");
      setFormState({ postoDiaVagoId: "", diaristaId: "", valor: "" });
      await Promise.all([refetchDiarias(), refetchDiasVagos()]);
    } catch (error: any) {
      const message = typeof error?.message === "string" ? error.message : "";
      if (message.includes("O diarista já possui uma diária cadastrada para esta data")) {
        toast.error("O diarista já possui uma diária cadastrada para esta data.");
      } else {
        toast.error(message || "Erro ao registrar diária.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAgendarOcupacao = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ocupacaoForm.diaVagoId || !ocupacaoForm.colaboradorId) {
      toast.error("Selecione o dia vago e o colaborador.");
      return;
    }

    const diaSelecionado = availableDiasVagos.find(
      (dia) => dia.id === ocupacaoForm.diaVagoId
    );

    if (!diaSelecionado) {
      toast.error("Dia vago inválido ou indisponível.");
      return;
    }

    setOcupacaoLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      await agendarOcupacaoPosto({
        postoId: diaSelecionado.posto_servico_id,
        colaboradorId: ocupacaoForm.colaboradorId,
        data: diaSelecionado.data,
        usuarioId: user.id,
      });

      toast.success("Ocupação agendada com sucesso.");
      setOcupacaoForm({ diaVagoId: "", colaboradorId: "" });
      await Promise.all([refetchDiasVagos(), refetchDiarias()]);
      await loadReservasTecnicas();
      await queryClient.invalidateQueries({ queryKey: ["colaboradores"] });
    } catch (error: any) {
      toast.error(error.message || "Erro ao agendar ocupação.");
    } finally {
      setOcupacaoLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-muted-foreground uppercase tracking-wide">
              Gestão de diárias
            </p>
            <h1 className="text-3xl font-bold">Diárias e pagamento</h1>
            <p className="text-sm text-muted-foreground">
              Cadastre novas diárias e acesse rapidamente cada etapa do fluxo pelo menu lateral.
            </p>
            <p className="text-sm font-semibold text-destructive bg-destructive/10 border border-destructive/40 rounded-md px-3 py-2 inline-block">
              Somente diarias canceladas podem ser deletadas. Filtre pelo mês do dia vago para cadastrar diária {"(botão de filtro no topo da página)"}
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
            <CardTitle>Registrar diária</CardTitle>
            <CardDescription>
              Selecione um dia vago e vincule um diarista. O status inicial será
              "Aguardando confirmação".
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-3" onSubmit={handleCreateDiaria}>
              <div className="space-y-2 md:col-span-2">
                <Label>Dia vago</Label>
                <Select
                  value={formState.postoDiaVagoId}
                  onValueChange={handleDiaVagoSelect}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o dia vago" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72 overflow-y-auto">
                    {availableDiasVagos.length === 0 ? (
                      <SelectItem value="none" disabled>
                        Nenhum dia vago disponível no período
                      </SelectItem>
                    ) : (
                      availableDiasVagos.map((dia) => {
                        const clienteNome =
                          dia.posto?.unidade?.contrato?.clientes?.nome_fantasia ||
                          dia.posto?.unidade?.contrato?.clientes?.razao_social ||
                          "Cliente não informado";
                        const contratoDescricao =
                          dia.posto?.unidade?.contrato?.negocio || "Sem contrato";

                        return (
                          <SelectItem key={dia.id} value={dia.id}>
                            {formatDate(dia.data)} - {dia.posto?.nome || "Sem posto"} |{" "}
                            {dia.posto?.unidade?.nome || "Sem unidade"} | {contratoDescricao} | {clienteNome}
                            {dia.motivo ? ` - Motivo: ${dia.motivo}` : ""}
                          </SelectItem>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Diarista</Label>
                <Select
                  value={formState.diaristaId}
                  onValueChange={(value) => setFormState((prev) => ({ ...prev, diaristaId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o diarista" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72 overflow-y-auto">
                    {diaristasParaExibicao.length === 0 ? (
                      <SelectItem value="none" disabled>
                        Nenhum diarista cadastrado
                      </SelectItem>
                    ) : (
                      diaristasParaExibicao.map((diarista) => (
                        <SelectItem key={diarista.id} value={diarista.id}>
                          {diarista.nome_completo}
                          {diarista.status && diarista.status.toLowerCase() !== "ativo"
                            ? ` (${diarista.status})`
                            : ""}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Valor</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  value={formState.valor}
                  readOnly
                />
                <p className="text-xs text-muted-foreground">
                  Valor definido automaticamente conforme o posto selecionado.
                </p>
              </div>

              <div className="md:col-span-3 flex justify-end">
                <Button
                  type="submit"
                  disabled={isSubmitting || availableDiasVagos.length === 0}
                >
                  {isSubmitting ? "Registrando..." : "Cadastrar di\u00e1ria"}
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
                <Card className="shadow-lg border border-red-300 bg-red-200">
                  <CardContent className="py-6">
                    <p className="text-sm text-muted-foreground">
                      Nenhum cliente com diárias a receber no período selecionado.
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
                        Soma de diárias não pagas, não canceladas e não reprovadas.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      Somatório das diárias do cliente no mês filtrado.
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
                    <p className="text-sm text-muted-foreground">Nenhum pagamento encontrado no período.</p>
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
                      <CardDescription>Total de diárias com status paga.</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      Somatório das diárias pagas do cliente no mês filtrado.
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>

        {loadingDiarias && (
          <p className="text-center text-sm text-muted-foreground">
            Carregando diárias cadastradas...
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}


