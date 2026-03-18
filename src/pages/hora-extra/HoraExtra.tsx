import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Constants, type Database } from "@/integrations/supabase/types";
import { useSession } from "@/hooks/useSession";
import { useDiariasTemporariasData } from "@/pages/diarias/temporariasUtils";
import { formatDate } from "@/pages/diarias/utils";

type HoraExtraRow = Database["public"]["Tables"]["horas_extras"]["Row"];
type FaltaConveniaRow = Database["public"]["Tables"]["faltas_colaboradores_convenia"]["Row"];

const ACTIVE_HORA_EXTRA_STATUSES: HoraExtraRow["status"][] = [
  "pendente",
  "confirmada",
  "aprovada",
];

const toIsoOrNull = (value: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};
const formatEnumLabel = (value?: string | null) => {
  if (!value) return "-";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};
const confirmAction = (message: string) => {
  if (typeof window === "undefined") return true;
  return window.confirm(message);
};
const COBERTURA_COST_CENTER_ALL = "__all__";
const toTrimOrNull = (value: string | null | undefined) => {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed : null;
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

const HoraExtra = () => {
  const [formState, setFormState] = useState({
    faltaId: "",
    colaboradorCobrindoId: "",
    operacao: "",
    localFaltaId: "",
    dataHoraExtra: "",
    inicioEm: "",
    fimEm: "",
    intervaloInicioEm: "",
    intervaloFimEm: "",
    observacao: "",
  });
  const [coberturaCostCenterId, setCoberturaCostCenterId] = useState("");
  const [saving, setSaving] = useState(false);
  const { session, loading: sessionLoading } = useSession();

  const { colaboradoresConvenia, colaboradoresConveniaMap, costCenters } = useDiariasTemporariasData();

  const costCenterMap = useMemo(() => {
    const map = new Map<string, string>();
    costCenters.forEach((center: any) => {
      if (!center?.id) return;
      map.set(center.id, center.name || center.id);
    });
    return map;
  }, [costCenters]);
  const costCenterOptions = useMemo(
    () =>
      costCenters
        .filter((center: any) => center?.id)
        .map((center: any) => ({
          id: center.id,
          label: center.name || center.id,
        }))
        .sort((a: any, b: any) => a.label.localeCompare(b.label)),
    [costCenters],
  );

  const { data: horasExtrasAtivas = [] } = useQuery({
    queryKey: ["horas-extras-ativas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("horas_extras")
        .select("id, falta_id, status")
        .in("status", ACTIVE_HORA_EXTRA_STATUSES);
      if (error) throw error;
      return (data || []) as Pick<HoraExtraRow, "id" | "falta_id" | "status">[];
    },
  });

  const activeFaltaIds = useMemo(() => {
    const set = new Set<number>();
    horasExtrasAtivas.forEach((item) => {
      if (item?.falta_id) set.add(item.falta_id);
    });
    return set;
  }, [horasExtrasAtivas]);

  const { data: faltasSemDiaria = [], isLoading: loadingFaltas } = useQuery({
    queryKey: ["faltas-convenia-sem-diaria-para-hora-extra"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("faltas_colaboradores_convenia")
        .select(
          "id, colaborador_convenia_id, data_falta, diaria_temporaria_id, motivo, local_falta",
        )
        .is("diaria_temporaria_id", null)
        .order("data_falta", { ascending: false });
      if (error) throw error;
      return (data || []) as FaltaConveniaRow[];
    },
  });

  const faltasDisponiveis = useMemo(
    () => faltasSemDiaria.filter((falta) => !activeFaltaIds.has(falta.id)),
    [faltasSemDiaria, activeFaltaIds],
  );

  const faltaSelecionada = useMemo(
    () => faltasDisponiveis.find((falta) => String(falta.id) === formState.faltaId),
    [faltasDisponiveis, formState.faltaId],
  );

  const colaboradorAusente = faltaSelecionada
    ? colaboradoresConveniaMap.get(faltaSelecionada.colaborador_convenia_id)
    : null;
  const isCoberturaOperacao =
    formState.operacao === "cobertura_falta" ||
    formState.operacao === "cobertura_falta_atestado";

  useEffect(() => {
    if (isCoberturaOperacao) {
      setFormState((prev) => ({
        ...prev,
        dataHoraExtra: "",
        localFaltaId: "",
      }));
    } else {
      setFormState((prev) => ({
        ...prev,
        faltaId: "",
        localFaltaId: "",
      }));
    }
  }, [isCoberturaOperacao]);
  useEffect(() => {
    if (!isCoberturaOperacao) return;
    if (!faltaSelecionada) {
      setFormState((prev) => ({ ...prev, localFaltaId: "" }));
      return;
    }
    setFormState((prev) => ({
      ...prev,
      localFaltaId: faltaSelecionada.local_falta || "",
    }));
  }, [faltaSelecionada?.id, isCoberturaOperacao]);

  const colaboradoresCobertura = useMemo(() => {
    if (!coberturaCostCenterId) return colaboradoresConvenia;
    return colaboradoresConvenia.filter(
      (colaborador) =>
        colaborador.cost_center_id === coberturaCostCenterId,
    );
  }, [coberturaCostCenterId, colaboradoresConvenia]);
  const operacaoOptions = Constants.public.Enums.operacao_hora_extra || [];

  useEffect(() => {
    if (!formState.colaboradorCobrindoId) return;
    const stillAvailable = colaboradoresCobertura.some(
      (colaborador) => colaborador.id === formState.colaboradorCobrindoId,
    );
    if (!stillAvailable) {
      setFormState((prev) => ({ ...prev, colaboradorCobrindoId: "" }));
    }
  }, [colaboradoresCobertura, formState.colaboradorCobrindoId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formState.colaboradorCobrindoId) {
      toast.error("Selecione o colaborador que vai cobrir.");
      return;
    }
    if (!formState.operacao.trim()) {
      toast.error("Informe a operacao.");
      return;
    }
    if (isCoberturaOperacao) {
      if (!formState.faltaId) {
        toast.error("Selecione a falta a ser coberta.");
        return;
      }
      if (!faltaSelecionada?.local_falta) {
        toast.error("A falta selecionada nao possui local da falta definido.");
        return;
      }
    } else if (!formState.localFaltaId) {
      toast.error("Selecione o local da hora extra.");
      return;
    }
    const dataReferencia = isCoberturaOperacao
      ? faltaSelecionada?.data_falta
      : formState.dataHoraExtra;
    if (!dataReferencia) {
      toast.error(
        isCoberturaOperacao
          ? "Selecione a falta para definir a data."
          : "Selecione a data da hora extra.",
      );
      return;
    }
    if (!formState.inicioEm || !formState.fimEm) {
      toast.error("Informe inicio e fim.");
      return;
    }
    const inicioEm = toIsoOrNull(formState.inicioEm);
    const fimEm = toIsoOrNull(formState.fimEm);
    if (!inicioEm || !fimEm) {
      toast.error("Datas de inicio/fim invalidas.");
      return;
    }
    const intervaloInicioEm = toIsoOrNull(formState.intervaloInicioEm);
    const intervaloFimEm = toIsoOrNull(formState.intervaloFimEm);
    if ((intervaloInicioEm && !intervaloFimEm) || (!intervaloInicioEm && intervaloFimEm)) {
      toast.error("Preencha inicio e fim do intervalo.");
      return;
    }
    if (sessionLoading) return;
    if (!session?.user?.id) {
      toast.error("Sessao expirada. Faca login novamente.");
      return;
    }
    if (!confirmAction("Deseja cadastrar esta hora extra?")) {
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase.from("horas_extras").insert({
        falta_id: isCoberturaOperacao ? Number(formState.faltaId) : null,
        colaborador_cobrindo_id: formState.colaboradorCobrindoId,
        local_hora_extra: isCoberturaOperacao
          ? (faltaSelecionada?.local_falta || null)
          : formState.localFaltaId,
        data_hora_extra: dataReferencia,
        operacao: formState.operacao.trim(),
        inicio_em: inicioEm,
        fim_em: fimEm,
        intervalo_inicio_em: intervaloInicioEm,
        intervalo_fim_em: intervaloFimEm,
        observacao: formState.observacao.trim() || null,
        status: "pendente",
        criado_por: session.user.id,
      });
      if (error) throw error;
      toast.success("Hora extra registrada com sucesso.");
      setFormState({
        faltaId: "",
        colaboradorCobrindoId: "",
        operacao: "",
        localFaltaId: "",
        dataHoraExtra: "",
        inicioEm: "",
        fimEm: "",
        intervaloInicioEm: "",
        intervaloFimEm: "",
        observacao: "",
      });
      setCoberturaCostCenterId("");
    } catch (error: any) {
      toast.error(error?.message || "Nao foi possivel registrar a hora extra.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div>
          <p className="text-sm text-muted-foreground uppercase tracking-wide">Cobertura</p>
          <h1 className="text-3xl font-bold">Hora extra</h1>
          <p className="text-sm text-muted-foreground">
            Registre horas extras para cobrir ausencias sem diaria vinculada.
          </p>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Registrar hora extra</CardTitle>
            <CardDescription>Informe a falta, colaborador cobrindo e horarios.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
              <div className="space-y-2 md:col-span-2">
                <Label>Operacao</Label>
                <Select
                  value={formState.operacao}
                  onValueChange={(value) =>
                    setFormState((prev) => ({ ...prev, operacao: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a operacao" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72 overflow-y-auto">
                    {operacaoOptions.map((operacao) => (
                      <SelectItem key={operacao} value={operacao}>
                        {formatEnumLabel(operacao)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {isCoberturaOperacao && (
                <>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Falta a cobrir</Label>
                    <Select
                      value={formState.faltaId}
                      onValueChange={(value) =>
                        setFormState((prev) => ({ ...prev, faltaId: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            loadingFaltas
                              ? "Carregando faltas..."
                              : "Selecione a falta"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent className="max-h-72 overflow-y-auto">
                        {faltasDisponiveis.length === 0 && (
                          <SelectItem value="none" disabled>
                            Nenhuma falta disponivel
                          </SelectItem>
                        )}
                        {faltasDisponiveis.map((falta) => {
                          const colaborador = colaboradoresConveniaMap.get(
                            falta.colaborador_convenia_id,
                          );
                          const nomeColaborador = getConveniaColaboradorNome(colaborador);
                          const cpfLabel = toTrimOrNull(colaborador?.cpf) || "CPF VAZIO";
                          const localFaltaRaw = toTrimOrNull(falta.local_falta);
                          const localFaltaLabel = localFaltaRaw
                            ? costCenterMap.get(localFaltaRaw) || localFaltaRaw
                            : "LOCAL DE FALTA NAO INFORMADO";
                          const optionLabel = [
                            formatDate(falta.data_falta),
                            nomeColaborador,
                            cpfLabel,
                            localFaltaLabel,
                          ]
                            .filter(Boolean)
                            .join(" • ");
                          return (
                            <SelectItem key={falta.id} value={String(falta.id)}>
                              {optionLabel}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Colaborador ausente</Label>
                    <Input
                      value={
                        colaboradorAusente
                          ? getConveniaColaboradorNome(colaboradorAusente)
                          : "-"
                      }
                      readOnly
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Local da falta</Label>
                    <Select value={formState.localFaltaId} disabled>
                      <SelectTrigger>
                        <SelectValue placeholder="Local definido na falta" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72 overflow-y-auto">
                        {costCenterOptions.map((center) => (
                          <SelectItem key={center.id} value={center.id}>
                            {center.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!faltaSelecionada?.local_falta && (
                      <p className="text-xs text-muted-foreground">
                        A falta selecionada nao possui local da falta definido.
                      </p>
                    )}
                  </div>
                </>
              )}

              {!isCoberturaOperacao && (
                <>
                  <div className="space-y-2">
                    <Label>Data da hora extra</Label>
                    <Input
                      type="date"
                      value={formState.dataHoraExtra}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          dataHoraExtra: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Local da hora extra</Label>
                    <Select
                      value={formState.localFaltaId}
                      onValueChange={(value) =>
                        setFormState((prev) => ({
                          ...prev,
                          localFaltaId: value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o local" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72 overflow-y-auto">
                        {costCenterOptions.map((center) => (
                          <SelectItem key={center.id} value={center.id}>
                            {center.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <div className="space-y-2 md:col-span-2">
                <Label>Centro de custo do colaborador cobrindo</Label>
                <Select
                  value={coberturaCostCenterId || COBERTURA_COST_CENTER_ALL}
                  onValueChange={(value) =>
                    setCoberturaCostCenterId(
                      value === COBERTURA_COST_CENTER_ALL ? "" : value,
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o centro de custo (opcional)" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72 overflow-y-auto">
                    <SelectItem value={COBERTURA_COST_CENTER_ALL}>
                      Todos os centros de custo
                    </SelectItem>
                    {costCenterOptions.map((center) => (
                      <SelectItem key={center.id} value={center.id}>
                        {center.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Colaborador cobrindo</Label>
                <Select
                  value={formState.colaboradorCobrindoId}
                  onValueChange={(value) =>
                    setFormState((prev) => ({ ...prev, colaboradorCobrindoId: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o colaborador" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72 overflow-y-auto">
                    {colaboradoresCobertura.map((colaborador) => (
                      <SelectItem key={colaborador.id} value={colaborador.id}>
                        {getConveniaColaboradorNome(colaborador)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Inicio</Label>
                <Input
                  type="datetime-local"
                  value={formState.inicioEm}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, inicioEm: event.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Fim</Label>
                <Input
                  type="datetime-local"
                  value={formState.fimEm}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, fimEm: event.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Inicio intervalo (opcional)</Label>
                <Input
                  type="datetime-local"
                  value={formState.intervaloInicioEm}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      intervaloInicioEm: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Fim intervalo (opcional)</Label>
                <Input
                  type="datetime-local"
                  value={formState.intervaloFimEm}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      intervaloFimEm: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Observacao</Label>
                <Textarea
                  value={formState.observacao}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, observacao: event.target.value }))
                  }
                  placeholder="Opcional"
                />
              </div>

              <div className="md:col-span-2 flex justify-end">
                <Button type="submit" disabled={saving}>
                  {saving ? "Salvando..." : "Cadastrar hora extra"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default HoraExtra;
