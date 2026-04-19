import type { Database, Tables } from "@/integrations/supabase/types";
import { canOperateInternalModules } from "@/lib/internalAccess";

export type ChamadoStatus = Database["public"]["Enums"]["chamado_status"];
export type ChamadoPrioridade = Database["public"]["Enums"]["chamado_prioridade"];
export type AccessLevel = Database["public"]["Enums"]["internal_access_level"];

export type ChamadoCategoriaRow = Tables<"chamado_categorias">;
export type ChamadoLocalRow = Tables<"cost_center_locais">;
export type CostCenterRow = Tables<"cost_center">;
export type ChamadoRow = Tables<"chamados">;
export type UsuarioRow = Tables<"usuarios">;
export type InternalProfileRow = Tables<"internal_profiles">;
export type ChamadoInteracaoRow = Tables<"chamado_interacoes">;
export type ChamadoAnexoRow = Tables<"chamado_anexos">;
export type ChamadoHistoricoRow = Tables<"chamado_historico">;

const CHAMADO_TIME_ZONE = "America/Sao_Paulo";
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const CHAMADO_STATUS_OPTIONS: ChamadoStatus[] = [
  "aberto",
  "em_andamento",
  "pendente",
  "resolvido",
  "fechado",
  "cancelado",
];

export const CHAMADO_PRIORIDADE_OPTIONS: ChamadoPrioridade[] = [
  "baixa",
  "media",
  "alta",
  "critica",
];

export const CHAMADO_STATUS_LABELS: Record<ChamadoStatus, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  pendente: "Pendente",
  resolvido: "Resolvido",
  fechado: "Fechado",
  cancelado: "Cancelado",
};

export const CHAMADO_PRIORIDADE_LABELS: Record<ChamadoPrioridade, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

export const HISTORICO_OPERACAO_LABELS: Record<string, string> = {
  insert: "Criação",
  update: "Atualização",
  delete: "Exclusão",
  comentario: "Comentário",
  anexo: "Anexo",
};

export function formatChamadoStatus(status?: ChamadoStatus | null) {
  return status ? CHAMADO_STATUS_LABELS[status] : "-";
}

export function formatChamadoPrioridade(prioridade?: ChamadoPrioridade | null) {
  return prioridade ? CHAMADO_PRIORIDADE_LABELS[prioridade] : "-";
}

export function formatChamadoNumero(numero?: number | null) {
  if (typeof numero !== "number") return "-";
  return `#${String(numero).padStart(6, "0")}`;
}

export function normalizeChamadoNumeroFilter(value?: string | number | null) {
  if (value === null || value === undefined) return "";

  const digits = String(value).replace(/\D/g, "");
  if (!digits) return "";

  return digits.replace(/^0+(?=\d)/, "");
}

export function matchesChamadoNumeroFilter(
  numero?: number | null,
  filterValue?: string | number | null
) {
  const normalizedFilter = normalizeChamadoNumeroFilter(filterValue);
  if (!normalizedFilter) return true;
  if (typeof numero !== "number") return false;

  return normalizeChamadoNumeroFilter(numero) === normalizedFilter;
}

export function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const trimmed = value.trim();
  if (!trimmed) return "-";
  if (DATE_ONLY_REGEX.test(trimmed)) return trimmed.split("-").reverse().join("/");

  const normalized = trimmed.replace(" ", "T");
  const hasTimezone = /([+-]\d{2}:?\d{2}|Z)$/i.test(normalized);
  const iso = hasTimezone ? normalized : `${normalized}Z`;
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: CHAMADO_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatDateTimeBrSemTimezone(value?: string | null) {
  if (!value) return "-";
  const trimmed = value.trim();
  if (!trimmed) return "-";
  if (DATE_ONLY_REGEX.test(trimmed)) return trimmed.split("-").reverse().join("/");

  const match = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/
  );

  if (!match) return value;

  const [, year, month, day, hour, minute, second = "00"] = match;
  return `${day}/${month}/${year}, ${hour}:${minute}:${second}`;
}

export function getChamadoStatusClass(status?: ChamadoStatus | null) {
  switch (status) {
    case "aberto":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "em_andamento":
      return "border-indigo-200 bg-indigo-50 text-indigo-700";
    case "pendente":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "resolvido":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "fechado":
      return "border-slate-200 bg-slate-100 text-slate-700";
    case "cancelado":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "";
  }
}

export function getChamadoPrioridadeClass(prioridade?: ChamadoPrioridade | null) {
  switch (prioridade) {
    case "baixa":
      return "border-slate-200 bg-slate-50 text-slate-700";
    case "media":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "alta":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "critica":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "";
  }
}

export function canManageChamadoByAccess(accessLevel?: AccessLevel | null) {
  return canOperateInternalModules(accessLevel);
}

export function canManageLocaisByAccess(accessLevel?: AccessLevel | null) {
  return canOperateInternalModules(accessLevel);
}

export function canManageCategoriasByAccess(accessLevel?: AccessLevel | null) {
  return accessLevel === "admin";
}

export function sanitizeStorageFileName(fileName: string) {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function formatHistoricoOperacao(operacao?: string | null) {
  if (!operacao) return "-";
  return HISTORICO_OPERACAO_LABELS[operacao] ?? operacao;
}
