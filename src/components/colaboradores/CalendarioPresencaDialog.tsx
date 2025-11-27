import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, addMonths, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type PresencaRow = Database["public"]["Tables"]["presencas"]["Row"];

interface CalendarioPresencaDialogProps {
  colaborador: any;
  open: boolean;
  onClose: () => void;
}

export function CalendarioPresencaDialog({ colaborador, open, onClose }: CalendarioPresencaDialogProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [presencas, setPresencas] = useState<PresencaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedJustificativa, setSelectedJustificativa] = useState<{
    date: string;
    tipo: string;
    observacao: string | null;
  } | null>(null);

  useEffect(() => {
    if (open) {
      setCurrentMonth(new Date());
      setSelectedJustificativa(null);
    }
  }, [open, colaborador?.id]);

  useEffect(() => {
    if (!open || !colaborador?.id) return;
    const fetchPresencas = async () => {
      try {
        setLoading(true);
        const start = startOfMonth(currentMonth);
        const end = endOfMonth(currentMonth);

        const { data, error } = await supabase
          .from("presencas")
          .select("*")
          .eq("colaborador_id", colaborador.id)
          .gte("data", format(start, "yyyy-MM-dd"))
          .lte("data", format(end, "yyyy-MM-dd"))
          .order("data", { ascending: true });

        if (error) throw error;
        setPresencas(data || []);
      } catch (error) {
        console.error("Erro ao carregar presenças:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPresencas();
  }, [open, colaborador?.id, currentMonth]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  const presencaByDate = useMemo(() => {
    const map = new Map<string, PresencaRow>();
    presencas.forEach((presenca) => {
      map.set(presenca.data, presenca);
    });
    return map;
  }, [presencas]);

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const getStatusClasses = (status?: string, activeMonth?: boolean) => {
    if (!status) {
      return cn(
        "border border-dashed bg-muted/30",
        activeMonth ? "text-muted-foreground" : "text-muted-foreground/50 opacity-60"
      );
    }

    const base = activeMonth ? "" : "opacity-60";

    if (status === "presente") {
      return cn("border border-emerald-200 bg-emerald-50 text-emerald-700", base);
    }

    if (status === "falta" || status === "falta_justificada") {
      return cn("border border-red-200 bg-red-50 text-red-700", base);
    }

    if (status === "folga") {
      return cn("border border-slate-200 bg-slate-50 text-slate-700", base);
    }

    if (status === "ferias") {
      return cn("border border-amber-200 bg-amber-50 text-amber-700", base);
    }

    if (status === "atestado") {
      return cn("border border-sky-200 bg-sky-50 text-sky-700", base);
    }

    return cn("border bg-muted/40 text-muted-foreground", base);
  };

  const handleDayClick = (dateKey: string, presenca?: PresencaRow) => {
    if (!presenca) return;
    if (presenca.tipo === "falta" || presenca.tipo === "falta_justificada") {
      setSelectedJustificativa({
        date: format(new Date(dateKey), "dd 'de' MMMM", { locale: ptBR }),
        tipo: presenca.tipo,
        observacao: presenca.observacao,
      });
    }
  };

  const goToPreviousMonth = () => {
    setCurrentMonth((prev) => addMonths(prev, -1));
    setSelectedJustificativa(null);
  };

  const goToNextMonth = () => {
    setCurrentMonth((prev) => addMonths(prev, 1));
    setSelectedJustificativa(null);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Calendário de Presenças</DialogTitle>
          <p className="text-sm text-muted-foreground">{colaborador?.nome_completo}</p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={goToPreviousMonth} disabled={loading}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-lg font-semibold">
              {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}
            </div>
            <Button variant="ghost" size="icon" onClick={goToNextMonth} disabled={loading}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-2 text-center text-xs font-medium text-muted-foreground">
                {weekDays.map((day) => (
                  <div key={day}>{day}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((day) => {
                  const dateKey = format(day, "yyyy-MM-dd");
                  const presenca = presencaByDate.get(dateKey);
                  const isAbsence = presenca && (presenca.tipo === "falta" || presenca.tipo === "falta_justificada");
                  const isActiveMonth = isSameMonth(day, currentMonth);

                  return (
                    <button
                      key={dateKey}
                      type="button"
                      onClick={() => handleDayClick(dateKey, presenca)}
                      className={cn(
                        "flex min-h-[68px] flex-col items-center justify-center rounded-md border p-2 text-xs transition-colors",
                        getStatusClasses(presenca?.tipo, isActiveMonth),
                        isAbsence ? "cursor-pointer hover:border-red-400" : "cursor-default"
                      )}
                    >
                      <span className="text-sm font-semibold">{day.getDate()}</span>
                      {presenca ? (
                        <span className="mt-1 text-[11px] capitalize">
                          {presenca.tipo.replace("_", " ")}
                        </span>
                      ) : (
                        <span className="mt-1 text-[11px] text-muted-foreground/70">--</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-emerald-200"></span> Presente
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-red-200"></span> Falta / Falta justificada
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-amber-200"></span> Férias
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-slate-200"></span> Folga
            </div>
          </div>

          {selectedJustificativa && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <div className="font-semibold">
                {selectedJustificativa.tipo === "falta_justificada" ? "Falta justificada" : "Falta"} em{" "}
                {selectedJustificativa.date}
              </div>
              <p className="mt-1 text-red-600">
                {selectedJustificativa.observacao?.trim()
                  ? selectedJustificativa.observacao
                  : "Motivo não informado"}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
