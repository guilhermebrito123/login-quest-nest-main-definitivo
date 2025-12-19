import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface PostoFormProps {
  postoId?: string;
  unidadeId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

const DIAS_SEMANA = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda-feira" },
  { value: 2, label: "Terça-feira" },
  { value: 3, label: "Quarta-feira" },
  { value: 4, label: "Quinta-feira" },
  { value: 5, label: "Sexta-feira" },
  { value: 6, label: "Sábado" },
];
const TURNO_OPTIONS = ["Diurno", "Noturno", "Vespertino", "Revezamento", "Ininterrupto"] as const;
const POSTO_STATUS_OPTIONS = [
  { value: "vago", label: "Vago" },
  { value: "ocupado", label: "Ocupado" },
  { value: "vago_temporariamente", label: "Vago temporariamente" },
  { value: "ocupado_temporariamente", label: "Ocupado temporariamente" },
  { value: "presenca_confirmada", label: "Presenca confirmada" },
  { value: "inativo", label: "Inativo (encerrado)" },
] as const;
const ESCALAS_COM_DIAS_OBRIGATORIOS = new Set(["5x2", "6x1"]);

type PostoStatus = (typeof POSTO_STATUS_OPTIONS)[number]["value"];
type TurnoOption = (typeof TURNO_OPTIONS)[number];

interface PostoFormState {
  unidade_id: string;
  nome: string;
  funcao: string;
  efetivo_planejado: string;
  adc_insalubridade_percentual: string;
  acumulo_funcao_percentual: string;
  valor_diaria: string;
  valor_unitario: string;
  adicional_noturno: boolean | null;
  salario: string;
  intrajornada: boolean | null;
  insalubridade: boolean | null;
  periculosidade: boolean | null;
  acumulo_funcao: boolean | null;
  gratificacao: boolean | null;
  vt_dia: string;
  vr_dia: string;
  assistencia_medica: boolean | null;
  cesta: boolean | null;
  premio_assiduidade: boolean | null;
  turno: TurnoOption | "";
  escala: string;
  dias_semana: number[];
  jornada: string;
  horario_inicio: string;
  horario_fim: string;
  intervalo_refeicao: string;
  status: PostoStatus;
  observacoes_especificas: string;
  outros_beneficios: string[];
  primeiro_dia_atividade: string;
  ultimo_dia_atividade: string;
}

const resolvePostoStatus = (value?: string | null): PostoStatus =>
  POSTO_STATUS_OPTIONS.find((option) => option.value === value)?.value ??
  POSTO_STATUS_OPTIONS[0].value;

const PostoForm = ({ postoId, unidadeId, onClose, onSuccess }: PostoFormProps) => {
  type BooleanFieldKey =
    | "adicional_noturno"
    | "intrajornada"
    | "insalubridade"
    | "periculosidade"
    | "acumulo_funcao"
    | "gratificacao"
    | "assistencia_medica"
    | "cesta"
    | "premio_assiduidade";

  const [loading, setLoading] = useState(false);
  const [unidades, setUnidades] = useState<any[]>([]);
  const initialState: PostoFormState = {
    unidade_id: unidadeId || "",
    nome: "",
    funcao: "",
    efetivo_planejado: "1",
    adc_insalubridade_percentual: "",
    acumulo_funcao_percentual: "",
    valor_diaria: "",
    valor_unitario: "",
    adicional_noturno: null,
    salario: "",
    intrajornada: null,
    insalubridade: null,
    periculosidade: null,
    acumulo_funcao: null,
    gratificacao: null,
    vt_dia: "",
    vr_dia: "",
    assistencia_medica: null,
    cesta: null,
    premio_assiduidade: null,
    turno: "",
    escala: "",
    dias_semana: [] as number[],
    jornada: "",
    horario_inicio: "",
    horario_fim: "",
    intervalo_refeicao: "",
    status: POSTO_STATUS_OPTIONS[0].value,
    observacoes_especificas: "",
    outros_beneficios: [],
    primeiro_dia_atividade: "",
    ultimo_dia_atividade: "",
  };

  const [formData, setFormData] = useState<PostoFormState>(initialState);

  useEffect(() => {
    loadUnidades();
  }, []);

  useEffect(() => {
    setFormData((prev) => {
      if (!ESCALAS_COM_DIAS_OBRIGATORIOS.has(prev.escala) && prev.dias_semana.length > 0) {
        return { ...prev, dias_semana: [] };
      }
      return prev;
    });
  }, [formData.escala]);

  useEffect(() => {
    if (!postoId) {
      setFormData({ ...initialState, unidade_id: unidadeId || "" });
      return;
    }

    const loadPosto = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("postos_servico")
        .select(
          "unidade_id, nome, funcao, efetivo_planejado, adc_insalubridade_percentual, acumulo_funcao_percentual, valor_diaria, valor_unitario, adicional_noturno, salario, intrajornada, insalubridade, periculosidade, acumulo_funcao, gratificacao, vt_dia, vr_dia, assistencia_medica, cesta, premio_assiduidade, turno, escala, dias_semana, jornada, horario_inicio, horario_fim, intervalo_refeicao, status, observacoes_especificas, outros_beneficios, primeiro_dia_atividade, ultimo_dia_atividade"
        )
        .eq("id", postoId)
        .single();

      if (error) {
        toast({
          title: "Erro",
          description: "Não foi possível carregar os dados do posto",
          variant: "destructive",
        });
      } else if (data) {
        setFormData({
          unidade_id: data.unidade_id ?? "",
          nome: data.nome ?? "",
          funcao: data.funcao ?? "",
          efetivo_planejado: data.efetivo_planejado?.toString() ?? "1",
          adc_insalubridade_percentual: data.adc_insalubridade_percentual?.toString() ?? "",
          acumulo_funcao_percentual: data.acumulo_funcao_percentual?.toString() ?? "",
          valor_diaria: data.valor_diaria?.toString() ?? "",
          valor_unitario: data.valor_unitario?.toString() ?? "",
          adicional_noturno: data.adicional_noturno ?? null,
          salario: data.salario?.toString() ?? "",
          intrajornada: data.intrajornada ?? null,
          insalubridade: data.insalubridade ?? null,
          periculosidade: data.periculosidade ?? null,
          acumulo_funcao: data.acumulo_funcao ?? null,
          gratificacao: data.gratificacao ?? null,
          vt_dia: data.vt_dia?.toString() ?? "",
          vr_dia: data.vr_dia?.toString() ?? "",
          assistencia_medica: data.assistencia_medica ?? null,
          cesta: data.cesta ?? null,
          premio_assiduidade: data.premio_assiduidade ?? null,
          turno: (data.turno as TurnoOption | null) ?? "",
          escala: data.escala ?? "",
          dias_semana: Array.isArray(data.dias_semana)
            ? data.dias_semana.map((dia: any) => Number(dia))
            : [],
          jornada: data.jornada?.toString() ?? "",
          horario_inicio: data.horario_inicio ?? "",
          horario_fim: data.horario_fim ?? "",
          intervalo_refeicao: data.intervalo_refeicao?.toString() ?? "",
          status: resolvePostoStatus(data.status),
          observacoes_especificas: data.observacoes_especificas ?? "",
          outros_beneficios: Array.isArray(data.outros_beneficios)
            ? data.outros_beneficios.filter((beneficio: string) => typeof beneficio === "string")
            : [],
          primeiro_dia_atividade: data.primeiro_dia_atividade ?? "",
          ultimo_dia_atividade: data.ultimo_dia_atividade ?? "",
        });
      }
      setLoading(false);
    };

    loadPosto();
  }, [postoId, unidadeId]);

  const loadUnidades = async () => {
    const { data } = await supabase
      .from("unidades")
      .select("id, nome")
      .order("nome");
    setUnidades(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const {
        unidade_id,
        nome,
        funcao,
        efetivo_planejado,
        adc_insalubridade_percentual,
        acumulo_funcao_percentual,
        valor_diaria,
        valor_unitario,
        adicional_noturno,
        salario,
        intrajornada,
        insalubridade,
        periculosidade,
        acumulo_funcao,
        gratificacao,
        vt_dia,
        vr_dia,
        assistencia_medica,
        cesta,
        premio_assiduidade,
        turno,
        escala,
        dias_semana,
        jornada,
        horario_inicio,
        horario_fim,
        intervalo_refeicao,
        status,
        observacoes_especificas,
        outros_beneficios,
        primeiro_dia_atividade,
        ultimo_dia_atividade,
      } = formData;

      if (ESCALAS_COM_DIAS_OBRIGATORIOS.has(escala) && dias_semana.length === 0) {
        toast({
          title: "Dias obrigatorios",
          description: "Selecione ao menos um dia da semana para as escalas 5x2 ou 6x1.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const beneficiosArray = outros_beneficios
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

      const dataToSave = {
        unidade_id,
        nome,
        funcao,
        efetivo_planejado: efetivo_planejado ? parseInt(efetivo_planejado) || 1 : 1,
        adc_insalubridade_percentual: adc_insalubridade_percentual
          ? parseFloat(adc_insalubridade_percentual)
          : null,
        acumulo_funcao_percentual: acumulo_funcao_percentual
          ? parseFloat(acumulo_funcao_percentual)
          : null,
        valor_diaria: valor_diaria ? parseFloat(valor_diaria) : 0,
        valor_unitario: valor_unitario ? parseFloat(valor_unitario) : null,
        adicional_noturno: adicional_noturno ?? false,
        salario: salario ? parseFloat(salario) : null,
        intrajornada: intrajornada ?? false,
        insalubridade: insalubridade ?? false,
        periculosidade: periculosidade ?? false,
        acumulo_funcao: acumulo_funcao ?? false,
        gratificacao: gratificacao ?? false,
        vt_dia: vt_dia ? parseFloat(vt_dia) : null,
        vr_dia: vr_dia ? parseFloat(vr_dia) : null,
        assistencia_medica: assistencia_medica ?? false,
        cesta: cesta ?? false,
        premio_assiduidade: premio_assiduidade ?? false,
        turno: turno ? turno : null,
        escala,
        dias_semana: dias_semana.length ? dias_semana : null,
        jornada: jornada ? parseInt(jornada) : null,
        horario_inicio,
        horario_fim,
        intervalo_refeicao: intervalo_refeicao ? parseInt(intervalo_refeicao) : null,
        status,
        observacoes_especificas: observacoes_especificas || null,
        outros_beneficios: beneficiosArray.length ? beneficiosArray : null,
        primeiro_dia_atividade: primeiro_dia_atividade || null,
        ultimo_dia_atividade: ultimo_dia_atividade || null,
      };

      if (postoId) {
        const { error } = await supabase
          .from("postos_servico")
          .update(dataToSave)
          .eq("id", postoId);

        if (error) throw error;

        toast({
          title: "Posto atualizado",
          description: "Posto atualizado com sucesso",
        });
      } else {
        const { error } = await supabase.from("postos_servico").insert([dataToSave]);

        if (error) throw error;

        toast({
          title: "Posto criado",
          description: "Posto criado com sucesso",
        });
      }

      onSuccess();
    } catch (error: any) {
      const message: string =
        typeof error?.message === "string"
          ? error.message
          : "NÃ£o foi possível salvar o posto. Tente novamente.";

      // Mensagem especí­fica que aparecia antes da correÃ§Ã£o do trigger no banco.
      const friendlyMessage = message.includes("ON CONFLICT DO UPDATE not supported")
        ? "O posto foi salvo, mas houve uma tentativa duplicada de sincronizar dias vagos. Recarregue a página ou tente novamente."
        : message;

      toast({
        title: "Erro",
        description: friendlyMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const escalaRequerDiasSemana = ESCALAS_COM_DIAS_OBRIGATORIOS.has(formData.escala);

  const handleBooleanChange = (key: BooleanFieldKey, value: boolean) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const renderBooleanField = (key: BooleanFieldKey, label: string) => (
    <div className="space-y-2">
      <Label>{label} *</Label>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name={key}
            value="true"
            checked={formData[key] === true}
            onChange={() => handleBooleanChange(key, true)}
            required
          />
          <span>Sim</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name={key}
            value="false"
            checked={formData[key] === false}
            onChange={() => handleBooleanChange(key, false)}
            required
          />
          <span>Nao</span>
        </label>
      </div>
    </div>
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{postoId ? "Editar Posto" : "Novo Posto"}</DialogTitle>
          <DialogDescription>Preencha os dados do posto de serviço</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="unidade_id">Unidade *</Label>
              <Select
                value={formData.unidade_id}
                onValueChange={(value) => setFormData({ ...formData, unidade_id: value })}
                disabled={!!unidadeId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {unidades.map((unidade) => (
                    <SelectItem key={unidade.id} value={unidade.id}>
                      {unidade.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="funcao">Funcao</Label>
              <Input
                id="funcao"
                value={formData.funcao}
                onChange={(e) => setFormData({ ...formData, funcao: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="efetivo_planejado">Efetivo planejado *</Label>
              <Input
                id="efetivo_planejado"
                type="number"
                min={1}
                value={formData.efetivo_planejado}
                onChange={(e) => setFormData({ ...formData, efetivo_planejado: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="escala">Escala</Label>
              <Select
                value={formData.escala}
                onValueChange={(value) => setFormData({ ...formData, escala: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a escala" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5x1">5x1</SelectItem>
                  <SelectItem value="5x2">5x2</SelectItem>
                  <SelectItem value="4x2">4x2</SelectItem>
                  <SelectItem value="6x1">6x1</SelectItem>
                  <SelectItem value="12x36">12x36</SelectItem>
                  <SelectItem value="18x36">18x36</SelectItem>
                  <SelectItem value="24x48">24x48</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="turno">Turno</Label>
              <Select
                value={formData.turno || undefined}
                onValueChange={(value) =>
                  setFormData({ ...formData, turno: value as TurnoOption })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o turno" />
                </SelectTrigger>
                <SelectContent>
                  {TURNO_OPTIONS.map((turno) => (
                    <SelectItem key={turno} value={turno}>
                      {turno}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {escalaRequerDiasSemana && (
              <div className="space-y-2 sm:col-span-2">
                <Label>Dias da semana</Label>
                <p className="text-xs text-muted-foreground">
                  Para as escalas 5x2 ou 6x1, selecione pelo menos um dia.
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {DIAS_SEMANA.map((dia) => (
                    <label
                      key={dia.value}
                      className="flex items-center space-x-2 rounded-md border border-border p-2 text-sm font-medium"
                    >
                      <Checkbox
                        checked={formData.dias_semana.includes(dia.value)}
                        onCheckedChange={(checked) => {
                          if (!escalaRequerDiasSemana) return;
                          setFormData((prev) => {
                            const isChecked = checked === true;
                            const filtered = prev.dias_semana.filter((item) => item !== dia.value);
                            const nextDias = isChecked ? [...filtered, dia.value] : filtered;
                            return { ...prev, dias_semana: nextDias };
                          });
                        }}
                      />
                      <span>{dia.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="valor_diaria">Valor da diária (R$)</Label>
              <Input
                id="valor_diaria"
                type="number"
                min="0"
                step="0.01"
                value={formData.valor_diaria}
                onChange={(e) => setFormData({ ...formData, valor_diaria: e.target.value })}
                placeholder="0,00"
              />
              <p className="text-xs text-muted-foreground">
                Esse valor será aplicado automaticamente ao registrar novas diárias para este posto.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="valor_unitario">Valor unitario (R$) *</Label>
              <Input
                id="valor_unitario"
                type="number"
                min="0"
                step="0.01"
                required
                value={formData.valor_unitario}
                onChange={(e) => setFormData({ ...formData, valor_unitario: e.target.value })}
                placeholder="0,00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="salario">Salario (R$) *</Label>
              <Input
                id="salario"
                type="number"
                min="0"
                step="0.01"
                required
                value={formData.salario}
                onChange={(e) => setFormData({ ...formData, salario: e.target.value })}
                placeholder="0,00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vt_dia">VT por dia (R$) *</Label>
              <Input
                id="vt_dia"
                type="number"
                min="0"
                step="0.01"
                required
                value={formData.vt_dia}
                onChange={(e) => setFormData({ ...formData, vt_dia: e.target.value })}
                placeholder="0,00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vr_dia">VR por dia (R$) *</Label>
              <Input
                id="vr_dia"
                type="number"
                min="0"
                step="0.01"
                required
                value={formData.vr_dia}
                onChange={(e) => setFormData({ ...formData, vr_dia: e.target.value })}
                placeholder="0,00"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Adicionais e beneficios *</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {renderBooleanField("adicional_noturno", "Adicional noturno")}
                {renderBooleanField("intrajornada", "Intrajornada")}
                {renderBooleanField("insalubridade", "Insalubridade")}
                {renderBooleanField("periculosidade", "Periculosidade")}
                {renderBooleanField("acumulo_funcao", "Acumulo de funcao")}
                {renderBooleanField("gratificacao", "Gratificacao")}
                {renderBooleanField("assistencia_medica", "Assistencia medica")}
                {renderBooleanField("cesta", "Cesta")}
                {renderBooleanField("premio_assiduidade", "Premio assiduidade")}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="adc_insalubridade_percentual">Adicional de insalubridade (%)</Label>
              <Input
                id="adc_insalubridade_percentual"
                type="number"
                min="0"
                step="0.01"
                value={formData.adc_insalubridade_percentual}
                onChange={(e) =>
                  setFormData({ ...formData, adc_insalubridade_percentual: e.target.value })
                }
                placeholder="Ex: 20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="acumulo_funcao_percentual">Acumulo de funcao (%)</Label>
              <Input
                id="acumulo_funcao_percentual"
                type="number"
                min="0"
                step="0.01"
                value={formData.acumulo_funcao_percentual}
                onChange={(e) =>
                  setFormData({ ...formData, acumulo_funcao_percentual: e.target.value })
                }
                placeholder="Ex: 10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="jornada">Jornada (horas)</Label>
              <Input
                id="jornada"
                type="number"
                min="0"
                value={formData.jornada}
                onChange={(e) => setFormData({ ...formData, jornada: e.target.value })}
                placeholder="Ex: 44"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="horario_inicio">Horário Início</Label>
              <Input
                id="horario_inicio"
                type="time"
                value={formData.horario_inicio}
                onChange={(e) => setFormData({ ...formData, horario_inicio: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="horario_fim">Horário Fim</Label>
              <Input
                id="horario_fim"
                type="time"
                value={formData.horario_fim}
                onChange={(e) => setFormData({ ...formData, horario_fim: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="intervalo_refeicao">Intervalo Refeição (min)</Label>
              <Input
                id="intervalo_refeicao"
                type="number"
                value={formData.intervalo_refeicao}
                onChange={(e) =>
                  setFormData({ ...formData, intervalo_refeicao: e.target.value })
                }
                placeholder="60"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="primeiro_dia_atividade">Primeiro dia de atividade</Label>
              <Input
                id="primeiro_dia_atividade"
                type="date"
                value={formData.primeiro_dia_atividade}
                onChange={(e) =>
                  setFormData({ ...formData, primeiro_dia_atividade: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ultimo_dia_atividade">Último dia de atividade</Label>
              <Input
                id="ultimo_dia_atividade"
                type="date"
                value={formData.ultimo_dia_atividade}
                onChange={(e) =>
                  setFormData({ ...formData, ultimo_dia_atividade: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Ao definir essa data, o posto será encerrado automaticamente e deixará de gerar escala
                após o dia informado. Os dias futuros e a alocação corrente serão limpos pelo sistema.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <p className="text-xs text-muted-foreground">
                Valores alinhados ao novo ENUM: vago, ocupado, vago temporariamente, ocupado
                temporariamente, presença confirmada ou inativo (encerrado).
              </p>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value as PostoStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POSTO_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="observacoes_especificas">Observacoes especificas do posto</Label>
              <Textarea
                id="observacoes_especificas"
                value={formData.observacoes_especificas}
                onChange={(e) =>
                  setFormData({ ...formData, observacoes_especificas: e.target.value })
                }
                rows={3}
                placeholder="Instrucoes adicionais ou requisitos exclusivos deste posto"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="outros_beneficios">Outros beneficios</Label>
              <div className="space-y-2">
                {formData.outros_beneficios.map((beneficio, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={beneficio}
                      onChange={(e) =>
                        setFormData((prev) => {
                          const next = [...prev.outros_beneficios];
                          next[index] = e.target.value;
                          return { ...prev, outros_beneficios: next };
                        })
                      }
                      placeholder="Descreva o beneficio"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setFormData((prev) => {
                          const next = prev.outros_beneficios.filter((_, idx) => idx !== index);
                          return { ...prev, outros_beneficios: next };
                        })
                      }
                    >
                      Remover
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      outros_beneficios: [...prev.outros_beneficios, ""],
                    }))
                  }
                >
                  Adicionar beneficio
                </Button>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {postoId ? "Atualizar" : "Criar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PostoForm;

