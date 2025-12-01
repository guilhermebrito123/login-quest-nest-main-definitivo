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

interface PostoFormState {
  unidade_id: string;
  nome: string;
  funcao: string;
  valor_diaria: string;
  escala: string;
  dias_semana: number[];
  jornada: string;
  horario_inicio: string;
  horario_fim: string;
  intervalo_refeicao: string;
  status: PostoStatus;
  observacoes: string;
  beneficios: string[];
  primeiro_dia_atividade: string;
  ultimo_dia_atividade: string;
}

const resolvePostoStatus = (value?: string | null): PostoStatus =>
  POSTO_STATUS_OPTIONS.find((option) => option.value === value)?.value ??
  POSTO_STATUS_OPTIONS[0].value;

const PostoForm = ({ postoId, unidadeId, onClose, onSuccess }: PostoFormProps) => {
  const [loading, setLoading] = useState(false);
  const [unidades, setUnidades] = useState<any[]>([]);
  const initialState: PostoFormState = {
    unidade_id: unidadeId || "",
    nome: "",
    funcao: "",
    valor_diaria: "",
    escala: "",
    dias_semana: [] as number[],
    jornada: "",
    horario_inicio: "",
    horario_fim: "",
    intervalo_refeicao: "",
    status: POSTO_STATUS_OPTIONS[0].value,
    observacoes: "",
    beneficios: [],
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
          "unidade_id, nome, funcao, valor_diaria, escala, dias_semana, jornada, horario_inicio, horario_fim, intervalo_refeicao, status, observacoes, beneficios, primeiro_dia_atividade, ultimo_dia_atividade"
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
          valor_diaria: data.valor_diaria?.toString() ?? "",
          escala: data.escala ?? "",
          dias_semana: Array.isArray(data.dias_semana)
            ? data.dias_semana.map((dia: any) => Number(dia))
            : [],
          jornada: data.jornada?.toString() ?? "",
          horario_inicio: data.horario_inicio ?? "",
          horario_fim: data.horario_fim ?? "",
          intervalo_refeicao: data.intervalo_refeicao?.toString() ?? "",
          status: resolvePostoStatus(data.status),
          observacoes: data.observacoes ?? "",
          beneficios: Array.isArray(data.beneficios)
            ? data.beneficios.filter((beneficio: string) => typeof beneficio === "string")
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
        valor_diaria,
        escala,
        dias_semana,
        jornada,
        horario_inicio,
        horario_fim,
        intervalo_refeicao,
        status,
        observacoes,
        beneficios,
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

      const beneficiosArray = beneficios
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

      const dataToSave = {
        unidade_id,
        nome,
        funcao,
        valor_diaria: valor_diaria ? parseFloat(valor_diaria) : 0,
        escala,
        dias_semana: dias_semana.length ? dias_semana : null,
        jornada: jornada ? parseInt(jornada) : null,
        horario_inicio,
        horario_fim,
        intervalo_refeicao: intervalo_refeicao ? parseInt(intervalo_refeicao) : null,
        status,
        observacoes: observacoes || null,
        beneficios: beneficiosArray.length ? beneficiosArray : null,
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
            </div><div className="space-y-2">
              <Label htmlFor="funcao">Função</Label>
              <Input
                id="funcao"
                value={formData.funcao}
                onChange={(e) => setFormData({ ...formData, funcao: e.target.value })}
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
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="beneficios">Beneficios</Label>
              <div className="space-y-2">
                {formData.beneficios.map((beneficio, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={beneficio}
                      onChange={(e) =>
                        setFormData((prev) => {
                          const next = [...prev.beneficios];
                          next[index] = e.target.value;
                          return { ...prev, beneficios: next };
                        })
                      }
                      placeholder="Descreva o beneficio"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setFormData((prev) => {
                          const next = prev.beneficios.filter((_, idx) => idx !== index);
                          return { ...prev, beneficios: next };
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
                      beneficios: [...prev.beneficios, ""],
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



