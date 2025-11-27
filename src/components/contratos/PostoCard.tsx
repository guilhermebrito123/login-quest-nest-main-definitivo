import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Clock, Users, Trash2, Edit, UserCheck, UserX, Calendar as CalendarIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface PostoCardProps {
  posto: {
    id: string;
    unidade_id: string;
    nome: string;
    codigo: string;
    funcao: string;
    status: string;
    horario_inicio?: string;
    horario_fim?: string;
    escala?: string;
    dias_semana?: number[] | null;
    primeiro_dia_atividade?: string | null;
    ultimo_dia_atividade?: string | null;
  };
  unidade?: {
    nome: string;
  };
  onEdit: () => void;
  onDelete: () => void;
}

const formatDateForDb = (date: Date) => format(date, "yyyy-MM-dd");
const parseDbDate = (date: string) => new Date(`${date}T00:00:00`);
const formatDateBr = (date: string) => format(parseDbDate(date), "dd/MM/yyyy");
const MOTIVOS_VAGO = [
  "falta justificada",
  "falta injustificada",
  "afastamento INSS",
  "f\u00e9rias",
  "suspens\u00e3o",
  "Posto vago",
];
const normalizeMotivoVago = (motivo: string) => {
  const cleaned = motivo?.replace(/_/g, " ").trim().toLowerCase();
  switch (cleaned) {
    case "falta justificada":
      return "falta justificada";
    case "falta injustificada":
      return "falta injustificada";
    case "afastamento inss":
      return "afastamento INSS";
    case "f?rias":
    case "ferias":
      return "f?rias";
    case "suspens?o":
    case "suspensao":
      return "suspens?o";
    case "posto vago":
      return "Posto vago";
    default:
      return motivo?.replace(/_/g, " ").trim();
  }
};


const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";

const POSTO_STATUS_LABELS: Record<string, string> = {
  vago: "Vago",
  ocupado: "Ocupado",
  vago_temporariamente: "Vago temporariamente",
  ocupado_temporariamente: "Ocupado temporariamente",
  presenca_confirmada: "Presenca confirmada",
  ocupacao_agendada: "Ocupa??o agendada",
  inativo: "Inativo",
};

const getStatusBadgeVariant = (
  status: string
): "default" | "secondary" | "outline" | "destructive" => {
  switch (status) {
    case "ocupado":
    case "presenca_confirmada":
      return "default";
    case "ocupacao_agendada":
    case "ocupado_temporariamente":
      return "secondary";
    case "vago":
      return "destructive";
    case "inativo":
      return "outline";
    default:
      return "outline";
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "ocupado":
    case "presenca_confirmada":
      return <UserCheck className="h-4 w-4" />;
    case "ocupacao_agendada":
      return <CalendarIcon className="h-4 w-4" />;
    case "vago":
    case "vago_temporariamente":
      return <UserX className="h-4 w-4" />;
    case "inativo":
      return <UserX className="h-4 w-4" />;
    default:
      return <Users className="h-4 w-4" />;
  }
};

const PostoCard = ({ posto, unidade, onEdit, onDelete }: PostoCardProps) => {
  const [colaboradoresLotados, setColaboradoresLotados] = useState<any[]>([]);
  const [statusPosto, setStatusPosto] = useState<string>(posto.status ?? 'vago');
  const [ultimoDiaAtividade, setUltimoDiaAtividade] = useState<string | null>(
    posto.ultimo_dia_atividade ?? null
  );
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [diasConfirmados, setDiasConfirmados] = useState<Date[]>([]);
  const [diasPresenca, setDiasPresenca] = useState<Date[]>([]);
  const [diasVagos, setDiasVagos] = useState<Date[]>([]);
  const [diasAgendados, setDiasAgendados] = useState<Date[]>([]);
  const [dayActionOpen, setDayActionOpen] = useState(false);
  const [selectedDayForAction, setSelectedDayForAction] = useState<Date | null>(null);
  const [motivoVago, setMotivoVago] = useState<string>("");

  useEffect(() => {
    setStatusPosto(posto.status ?? 'vago');
    setUltimoDiaAtividade(posto.ultimo_dia_atividade ?? null);
  }, [posto.status, posto.ultimo_dia_atividade]);

  const fetchDiasStatus = useCallback(async () => {
    const hoje = new Date();
    const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

    const { data, error } = await supabase
      .from("dias_trabalho")
      .select("data, status")
      .eq("posto_servico_id", posto.id)
      .in("status", ["vago", "presenca_confirmada", "ocupacao_agendada"])
      .gte("data", formatDateForDb(primeiroDiaMes))
      .lte("data", formatDateForDb(ultimoDiaMes));

    if (!error && data) {
      const diasPresencaConvertidos = data
        .filter((item) => item.status === "presenca_confirmada")
        .map((item) => parseDbDate(item.data));
      const diasAgendadosConvertidos = data
        .filter((item) => item.status === "ocupacao_agendada")
        .map((item) => parseDbDate(item.data));
      setDiasPresenca(diasPresencaConvertidos);
      setDiasAgendados(diasAgendadosConvertidos);
    } else {
      setDiasPresenca([]);
      setDiasAgendados([]);
    }
  }, [posto.id]);

  const fetchDiasVagos = useCallback(async () => {
    const hoje = new Date();
    const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

    const { data, error } = await supabase
      .from("posto_dias_vagos")
      .select("data")
      .eq("posto_servico_id", posto.id)
      .gte("data", formatDateForDb(primeiroDiaMes))
      .lte("data", formatDateForDb(ultimoDiaMes));

    if (!error && data) {
      const diasConvertidos = data.map((item) => parseDbDate(item.data));
      setDiasVagos(diasConvertidos);
    } else {
      setDiasVagos([]);
    }
  }, [posto.id]);

  const fetchJornadaConfirmada = useCallback(async () => {
    const hoje = new Date();
    const mes = hoje.getMonth() + 1;
    const ano = hoje.getFullYear();

    const { data, error } = await supabase
      .from("posto_jornadas")
      .select("dias_trabalho")
      .eq("posto_servico_id", posto.id)
      .eq("mes", mes)
      .eq("ano", ano)
      .maybeSingle();

    if (!error && data) {
      const diasConvertidos = data.dias_trabalho.map((dia: string) => new Date(dia + 'T00:00:00'));
      setDiasConfirmados(diasConvertidos);
    }
  }, [posto.id]);

  const fetchColaboradores = useCallback(async () => {
    const { data, error } = await supabase
      .from("colaboradores")
      .select("id, nome_completo, status_colaborador")
      .eq("posto_servico_id", posto.id)
      .eq("status_colaborador", "ativo");

    if (!error && data) {
      setColaboradoresLotados(data);
    }
  }, [posto.id]);

  useEffect(() => {
    fetchColaboradores();
    fetchJornadaConfirmada();
    fetchDiasStatus();
    fetchDiasVagos();
    
    const channel = supabase
      .channel(`posto-${posto.id}-updates`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'colaboradores',
          filter: `posto_servico_id=eq.${posto.id}`
        },
        () => {
          fetchColaboradores();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dias_trabalho',
          filter: `posto_servico_id=eq.${posto.id}`
        },
        () => {
          fetchDiasStatus();
          fetchDiasVagos();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posto_dias_vagos',
          filter: `posto_servico_id=eq.${posto.id}`
        },
        () => {
          fetchDiasVagos();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'postos_servico',
          filter: `id=eq.${posto.id}`
        },
        (payload) => {
          const newRow = payload.new as { status?: string; ultimo_dia_atividade?: string | null } | null;
          if (newRow?.status) {
            setStatusPosto(newRow.status);
          }
          if (newRow && "ultimo_dia_atividade" in newRow) {
            setUltimoDiaAtividade(newRow.ultimo_dia_atividade ?? null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [posto.id, fetchColaboradores, fetchDiasStatus, fetchDiasVagos, fetchJornadaConfirmada]);

  const handleDelete = async () => {
    try {
      // Check for related employees
      const { data: colaboradores } = await supabase
        .from("colaboradores")
        .select("id")
        .eq("posto_servico_id", posto.id)
        .limit(1);

      const { data: chamados } = await supabase
        .from("chamados")
        .select("id")
        .eq("posto_servico_id", posto.id)
        .limit(1);

      if (colaboradores && colaboradores.length > 0) {
        toast({
          title: "NÃ£o Ã© possÃ­vel excluir",
          description: "Este posto possui colaboradores relacionados. Remova a vinculaÃ§Ã£o dos colaboradores primeiro.",
          variant: "destructive",
        });
        return;
      }

      if (chamados && chamados.length > 0) {
        toast({
          title: "NÃ£o Ã© possÃ­vel excluir",
          description: "Este posto possui chamados relacionados. Exclua os chamados primeiro.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from("postos_servico")
        .delete()
        .eq("id", posto.id);

      if (error) throw error;

      toast({
        title: "Posto excluÃ­do",
        description: "Posto de serviÃ§o excluÃ­do com sucesso",
      });
      onDelete();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ocupado":
        return "default";
      case "vago":
        return "secondary";
      default:
        return "outline";
    }
  };

const calcularDiasJornada = async () => {
  try {
    const hoje = new Date();
    const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    const ultimoDiaDate = ultimoDiaAtividade ? parseDbDate(ultimoDiaAtividade) : null;

    if (ultimoDiaDate && ultimoDiaDate < primeiroDiaMes) {
      toast({
        title: "Posto encerrado",
        description: `O ultimo dia de atividade foi ${formatDateBr(ultimoDiaAtividade)}. Nao ha jornadas disponiveis para o periodo atual.`,
        variant: "destructive",
      });
      return;
    }

    const fimPermitido =
      ultimoDiaDate && ultimoDiaDate < ultimoDiaMes ? ultimoDiaDate : ultimoDiaMes;
    const inicioISO = primeiroDiaMes.toISOString().split("T")[0];
    const fimISO = fimPermitido.toISOString().split("T")[0];

    const { data: diasProgramados, error: diasError } = await supabase
      .from("dias_trabalho")
      .select("data")
      .eq("posto_servico_id", posto.id)
      .gte("data", inicioISO)
      .lte("data", fimISO)
      .order("data");

    if (diasError) throw diasError;

    let diasParaPreencher =
      diasProgramados?.map((item) => new Date(item.data + "T00:00:00")) || [];

    let diasFormatados = diasProgramados?.map((item) => item.data) || [];

    if (!diasParaPreencher.length) {
      if (!posto.escala) {
        toast({
          title: "Escala nao configurada",
          description: "Defina a escala do posto para gerar a jornada.",
          variant: "destructive",
        });
        return;
      }

      const primeiroDiaAtividade = posto.primeiro_dia_atividade || inicioISO;
      const { data: diasCalculados, error: diasCalcError } = await supabase.rpc(
        "calcular_dias_escala",
        {
          p_escala: posto.escala,
          p_data_inicio: inicioISO,
          p_data_fim: fimISO,
          p_dias_semana: posto.dias_semana ?? null,
          p_primeiro_dia_atividade: primeiroDiaAtividade,
        }
      );

      if (diasCalcError) throw diasCalcError;

      diasParaPreencher = (diasCalculados || []).map((item: { data_trabalho: string }) =>
        new Date(item.data_trabalho + "T00:00:00")
      );
      diasFormatados = diasParaPreencher.map((d) => formatDateForDb(d));

      if (!diasParaPreencher.length) {
        toast({
          title: "Sem dias programados",
          description: "Nenhum dia de trabalho foi retornado pela funcao calcular_dias_escala.",
          variant: "destructive",
        });
        return;
      }
    }

    if (!diasParaPreencher.length) {
      toast({
        title: "Sem dias programados",
        description: "Nenhum dia de trabalho esta disponivel dentro do periodo permitido.",
        variant: "destructive",
      });
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuario nao autenticado");

    const mes = hoje.getMonth() + 1;
    const ano = hoje.getFullYear();

    const { error } = await supabase
      .from("posto_jornadas")
      .upsert(
        {
          posto_servico_id: posto.id,
          mes,
          ano,
          dias_trabalho: diasFormatados,
          created_by: user.id,
        },
        {
          onConflict: "posto_servico_id,mes,ano",
        }
      );

    if (error) throw error;

    setDiasConfirmados(diasParaPreencher);
    toast({
      title: "Jornada confirmada",
      description: `Jornada confirmada para ${diasParaPreencher.length} dias do mes corrente`,
    });
  } catch (error: any) {
    toast({
      title: "Erro ao salvar jornada",
      description: error.message,
      variant: "destructive",
    });
  }
};

  const handleDayClick = (day: Date | undefined) => {
    if (day) {
      setSelectedDayForAction(day);
      setDayActionOpen(true);
    }
  };

  const handleConfirmarPresenca = async () => {
    if (!selectedDayForAction) return;
    
    try {
      const diaISO = formatDateForDb(selectedDayForAction);

      // Atualiza o dia_trabalho para presenca confirmada e limpa motivo
      const { error: updateError } = await supabase
        .from("dias_trabalho")
        .update({ status: "presenca_confirmada", motivo_vago: null })
        .eq("posto_servico_id", posto.id)
        .eq("data", diaISO);

      if (updateError) throw updateError;

      // Remove from database if marked as vago
      const { error } = await supabase
        .from("posto_dias_vagos")
        .delete()
        .eq("posto_servico_id", posto.id)
        .eq("data", diaISO);

      if (error) throw error;

      // Remove dos dias vagos se estiver lÃ¡
      setDiasVagos(prev => prev.filter(d => d.getTime() !== selectedDayForAction.getTime()));
      
      // Adiciona aos dias de presenÃ§a se nÃ£o estiver
      if (!diasPresenca.some(d => d.getTime() === selectedDayForAction.getTime())) {
        setDiasPresenca(prev => [...prev, selectedDayForAction]);
      }
      
      setDayActionOpen(false);
      toast({
        title: "PresenÃ§a confirmada",
        description: `PresenÃ§a confirmada para ${selectedDayForAction.toLocaleDateString('pt-BR')}`,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao confirmar presenÃ§a",
        description: error.message,
        variant: "destructive",
      });
    }
  };

    const handleMarcarVago = async () => {
    if (!selectedDayForAction || !motivoVago) {
      toast({
        title: "Motivo obrigat?rio",
        description: "Selecione um motivo para marcar o posto como vago",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const diaISO = formatDateForDb(selectedDayForAction);
      const motivoNormalizado = normalizeMotivoVago(motivoVago);

      const { error: updateError } = await supabase
        .from("dias_trabalho")
        .update({
          status: "vago",
          motivo_vago: motivoNormalizado,
        })
        .eq("posto_servico_id", posto.id)
        .eq("data", diaISO);

      if (updateError) throw updateError;
      
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error: upsertError } = await supabase
        .from("posto_dias_vagos")
        .upsert({
          posto_servico_id: posto.id,
          colaborador_id: null,
          data: diaISO,
          motivo: motivoNormalizado,
          created_by: user?.id ?? SYSTEM_USER_ID,
        });

      if (upsertError) throw upsertError;

      // Remove dos dias de presen?a se estiver l?
      setDiasPresenca(prev => prev.filter(d => d.getTime() !== selectedDayForAction.getTime()));
      
      await fetchDiasVagos();
      await fetchDiasStatus();
      
      await fetchDiasStatus();
      await fetchDiasVagos();
      setDayActionOpen(false);
      setMotivoVago("");
      toast({
        title: "Posto vago",
        description: `Posto marcado como vago para ${selectedDayForAction.toLocaleDateString('pt-BR')}`,
        variant: "destructive",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao marcar dia vago",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Briefcase className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{posto.nome}</CardTitle>
              <p className="text-sm text-muted-foreground">{posto.codigo}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center sm:justify-end">
            <Dialog open={calendarOpen} onOpenChange={setCalendarOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <CalendarIcon className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>CalendÃ¡rio - {posto.nome}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={handleDayClick}
                      className="rounded-md border pointer-events-auto"
                      modifiers={{
                        confirmado: diasConfirmados,
                        presenca: diasPresenca,
                        vago: diasVagos,
                        agendado: diasAgendados,
                      }}
                      modifiersStyles={{
                        confirmado: {
                          backgroundColor: 'hsl(var(--primary) / 0.2)',
                          color: 'hsl(var(--foreground))',
                        },
                        presenca: {
                          backgroundColor: 'hsl(142 76% 36%)',
                          color: 'white',
                          fontWeight: 'bold',
                        },
                        vago: {
                          backgroundColor: 'hsl(0 84% 60%)',
                          color: 'white',
                          fontWeight: 'bold',
                        },
                        agendado: {
                          backgroundColor: 'hsl(31 97% 45%)',
                          color: 'white',
                          fontWeight: 'bold',
                        },
                      }}
                    />
                  </div>
                  {posto.escala && (
                    <div className="space-y-2">
                      <div className="flex justify-center gap-2">
                        <Button
                          onClick={calcularDiasJornada}
                          className="w-full"
                          disabled={diasConfirmados.length > 0}
                        >
                          {diasConfirmados.length > 0 ? 'Jornada Confirmada' : 'Confirmar Jornada'}
                        </Button>
                        {diasConfirmados.length > 0 && (
                          <Button
                            onClick={async () => {
                              try {
                                const hoje = new Date();
                                const { error } = await supabase
                                  .from("posto_jornadas")
                                  .delete()
                                  .eq("posto_servico_id", posto.id)
                                  .eq("mes", hoje.getMonth() + 1)
                                  .eq("ano", hoje.getFullYear());

                                if (error) throw error;

                                setDiasConfirmados([]);
                                toast({
                                  title: "Jornada limpa",
                                  description: "Jornada removida com sucesso",
                                });
                              } catch (error: any) {
                                toast({
                                  title: "Erro ao limpar jornada",
                                  description: error.message,
                                  variant: "destructive",
                                });
                              }
                            }}
                            variant="outline"
                          >
                            Limpar
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            <Badge variant={getStatusBadgeVariant(statusPosto)} className="flex items-center gap-1">
              {getStatusIcon(statusPosto)}
              {POSTO_STATUS_LABELS[statusPosto] ?? statusPosto}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {unidade && (
            <p className="text-sm text-muted-foreground">
              Unidade: {unidade.nome}
            </p>
          )}
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>{posto.funcao}</span>
          </div>
          {posto.escala && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Briefcase className="h-4 w-4" />
              <span>Escala: {posto.escala}</span>
            </div>
          )}
          {ultimoDiaAtividade && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarIcon className="h-4 w-4" />
              <span>Último dia previsto: {formatDateBr(ultimoDiaAtividade)}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-sm pt-2 border-t">
            <span className="text-muted-foreground">Colaboradores lotados:</span>
            <span className="font-semibold">
              {colaboradoresLotados.length}/1
            </span>
          </div>
          {posto.horario_inicio && posto.horario_fim && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{posto.horario_inicio} - {posto.horario_fim}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mt-4">
          <Button variant="outline" size="sm" className="flex-1" onClick={onEdit}>
            <Edit className="h-3 w-3 mr-1" />
            Editar
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="sm:w-auto">
                <Trash2 className="h-3 w-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar exclusÃ£o</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir este posto? Esta aÃ§Ã£o nÃ£o pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>

      <Dialog open={dayActionOpen} onOpenChange={setDayActionOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedDayForAction && `Marcar dia ${selectedDayForAction.toLocaleDateString('pt-BR')}`}
            </DialogTitle>
          </DialogHeader>
          {selectedDayForAction &&
            diasAgendados.some((d) => d.getTime() === selectedDayForAction.getTime()) && (
              <p className="text-sm text-muted-foreground">
                Este dia possui uma ocupação agendada para um colaborador.
              </p>
            )}
          <div className="flex flex-col gap-4">
            <Button 
              onClick={handleConfirmarPresenca}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              <UserCheck className="h-4 w-4 mr-2" />
              Confirmar PresenÃ§a
            </Button>
            
            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo da AusÃªncia</Label>
              <Select value={motivoVago} onValueChange={setMotivoVago}>
                <SelectTrigger id="motivo">
                  <SelectValue placeholder="Selecione o motivo" />
                </SelectTrigger>
                <SelectContent>
                  {MOTIVOS_VAGO.map((motivo) => (
                    <SelectItem key={motivo} value={motivo}>
                      {motivo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Button 
              onClick={handleMarcarVago}
              variant="destructive"
              className="w-full"
              disabled={!motivoVago}
            >
              <UserX className="h-4 w-4 mr-2" />
              Posto Vago
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default PostoCard;







