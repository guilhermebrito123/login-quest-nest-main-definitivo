import {
  actionPlanNonconformityLabels,
  actionPlanStatusLabels,
  actionPlanStatusOptions,
} from "@/modules/checklist/helpers";
import type { ActionPlanNonconformityClass, ActionPlanStatus } from "@/modules/checklist/types";

export const ACTION_PLAN_TIME_ZONE = "America/Sao_Paulo";

export const actionPlanClassOptions = Object.entries(
  actionPlanNonconformityLabels,
) as Array<[ActionPlanNonconformityClass, string]>;

export const actionPlanStatusOptionList = actionPlanStatusOptions;

export function getActionPlanStatusLabel(status: ActionPlanStatus) {
  return actionPlanStatusLabels[status];
}

export function getActionPlanClassLabel(value: ActionPlanNonconformityClass) {
  return actionPlanNonconformityLabels[value];
}

export function getActionPlanStatusClasses(status: ActionPlanStatus) {
  switch (status) {
    case "open":
      return "border-slate-300 bg-slate-100 text-slate-700";
    case "in_progress":
      return "border-sky-200 bg-sky-100 text-sky-700";
    case "waiting_validation":
      return "border-amber-200 bg-amber-100 text-amber-700";
    case "done":
      return "border-emerald-200 bg-emerald-100 text-emerald-700";
    case "cancelled":
      return "border-zinc-300 bg-zinc-200 text-zinc-800";
    default:
      return "border-slate-300 bg-slate-100 text-slate-700";
  }
}

export function formatActionPlanDateTime(value?: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: ACTION_PLAN_TIME_ZONE,
  }).format(new Date(value));
}

export function formatActionPlanDate(value?: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeZone: ACTION_PLAN_TIME_ZONE,
  }).format(new Date(value));
}

export function isActionPlanOverdue(
  prazoEm?: string | null,
  status?: ActionPlanStatus | null,
) {
  if (!prazoEm || !status || status === "done" || status === "cancelled") {
    return false;
  }

  return new Date(prazoEm).getTime() < Date.now();
}

export function fromSaoPauloDateTimeInputValue(value?: string | null) {
  if (!value) return null;
  return new Date(`${value}:00-03:00`).toISOString();
}

export function toSaoPauloDateTimeInputValue(value?: string | null) {
  if (!value) return "";

  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: ACTION_PLAN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(value));

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
}

export function getDayStartInSaoPaulo(date: string) {
  return fromSaoPauloDateTimeInputValue(`${date}T00:00`);
}

export function getDayEndInSaoPaulo(date: string) {
  return fromSaoPauloDateTimeInputValue(`${date}T23:59`);
}
