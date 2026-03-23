import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useSession } from "@/hooks/useSession";

export type DiariaNotificacao =
  Database["public"]["Tables"]["diarias_notificacoes"]["Row"];

type UseDiariasNotificacoesOptions = {
  limit?: number;
  enabled?: boolean;
};

export function useDiariasNotificacoes(
  options: UseDiariasNotificacoesOptions = {}
) {
  const { limit, enabled = true } = options;
  const { session } = useSession();
  const userId = session?.user?.id ?? null;
  const [notificacoes, setNotificacoes] = useState<DiariaNotificacao[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const canLoad = enabled && !!userId;

  const fetchNotificacoes = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    let query = supabase
      .from("diarias_notificacoes")
      .select(
        "id, diaria_id, titulo, mensagem, lida, created_at, evento, campo"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (limit) {
      query = query.limit(limit);
    }
    const { data, error } = await query;
    if (!error) {
      setNotificacoes((data || []) as DiariaNotificacao[]);
    }
    setLoading(false);
  }, [limit, userId]);

  const fetchUnreadCount = useCallback(async () => {
    if (!userId) return;
    const { count, error } = await supabase
      .from("diarias_notificacoes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("lida", false);
    if (!error) {
      setUnreadCount(count || 0);
    }
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    await Promise.all([fetchNotificacoes(), fetchUnreadCount()]);
  }, [fetchNotificacoes, fetchUnreadCount, userId]);

  const markAsRead = useCallback(
    async (id: string) => {
      if (!userId) return;
      const target = notificacoes.find((item) => item.id === id);
      if (!target || target.lida) return;
      const { error } = await supabase
        .from("diarias_notificacoes")
        .update({ lida: true })
        .eq("id", id);
      if (!error) {
        setNotificacoes((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, lida: true } : item
          )
        );
        setUnreadCount((prev) => Math.max(prev - 1, 0));
      }
    },
    [notificacoes, userId]
  );

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    const { error } = await supabase
      .from("diarias_notificacoes")
      .update({ lida: true })
      .eq("user_id", userId)
      .eq("lida", false);
    if (!error) {
      setNotificacoes((prev) =>
        prev.map((item) => ({ ...item, lida: true }))
      );
      setUnreadCount(0);
    }
  }, [userId]);

  useEffect(() => {
    if (!canLoad) return;
    refresh();
  }, [canLoad, refresh]);

  useEffect(() => {
    if (!canLoad || !userId) return;
    const channel = supabase
      .channel(`diarias_notificacoes_${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "diarias_notificacoes",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [canLoad, refresh, userId]);

  const unreadIds = useMemo(
    () => new Set(notificacoes.filter((n) => !n.lida).map((n) => n.id)),
    [notificacoes]
  );

  return {
    notificacoes,
    unreadCount,
    loading,
    refresh,
    markAsRead,
    markAllAsRead,
    unreadIds,
  };
}
