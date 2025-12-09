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
import { Trash2 } from "lucide-react";
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

const createStatusPage = ({ statusKey, title, description, emptyMessage }: StatusPageConfig) => {
  return function DiariasTemporariasStatusPage() {
    const [selectedMonth, setSelectedMonth] = useState(currentMonthValue);
    const {
      filteredDiarias,
      diarias,
      refetchDiarias,
      loadingDiarias,
      diaristaMap,
      colaboradoresMap,
      postoMap,
      profileMap,
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
    const [filters, setFilters] = useState({
      diaristaId: "",
      motivo: "",
      clienteId: "",
      startDate: "",
      endDate: "",
      criadoPorId: "",
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

    const normalizedKey = normalizeStatus(statusKey);
    const normalizedCancelStatus = normalizeStatus(STATUS.cancelada);
    const normalizedReprovadaStatus = normalizeStatus(STATUS.reprovada);
    const isCancelPage = normalizedKey === normalizedCancelStatus;

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

    const diariasDoStatus = useMemo(
      () => filteredDiarias.filter((diaria) => normalizeStatus(diaria.status) === normalizedKey),
      [filteredDiarias, normalizedKey],
    );

    const diariasDoStatusFull = useMemo(
      () => diarias.filter((diaria) => normalizeStatus(diaria.status) === normalizedKey),
      [diarias, normalizedKey],
    );

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
      const nome = diaria.cliente_nome?.trim() || getClienteInfoFromPosto(postoInfo)?.nome || "";
      return nome || "";
    };

    const getClienteKeyFromDiaria = (diaria: DiariaTemporaria, postoInfo: any) => {
      const key =
        getClienteInfoFromPosto(postoInfo)?.id ||
        diaria.cliente_nome?.trim() ||
        "";
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

    const criadoPorOptions = useMemo(() => {
      const map = new Map<string, string>();
      diariasDoStatusFull.forEach((diaria) => {
        if (diaria.criado_por) {
          const nome = profileMap.get(diaria.criado_por) || "";
          map.set(diaria.criado_por, nome);
        }
      });
      return Array.from(map.entries())
        .map(([id, nome]) => ({ id, nome: nome || "(sem nome)" }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
    }, [diariasDoStatusFull, profileMap]);

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
      () => (filters.startDate || filters.endDate ? diariasDoStatusFull : diariasDoStatus),
      [diariasDoStatus, diariasDoStatusFull, filters.endDate, filters.startDate],
    );

    const diariasFiltradas = useMemo(() => {
      return diariasBase.filter((diaria) => {
        const diaristaId = diaria.diarista_id || "";
        const motivo = diaria.motivo_vago || "";
        const postoInfo =
          diaria.posto ||
          (diaria.posto_servico_id ? postoMap.get(diaria.posto_servico_id) : null);
        const clienteKey = getClienteKeyFromDiaria(diaria, postoInfo);
        const data = diaria.data_diaria || "";

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
        return true;
      });
    }, [diariasBase, filters]);

    const buildExportRow = (diaria: DiariaTemporaria) => {
      const postoInfo =
        diaria.posto || (diaria.posto_servico_id ? postoMap.get(diaria.posto_servico_id) : null);
      const diaristaInfo = diaria.diarista || diaristaMap.get(diaria.diarista_id || "");
      const colaboradorInfo =
        diaria.colaborador ||
        (diaria.colaborador_ausente ? colaboradoresMap.get(diaria.colaborador_ausente) : null);
      const clienteNome = getClienteNomeFromDiaria(diaria, postoInfo) || "-";
      const criadoPorNome =
        (diaria.criado_por && profileMap.get(diaria.criado_por || "")) || "-";
      const { id: responsavelStatusId } = getStatusResponsavel(diaria);
      const responsavelStatusNome = responsavelStatusId ? profileMap.get(responsavelStatusId) || "" : "";
      const colaboradorNome = diaria.colaborador_ausente_nome || colaboradorInfo?.nome_completo || "-";
      const colaboradorDemitidoNome = diaria.colaborador_demitido_nome || "";
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
        Observacao: diaria.observacao?.trim() || "",
        "Criado por": criadoPorNome,
        "Responsavel status": responsavelStatusNome || "",
      };

      if (isVagaEmAberto(diaria.motivo_vago)) {
        if (colaboradorDemitidoNome) {
          baseRow["Colaborador demitido"] = colaboradorDemitidoNome;
        } else {
          baseRow["Novo posto?"] = "Sim";
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
        const clienteNomeDiaria = diaria.cliente_nome?.trim();
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
      selecionadas.forEach((diaria) => {
        const diaristaInfo = diaria.diarista || diaristaMap.get(diaria.diarista_id || "");
        if (diaristaInfo?.cpf) cpfs.add(diaristaInfo.cpf);
      });
      const clienteNome = clienteFilterOptions.find((c) => c.id === clienteId)?.nome || "";
      const titulo = `Valor a receber do cliente ${clienteNome || "(sem nome)"} entre ${startDate} e ${endDate}`;
      const rows = uppercaseRows([
        {
          Titulo: titulo,
          Cliente: clienteNome || "-",
          "CPFs diaristas": Array.from(cpfs).join(", ") || "-",
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
        const confirmed = window.confirm("Deseja excluir esta diaria cancelada?");
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
          variant="outline"
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
      selectedDiaria?.cliente_nome?.trim() || selectedContratoInfo?.clienteNome || "-";
    const selectedColaboradorNome =
      selectedDiaria?.colaborador_ausente_nome || selectedColaboradorInfo?.nome_completo || "-";
    const selectedColaboradorDemitidoNome = selectedDiaria?.colaborador_demitido_nome?.trim() || "";
    const selectedPostoNome = selectedDiaria?.posto_servico?.trim() || selectedPostoInfo?.nome || "-";
    const motivoVagaEmAbertoSelecionado = isVagaEmAberto(selectedDiaria?.motivo_vago);
    const criadoPorNome =
      selectedDiaria?.criado_por ? profileMap.get(selectedDiaria.criado_por) || "" : "";
    const statusResponsavelInfo = selectedDiaria ? getStatusResponsavel(selectedDiaria) : { id: null, label: "" };
    const statusResponsavelNome =
      statusResponsavelInfo.id ? profileMap.get(statusResponsavelInfo.id) || "" : "";

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
              <Badge variant={STATUS_BADGE[statusKey] || "outline"}>
                {diariasDoStatus.length} diaria(s)
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-1">
                    <Label htmlFor={`filtro-temp-diarista-${statusKey}`}>Diarista</Label>
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
                    <Label htmlFor={`filtro-temp-motivo-${statusKey}`}>Motivo</Label>
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
                    <Label htmlFor={`filtro-temp-cliente-${statusKey}`}>Cliente</Label>
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
                    <Label htmlFor={`filtro-temp-criado-por-${statusKey}`}>Criado por</Label>
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
                  <div className="space-y-1">
                    <Label htmlFor={`filtro-temp-data-inicio-${statusKey}`}>Data inicial</Label>
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
                    <Label htmlFor={`filtro-temp-data-fim-${statusKey}`}>Data final</Label>
                    <Input
                      id={`filtro-temp-data-fim-${statusKey}`}
                      type="date"
                      value={filters.endDate}
                      onChange={(event) =>
                        setFilters((prev) => ({ ...prev, endDate: event.target.value }))
                      }
                    />
                  </div>
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
                        <TableHead>Data</TableHead>
                        <TableHead className="hidden md:table-cell">Colaborador ausente</TableHead>
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
                        const isVagaAbertoMotivo = isVagaEmAberto(diaria.motivo_vago);
                        const colaboradorDisplay = isVagaAbertoMotivo
                          ? diaria.colaborador_demitido_nome?.trim() || ""
                          : colaboradorNome;
                        const postoNome = diaria.posto_servico?.trim() || postoInfo?.nome || "-";
                        const clienteNome = getClienteNomeFromDiaria(diaria, postoInfo) || "-";
                        const actionElement = renderAction(diaria.id.toString(), diaria.status);
                        return (
                          <TableRow
                            key={diaria.id}
                            className="cursor-pointer transition hover:bg-muted/90"
                            onClick={() => handleRowClick(diaria)}
                          >
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
                                  {isCancelPage && (
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
                                    variant="secondary"
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
                                  {isCancelPage && (
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
                                    variant="secondary"
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
                      <p className="text-muted-foreground text-xs">Atualizado em</p>
                      <p className="font-medium">{formatDateTime(selectedDiaria.updated_at)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Criado por</p>
                      <p className="font-medium">{criadoPorNome || "-"}</p>
                    </div>
                    {statusResponsavelInfo.id && (
                      <div>
                        <p className="text-muted-foreground text-xs">
                          Responsavel ({statusResponsavelInfo.label.toLowerCase()})
                        </p>
                        <p className="font-medium">{statusResponsavelNome || "-"}</p>
                      </div>
                    )}
                    {selectedColaboradorDemitidoNome.trim() &&
                      selectedColaboradorDemitidoNome !== "-" && (
                        <div className="sm:col-span-2">
                          <p className="text-muted-foreground text-xs">Colaborador demitido</p>
                          <p className="font-medium">{selectedColaboradorDemitidoNome}</p>
                        </div>
                      )}
                    {motivoVagaEmAbertoSelecionado && !selectedColaboradorDemitidoNome.trim() && (
                      <div className="sm:col-span-2">
                        <p className="text-muted-foreground text-xs">Novo posto?</p>
                        <p className="font-medium">Sim</p>
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

                {!motivoVagaEmAbertoSelecionado && (
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
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button type="button" onClick={closeDetailsDialog}>
                Fechar
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


