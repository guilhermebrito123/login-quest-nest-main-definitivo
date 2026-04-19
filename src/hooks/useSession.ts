import {
  createElement,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type SessionContextValue = {
  session: Session | null;
  loading: boolean;
  refreshSession: () => Promise<Session | null>;
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      setLoading(false);
      throw error;
    }

    setSession(data.session);
    setLoading(false);

    return data.session;
  }, []);

  useEffect(() => {
    let active = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setLoading(false);
    });

    void refreshSession().catch(() => {
      if (!active) return;
      setSession(null);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [refreshSession]);

  const value = useMemo(
    () => ({
      session,
      loading,
      refreshSession,
    }),
    [loading, refreshSession, session],
  );

  return createElement(SessionContext.Provider, { value }, children);
}

export function useSession() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error("useSession must be used within an AuthProvider.");
  }

  return context;
}
