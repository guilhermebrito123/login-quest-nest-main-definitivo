import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDiariasNotificacoes } from "@/hooks/useDiariasNotificacoes";
import { supabase } from "@/integrations/supabase/client";
import { getDiariasTemporariasRouteByStatus } from "@/pages/diarias/utils";

const MAX_NOTIFICACOES = 10;
const CAMPO_LABELS: Record<string, string> = {
  motivo_cancelamento: "Motivo de cancelamento",
  motivo_reprovacao: "Motivo de reprovacao",
  motivo_reprovacao_observacao: "Observacao de reprovacao",
  observacao_lancamento: "Observacao de lancamento",
  observacao_pagamento: "Observacao de pagamento",
  outros_motivos_reprovacao_pagamento: "Outros motivos de reprovacao",
  status: "Status",
  ok_pagamento: "OK pagamento",
};

const formatCampoLabel = (campo?: string | null) =>
  (campo && CAMPO_LABELS[campo]) || campo || "";

export function NotificationsBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [shakeActive, setShakeActive] = useState(false);
  const lastNotificacaoId = useRef<string | null>(null);
  const hasLoaded = useRef(false);
  const {
    notificacoes,
    unreadCount,
    loading,
    refresh,
    markAsRead,
    markAllAsRead,
  } = useDiariasNotificacoes({ limit: MAX_NOTIFICACOES });

  const hasNotificacoes = notificacoes.length > 0;
  const badgeLabel = unreadCount > 99 ? "99+" : String(unreadCount);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      refresh();
    }
  };

  useEffect(() => {
    if (notificacoes.length === 0) {
      if (!hasLoaded.current) {
        hasLoaded.current = true;
      }
      return;
    }
    const latestId = notificacoes[0].id;
    if (!hasLoaded.current) {
      hasLoaded.current = true;
      lastNotificacaoId.current = latestId;
      return;
    }
    if (lastNotificacaoId.current && latestId !== lastNotificacaoId.current) {
      lastNotificacaoId.current = latestId;
      setShakeActive(false);
      const start = setTimeout(() => setShakeActive(true), 0);
      const timeout = setTimeout(() => setShakeActive(false), 900);
      return () => {
        clearTimeout(start);
        clearTimeout(timeout);
      };
    }
  }, [notificacoes]);

  const handleOpenNotificacao = async (id: string, diariaId?: number | null) => {
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
    setOpen(false);
  };

  const timeLabel = useMemo(
    () =>
      (iso: string) =>
        formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR }),
    []
  );

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="relative h-16 w-16 border-slate-200 bg-slate-50 text-slate-900 shadow-sm transition-colors hover:bg-slate-100/70 focus-visible:ring-2 focus-visible:ring-slate-400/60"
          aria-label="Notificacoes"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-700 text-white">
            {unreadCount > 0 ? (
              <motion.span
                aria-hidden
                animate={
                  shakeActive ? { rotate: [0, -14, 14, -10, 10, 0] } : { rotate: 0 }
                }
                transition={{ duration: 0.9, ease: "easeInOut" }}
                className="inline-flex"
              >
                <Bell className="h-9 w-9" />
              </motion.span>
            ) : (
              <Bell className="h-9 w-9" />
            )}
          </span>
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 inline-flex min-w-[2.1rem] items-center justify-center rounded-full bg-destructive px-2 text-[14px] font-semibold text-destructive-foreground shadow animate-pulse">
              {badgeLabel}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Notificacoes</p>
            <p className="text-xs text-muted-foreground">
              {unreadCount === 0
                ? "Nenhuma nao lida"
                : `${unreadCount} nao lida${unreadCount > 1 ? "s" : ""}`}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={unreadCount === 0}
            onClick={markAllAsRead}
          >
            Marcar todas
          </Button>
        </div>
        <div className="max-h-[320px] overflow-y-auto p-3">
          <div className="flex flex-col gap-2">
            {loading && (
              <p className="text-xs text-muted-foreground">
                Carregando notificacoes...
              </p>
            )}
            {!loading && !hasNotificacoes && (
              <p className="text-xs text-muted-foreground">
                Nenhuma notificacao encontrada.
              </p>
            )}
            {!loading &&
              notificacoes.map((notificacao) => (
                <div
                  key={notificacao.id}
                  className="flex gap-3 rounded-md border px-3 py-2 text-sm"
                >
                  <span
                    className={`mt-1 h-2 w-2 rounded-full ${
                      notificacao.lida ? "bg-muted" : "bg-sky-500"
                    }`}
                  />
                  <div className="flex-1">
                    <p className="font-medium leading-tight">
                      {notificacao.titulo}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {notificacao.mensagem}
                    </p>
                    {(notificacao.valor_antigo !== null ||
                      notificacao.valor_novo !== null) && (
                      <p className="text-[11px] text-muted-foreground">
                        {formatCampoLabel(notificacao.campo)}:{" "}
                        {notificacao.valor_antigo || "-"} →{" "}
                        {notificacao.valor_novo || "-"}
                      </p>
                    )}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {timeLabel(notificacao.created_at)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {!notificacao.lida && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => markAsRead(notificacao.id)}
                        >
                          Marcar lida
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          handleOpenNotificacao(
                            notificacao.id,
                            notificacao.diaria_id
                          )
                        }
                      >
                        Abrir
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
        <div className="border-t p-3">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              setOpen(false);
              navigate("/notificacoes");
            }}
          >
            Ver todas
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
