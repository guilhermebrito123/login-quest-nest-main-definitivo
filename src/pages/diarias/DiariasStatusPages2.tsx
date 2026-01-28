import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Constants } from "@/integrations/supabase/types";
import {
  STATUS,
  STATUS_LABELS,
  NEXT_STATUS_ACTIONS,
  currencyFormatter,
  formatDate,
  formatDateTime,
  STATUS_BADGE,
  normalizeStatus,
  Diarista,
} from "./utils";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FaltaJustificarDialog } from "@/components/faltas/FaltaJustificarDialog";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Bell, AlertTriangle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import {
  useDiariasTemporariasData,
  DiariaTemporaria,
} from "./temporariasUtils";

interface StatusPageConfig {
  title: string;
  description: string;
  statusKey: string;
  emptyMessage?: string;
}

type NaoOkTarget =
  | { type: "single"; diaria: DiariaTemporaria }
  | {
      type: "group";
      key: string;
      ids: Array<string | number>;
      diaristaId: string | null;
      diaristaNome: string;
      count: number;
      totalValor: number;
    };

const STATUS_CONFIGS: StatusPageConfig[] = [
  {
    statusKey: STATUS.aguardando,
    title: "Diarias aguardando confirmacao",
    description: "Confirme as diarias cadastradas recentemente.",
    emptyMessage: "Nenhuma diaria aguardando confirmacao.",
  },
  {
    statusKey: STATUS.confirmada,
    title: "Diarias confirmadas",
    description: "Avance as diarias confirmadas para aprovacao.",
  },
  {
    statusKey: STATUS.aprovada,
    title: "Diarias aprovadas",
    description: "Prepare as diarias aprovadas para lancamento.",
  },
  {
    statusKey: STATUS.lancada,
    title: "Diarias lancadas",
    description: "Controle as diarias lancadas aguardando pagamento.",
  },
  {
    statusKey: STATUS.reprovada,
    title: "Diarias reprovadas",
    description: "Historico de diarias reprovadas e motivos.",
    emptyMessage: "Nenhuma diaria reprovada.",
  },
  {
    statusKey: STATUS.cancelada,
    title: "Diarias canceladas",
    description: "Historico de diarias canceladas.",
    emptyMessage: "Nenhuma diaria cancelada.",
  },
  {
    statusKey: STATUS.paga,
    title: "Diarias pagas",
    description: "Diarias pagas. Apenas alteracao de status disponivel.",
    emptyMessage: "Nenhuma diaria paga.",
  },
];

const MOTIVO_VAGO_VAGA_EM_ABERTO = "VAGA EM ABERTO (COBERTURA SALÁRIO)";
const MOTIVO_VAGO_LICENCA_NOJO_FALECIMENTO = "LICENÇA NOJO (FALECIMENTO)";
const MOTIVO_FALTA_INJUSTIFICADA = "FALTA INJUSTIFICADA";
const MOTIVO_FALTA_JUSTIFICADA = "FALTA JUSTIFICADA";
const MOTIVO_VAGO_OPTIONS = [
  MOTIVO_VAGO_VAGA_EM_ABERTO,
  MOTIVO_FALTA_INJUSTIFICADA,
  MOTIVO_FALTA_JUSTIFICADA,
  "LICENÇA MATERNIDADE",
  "LICENÇA PATERNIDADE",
  "LICENÇA CASAMENTO",
  MOTIVO_VAGO_LICENCA_NOJO_FALECIMENTO,
  "AFASTAMENTO INSS",
  "FÉRIAS",
  "SUSPENSÃO",
];

const CADASTRO_INCOMPLETO_MESSAGE =
  "Cadastro do diarista está incompleto";

const CadastroIncompletoBadge = ({
  stopPropagation = false,
}: {
  stopPropagation?: boolean;
}) => (
  <Popover>
    <PopoverTrigger asChild>
      <button
        type="button"
        className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-200 text-amber-900 shadow-sm transition hover:bg-amber-300"
        aria-label={CADASTRO_INCOMPLETO_MESSAGE}
        onClick={(event) => {
          if (stopPropagation) {
            event.stopPropagation();
          }
        }}
      >
        <AlertTriangle className="h-4 w-4" />
      </button>
    </PopoverTrigger>
    <PopoverContent className="w-auto border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
      {CADASTRO_INCOMPLETO_MESSAGE}
    </PopoverContent>
  </Popover>
);

const TooltipLabel = ({
  label,
  tooltip,
  htmlFor,
}: {
  label: string;
  tooltip: string;
  htmlFor?: string;
}) => (
  <div className="flex items-center gap-2">
    <Label className="cursor-default" htmlFor={htmlFor}>
      {label}
    </Label>
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="h-6 w-6 rounded-full border border-amber-400 bg-amber-50 text-[11px] font-bold text-amber-900 shadow-sm hover:bg-amber-100"
          aria-label={`Ajuda: ${label}`}
        >
          i
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-[220px] whitespace-normal break-words leading-tight bg-amber-50 text-amber-900 shadow-md">
        <span className="font-semibold">Ajuda: </span>
        <span>{tooltip}</span>
      </TooltipContent>
    </Tooltip>
  </div>
);

const STATUS_DATE_LABELS: { field: keyof DiariaTemporaria; label: string }[] = [
  { field: "confirmada_em", label: "Confirmada em" },
  { field: "aprovada_em", label: "Aprovada em" },
  { field: "lancada_em", label: "Lancada em" },
  { field: "paga_em", label: "Paga em" },
  { field: "cancelada_em", label: "Cancelada em" },
  { field: "reprovada_em", label: "Reprovada em" },
];
const STATUS_DATE_FILTERS = new Map<
  string,
  {
    field: keyof DiariaTemporaria;
    startLabel: string;
    endLabel: string;
    exportLabel: string;
  }
>([
  [
    normalizeStatus(STATUS.confirmada),
    {
      field: "confirmada_em",
      startLabel: "Primeiro dia confirmacao",
      endLabel: "Ultimo dia confirmacao",
      exportLabel: "Confirmada em",
    },
  ],
  [
    normalizeStatus(STATUS.aprovada),
    {
      field: "aprovada_em",
      startLabel: "Primeiro dia aprovacao",
      endLabel: "Ultimo dia aprovacao",
      exportLabel: "Aprovada em",
    },
  ],
  [
    normalizeStatus(STATUS.lancada),
    {
      field: "lancada_em",
      startLabel: "Primeiro dia lancamento",
      endLabel: "Ultimo dia lancamento",
      exportLabel: "Lancada em",
    },
  ],
  [
    normalizeStatus(STATUS.paga),
    {
      field: "paga_em",
      startLabel: "Primeiro dia pagamento",
      endLabel: "Ultimo dia pagamento",
      exportLabel: "Paga em",
    },
  ],
  [
    normalizeStatus(STATUS.cancelada),
    {
      field: "cancelada_em",
      startLabel: "Primeiro dia cancelamento",
      endLabel: "Ultimo dia cancelamento",
      exportLabel: "Cancelada em",
    },
  ],
  [
    normalizeStatus(STATUS.reprovada),
    {
      field: "reprovada_em",
      startLabel: "Primeiro dia reprovacao",
      endLabel: "Ultimo dia reprovacao",
      exportLabel: "Reprovada em",
    },
  ],
]);

const createStatusPage = ({
  statusKey,
  title,
  description,
  emptyMessage,
}: StatusPageConfig) => {
  return function DiariasTemporariasStatusPage() {
    const {
      filteredDiarias,
      diarias,
      refetchDiarias,
      loadingDiarias,
      costCenters,
      diaristas,
      diaristaMap,
      colaboradoresMap,
      colaboradoresConvenia,
      colaboradoresConveniaMap,
      postoMap,
      clienteMap,
      costCenterMap,
      usuarioMap,
    } = useDiariasTemporariasData();
    const { data: blacklist = [] } = useQuery({
      queryKey: ["blacklist"],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("blacklist")
          .select("diarista_id, motivo");
        if (error) throw error;
        return data || [];
      },
    });
    const blacklistMap = useMemo(() => {
      const map = new Map<string, { motivo?: string | null }>();
      (blacklist || []).forEach((item: any) => {
        if (item?.diarista_id) {
          map.set(item.diarista_id, { motivo: item.motivo ?? null });
        }
      });
      return map;
    }, [blacklist]);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
    const [selectedDiaria, setSelectedDiaria] =
      useState<DiariaTemporaria | null>(null);
    const [reasonDialog, setReasonDialog] = useState<{
      open: boolean;
      diariaId: string | null;
      targetStatus: string | null;
    }>({ open: false, diariaId: null, targetStatus: null });
    const [reasonText, setReasonText] = useState("");
    const [motivoReprovacao, setMotivoReprovacao] = useState("");
    const [motivoReprovacaoObservacao, setMotivoReprovacaoObservacao] =
      useState("");
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [groupOkSavingKey, setGroupOkSavingKey] = useState<string | null>(
      null
    );
    const [groupLancarSavingKey, setGroupLancarSavingKey] = useState<
      string | null
    >(null);
    const [groupDetailsDialogOpen, setGroupDetailsDialogOpen] = useState(false);
    const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(
      null
    );
    const [naoOkDialogOpen, setNaoOkDialogOpen] = useState(false);
    const [naoOkSaving, setNaoOkSaving] = useState(false);
    const [naoOkTarget, setNaoOkTarget] = useState<NaoOkTarget | null>(null);
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
    const [naoOkObservacao, setNaoOkObservacao] = useState<string[]>([]);
    const [naoOkOutroMotivo, setNaoOkOutroMotivo] = useState("");
    const [naoOkWantsOutroMotivo, setNaoOkWantsOutroMotivo] = useState<
      boolean | null
    >(null);
    const [lancadasView, setLancadasView] = useState<"lista" | "agrupadas">(
      "lista"
    );
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editingDiariaId, setEditingDiariaId] = useState<string | null>(null);
    const [editingSaving, setEditingSaving] = useState(false);
    const [originalDiaristaId, setOriginalDiaristaId] = useState<string | null>(
      null
    );
    const [faltaDialogOpen, setFaltaDialogOpen] = useState(false);
    const [faltaDialogDiaria, setFaltaDialogDiaria] =
      useState<DiariaTemporaria | null>(null);
    const OPTIONAL_VALUE = "__none__";
    const UNSET_BOOL = "__unset__";
    const observacaoPagamentoOptions =
      Constants.public.Enums.observacao_pagamento_type;
    const motivoReprovacaoOptions = Constants.public.Enums.motivo_reprovacao;
    const [editForm, setEditForm] = useState({
      dataDiaria: "",
      horarioInicio: "",
      horarioFim: "",
      intervalo: "",
      motivoVago: MOTIVO_VAGO_OPTIONS[0] || "",
      postoServicoId: "",
      unidade: "",
      centroCustoId: "",
      valorDiaria: "",
      diaristaId: "",
      colaboradorAusenteId: "",
      colaboradorDemitidoId: "",
      demissao: null as boolean | null,
      novoPosto: null as boolean | null,
      observacao: "",
    });
    const [filters, setFilters] = useState({
      diariaId: "",
      diaristaId: "",
      motivo: "",
      clienteId: "",
      centroCustoId: "",
      startDate: "",
      endDate: "",
      criadoPorId: "",
      statusResponsavelId: "",
      okPagamentoPorId: "",
      statusDateStart: "",
      statusDateEnd: "",
      okPagamento: "",
    });
    const [totalRangeDiarista, setTotalRangeDiarista] = useState({
      diaristaId: "",
      startDate: "",
      endDate: "",
    });
    const [totalRangeDiaristaAll, setTotalRangeDiaristaAll] = useState({
      diaristaId: "",
    });
    const [totalRangeCliente, setTotalRangeCliente] = useState({
      diaristaId: "",
      clienteId: "",
      startDate: "",
      endDate: "",
    });
    const [totalRangeClienteOnly, setTotalRangeClienteOnly] = useState({
      clienteId: "",
      startDate: "",
      endDate: "",
    });
    const [totalRangePeriodo, setTotalRangePeriodo] = useState({
      startDate: "",
      endDate: "",
    });
    const [totalDialogOpen, setTotalDialogOpen] = useState(false);
    const selectAllValue = "__all__";
    const [extraUserMap, setExtraUserMap] = useState<Map<string, string>>(
      new Map()
    );
    const isConveniaFalta = !!selectedDiaria?.colaborador_ausente_convenia;
    const { data: faltaInfo, refetch: refetchFaltaInfo } = useQuery({
      queryKey: [
        "colaborador-falta-diaria",
        selectedDiaria?.id,
        isConveniaFalta ? "convenia" : "colaborador",
      ],
      queryFn: async () => {
        if (!selectedDiaria?.id) return null;
        if (isConveniaFalta) {
          const { data, error } = await supabase
            .from("faltas_colaboradores_convenia")
            .select(
              "motivo, atestado_path, justificada_em, justificada_por, diaria_temporaria_id"
            )
            .eq("diaria_temporaria_id", selectedDiaria.id)
            .maybeSingle();
          if (error) throw error;
          if (!data) return null;
          return {
            motivo: data.motivo,
            documento_url: data.atestado_path,
            justificada_em: data.justificada_em,
            justificada_por: data.justificada_por,
            diaria_temporaria_id: data.diaria_temporaria_id,
          };
        }

        const { data, error } = await supabase
          .from("colaborador_faltas")
          .select(
            "motivo, documento_url, justificada_em, justificada_por, diaria_temporaria_id"
          )
          .eq("diaria_temporaria_id", selectedDiaria.id)
          .maybeSingle();
        if (error) throw error;
        return data;
      },
      enabled: !!selectedDiaria?.id,
    });

    const normalizedKey = normalizeStatus(statusKey);
    const normalizedAguardandoStatus = normalizeStatus(STATUS.aguardando);
    const isAguardandoPage = normalizedKey === normalizedAguardandoStatus;
    const isConfirmadaPage =
      normalizedKey === normalizeStatus(STATUS.confirmada);
    const normalizedCancelStatus = normalizeStatus(STATUS.cancelada);
    const normalizedReprovadaStatus = normalizeStatus(STATUS.reprovada);
    const isCancelPage = normalizedKey === normalizedCancelStatus;
    const isReprovadaPage = normalizedKey === normalizedReprovadaStatus;
    const allowDelete = isCancelPage || isReprovadaPage;
    const isPagaPage = normalizedKey === normalizeStatus(STATUS.paga);
    const isLancadaPage = normalizedKey === normalizeStatus(STATUS.lancada);
    const isAprovadaPage = normalizedKey === normalizeStatus(STATUS.aprovada);
    const canEditDiaria = (diaria?: DiariaTemporaria | null) =>
      normalizeStatus(diaria?.status || "") === normalizedAguardandoStatus;
    const statusResponsavelField = useMemo(() => {
      const map = new Map<string, keyof DiariaTemporaria>([
        [normalizeStatus(STATUS.confirmada), "confirmada_por"],
        [normalizeStatus(STATUS.aprovada), "aprovada_por"],
        [normalizeStatus(STATUS.lancada), "lancada_por"],
        [normalizeStatus(STATUS.paga), "paga_por"],
        [normalizeStatus(STATUS.cancelada), "cancelada_por"],
        [normalizeStatus(STATUS.reprovada), "reprovada_por"],
      ]);
      return map.get(normalizedKey) || null;
    }, [normalizedKey]);

    const statusResponsavelLabel = useMemo(() => {
      const map = new Map<string, string>([
        [STATUS.confirmada, "Confirmadas por"],
        [STATUS.aprovada, "Aprovadas por"],
        [STATUS.lancada, "Lancadas por"],
        [STATUS.paga, "Pagas por"],
        [STATUS.reprovada, "Reprovadas por"],
        [STATUS.cancelada, "Canceladas por"],
      ]);
      return map.get(statusKey) || "Responsavel";
    }, [statusKey]);

    const statusResponsavelTooltip = useMemo(() => {
      const map = new Map<string, string>([
        [
          normalizeStatus(STATUS.confirmada),
          "Filtra pelo usuario responsavel pela confirmacao.",
        ],
        [
          normalizeStatus(STATUS.aprovada),
          "Filtra pelo usuario responsavel pela aprovacao.",
        ],
        [
          normalizeStatus(STATUS.lancada),
          "Filtra pelo usuario responsavel pelo lancamento.",
        ],
        [
          normalizeStatus(STATUS.paga),
          "Filtra pelo usuario responsavel pelo pagamento.",
        ],
        [
          normalizeStatus(STATUS.reprovada),
          "Filtra pelo usuario responsavel pela reprovacao.",
        ],
        [
          normalizeStatus(STATUS.cancelada),
          "Filtra pelo usuario responsavel pelo cancelamento.",
        ],
      ]);
      return (
        map.get(normalizedKey) || "Filtra pelo usuario responsavel pelo status."
      );
    }, [normalizedKey]);

    const responsavelStatusHeader = useMemo(() => {
      const map = new Map<string, string>([
        [normalizeStatus(STATUS.confirmada), "Responsavel pela confirmacao"],
        [normalizeStatus(STATUS.aprovada), "Responsavel pela aprovacao"],
        [normalizeStatus(STATUS.lancada), "Responsavel lancamento"],
        [normalizeStatus(STATUS.paga), "Responsavel pagamento"],
        [normalizeStatus(STATUS.reprovada), "Responsavel reprovacao"],
        [normalizeStatus(STATUS.cancelada), "Responsavel cancelamento"],
      ]);
      return map.get(normalizedKey) || "Responsavel status";
    }, [normalizedKey]);

    const pageDefaultAction = useMemo(
      () => NEXT_STATUS_ACTIONS[normalizedKey] || null,
      [normalizedKey]
    );

    const statusDateConfig = useMemo(
      () => STATUS_DATE_FILTERS.get(normalizedKey) || null,
      [normalizedKey]
    );

    const buildStatusDateTooltip = useMemo(
      () =>
        statusDateConfig
          ? {
              start: `Utilize esta opcao de filtro em conjunto com "${
                statusDateConfig.endLabel
              }" para selecionar todas as diarias que foram ${(
                statusDateConfig.exportLabel ||
                statusDateConfig.startLabel ||
                ""
              )
                .replace(/ em$/i, "")
                .toLowerCase()}s dentro desse periodo.`,
              end: `Utilize esta opcao de filtro em conjunto com "${
                statusDateConfig.startLabel
              }" para selecionar todas as diarias que foram ${(
                statusDateConfig.exportLabel ||
                statusDateConfig.endLabel ||
                ""
              )
                .replace(/ em$/i, "")
                .toLowerCase()}s dentro desse periodo.`,
            }
          : { start: "", end: "" },
      [statusDateConfig]
    );

    const formatIntervalValue = (value?: number | null) => {
      if (value === null || value === undefined) return "-";
      const parsed = Number(value);
      if (Number.isNaN(parsed)) return "-";
      return `${parsed} min`;
    };

    const formatTimeValue = (value?: string | null) => {
      if (!value) return "-";
      const [hour = "", minute = ""] = value.split(":");
      if (!hour && !minute) return value;
      return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
    };

    const parseTimeToMinutes = (value?: string | null) => {
      if (!value) return null;
      const [hour = "", minute = ""] = value.split(":");
      if (!hour && !minute) return null;
      const parsedHour = Number(hour);
      const parsedMinute = Number(minute || "0");
      if (Number.isNaN(parsedHour) || Number.isNaN(parsedMinute)) return null;
      return parsedHour * 60 + parsedMinute;
    };

    const calcularJornadaDiaria = (
      horarioInicio?: string | null,
      horarioFim?: string | null,
      intervalo?: number | null
    ) => {
      const inicioMinutos = parseTimeToMinutes(horarioInicio);
      const fimMinutos = parseTimeToMinutes(horarioFim);
      if (inicioMinutos === null || fimMinutos === null) return null;
      const intervaloMinutos = typeof intervalo === "number" ? intervalo : Number(intervalo) || 0;
      const ajusteVirada = fimMinutos < inicioMinutos ? 1440 : 0;
      const totalMinutos = fimMinutos - inicioMinutos + ajusteVirada - intervaloMinutos;
      return totalMinutos / 60;
    };

    const getDateKeyFromValue = (value?: string | null) => {
      if (!value) return "";
      const trimmed = value.trim();
      if (!trimmed) return "";
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
      const normalized = trimmed.replace(" ", "T");
      const hasTimezone = /([+-]\d{2}:?\d{2}|Z)$/i.test(normalized);
      const iso = hasTimezone ? normalized : `${normalized}Z`;
      const parsed = new Date(iso);
      if (Number.isNaN(parsed.getTime())) return "";
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(parsed);
    };

    const formatJornadaValue = (value?: number | null) => {
      if (value === null || value === undefined) return "-";
      const parsed = Number(value);
      if (Number.isNaN(parsed)) return "-";
      return parsed.toFixed(2);
    };

    const getJornadaDiariaValue = (diaria: DiariaTemporaria) => {
      const calculada = calcularJornadaDiaria(
        diaria.horario_inicio,
        diaria.horario_fim,
        diaria.intervalo ?? null
      );
      if (calculada !== null) return calculada;
      const rawValue = typeof diaria.jornada_diaria === "number"
        ? diaria.jornada_diaria
        : Number(diaria.jornada_diaria);
      return Number.isNaN(rawValue) ? null : rawValue;
    };

    const formatPixPertence = (value?: boolean | null) => {
      if (value === true) return "Sim";
      if (value === false) return "Não";
      return "-";
    };

    const formatBooleanFlag = (value?: boolean | null) => {
      if (value === true) return "Sim";
      if (value === false) return "Nao";
      return "-";
    };

    const isFaltaMotivo = (motivo?: string | null) => {
      const upper = (motivo || "").toUpperCase();
      return (
        upper === MOTIVO_FALTA_INJUSTIFICADA ||
        upper === MOTIVO_FALTA_JUSTIFICADA
      );
    };

    const handleFaltaDialogOpenChange = (open: boolean) => {
      setFaltaDialogOpen(open);
      if (!open) setFaltaDialogDiaria(null);
    };

    const openFaltaDialog = (diaria: DiariaTemporaria) => {
      setFaltaDialogDiaria(diaria);
      setFaltaDialogOpen(true);
    };

    const handleViewFaltaDocumento = async (path: string) => {
      try {
        const { data, error } = await supabase.storage
          .from("atestados")
          .createSignedUrl(path, 120);
        if (error || !data?.signedUrl) {
          throw error || new Error("Link temporario indisponivel.");
        }
        window.open(data.signedUrl, "_blank", "noopener,noreferrer");
      } catch (error: any) {
        toast.error(error?.message || "Nao foi possivel abrir o documento.");
      }
    };

    const stripNonDigits = (value?: string | number | null) =>
      (value ?? "").toString().replace(/\D/g, "");

    const TEST_DIARISTA_NAMES = new Set(["guilherme guerra", "james bond", "cris ronaldo"]);
    const TEST_DIARISTA_CPFS = new Set(["01999999999", "01999999998"]);
    const isTestDiarista = (option: { nome?: string; cpf?: string | null }) => {
      const name = (option.nome || "").trim().toLowerCase();
      const cpfDigits = stripNonDigits(option.cpf);
      return TEST_DIARISTA_NAMES.has(name) || TEST_DIARISTA_CPFS.has(cpfDigits);
    };

    const formatCpf = (value?: string | number | null) => {
      const digits = stripNonDigits(value).slice(0, 11);
      const part1 = digits.slice(0, 3);
      const part2 = digits.slice(3, 6);
      const part3 = digits.slice(6, 9);
      const part4 = digits.slice(9, 11);
      let result = part1;
      if (part2) result += `.${part2}`;
      if (part3) result += `.${part3}`;
      if (part4) result += `-${part4}`;
      return result;
    };

    const getConveniaColaboradorNome = (colaborador?: {
      name?: string | null;
      last_name?: string | null;
      social_name?: string | null;
      id?: string;
    } | null) => {
      if (!colaborador) return "-";
      const base = (colaborador.social_name || colaborador.name || "").trim();
      const last = (colaborador.last_name || "").trim();
      const full = [base, last].filter(Boolean).join(" ").trim();
      return full || colaborador.name || colaborador.id || "-";
    };

    const toUpperOrNull = (value: string | null | undefined) => {
      const trimmed = (value ?? "").trim();
      return trimmed ? trimmed.toUpperCase() : null;
    };
    const toTrimOrNull = (value: string | null | undefined) => {
      const trimmed = (value ?? "").trim();
      return trimmed ? trimmed : null;
    };
    const isCadastroIncompleto = (diarista?: Diarista | null) => {
      if (!diarista) return false;
      const requiredFields = [
        diarista.nome_completo,
        diarista.cpf,
        diarista.banco,
        diarista.agencia,
        diarista.numero_conta,
        diarista.tipo_conta,
        diarista.pix,
      ];
      return requiredFields.some((value) => !toTrimOrNull(value));
    };

    const getStatusResponsavel = (diaria: DiariaTemporaria) => {
      const normalizedStatus = normalizeStatus(diaria.status);
      switch (normalizedStatus) {
        case normalizeStatus(STATUS.confirmada):
          return { id: diaria.confirmada_por || null, label: "Confirmacao" };
        case normalizeStatus(STATUS.aprovada):
          return { id: diaria.aprovada_por || null, label: "Aprovacao" };
        case normalizeStatus(STATUS.lancada):
          return { id: diaria.lancada_por || null, label: "Lancamento" };
        case normalizeStatus(STATUS.paga):
          return { id: diaria.paga_por || null, label: "Pagamento" };
        case normalizeStatus(STATUS.cancelada):
          return { id: diaria.cancelada_por || null, label: "Cancelamento" };
        case normalizeStatus(STATUS.reprovada):
          return { id: diaria.reprovada_por || null, label: "Reprovacao" };
        default:
          return { id: null, label: "" };
      }
    };

    const getUsuarioNome = (id?: string | null) => {
      if (!id) return "-";
      return usuarioMap.get(id) || extraUserMap.get(id) || "-";
    };

    const normalizeObservacaoPagamento = (value?: string[] | string | null) => {
      if (!value) return [] as string[];
      if (Array.isArray(value)) {
        return value.map((item) => item.trim()).filter(Boolean);
      }
      const trimmed = value.trim();
      return trimmed ? [trimmed] : [];
    };

    const formatObservacaoPagamento = (value?: string[] | string | null) => {
      const list = normalizeObservacaoPagamento(value);
      return list.length > 0 ? list.join("; ") : "";
    };

    const getObservacaoPagamentoKey = (value?: string[] | string | null) => {
      const list = normalizeObservacaoPagamento(value);
      if (list.length === 0) return "";
      return list
        .map((item) => item.toLowerCase())
        .sort()
        .join("||");
    };

    const formatCompetencia = (value?: string | null) => {
      if (!value) return "";
      const parts = value.split("-");
      if (parts.length < 2) return "";
      const year = parts[0];
      const monthIndex = Number(parts[1]) - 1;
      const monthLabels = [
        "JAN",
        "FEV",
        "MAR",
        "ABR",
        "MAI",
        "JUN",
        "JUL",
        "AGO",
        "SET",
        "OUT",
        "NOV",
        "DEZ",
      ];
      const monthLabel = monthLabels[monthIndex] || "";
      const yearShort = year.slice(-2);
      if (!monthLabel || !yearShort) return "";
      return `${monthLabel}-${yearShort}`;
    };

    const getPagamentoRowClasses = (
      okPagamento: boolean | null | undefined,
      baseClasses = ""
    ) => {
      const base = baseClasses ? `${baseClasses} ` : "";
      if (isAprovadaPage && okPagamento === false) {
        return (
          `${base}bg-red-400 text-white hover:bg-red-500 ` +
          "[&_.text-muted-foreground]:text-white/80 " +
          "[&_button]:!bg-white [&_button]:!text-red-400 [&_button]:!border-red-400 " +
          "[&_button:hover]:!bg-white/90 [&_button:disabled]:opacity-70"
        );
      }
      return `${base}hover:bg-muted/90`;
    };

    const getPagamentoRowStyle = (okPagamento: boolean | null | undefined) =>
      isAprovadaPage && okPagamento === false
        ? { colorScheme: "dark" }
        : undefined;

    const uppercaseRows = (rows: Record<string, any>[]) =>
      rows.map((row) => {
        const normalized: Record<string, any> = {};
        Object.entries(row).forEach(([key, value]) => {
          normalized[key] =
            typeof value === "string" ? value.toUpperCase() : value;
        });
        return normalized;
      });

    const isVagaEmAberto = (motivo?: string | null) =>
      (motivo || "").toUpperCase().includes("VAGA EM ABERTO");

    const diariasDoStatusFull = useMemo(
      () =>
        diarias.filter(
          (diaria) => normalizeStatus(diaria.status) === normalizedKey
        ),
      [diarias, normalizedKey]
    );

    const selectedDiarias = useMemo(
      () =>
        diariasDoStatusFull.filter((diaria) =>
          selectedIds.has(diaria.id.toString())
        ),
      [diariasDoStatusFull, selectedIds]
    );

    const diariasDoStatus = useMemo(
      () =>
        filteredDiarias.filter(
          (diaria) => normalizeStatus(diaria.status) === normalizedKey
        ),
      [filteredDiarias, normalizedKey]
    );
    const statusNoticeCount = diariasDoStatusFull.length;
    const showStatusNotice = statusNoticeCount > 0;
    const statusNoticeLabel = (
      STATUS_LABELS[statusKey] || statusKey
    ).toLowerCase();

    const getContratoInfoFromPosto = (postoInfo: any) => {
      const contrato = postoInfo?.unidade?.contrato;
      if (contrato?.id || contrato?.negocio) {
        return {
          id: contrato.id,
          negocio: contrato.negocio ?? null,
          clienteId: contrato.cliente_id ?? null,
          clienteNome: contrato.clientes?.razao_social ?? null,
        };
      }
      return null;
    };

    const getClienteInfoFromPosto = (postoInfo: any) => {
      const contratoInfo = getContratoInfoFromPosto(postoInfo);
      if (contratoInfo?.clienteId && contratoInfo.clienteNome) {
        return { id: contratoInfo.clienteId, nome: contratoInfo.clienteNome };
      }
      if (postoInfo?.cliente_id !== null && postoInfo?.cliente_id !== undefined) {
        const clienteId = Number(postoInfo.cliente_id);
        const nome = Number.isFinite(clienteId)
          ? clienteMap.get(clienteId) || ""
          : "";
        return {
          id: postoInfo.cliente_id ?? "",
          nome: nome || "Cliente nao informado",
        };
      }
      return null;
    };

    const getClienteNomeFromDiaria = (
      diaria: DiariaTemporaria,
      postoInfo: any
    ) => {
      const nomePorId =
        typeof diaria.cliente_id === "number"
          ? clienteMap.get(diaria.cliente_id) || ""
          : "";
      const nome = nomePorId || getClienteInfoFromPosto(postoInfo)?.nome || "";
      return nome || "";
    };

    const getClienteKeyFromDiaria = (
      diaria: DiariaTemporaria,
      postoInfo: any
    ) => {
      const key =
        (typeof diaria.cliente_id === "number" &&
          diaria.cliente_id.toString()) ||
        (getClienteInfoFromPosto(postoInfo)?.id
          ? String(getClienteInfoFromPosto(postoInfo)?.id)
          : "");
      return key;
    };

    const getCentroCustoIdFromDiaria = (
      diaria: DiariaTemporaria,
      postoInfo: any
    ) => {
      if (diaria.centro_custo_id) return diaria.centro_custo_id.toString();
      if (postoInfo?.cost_center_id) return postoInfo.cost_center_id.toString();
      return "";
    };

    const getCentroCustoNomeFromDiaria = (
      diaria: DiariaTemporaria,
      postoInfo: any
    ) => {
      const centroId = getCentroCustoIdFromDiaria(diaria, postoInfo);
      if (!centroId) return "";
      return costCenterMap.get(centroId) || centroId;
    };

    const getClienteOuCentroCustoDisplay = (
      diaria: DiariaTemporaria,
      postoInfo: any
    ) => {
      const clienteNome = getClienteNomeFromDiaria(diaria, postoInfo);
      if (toTrimOrNull(clienteNome)) {
        return { label: "Cliente", value: clienteNome };
      }
      const centroNome = getCentroCustoNomeFromDiaria(diaria, postoInfo);
      if (toTrimOrNull(centroNome)) {
        return { label: "Centro de custo", value: centroNome };
      }
      return { label: "Cliente", value: "-" };
    };

    const getColaboradorAusenteDisplay = (diaria: DiariaTemporaria) => {
      if (diaria.colaborador_ausente) {
        return (
          colaboradoresMap.get(diaria.colaborador_ausente)?.nome_completo ||
          diaria.colaborador_ausente
        );
      }
      if (diaria.colaborador_ausente_convenia) {
        return getConveniaColaboradorNome(
          colaboradoresConveniaMap.get(diaria.colaborador_ausente_convenia)
        );
      }
      return "-";
    };

    const getColaboradorDemitidoDisplay = (diaria: DiariaTemporaria) => {
      if (diaria.colaborador_demitido) {
        return (
          colaboradoresMap.get(diaria.colaborador_demitido)?.nome_completo ||
          diaria.colaborador_demitido
        );
      }
      if (diaria.colaborador_demitido_convenia) {
        return getConveniaColaboradorNome(
          colaboradoresConveniaMap.get(diaria.colaborador_demitido_convenia)
        );
      }
      return "-";
    };

    const clienteOptions = useMemo(() => {
      if (!totalRangeCliente.diaristaId) return [];
      const map = new Map<string, string>();
      diariasDoStatusFull.forEach((diaria) => {
        if (diaria.diarista_id !== totalRangeCliente.diaristaId) {
          return;
        }
        const postoInfo =
          diaria.posto ||
          (diaria.posto_servico_id
            ? postoMap.get(diaria.posto_servico_id)
            : null);
        const clienteKey = getClienteKeyFromDiaria(diaria, postoInfo);
        const clienteNome = getClienteNomeFromDiaria(diaria, postoInfo);
        if (clienteKey && clienteNome) {
          map.set(clienteKey, clienteNome);
        }
      });
      return Array.from(map.entries())
        .map(([id, nome]) => ({ id, nome }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
    }, [diariasDoStatusFull, postoMap, totalRangeCliente.diaristaId]);

    useEffect(() => {
      const clienteValido = clienteOptions.some(
        (c) => c.id === totalRangeCliente.clienteId
      )
        ? totalRangeCliente.clienteId
        : "";
      if (clienteValido === totalRangeCliente.clienteId) return;
      setTotalRangeCliente((prev) => ({
        ...prev,
        clienteId: clienteValido,
      }));
    }, [clienteOptions, totalRangeCliente.clienteId]);

    const diaristaOptions = useMemo(() => {
      const map = new Map<string, string>();
      diariasDoStatusFull.forEach((diaria) => {
        const diaristaInfo =
          diaria.diarista || diaristaMap.get(diaria.diarista_id || "");
        if (diaria.diarista_id && diaristaInfo?.nome_completo) {
          map.set(diaria.diarista_id, diaristaInfo.nome_completo);
        }
      });
      return Array.from(map.entries())
        .map(([id, nome]) => ({ id, nome }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
    }, [diariasDoStatusFull, diaristaMap]);

    const diaristaOptionsAll = useMemo(
      () =>
        diaristas
          .filter((diarista) => diarista?.id)
          .map((diarista) => ({
            id: diarista.id,
            nome: diarista.nome_completo || diarista.id,
            cpf: diarista.cpf ?? null,
          }))
          .sort((a, b) => a.nome.localeCompare(b.nome)),
      [diaristas]
    );
    const diaristaStatusMap = useMemo(() => {
      const map = new Map<string, string>();
      diaristas.forEach((diarista) => {
        if (diarista?.id && diarista.status) {
          map.set(diarista.id, diarista.status);
        }
      });
      return map;
    }, [diaristas]);

    const motivoOptions = useMemo(() => {
      const set = new Set<string>();
      diariasDoStatus.forEach((diaria) => {
        if (diaria.motivo_vago) {
          set.add(diaria.motivo_vago);
        }
      });
      return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [diariasDoStatus]);

    const postosOptions = useMemo(() => {
      return Array.from(postoMap.values())
        .map((p: any) => ({
          id: p.id?.toString?.() || "",
          nome: p.nome || "Sem nome",
          cliente_id: p.cliente_id ?? p.unidade?.contrato?.cliente_id ?? "",
          cost_center_id: p.cost_center_id ?? "",
          unidade: p.unidade?.nome ?? null,
        }))
        .filter((p) => p.id);
    }, [postoMap]);

    const colaboradoresConveniaByCentroCusto = useMemo(() => {
      const base = colaboradoresConvenia.filter((colaborador) => colaborador?.id);
      if (!editForm.centroCustoId) return base;
      return base.filter(
        (colaborador) => colaborador.cost_center_id === editForm.centroCustoId
      );
    }, [colaboradoresConvenia, editForm.centroCustoId]);

    const colaboradoresOptionsByCentroCusto = useMemo(
      () =>
        colaboradoresConveniaByCentroCusto
          .map((colaborador) => ({
            id: colaborador.id,
            nome: getConveniaColaboradorNome(colaborador),
          }))
          .sort((a, b) => a.nome.localeCompare(b.nome)),
      [colaboradoresConveniaByCentroCusto]
    );

    const costCenterOptionsAll = useMemo(
      () =>
        costCenters
          .map((center) => ({
            id: center.id,
            nome: center.name || center.id,
          }))
          .sort((a, b) => a.nome.localeCompare(b.nome)),
      [costCenters]
    );

    const criadoPorOptions = useMemo(() => {
      const map = new Map<string, string>();
      diariasDoStatusFull.forEach((diaria) => {
        if (diaria.criado_por) {
          const nome = usuarioMap.get(diaria.criado_por) || "";
          map.set(diaria.criado_por, nome);
        }
      });
      return Array.from(map.entries())
        .map(([id, nome]) => ({ id, nome: nome || "(sem nome)" }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
    }, [diariasDoStatusFull, usuarioMap]);

    const responsavelStatusOptions = useMemo(() => {
      if (!statusResponsavelField) return [];
      const map = new Map<string, string>();
      diariasDoStatusFull.forEach((diaria) => {
        const responsavelId = (diaria as any)[statusResponsavelField] as
          | string
          | null
          | undefined;
        if (responsavelId) {
          const nome = usuarioMap.get(responsavelId) || "";
          map.set(responsavelId, nome);
        }
      });
      return Array.from(map.entries())
        .map(([id, nome]) => ({ id, nome: nome || "(sem nome)" }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
    }, [diariasDoStatusFull, usuarioMap, statusResponsavelField]);

    const okPagamentoPorOptions = useMemo(() => {
      if (!isPagaPage) return [];
      const map = new Map<string, string>();
      diariasDoStatusFull.forEach((diaria) => {
        if (diaria.ok_pagamento_por) {
          const nome =
            usuarioMap.get(diaria.ok_pagamento_por) ||
            extraUserMap.get(diaria.ok_pagamento_por) ||
            "";
          map.set(diaria.ok_pagamento_por, nome);
        }
      });
      return Array.from(map.entries())
        .map(([id, nome]) => ({ id, nome: nome || "(sem nome)" }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
    }, [diariasDoStatusFull, extraUserMap, isPagaPage, usuarioMap]);

    const clienteFilterOptions = useMemo(() => {
      const map = new Map<string, string>();
      const source = [...diariasDoStatus, ...diariasDoStatusFull];
      source.forEach((diaria) => {
        const postoInfo =
          diaria.posto ||
          (diaria.posto_servico_id
            ? postoMap.get(diaria.posto_servico_id)
            : null);
        const clienteKey = getClienteKeyFromDiaria(diaria, postoInfo);
        const clienteNome = getClienteNomeFromDiaria(diaria, postoInfo);
        if (clienteKey && clienteNome) {
          map.set(clienteKey, clienteNome);
        }
      });
      return Array.from(map.entries())
        .map(([id, nome]) => ({ id, nome }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
    }, [diariasDoStatus, diariasDoStatusFull, postoMap]);

    const costCenterFilterOptions = useMemo(() => {
      const map = new Map<string, string>();
      const source = [...diariasDoStatus, ...diariasDoStatusFull];
      source.forEach((diaria) => {
        const postoInfo =
          diaria.posto ||
          (diaria.posto_servico_id
            ? postoMap.get(diaria.posto_servico_id)
            : null);
        const centroId = getCentroCustoIdFromDiaria(diaria, postoInfo);
        if (!centroId) return;
        const nome = costCenterMap.get(centroId) || centroId;
        map.set(centroId, nome);
      });
      return Array.from(map.entries())
        .map(([id, nome]) => ({ id, nome }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
    }, [diariasDoStatus, diariasDoStatusFull, postoMap, costCenterMap]);

    const diariasBase = useMemo(
      () =>
        filters.diariaId.trim() ||
        filters.startDate ||
        filters.endDate ||
        filters.okPagamentoPorId ||
        filters.statusDateStart ||
        filters.statusDateEnd
          ? diariasDoStatusFull
          : diariasDoStatus,
      [
        diariasDoStatus,
        diariasDoStatusFull,
        filters.diariaId,
        filters.endDate,
        filters.okPagamentoPorId,
        filters.startDate,
        filters.statusDateEnd,
        filters.statusDateStart,
      ]
    );

    useEffect(() => {
      const idsToFetch = new Set<string>();
      const collectId = (value?: string | null) => {
        if (value && !usuarioMap.get(value) && !extraUserMap.get(value)) {
          idsToFetch.add(value);
        }
      };
      diariasDoStatusFull.forEach((diaria) => {
        collectId(diaria.criado_por);
        collectId(diaria.confirmada_por);
        collectId(diaria.aprovada_por);
        collectId(diaria.lancada_por);
        collectId(diaria.ok_pagamento_por);
        collectId(diaria.paga_por);
        collectId(diaria.cancelada_por);
        collectId(diaria.reprovada_por);
      });
      if (idsToFetch.size === 0) return;

      const fetchMissing = async () => {
        const ids = Array.from(idsToFetch);
        try {
          const rpcResult = await supabase.rpc("get_profiles_names", {
            p_ids: ids,
          });
          const map = new Map(extraUserMap);
          if (!rpcResult.error && rpcResult.data) {
            rpcResult.data.forEach((u: any) => {
              if (u.id) {
                map.set(u.id, u.full_name || u.email || "-");
              }
            });
            setExtraUserMap(map);
            return;
          }
          if (
            rpcResult.error &&
            rpcResult.error.message &&
            rpcResult.error.message.toLowerCase().includes("function") &&
            rpcResult.error.message.toLowerCase().includes("does not exist")
          ) {
            // ignora se funcao nao existir
          } else if (rpcResult.error) {
            console.warn(
              "RPC get_profiles_names falhou, tentando select direto",
              rpcResult.error
            );
          }
        } catch (err) {
          console.warn(
            "RPC get_profiles_names falhou, tentando select direto",
            err
          );
        }

        try {
          const { data, error } = await supabase
            .from("usuarios")
            .select("id, full_name, email")
            .in("id", Array.from(idsToFetch));
          if (error) throw error;
          const map = new Map(extraUserMap);
          (data || []).forEach((u: any) => {
            if (u.id) {
              map.set(u.id, u.full_name || u.email || "-");
            }
          });
          setExtraUserMap(map);
        } catch (err) {
          console.error("Erro ao buscar usuarios faltantes", err);
        }
      };

      fetchMissing();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [diariasDoStatusFull, usuarioMap]);

    const diariasFiltradas = useMemo(() => {
      return diariasBase.filter((diaria) => {
        const diaristaId = diaria.diarista_id || "";
        const motivo = diaria.motivo_vago || "";
        const postoInfo =
          diaria.posto ||
          (diaria.posto_servico_id
            ? postoMap.get(diaria.posto_servico_id)
            : null);
        const clienteKey = getClienteKeyFromDiaria(diaria, postoInfo);
        const centroCustoKey = getCentroCustoIdFromDiaria(diaria, postoInfo);
        const data = diaria.data_diaria || "";
        const statusDateValue = statusDateConfig
          ? ((diaria as any)[statusDateConfig.field] as
              | string
              | null
              | undefined)
          : null;

        if (filters.startDate) {
          const dataDate = new Date(data);
          const start = new Date(filters.startDate);
          if (Number.isNaN(dataDate.getTime()) || dataDate < start)
            return false;
        }
        if (filters.endDate) {
          const dataDate = new Date(data);
          const end = new Date(filters.endDate);
          end.setHours(23, 59, 59, 999);
          if (Number.isNaN(dataDate.getTime()) || dataDate > end) return false;
        }

        if (
          statusDateConfig &&
          (filters.statusDateStart || filters.statusDateEnd)
        ) {
          const statusDateKey = getDateKeyFromValue(statusDateValue);
          if (!statusDateKey) return false;
          if (
            filters.statusDateStart &&
            statusDateKey < filters.statusDateStart
          )
            return false;
          if (filters.statusDateEnd && statusDateKey > filters.statusDateEnd)
            return false;
        }

        if (filters.diaristaId && filters.diaristaId !== diaristaId) {
          return false;
        }
        if (
          filters.diariaId.trim() &&
          filters.diariaId.trim() !== diaria.id.toString()
        ) {
          return false;
        }
        if (filters.motivo && filters.motivo !== motivo) {
          return false;
        }
        if (
          filters.criadoPorId &&
          filters.criadoPorId !== (diaria.criado_por || "")
        ) {
          return false;
        }
        if (filters.clienteId && filters.clienteId !== clienteKey) {
          return false;
        }
        if (filters.centroCustoId && filters.centroCustoId !== centroCustoKey) {
          return false;
        }
        if (filters.statusResponsavelId && statusResponsavelField) {
          const responsavelId = (diaria as any)[statusResponsavelField] || "";
          if (filters.statusResponsavelId !== responsavelId) {
            return false;
          }
        }
        if (isPagaPage && filters.okPagamentoPorId) {
          if (filters.okPagamentoPorId !== (diaria.ok_pagamento_por || "")) {
            return false;
          }
        }
        if (
          isAprovadaPage &&
          filters.okPagamento === "false" &&
          diaria.ok_pagamento !== false
        ) {
          return false;
        }
        return true;
      });
    }, [
      diariasBase,
      filters,
      isAprovadaPage,
      isPagaPage,
      statusDateConfig,
      statusResponsavelField,
    ]);

    const okPagamentoById = useMemo(() => {
      const map = new Map<string, boolean | null>();
      diariasFiltradas.forEach((diaria) => {
        map.set(diaria.id.toString(), diaria.ok_pagamento ?? null);
      });
      return map;
    }, [diariasFiltradas]);

    const diariasById = useMemo(() => {
      const map = new Map<string, DiariaTemporaria>();
      diariasFiltradas.forEach((diaria) => {
        map.set(diaria.id.toString(), diaria);
      });
      return map;
    }, [diariasFiltradas]);

    const lancadasAgrupadas = useMemo(() => {
      if (!isLancadaPage && !isAprovadaPage && !isPagaPage) return [];
      const groups = new Map<
        string,
        {
          key: string;
          diaristaId: string | null;
          diaristaNome: string;
          diaristaCpf: string | null;
          diaristaPix: string | null;
          totalValor: number;
          count: number;
          ids: Array<string | number>;
          pendingOkIds: Array<string | number>;
          clientes: Set<string>;
        }
      >();

      diariasFiltradas.forEach((diaria) => {
        const diaristaId = diaria.diarista_id || "";
        const postoInfo =
          diaria.posto ||
          (diaria.posto_servico_id
            ? postoMap.get(diaria.posto_servico_id)
            : null);
        const clienteNome =
          getClienteOuCentroCustoDisplay(diaria, postoInfo).value || "-";
        const diaristaKey = diaristaId || `no-diarista-${diaria.id}`;
        const diaristaInfo = diaristaId ? diaristaMap.get(diaristaId) : null;
        const diaristaCpfKey = diaristaInfo?.cpf
          ? stripNonDigits(diaristaInfo.cpf)
          : "";
        const key = `${diaristaKey}||${diaristaCpfKey}`;
        const group = groups.get(key) || {
          key,
          diaristaId: diaristaId || null,
          diaristaNome: diaristaInfo?.nome_completo || "-",
          diaristaCpf: diaristaInfo?.cpf ?? null,
          diaristaPix: diaristaInfo?.pix ?? null,
          totalValor: 0,
          count: 0,
          ids: [],
          pendingOkIds: [],
          clientes: new Set<string>(),
        };

        const valorDiaria =
          typeof diaria.valor_diaria === "number"
            ? diaria.valor_diaria
            : Number(diaria.valor_diaria) || 0;
        group.totalValor += valorDiaria;
        group.count += 1;
        group.ids.push(diaria.id);
        if (diaria.ok_pagamento !== true) {
          group.pendingOkIds.push(diaria.id);
        }
        group.clientes.add(clienteNome || "-");
        groups.set(key, group);
      });

      return Array.from(groups.values())
        .map((group) => {
          let clienteLabel = "-";
          if (group.clientes.size > 1) {
            clienteLabel = "Diversos";
          } else {
            clienteLabel = Array.from(group.clientes)[0] || "-";
          }
          return { ...group, clienteLabel };
        })
        .sort((a, b) => a.diaristaNome.localeCompare(b.diaristaNome));
    }, [
      diariasFiltradas,
      diaristaMap,
      clienteMap,
      postoMap,
      isLancadaPage,
      isAprovadaPage,
      isPagaPage,
    ]);

    const selectedGroup = useMemo(() => {
      if (!selectedGroupKey) return null;
      return (
        lancadasAgrupadas.find((group) => group.key === selectedGroupKey) ||
        null
      );
    }, [lancadasAgrupadas, selectedGroupKey]);

    const selectedGroupDiarias = useMemo(() => {
      if (!selectedGroup) return [];
      const ids = new Set(selectedGroup.ids.map((id) => id.toString()));
      return diariasFiltradas
        .filter((diaria) => ids.has(diaria.id.toString()))
        .sort((a, b) =>
          (a.data_diaria || "").localeCompare(b.data_diaria || "")
        );
    }, [selectedGroup, diariasFiltradas]);

    const selectedGroupDiaristaInfo = selectedGroup?.diaristaId
      ? diaristaMap.get(selectedGroup.diaristaId)
      : null;

    const naoOkDiaristaNome = useMemo(() => {
      if (!naoOkTarget) return "-";
      if (naoOkTarget.type === "single") {
        return (
          diaristaMap.get(naoOkTarget.diaria.diarista_id)?.nome_completo || "-"
        );
      }
      return naoOkTarget.diaristaNome || "-";
    }, [naoOkTarget, diaristaMap]);

    const groupObservacaoPagamento = useMemo(() => {
      if (selectedGroupDiarias.length === 0) return null;
      const firstKey = getObservacaoPagamentoKey(
        selectedGroupDiarias[0]?.observacao_pagamento
      );
      const allEqual = selectedGroupDiarias.every(
        (diaria) =>
          getObservacaoPagamentoKey(diaria.observacao_pagamento) === firstKey
      );
      if (!allEqual || !firstKey) return null;
      return formatObservacaoPagamento(
        selectedGroupDiarias[0]?.observacao_pagamento
      );
    }, [selectedGroupDiarias]);

    const groupOutrosMotivos = useMemo(() => {
      if (selectedGroupDiarias.length === 0) return null;
      const first = toTrimOrNull(
        selectedGroupDiarias[0]?.outros_motivos_reprovacao_pagamento
      );
      const allEqual = selectedGroupDiarias.every(
        (diaria) =>
          toTrimOrNull(diaria.outros_motivos_reprovacao_pagamento) === first
      );
      return allEqual ? first : null;
    }, [selectedGroupDiarias]);

    const buildExportRow = (diaria: DiariaTemporaria) => {
      const postoInfo =
        diaria.posto ||
        (diaria.posto_servico_id
          ? postoMap.get(diaria.posto_servico_id)
          : null);
      const diaristaInfo =
        diaria.diarista || diaristaMap.get(diaria.diarista_id || "");
      const clienteNome =
        getClienteOuCentroCustoDisplay(diaria, postoInfo).value || "-";
      const unidadeNome =
        toTrimOrNull(diaria.unidade) || postoInfo?.unidade?.nome || "-";
      const criadoPorNome = getUsuarioNome(diaria.criado_por);
      const { id: responsavelStatusId } = getStatusResponsavel(diaria);
      const responsavelStatusNome = responsavelStatusId
        ? getUsuarioNome(responsavelStatusId)
        : "";
      const confirmadaPorNome = getUsuarioNome(diaria.confirmada_por);
      const lancadaPorNome = getUsuarioNome(diaria.lancada_por);
      const okPagamentoPorNome = getUsuarioNome(diaria.ok_pagamento_por);
      const pagaPorNome = getUsuarioNome(diaria.paga_por);
      const colaboradorNome = getColaboradorAusenteDisplay(diaria);
      const colaboradorDemitidoNome = getColaboradorDemitidoDisplay(diaria);
      const novoPostoFlag = diaria.novo_posto === true;
      const isMotivoVagaEmAberto = isVagaEmAberto(diaria.motivo_vago);
      const postoNome = diaria.posto_servico?.trim() || postoInfo?.nome || "-";
      const baseRow: Record<string, any> = {
        ID: diaria.id,
        Data: formatDate(diaria.data_diaria),
        Status: STATUS_LABELS[diaria.status] || diaria.status,
        "Horario inicio": formatTimeValue(diaria.horario_inicio),
        "Horario fim": formatTimeValue(diaria.horario_fim),
        "Jornada diaria (h)": formatJornadaValue(getJornadaDiariaValue(diaria)),
        "Intervalo (min)": formatIntervalValue(diaria.intervalo),
        "Motivo (dia vago)": diaria.motivo_vago || "-",
        "Demissao?": isMotivoVagaEmAberto
          ? formatBooleanFlag(diaria.demissao === true)
          : "-",
        "Novo posto?": isMotivoVagaEmAberto
          ? novoPostoFlag
            ? "Sim"
            : "Nao"
          : "-",
        "CPF diarista": formatCpf(diaristaInfo?.cpf) || "-",
        Posto: postoNome,
        Unidade: unidadeNome,
        Cliente: clienteNome,
        Diarista: diaristaInfo?.nome_completo || "-",
        "Status diarista": diaristaInfo?.status || "-",
        "Valor (R$)": diaria.valor_diaria || 0,
        "Atualizado em": formatDateTime(diaria.updated_at),
        "Motivo reprovacao": diaria.motivo_reprovacao || "",
        "Motivo cancelamento": diaria.motivo_cancelamento || "",
        Banco: diaristaInfo?.banco || "-",
        Agencia: diaristaInfo?.agencia || "-",
        "Numero da conta": diaristaInfo?.numero_conta || "-",
        "Tipo de conta": diaristaInfo?.tipo_conta || "-",
        Pix: diaristaInfo?.pix || "-",
        "Pix pertence diarista": formatPixPertence(
          diaristaInfo?.pix_pertence_beneficiario
        ),
        Observacao: diaria.observacao?.trim() || "",
        "Criado por": criadoPorNome,
        "Criada em": formatDate(diaria.created_at),
      };
      baseRow["Confirmada em"] = formatDateTime(diaria.confirmada_em);
      if (isPagaPage) {
        baseRow["OK pagamento em"] = formatDateTime(diaria.ok_pagamento_em);
      } else {
        baseRow["Aprovada em"] = formatDateTime(diaria.aprovada_em);
      }
      baseRow["Lancada em"] = formatDateTime(diaria.lancada_em);
      baseRow["Paga em"] = formatDateTime(diaria.paga_em);
      baseRow["Cancelada em"] = formatDateTime(diaria.cancelada_em);
      baseRow["Reprovada em"] = formatDateTime(diaria.reprovada_em);
      baseRow["OK pagamento?"] =
        diaria.ok_pagamento === true
          ? "Sim"
          : diaria.ok_pagamento === false
          ? "Nao"
          : "-";
      baseRow["Observacao pagamento"] = formatObservacaoPagamento(
        diaria.observacao_pagamento
      );
      baseRow["Outros motivos reprovacao pagamento"] =
        diaria.outros_motivos_reprovacao_pagamento || "";
      if (!isAguardandoPage) {
        baseRow[responsavelStatusHeader] = responsavelStatusNome || "";
      }
      if (isPagaPage) {
        baseRow["Confirmada por"] = confirmadaPorNome;
        baseRow["OK pagamento por"] = okPagamentoPorNome;
        baseRow["Lancada por"] = lancadaPorNome;
        baseRow["Paga por"] = pagaPorNome;
      }

      if (isMotivoVagaEmAberto) {
        if (diaria.demissao === true && colaboradorDemitidoNome) {
          baseRow["Colaborador demitido"] = colaboradorDemitidoNome;
        }
      } else {
        baseRow["Colaborador ausente"] = colaboradorNome;
      }

      return baseRow;
    };

    const handleExportXlsx = () => {
      if (diariasFiltradas.length === 0) {
        toast.info("Nenhuma diaria para exportar.");
        return;
      }
      const rows = uppercaseRows(diariasFiltradas.map(buildExportRow));
      const sheet = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheet, "Diarias");
      const fileName = `diarias-temp-${normalizeStatus(
        statusKey
      )}-${Date.now()}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success("Arquivo XLSX gerado.");
    };

    const handleExportGroupedXlsx = () => {
      if (lancadasAgrupadas.length === 0) {
        toast.info("Nenhuma diaria agrupada para exportar.");
        return;
      }
      const pagamentoStatus = isLancadaPage
        ? "LANCADO"
        : isPagaPage
        ? "PAGO"
        : isAprovadaPage
        ? "APROVADO"
        : "";
      const rows = lancadasAgrupadas.map((group) => {
        const groupDiarias = group.ids
          .map((id) => diariasById.get(id.toString()))
          .filter((item): item is DiariaTemporaria => Boolean(item));
        const sortedGroupDiarias = [...groupDiarias].sort((a, b) =>
          (a.data_diaria || "").localeCompare(b.data_diaria || "")
        );
        const groupIdsLabel = sortedGroupDiarias
          .map((diaria) => diaria.id)
          .join(", ");
        const beneficiario = group.diaristaNome;
        const aprovacao =
          groupDiarias.length > 0 &&
          groupDiarias.every((diaria) => diaria.ok_pagamento === true)
            ? "OK"
            : "";
        const competenciaSet = new Set(
          groupDiarias
            .map((diaria) => formatCompetencia(diaria.data_diaria))
            .filter(Boolean)
        );
        const competencia =
          competenciaSet.size === 0
            ? ""
            : competenciaSet.size === 1
            ? Array.from(competenciaSet)[0]
            : "DIVERSOS";
        const descricao = sortedGroupDiarias
          .map((diaria) => {
            const postoInfo =
              diaria.posto ||
              (diaria.posto_servico_id
                ? postoMap.get(diaria.posto_servico_id)
                : null);
            const clienteNome =
              getClienteOuCentroCustoDisplay(diaria, postoInfo).value || "-";
            const base = `Diaria ${diaria.motivo_vago || ""} ${formatDate(
              diaria.data_diaria
            )}`;
            return group.clienteLabel === "Diversos"
              ? `${base} (${clienteNome})`
              : base;
          })
          .join(" - ");
        const baseRow: Record<string, string> = {
          "IDs diarias": groupIdsLabel,
          Beneficiario: beneficiario,
          "CPF diarista": formatCpf(group.diaristaCpf) || "-",
          Valor: currencyFormatter.format(group.totalValor),
          Aprovacao: aprovacao,
          Banco: "ITAU",
          Descricao: descricao,
          Cliente: group.clienteLabel,
          Competencia: competencia,
        };
        if (!isAprovadaPage) {
          baseRow.Pagamento = pagamentoStatus;
        }
        return baseRow;
      });
      const sheet = XLSX.utils.json_to_sheet(uppercaseRows(rows));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheet, "Diarias agrupadas");
      const fileName = `diarias-temp-agrupadas-${normalizeStatus(
        statusKey
      )}-${Date.now()}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success("Arquivo XLSX agrupado gerado.");
    };

    const hasActiveFilters = useMemo(
      () => Object.values(filters).some(Boolean),
      [filters]
    );

    const periodoTotal = useMemo(() => {
      if (!totalRangePeriodo.startDate || !totalRangePeriodo.endDate) {
        return null;
      }
      const start = new Date(totalRangePeriodo.startDate);
      const end = new Date(totalRangePeriodo.endDate);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
        return null;
      end.setHours(23, 59, 59, 999);
      if (start > end) return 0;

      return diariasDoStatusFull.reduce((acc, diaria) => {
        const dataStr = diaria.data_diaria;
        if (!dataStr) return acc;
        const diariaDate = new Date(dataStr);
        if (Number.isNaN(diariaDate.getTime())) return acc;
        if (diariaDate < start || diariaDate > end) return acc;

        const valorDiaria =
          typeof diaria.valor_diaria === "number"
            ? diaria.valor_diaria
            : Number(diaria.valor_diaria) || 0;
        return acc + valorDiaria;
      }, 0);
    }, [diariasDoStatusFull, totalRangePeriodo]);

    const diaristaTotal = useMemo(() => {
      if (
        !totalRangeDiarista.diaristaId ||
        !totalRangeDiarista.startDate ||
        !totalRangeDiarista.endDate
      ) {
        return null;
      }

      const start = new Date(totalRangeDiarista.startDate);
      const end = new Date(totalRangeDiarista.endDate);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
        return null;
      end.setHours(23, 59, 59, 999);

      if (start > end) return 0;

      return diariasDoStatusFull.reduce((acc, diaria) => {
        const diaristaId = diaria.diarista_id || "";
        if (diaristaId !== totalRangeDiarista.diaristaId) return acc;

        const dataStr = diaria.data_diaria;
        if (!dataStr) return acc;
        const diariaDate = new Date(dataStr);
        if (Number.isNaN(diariaDate.getTime())) return acc;
        if (diariaDate < start || diariaDate > end) return acc;

        const valorDiaria =
          typeof diaria.valor_diaria === "number"
            ? diaria.valor_diaria
            : Number(diaria.valor_diaria) || 0;
        return acc + valorDiaria;
      }, 0);
    }, [diariasDoStatusFull, totalRangeDiarista]);

    const diaristaTotalAll = useMemo(() => {
      if (!totalRangeDiaristaAll.diaristaId) return null;
      return diariasDoStatusFull.reduce((acc, diaria) => {
        const diaristaId = diaria.diarista_id || "";
        if (diaristaId !== totalRangeDiaristaAll.diaristaId) return acc;
        const valorDiaria =
          typeof diaria.valor_diaria === "number"
            ? diaria.valor_diaria
            : Number(diaria.valor_diaria) || 0;
        return acc + valorDiaria;
      }, 0);
    }, [diariasDoStatusFull, totalRangeDiaristaAll]);

    const diaristaClienteTotal = useMemo(() => {
      if (
        !totalRangeCliente.diaristaId ||
        !totalRangeCliente.clienteId ||
        !totalRangeCliente.startDate ||
        !totalRangeCliente.endDate
      ) {
        return null;
      }

      const start = new Date(totalRangeCliente.startDate);
      const end = new Date(totalRangeCliente.endDate);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
        return null;
      end.setHours(23, 59, 59, 999);

      if (start > end) return 0;

      return diariasDoStatusFull.reduce((acc, diaria) => {
        const diaristaId = diaria.diarista_id || "";
        if (diaristaId !== totalRangeCliente.diaristaId) return acc;

        const dataStr = diaria.data_diaria;
        if (!dataStr) return acc;
        const diariaDate = new Date(dataStr);
        if (Number.isNaN(diariaDate.getTime())) return acc;
        if (diariaDate < start || diariaDate > end) return acc;

        const postoInfo =
          diaria.posto ||
          (diaria.posto_servico_id
            ? postoMap.get(diaria.posto_servico_id)
            : null);
        const clienteKey = getClienteKeyFromDiaria(diaria, postoInfo);
        if (!clienteKey || clienteKey !== totalRangeCliente.clienteId)
          return acc;

        const valorDiaria =
          typeof diaria.valor_diaria === "number"
            ? diaria.valor_diaria
            : Number(diaria.valor_diaria) || 0;
        return acc + valorDiaria;
      }, 0);
    }, [diariasDoStatusFull, totalRangeCliente, postoMap]);

    const clienteTotal = useMemo(() => {
      if (
        !totalRangeClienteOnly.clienteId ||
        !totalRangeClienteOnly.startDate ||
        !totalRangeClienteOnly.endDate
      ) {
        return null;
      }
      const start = new Date(totalRangeClienteOnly.startDate);
      const end = new Date(totalRangeClienteOnly.endDate);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
        return null;
      end.setHours(23, 59, 59, 999);
      if (start > end) return 0;

      return diariasDoStatusFull.reduce((acc, diaria) => {
        const postoInfo =
          diaria.posto ||
          (diaria.posto_servico_id
            ? postoMap.get(diaria.posto_servico_id)
            : null);
        const clienteKey = getClienteKeyFromDiaria(diaria, postoInfo);
        if (!clienteKey || clienteKey !== totalRangeClienteOnly.clienteId)
          return acc;

        const dataStr = diaria.data_diaria;
        if (!dataStr) return acc;
        const diariaDate = new Date(dataStr);
        if (Number.isNaN(diariaDate.getTime())) return acc;
        if (diariaDate < start || diariaDate > end) return acc;

        const valorDiaria =
          typeof diaria.valor_diaria === "number"
            ? diaria.valor_diaria
            : Number(diaria.valor_diaria) || 0;
        return acc + valorDiaria;
      }, 0);
    }, [diariasDoStatusFull, postoMap, totalRangeClienteOnly]);

    const filterDiariasClienteOnly = (
      clienteId: string,
      start: string,
      end: string
    ) => {
      const startDate = new Date(start);
      const endDate = new Date(end);
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()))
        return [];
      endDate.setHours(23, 59, 59, 999);
      return diariasDoStatusFull.filter((diaria) => {
        const postoInfo =
          diaria.posto ||
          (diaria.posto_servico_id
            ? postoMap.get(diaria.posto_servico_id)
            : null);
        const clienteKey = getClienteKeyFromDiaria(diaria, postoInfo);
        if (!clienteKey || clienteKey !== clienteId) return false;

        const dataStr = diaria.data_diaria;
        if (!dataStr) return false;
        const data = new Date(dataStr);
        if (Number.isNaN(data.getTime())) return false;
        return data >= startDate && data <= endDate;
      });
    };

    const filterDiariasParaTotal = (
      diaristaId: string,
      start: string,
      end: string,
      clienteId?: string
    ) => {
      const startDate = new Date(start);
      const endDate = new Date(end);
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()))
        return [];
      endDate.setHours(23, 59, 59, 999);
      return diariasDoStatusFull.filter((diaria) => {
        if (diaria.diarista_id !== diaristaId) return false;
        const dataStr = diaria.data_diaria;
        if (!dataStr) return false;
        const data = new Date(dataStr);
        if (Number.isNaN(data.getTime())) return false;
        if (data < startDate || data > endDate) return false;
        if (clienteId) {
          const postoInfo =
            diaria.posto ||
            (diaria.posto_servico_id
              ? postoMap.get(diaria.posto_servico_id)
              : null);
          const clienteKey = getClienteKeyFromDiaria(diaria, postoInfo);
          if (clienteKey !== clienteId) return false;
        }
        return true;
      });
    };

    const filterDiariasParaTotalSemData = (diaristaId: string) =>
      diariasDoStatusFull.filter((diaria) => diaria.diarista_id === diaristaId);

    const exportTotal = (opts: {
      diaristaId: string;
      diaristaNome: string;
      start: string;
      end: string;
      clienteId?: string;
      clienteNome?: string;
      total: number | null;
    }) => {
      const {
        diaristaId,
        diaristaNome,
        start,
        end,
        clienteId,
        clienteNome,
        total,
      } = opts;
      if (!diaristaId || !start || !end || total === null) {
        toast.error("Preencha diarista e intervalo para exportar.");
        return;
      }
      const diariasSelecionadas = filterDiariasParaTotal(
        diaristaId,
        start,
        end,
        clienteId
      );
      if (diariasSelecionadas.length === 0) {
        toast.info("Nenhuma diaria no intervalo para exportar.");
        return;
      }

      const postos = new Set<string>();
      const unidades = new Set<string>();
      const clientes = new Set<string>();
      const statuses = new Set<string>();

      diariasSelecionadas.forEach((diaria) => {
        const postoInfo =
          diaria.posto ||
          (diaria.posto_servico_id
            ? postoMap.get(diaria.posto_servico_id)
            : null);
        const unidadeNome =
          toTrimOrNull(diaria.unidade) || postoInfo?.unidade?.nome || "";
        if (diaria.posto_servico) postos.add(diaria.posto_servico);
        if (postoInfo?.nome) postos.add(postoInfo.nome);
        if (unidadeNome) unidades.add(unidadeNome);
        const contratoInfo = getContratoInfoFromPosto(postoInfo);
        const clienteNomeDiaria =
          (typeof diaria.cliente_id === "number" &&
            clienteMap.get(diaria.cliente_id)) ||
          contratoInfo?.clienteNome ||
          "";
        if (clienteNomeDiaria) clientes.add(clienteNomeDiaria);
        if (contratoInfo?.clienteNome) clientes.add(contratoInfo.clienteNome);
        statuses.add(STATUS_LABELS[diaria.status] || diaria.status);
      });

      const tituloBase = clienteNome
        ? `Valor a receber de ${diaristaNome} entre os dias ${start} e ${end} do cliente ${clienteNome}`
        : `Valor a receber de ${diaristaNome} entre os dias ${start} e ${end}`;

      const diaristaInfo = diaristaMap.get(diaristaId || "");

      const rows = uppercaseRows([
        {
          Titulo: tituloBase,
          Diarista: diaristaNome || "-",
          "CPF diarista": formatCpf(diaristaInfo?.cpf) || "-",
          Banco: diaristaInfo?.banco || "-",
          Agencia: diaristaInfo?.agencia || "-",
          "Numero da conta": diaristaInfo?.numero_conta || "-",
          "Tipo de conta": diaristaInfo?.tipo_conta || "-",
          Pix: diaristaInfo?.pix || "-",
          "Pix pertence diarista": formatPixPertence(
            diaristaInfo?.pix_pertence_beneficiario
          ),
          "Data inicial": start,
          "Data final": end,
          Status: Array.from(statuses).join(", ") || "-",
          Cliente: clienteNome || Array.from(clientes).join(", ") || "-",
          Posto: Array.from(postos).join(", ") || "-",
          Unidade: Array.from(unidades).join(", ") || "-",
          "Valor total (R$)": total ?? 0,
        },
      ]);

      const sheet = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheet, "Total");
      const fileName = clienteNome
        ? `total-temp-diarista-cliente-${normalizeStatus(
            statusKey
          )}-${Date.now()}.xlsx`
        : `total-temp-diarista-${normalizeStatus(
            statusKey
          )}-${Date.now()}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success("Planilha de total gerada.");
    };

    const exportTotalSemData = (opts: {
      diaristaId: string;
      diaristaNome: string;
      total: number | null;
    }) => {
      const { diaristaId, diaristaNome, total } = opts;
      if (!diaristaId || total === null) {
        toast.error("Selecione o diarista para exportar.");
        return;
      }
      const diariasSelecionadas = filterDiariasParaTotalSemData(diaristaId);
      if (diariasSelecionadas.length === 0) {
        toast.info("Nenhuma diaria encontrada para exportar.");
        return;
      }

      const postos = new Set<string>();
      const unidades = new Set<string>();
      const clientes = new Set<string>();
      const statuses = new Set<string>();

      diariasSelecionadas.forEach((diaria) => {
        const postoInfo =
          diaria.posto ||
          (diaria.posto_servico_id
            ? postoMap.get(diaria.posto_servico_id)
            : null);
        const unidadeNome =
          toTrimOrNull(diaria.unidade) || postoInfo?.unidade?.nome || "";
        if (diaria.posto_servico) postos.add(diaria.posto_servico);
        if (postoInfo?.nome) postos.add(postoInfo.nome);
        if (unidadeNome) unidades.add(unidadeNome);
        const contratoInfo = getContratoInfoFromPosto(postoInfo);
        const clienteNomeDiaria =
          (typeof diaria.cliente_id === "number" &&
            clienteMap.get(diaria.cliente_id)) ||
          contratoInfo?.clienteNome ||
          "";
        if (clienteNomeDiaria) clientes.add(clienteNomeDiaria);
        if (contratoInfo?.clienteNome) clientes.add(contratoInfo.clienteNome);
        statuses.add(STATUS_LABELS[diaria.status] || diaria.status);
      });

      const diaristaInfo = diaristaMap.get(diaristaId || "");
      const tituloBase = `Valor a receber de ${diaristaNome} (todas as diarias do status ${
        STATUS_LABELS[statusKey] || statusKey
      })`;

      const rows = uppercaseRows([
        {
          Titulo: tituloBase,
          Diarista: diaristaNome || "-",
          "CPF diarista": formatCpf(diaristaInfo?.cpf) || "-",
          Banco: diaristaInfo?.banco || "-",
          Agencia: diaristaInfo?.agencia || "-",
          "Numero da conta": diaristaInfo?.numero_conta || "-",
          "Tipo de conta": diaristaInfo?.tipo_conta || "-",
          Pix: diaristaInfo?.pix || "-",
          "Pix pertence diarista": formatPixPertence(
            diaristaInfo?.pix_pertence_beneficiario
          ),
          Status: Array.from(statuses).join(", ") || "-",
          Cliente: Array.from(clientes).join(", ") || "-",
          Posto: Array.from(postos).join(", ") || "-",
          Unidade: Array.from(unidades).join(", ") || "-",
          "Valor total (R$)": total ?? 0,
        },
      ]);

      const sheet = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheet, "Total");
      const fileName = `total-temp-diarista-${normalizeStatus(
        statusKey
      )}-${Date.now()}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success("Planilha de total gerada.");
    };

    const exportClienteTotal = () => {
      const { clienteId, startDate, endDate } = totalRangeClienteOnly;
      if (!clienteId || !startDate || !endDate || clienteTotal === null) {
        toast.error("Preencha cliente e intervalo para exportar.");
        return;
      }
      const selecionadas = filterDiariasClienteOnly(
        clienteId,
        startDate,
        endDate
      );
      if (selecionadas.length === 0) {
        toast.info("Nenhuma diaria no intervalo para exportar.");
        return;
      }
      const cpfs = new Set<string>();
      const statuses = new Set<string>();
      const unidades = new Set<string>();
      selecionadas.forEach((diaria) => {
        const diaristaInfo =
          diaria.diarista || diaristaMap.get(diaria.diarista_id || "");
        if (diaristaInfo?.cpf) cpfs.add(formatCpf(diaristaInfo.cpf));
        statuses.add(STATUS_LABELS[diaria.status] || diaria.status);
        const postoInfo =
          diaria.posto ||
          (diaria.posto_servico_id
            ? postoMap.get(diaria.posto_servico_id)
            : null);
        const unidadeNome =
          toTrimOrNull(diaria.unidade) || postoInfo?.unidade?.nome || "";
        if (unidadeNome) unidades.add(unidadeNome);
      });
      const clienteNome =
        clienteFilterOptions.find((c) => c.id === clienteId)?.nome || "";
      const titulo = `Valor a receber do cliente ${
        clienteNome || "(sem nome)"
      } entre ${startDate} e ${endDate}`;
      const rows = uppercaseRows([
        {
          Titulo: titulo,
          Cliente: clienteNome || "-",
          "CPFs diaristas": Array.from(cpfs).join(", ") || "-",
          "Status das diarias": Array.from(statuses).join(", ") || "-",
          Unidade: Array.from(unidades).join(", ") || "-",
          "Data inicial": startDate,
          "Data final": endDate,
          "Valor total (R$)": clienteTotal ?? 0,
        },
      ]);
      const sheet = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheet, "Total Cliente");
      const fileName = `total-temp-cliente-${normalizeStatus(
        statusKey
      )}-${Date.now()}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success("Planilha do cliente gerada.");
    };

    const handleClearFilters = () =>
      setFilters({
        diariaId: "",
        diaristaId: "",
        motivo: "",
        clienteId: "",
        centroCustoId: "",
        startDate: "",
        endDate: "",
        criadoPorId: "",
        statusResponsavelId: "",
        okPagamentoPorId: "",
        statusDateStart: "",
        statusDateEnd: "",
        okPagamento: "",
      });

    const requiresReasonForStatus = (status: string) => {
      const normalized = normalizeStatus(status);
      return (
        normalized === normalizeStatus(STATUS.cancelada) ||
        normalized === normalizeStatus(STATUS.reprovada)
      );
    };

    const getConfirmationMessage = (status: string) => {
      const normalized = normalizeStatus(status);
      if (normalized === normalizeStatus(STATUS.confirmada)) {
        return "Deseja confirmar esta diaria?";
      }
      if (normalized === normalizeStatus(STATUS.aprovada)) {
        return "Deseja aprovar esta diaria?";
      }
      if (normalized === normalizeStatus(STATUS.lancada)) {
        return "Deseja lancar esta diaria para pagamento?";
      }
      if (normalized === normalizeStatus(STATUS.reprovada)) {
        return "Deseja reprovar esta diaria?";
      }
      if (normalized === normalizeStatus(STATUS.cancelada)) {
        return "Deseja cancelar esta diaria?";
      }
      return `Deseja alterar o status para ${STATUS_LABELS[status] || status}?`;
    };

    const confirmStatusChange = (status: string) => {
      if (typeof window === "undefined") return true;
      return window.confirm(getConfirmationMessage(status));
    };

    const handleDeleteDiaria = async (id: string) => {
      if (typeof window !== "undefined") {
        const statusLabelDelete = isCancelPage
          ? "cancelada"
          : isReprovadaPage
          ? "reprovada"
          : "selecionada";
        const confirmed = window.confirm(
          `Deseja excluir esta diaria ${statusLabelDelete}?`
        );
        if (!confirmed) return;
      }
      setDeletingId(id);
      try {
        const { error } = await supabase
          .from("diarias_temporarias")
          .delete()
          .eq("id", id);
        if (error) throw error;
        toast.success("Diaria excluida.");
        await refetchDiarias();
      } catch (error: any) {
        toast.error(error.message || "Erro ao excluir a diaria.");
      } finally {
        setDeletingId(null);
      }
    };

    const handleUpdateStatus = async (
      id: string,
      nextStatus: string,
      extraFields: Record<string, unknown> = {}
    ) => {
      setUpdatingId(id);
      try {
        const { error } = await supabase
          .from("diarias_temporarias")
          .update({ status: nextStatus, ...extraFields })
          .eq("id", id);
        if (error) throw error;
        toast.success(`Status atualizado para ${STATUS_LABELS[nextStatus]}.`);
        await refetchDiarias();
      } catch (error: any) {
        toast.error(error.message || "Erro ao atualizar status da diaria.");
      } finally {
        setUpdatingId(null);
      }
    };

    const handleOkPagamento = async (id: string) => {
      if (typeof window !== "undefined") {
        const confirmed = window.confirm(
          "Marcar OK de pagamento para esta diaria?"
        );
        if (!confirmed) return;
      }
      setUpdatingId(id);
      try {
        const { error } = await supabase
          .from("diarias_temporarias")
          .update({ ok_pagamento: true, status: STATUS.paga })
          .eq("id", id);
        if (error) throw error;
        toast.success("OK de pagamento registrado.");
        await refetchDiarias();
      } catch (error: any) {
        toast.error(error.message || "Erro ao registrar OK de pagamento.");
      } finally {
        setUpdatingId(null);
      }
    };

    const openNaoOkDialog = (diaria: DiariaTemporaria) => {
      setNaoOkTarget({ type: "single", diaria });
      setNaoOkObservacao(
        normalizeObservacaoPagamento(diaria.observacao_pagamento)
      );
      setNaoOkOutroMotivo(
        toTrimOrNull(diaria.outros_motivos_reprovacao_pagamento) || ""
      );
      setNaoOkWantsOutroMotivo(null);
      setNaoOkDialogOpen(true);
    };

    const openNaoOkGroupDialog = (group: {
      key: string;
      ids: Array<string | number>;
      diaristaId: string | null;
      diaristaNome: string;
      count: number;
      totalValor: number;
    }) => {
      const groupIds = new Set(group.ids.map((id) => id.toString()));
      const groupDiarias = diariasFiltradas.filter((diaria) =>
        groupIds.has(diaria.id.toString())
      );
      const firstKey = getObservacaoPagamentoKey(
        groupDiarias[0]?.observacao_pagamento
      );
      const allEqual = groupDiarias.every(
        (diaria) =>
          getObservacaoPagamentoKey(diaria.observacao_pagamento) === firstKey
      );
      const firstOutroMotivo = toTrimOrNull(
        groupDiarias[0]?.outros_motivos_reprovacao_pagamento
      );
      const allEqualOutroMotivo = groupDiarias.every(
        (diaria) =>
          toTrimOrNull(diaria.outros_motivos_reprovacao_pagamento) ===
          firstOutroMotivo
      );
      const initialObservacoes =
        allEqual && firstKey
          ? normalizeObservacaoPagamento(groupDiarias[0]?.observacao_pagamento)
          : [];
      const initialOutroMotivo = allEqualOutroMotivo
        ? firstOutroMotivo || ""
        : "";
      setNaoOkTarget({
        type: "group",
        key: group.key,
        ids: group.ids,
        diaristaId: group.diaristaId,
        diaristaNome: group.diaristaNome,
        count: group.count,
        totalValor: group.totalValor,
      });
      setNaoOkObservacao(initialObservacoes);
      setNaoOkOutroMotivo(initialOutroMotivo);
      setNaoOkWantsOutroMotivo(null);
      setNaoOkDialogOpen(true);
    };

    const closeNaoOkDialog = () => {
      setNaoOkDialogOpen(false);
      setNaoOkTarget(null);
      setNaoOkObservacao([]);
      setNaoOkOutroMotivo("");
      setNaoOkWantsOutroMotivo(null);
    };

    const handleNaoOkPagamento = async (withOutroMotivo: boolean) => {
      if (!naoOkTarget) return;
      if (naoOkObservacao.length === 0) {
        toast.error(
          "Selecione ao menos um motivo para a reprovacao do pagamento."
        );
        return;
      }
      const outroMotivoValue = withOutroMotivo
        ? toTrimOrNull(naoOkOutroMotivo)
        : null;
      const targetIds =
        naoOkTarget.type === "single"
          ? [naoOkTarget.diaria.id]
          : naoOkTarget.ids;
      if (targetIds.length === 0) {
        toast.error("Nenhuma diaria encontrada para atualizar.");
        return;
      }
      setNaoOkSaving(true);
      try {
        const updatePayload: Record<string, unknown> = {
          ok_pagamento: false,
          status: STATUS.aprovada,
          observacao_pagamento:
            naoOkObservacao.length > 0 ? naoOkObservacao : null,
        };
        if (withOutroMotivo) {
          updatePayload.outros_motivos_reprovacao_pagamento = outroMotivoValue;
        }
        const { error } = await supabase
          .from("diarias_temporarias")
          .update(updatePayload)
          .in("id", targetIds);
        if (error) throw error;
        toast.success("Reprovacao de pagamento registrada.");
        await refetchDiarias();
        closeNaoOkDialog();
      } catch (error: any) {
        toast.error(
          error.message || "Erro ao registrar reprovacao do pagamento."
        );
      } finally {
        setNaoOkSaving(false);
      }
    };

    const toggleNaoOkObservacao = (value: string) => {
      setNaoOkObservacao((prev) =>
        prev.includes(value)
          ? prev.filter((item) => item !== value)
          : [...prev, value]
      );
      setNaoOkWantsOutroMotivo(null);
      setNaoOkOutroMotivo("");
    };

    const handleGroupedOkPagamento = async (group: {
      key: string;
      diaristaNome: string;
      pendingOkIds: Array<string | number>;
    }) => {
      if (group.pendingOkIds.length === 0) {
        toast.info("Todas as diarias deste grupo ja estao com OK.");
        return;
      }
      const message = `Marcar OK de pagamento para ${group.pendingOkIds.length} diaria(s) de ${group.diaristaNome}?`;
      if (typeof window !== "undefined" && !window.confirm(message)) return;

      setGroupOkSavingKey(group.key);
      try {
        const { error } = await supabase
          .from("diarias_temporarias")
          .update({ ok_pagamento: true, status: STATUS.paga })
          .in("id", group.pendingOkIds);
        if (error) throw error;
        toast.success("OK de pagamento registrado para o grupo.");
        await refetchDiarias();
      } catch (error: any) {
        toast.error(
          error.message || "Erro ao registrar OK de pagamento em massa."
        );
      } finally {
        setGroupOkSavingKey(null);
      }
    };

    const handleGroupedLancarPagamento = async (group: {
      key: string;
      diaristaNome: string;
      ids: Array<string | number>;
    }) => {
      if (group.ids.length === 0) {
        toast.info("Nenhuma diaria para lancar.");
        return;
      }
      const message = `Deseja lancar ${group.ids.length} diaria(s) para pagamento de ${group.diaristaNome}?`;
      if (typeof window !== "undefined" && !window.confirm(message)) return;

      setGroupLancarSavingKey(group.key);
      try {
        const { error } = await supabase
          .from("diarias_temporarias")
          .update({ status: STATUS.lancada })
          .in("id", group.ids);
        if (error) throw error;
        toast.success("Diarias lancadas para pagamento.");
        await refetchDiarias();
      } catch (error: any) {
        toast.error(error.message || "Erro ao lancar diarias para pagamento.");
      } finally {
        setGroupLancarSavingKey(null);
      }
    };

    const openReasonDialog = (id: string, status: string) => {
      setReasonDialog({ open: true, diariaId: id, targetStatus: status });
      setReasonText("");
      setMotivoReprovacao("");
      setMotivoReprovacaoObservacao("");
    };

    const closeReasonDialog = () => {
      setReasonDialog({ open: false, diariaId: null, targetStatus: null });
      setReasonText("");
      setMotivoReprovacao("");
      setMotivoReprovacaoObservacao("");
    };

    const handleReasonSubmit = async () => {
      if (!reasonDialog.diariaId || !reasonDialog.targetStatus) return;
      const normalizedStatus = normalizeStatus(reasonDialog.targetStatus);
      const isReprovada = normalizedStatus === normalizedReprovadaStatus;
      const useEnumMotivoReprovacao = isConfirmadaPage && isReprovada;
      let extra: Record<string, unknown>;
      if (useEnumMotivoReprovacao) {
        if (!motivoReprovacao) {
          toast.error("Selecione o motivo da reprovacao.");
          return;
        }
        const observacaoValue = toTrimOrNull(motivoReprovacaoObservacao);
        extra = {
          motivo_reprovacao: motivoReprovacao,
          motivo_reprovacao_observacao: observacaoValue,
          motivo_cancelamento: null,
        };
      } else {
        if (!reasonText.trim()) {
          toast.error("Informe o motivo.");
          return;
        }
        const trimmed = reasonText.trim();
        extra = isReprovada
          ? {
              motivo_reprovacao: trimmed,
              motivo_reprovacao_observacao: null,
              motivo_cancelamento: null,
            }
          : {
              motivo_cancelamento: trimmed,
              motivo_reprovacao: null,
              motivo_reprovacao_observacao: null,
            };
      }
      if (!confirmStatusChange(reasonDialog.targetStatus)) return;
      await handleUpdateStatus(
        reasonDialog.diariaId,
        reasonDialog.targetStatus,
        extra
      );
      closeReasonDialog();
    };

    const requestStatusChange = (id: string, nextStatus: string) => {
      if (requiresReasonForStatus(nextStatus)) {
        openReasonDialog(id, nextStatus);
      } else {
        if (!confirmStatusChange(nextStatus)) return;
        handleUpdateStatus(id, nextStatus);
      }
    };

    const renderAction = (
      diaria: DiariaTemporaria,
      options?: { onBeforeAction?: () => void }
    ) => {
      const beforeAction = options?.onBeforeAction;
      const normalizedStatus = normalizeStatus(diaria.status);
      if (normalizedStatus === normalizeStatus(STATUS.lancada)) {
        const isNaoOkSaving =
          naoOkSaving &&
          naoOkTarget?.type === "single" &&
          naoOkTarget.diaria.id === diaria.id;
        const naoOkButtonClass =
          diaria.ok_pagamento === false
            ? "bg-white text-red-400 hover:bg-white/90"
            : "border-rose-200 text-rose-700 hover:bg-rose-50";
        return (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="default"
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={
                updatingId === diaria.id.toString() ||
                diaria.ok_pagamento === true
              }
              onClick={(event) => {
                event.stopPropagation();
                beforeAction?.();
                handleOkPagamento(diaria.id.toString());
              }}
            >
              {diaria.ok_pagamento ? "OK registrado" : "Marcar OK"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className={naoOkButtonClass}
              disabled={isNaoOkSaving}
              onClick={(event) => {
                event.stopPropagation();
                beforeAction?.();
                openNaoOkDialog(diaria);
              }}
            >
              Não ok
            </Button>
          </div>
        );
      }
      const action = NEXT_STATUS_ACTIONS[normalizedStatus];
      if (!action) return null;
      return (
        <Button
          size="sm"
          variant="default"
          className="bg-emerald-600 text-white hover:bg-emerald-700"
          disabled={updatingId === diaria.id.toString()}
          onClick={(event) => {
            event.stopPropagation();
            beforeAction?.();
            requestStatusChange(diaria.id.toString(), action.nextStatus);
          }}
        >
          {action.label}
        </Button>
      );
    };

    const handleRowClick = (diaria: DiariaTemporaria) => {
      setSelectedDiaria(diaria);
      setDetailsDialogOpen(true);
    };

    const openGroupDetailsDialog = (groupKey: string) => {
      setSelectedGroupKey(groupKey);
      setGroupDetailsDialogOpen(true);
    };

    const closeGroupDetailsDialog = () => {
      setGroupDetailsDialogOpen(false);
      setSelectedGroupKey(null);
    };

    const openEditDialog = (diaria: DiariaTemporaria) => {
      if (!canEditDiaria(diaria)) {
        const statusLabel = diaria.status || "-";
        toast.error(
          `Diaria nao pode ser editada quando o status e "${statusLabel}". Apenas diarias com status "Aguardando confirmacao" podem ser editadas.`
        );
        return;
      }
      const postoInfo =
        diaria.posto ||
        (diaria.posto_servico_id
          ? postoMap.get(diaria.posto_servico_id)
          : null);
      const motivoVagoValue =
        toTrimOrNull(diaria.motivo_vago) || MOTIVO_VAGO_OPTIONS[0] || "";
      setOriginalDiaristaId(diaria.diarista_id || null);
      setEditingDiariaId(diaria.id.toString());
      setEditForm({
        dataDiaria: diaria.data_diaria || "",
        horarioInicio: diaria.horario_inicio || "",
        horarioFim: diaria.horario_fim || "",
        intervalo:
          diaria.intervalo !== null && diaria.intervalo !== undefined
            ? String(diaria.intervalo)
            : "",
        motivoVago: motivoVagoValue,
        postoServicoId: diaria.posto_servico_id
          ? diaria.posto_servico_id.toString()
          : "",
        unidade: diaria.unidade || postoInfo?.unidade?.nome || "",
        centroCustoId: diaria.centro_custo_id
          ? diaria.centro_custo_id.toString()
          : postoInfo?.cost_center_id
            ? postoInfo.cost_center_id.toString()
            : "",
        valorDiaria:
          diaria.valor_diaria !== null && diaria.valor_diaria !== undefined
            ? String(diaria.valor_diaria)
            : "",
        diaristaId: diaria.diarista_id || "",
        colaboradorAusenteId: diaria.colaborador_ausente_convenia
          ? diaria.colaborador_ausente_convenia.toString()
          : "",
        colaboradorDemitidoId: diaria.colaborador_demitido_convenia
          ? diaria.colaborador_demitido_convenia.toString()
          : "",
        demissao: typeof diaria.demissao === "boolean" ? diaria.demissao : null,
        novoPosto:
          typeof diaria.novo_posto === "boolean" ? diaria.novo_posto : null,
        observacao: diaria.observacao || "",
      });
      setEditDialogOpen(true);
    };

    const closeEditDialog = () => {
      setEditDialogOpen(false);
      setEditingDiariaId(null);
      setOriginalDiaristaId(null);
    };

    const handleEditSubmit = async () => {
      if (!editingDiariaId) return;
      const editingDiaria = diarias.find(
        (item) => item.id.toString() === editingDiariaId
      );
      if (!editingDiaria) {
        toast.error(
          "Nao foi possivel validar o status da diaria. Atualize e tente novamente."
        );
        return;
      }
      if (!canEditDiaria(editingDiaria)) {
        const statusLabel = editingDiaria.status || "-";
        toast.error(
          `Diaria nao pode ser editada quando o status e "${statusLabel}". Apenas diarias com status "Aguardando confirmacao" podem ser editadas.`
        );
        return;
      }
      const isMotivoVaga = isVagaEmAberto(editForm.motivoVago);

      if (
        !editForm.dataDiaria ||
        !editForm.horarioInicio ||
        !editForm.horarioFim
      ) {
        toast.error("Preencha data e horarios da diaria.");
        return;
      }

      if (
        !editForm.valorDiaria ||
        !editForm.diaristaId ||
        !editForm.motivoVago
      ) {
        toast.error("Preencha diarista, valor e motivo.");
        return;
      }
      const blacklistEntry = blacklistMap.get(editForm.diaristaId);
      const diaristaChanged =
        editForm.diaristaId !== (originalDiaristaId || "");
      if (blacklistEntry && diaristaChanged) {
        const motivo = blacklistEntry.motivo
          ? `: ${blacklistEntry.motivo}`
          : "";
        toast.error(`Diarista esta na blacklist${motivo}`);
        return;
      }

      if (!editForm.centroCustoId) {
        toast.error("Selecione o centro de custo.");
        return;
      }

      if (!editForm.postoServicoId) {
        toast.error("Selecione o posto de servico.");
        return;
      }

      if (!isMotivoVaga && !toTrimOrNull(editForm.colaboradorAusenteId)) {
        toast.error("Informe o colaborador ausente.");
        return;
      }

      if (isMotivoVaga) {
        if (editForm.demissao === null) {
          toast.error("Informe se e demissao.");
          return;
        }
        if (
          editForm.demissao === true &&
          !toTrimOrNull(editForm.colaboradorDemitidoId)
        ) {
          toast.error("Informe o colaborador demitido.");
          return;
        }
      }

      const valorNumber = Number(editForm.valorDiaria);
      if (Number.isNaN(valorNumber) || valorNumber <= 0) {
        toast.error("Informe um valor valido.");
        return;
      }

      const intervaloNumber =
        typeof editForm.intervalo === "string" &&
        editForm.intervalo.trim() === ""
          ? null
          : Number(editForm.intervalo);
      if (
        intervaloNumber !== null &&
        (Number.isNaN(intervaloNumber) || intervaloNumber < 0)
      ) {
        toast.error("Informe um intervalo valido (minutos).");
        return;
      }

      const postoSelecionado = postosOptions.find(
        (p) => p.id === editForm.postoServicoId
      );
      const postoInfo = editForm.postoServicoId
        ? postoMap.get(editForm.postoServicoId)
        : null;
      const clienteInfoFromPosto = getClienteInfoFromPosto(postoInfo);
      const clienteIdValue = clienteInfoFromPosto?.id ?? "";
      const clienteIdNumber = Number(clienteIdValue);
      if (!Number.isFinite(clienteIdNumber)) {
        toast.error("Cliente invalido.");
        return;
      }
      const unidadeValue =
        toUpperOrNull(editForm.unidade) ||
        toUpperOrNull(postoSelecionado?.unidade ?? postoInfo?.unidade?.nome);
      if (!unidadeValue) {
        toast.error("Informe a unidade.");
        return;
      }
      const postoServicoIdValue = editForm.postoServicoId || null;
      const centroCustoIdValue = editForm.centroCustoId || null;
      const motivoVagoValue = (editForm.motivoVago || "").toUpperCase();
      const demissaoValue = isMotivoVaga ? editForm.demissao : null;
      const novoPostoValue = isMotivoVaga ? demissaoValue === false : null;
      const colaboradorAusenteId = !isMotivoVaga
        ? toTrimOrNull(editForm.colaboradorAusenteId)
        : null;
      const colaboradorDemitidoId =
        isMotivoVaga && demissaoValue === true
          ? toTrimOrNull(editForm.colaboradorDemitidoId)
          : null;
      const colaboradorAusenteInfo = colaboradorAusenteId
        ? colaboradoresConveniaMap.get(colaboradorAusenteId)
        : null;
      const colaboradorDemitidoInfo = colaboradorDemitidoId
        ? colaboradoresConveniaMap.get(colaboradorDemitidoId)
        : null;
      const colaboradorAusenteNomeValue = toUpperOrNull(
        getConveniaColaboradorNome(colaboradorAusenteInfo)
      );
      const colaboradorDemitidoNomeValue = toUpperOrNull(
        getConveniaColaboradorNome(colaboradorDemitidoInfo)
      );
      const observacaoValue = toUpperOrNull(editForm.observacao);

      setEditingSaving(true);
      try {
        const { error } = await supabase
          .from("diarias_temporarias")
          .update({
            data_diaria: editForm.dataDiaria,
            horario_inicio: editForm.horarioInicio || null,
            horario_fim: editForm.horarioFim || null,
            intervalo: intervaloNumber,
            valor_diaria: valorNumber,
            diarista_id: editForm.diaristaId,
            motivo_vago: motivoVagoValue || null,
            posto_servico_id: postoServicoIdValue,
            unidade: unidadeValue,
            cliente_id: clienteIdNumber,
            centro_custo_id: centroCustoIdValue,
            colaborador_ausente: null,
            colaborador_ausente_convenia: colaboradorAusenteId,
            colaborador_ausente_nome: colaboradorAusenteNomeValue,
            colaborador_demitido: null,
            colaborador_demitido_convenia: colaboradorDemitidoId,
            colaborador_demitido_nome: colaboradorDemitidoNomeValue,
            demissao: demissaoValue,
            novo_posto: novoPostoValue,
            observacao: observacaoValue,
          })
          .eq("id", editingDiariaId);
        if (error) throw error;
        toast.success("Diaria atualizada com sucesso.");
        await refetchDiarias();
        closeEditDialog();
      } catch (error: any) {
        toast.error(error.message || "Nao foi possivel atualizar a diaria.");
      } finally {
        setEditingSaving(false);
      }
    };

    const isEditMotivoVaga =
      editForm.motivoVago.toUpperCase() ===
      MOTIVO_VAGO_VAGA_EM_ABERTO.toUpperCase();
    const demissaoSelectValue =
      editForm.demissao === null
        ? UNSET_BOOL
        : editForm.demissao
        ? "true"
        : "false";

    const toggleSelect = (id: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    };

    const allVisibleSelected =
      diariasFiltradas.length > 0 &&
      diariasFiltradas.every((diaria) => selectedIds.has(diaria.id.toString()));

    const toggleSelectAllVisible = () => {
      setSelectedIds((prev) => {
        if (allVisibleSelected) {
          return new Set(
            Array.from(prev).filter(
              (id) => !diariasFiltradas.some((d) => d.id.toString() === id)
            )
          );
        }
        const next = new Set(prev);
        diariasFiltradas.forEach((diaria) => next.add(diaria.id.toString()));
        return next;
      });
    };

    const clearSelection = () => setSelectedIds(new Set());

    const handleBulkStatusApply = async (status: string) => {
      if (!status) {
        toast.error("Selecione um status para aplicar.");
        return;
      }
      if (requiresReasonForStatus(status)) {
        toast.error("Reprovar ou cancelar não estão disponíveis em massa.");
        return;
      }
      const ids = Array.from(selectedIds);
      if (ids.length === 0) {
        toast.info("Nenhuma diaria selecionada.");
        return;
      }
      const message = `Aplicar "${STATUS_LABELS[status] || status}" em ${
        ids.length
      } diaria(s)?`;
      if (typeof window !== "undefined" && !window.confirm(message)) return;
      setUpdatingId("bulk");
      try {
        const { error } = await supabase
          .from("diarias_temporarias")
          .update({ status })
          .in("id", ids);
        if (error) throw error;
        toast.success(
          `Status atualizado para ${STATUS_LABELS[status] || status} em ${
            ids.length
          } diaria(s).`
        );
        clearSelection();
        await refetchDiarias();
      } catch (error: any) {
        toast.error(error.message || "Erro ao atualizar status em massa.");
      } finally {
        setUpdatingId(null);
      }
    };

    const handleBulkDefaultAction = () => {
      if (!pageDefaultAction) {
        toast.info("Nenhuma ação em massa disponível nesta lista.");
        return;
      }
      handleBulkStatusApply(pageDefaultAction.nextStatus);
    };

    const handleBulkDeleteCancelled = async () => {
      if (!allowDelete) return;
      const ids = Array.from(selectedIds);
      if (ids.length === 0) {
        toast.info("Nenhuma diaria selecionada para excluir.");
        return;
      }
      const statusLabelDelete = isCancelPage ? "cancelada(s)" : "reprovada(s)";
      const message = `Excluir ${ids.length} diaria(s) ${statusLabelDelete}? Esta ação não pode ser desfeita.`;
      if (typeof window !== "undefined" && !window.confirm(message)) return;
      setDeletingId("bulk-delete");
      try {
        const { error } = await supabase
          .from("diarias_temporarias")
          .delete()
          .in("id", ids);
        if (error) throw error;
        toast.success("Diarias excluídas.");
        clearSelection();
        await refetchDiarias();
      } catch (error: any) {
        toast.error(error.message || "Erro ao excluir diarias canceladas.");
      } finally {
        setDeletingId(null);
      }
    };

    useEffect(() => {
      clearSelection();
      setGroupOkSavingKey(null);
    }, [normalizedKey]);

    const closeDetailsDialog = () => {
      setDetailsDialogOpen(false);
      setSelectedDiaria(null);
    };

    const selectedPostoInfo =
      selectedDiaria?.posto ||
      (selectedDiaria?.posto_servico_id
        ? postoMap.get(selectedDiaria.posto_servico_id)
        : null);
    const selectedDiaristaInfo =
      selectedDiaria?.diarista ||
      diaristaMap.get(selectedDiaria?.diarista_id || "");
    const selectedDiaristaCadastroIncompleto = isCadastroIncompleto(
      selectedDiaristaInfo
    );
    const selectedContratoInfo = getContratoInfoFromPosto(selectedPostoInfo);
    const selectedClienteDisplay = selectedDiaria
      ? getClienteOuCentroCustoDisplay(selectedDiaria, selectedPostoInfo)
      : { label: "Cliente", value: "-" };
    const selectedClienteNome = selectedClienteDisplay.value || "-";
    const selectedColaboradorNome = selectedDiaria
      ? getColaboradorAusenteDisplay(selectedDiaria)
      : "-";
    const selectedColaboradorDemitidoNome = selectedDiaria
      ? getColaboradorDemitidoDisplay(selectedDiaria)
      : "";
    const selectedPostoNome =
      selectedDiaria?.posto_servico?.trim() || selectedPostoInfo?.nome || "-";
    const selectedUnidadeNome =
      toTrimOrNull(selectedDiaria?.unidade) ||
      selectedPostoInfo?.unidade?.nome ||
      "-";
    const isFaltaSelecionada = isFaltaMotivo(selectedDiaria?.motivo_vago);
    const isFaltaInjustificada =
      (selectedDiaria?.motivo_vago || "").toUpperCase() ===
      MOTIVO_FALTA_INJUSTIFICADA;
    const faltaJustificadaPorNome = faltaInfo?.justificada_por
      ? usuarioMap.get(faltaInfo.justificada_por) ||
        extraUserMap.get(faltaInfo.justificada_por) ||
        faltaInfo.justificada_por
      : "-";
    const motivoVagaEmAbertoSelecionado = isVagaEmAberto(
      selectedDiaria?.motivo_vago
    );
    const selectedNovoPostoFlag = selectedDiaria?.novo_posto === true;
    const criadoPorNome = getUsuarioNome(selectedDiaria?.criado_por);
    const confirmadaPorNome = getUsuarioNome(selectedDiaria?.confirmada_por);
    const lancadaPorNome = getUsuarioNome(selectedDiaria?.lancada_por);
    const okPagamentoPorNome = getUsuarioNome(selectedDiaria?.ok_pagamento_por);
    const pagaPorNome = getUsuarioNome(selectedDiaria?.paga_por);
    const statusResponsavelInfo = selectedDiaria
      ? getStatusResponsavel(selectedDiaria)
      : { id: null, label: "" };
    const statusResponsavelNome = statusResponsavelInfo.id
      ? getUsuarioNome(statusResponsavelInfo.id)
      : "";
    const statusDates = useMemo(() => {
      const items = STATUS_DATE_LABELS.map(({ field, label }) => {
        if (isPagaPage && field === "aprovada_em") {
          const okValue = selectedDiaria?.ok_pagamento_em;
          if (!okValue) return null;
          return { label: "OK pagamento em", value: formatDateTime(okValue) };
        }
        const value = selectedDiaria ? (selectedDiaria as any)[field] : null;
        if (!value) return null;
        return { label, value: formatDateTime(value) };
      }).filter(Boolean) as { label: string; value: string }[];
      return items;
    }, [isPagaPage, selectedDiaria]);

    const statusDatesWithCreated = useMemo(() => {
      const items = [...statusDates];
      if (isPagaPage && selectedDiaria?.created_at) {
        items.unshift({
          label: "Criada em",
          value: formatDateTime(selectedDiaria.created_at),
        });
      }
      return items;
    }, [isPagaPage, selectedDiaria?.created_at, statusDates]);
    const detailsActionElement = selectedDiaria
      ? renderAction(selectedDiaria, { onBeforeAction: closeDetailsDialog })
      : null;

    const showReasonColumn =
      normalizedKey === normalizedCancelStatus ||
      normalizedKey === normalizedReprovadaStatus;
    const showEnumMotivoReprovacao =
      isConfirmadaPage &&
      normalizeStatus(reasonDialog.targetStatus || "") ===
        normalizedReprovadaStatus;
    const showGroupedLancadas =
      (isLancadaPage || isAprovadaPage || isPagaPage) &&
      lancadasView === "agrupadas";

    return (
      <DashboardLayout>
        <div className="space-y-6 p-4 md:p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-muted-foreground uppercase tracking-wide">
                Diarias
              </p>
              <h1 className="text-3xl font-bold">{title}</h1>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>

          <Card className="shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">
                  {STATUS_LABELS[statusKey]}
                </CardTitle>
              </div>
              <div className="flex flex-col items-end gap-2">
                {(isLancadaPage || isAprovadaPage || isPagaPage) && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={lancadasView === "lista" ? "default" : "outline"}
                      onClick={() => setLancadasView("lista")}
                    >
                      Lista completa
                    </Button>
                    <Button
                      size="sm"
                      variant={
                        lancadasView === "agrupadas" ? "default" : "outline"
                      }
                      onClick={() => setLancadasView("agrupadas")}
                    >
                      Agrupadas
                    </Button>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  {showStatusNotice && (
                    <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-1 text-amber-800">
                      <Bell className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        {statusNoticeCount}{" "}
                        {statusNoticeCount === 1 ? "diaria" : "diarias"}{" "}
                        {statusNoticeLabel}
                      </span>
                    </div>
                  )}
                  <Badge variant={STATUS_BADGE[statusKey] || "outline"}>
                    {diariasDoStatusFull.length} diaria(s)
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="md:hidden sticky top-2 z-10">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between"
                  aria-expanded={mobileFiltersOpen}
                  aria-controls={`filters-panel-${normalizedKey}`}
                  onClick={() => setMobileFiltersOpen((prev) => !prev)}
                >
                  {mobileFiltersOpen ? "Ocultar filtros" : "Filtrar"}
                </Button>
              </div>
              <div
                id={`filters-panel-${normalizedKey}`}
                className={`${
                  mobileFiltersOpen ? "flex" : "hidden"
                } flex-col gap-3 md:flex`}
              >
                <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-1">
                    <TooltipLabel
                      htmlFor={`filtro-temp-id-${statusKey}`}
                      label="ID da diaria"
                      tooltip="Filtra pelo identificador da diaria temporaria."
                    />
                    <Input
                      id={`filtro-temp-id-${statusKey}`}
                      type="number"
                      value={filters.diariaId}
                      onChange={(event) =>
                        setFilters((prev) => ({
                          ...prev,
                          diariaId: event.target.value,
                        }))
                      }
                      placeholder="Ex: 123"
                    />
                  </div>
                  <div className="space-y-1">
                    <TooltipLabel
                      htmlFor={`filtro-temp-diarista-${statusKey}`}
                      label="Diarista"
                      tooltip="Filtra diarias pelo diarista responsavel."
                    />
                    <Select
                      value={filters.diaristaId || selectAllValue}
                      onValueChange={(value) =>
                        setFilters((prev) => ({
                          ...prev,
                          diaristaId: value === selectAllValue ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger id={`filtro-temp-diarista-${statusKey}`}>
                        <SelectValue placeholder="Todos os diaristas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={selectAllValue}>
                          Todos os diaristas
                        </SelectItem>
                        {diaristaOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <TooltipLabel
                      htmlFor={`filtro-temp-motivo-${statusKey}`}
                      label="Motivo"
                      tooltip="Filtra pelo motivo que levou a necessidade de se ter diária."
                    />
                    <Select
                      value={filters.motivo || selectAllValue}
                      onValueChange={(value) =>
                        setFilters((prev) => ({
                          ...prev,
                          motivo: value === selectAllValue ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger id={`filtro-temp-motivo-${statusKey}`}>
                        <SelectValue placeholder="Todos os motivos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={selectAllValue}>
                          Todos os motivos
                        </SelectItem>
                        {motivoOptions.map((motivo) => (
                          <SelectItem key={motivo} value={motivo}>
                            {motivo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <TooltipLabel
                      htmlFor={`filtro-temp-cliente-${statusKey}`}
                      label="Cliente"
                      tooltip="Mostra apenas diarias relacionadas ao cliente selecionado."
                    />
                    <Select
                      value={filters.clienteId || selectAllValue}
                      onValueChange={(value) =>
                        setFilters((prev) => ({
                          ...prev,
                          clienteId: value === selectAllValue ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger id={`filtro-temp-cliente-${statusKey}`}>
                        <SelectValue placeholder="Todos os clientes" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={selectAllValue}>
                          Todos os clientes
                        </SelectItem>
                        {clienteFilterOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <TooltipLabel
                      htmlFor={`filtro-temp-centro-custo-${statusKey}`}
                      label="Centro de custo"
                      tooltip="Mostra apenas diarias relacionadas ao centro de custo selecionado."
                    />
                    <Select
                      value={filters.centroCustoId || selectAllValue}
                      onValueChange={(value) =>
                        setFilters((prev) => ({
                          ...prev,
                          centroCustoId: value === selectAllValue ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger id={`filtro-temp-centro-custo-${statusKey}`}>
                        <SelectValue placeholder="Todos os centros de custo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={selectAllValue}>
                          Todos os centros de custo
                        </SelectItem>
                        {costCenterFilterOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <TooltipLabel
                      htmlFor={`filtro-temp-criado-por-${statusKey}`}
                      label="Criado por"
                      tooltip="Filtra pelo usuario interno que registrou a diaria."
                    />
                    <Select
                      value={filters.criadoPorId || selectAllValue}
                      onValueChange={(value) =>
                        setFilters((prev) => ({
                          ...prev,
                          criadoPorId: value === selectAllValue ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger id={`filtro-temp-criado-por-${statusKey}`}>
                        <SelectValue placeholder="Todos os criadores" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={selectAllValue}>
                          Todos os criadores
                        </SelectItem>
                        {criadoPorOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {statusResponsavelField && (
                    <div className="space-y-1">
                      <TooltipLabel
                        htmlFor={`filtro-temp-responsavel-${statusKey}`}
                        label={statusResponsavelLabel}
                        tooltip={statusResponsavelTooltip}
                      />
                      <Select
                        value={filters.statusResponsavelId || selectAllValue}
                        onValueChange={(value) =>
                          setFilters((prev) => ({
                            ...prev,
                            statusResponsavelId:
                              value === selectAllValue ? "" : value,
                          }))
                        }
                      >
                        <SelectTrigger
                          id={`filtro-temp-responsavel-${statusKey}`}
                        >
                          <SelectValue
                            placeholder={`Todos os ${statusResponsavelLabel.toLowerCase()}`}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={selectAllValue}>
                            {`Todos os ${statusResponsavelLabel.toLowerCase()}`}
                          </SelectItem>
                          {responsavelStatusOptions.map((option) => (
                            <SelectItem key={option.id} value={option.id}>
                              {option.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {isPagaPage && (
                    <div className="space-y-1">
                      <TooltipLabel
                        htmlFor={`filtro-temp-ok-por-${statusKey}`}
                        label="OK pagamento por"
                        tooltip="Filtra pelo usuario que marcou o OK do pagamento."
                      />
                      <Select
                        value={filters.okPagamentoPorId || selectAllValue}
                        onValueChange={(value) =>
                          setFilters((prev) => ({
                            ...prev,
                            okPagamentoPorId:
                              value === selectAllValue ? "" : value,
                          }))
                        }
                      >
                        <SelectTrigger id={`filtro-temp-ok-por-${statusKey}`}>
                          <SelectValue placeholder="Todos os responsaveis do OK" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={selectAllValue}>
                            Todos os responsaveis do OK
                          </SelectItem>
                          {okPagamentoPorOptions.map((option) => (
                            <SelectItem key={option.id} value={option.id}>
                              {option.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {isAprovadaPage && (
                    <div className="space-y-1">
                      <TooltipLabel
                        htmlFor={`filtro-temp-ok-${statusKey}`}
                        label="Nao ok pagamento"
                        tooltip="Filtra diarias aprovadas com pagamento marcado como nao."
                      />
                      <Select
                        value={filters.okPagamento || selectAllValue}
                        onValueChange={(value) =>
                          setFilters((prev) => ({
                            ...prev,
                            okPagamento: value === selectAllValue ? "" : value,
                          }))
                        }
                      >
                        <SelectTrigger id={`filtro-temp-ok-${statusKey}`}>
                          <SelectValue placeholder="Todos os pagamentos" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={selectAllValue}>Todos</SelectItem>
                          <SelectItem value="false">Nao ok</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-1">
                    <TooltipLabel
                      htmlFor={`filtro-temp-data-inicio-${statusKey}`}
                      label="Data inicial"
                      tooltip="Utilize essa opção de filtro em conjunto com o filtro data final para visualizar todas as diárias realizadas dentro do intervalo."
                    />
                    <Input
                      id={`filtro-temp-data-inicio-${statusKey}`}
                      type="date"
                      value={filters.startDate}
                      onChange={(event) =>
                        setFilters((prev) => ({
                          ...prev,
                          startDate: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <TooltipLabel
                      htmlFor={`filtro-temp-data-fim-${statusKey}`}
                      label="Data final"
                      tooltip="Utilize essa opção de filtro em conjunto com o filtro data inicial para visualizar todas as diárias realizadas dentro do intervalo."
                    />
                    <Input
                      id={`filtro-temp-data-fim-${statusKey}`}
                      type="date"
                      value={filters.endDate}
                      onChange={(event) =>
                        setFilters((prev) => ({
                          ...prev,
                          endDate: event.target.value,
                        }))
                      }
                    />
                  </div>
                  {statusDateConfig && (
                    <>
                      <div className="space-y-1">
                        <TooltipLabel
                          htmlFor={`filtro-temp-status-inicio-${statusKey}`}
                          label={statusDateConfig.startLabel}
                          tooltip={buildStatusDateTooltip.start}
                        />
                        <Input
                          id={`filtro-temp-status-inicio-${statusKey}`}
                          type="date"
                          value={filters.statusDateStart}
                          onChange={(event) =>
                            setFilters((prev) => ({
                              ...prev,
                              statusDateStart: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <TooltipLabel
                          htmlFor={`filtro-temp-status-fim-${statusKey}`}
                          label={statusDateConfig.endLabel}
                          tooltip={buildStatusDateTooltip.end}
                        />
                        <Input
                          id={`filtro-temp-status-fim-${statusKey}`}
                          type="date"
                          value={filters.statusDateEnd}
                          onChange={(event) =>
                            setFilters((prev) => ({
                              ...prev,
                              statusDateEnd: event.target.value,
                            }))
                          }
                        />
                      </div>
                    </>
                  )}
                </div>
                {hasActiveFilters && (
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearFilters}
                    >
                      Limpar filtros
                    </Button>
                  </div>
                )}
              </div>
              <AnimatePresence mode="wait">
                {showGroupedLancadas ? (
                  <motion.div
                    key="agrupadas"
                    className="space-y-4"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        onClick={handleExportGroupedXlsx}
                      >
                        Exportar XLSX agrupadas
                      </Button>
                    </div>
                    <div className="overflow-x-auto">
                      {lancadasAgrupadas.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">
                          Nenhuma diaria encontrada para agrupamento.
                        </p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Diarista</TableHead>
                              <TableHead>Cliente</TableHead>
                              <TableHead className="hidden md:table-cell">
                                Pix do diarista
                              </TableHead>
                              <TableHead className="hidden md:table-cell">
                                Qtd
                              </TableHead>
                              <TableHead className="hidden md:table-cell">
                                Total
                              </TableHead>
                              {(isLancadaPage || isAprovadaPage) && (
                                <TableHead className="text-right">
                                  Acoes
                                </TableHead>
                              )}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {lancadasAgrupadas.map((group) => {
                              const pendingCount = group.pendingOkIds.length;
                              const lancarCount = group.ids.length;
                              const isOkSaving = groupOkSavingKey === group.key;
                              const isLancarSaving =
                                groupLancarSavingKey === group.key;
                              const hasNaoOk = group.ids.some(
                                (id) =>
                                  okPagamentoById.get(id.toString()) === false
                              );
                              const diaristaInfo = group.diaristaId
                                ? diaristaMap.get(group.diaristaId)
                                : null;
                              const diaristaCadastroIncompleto =
                                isCadastroIncompleto(diaristaInfo);
                              const groupRowClasses = getPagamentoRowClasses(
                                hasNaoOk ? false : null,
                                "cursor-pointer transition"
                              );
                              const groupRowStyle = getPagamentoRowStyle(
                                hasNaoOk ? false : null
                              );
                              return (
                                <TableRow
                                  key={group.key}
                                  className={groupRowClasses}
                                  style={groupRowStyle}
                                  onClick={() =>
                                    openGroupDetailsDialog(group.key)
                                  }
                                >
                                  <TableCell>
                                    <div className="flex flex-col gap-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span>{group.diaristaNome}</span>
                                        {diaristaCadastroIncompleto && (
                                          <CadastroIncompletoBadge
                                            stopPropagation
                                          />
                                        )}
                                      </div>
                                      <span className="text-xs text-muted-foreground md:hidden">
                                        Cliente: {group.clienteLabel}
                                      </span>
                                      <span className="text-xs text-muted-foreground md:hidden">
                                        Pix do diarista:{" "}
                                        {group.diaristaPix || "-"}
                                      </span>
                                      <span className="text-xs text-muted-foreground md:hidden">
                                        Qtd: {group.count} | Total:{" "}
                                        {currencyFormatter.format(
                                          group.totalValor
                                        )}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="hidden md:table-cell">
                                    {group.clienteLabel}
                                  </TableCell>
                                  <TableCell className="hidden md:table-cell">
                                    {group.diaristaPix || "-"}
                                  </TableCell>
                                  <TableCell className="hidden md:table-cell">
                                    {group.count}
                                  </TableCell>
                                  <TableCell className="hidden md:table-cell">
                                    {currencyFormatter.format(group.totalValor)}
                                  </TableCell>
                                  {isLancadaPage && (
                                    <TableCell className="text-right">
                                      <div className="flex justify-end gap-2">
                                        <Button
                                          size="sm"
                                          variant="default"
                                          className="bg-emerald-600 text-white hover:bg-emerald-700"
                                          disabled={
                                            isOkSaving || pendingCount === 0
                                          }
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            handleGroupedOkPagamento(group);
                                          }}
                                        >
                                          {isOkSaving
                                            ? "Marcando..."
                                            : pendingCount === 0
                                            ? "OK registrado"
                                            : `Marcar OK (${pendingCount})`}
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="border-rose-200 text-rose-700 hover:bg-rose-50"
                                          disabled={
                                            naoOkSaving &&
                                            naoOkTarget?.type === "group" &&
                                            naoOkTarget.key === group.key
                                          }
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            openNaoOkGroupDialog(group);
                                          }}
                                        >
                                          Não ok
                                        </Button>
                                      </div>
                                    </TableCell>
                                  )}
                                  {isAprovadaPage && (
                                    <TableCell className="text-right">
                                      <Button
                                        size="sm"
                                        variant="default"
                                        className="bg-emerald-600 text-white hover:bg-emerald-700"
                                        disabled={
                                          isLancarSaving || lancarCount === 0
                                        }
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleGroupedLancarPagamento(group);
                                        }}
                                      >
                                        {isLancarSaving
                                          ? "Lancando..."
                                          : lancarCount === 0
                                          ? "Sem diarias"
                                          : `Lancar (${lancarCount})`}
                                      </Button>
                                    </TableCell>
                                  )}
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="lista"
                    className="space-y-4"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={handleExportXlsx}>
                        Exportar XLSX
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setTotalDialogOpen(true)}
                      >
                        Filtragem Avançada
                      </Button>
                      <Button
                        variant="default"
                        className="bg-emerald-600 text-white hover:bg-emerald-700"
                        disabled={
                          updatingId === "bulk" ||
                          selectedIds.size === 0 ||
                          !pageDefaultAction
                        }
                        onClick={handleBulkDefaultAction}
                      >
                        {pageDefaultAction
                          ? `${pageDefaultAction.label} (selecionadas)`
                          : "Ação em massa"}
                      </Button>
                      {allowDelete && (
                        <Button
                          variant="destructive"
                          disabled={
                            deletingId === "bulk-delete" ||
                            selectedIds.size === 0
                          }
                          onClick={handleBulkDeleteCancelled}
                        >
                          Excluir selecionadas
                        </Button>
                      )}
                    </div>
                    <div className="overflow-x-auto">
                      {diariasFiltradas.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">
                          {hasActiveFilters
                            ? "Nenhuma diaria encontrada com os filtros selecionados."
                            : emptyMessage ||
                              "Nenhuma diaria para este status no periodo selecionado."}
                        </p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12">
                                <Checkbox
                                  aria-label="Selecionar todas"
                                  checked={allVisibleSelected}
                                  onCheckedChange={toggleSelectAllVisible}
                                />
                              </TableHead>
                              <TableHead className="whitespace-nowrap">
                                ID
                              </TableHead>
                              <TableHead>Data</TableHead>
                              <TableHead className="hidden md:table-cell">
                                Colaborador
                              </TableHead>
                              <TableHead className="hidden md:table-cell">
                                Cliente
                              </TableHead>
                              <TableHead>Diarista</TableHead>
                              <TableHead className="hidden md:table-cell">
                                Motivo
                              </TableHead>
                              <TableHead className="hidden md:table-cell">
                                Valor
                              </TableHead>
                              <TableHead className="hidden md:table-cell">
                                Pix do diarista
                              </TableHead>
                              <TableHead className="hidden md:table-cell text-right">
                                Acoes
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {diariasFiltradas.map((diaria) => {
                              const colaboradorInfo =
                                diaria.colaborador ||
                                (diaria.colaborador_ausente
                                  ? colaboradoresMap.get(
                                      diaria.colaborador_ausente
                                    )
                                  : null);
                              const postoInfo =
                                diaria.posto ||
                                (diaria.posto_servico_id
                                  ? postoMap.get(diaria.posto_servico_id)
                                  : null);
                              const diaristaInfo =
                                diaria.diarista ||
                                diaristaMap.get(diaria.diarista_id || "");
                              const diaristaCadastroIncompleto =
                                isCadastroIncompleto(diaristaInfo);
                              const colaboradorNome =
                                colaboradorInfo?.nome_completo ||
                                getColaboradorAusenteDisplay(diaria);
                              const colaboradorDemitidoNome =
                                getColaboradorDemitidoDisplay(diaria);
                              const novoPostoFlag = diaria.novo_posto === true;
                              const isVagaAbertoMotivo = isVagaEmAberto(
                                diaria.motivo_vago
                              );
                              let colaboradorDisplay = colaboradorNome;
                              if (isVagaAbertoMotivo) {
                                if (diaria.demissao) {
                                  colaboradorDisplay =
                                    colaboradorDemitidoNome || "";
                                } else {
                                  colaboradorDisplay = novoPostoFlag
                                    ? "Novo posto"
                                    : "-";
                                }
                              }
                              const postoNome =
                                diaria.posto_servico?.trim() ||
                                postoInfo?.nome ||
                                "-";
                              const clienteNome =
                                getClienteOuCentroCustoDisplay(
                                  diaria,
                                  postoInfo
                                ).value || "-";
                              const actionElement = renderAction(diaria);
                              const rowClasses = getPagamentoRowClasses(
                                diaria.ok_pagamento,
                                "cursor-pointer transition"
                              );
                              const rowStyle = getPagamentoRowStyle(
                                diaria.ok_pagamento
                              );
                              const checkboxClass =
                                diaria.ok_pagamento === false
                                  ? "!border-black !text-black hover:!border-black hover:!text-black data-[state=checked]:!bg-black data-[state=checked]:!text-white"
                                  : "";
                              return (
                                <TableRow
                                  key={diaria.id}
                                  className={rowClasses}
                                  style={rowStyle}
                                  onClick={() => handleRowClick(diaria)}
                                >
                                  <TableCell
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    <Checkbox
                                      aria-label="Selecionar diaria"
                                      checked={selectedIds.has(
                                        diaria.id.toString()
                                      )}
                                      onCheckedChange={() =>
                                        toggleSelect(diaria.id.toString())
                                      }
                                      className={checkboxClass}
                                    />
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap">
                                    {diaria.id}
                                  </TableCell>
                                  <TableCell>
                                    {formatDate(diaria.data_diaria)}
                                  </TableCell>
                                  <TableCell className="hidden md:table-cell">
                                    {colaboradorDisplay}
                                  </TableCell>
                                  <TableCell className="hidden md:table-cell">
                                    {clienteNome}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-col gap-2">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span>
                                          {diaristaInfo?.nome_completo || "-"}
                                        </span>
                                        {diaristaCadastroIncompleto && (
                                          <CadastroIncompletoBadge
                                            stopPropagation
                                          />
                                        )}
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="hidden md:table-cell">
                                    {diaria.motivo_vago || "-"}
                                  </TableCell>
                                  <TableCell className="hidden md:table-cell">
                                    {currencyFormatter.format(
                                      diaria.valor_diaria || 0
                                    )}
                                  </TableCell>
                                  <TableCell className="hidden md:table-cell">
                                    {diaristaInfo?.pix || "-"}
                                  </TableCell>
                                  <TableCell
                                    className="hidden md:table-cell"
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    <div className="flex flex-col items-end gap-2">
                                      <div className="flex flex-wrap justify-end gap-2">
                                        {statusKey === STATUS.confirmada && (
                                          <Button
                                            size="sm"
                                            variant="destructive"
                                            disabled={
                                              updatingId ===
                                              diaria.id.toString()
                                            }
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              openReasonDialog(
                                                diaria.id.toString(),
                                                STATUS.reprovada
                                              );
                                            }}
                                          >
                                            Reprovar
                                          </Button>
                                        )}
                                        {isAguardandoPage && (
                                          <Button
                                            size="sm"
                                            variant="destructive"
                                            disabled={
                                              updatingId ===
                                              diaria.id.toString()
                                            }
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              openReasonDialog(
                                                diaria.id.toString(),
                                                STATUS.cancelada
                                              );
                                            }}
                                          >
                                            Cancelar
                                          </Button>
                                        )}
                                        <Button
                                          size="sm"
                                          variant="default"
                                          className="bg-amber-400 text-black hover:bg-amber-500"
                                          disabled={!canEditDiaria(diaria)}
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            openEditDialog(diaria);
                                          }}
                                        >
                                          Editar
                                        </Button>
                                        {allowDelete && (
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            className="text-destructive"
                                            disabled={
                                              deletingId ===
                                              diaria.id.toString()
                                            }
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              handleDeleteDiaria(
                                                diaria.id.toString()
                                              );
                                            }}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                            <span className="sr-only">
                                              Excluir diaria
                                            </span>
                                          </Button>
                                        )}
                                      </div>
                                      {actionElement && (
                                        <div
                                          onClick={(event) =>
                                            event.stopPropagation()
                                          }
                                        >
                                          {actionElement}
                                        </div>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>

          {loadingDiarias && (
            <p className="text-sm text-muted-foreground text-center">
              Atualizando informacoes...
            </p>
          )}
        </div>

        <Dialog
          open={reasonDialog.open}
          onOpenChange={(open) => (open ? null : closeReasonDialog())}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {normalizeStatus(reasonDialog.targetStatus || "") ===
                normalizedReprovadaStatus
                  ? "Reprovar diaria"
                  : "Cancelar diaria"}
              </DialogTitle>
              <DialogDescription>
                {showEnumMotivoReprovacao
                  ? "Selecione o motivo da reprovacao. A observacao e opcional."
                  : "Informe o motivo para esta alteracao de status."}
              </DialogDescription>
            </DialogHeader>
            {showEnumMotivoReprovacao ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="motivo-reprovacao-diaria-temp">
                    Motivo da reprovacao
                  </Label>
                  <Select
                    value={motivoReprovacao}
                    onValueChange={setMotivoReprovacao}
                  >
                    <SelectTrigger id="motivo-reprovacao-diaria-temp">
                      <SelectValue placeholder="Selecione o motivo" />
                    </SelectTrigger>
                    <SelectContent>
                      {motivoReprovacaoOptions.map((motivo) => (
                        <SelectItem key={motivo} value={motivo}>
                          {motivo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {motivoReprovacao && (
                  <div className="space-y-2">
                    <Label htmlFor="motivo-reprovacao-observacao-diaria-temp">
                      Observacao (opcional)
                    </Label>
                    <Textarea
                      id="motivo-reprovacao-observacao-diaria-temp"
                      value={motivoReprovacaoObservacao}
                      onChange={(event) =>
                        setMotivoReprovacaoObservacao(event.target.value)
                      }
                      placeholder="Detalhes adicionais (opcional)"
                      rows={3}
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="motivo-diaria-temp">Motivo</Label>
                <Textarea
                  id="motivo-diaria-temp"
                  value={reasonText}
                  onChange={(event) => setReasonText(event.target.value)}
                  placeholder="Descreva o motivo"
                  rows={4}
                />
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeReasonDialog}
              >
                Fechar
              </Button>
              <Button
                type="button"
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={handleReasonSubmit}
                disabled={
                  updatingId === reasonDialog.diariaId ||
                  (showEnumMotivoReprovacao
                    ? !motivoReprovacao
                    : !reasonText.trim())
                }
              >
                {updatingId === reasonDialog.diariaId
                  ? "Salvando..."
                  : "Confirmar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={totalDialogOpen} onOpenChange={setTotalDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Filtragem</DialogTitle>
              <DialogDescription>
                Consulte totais das diarias neste status. Existem opcoes por
                diarista com e sem datas, alem de totais que consideram o
                cliente vinculado ao posto de servico.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2 rounded-md border bg-muted/30 p-4">
                <p className="text-sm font-semibold text-muted-foreground">
                  Total geral por periodo
                </p>
                <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor={`total-periodo-inicio-${statusKey}`}>
                      Data inicial
                    </Label>
                    <Input
                      id={`total-periodo-inicio-${statusKey}`}
                      type="date"
                      value={totalRangePeriodo.startDate}
                      onChange={(event) =>
                        setTotalRangePeriodo((prev) => ({
                          ...prev,
                          startDate: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`total-periodo-fim-${statusKey}`}>
                      Data final
                    </Label>
                    <Input
                      id={`total-periodo-fim-${statusKey}`}
                      type="date"
                      value={totalRangePeriodo.endDate}
                      onChange={(event) =>
                        setTotalRangePeriodo((prev) => ({
                          ...prev,
                          endDate: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="rounded-md border bg-background/80 p-3">
                  <p className="text-sm text-muted-foreground">
                    Valor total no periodo
                  </p>
                  <p className="text-2xl font-semibold">
                    {periodoTotal !== null
                      ? currencyFormatter.format(periodoTotal)
                      : "--"}
                  </p>
                </div>
              </div>
              <div className="space-y-2 rounded-md border bg-muted/30 p-4">
                <p className="text-sm font-semibold text-muted-foreground">
                  Total por diarista (sem data)
                </p>
                <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor={`total-diarista-all-${statusKey}`}>
                      Diarista
                    </Label>
                    <Select
                      value={totalRangeDiaristaAll.diaristaId || selectAllValue}
                      onValueChange={(value) =>
                        setTotalRangeDiaristaAll((prev) => ({
                          ...prev,
                          diaristaId: value === selectAllValue ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger id={`total-diarista-all-${statusKey}`}>
                        <SelectValue placeholder="Selecione o diarista" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={selectAllValue}>
                          Selecione o diarista
                        </SelectItem>
                        {diaristaOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="rounded-md border bg-background/80 p-3">
                  <p className="text-sm text-muted-foreground">Total geral</p>
                  <p className="text-2xl font-semibold">
                    {diaristaTotalAll !== null
                      ? currencyFormatter.format(diaristaTotalAll)
                      : "--"}
                  </p>
                  <div className="pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        exportTotalSemData({
                          diaristaId: totalRangeDiaristaAll.diaristaId,
                          diaristaNome:
                            diaristaMap.get(
                              totalRangeDiaristaAll.diaristaId || ""
                            )?.nome_completo || "",
                          total: diaristaTotalAll,
                        })
                      }
                    >
                      Exportar total
                    </Button>
                  </div>
                </div>
              </div>
              <div className="space-y-2 rounded-md border bg-muted/30 p-4">
                <p className="text-sm font-semibold text-muted-foreground">
                  Total por diarista
                </p>
                <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-3">
                  <div className="space-y-1">
                    <Label htmlFor={`total-diarista-${statusKey}`}>
                      Diarista
                    </Label>
                    <Select
                      value={totalRangeDiarista.diaristaId || selectAllValue}
                      onValueChange={(value) =>
                        setTotalRangeDiarista((prev) => ({
                          ...prev,
                          diaristaId: value === selectAllValue ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger id={`total-diarista-${statusKey}`}>
                        <SelectValue placeholder="Selecione o diarista" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={selectAllValue}>
                          Selecione o diarista
                        </SelectItem>
                        {diaristaOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`total-inicio-${statusKey}`}>
                      Data inicial
                    </Label>
                    <Input
                      id={`total-inicio-${statusKey}`}
                      type="date"
                      value={totalRangeDiarista.startDate}
                      onChange={(event) =>
                        setTotalRangeDiarista((prev) => ({
                          ...prev,
                          startDate: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`total-fim-${statusKey}`}>Data final</Label>
                    <Input
                      id={`total-fim-${statusKey}`}
                      type="date"
                      value={totalRangeDiarista.endDate}
                      onChange={(event) =>
                        setTotalRangeDiarista((prev) => ({
                          ...prev,
                          endDate: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="rounded-md border bg-background/80 p-3">
                  <p className="text-sm text-muted-foreground">
                    Total no periodo
                  </p>
                  <p className="text-2xl font-semibold">
                    {diaristaTotal !== null
                      ? currencyFormatter.format(diaristaTotal)
                      : "--"}
                  </p>
                  <div className="pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        exportTotal({
                          diaristaId: totalRangeDiarista.diaristaId,
                          diaristaNome:
                            diaristaMap.get(totalRangeDiarista.diaristaId || "")
                              ?.nome_completo || "",
                          start: totalRangeDiarista.startDate,
                          end: totalRangeDiarista.endDate,
                          total: diaristaTotal,
                        })
                      }
                    >
                      Exportar total
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-2 rounded-md border bg-muted/30 p-4">
                <p className="text-sm font-semibold text-muted-foreground">
                  Total por diarista e cliente
                </p>
                <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-4">
                  <div className="space-y-1">
                    <Label htmlFor={`total-diarista-cliente-${statusKey}`}>
                      Diarista
                    </Label>
                    <Select
                      value={totalRangeCliente.diaristaId || selectAllValue}
                      onValueChange={(value) =>
                        setTotalRangeCliente((prev) => ({
                          ...prev,
                          diaristaId: value === selectAllValue ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger id={`total-diarista-cliente-${statusKey}`}>
                        <SelectValue placeholder="Selecione o diarista" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={selectAllValue}>
                          Selecione o diarista
                        </SelectItem>
                        {diaristaOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`total-inicio-cliente-${statusKey}`}>
                      Data inicial
                    </Label>
                    <Input
                      id={`total-inicio-cliente-${statusKey}`}
                      type="date"
                      value={totalRangeCliente.startDate}
                      onChange={(event) =>
                        setTotalRangeCliente((prev) => ({
                          ...prev,
                          startDate: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`total-fim-cliente-${statusKey}`}>
                      Data final
                    </Label>
                    <Input
                      id={`total-fim-cliente-${statusKey}`}
                      type="date"
                      value={totalRangeCliente.endDate}
                      onChange={(event) =>
                        setTotalRangeCliente((prev) => ({
                          ...prev,
                          endDate: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`total-cliente-${statusKey}`}>
                      Cliente (do posto)
                    </Label>
                    <Select
                      value={totalRangeCliente.clienteId || selectAllValue}
                      onValueChange={(value) =>
                        setTotalRangeCliente((prev) => ({
                          ...prev,
                          clienteId: value === selectAllValue ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger id={`total-cliente-${statusKey}`}>
                        <SelectValue placeholder="Selecione o cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={selectAllValue}>
                          Selecione o cliente
                        </SelectItem>
                        {clienteOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="rounded-md border bg-background/80 p-3">
                  <p className="text-sm text-muted-foreground">
                    Total no periodo (com cliente)
                  </p>
                  <p className="text-2xl font-semibold">
                    {diaristaClienteTotal !== null
                      ? currencyFormatter.format(diaristaClienteTotal)
                      : "--"}
                  </p>
                  <div className="pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        exportTotal({
                          diaristaId: totalRangeCliente.diaristaId,
                          diaristaNome:
                            diaristaMap.get(totalRangeCliente.diaristaId || "")
                              ?.nome_completo || "",
                          start: totalRangeCliente.startDate,
                          end: totalRangeCliente.endDate,
                          clienteId: totalRangeCliente.clienteId,
                          clienteNome:
                            clienteOptions.find(
                              (c) => c.id === totalRangeCliente.clienteId
                            )?.nome || "",
                          total: diaristaClienteTotal,
                        })
                      }
                    >
                      Exportar total
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-2 rounded-md border bg-muted/30 p-4">
                <p className="text-sm font-semibold text-muted-foreground">
                  Total por cliente
                </p>
                <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-3">
                  <div className="space-y-1">
                    <Label htmlFor={`total-cliente-only-${statusKey}`}>
                      Cliente
                    </Label>
                    <Select
                      value={totalRangeClienteOnly.clienteId || selectAllValue}
                      onValueChange={(value) =>
                        setTotalRangeClienteOnly((prev) => ({
                          ...prev,
                          clienteId: value === selectAllValue ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger id={`total-cliente-only-${statusKey}`}>
                        <SelectValue placeholder="Selecione o cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={selectAllValue}>
                          Selecione o cliente
                        </SelectItem>
                        {clienteFilterOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`total-cliente-inicio-${statusKey}`}>
                      Data inicial
                    </Label>
                    <Input
                      id={`total-cliente-inicio-${statusKey}`}
                      type="date"
                      value={totalRangeClienteOnly.startDate}
                      onChange={(event) =>
                        setTotalRangeClienteOnly((prev) => ({
                          ...prev,
                          startDate: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`total-cliente-fim-${statusKey}`}>
                      Data final
                    </Label>
                    <Input
                      id={`total-cliente-fim-${statusKey}`}
                      type="date"
                      value={totalRangeClienteOnly.endDate}
                      onChange={(event) =>
                        setTotalRangeClienteOnly((prev) => ({
                          ...prev,
                          endDate: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="rounded-md border bg-background/80 p-3">
                  <p className="text-sm text-muted-foreground">
                    Total no periodo (cliente)
                  </p>
                  <p className="text-2xl font-semibold">
                    {clienteTotal !== null
                      ? currencyFormatter.format(clienteTotal)
                      : "--"}
                  </p>
                  <div className="pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportClienteTotal}
                    >
                      Exportar total
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => setTotalDialogOpen(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={groupDetailsDialogOpen}
          onOpenChange={(open) => (open ? null : closeGroupDetailsDialog())}
        >
          <DialogContent className="max-w-4xl w-full">
            <DialogHeader>
              <DialogTitle>Detalhes do agrupamento</DialogTitle>
              <DialogDescription>
                Informacoes completas das diarias deste grupo.
              </DialogDescription>
            </DialogHeader>
            {selectedGroup ? (
              <div className="space-y-6 text-sm">
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Resumo do grupo
                  </p>
                  <div className="mt-2 grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-muted-foreground text-xs">Diarista</p>
                      <p className="font-medium">
                        {selectedGroup.diaristaNome || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Cliente</p>
                      <p className="font-medium">
                        {selectedGroup.clienteLabel || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">
                        Pix do diarista
                      </p>
                      <p className="font-medium break-all">
                        {selectedGroup.diaristaPix ||
                          selectedGroupDiaristaInfo?.pix ||
                          "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Qtd</p>
                      <p className="font-medium">{selectedGroup.count}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Total</p>
                      <p className="font-medium">
                        {currencyFormatter.format(selectedGroup.totalValor)}
                      </p>
                    </div>
                    {selectedGroupDiaristaInfo?.cpf && (
                      <div>
                        <p className="text-muted-foreground text-xs">
                          CPF diarista
                        </p>
                        <p className="font-medium">
                          {selectedGroupDiaristaInfo.cpf}
                        </p>
                      </div>
                    )}
                    {groupObservacaoPagamento && (
                      <div className="md:col-span-2">
                        <p className="text-muted-foreground text-xs">
                          Observacao pagamento
                        </p>
                        <p className="font-medium whitespace-pre-line">
                          {groupObservacaoPagamento}
                        </p>
                      </div>
                    )}
                    {groupOutrosMotivos && (
                      <div className="md:col-span-2">
                        <p className="text-muted-foreground text-xs">
                          Outros motivos reprovacao pagamento
                        </p>
                        <p className="font-medium whitespace-pre-line">
                          {groupOutrosMotivos}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Diarias do grupo
                  </p>
                  <div className="mt-2 overflow-x-auto">
                    {selectedGroupDiarias.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4">
                        Nenhuma diaria encontrada para este grupo.
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Motivo</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead className="hidden md:table-cell">
                              Unidade
                            </TableHead>
                            <TableHead className="hidden md:table-cell">
                              Aprovada por
                            </TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedGroupDiarias.map((diaria) => {
                            const postoInfo =
                              diaria.posto ||
                              (diaria.posto_servico_id
                                ? postoMap.get(diaria.posto_servico_id)
                                : null);
                            const clienteNome =
                              getClienteOuCentroCustoDisplay(
                                diaria,
                                postoInfo
                              ).value || "-";
                            const postoNome =
                              diaria.posto_servico?.trim() ||
                              postoInfo?.nome ||
                              "-";
                            const unidadeNome =
                              toTrimOrNull(diaria.unidade) ||
                              postoInfo?.unidade?.nome ||
                              "-";
                            const valor =
                              typeof diaria.valor_diaria === "number"
                                ? diaria.valor_diaria
                                : Number(diaria.valor_diaria) || 0;
                            const aprovadaPorNome = getUsuarioNome(
                              diaria.aprovada_por
                            );
                            const rowClasses = getPagamentoRowClasses(
                              diaria.ok_pagamento
                            );
                            const rowStyle = getPagamentoRowStyle(
                              diaria.ok_pagamento
                            );
                            return (
                              <TableRow
                                key={diaria.id}
                                className={rowClasses}
                                style={rowStyle}
                              >
                                <TableCell>
                                  {formatDate(diaria.data_diaria)}
                                </TableCell>
                                <TableCell>
                                  {diaria.motivo_vago || "-"}
                                </TableCell>
                                <TableCell>{clienteNome}</TableCell>
                                <TableCell className="hidden md:table-cell">
                                  {unidadeNome}
                                </TableCell>
                                <TableCell className="hidden md:table-cell">
                                  {aprovadaPorNome || "-"}
                                </TableCell>
                                <TableCell className="text-right">
                                  {currencyFormatter.format(valor)}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Grupo nao encontrado.
              </p>
            )}
            <DialogFooter>
              <Button type="button" onClick={closeGroupDetailsDialog}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={naoOkDialogOpen}
          onOpenChange={(open) => (open ? null : closeNaoOkDialog())}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Reprovar pagamento</DialogTitle>
              <DialogDescription>
                Selecione o motivo e, se necessario, registre outro motivo para
                a reprovacao.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-md border px-3 py-2 text-sm">
                <p>
                  <span className="font-semibold">Diarista:</span>{" "}
                  {naoOkDiaristaNome}
                </p>
                {naoOkTarget?.type === "single" ? (
                  <>
                    <p>
                      <span className="font-semibold">Data:</span>{" "}
                      {formatDate(naoOkTarget.diaria.data_diaria)}
                    </p>
                    <p>
                      <span className="font-semibold">Valor:</span>{" "}
                      {currencyFormatter.format(
                        naoOkTarget.diaria.valor_diaria || 0
                      )}
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      <span className="font-semibold">Quantidade:</span>{" "}
                      {naoOkTarget?.type === "group" ? naoOkTarget.count : "-"}
                    </p>
                    <p>
                      <span className="font-semibold">Total:</span>{" "}
                      {naoOkTarget?.type === "group"
                        ? currencyFormatter.format(naoOkTarget.totalValor)
                        : "-"}
                    </p>
                  </>
                )}
              </div>
              <div className="space-y-1">
                <TooltipLabel
                  htmlFor="nao-ok-observacao"
                  label="Motivos da reprovação"
                  tooltip="Selecione um ou mais motivos para a reprovacao do pagamento."
                />
                <div className="space-y-2 rounded-md border p-3">
                  {observacaoPagamentoOptions.map((option) => (
                    <label
                      key={option}
                      className="flex items-start gap-2 text-sm"
                    >
                      <Checkbox
                        checked={naoOkObservacao.includes(option)}
                        onCheckedChange={() => toggleNaoOkObservacao(option)}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                  {observacaoPagamentoOptions.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Nenhum motivo disponivel no momento.
                    </p>
                  )}
                </div>
              </div>
              {naoOkObservacao.length > 0 && naoOkWantsOutroMotivo !== true && (
                <div className="space-y-2 rounded-md border bg-muted/40 p-3">
                  <p className="text-sm font-medium">
                    Deseja registrar outro motivo para a reprovacao?
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={naoOkSaving}
                      onClick={() => handleNaoOkPagamento(false)}
                    >
                      Nao
                    </Button>
                    <Button
                      type="button"
                      variant="default"
                      disabled={naoOkSaving}
                      onClick={() => setNaoOkWantsOutroMotivo(true)}
                    >
                      Sim
                    </Button>
                  </div>
                </div>
              )}
              {naoOkWantsOutroMotivo && (
                <div className="space-y-1">
                  <TooltipLabel
                    htmlFor="nao-ok-outro-motivo"
                    label="Outro motivo"
                    tooltip="Descreva outro motivo para a reprovacao do pagamento."
                  />
                  <Textarea
                    id="nao-ok-outro-motivo"
                    value={naoOkOutroMotivo}
                    onChange={(event) =>
                      setNaoOkOutroMotivo(event.target.value)
                    }
                    placeholder="Descreva o motivo adicional"
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeNaoOkDialog}
              >
                Cancelar
              </Button>
              {naoOkWantsOutroMotivo && (
                <Button
                  type="button"
                  onClick={() => handleNaoOkPagamento(true)}
                  disabled={naoOkSaving}
                >
                  {naoOkSaving ? "Salvando..." : "Salvar"}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={detailsDialogOpen}
          onOpenChange={(open) => (open ? null : closeDetailsDialog())}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Detalhes da diaria</DialogTitle>
              <DialogDescription>
                Informacoes completas da diaria selecionada.
              </DialogDescription>
            </DialogHeader>
            {selectedDiaria && (
              <div className="space-y-6 text-sm">
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Informacoes gerais
                  </p>
                  <div className="mt-2 flex flex-col gap-3 md:grid md:grid-cols-2">
                    <div>
                      <p className="text-muted-foreground text-xs">Data</p>
                      <p className="font-medium">
                        {formatDate(selectedDiaria.data_diaria)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Status</p>
                      <p className="font-medium">
                        {STATUS_LABELS[selectedDiaria.status] ||
                          selectedDiaria.status}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Motivo</p>
                      <p className="font-medium">
                        {selectedDiaria.motivo_vago || "-"}
                      </p>
                    </div>
                    {motivoVagaEmAbertoSelecionado && (
                      <>
                        <div>
                          <p className="text-muted-foreground text-xs">
                            Demissao?
                          </p>
                          <p className="font-medium">
                            {formatBooleanFlag(selectedDiaria.demissao)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">
                            Novo posto?
                          </p>
                          <p className="font-medium">
                            {formatBooleanFlag(selectedNovoPostoFlag)}
                          </p>
                        </div>
                      </>
                    )}
                    <div>
                      <p className="text-muted-foreground text-xs">Posto</p>
                      <p className="font-medium">{selectedPostoNome}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Unidade</p>
                      <p className="font-medium">{selectedUnidadeNome}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">
                        {selectedClienteDisplay.label}
                      </p>
                      <p className="font-medium">{selectedClienteNome}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Valor</p>
                      <p className="font-medium">
                        {currencyFormatter.format(
                          selectedDiaria.valor_diaria || 0
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">
                        OK pagamento
                      </p>
                      <p className="font-medium">
                        {selectedDiaria.ok_pagamento === true
                          ? "Sim"
                          : selectedDiaria.ok_pagamento === false
                          ? "Nao"
                          : "-"}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-muted-foreground text-xs">
                        Observacao pagamento
                      </p>
                      <p className="font-medium whitespace-pre-line">
                        {formatObservacaoPagamento(
                          selectedDiaria.observacao_pagamento
                        ) || "-"}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-muted-foreground text-xs">
                        Outros motivos reprovacao pagamento
                      </p>
                      <p className="font-medium whitespace-pre-line">
                        {selectedDiaria.outros_motivos_reprovacao_pagamento ||
                          "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Criada em</p>
                      <p className="font-medium">
                        {formatDateTime(selectedDiaria.created_at)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">
                        Criado por
                      </p>
                      <p className="font-medium">{criadoPorNome || "-"}</p>
                    </div>
                    {statusDatesWithCreated.length > 0 && (
                      <div className="sm:col-span-2">
                        <p className="text-muted-foreground text-xs">
                          Datas dos status
                        </p>
                        <div className="mt-2 flex flex-col gap-2 md:grid md:grid-cols-2">
                          {statusDatesWithCreated.map((item) => (
                            <div key={item.label}>
                              <p className="text-muted-foreground text-xs">
                                {item.label}
                              </p>
                              <p className="font-medium">{item.value}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {isPagaPage && (
                      <>
                        <div>
                          <p className="text-muted-foreground text-xs">
                            Confirmada por
                          </p>
                          <p className="font-medium">
                            {confirmadaPorNome || "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">
                            OK pagamento por
                          </p>
                          <p className="font-medium">
                            {okPagamentoPorNome || "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">
                            Lancada por
                          </p>
                          <p className="font-medium">{lancadaPorNome || "-"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">
                            Paga por
                          </p>
                          <p className="font-medium">{pagaPorNome || "-"}</p>
                        </div>
                      </>
                    )}
                    {!isAguardandoPage && statusResponsavelInfo.id && (
                      <div>
                        <p className="text-muted-foreground text-xs">
                          Responsavel (
                          {statusResponsavelInfo.label.toLowerCase()})
                        </p>
                        <p className="font-medium">
                          {statusResponsavelNome || "-"}
                        </p>
                      </div>
                    )}
                    {motivoVagaEmAbertoSelecionado &&
                      selectedDiaria?.demissao === true && (
                        <div className="sm:col-span-2">
                          <p className="text-muted-foreground text-xs">
                            Colaborador demitido
                          </p>
                          <p className="font-medium">
                            {selectedColaboradorDemitidoNome || "-"}
                          </p>
                        </div>
                      )}
                    {motivoVagaEmAbertoSelecionado &&
                      selectedDiaria?.demissao === false && (
                        <div className="sm:col-span-2">
                          <p className="text-muted-foreground text-xs">
                            Novo posto?
                          </p>
                          <p className="font-medium">
                            {selectedNovoPostoFlag ? "Sim" : "Nao"}
                          </p>
                        </div>
                      )}
                    {isReprovadaPage && selectedDiaria.motivo_reprovacao && (
                      <div className="sm:col-span-2">
                        <p className="text-muted-foreground text-xs">
                          Motivo reprovacao
                        </p>
                        <p className="font-medium whitespace-pre-line">
                          {selectedDiaria.motivo_reprovacao}
                        </p>
                      </div>
                    )}
                    {isReprovadaPage &&
                      toTrimOrNull(
                        selectedDiaria.motivo_reprovacao_observacao
                      ) && (
                        <div className="sm:col-span-2">
                          <p className="text-muted-foreground text-xs">
                            Observacao reprovacao
                          </p>
                          <p className="font-medium whitespace-pre-line">
                            {toTrimOrNull(
                              selectedDiaria.motivo_reprovacao_observacao
                            )}
                          </p>
                        </div>
                      )}
                    {selectedDiaria.motivo_cancelamento && (
                      <div className="sm:col-span-2">
                        <p className="text-muted-foreground text-xs">
                          Motivo cancelamento
                        </p>
                        <p className="font-medium whitespace-pre-line">
                          {selectedDiaria.motivo_cancelamento}
                        </p>
                      </div>
                    )}
                    {selectedDiaria.observacao?.trim() && (
                      <div className="sm:col-span-2">
                        <p className="text-muted-foreground text-xs">
                          Observacao
                        </p>
                        <p className="font-medium whitespace-pre-line">
                          {selectedDiaria.observacao.trim()}
                        </p>
                      </div>
                    )}
                    {isFaltaSelecionada && (
                      <div className="sm:col-span-2">
                        <p className="text-muted-foreground text-xs">Falta</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge
                            variant={isFaltaInjustificada ? "destructive" : "default"}
                          >
                            {isFaltaInjustificada
                              ? "Falta injustificada"
                              : "Falta justificada"}
                          </Badge>
                          {faltaInfo?.justificada_em && (
                            <span className="text-xs text-muted-foreground">
                              Justificada em {formatDateTime(faltaInfo.justificada_em)}
                            </span>
                          )}
                          {faltaInfo?.justificada_por && (
                            <span className="text-xs text-muted-foreground">
                              por {faltaJustificadaPorNome}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {faltaInfo?.documento_url && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                handleViewFaltaDocumento(faltaInfo.documento_url as string)
                              }
                            >
                              Ver atestado
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Horarios
                  </p>
                  <div className="mt-2 flex flex-col gap-3 md:grid md:grid-cols-4">
                    <div>
                      <p className="text-muted-foreground text-xs">
                        Horario inicio
                      </p>
                      <p className="font-medium">
                        {formatTimeValue(selectedDiaria.horario_inicio)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">
                        Horario fim
                      </p>
                      <p className="font-medium">
                        {formatTimeValue(selectedDiaria.horario_fim)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">
                        Jornada diaria
                      </p>
                      <p className="font-medium">
                        {formatJornadaValue(getJornadaDiariaValue(selectedDiaria))}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Intervalo</p>
                      <p className="font-medium">
                        {formatIntervalValue(selectedDiaria.intervalo)}
                      </p>
                    </div>
                  </div>
                </div>

                {!motivoVagaEmAbertoSelecionado && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      Colaborador ausente
                    </p>
                    <div className="mt-2 flex flex-col gap-3 md:grid md:grid-cols-2">
                      <div>
                        <p className="text-muted-foreground text-xs">Nome</p>
                        <p className="font-medium">{selectedColaboradorNome}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Diarista
                  </p>
                  <div className="mt-2 flex flex-col gap-3 md:grid md:grid-cols-2">
                    <div>
                      <p className="text-muted-foreground text-xs">Nome</p>
                      <p className="font-medium flex flex-wrap items-center gap-2">
                        <span>
                          {selectedDiaristaInfo?.nome_completo || "-"}
                        </span>
                        {selectedDiaristaCadastroIncompleto && (
                          <CadastroIncompletoBadge />
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">CPF</p>
                      <p className="font-medium">
                        {selectedDiaristaInfo?.cpf || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Status</p>
                      <p className="font-medium">
                        {selectedDiaristaInfo?.status || "-"}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Dados bancarios
                  </p>
                  <div className="mt-2 flex flex-col gap-3 md:grid md:grid-cols-2">
                    <div>
                      <p className="text-muted-foreground text-xs">Banco</p>
                      <p className="font-medium">
                        {selectedDiaristaInfo?.banco || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Agencia</p>
                      <p className="font-medium">
                        {selectedDiaristaInfo?.agencia || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">
                        Numero da conta
                      </p>
                      <p className="font-medium">
                        {selectedDiaristaInfo?.numero_conta || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">
                        Tipo de conta
                      </p>
                      <p className="font-medium">
                        {selectedDiaristaInfo?.tipo_conta || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Chave Pix</p>
                      <p className="font-medium break-all">
                        {selectedDiaristaInfo?.pix || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">
                        Pix pertence ao diarista?
                      </p>
                      <p className="font-medium">
                        {formatPixPertence(
                          selectedDiaristaInfo?.pix_pertence_beneficiario
                        )}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex flex-col gap-2 md:hidden">
                  {statusKey === STATUS.confirmada && (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={updatingId === selectedDiaria.id.toString()}
                      onClick={() => {
                        closeDetailsDialog();
                        openReasonDialog(
                          selectedDiaria.id.toString(),
                          STATUS.reprovada
                        );
                      }}
                    >
                      Reprovar
                    </Button>
                  )}
                  {isAguardandoPage && (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={updatingId === selectedDiaria.id.toString()}
                      onClick={() => {
                        closeDetailsDialog();
                        openReasonDialog(
                          selectedDiaria.id.toString(),
                          STATUS.cancelada
                        );
                      }}
                    >
                      Cancelar
                    </Button>
                  )}
                  {detailsActionElement && <div>{detailsActionElement}</div>}
                  <Button
                    type="button"
                    variant="default"
                    className="bg-amber-400 text-black hover:bg-amber-500"
                    disabled={!canEditDiaria(selectedDiaria)}
                    onClick={() => {
                      openEditDialog(selectedDiaria);
                      closeDetailsDialog();
                    }}
                  >
                    Editar diaria
                  </Button>
                  {allowDelete && (
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={deletingId === selectedDiaria.id.toString()}
                      onClick={() => {
                        closeDetailsDialog();
                        handleDeleteDiaria(selectedDiaria.id.toString());
                      }}
                    >
                      Excluir diaria
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeDetailsDialog}
                  >
                    Fechar
                  </Button>
                </div>
              </div>
            )}
            <DialogFooter className="hidden md:flex">
              {selectedDiaria && (
                <Button
                  type="button"
                  variant="default"
                  className="bg-amber-400 text-black hover:bg-amber-500"
                  disabled={!canEditDiaria(selectedDiaria)}
                  onClick={() => {
                    openEditDialog(selectedDiaria);
                    closeDetailsDialog();
                  }}
                >
                  Editar diária
                </Button>
              )}
              <Button type="button" onClick={closeDetailsDialog}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={editDialogOpen}
          onOpenChange={(open) => (open ? null : closeEditDialog())}
        >
          <DialogContent className="max-w-3xl w-full">
            <DialogHeader>
              <DialogTitle>Editar diária</DialogTitle>
              <DialogDescription>
                Atualize os dados da diária temporária.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <TooltipLabel label="Data" tooltip="Dia da diaria." />
                <Input
                  type="date"
                  value={editForm.dataDiaria}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      dataDiaria: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-1">
                <TooltipLabel
                  label="Horário início"
                  tooltip="Horario em que o diarista deve iniciar a diaria."
                />
                <Input
                  type="time"
                  value={editForm.horarioInicio}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      horarioInicio: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-1">
                <TooltipLabel
                  label="Horário fim"
                  tooltip="Horario previsto para encerrar a diaria."
                />
                <Input
                  type="time"
                  value={editForm.horarioFim}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      horarioFim: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-1">
                <TooltipLabel
                  label="Intervalo (min)"
                  tooltip="Tempo total de intervalo em minutos. Deixe vazio se nao souber."
                />
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={editForm.intervalo}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      intervalo: e.target.value,
                    }))
                  }
                  placeholder="Opcional"
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <TooltipLabel
                  label="Centro de custo"
                  tooltip="Centro de custo associado a diaria."
                />
                <Select
                  value={editForm.centroCustoId || OPTIONAL_VALUE}
                  onValueChange={(value) =>
                    setEditForm((prev) => ({
                      ...prev,
                      centroCustoId: value === OPTIONAL_VALUE ? "" : value,
                      postoServicoId: "",
                      colaboradorAusenteId: "",
                      colaboradorDemitidoId: "",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o centro de custo" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72 overflow-y-auto">
                    <SelectItem value={OPTIONAL_VALUE} disabled>
                      Selecione
                    </SelectItem>
                    {costCenterOptionsAll.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 md:col-span-2">
                <TooltipLabel
                  label="Motivo"
                  tooltip="Motivo que levou a necessidade da diária."
                />
                <Select
                  required
                  value={editForm.motivoVago}
                  onValueChange={(value) => {
                    const upperValue = value.toUpperCase();
                    const isVagaAberto =
                      upperValue === MOTIVO_VAGO_VAGA_EM_ABERTO.toUpperCase();
                    setEditForm((prev) => ({
                      ...prev,
                      motivoVago: value,
                      colaboradorAusenteId: isVagaAberto
                        ? ""
                        : prev.colaboradorAusenteId,
                      demissao: null,
                      colaboradorDemitidoId: "",
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o motivo" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64 overflow-y-auto">
                    {MOTIVO_VAGO_OPTIONS.map((motivo) => (
                      <SelectItem key={motivo} value={motivo}>
                        {motivo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!isEditMotivoVaga && (
                <div className="space-y-1 md:col-span-2">
                  <TooltipLabel
                    label="Colaborador ausente"
                    tooltip="Colaborador que sera coberto pela diaria."
                  />
                  <Select
                    required
                    value={editForm.colaboradorAusenteId}
                    onValueChange={(value) =>
                      setEditForm((prev) => ({
                        ...prev,
                        colaboradorAusenteId: value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o colaborador" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72 overflow-y-auto">
                      {colaboradoresOptionsByCentroCusto.length === 0 && (
                        <SelectItem value="none" disabled>
                          Nenhum colaborador encontrado
                        </SelectItem>
                      )}
                      {colaboradoresOptionsByCentroCusto.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {isEditMotivoVaga && (
                <>
                  <div className="space-y-1">
                    <TooltipLabel
                      label="É demissão?"
                      tooltip="Indique se a vaga em aberto ocorreu por demissao."
                    />
                    <Select
                      required
                      value={demissaoSelectValue}
                      onValueChange={(value) =>
                        setEditForm((prev) => ({
                          ...prev,
                          demissao:
                            value === UNSET_BOOL ? null : value === "true",
                          colaboradorDemitidoId:
                            value === "true" ? prev.colaboradorDemitidoId : "",
                          colaboradorAusenteId: "",
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma opção" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNSET_BOOL} disabled>
                          Selecione
                        </SelectItem>
                        <SelectItem value="true">Sim</SelectItem>
                        <SelectItem value="false">Não</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {editForm.demissao === true && (
                    <div className="space-y-1 md:col-span-2">
                      <TooltipLabel
                        label="Colaborador demitido"
                        tooltip="Obrigatorio quando for demissao."
                      />
                      <Select
                        required
                        value={editForm.colaboradorDemitidoId}
                        onValueChange={(value) =>
                          setEditForm((prev) => ({
                            ...prev,
                            colaboradorDemitidoId: value,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o colaborador" />
                        </SelectTrigger>
                        <SelectContent className="max-h-72 overflow-y-auto">
                          {colaboradoresOptionsByCentroCusto.length === 0 && (
                            <SelectItem value="none" disabled>
                              Nenhum colaborador encontrado
                            </SelectItem>
                          )}
                          {colaboradoresOptionsByCentroCusto.map((option) => (
                            <SelectItem key={option.id} value={option.id}>
                              {option.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              )}

              <div className="space-y-1">
                <TooltipLabel label="Unidade" tooltip="Informe a unidade." />
                <Input
                  required
                  value={editForm.unidade}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      unidade: e.target.value,
                    }))
                  }
                  placeholder="Nome da unidade"
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <TooltipLabel
                  label="Posto"
                  tooltip=" Posto onde o diarista vai atuar nesta diaria."
                />
                <Select
                  value={editForm.postoServicoId || OPTIONAL_VALUE}
                  onValueChange={(value) => {
                    const postoId = value === OPTIONAL_VALUE ? "" : value;
                    const postoInfo = postoId ? postoMap.get(postoId) : null;
                    const unidadeFromPosto = postoInfo?.unidade?.nome || "";
                    setEditForm((prev) => {
                      const nextCentroCustoId = postoInfo?.cost_center_id
                        ? String(postoInfo.cost_center_id)
                        : prev.centroCustoId;
                      const shouldResetColaboradores =
                        nextCentroCustoId !== prev.centroCustoId;
                      return {
                        ...prev,
                        postoServicoId: postoId,
                        centroCustoId: nextCentroCustoId,
                        unidade: toTrimOrNull(prev.unidade)
                          ? prev.unidade
                          : unidadeFromPosto,
                        colaboradorAusenteId: shouldResetColaboradores
                          ? ""
                          : prev.colaboradorAusenteId,
                        colaboradorDemitidoId: shouldResetColaboradores
                          ? ""
                          : prev.colaboradorDemitidoId,
                      };
                    });
                  }}
                  disabled={!editForm.centroCustoId}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        editForm.centroCustoId
                          ? "Selecione o posto"
                          : "Escolha o centro de custo primeiro"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className="max-h-64 overflow-y-auto">
                    <SelectItem value={OPTIONAL_VALUE} disabled>
                      Selecione
                    </SelectItem>
                    {postosOptions
                      .filter(
                        (posto) =>
                          !editForm.centroCustoId ||
                          (posto.cost_center_id &&
                            posto.cost_center_id.toString() ===
                              editForm.centroCustoId)
                      )
                      .map((posto) => (
                        <SelectItem key={posto.id} value={posto.id}>
                          {posto.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <TooltipLabel
                  label="Valor da diária (R$)"
                  tooltip="Valor atualizado para a diaria."
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.valorDiaria}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      valorDiaria: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-1">
                <TooltipLabel
                  label="Diarista responsável"
                  tooltip="Diarista que executara a diaria."
                />
                <Select
                  value={editForm.diaristaId}
                  onValueChange={(value) =>
                    setEditForm((prev) => ({ ...prev, diaristaId: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o diarista" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72 overflow-y-auto">
                    {diaristaOptionsAll.map((option) => {
                      const isBlacklisted = blacklistMap.has(option.id);
                      const isRestrito =
                        diaristaStatusMap.get(option.id) === "restrito";
                      const isCurrent = option.id === editForm.diaristaId;
                      const isTest = isTestDiarista(option);
                      const labels = [
                        isBlacklisted ? "Blacklist" : null,
                        isRestrito ? "Restrito" : null,
                      ].filter(Boolean);
                      const statusSuffix =
                        labels.length > 0 ? ` (${labels.join(" / ")})` : "";
                      return (
                        <SelectItem
                          key={option.id}
                          value={option.id}
                          disabled={isRestrito || (isBlacklisted && !isCurrent)}
                          className={
                            isTest
                              ? "bg-yellow-200 text-yellow-900 data-[highlighted]:bg-yellow-300 data-[highlighted]:text-yellow-900"
                              : ""
                          }
                        >
                          {option.nome}
                          {statusSuffix}
                          {isTest && (
                            <span className="ml-2 rounded-full bg-yellow-300 px-2 py-0.5 text-[10px] font-semibold text-yellow-900">
                              Diarista teste (nao compoe a base real de
                              diaristas)
                            </span>
                          )}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 md:col-span-2">
                <TooltipLabel
                  label="Observação"
                  tooltip="Observacoes adicionais ou instrucoes relevantes."
                />
                <Textarea
                  value={editForm.observacao}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      observacao: e.target.value,
                    }))
                  }
                  placeholder="Opcional"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeEditDialog}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleEditSubmit}
                disabled={editingSaving}
              >
                {editingSaving ? "Salvando..." : "Salvar alterações"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <FaltaJustificarDialog
          open={faltaDialogOpen}
          onOpenChange={handleFaltaDialogOpenChange}
          diariaId={faltaDialogDiaria?.id ?? null}
          colaboradorId={
            faltaDialogDiaria?.colaborador_ausente_convenia ??
            faltaDialogDiaria?.colaborador_ausente ??
            null
          }
          colaboradorNome={
            faltaDialogDiaria?.colaborador_ausente_convenia
              ? getConveniaColaboradorNome(
                  colaboradoresConveniaMap.get(
                    faltaDialogDiaria.colaborador_ausente_convenia
                  )
                )
              : faltaDialogDiaria?.colaborador_ausente
                ? colaboradoresMap.get(faltaDialogDiaria.colaborador_ausente)?.nome_completo
              : null
          }
          dataDiariaLabel={
            faltaDialogDiaria ? formatDate(faltaDialogDiaria.data_diaria) : null
          }
          rpcName={
            faltaDialogDiaria?.colaborador_ausente_convenia
              ? "justificar_falta_convenia"
              : "justificar_falta_diaria_temporaria"
          }
          onSuccess={async () => {
            await refetchDiarias();
            if (selectedDiaria?.id) {
              await refetchFaltaInfo();
            }
          }}
        />
      </DashboardLayout>
    );
  };
};

export const Diarias2AguardandoPage = createStatusPage(STATUS_CONFIGS[0]);
export const Diarias2ConfirmadasPage = createStatusPage(STATUS_CONFIGS[1]);
export const Diarias2AprovadasPage = createStatusPage(STATUS_CONFIGS[2]);
export const Diarias2LancadasPage = createStatusPage(STATUS_CONFIGS[3]);
export const Diarias2ReprovadasPage = createStatusPage(STATUS_CONFIGS[4]);
export const Diarias2CanceladasPage = createStatusPage(STATUS_CONFIGS[5]);
export const Diarias2PagasPage = createStatusPage(STATUS_CONFIGS[6]);
