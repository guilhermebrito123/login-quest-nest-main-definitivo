import type { Database } from "@/integrations/supabase/types";

export type InternalAccessLevel = Database["public"]["Enums"]["internal_access_level"];

export const INTERNAL_COST_CENTER_SCOPED_LEVELS: InternalAccessLevel[] = [
  "gestor_operacoes",
  "supervisor",
  "analista_centro_controle",
  "tecnico",
  "assistente_operacoes",
  "assistente_financeiro",
  "gestor_financeiro",
];

export function canOperateInternalModules(accessLevel?: InternalAccessLevel | null) {
  return !!accessLevel && accessLevel !== "cliente_view";
}

export function requiresInternalCostCenterScope(accessLevel?: InternalAccessLevel | null) {
  return !!accessLevel && INTERNAL_COST_CENTER_SCOPED_LEVELS.includes(accessLevel);
}
