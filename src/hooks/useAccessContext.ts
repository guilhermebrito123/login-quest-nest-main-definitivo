import { useQuery } from "@tanstack/react-query";

import type { Database, Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { canOperateInternalModules } from "@/lib/internalAccess";

export type AccessLevel = Database["public"]["Enums"]["internal_access_level"] | null;
export type UserRole = Database["public"]["Enums"]["user_type"] | null;

type UsuarioRow = Tables<"usuarios">;
type InternalProfileRow = Tables<"internal_profiles">;
type ColaboradorProfileRow = Tables<"colaborador_profiles">;

export type AccessContext = {
  userId: string | null;
  role: UserRole;
  accessLevel: AccessLevel;
  fullName: string | null;
  email: string | null;
  user: UsuarioRow | null;
  internalProfile: InternalProfileRow | null;
  colaboradorProfile: ColaboradorProfileRow | null;
  colaboradorCostCenterId: string | null;
  isInternal: boolean;
  isColaborador: boolean;
  isAdmin: boolean;
  canReadChamados: boolean;
  canCreateChamados: boolean;
  canManageChamados: boolean;
  canDeleteChamados: boolean;
  canManageCategorias: boolean;
  canManageLocais: boolean;
};

const defaultAccessContext: AccessContext = {
  userId: null,
  role: null,
  accessLevel: null,
  fullName: null,
  email: null,
  user: null,
  internalProfile: null,
  colaboradorProfile: null,
  colaboradorCostCenterId: null,
  isInternal: false,
  isColaborador: false,
  isAdmin: false,
  canReadChamados: false,
  canCreateChamados: false,
  canManageChamados: false,
  canDeleteChamados: false,
  canManageCategorias: false,
  canManageLocais: false,
};

export function useAccessContext() {
  const { session, loading: sessionLoading } = useSession();
  const userId = session?.user?.id ?? null;

  const query = useQuery({
    queryKey: ["access-context", userId],
    enabled: !sessionLoading && !!userId,
    queryFn: async (): Promise<AccessContext> => {
      if (!userId) return defaultAccessContext;

      const [
        { data: user, error: userError },
        { data: internalProfile, error: profileError },
        { data: colaboradorProfile, error: colaboradorProfileError },
      ] =
        await Promise.all([
          supabase.from("usuarios").select("*").eq("id", userId).maybeSingle(),
          supabase.from("internal_profiles").select("*").eq("user_id", userId).maybeSingle(),
          supabase.from("colaborador_profiles").select("*").eq("user_id", userId).maybeSingle(),
        ]);

      if (userError) throw userError;
      if (profileError) throw profileError;
      if (colaboradorProfileError) throw colaboradorProfileError;

      const role = user?.role ?? null;
      const accessLevel = internalProfile?.nivel_acesso ?? null;
      const isInternal = role === "perfil_interno";
      const isColaborador = role === "colaborador";
      const isAdmin = accessLevel === "admin";
      const canOperateInternally = isInternal && canOperateInternalModules(accessLevel);
      const colaboradorCostCenterId = colaboradorProfile?.ativo ? colaboradorProfile.cost_center_id : null;
      const canReadChamados = canOperateInternally || isColaborador;
      const canCreateChamados = isColaborador ? !!colaboradorCostCenterId : canOperateInternally;
      const canManageChamados = canOperateInternally;
      const canDeleteChamados = canOperateInternally;
      const canManageCategorias = isAdmin;
      const canManageLocais = canOperateInternally;

      return {
        userId,
        role,
        accessLevel,
        fullName: user?.full_name ?? internalProfile?.nome_completo ?? null,
        email: user?.email ?? internalProfile?.email ?? null,
        user: user ?? null,
        internalProfile: internalProfile ?? null,
        colaboradorProfile: colaboradorProfile ?? null,
        colaboradorCostCenterId,
        isInternal,
        isColaborador,
        isAdmin,
        canReadChamados,
        canCreateChamados,
        canManageChamados,
        canDeleteChamados,
        canManageCategorias,
        canManageLocais,
      };
    },
  });

  return {
    session,
    sessionLoading,
    accessContext: query.data ?? defaultAccessContext,
    accessLoading: query.isLoading,
    refetchAccessContext: query.refetch,
  };
}
