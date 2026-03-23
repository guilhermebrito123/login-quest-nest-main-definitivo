import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  format,
  formatDistanceToNow,
  isThisWeek,
  isToday,
  isYesterday,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDiariasNotificacoes, type DiariaNotificacao } from "@/hooks/useDiariasNotificacoes";
import { supabase } from "@/integrations/supabase/client";
import { getDiariasTemporariasRouteByStatus } from "@/pages/diarias/utils";

type NotificationGroup = {
  label: string;
  items: DiariaNotificacao[];
};

const buildGroupLabel = (date: Date) => {
  if (isToday(date)) return "Hoje";
  if (isYesterday(date)) return "Ontem";
  if (isThisWeek(date, { weekStartsOn: 1 })) return "Esta semana";
  return format(date, "dd 'de' MMMM", { locale: ptBR });
};

export default function Notificacoes() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("todas");
  const { notificacoes, unreadCount, loading, markAsRead, markAllAsRead } =
    useDiariasNotificacoes();

  const filtered = useMemo(() => {
    if (tab === "nao-lidas") {
      return notificacoes.filter((item) => !item.lida);
    }
    return notificacoes;
  }, [notificacoes, tab]);

  const grouped = useMemo<NotificationGroup[]>(() => {
    const map = new Map<string, NotificationGroup>();
    filtered.forEach((item) => {
      const date = new Date(item.created_at);
      const label = buildGroupLabel(date);
      if (!map.has(label)) {
        map.set(label, { label, items: [] });
      }
      map.get(label)!.items.push(item);
    });
    return Array.from(map.values());
  }, [filtered]);

  const timeLabel = useMemo(
    () =>
      (iso: string) =>
        formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR }),
    []
  );

  const handleOpen = async (id: string, diariaId?: number | null) => {
    await markAsRead(id);
    if (diariaId) {
      const { data } = await supabase
        .from("diarias_temporarias")
        .select("status")
        .eq("id", diariaId)
        .maybeSingle();
      const targetRoute = getDiariasTemporariasRouteByStatus(data?.status);
      navigate(`${targetRoute}?diariaId=${diariaId}`);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground uppercase tracking-wide">
              Notificacoes
            </p>
            <h1 className="text-3xl font-bold">Central de notificacoes</h1>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={unreadCount === 0}
            onClick={markAllAsRead}
          >
            Marcar todas como lidas
          </Button>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex h-auto flex-wrap gap-2">
            <TabsTrigger value="todas">Todas</TabsTrigger>
            <TabsTrigger value="nao-lidas">Nao lidas</TabsTrigger>
          </TabsList>
          <TabsContent value="todas" className="mt-4">
            {loading && (
              <p className="text-sm text-muted-foreground">
                Carregando notificacoes...
              </p>
            )}
            {!loading && grouped.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhuma notificacao encontrada.
              </p>
            )}
            {!loading &&
              grouped.map((group) => (
                <div key={group.label} className="space-y-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    {group.label}
                  </p>
                  <div className="space-y-2">
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-wrap gap-4 rounded-lg border bg-background px-4 py-3 shadow-sm"
                      >
                        <span
                          className={`mt-1 h-2.5 w-2.5 rounded-full ${
                            item.lida ? "bg-muted" : "bg-sky-500"
                          }`}
                        />
                        <div className="flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold">{item.titulo}</p>
                            {!item.lida && (
                              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                                Nao lida
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {item.mensagem}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {timeLabel(item.created_at)}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {!item.lida && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => markAsRead(item.id)}
                            >
                              Marcar como lida
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => handleOpen(item.id, item.diaria_id)}
                          >
                            Abrir
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </TabsContent>
          <TabsContent value="nao-lidas" className="mt-4">
            {loading && (
              <p className="text-sm text-muted-foreground">
                Carregando notificacoes...
              </p>
            )}
            {!loading && grouped.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhuma notificacao nao lida.
              </p>
            )}
            {!loading &&
              grouped.map((group) => (
                <div key={group.label} className="space-y-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    {group.label}
                  </p>
                  <div className="space-y-2">
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-wrap gap-4 rounded-lg border bg-background px-4 py-3 shadow-sm"
                      >
                        <span className="mt-1 h-2.5 w-2.5 rounded-full bg-sky-500" />
                        <div className="flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold">{item.titulo}</p>
                            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                              Nao lida
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {item.mensagem}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {timeLabel(item.created_at)}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => markAsRead(item.id)}
                          >
                            Marcar como lida
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => handleOpen(item.id, item.diaria_id)}
                          >
                            Abrir
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
