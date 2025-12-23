import { useMemo, useState, useEffect } from "react";
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
import {
  STATUS,
  STATUS_LABELS,
  NEXT_STATUS_ACTIONS,
  currencyFormatter,
  currentMonthValue,
  formatDate,
  formatDateTime,
  STATUS_BADGE,
  normalizeStatus,
  getMonthValue,
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
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Bell } from "lucide-react";
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
    statusKey: STATUS.aprovadaPagamento,
    title: "Diarias aprovadas para pagamento",
    description: "Acompanhe diarias aprovadas em fase final de pagamento.",
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
const MOTIVO_VAGO_OPTIONS = [
  MOTIVO_VAGO_VAGA_EM_ABERTO,
  "FALTA INJUSTIFICADA",
  "LICENÇA MATERNIDADE",
  "LICENÇA PATERNIDADE",
  "LICENÇA CASAMENTO",
  MOTIVO_VAGO_LICENCA_NOJO_FALECIMENTO,
  "AFASTAMENTO INSS",
  "FÉRIAS",
  "SUSPENSÃO",
];

const TooltipLabel = ({
  label,
  tooltip,
  htmlFor,
}: { label: string; tooltip: string; htmlFor?: string }) => (
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

const MOTIVO_LICENCA_NOJO_FALECIMENTO = "LICENÇA NOJO (FALECIMENTO)";
const STATUS_DATE_LABELS: { field: keyof DiariaTemporaria; label: string }[] = [
  { field: "confirmada_em", label: "Confirmada em" },
  { field: "aprovada_em", label: "Aprovada em" },
  { field: "lancada_em", label: "Lancada em" },
  { field: "aprovada_para_pagamento_em", label: "Aprovada para pagamento em" },
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
    normalizeStatus(STATUS.aprovadaPagamento),
    {
      field: "aprovada_para_pagamento_em",
      startLabel: "Primeiro dia aprovacao pagamento",
      endLabel: "Ultimo dia aprovacao pagamento",
      exportLabel: "Aprovada para pagamento em",
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

const createStatusPage = ({ statusKey, title, description, emptyMessage }: StatusPageConfig) => {
  return function DiariasTemporariasStatusPage() {
    const [selectedMonth, setSelectedMonth] = useState(currentMonthValue);
    const {
      filteredDiarias,
      diarias,
      refetchDiarias,
      loadingDiarias,
      clientes,
      diaristaMap,
      colaboradoresMap,
      postoMap,
      clienteMap,
      usuarioMap,
    } = useDiariasTemporariasData(selectedMonth);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [customStatusSelection, setCustomStatusSelection] = useState<Record<string, string>>({});
    const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
    const [selectedDiaria, setSelectedDiaria] = useState<DiariaTemporaria | null>(null);
    const [reasonDialog, setReasonDialog] = useState<{
      open: boolean;
      diariaId: string | null;
      targetStatus: string | null;
    }>({ open: false, diariaId: null, targetStatus: null });
    const [reasonText, setReasonText] = useState("");
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkStatusSelection, setBulkStatusSelection] = useState("");
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editingDiariaId, setEditingDiariaId] = useState<string | null>(null);
    const [editingSaving, setEditingSaving] = useState(false);
    const OPTIONAL_VALUE = "__none__";
    const UNSET_BOOL = "__unset__";
    const [editForm, setEditForm] = useState({
      dataDiaria: "",
      horarioInicio: "",
      horarioFim: "",
      intervalo: "",
      motivoVago: "",
      postoServicoId: "",
      clienteId: "",
      valorDiaria: "",
      diaristaId: "",
      colaboradorNome: "",
      colaboradorFalecido: "",
      colaboradorDemitidoNome: "",
      demissao: null as boolean | null,
      licencaNojo: null as boolean | null,
      novoPosto: null as boolean | null,
      observacao: "",
    });
    const [filters, setFilters] = useState({
      diaristaId: "",
      motivo: "",
      clienteId: "",
      startDate: "",
      endDate: "",
      criadoPorId: "",
      statusResponsavelId: "",
      statusDateStart: "",
      statusDateEnd: "",
    });
    const [totalRangeDiarista, setTotalRangeDiarista] = useState({
      diaristaId: "",
      startDate: "",
      endDate: "",
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
    const [totalDialogOpen, setTotalDialogOpen] = useState(false);
    const selectAllValue = "__all__";
    const statusOptions = useMemo(
      () => Object.values(STATUS).filter((status) => status !== STATUS.reprovada),
      [],
    );
    const [extraUserMap, setExtraUserMap] = useState<Map<string, string>>(new Map());

    const normalizedKey = normalizeStatus(statusKey);
    const isAguardandoPage = normalizedKey === normalizeStatus(STATUS.aguardando);
    const normalizedCancelStatus = normalizeStatus(STATUS.cancelada);
    const normalizedReprovadaStatus = normalizeStatus(STATUS.reprovada);
    const isCancelPage = normalizedKey === normalizedCancelStatus;
    const isReprovadaPage = normalizedKey === normalizedReprovadaStatus;
    const allowDelete = isCancelPage || isReprovadaPage;
    const isPagaPage = normalizedKey === normalizeStatus(STATUS.paga);
    const statusResponsavelField = useMemo(() => {
      const map = new Map<string, keyof DiariaTemporaria>([
        [normalizeStatus(STATUS.confirmada), "confirmada_por"],
        [normalizeStatus(STATUS.aprovada), "aprovada_por"],
        [normalizeStatus(STATUS.lancada), "lancada_por"],
        [normalizeStatus(STATUS.aprovadaPagamento), "aprovado_para_pgto_por"],
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
        [STATUS.aprovadaPagamento, "Aprovadas para pagamento por"],
        [STATUS.paga, "Pagas por"],
        [STATUS.reprovada, "Reprovadas por"],
        [STATUS.cancelada, "Canceladas por"],
      ]);
      return map.get(statusKey) || "Responsavel";
    }, [statusKey]);

    const statusResponsavelTooltip = useMemo(() => {
      const map = new Map<string, string>([
        [normalizeStatus(STATUS.confirmada), "Filtra pelo usuario responsavel pela confirmacao."],
        [normalizeStatus(STATUS.aprovada), "Filtra pelo usuario responsavel pela aprovacao."],
        [normalizeStatus(STATUS.lancada), "Filtra pelo usuario responsavel pelo lancamento."],
        [normalizeStatus(STATUS.aprovadaPagamento), "Filtra pelo usuario responsavel pela aprovacao de pagamento."],
        [normalizeStatus(STATUS.paga), "Filtra pelo usuario responsavel pelo pagamento."],
        [normalizeStatus(STATUS.reprovada), "Filtra pelo usuario responsavel pela reprovacao."],
        [normalizeStatus(STATUS.cancelada), "Filtra pelo usuario responsavel pelo cancelamento."],
      ]);
      return map.get(normalizedKey) || "Filtra pelo usuario responsavel pelo status.";
    }, [normalizedKey]);

    const responsavelStatusHeader = useMemo(() => {
      const map = new Map<string, string>([
        [normalizeStatus(STATUS.confirmada), "Responsavel pela confirmacao"],
        [normalizeStatus(STATUS.aprovada), "Responsavel pela aprovacao"],
        [normalizeStatus(STATUS.lancada), "Responsavel lancamento"],
        [normalizeStatus(STATUS.aprovadaPagamento), "Responsavel aprovacao pagamento"],
        [normalizeStatus(STATUS.paga), "Responsavel pagamento"],
        [normalizeStatus(STATUS.reprovada), "Responsavel reprovacao"],
        [normalizeStatus(STATUS.cancelada), "Responsavel cancelamento"],
      ]);
      return map.get(normalizedKey) || "Responsavel status";
    }, [normalizedKey]);

    const pageDefaultAction = useMemo(
      () => NEXT_STATUS_ACTIONS[normalizedKey] || null,
      [normalizedKey],
    );

    const statusDateConfig = useMemo(
      () => STATUS_DATE_FILTERS.get(normalizedKey) || null,
      [normalizedKey],
    );

    const buildStatusDateTooltip = useMemo(
      () =>
        statusDateConfig
          ? {
              start: `Utilize esta opcao de filtro em conjunto com "${statusDateConfig.endLabel}" para selecionar todas as diarias que foram ${(statusDateConfig.exportLabel || statusDateConfig.startLabel || "").replace(/ em$/i, "").toLowerCase()}s dentro desse periodo.`,
              end: `Utilize esta opcao de filtro em conjunto com "${statusDateConfig.startLabel}" para selecionar todas as diarias que foram ${(statusDateConfig.exportLabel || statusDateConfig.endLabel || "").replace(/ em$/i, "").toLowerCase()}s dentro desse periodo.`,
            }
          : { start: "", end: "" },
      [statusDateConfig],
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

    const formatJornadaValue = (value?: number | null) => {
      if (value === null || value === undefined) return "-";
      const parsed = Number(value);
      if (Number.isNaN(parsed)) return "-";
      return `${parsed.toFixed(2)} h`;
    };

    const formatPixPertence = (value?: boolean | null) => {
      if (value === true) return "Sim";
      if (value === false) return "Não";
      return "-";
    };

    const toUpperOrNull = (value: string | null | undefined) => {
      const trimmed = (value ?? "").trim();
      return trimmed ? trimmed.toUpperCase() : null;
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
        case normalizeStatus(STATUS.aprovadaPagamento):
          return { id: diaria.aprovado_para_pgto_por || null, label: "Aprovacao pagamento" };
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

    const uppercaseRows = (rows: Record<string, any>[]) =>
      rows.map((row) => {
    const normalized: Record<string, any> = {};
    Object.entries(row).forEach(([key, value]) => {
      normalized[key] = typeof value === "string" ? value.toUpperCase() : value;
    });
    return normalized;
  });

  const isVagaEmAberto = (motivo?: string | null) =>
    (motivo || "").toUpperCase().includes("VAGA EM ABERTO");
  const isLicencaNojo = (motivo?: string | null) =>
    (motivo || "").toUpperCase() === MOTIVO_LICENCA_NOJO_FALECIMENTO.toUpperCase();

    const diariasDoStatusFull = useMemo(
      () => diarias.filter((diaria) => normalizeStatus(diaria.status) === normalizedKey),
      [diarias, normalizedKey],
    );

    const diariasDoStatus = useMemo(
      () => filteredDiarias.filter((diaria) => normalizeStatus(diaria.status) === normalizedKey),
      [filteredDiarias, normalizedKey],
    );
    const statusNoticeCount = diariasDoStatusFull.length;
    const showStatusNotice = statusNoticeCount > 0;
    const statusNoticeLabel = (STATUS_LABELS[statusKey] || statusKey).toLowerCase();

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
      return null;
    };

    const getClienteNomeFromDiaria = (diaria: DiariaTemporaria, postoInfo: any) => {
      const nomePorId =
        typeof diaria.cliente_id === "number" ? clienteMap.get(diaria.cliente_id) || "" : "";
      const nome = nomePorId || getClienteInfoFromPosto(postoInfo)?.nome || "";
      return nome || "";
    };

    const getClienteKeyFromDiaria = (diaria: DiariaTemporaria, postoInfo: any) => {
      const key =
        (typeof diaria.cliente_id === "number" && diaria.cliente_id.toString()) ||
        (getClienteInfoFromPosto(postoInfo)?.id ? String(getClienteInfoFromPosto(postoInfo)?.id) : "");
      return key;
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
          (diaria.posto_servico_id ? postoMap.get(diaria.posto_servico_id) : null);
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
      const clienteValido = clienteOptions.some((c) => c.id === totalRangeCliente.clienteId)
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
        const diaristaInfo = diaria.diarista || diaristaMap.get(diaria.diarista_id || "");
        if (diaria.diarista_id && diaristaInfo?.nome_completo) {
          map.set(diaria.diarista_id, diaristaInfo.nome_completo);
        }
      });
      return Array.from(map.entries())
        .map(([id, nome]) => ({ id, nome }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
    }, [diariasDoStatusFull, diaristaMap]);

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
        }))
        .filter((p) => p.id);
    }, [postoMap]);

    const clienteOptionsAll = useMemo(
      () =>
        clientes
          .map((c) => ({
            id: c.id.toString(),
            nome: c.nome_fantasia || c.razao_social || c.id.toString(),
          }))
          .sort((a, b) => a.nome.localeCompare(b.nome)),
      [clientes],
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
        const responsavelId = (diaria as any)[statusResponsavelField] as string | null | undefined;
        if (responsavelId) {
          const nome = usuarioMap.get(responsavelId) || "";
          map.set(responsavelId, nome);
        }
      });
      return Array.from(map.entries())
        .map(([id, nome]) => ({ id, nome: nome || "(sem nome)" }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
    }, [diariasDoStatusFull, usuarioMap, statusResponsavelField]);

    const clienteFilterOptions = useMemo(() => {
      const map = new Map<string, string>();
      const source = [...diariasDoStatus, ...diariasDoStatusFull];
      source.forEach((diaria) => {
        const postoInfo =
          diaria.posto ||
          (diaria.posto_servico_id ? postoMap.get(diaria.posto_servico_id) : null);
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

    const diariasBase = useMemo(
      () =>
        filters.startDate || filters.endDate || filters.statusDateStart || filters.statusDateEnd
          ? diariasDoStatusFull
          : diariasDoStatus,
      [
        diariasDoStatus,
        diariasDoStatusFull,
        filters.endDate,
        filters.startDate,
        filters.statusDateEnd,
        filters.statusDateStart,
      ],
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
        collectId(diaria.aprovado_para_pgto_por);
        collectId(diaria.paga_por);
        collectId(diaria.cancelada_por);
        collectId(diaria.reprovada_por);
      });
      if (idsToFetch.size === 0) return;

      const fetchMissing = async () => {
        const ids = Array.from(idsToFetch);
        try {
          const rpcResult = await supabase.rpc("get_profiles_names", { p_ids: ids });
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
            console.warn("RPC get_profiles_names falhou, tentando select direto", rpcResult.error);
          }
        } catch (err) {
          console.warn("RPC get_profiles_names falhou, tentando select direto", err);
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
          (diaria.posto_servico_id ? postoMap.get(diaria.posto_servico_id) : null);
        const clienteKey = getClienteKeyFromDiaria(diaria, postoInfo);
        const data = diaria.data_diaria || "";
        const statusDateValue = statusDateConfig
          ? ((diaria as any)[statusDateConfig.field] as string | null | undefined)
          : null;

        if (filters.startDate) {
          const dataDate = new Date(data);
          const start = new Date(filters.startDate);
          if (Number.isNaN(dataDate.getTime()) || dataDate < start) return false;
        }
        if (filters.endDate) {
          const dataDate = new Date(data);
          const end = new Date(filters.endDate);
          end.setHours(23, 59, 59, 999);
          if (Number.isNaN(dataDate.getTime()) || dataDate > end) return false;
        }

        if (statusDateConfig && (filters.statusDateStart || filters.statusDateEnd)) {
          if (!statusDateValue) return false;
          const statusDate = new Date(statusDateValue);
          if (Number.isNaN(statusDate.getTime())) return false;
          if (filters.statusDateStart) {
            const statusStart = new Date(filters.statusDateStart);
            if (Number.isNaN(statusStart.getTime()) || statusDate < statusStart) return false;
          }
          if (filters.statusDateEnd) {
            const statusEnd = new Date(filters.statusDateEnd);
            if (Number.isNaN(statusEnd.getTime())) return false;
            statusEnd.setHours(23, 59, 59, 999);
            if (statusDate > statusEnd) return false;
          }
        }

        if (filters.diaristaId && filters.diaristaId !== diaristaId) {
          return false;
        }
        if (filters.motivo && filters.motivo !== motivo) {
          return false;
        }
        if (filters.criadoPorId && filters.criadoPorId !== (diaria.criado_por || "")) {
          return false;
        }
        if (filters.clienteId && filters.clienteId !== clienteKey) {
          return false;
        }
        if (filters.statusResponsavelId && statusResponsavelField) {
          const responsavelId = (diaria as any)[statusResponsavelField] || "";
          if (filters.statusResponsavelId !== responsavelId) {
            return false;
          }
        }
        return true;
      });
    }, [diariasBase, filters, statusDateConfig, statusResponsavelField]);

    const buildExportRow = (diaria: DiariaTemporaria) => {
      const postoInfo =
        diaria.posto || (diaria.posto_servico_id ? postoMap.get(diaria.posto_servico_id) : null);
      const diaristaInfo = diaria.diarista || diaristaMap.get(diaria.diarista_id || "");
      const colaboradorInfo =
        diaria.colaborador ||
        (diaria.colaborador_ausente ? colaboradoresMap.get(diaria.colaborador_ausente) : null);
      const clienteNome = getClienteNomeFromDiaria(diaria, postoInfo) || "-";
      const criadoPorNome = getUsuarioNome(diaria.criado_por);
      const { id: responsavelStatusId } = getStatusResponsavel(diaria);
      const responsavelStatusNome = responsavelStatusId ? getUsuarioNome(responsavelStatusId) : "";
      const confirmadaPorNome = getUsuarioNome(diaria.confirmada_por);
      const aprovadaPorNome = getUsuarioNome(diaria.aprovada_por);
      const lancadaPorNome = getUsuarioNome(diaria.lancada_por);
      const aprovadaParaPgtoPorNome = getUsuarioNome(diaria.aprovado_para_pgto_por);
      const pagaPorNome = getUsuarioNome(diaria.paga_por);
      const colaboradorNome = diaria.colaborador_ausente_nome || colaboradorInfo?.nome_completo || "-";
      const colaboradorFalecido = diaria.colaborador_falecido?.trim() || "";
      const colaboradorDemitidoNome = diaria.colaborador_demitido_nome || "";
      const licencaNojoFlag = diaria.licenca_nojo === true;
      const novoPostoFlag = diaria.novo_posto === true;
      const isMotivoLicencaNojo = isLicencaNojo(diaria.motivo_vago);
      const postoNome = diaria.posto_servico?.trim() || postoInfo?.nome || "-";
      const baseRow: Record<string, any> = {
        Data: formatDate(diaria.data_diaria),
        Status: STATUS_LABELS[diaria.status] || diaria.status,
        "Horario inicio": formatTimeValue(diaria.horario_inicio),
        "Horario fim": formatTimeValue(diaria.horario_fim),
        "Jornada diaria (h)": formatJornadaValue(diaria.jornada_diaria),
        "Intervalo (min)": formatIntervalValue(diaria.intervalo),
        "Motivo (dia vago)": diaria.motivo_vago || "-",
        "CPF diarista": diaristaInfo?.cpf || "-",
        Posto: postoNome,
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
        "Pix pertence diarista": formatPixPertence(diaristaInfo?.pix_pertence_beneficiario),
        Observacao: diaria.observacao?.trim() || "",
        "Criado por": criadoPorNome,
        "Criada em": formatDate(diaria.created_at),
      };
      baseRow["Confirmada em"] = formatDate(diaria.confirmada_em);
      baseRow["Aprovada em"] = formatDate(diaria.aprovada_em);
      baseRow["Lancada em"] = formatDate(diaria.lancada_em);
      baseRow["Aprovada para pagamento em"] = formatDate(diaria.aprovada_para_pagamento_em);
      baseRow["Paga em"] = formatDate(diaria.paga_em);
      baseRow["Cancelada em"] = formatDate(diaria.cancelada_em);
      baseRow["Reprovada em"] = formatDate(diaria.reprovada_em);
      baseRow["Novo posto?"] = novoPostoFlag ? "Sim" : "N?o";
      if (!isAguardandoPage) {
        baseRow[responsavelStatusHeader] = responsavelStatusNome || "";
      }
      if (isPagaPage) {
        baseRow["Confirmada por"] = confirmadaPorNome;
        baseRow["Aprovada por"] = aprovadaPorNome;
        baseRow["Lancada por"] = lancadaPorNome;
        baseRow["Aprovada para pagamento por"] = aprovadaParaPgtoPorNome;
        baseRow["Paga por"] = pagaPorNome;
      }

      if (isVagaEmAberto(diaria.motivo_vago)) {
        if (colaboradorDemitidoNome) {
          baseRow["Colaborador demitido"] = colaboradorDemitidoNome;
          baseRow["Novo posto?"] = "N?o";
        } else if (licencaNojoFlag) {
          baseRow["Colaborador falecido"] = colaboradorFalecido || "-";
          baseRow["Novo posto?"] = "N?o";
        } else {
          baseRow["Novo posto?"] = "Sim";
        }
      } else if (isMotivoLicencaNojo) {
        baseRow["Colaborador falecido"] = colaboradorFalecido || "-";
        baseRow["Novo posto?"] = "N?o";
      } else {
        baseRow["Colaborador ausente"] = colaboradorNome;
        baseRow["Novo posto?"] = "N?o";
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
      const fileName = `diarias-temp-${normalizeStatus(statusKey)}-${Date.now()}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success("Arquivo XLSX gerado.");
    };

    const hasActiveFilters = useMemo(() => Object.values(filters).some(Boolean), [filters]);

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
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
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
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
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
          (diaria.posto_servico_id ? postoMap.get(diaria.posto_servico_id) : null);
        const clienteKey = getClienteKeyFromDiaria(diaria, postoInfo);
        if (!clienteKey || clienteKey !== totalRangeCliente.clienteId) return acc;

        const valorDiaria =
          typeof diaria.valor_diaria === "number"
            ? diaria.valor_diaria
            : Number(diaria.valor_diaria) || 0;
        return acc + valorDiaria;
      }, 0);
    }, [diariasDoStatusFull, totalRangeCliente, postoMap]);

    const clienteTotal = useMemo(() => {
      if (!totalRangeClienteOnly.clienteId || !totalRangeClienteOnly.startDate || !totalRangeClienteOnly.endDate) {
        return null;
      }
      const start = new Date(totalRangeClienteOnly.startDate);
      const end = new Date(totalRangeClienteOnly.endDate);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
      end.setHours(23, 59, 59, 999);
      if (start > end) return 0;

      return diariasDoStatusFull.reduce((acc, diaria) => {
        const postoInfo =
          diaria.posto ||
          (diaria.posto_servico_id ? postoMap.get(diaria.posto_servico_id) : null);
        const clienteKey = getClienteKeyFromDiaria(diaria, postoInfo);
        if (!clienteKey || clienteKey !== totalRangeClienteOnly.clienteId) return acc;

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

    const filterDiariasClienteOnly = (clienteId: string, start: string, end: string) => {
      const startDate = new Date(start);
      const endDate = new Date(end);
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return [];
      endDate.setHours(23, 59, 59, 999);
      return diariasDoStatusFull.filter((diaria) => {
        const postoInfo =
          diaria.posto ||
          (diaria.posto_servico_id ? postoMap.get(diaria.posto_servico_id) : null);
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
      clienteId?: string,
    ) => {
      const startDate = new Date(start);
      const endDate = new Date(end);
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return [];
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
            (diaria.posto_servico_id ? postoMap.get(diaria.posto_servico_id) : null);
          const clienteKey = getClienteKeyFromDiaria(diaria, postoInfo);
          if (clienteKey !== clienteId) return false;
        }
        return true;
      });
    };

    const exportTotal = (opts: {
      diaristaId: string;
      diaristaNome: string;
      start: string;
      end: string;
      clienteId?: string;
      clienteNome?: string;
      total: number | null;
    }) => {
      const { diaristaId, diaristaNome, start, end, clienteId, clienteNome, total } = opts;
      if (!diaristaId || !start || !end || total === null) {
        toast.error("Preencha diarista e intervalo para exportar.");
        return;
      }
      const diariasSelecionadas = filterDiariasParaTotal(diaristaId, start, end, clienteId);
      if (diariasSelecionadas.length === 0) {
        toast.info("Nenhuma diaria no intervalo para exportar.");
        return;
      }

      const postos = new Set<string>();
      const clientes = new Set<string>();
      const statuses = new Set<string>();

      diariasSelecionadas.forEach((diaria) => {
        const postoInfo =
          diaria.posto ||
          (diaria.posto_servico_id ? postoMap.get(diaria.posto_servico_id) : null);
        if (diaria.posto_servico) postos.add(diaria.posto_servico);
        if (postoInfo?.nome) postos.add(postoInfo.nome);
        const contratoInfo = getContratoInfoFromPosto(postoInfo);
        const clienteNomeDiaria =
          (typeof diaria.cliente_id === "number" && clienteMap.get(diaria.cliente_id)) ||
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
          "CPF diarista": diaristaInfo?.cpf || "-",
          Banco: diaristaInfo?.banco || "-",
          Agencia: diaristaInfo?.agencia || "-",
          "Numero da conta": diaristaInfo?.numero_conta || "-",
          "Tipo de conta": diaristaInfo?.tipo_conta || "-",
          Pix: diaristaInfo?.pix || "-",
          "Pix pertence diarista": formatPixPertence(diaristaInfo?.pix_pertence_beneficiario),
          "Data inicial": start,
          "Data final": end,
          Status: Array.from(statuses).join(", ") || "-",
          Cliente: clienteNome || Array.from(clientes).join(", ") || "-",
          Posto: Array.from(postos).join(", ") || "-",
          "Valor total (R$)": total ?? 0,
        },
      ]);

      const sheet = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheet, "Total");
      const fileName = clienteNome
        ? `total-temp-diarista-cliente-${normalizeStatus(statusKey)}-${Date.now()}.xlsx`
        : `total-temp-diarista-${normalizeStatus(statusKey)}-${Date.now()}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success("Planilha de total gerada.");
    };

    const exportClienteTotal = () => {
      const { clienteId, startDate, endDate } = totalRangeClienteOnly;
      if (!clienteId || !startDate || !endDate || clienteTotal === null) {
        toast.error("Preencha cliente e intervalo para exportar.");
        return;
      }
      const selecionadas = filterDiariasClienteOnly(clienteId, startDate, endDate);
      if (selecionadas.length === 0) {
        toast.info("Nenhuma diaria no intervalo para exportar.");
        return;
      }
      const cpfs = new Set<string>();
      const statuses = new Set<string>();
      selecionadas.forEach((diaria) => {
        const diaristaInfo = diaria.diarista || diaristaMap.get(diaria.diarista_id || "");
        if (diaristaInfo?.cpf) cpfs.add(diaristaInfo.cpf);
        statuses.add(STATUS_LABELS[diaria.status] || diaria.status);
      });
      const clienteNome = clienteFilterOptions.find((c) => c.id === clienteId)?.nome || "";
      const titulo = `Valor a receber do cliente ${clienteNome || "(sem nome)"} entre ${startDate} e ${endDate}`;
      const rows = uppercaseRows([
        {
          Titulo: titulo,
          Cliente: clienteNome || "-",
          "CPFs diaristas": Array.from(cpfs).join(", ") || "-",
          "Status das diarias": Array.from(statuses).join(", ") || "-",
          "Data inicial": startDate,
          "Data final": endDate,
          "Valor total (R$)": clienteTotal ?? 0,
        },
      ]);
      const sheet = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheet, "Total Cliente");
      const fileName = `total-temp-cliente-${normalizeStatus(statusKey)}-${Date.now()}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success("Planilha do cliente gerada.");
    };

    const handleClearFilters = () =>
      setFilters({
        diaristaId: "",
        motivo: "",
        clienteId: "",
        startDate: "",
        endDate: "",
        criadoPorId: "",
        statusResponsavelId: "",
        statusDateStart: "",
        statusDateEnd: "",
      });

    const fallbackMonth = useMemo(() => {
      for (const diaria of diariasDoStatusFull) {
        const monthValue = getMonthValue(diaria.data_diaria);
        if (monthValue) return monthValue;
      }
      return null;
    }, [diariasDoStatusFull]);

    const hasHiddenData =
      diariasDoStatus.length === 0 && diariasDoStatusFull.length > 0 && Boolean(fallbackMonth);

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
      if (normalized === normalizeStatus(STATUS.aprovadaPagamento)) {
        return "Deseja aprovar esta diaria para pagamento?";
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
        const statusLabelDelete = isCancelPage ? "cancelada" : isReprovadaPage ? "reprovada" : "selecionada";
        const confirmed = window.confirm(`Deseja excluir esta diaria ${statusLabelDelete}?`);
        if (!confirmed) return;
      }
      setDeletingId(id);
      try {
        const { error } = await supabase.from("diarias_temporarias").delete().eq("id", id);
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
      extraFields: Record<string, unknown> = {},
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

    const openReasonDialog = (id: string, status: string) => {
      setReasonDialog({ open: true, diariaId: id, targetStatus: status });
      setReasonText("");
    };

    const closeReasonDialog = () => {
      setReasonDialog({ open: false, diariaId: null, targetStatus: null });
      setReasonText("");
    };

    const handleReasonSubmit = async () => {
      if (!reasonDialog.diariaId || !reasonDialog.targetStatus) return;
      if (!reasonText.trim()) {
        toast.error("Informe o motivo.");
        return;
      }
      const trimmed = reasonText.trim();
      const normalizedStatus = normalizeStatus(reasonDialog.targetStatus);
      const extra =
        normalizedStatus === normalizeStatus(STATUS.reprovada)
          ? { motivo_reprovacao: trimmed, motivo_cancelamento: null }
          : { motivo_cancelamento: trimmed, motivo_reprovacao: null };
      if (!confirmStatusChange(reasonDialog.targetStatus)) return;
      await handleUpdateStatus(reasonDialog.diariaId, reasonDialog.targetStatus, extra);
      setCustomStatusSelection((prev) => ({ ...prev, [reasonDialog.diariaId!]: "" }));
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

    const renderAction = (diariaId: string, status: string) => {
      const action = NEXT_STATUS_ACTIONS[normalizeStatus(status)];
      if (!action) return null;
      return (
        <Button
          size="sm"
          variant="default"
          className="bg-emerald-600 text-white hover:bg-emerald-700"
          disabled={updatingId === diariaId}
          onClick={(event) => {
            event.stopPropagation();
            requestStatusChange(diariaId, action.nextStatus);
          }}
        >
          {action.label}
        </Button>
      );
    };

    const handleCustomStatusApply = async (id: string) => {
      const selectedStatus = customStatusSelection[id];
      if (!selectedStatus) {
        toast.error("Selecione um status para atualizar.");
        return;
      }
      if (requiresReasonForStatus(selectedStatus)) {
        openReasonDialog(id, selectedStatus);
        return;
      }
      if (!confirmStatusChange(selectedStatus)) return;
      await handleUpdateStatus(id, selectedStatus);
      setCustomStatusSelection((prev) => ({ ...prev, [id]: "" }));
    };

    const handleRowClick = (diaria: DiariaTemporaria) => {
      setSelectedDiaria(diaria);
      setDetailsDialogOpen(true);
    };

    const openEditDialog = (diaria: DiariaTemporaria) => {
      setEditingDiariaId(diaria.id.toString());
      setEditForm({
        dataDiaria: diaria.data_diaria || "",
        horarioInicio: diaria.horario_inicio || "",
        horarioFim: diaria.horario_fim || "",
        intervalo: diaria.intervalo !== null && diaria.intervalo !== undefined ? String(diaria.intervalo) : "",
        motivoVago: diaria.motivo_vago || "",
        postoServicoId: diaria.posto_servico_id ? diaria.posto_servico_id.toString() : "",
        clienteId: diaria.cliente_id ? diaria.cliente_id.toString() : "",
        valorDiaria: diaria.valor_diaria !== null && diaria.valor_diaria !== undefined ? String(diaria.valor_diaria) : "",
        diaristaId: diaria.diarista_id || "",
        colaboradorNome: diaria.colaborador_ausente_nome || diaria.colaborador_falecido || "",
        colaboradorFalecido: diaria.colaborador_falecido || "",
        colaboradorDemitidoNome: diaria.colaborador_demitido_nome || "",
        demissao: typeof diaria.demissao === "boolean" ? diaria.demissao : null,
        licencaNojo: typeof diaria.licenca_nojo === "boolean" ? diaria.licenca_nojo : null,
        novoPosto: typeof diaria.novo_posto === "boolean" ? diaria.novo_posto : null,
        observacao: diaria.observacao || "",
      });
      setEditDialogOpen(true);
    };

    const closeEditDialog = () => {
      setEditDialogOpen(false);
      setEditingDiariaId(null);
    };

    const handleEditSubmit = async () => {
      if (!editingDiariaId) return;
      const isMotivoVaga = isVagaEmAberto(editForm.motivoVago);
      const isMotivoLicenca = isLicencaNojo(editForm.motivoVago);

      if (!editForm.dataDiaria || !editForm.horarioInicio || !editForm.horarioFim) {
        toast.error("Preencha data e horarios da diaria.");
        return;
      }

      if (!editForm.valorDiaria || !editForm.diaristaId || !editForm.motivoVago) {
        toast.error("Preencha diarista, valor e motivo.");
        return;
      }

      if (!editForm.clienteId) {
        toast.error("Selecione o cliente.");
        return;
      }

      if (!editForm.postoServicoId) {
        toast.error("Selecione o posto de servico.");
        return;
      }

      if (!isMotivoVaga && !isMotivoLicenca && !editForm.colaboradorNome) {
        toast.error("Informe o colaborador ausente.");
        return;
      }

      if (isMotivoVaga) {
        if (editForm.demissao === null) {
          toast.error("Informe se e demissao.");
          return;
        }
        if (editForm.demissao === false && editForm.licencaNojo === null) {
          toast.error("Informe se e licenca nojo.");
          return;
        }
      }

      const valorNumber = Number(editForm.valorDiaria);
      if (Number.isNaN(valorNumber) || valorNumber <= 0) {
        toast.error("Informe um valor valido.");
        return;
      }

      const intervaloNumber =
        typeof editForm.intervalo === "string" && editForm.intervalo.trim() === ""
          ? null
          : Number(editForm.intervalo);
      if (intervaloNumber !== null && (Number.isNaN(intervaloNumber) || intervaloNumber < 0)) {
        toast.error("Informe um intervalo valido (minutos).");
        return;
      }

      const clienteIdNumber = Number(editForm.clienteId);
      if (!Number.isFinite(clienteIdNumber)) {
        toast.error("Cliente invalido.");
        return;
      }

      const colaboradorNomeUpper = toUpperOrNull(editForm.colaboradorNome);
      const postoSelecionado = postosOptions.find((p) => p.id === editForm.postoServicoId);
      const postoServicoIdValue = editForm.postoServicoId || null;
      const motivoVagoValue = (editForm.motivoVago || "").toUpperCase();
      const demissaoValue = isMotivoVaga ? editForm.demissao : null;
      const licencaNojoValue =
        isMotivoVaga && demissaoValue === false ? editForm.licencaNojo === true : false;
      const novoPostoValue =
        isMotivoVaga && demissaoValue === false ? !(editForm.licencaNojo === true) : isMotivoVaga ? false : false;
      const colaboradorFalecidoValue =
        (isMotivoLicenca || (isMotivoVaga && licencaNojoValue)) && colaboradorNomeUpper
          ? colaboradorNomeUpper
          : null;
      const colaboradorAusenteNomeValue =
        isMotivoVaga || isMotivoLicenca ? null : colaboradorNomeUpper;
      const colaboradorDemitidoNomeValue =
        isMotivoVaga && demissaoValue === true ? toUpperOrNull(editForm.colaboradorDemitidoNome) : null;
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
            posto_servico: postoSelecionado?.nome ? toUpperOrNull(postoSelecionado.nome) : null,
            cliente_id: clienteIdNumber,
            colaborador_ausente: null,
            colaborador_ausente_nome: colaboradorAusenteNomeValue,
            colaborador_falecido: colaboradorFalecidoValue,
            colaborador_demitido: null,
            colaborador_demitido_nome: colaboradorDemitidoNomeValue,
            demissao: demissaoValue,
            licenca_nojo: licencaNojoValue,
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

    const isEditMotivoVaga = isVagaEmAberto(editForm.motivoVago);
    const isEditMotivoLicenca = isLicencaNojo(editForm.motivoVago);
    const demissaoSelectValue =
      editForm.demissao === null ? UNSET_BOOL : editForm.demissao ? "true" : "false";
    const licencaNojoSelectValue =
      editForm.licencaNojo === null ? UNSET_BOOL : editForm.licencaNojo ? "true" : "false";

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
          return new Set(Array.from(prev).filter((id) => !diariasFiltradas.some((d) => d.id.toString() === id)));
        }
        const next = new Set(prev);
        diariasFiltradas.forEach((diaria) => next.add(diaria.id.toString()));
        return next;
      });
    };

    const clearSelection = () => setSelectedIds(new Set());

    const bulkAvailableStatuses = useMemo(
      () => statusOptions.filter((status) => !requiresReasonForStatus(status)),
      [statusOptions],
    );

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
      const message = `Aplicar "${STATUS_LABELS[status] || status}" em ${ids.length} diaria(s)?`;
      if (typeof window !== "undefined" && !window.confirm(message)) return;
      setUpdatingId("bulk");
      try {
        const { error } = await supabase
          .from("diarias_temporarias")
          .update({ status })
          .in("id", ids);
        if (error) throw error;
        toast.success(`Status atualizado para ${STATUS_LABELS[status] || status} em ${ids.length} diaria(s).`);
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
        const { error } = await supabase.from("diarias_temporarias").delete().in("id", ids);
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
    }, [selectedMonth, normalizedKey]);

    const closeDetailsDialog = () => {
      setDetailsDialogOpen(false);
      setSelectedDiaria(null);
    };

    const selectedColaboradorInfo =
      selectedDiaria?.colaborador ||
      (selectedDiaria?.colaborador_ausente
        ? colaboradoresMap.get(selectedDiaria.colaborador_ausente)
        : null);
    const selectedPostoInfo =
      selectedDiaria?.posto ||
      (selectedDiaria?.posto_servico_id ? postoMap.get(selectedDiaria.posto_servico_id) : null);
    const selectedDiaristaInfo =
      selectedDiaria?.diarista || diaristaMap.get(selectedDiaria?.diarista_id || "");
    const selectedContratoInfo = getContratoInfoFromPosto(selectedPostoInfo);
    const selectedClienteNome =
      (typeof selectedDiaria?.cliente_id === "number" && clienteMap.get(selectedDiaria.cliente_id)) ||
      selectedContratoInfo?.clienteNome ||
      "-";
    const selectedColaboradorNome =
      selectedDiaria?.colaborador_ausente_nome || selectedColaboradorInfo?.nome_completo || "-";
    const selectedColaboradorFalecido = selectedDiaria?.colaborador_falecido?.trim() || "-";
    const selectedColaboradorDemitidoNome = selectedDiaria?.colaborador_demitido_nome?.trim() || "";
    const selectedPostoNome = selectedDiaria?.posto_servico?.trim() || selectedPostoInfo?.nome || "-";
    const motivoVagaEmAbertoSelecionado = isVagaEmAberto(selectedDiaria?.motivo_vago);
    const motivoLicencaNojoSelecionado = isLicencaNojo(selectedDiaria?.motivo_vago);
    const selectedLicencaNojoFlag = selectedDiaria?.licenca_nojo === true;
    const selectedNovoPostoFlag = selectedDiaria?.novo_posto === true;
    const criadoPorNome = getUsuarioNome(selectedDiaria?.criado_por);
    const confirmadaPorNome = getUsuarioNome(selectedDiaria?.confirmada_por);
    const aprovadaPorNome = getUsuarioNome(selectedDiaria?.aprovada_por);
    const lancadaPorNome = getUsuarioNome(selectedDiaria?.lancada_por);
    const aprovadaParaPgtoPorNome = getUsuarioNome(selectedDiaria?.aprovado_para_pgto_por);
    const pagaPorNome = getUsuarioNome(selectedDiaria?.paga_por);
    const statusResponsavelInfo = selectedDiaria ? getStatusResponsavel(selectedDiaria) : { id: null, label: "" };
    const statusResponsavelNome = statusResponsavelInfo.id ? getUsuarioNome(statusResponsavelInfo.id) : "";
    const statusDates = (STATUS_DATE_LABELS.map(({ field, label }) => {
      const value = selectedDiaria ? (selectedDiaria as any)[field] : null;
      if (!value) return null;
      return { label, value: formatDate(value) };
    }).filter(Boolean) as { label: string; value: string }[]) || [];

    const statusDatesWithCreated = useMemo(() => {
      const items = [...statusDates];
      if (isPagaPage && selectedDiaria?.created_at) {
        items.unshift({ label: "Criada em", value: formatDateTime(selectedDiaria.created_at) });
      }
      return items;
    }, [isPagaPage, selectedDiaria?.created_at, statusDates]);

    const showReasonColumn =
      normalizedKey === normalizedCancelStatus || normalizedKey === normalizedReprovadaStatus;

    return (
      <DashboardLayout>
        <div className="space-y-6 p-4 md:p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-muted-foreground uppercase tracking-wide">Diarias temporarias</p>
              <h1 className="text-3xl font-bold">{title}</h1>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <Input
              type="month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              className="w-auto"
            />
          </div>

          {hasHiddenData && fallbackMonth && (
            <Card className="shadow-lg">
              <CardContent className="flex items-center justify-between py-4">
                <p className="text-sm text-muted-foreground">
                  Existem diarias neste status fora do mes selecionado.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-red-600 text-white hover:bg-red-700"
                  onClick={() => setSelectedMonth(fallbackMonth)}
                >
                  Ver mes com registros
                </Button>
              </CardContent>
            </Card>
          )}

          <Card className="shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">{STATUS_LABELS[statusKey]}</CardTitle>
                <CardDescription>Periodo selecionado: {selectedMonth}</CardDescription>
              </div>
              <div className="flex items-center gap-3">
                {showStatusNotice && (
                  <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-1 text-amber-800">
                    <Bell className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {statusNoticeCount} {statusNoticeCount === 1 ? "diaria" : "diarias"} {statusNoticeLabel}
                    </span>
                  </div>
                )}
                <Badge variant={STATUS_BADGE[statusKey] || "outline"}>
                  {diariasDoStatusFull.length} diaria(s)
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
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
                        <SelectItem value={selectAllValue}>Todos os diaristas</SelectItem>
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
                        <SelectItem value={selectAllValue}>Todos os motivos</SelectItem>
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
                        <SelectItem value={selectAllValue}>Todos os clientes</SelectItem>
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
                        <SelectItem value={selectAllValue}>Todos os criadores</SelectItem>
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
                            statusResponsavelId: value === selectAllValue ? "" : value,
                          }))
                        }
                      >
                        <SelectTrigger id={`filtro-temp-responsavel-${statusKey}`}>
                          <SelectValue placeholder={`Todos os ${statusResponsavelLabel.toLowerCase()}`} />
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
                        setFilters((prev) => ({ ...prev, startDate: event.target.value }))
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
                        setFilters((prev) => ({ ...prev, endDate: event.target.value }))
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
                            setFilters((prev) => ({ ...prev, statusDateStart: event.target.value }))
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
                            setFilters((prev) => ({ ...prev, statusDateEnd: event.target.value }))
                          }
                        />
                      </div>
                    </>
                  )}
                </div>
                {hasActiveFilters && (
                  <div className="flex justify-end">
                    <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                      Limpar filtros
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleExportXlsx}>
                  Exportar XLSX
                </Button>
                <Button variant="outline" onClick={() => setTotalDialogOpen(true)}>
                  Filtragem Avançada
                </Button>
                <Button
                  variant="default"
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  disabled={updatingId === "bulk" || selectedIds.size === 0 || !pageDefaultAction}
                  onClick={handleBulkDefaultAction}
                >
                  {pageDefaultAction ? `${pageDefaultAction.label} (selecionadas)` : "Ação em massa"}
                </Button>
                <div className="flex items-center gap-2">
                  <Select
                    value={bulkStatusSelection}
                    onValueChange={(value) => {
                      setBulkStatusSelection(value);
                      handleBulkStatusApply(value);
                      setBulkStatusSelection("");
                    }}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Status em massa" />
                    </SelectTrigger>
                    <SelectContent>
                      {bulkAvailableStatuses.map((statusOption) => (
                        <SelectItem key={statusOption} value={statusOption}>
                          {STATUS_LABELS[statusOption]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {allowDelete && (
                  <Button
                    variant="destructive"
                    disabled={deletingId === "bulk-delete" || selectedIds.size === 0}
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
                      : emptyMessage || "Nenhuma diaria para este status no periodo selecionado."}
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
                        <TableHead>Data</TableHead>
                        <TableHead className="hidden md:table-cell">Colaborador</TableHead>
                        <TableHead className="hidden md:table-cell">Posto</TableHead>
                        <TableHead className="hidden md:table-cell">Cliente</TableHead>
                        <TableHead className="hidden md:table-cell">CPF diarista</TableHead>
                        <TableHead>Diarista</TableHead>
                        <TableHead className="hidden md:table-cell">Motivo</TableHead>
                        <TableHead className="hidden md:table-cell">Valor</TableHead>
                        <TableHead className="hidden md:table-cell">Pix do diarista</TableHead>
                        <TableHead className="hidden md:table-cell text-right">Acoes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {diariasFiltradas.map((diaria) => {
                        const colaboradorInfo =
                          diaria.colaborador ||
                          (diaria.colaborador_ausente
                            ? colaboradoresMap.get(diaria.colaborador_ausente)
                            : null);
                        const postoInfo =
                          diaria.posto ||
                          (diaria.posto_servico_id ? postoMap.get(diaria.posto_servico_id) : null);
                        const diaristaInfo =
                          diaria.diarista || diaristaMap.get(diaria.diarista_id || "");
                        const colaboradorNome =
                          diaria.colaborador_ausente_nome || colaboradorInfo?.nome_completo || "-";
                        const colaboradorFalecido = diaria.colaborador_falecido?.trim() || "";
                        const licencaNojoFlag = diaria.licenca_nojo === true;
                        const novoPostoFlag = diaria.novo_posto === true;
                        const isVagaAbertoMotivo = isVagaEmAberto(diaria.motivo_vago);
                        const isLicencaNojoMotivo = isLicencaNojo(diaria.motivo_vago);
                        let colaboradorDisplay = colaboradorNome;
                        if (isVagaAbertoMotivo) {
                          if (diaria.demissao) {
                            colaboradorDisplay = diaria.colaborador_demitido_nome?.trim() || "";
                          } else if (licencaNojoFlag) {
                            colaboradorDisplay = colaboradorFalecido || "-";
                          } else {
                            colaboradorDisplay = novoPostoFlag ? "Novo posto" : "-";
                          }
                        } else if (isLicencaNojoMotivo) {
                          colaboradorDisplay = colaboradorFalecido || "-";
                        }
                        const postoNome = diaria.posto_servico?.trim() || postoInfo?.nome || "-";
                        const clienteNome = getClienteNomeFromDiaria(diaria, postoInfo) || "-";
                        const actionElement = renderAction(diaria.id.toString(), diaria.status);
                        return (
                          <TableRow
                            key={diaria.id}
                            className="cursor-pointer transition hover:bg-muted/90"
                            onClick={() => handleRowClick(diaria)}
                          >
                            <TableCell onClick={(event) => event.stopPropagation()}>
                              <Checkbox
                                aria-label="Selecionar diaria"
                                checked={selectedIds.has(diaria.id.toString())}
                                onCheckedChange={() => toggleSelect(diaria.id.toString())}
                              />
                            </TableCell>
                            <TableCell>{formatDate(diaria.data_diaria)}</TableCell>
                            <TableCell className="hidden md:table-cell">{colaboradorDisplay}</TableCell>
                            <TableCell className="hidden md:table-cell">{postoNome}</TableCell>
                            <TableCell className="hidden md:table-cell">{clienteNome}</TableCell>
                            <TableCell className="hidden md:table-cell">{diaristaInfo?.cpf || "-"}</TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-2">
                                <span>{diaristaInfo?.nome_completo || "-"}</span>
                              <span className="text-xs text-muted-foreground md:hidden">
                                CPF: {diaristaInfo?.cpf || "-"}
                              </span>
                              <div
                                className="md:hidden flex flex-col gap-2 pt-2"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <div className="flex flex-wrap gap-2">
                                  {statusKey === STATUS.confirmada && (
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      disabled={updatingId === diaria.id.toString()}
                                      onClick={() => openReasonDialog(diaria.id.toString(), STATUS.reprovada)}
                                    >
                                      Reprovar
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="default"
                                    className="bg-amber-400 text-black hover:bg-amber-500"
                                    onClick={() => {
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
                                      disabled={deletingId === diaria.id.toString()}
                                      onClick={() => handleDeleteDiaria(diaria.id.toString())}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      <span className="sr-only">Excluir diaria</span>
                                    </Button>
                                  )}
                                </div>
                                {actionElement && <div>{actionElement}</div>}
                                <div className="flex flex-col gap-2">
                                  <Select
                                    value={customStatusSelection[diaria.id.toString()] || ""}
                                    onValueChange={(value) =>
                                      setCustomStatusSelection((prev) => ({
                                        ...prev,
                                        [diaria.id.toString()]: value,
                                      }))
                                    }
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue placeholder="Alterar status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {statusOptions.map((statusOption) => (
                                        <SelectItem key={statusOption} value={statusOption}>
                                          {STATUS_LABELS[statusOption]}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Button
                                    size="sm"
                                    variant="default"
                                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                                    disabled={
                                      updatingId === diaria.id.toString() ||
                                      !customStatusSelection[diaria.id.toString()] ||
                                      customStatusSelection[diaria.id.toString()] === diaria.status
                                    }
                                    onClick={() => handleCustomStatusApply(diaria.id.toString())}
                                  >
                                    Aplicar
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">{diaria.motivo_vago || "-"}</TableCell>
                          <TableCell className="hidden md:table-cell">
                            {currencyFormatter.format(diaria.valor_diaria || 0)}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {diaristaInfo?.pix || "-"}
                          </TableCell>
                          <TableCell className="hidden md:table-cell" onClick={(event) => event.stopPropagation()}>
                                <div className="flex flex-col items-end gap-2">
                                  <div className="flex flex-wrap justify-end gap-2">
                                    {statusKey === STATUS.confirmada && (
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        disabled={updatingId === diaria.id.toString()}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          openReasonDialog(diaria.id.toString(), STATUS.reprovada);
                                        }}
                                      >
                                        Reprovar
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="default"
                                      className="bg-amber-400 text-black hover:bg-amber-500"
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
                                        disabled={deletingId === diaria.id.toString()}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleDeleteDiaria(diaria.id.toString());
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      <span className="sr-only">Excluir diaria</span>
                                    </Button>
                                  )}
                                </div>
                                {actionElement && (
                                  <div onClick={(event) => event.stopPropagation()}>{actionElement}</div>
                                )}
                                <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
                                  <Select
                                    value={customStatusSelection[diaria.id.toString()] || ""}
                                    onValueChange={(value) =>
                                      setCustomStatusSelection((prev) => ({
                                        ...prev,
                                        [diaria.id.toString()]: value,
                                      }))
                                    }
                                  >
                                    <SelectTrigger className="w-[220px]">
                                      <SelectValue placeholder="Alterar status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {statusOptions.map((statusOption) => (
                                        <SelectItem key={statusOption} value={statusOption}>
                                          {STATUS_LABELS[statusOption]}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Button
                                    size="sm"
                                    variant="default"
                                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                                    disabled={
                                      updatingId === diaria.id.toString() ||
                                      !customStatusSelection[diaria.id.toString()] ||
                                      customStatusSelection[diaria.id.toString()] === diaria.status
                                    }
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleCustomStatusApply(diaria.id.toString());
                                    }}
                                  >
                                    Aplicar
                                  </Button>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>

          {loadingDiarias && (
            <p className="text-sm text-muted-foreground text-center">Atualizando informacoes...</p>
          )}
        </div>

        <Dialog open={reasonDialog.open} onOpenChange={(open) => (open ? null : closeReasonDialog())}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {normalizeStatus(reasonDialog.targetStatus || "") === normalizedReprovadaStatus
                  ? "Reprovar diaria"
                  : "Cancelar diaria"}
              </DialogTitle>
              <DialogDescription>
                Informe o motivo para esta alteracao de status.
              </DialogDescription>
            </DialogHeader>
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeReasonDialog}>
                Fechar
              </Button>
              <Button
                type="button"
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={handleReasonSubmit}
                disabled={!reasonText.trim() || updatingId === reasonDialog.diariaId}
              >
                {updatingId === reasonDialog.diariaId ? "Salvando..." : "Confirmar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={totalDialogOpen} onOpenChange={setTotalDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Filtragem</DialogTitle>
              <DialogDescription>
                Consulte totais das diarias neste status. A primeira sessao considera apenas diarista e datas; a segunda inclui o cliente vinculado ao posto de servico.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2 rounded-md border bg-muted/30 p-4">
                <p className="text-sm font-semibold text-muted-foreground">Total por diarista</p>
                <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-3">
                  <div className="space-y-1">
                    <Label htmlFor={`total-diarista-${statusKey}`}>Diarista</Label>
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
                        <SelectItem value={selectAllValue}>Selecione o diarista</SelectItem>
                        {diaristaOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`total-inicio-${statusKey}`}>Data inicial</Label>
                    <Input
                      id={`total-inicio-${statusKey}`}
                      type="date"
                      value={totalRangeDiarista.startDate}
                      onChange={(event) =>
                        setTotalRangeDiarista((prev) => ({ ...prev, startDate: event.target.value }))
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
                        setTotalRangeDiarista((prev) => ({ ...prev, endDate: event.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="rounded-md border bg-background/80 p-3">
                  <p className="text-sm text-muted-foreground">Total no periodo</p>
                  <p className="text-2xl font-semibold">
                    {diaristaTotal !== null ? currencyFormatter.format(diaristaTotal) : "--"}
                  </p>
                  <div className="pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        exportTotal({
                          diaristaId: totalRangeDiarista.diaristaId,
                          diaristaNome:
                            diaristaMap.get(totalRangeDiarista.diaristaId || "")?.nome_completo || "",
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
                <p className="text-sm font-semibold text-muted-foreground">Total por diarista e cliente</p>
                <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-4">
                  <div className="space-y-1">
                    <Label htmlFor={`total-diarista-cliente-${statusKey}`}>Diarista</Label>
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
                        <SelectItem value={selectAllValue}>Selecione o diarista</SelectItem>
                        {diaristaOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`total-inicio-cliente-${statusKey}`}>Data inicial</Label>
                    <Input
                      id={`total-inicio-cliente-${statusKey}`}
                      type="date"
                      value={totalRangeCliente.startDate}
                      onChange={(event) =>
                        setTotalRangeCliente((prev) => ({ ...prev, startDate: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`total-fim-cliente-${statusKey}`}>Data final</Label>
                    <Input
                      id={`total-fim-cliente-${statusKey}`}
                      type="date"
                      value={totalRangeCliente.endDate}
                      onChange={(event) =>
                        setTotalRangeCliente((prev) => ({ ...prev, endDate: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`total-cliente-${statusKey}`}>Cliente (do posto)</Label>
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
                        <SelectItem value={selectAllValue}>Selecione o cliente</SelectItem>
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
                  <p className="text-sm text-muted-foreground">Total no periodo (com cliente)</p>
                  <p className="text-2xl font-semibold">
                    {diaristaClienteTotal !== null ? currencyFormatter.format(diaristaClienteTotal) : "--"}
                  </p>
                  <div className="pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        exportTotal({
                          diaristaId: totalRangeCliente.diaristaId,
                          diaristaNome:
                            diaristaMap.get(totalRangeCliente.diaristaId || "")?.nome_completo || "",
                          start: totalRangeCliente.startDate,
                          end: totalRangeCliente.endDate,
                          clienteId: totalRangeCliente.clienteId,
                          clienteNome:
                            clienteOptions.find((c) => c.id === totalRangeCliente.clienteId)?.nome || "",
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
                <p className="text-sm font-semibold text-muted-foreground">Total por cliente</p>
                <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-3">
                  <div className="space-y-1">
                    <Label htmlFor={`total-cliente-only-${statusKey}`}>Cliente</Label>
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
                        <SelectItem value={selectAllValue}>Selecione o cliente</SelectItem>
                        {clienteFilterOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`total-cliente-inicio-${statusKey}`}>Data inicial</Label>
                    <Input
                      id={`total-cliente-inicio-${statusKey}`}
                      type="date"
                      value={totalRangeClienteOnly.startDate}
                      onChange={(event) =>
                        setTotalRangeClienteOnly((prev) => ({ ...prev, startDate: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`total-cliente-fim-${statusKey}`}>Data final</Label>
                    <Input
                      id={`total-cliente-fim-${statusKey}`}
                      type="date"
                      value={totalRangeClienteOnly.endDate}
                      onChange={(event) =>
                        setTotalRangeClienteOnly((prev) => ({ ...prev, endDate: event.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="rounded-md border bg-background/80 p-3">
                  <p className="text-sm text-muted-foreground">Total no periodo (cliente)</p>
                  <p className="text-2xl font-semibold">
                    {clienteTotal !== null ? currencyFormatter.format(clienteTotal) : "--"}
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

        <Dialog open={detailsDialogOpen} onOpenChange={(open) => (open ? null : closeDetailsDialog())}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Detalhes da diaria</DialogTitle>
              <DialogDescription>Informacoes completas da diaria selecionada.</DialogDescription>
            </DialogHeader>
            {selectedDiaria && (
              <div className="space-y-6 text-sm">
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Informacoes gerais</p>
                  <div className="mt-2 grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-muted-foreground text-xs">Data</p>
                      <p className="font-medium">{formatDate(selectedDiaria.data_diaria)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Status</p>
                      <p className="font-medium">
                        {STATUS_LABELS[selectedDiaria.status] || selectedDiaria.status}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Motivo</p>
                      <p className="font-medium">{selectedDiaria.motivo_vago || "-"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Posto</p>
                      <p className="font-medium">{selectedPostoNome}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Cliente</p>
                      <p className="font-medium">{selectedClienteNome}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Valor</p>
                      <p className="font-medium">{currencyFormatter.format(selectedDiaria.valor_diaria || 0)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Criada em</p>
                      <p className="font-medium">{formatDateTime(selectedDiaria.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Criado por</p>
                      <p className="font-medium">{criadoPorNome || "-"}</p>
                    </div>
                    {statusDatesWithCreated.length > 0 && (
                      <div className="sm:col-span-2">
                        <p className="text-muted-foreground text-xs">Datas dos status</p>
                        <div className="mt-2 grid gap-2 md:grid-cols-2">
                          {statusDatesWithCreated.map((item) => (
                            <div key={item.label}>
                              <p className="text-muted-foreground text-xs">{item.label}</p>
                              <p className="font-medium">{item.value}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {isPagaPage && (
                      <>
                        <div>
                          <p className="text-muted-foreground text-xs">Confirmada por</p>
                          <p className="font-medium">{confirmadaPorNome || "-"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Aprovada por</p>
                          <p className="font-medium">{aprovadaPorNome || "-"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Lancada por</p>
                          <p className="font-medium">{lancadaPorNome || "-"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Aprovada para pagamento por</p>
                          <p className="font-medium">{aprovadaParaPgtoPorNome || "-"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Paga por</p>
                          <p className="font-medium">{pagaPorNome || "-"}</p>
                        </div>
                      </>
                    )}
                    {!isAguardandoPage && statusResponsavelInfo.id && (
                      <div>
                        <p className="text-muted-foreground text-xs">
                          Responsavel ({statusResponsavelInfo.label.toLowerCase()})
                        </p>
                        <p className="font-medium">{statusResponsavelNome || "-"}</p>
                      </div>
                    )}
                    {motivoVagaEmAbertoSelecionado && selectedDiaria?.demissao === true && (
                      <div className="sm:col-span-2">
                        <p className="text-muted-foreground text-xs">Colaborador demitido</p>
                        <p className="font-medium">{selectedColaboradorDemitidoNome || "-"}</p>
                      </div>
                    )}
                    {motivoVagaEmAbertoSelecionado &&
                      selectedDiaria?.demissao === false &&
                      selectedLicencaNojoFlag && (
                        <div className="sm:col-span-2">
                          <p className="text-muted-foreground text-xs">Colaborador falecido</p>
                          <p className="font-medium">{selectedColaboradorFalecido}</p>
                        </div>
                      )}
                    {motivoVagaEmAbertoSelecionado &&
                      selectedDiaria?.demissao === false &&
                      !selectedLicencaNojoFlag && (
                        <div className="sm:col-span-2">
                          <p className="text-muted-foreground text-xs">Novo posto?</p>
                          <p className="font-medium">{selectedNovoPostoFlag ? "Sim" : "Não"}</p>
                        </div>
                      )}
                    {selectedDiaria.motivo_reprovacao && (
                      <div className="sm:col-span-2">
                        <p className="text-muted-foreground text-xs">Motivo reprovacao</p>
                        <p className="font-medium whitespace-pre-line">{selectedDiaria.motivo_reprovacao}</p>
                      </div>
                    )}
                    {selectedDiaria.motivo_cancelamento && (
                      <div className="sm:col-span-2">
                        <p className="text-muted-foreground text-xs">Motivo cancelamento</p>
                        <p className="font-medium whitespace-pre-line">{selectedDiaria.motivo_cancelamento}</p>
                      </div>
                    )}
                    {selectedDiaria.observacao?.trim() && (
                      <div className="sm:col-span-2">
                        <p className="text-muted-foreground text-xs">Observacao</p>
                        <p className="font-medium whitespace-pre-line">{selectedDiaria.observacao.trim()}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Horarios</p>
                  <div className="mt-2 grid gap-3 md:grid-cols-4">
                    <div>
                      <p className="text-muted-foreground text-xs">Horario inicio</p>
                      <p className="font-medium">{formatTimeValue(selectedDiaria.horario_inicio)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Horario fim</p>
                      <p className="font-medium">{formatTimeValue(selectedDiaria.horario_fim)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Jornada diaria</p>
                      <p className="font-medium">{formatJornadaValue(selectedDiaria.jornada_diaria)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Intervalo</p>
                      <p className="font-medium">{formatIntervalValue(selectedDiaria.intervalo)}</p>
                    </div>
                  </div>
                </div>

                {!motivoVagaEmAbertoSelecionado && !motivoLicencaNojoSelecionado && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Colaborador ausente</p>
                    <div className="mt-2 grid gap-3 md:grid-cols-2">
                      <div>
                        <p className="text-muted-foreground text-xs">Nome</p>
                        <p className="font-medium">{selectedColaboradorNome}</p>
                      </div>
                    </div>
                  </div>
                )}
                {motivoLicencaNojoSelecionado && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Colaborador falecido</p>
                    <div className="mt-2 grid gap-3 md:grid-cols-2">
                      <div>
                        <p className="text-muted-foreground text-xs">Nome</p>
                        <p className="font-medium">{selectedColaboradorFalecido}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Diarista</p>
                  <div className="mt-2 grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-muted-foreground text-xs">Nome</p>
                      <p className="font-medium">{selectedDiaristaInfo?.nome_completo || "-"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">CPF</p>
                      <p className="font-medium">{selectedDiaristaInfo?.cpf || "-"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Status</p>
                      <p className="font-medium">{selectedDiaristaInfo?.status || "-"}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Dados bancarios</p>
                  <div className="mt-2 grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-muted-foreground text-xs">Banco</p>
                      <p className="font-medium">{selectedDiaristaInfo?.banco || "-"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Agencia</p>
                      <p className="font-medium">{selectedDiaristaInfo?.agencia || "-"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Numero da conta</p>
                      <p className="font-medium">{selectedDiaristaInfo?.numero_conta || "-"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Tipo de conta</p>
                      <p className="font-medium">{selectedDiaristaInfo?.tipo_conta || "-"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Chave Pix</p>
                      <p className="font-medium break-all">{selectedDiaristaInfo?.pix || "-"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Pix pertence ao diarista?</p>
                      <p className="font-medium">
                        {formatPixPertence(selectedDiaristaInfo?.pix_pertence_beneficiario)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              {selectedDiaria && (
                <Button
                  type="button"
                  variant="default"
                  className="bg-amber-400 text-black hover:bg-amber-500"
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

        <Dialog open={editDialogOpen} onOpenChange={(open) => (open ? null : closeEditDialog())}>
          <DialogContent className="max-w-3xl w-full">
            <DialogHeader>
              <DialogTitle>Editar diária</DialogTitle>
              <DialogDescription>Atualize os dados da diária temporária.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <TooltipLabel label="Data" tooltip="Dia da diaria." />
                <Input
                  type="date"
                  value={editForm.dataDiaria}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, dataDiaria: e.target.value }))}
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
                  onChange={(e) => setEditForm((prev) => ({ ...prev, horarioInicio: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <TooltipLabel label="Horário fim" tooltip="Horario previsto para encerrar a diaria." />
                <Input
                  type="time"
                  value={editForm.horarioFim}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, horarioFim: e.target.value }))}
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
                  onChange={(e) => setEditForm((prev) => ({ ...prev, intervalo: e.target.value }))}
                  placeholder="Opcional"
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <TooltipLabel label="Motivo" tooltip="Motivo que levou a necessidade da diária." />
                <Select
                  value={editForm.motivoVago || OPTIONAL_VALUE}
                  onValueChange={(value) => {
                    const isVagaAberto = isVagaEmAberto(value);
                    const isLicencaNojo = isLicencaNojo(value);
                    setEditForm((prev) => ({
                      ...prev,
                      motivoVago: value === OPTIONAL_VALUE ? "" : value,
                      colaboradorNome: isVagaAberto || isLicencaNojo ? "" : prev.colaboradorNome,
                      colaboradorFalecido: isVagaAberto || isLicencaNojo ? "" : prev.colaboradorFalecido,
                      demissao: null,
                      licencaNojo: null,
                      colaboradorDemitidoNome: "",
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o motivo" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64 overflow-y-auto">
                    <SelectItem value={OPTIONAL_VALUE} disabled>
                      Selecione
                    </SelectItem>
                    {MOTIVO_VAGO_OPTIONS.map((motivo) => (
                      <SelectItem key={motivo} value={motivo}>
                        {motivo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!isEditMotivoVaga && !isEditMotivoLicenca && (
                <div className="space-y-1 md:col-span-2">
                  <TooltipLabel
                    label="Colaborador ausente"
                    tooltip="Nome do colaborador que sera coberto pela diaria."
                  />
                  <Input
                    required
                    value={editForm.colaboradorNome}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, colaboradorNome: e.target.value }))}
                    placeholder="Nome do colaborador ausente"
                  />
                </div>
              )}

              {isEditMotivoLicenca && (
                <div className="space-y-1 md:col-span-2">
                  <TooltipLabel
                    label="Colaborador falecido (opcional)"
                    tooltip="Informe o colaborador falecido, se quiser registrar."
                  />
                  <Input
                    value={editForm.colaboradorNome}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, colaboradorNome: e.target.value }))}
                    placeholder="Nome do colaborador falecido"
                  />
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
                          demissao: value === UNSET_BOOL ? null : value === "true",
                          licencaNojo: value === "true" ? null : prev.licencaNojo,
                          colaboradorDemitidoNome: value === "true" ? prev.colaboradorDemitidoNome : "",
                          colaboradorNome: value === "true" ? "" : prev.colaboradorNome,
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

                  {editForm.demissao === false && (
                    <div className="space-y-1">
                      <TooltipLabel
                        label="É licença nojo?"
                        tooltip="Marque se o afastamento e licenca nojo."
                      />
                      <Select
                        required
                        value={licencaNojoSelectValue}
                        onValueChange={(value) =>
                          setEditForm((prev) => ({
                            ...prev,
                            licencaNojo: value === UNSET_BOOL ? null : value === "true",
                            colaboradorNome: value === "true" ? prev.colaboradorNome : "",
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
                  )}

                  {editForm.demissao === true && (
                    <div className="space-y-1 md:col-span-2">
                      <TooltipLabel
                        label="Colaborador demitido (opcional)"
                        tooltip="Informe quem foi demitido, se quiser registrar."
                      />
                      <Input
                        value={editForm.colaboradorDemitidoNome}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, colaboradorDemitidoNome: e.target.value }))
                        }
                        placeholder="Nome do colaborador demitido"
                      />
                    </div>
                  )}

                  {editForm.demissao === false && editForm.licencaNojo === true && (
                    <div className="space-y-1 md:col-span-2">
                      <TooltipLabel
                        label="Colaborador falecido (opcional)"
                        tooltip="Informe o colaborador falecido, se quiser registrar."
                      />
                      <Input
                        value={editForm.colaboradorNome}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, colaboradorNome: e.target.value }))}
                        placeholder="Nome do colaborador falecido"
                      />
                    </div>
                  )}
                </>
              )}

              <div className="space-y-1 md:col-span-2">
                <TooltipLabel label="Cliente" tooltip="Cliente associado a diaria." />
                <Select
                  value={editForm.clienteId || OPTIONAL_VALUE}
                  onValueChange={(value) =>
                    setEditForm((prev) => ({
                      ...prev,
                      clienteId: value === OPTIONAL_VALUE ? "" : value,
                      postoServicoId: "",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72 overflow-y-auto">
                    <SelectItem value={OPTIONAL_VALUE} disabled>
                      Selecione
                    </SelectItem>
                    {clienteOptionsAll.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 md:col-span-2">
                <TooltipLabel label="Posto" tooltip=" Posto onde o diarista vai atuar nesta diaria." />
                <Select
                  value={editForm.postoServicoId || OPTIONAL_VALUE}
                  onValueChange={(value) =>
                    setEditForm((prev) => ({
                      ...prev,
                      postoServicoId: value === OPTIONAL_VALUE ? "" : value,
                    }))
                  }
                  disabled={!editForm.clienteId}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={editForm.clienteId ? "Selecione o posto" : "Escolha o cliente primeiro"}
                    />
                  </SelectTrigger>
                  <SelectContent className="max-h-64 overflow-y-auto">
                    <SelectItem value={OPTIONAL_VALUE} disabled>
                      Selecione
                    </SelectItem>
                    {postosOptions
                      .filter(
                        (posto) =>
                          !editForm.clienteId ||
                          (posto.cliente_id && posto.cliente_id.toString() === editForm.clienteId),
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
                  onChange={(e) => setEditForm((prev) => ({ ...prev, valorDiaria: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <TooltipLabel
                  label="Diarista responsável"
                  tooltip="Diarista que executara a diaria."
                />
                <Select
                  value={editForm.diaristaId}
                  onValueChange={(value) => setEditForm((prev) => ({ ...prev, diaristaId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o diarista" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72 overflow-y-auto">
                    {diaristaOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.nome}
                      </SelectItem>
                    ))}
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
                  onChange={(e) => setEditForm((prev) => ({ ...prev, observacao: e.target.value }))}
                  placeholder="Opcional"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeEditDialog}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleEditSubmit} disabled={editingSaving}>
                {editingSaving ? "Salvando..." : "Salvar alterações"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    );
  };

};

export const Diarias2AguardandoPage = createStatusPage(STATUS_CONFIGS[0]);
export const Diarias2ConfirmadasPage = createStatusPage(STATUS_CONFIGS[1]);
export const Diarias2AprovadasPage = createStatusPage(STATUS_CONFIGS[2]);
export const Diarias2LancadasPage = createStatusPage(STATUS_CONFIGS[3]);
export const Diarias2AprovadasPagamentoPage = createStatusPage(STATUS_CONFIGS[4]);
export const Diarias2ReprovadasPage = createStatusPage(STATUS_CONFIGS[5]);
export const Diarias2CanceladasPage = createStatusPage(STATUS_CONFIGS[6]);
export const Diarias2PagasPage = createStatusPage(STATUS_CONFIGS[7]);
