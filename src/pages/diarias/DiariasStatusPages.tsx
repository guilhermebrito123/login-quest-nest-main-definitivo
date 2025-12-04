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
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import {
  STATUS,
  STATUS_LABELS,
  NEXT_STATUS_ACTIONS,
  currencyFormatter,
  currentMonthValue,
  formatDate,
  formatDateTime,
  useDiariasData,
  STATUS_BADGE,
  normalizeStatus,
  getMonthValue,
  Diaria,
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

interface StatusPageConfig {
  title: string;
  description: string;
  statusKey: string;
  emptyMessage?: string;
}

const STATUS_CONFIGS: StatusPageConfig[] = [
  {
    statusKey: STATUS.aguardando,
    title: "Diárias aguardando confirmação",
    description: "Confirme as diárias recém cadastradas antes de liberar para aprovação.",
    emptyMessage: "Nenhuma diária aguardando confirmação.",
  },
  {
    statusKey: STATUS.confirmada,
    title: "Diárias confirmadas",
    description: "Diárias prontas para aprovação financeira.",
  },
  {
    statusKey: STATUS.aprovada,
    title: "Diárias aprovadas",
    description: "Avance as diárias aprovadas para lançamento.",
  },
  {
    statusKey: STATUS.lancada,
    title: "Diárias lançadas para pagamento",
    description: "Diárias lançadas aguardando aprovação de pagamento.",
  },
  {
    statusKey: STATUS.aprovadaPagamento,
    title: "Diárias aprovadas para pagamento",
    description: "Acompanhe as diárias aprovadas que estão em fase final de pagamento.",
  },
  {
    statusKey: STATUS.reprovada,
    title: "Diárias reprovadas",
    description: "Histórico de diárias reprovadas com seus respectivos motivos.",
    emptyMessage: "Nenhuma diária reprovada.",
  },
  {
    statusKey: STATUS.cancelada,
    title: "Diárias canceladas",
    description: "Histórico de diárias canceladas.",
    emptyMessage: "Nenhuma diária cancelada.",
  },
];

const createStatusPage = ({ statusKey, title, description, emptyMessage }: StatusPageConfig) => {
  return function DiariasStatusPage() {
    const [selectedMonth, setSelectedMonth] = useState(currentMonthValue);
    const {
      filteredDiarias,
      postoDiaVagoMap,
      diaristaMap,
      loadingDiarias,
      refetchDiarias,
      diarias,
      postoOcupanteMap,
    } = useDiariasData(selectedMonth);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [customStatusSelection, setCustomStatusSelection] = useState<Record<string, string>>({});
    const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
    const [selectedDiaria, setSelectedDiaria] = useState<Diaria | null>(null);
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

    const diariasDoStatus = useMemo(
      () =>
        filteredDiarias.filter((diaria) => normalizeStatus(diaria.status) === normalizedKey),
      [filteredDiarias, normalizedKey],
    );

    const diariasDoStatusFull = useMemo(
      () => diarias.filter((diaria) => normalizeStatus(diaria.status) === normalizedKey),
      [diarias, normalizedKey],
    );

    const getContratoInfoFromDia = (diaInfo: any) => {
      const contrato = diaInfo?.posto?.unidade?.contrato;
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

    const getClienteInfoFromDia = (diaInfo: any) => {
      const contratoInfo = getContratoInfoFromDia(diaInfo);
      if (contratoInfo?.clienteId && contratoInfo.clienteNome) {
        return { id: contratoInfo.clienteId, nome: contratoInfo.clienteNome };
      }
      return null;
    };

    const diaristaOptions = useMemo(() => {
      const map = new Map<string, string>();
      diariasDoStatus.forEach((diaria) => {
        const diaristaInfo = diaristaMap.get(diaria.diarista_id) ?? diaria.diarista ?? null;
        if (diaria.diarista_id && diaristaInfo?.nome_completo) {
          map.set(diaria.diarista_id, diaristaInfo.nome_completo);
        }
      });
      return Array.from(map.entries())
        .map(([id, nome]) => ({ id, nome }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
    }, [diariasDoStatus, diaristaMap]);

    const motivoOptions = useMemo(() => {
      const set = new Set<string>();
      diariasDoStatus.forEach((diaria) => {
        const diaInfo =
          postoDiaVagoMap.get(diaria.posto_dia_vago_id) ?? diaria.posto_dia_vago ?? null;
        if (diaInfo?.motivo) {
          set.add(diaInfo.motivo);
        }
      });
      return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [diariasDoStatus, postoDiaVagoMap]);

    const clienteFilterOptions = useMemo(() => {
      const map = new Map<string, string>();
      diariasDoStatus.forEach((diaria) => {
        const diaInfo =
          postoDiaVagoMap.get(diaria.posto_dia_vago_id) ?? diaria.posto_dia_vago ?? null;
        const cliente = getClienteInfoFromDia(diaInfo);
        if (cliente?.id && cliente.nome) {
          map.set(cliente.id, cliente.nome);
        }
      });
      return Array.from(map.entries())
        .map(([id, nome]) => ({ id, nome }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
    }, [diariasDoStatus, postoDiaVagoMap]);

    const diariasBase = useMemo(
      () => (filters.startDate || filters.endDate ? diariasDoStatusFull : diariasDoStatus),
      [diariasDoStatus, diariasDoStatusFull, filters.endDate, filters.startDate],
    );

    const diariasFiltradas = useMemo(() => {
      return diariasBase.filter((diaria) => {
        const diaInfo =
          postoDiaVagoMap.get(diaria.posto_dia_vago_id) ?? diaria.posto_dia_vago ?? null;
        const diaristaId = diaria.diarista_id || "";
        const motivo = diaInfo?.motivo ?? "";
        const clienteInfoFiltro = getClienteInfoFromDia(diaInfo);
        const data = diaInfo?.data ?? "";

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
        if (filters.clienteId && filters.clienteId !== (clienteInfoFiltro?.id || "")) {
          return false;
        }
        return true;
      });
    }, [diariasBase, filters, postoDiaVagoMap]);

    const buildExportRow = (diaria: Diaria) => {
      const diaInfo =
        postoDiaVagoMap.get(diaria.posto_dia_vago_id) ?? diaria.posto_dia_vago ?? null;
      const postoInfo = diaInfo?.posto;
      const ocupanteInfo = diaInfo?.posto_servico_id
        ? postoOcupanteMap.get(diaInfo.posto_servico_id)
        : null;
      const diaristaInfo = diaristaMap.get(diaria.diarista_id) ?? diaria.diarista ?? null;
      const clienteInfo = getClienteInfoFromDia(diaInfo);
      const contratoInfo = getContratoInfoFromDia(diaInfo);
      return {
        Data: formatDate(diaInfo?.data),
        Status: STATUS_LABELS[diaria.status] || diaria.status,
        Posto: postoInfo?.nome || "-",
        Unidade: postoInfo?.unidade?.nome || "-",
        "Motivo (dia vago)": diaInfo?.motivo || "-",
        "Ocupante do posto": ocupanteInfo?.nome_completo || "-",
        "Valor (R$)": diaria.valor || 0,
        "Atualizado em": formatDateTime(diaria.updated_at),
        "Motivo reprovação": diaria.motivo_reprovacao || "",
        "Motivo cancelamento": diaria.motivo_cancelamento || "",
        Diarista: diaristaInfo?.nome_completo || "-",
        "Status diarista": diaristaInfo?.status || "-",
        Banco: diaristaInfo?.banco || "-",
        Agência: diaristaInfo?.agencia || "-",
        "Número da conta": diaristaInfo?.numero_conta || "-",
        "Tipo de conta": diaristaInfo?.tipo_conta || "-",
        Pix: diaristaInfo?.pix || "-",
        Cliente: clienteInfo?.nome || "-",
        Contrato: contratoInfo?.negocio || "-",
      };
    };

    const handleExportXlsx = () => {
      if (diariasFiltradas.length === 0) {
        toast.info("Nenhuma di\u00e1ria para exportar.");
        return;
      }
      const rows = diariasFiltradas.map(buildExportRow);
      const sheet = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheet, "Diarias");
      const fileName = `diarias-${normalizeStatus(statusKey)}-${Date.now()}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success("Arquivo XLSX gerado.");
    };

    const clienteOptions = useMemo(() => {
      const map = new Map<string, string>();
      diariasDoStatusFull.forEach((diaria) => {
        if (totalRangeCliente.diaristaId && diaria.diarista_id !== totalRangeCliente.diaristaId) {
          return;
        }
        const diaInfo =
          postoDiaVagoMap.get(diaria.posto_dia_vago_id) ?? diaria.posto_dia_vago ?? null;
        const clienteInfo = getClienteInfoFromDia(diaInfo);
        if (clienteInfo?.id && clienteInfo.nome) {
          map.set(clienteInfo.id, clienteInfo.nome);
        }
      });
      return Array.from(map.entries())
        .map(([id, nome]) => ({ id, nome }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
    }, [diariasDoStatusFull, postoDiaVagoMap, totalRangeCliente.diaristaId]);

    useEffect(() => {
      setTotalRangeCliente((prev) => ({
        ...prev,
        clienteId: clienteOptions.some((c) => c.id === prev.clienteId) ? prev.clienteId : "",
      }));
    }, [clienteOptions]);

    const hasActiveFilters = useMemo(() => Object.values(filters).some(Boolean), [filters]);

    const diaristaTotal = useMemo(() => {
      if (!totalRangeDiarista.diaristaId || !totalRangeDiarista.startDate || !totalRangeDiarista.endDate) {
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

        const diaInfo =
          postoDiaVagoMap.get(diaria.posto_dia_vago_id) ?? diaria.posto_dia_vago ?? null;
        const dataStr = diaInfo?.data;
        if (!dataStr) return acc;

        const diariaDate = new Date(dataStr);
        if (Number.isNaN(diariaDate.getTime())) return acc;
        if (diariaDate < start || diariaDate > end) return acc;

        const valorDiaria =
          typeof diaria.valor === "number" ? diaria.valor : Number(diaria.valor) || 0;
        return acc + valorDiaria;
      }, 0);
    }, [diariasDoStatusFull, postoDiaVagoMap, totalRangeDiarista]);

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

        const diaInfo =
          postoDiaVagoMap.get(diaria.posto_dia_vago_id) ?? diaria.posto_dia_vago ?? null;
        const dataStr = diaInfo?.data;
        if (!dataStr) return acc;

        const diariaDate = new Date(dataStr);
        if (Number.isNaN(diariaDate.getTime())) return acc;
        if (diariaDate < start || diariaDate > end) return acc;

        const clienteInfo = getClienteInfoFromDia(diaInfo);
        if (!clienteInfo || clienteInfo.id !== totalRangeCliente.clienteId) return acc;

        const valorDiaria =
          typeof diaria.valor === "number" ? diaria.valor : Number(diaria.valor) || 0;
        return acc + valorDiaria;
      }, 0);
    }, [diariasDoStatusFull, postoDiaVagoMap, totalRangeCliente]);

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
        const diaInfo =
          postoDiaVagoMap.get(diaria.posto_dia_vago_id) ?? diaria.posto_dia_vago ?? null;
        const clienteInfo = getClienteInfoFromDia(diaInfo);
        if (!clienteInfo || clienteInfo.id !== totalRangeClienteOnly.clienteId) return acc;

        const dataStr = diaInfo?.data;
        if (!dataStr) return acc;
        const diariaDate = new Date(dataStr);
        if (Number.isNaN(diariaDate.getTime())) return acc;
        if (diariaDate < start || diariaDate > end) return acc;

        const valorDiaria =
          typeof diaria.valor === "number" ? diaria.valor : Number(diaria.valor) || 0;
        return acc + valorDiaria;
      }, 0);
    }, [diariasDoStatusFull, postoDiaVagoMap, totalRangeClienteOnly]);

    const filterDiariasClienteOnly = (clienteId: string, start: string, end: string) => {
      const startDate = new Date(start);
      const endDate = new Date(end);
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return [];
      endDate.setHours(23, 59, 59, 999);
      return diariasDoStatusFull.filter((diaria) => {
        const diaInfo =
          postoDiaVagoMap.get(diaria.posto_dia_vago_id) ?? diaria.posto_dia_vago ?? null;
        const clienteInfo = getClienteInfoFromDia(diaInfo);
        if (!clienteInfo || clienteInfo.id !== clienteId) return false;
        const dataStr = diaInfo?.data;
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
        const diaInfo =
          postoDiaVagoMap.get(diaria.posto_dia_vago_id) ?? diaria.posto_dia_vago ?? null;
        const dataStr = diaInfo?.data;
        if (!dataStr) return false;
        const data = new Date(dataStr);
        if (Number.isNaN(data.getTime())) return false;
        if (data < startDate || data > endDate) return false;
        if (clienteId) {
          const contratoInfo = getContratoInfoFromDia(diaInfo);
          if (contratoInfo?.clienteId !== clienteId) return false;
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
        toast.info("Nenhuma di\u00e1ria no intervalo para exportar.");
        return;
      }
      const postos = new Set<string>();
      const unidades = new Set<string>();
      const clientes = new Set<string>();
      const contratos = new Set<string>();
      diariasSelecionadas.forEach((diaria) => {
        const diaInfo =
          postoDiaVagoMap.get(diaria.posto_dia_vago_id) ?? diaria.posto_dia_vago ?? null;
        const postoInfo = diaInfo?.posto;
        if (postoInfo?.nome) postos.add(postoInfo.nome);
        if (postoInfo?.unidade?.nome) unidades.add(postoInfo.unidade.nome);
        const contratoInfo = getContratoInfoFromDia(diaInfo);
        if (contratoInfo?.negocio) contratos.add(contratoInfo.negocio);
        if (contratoInfo?.clienteNome) clientes.add(contratoInfo.clienteNome);
      });

      const tituloBase = clienteNome
        ? `Valor a receber de ${diaristaNome} entre os dias ${start} e ${end} do cliente ${clienteNome}`
        : `Valor a receber de ${diaristaNome} entre os dias ${start} e ${end}`;

      const diaristaInfo = diaristaMap.get(diaristaId);

      const rows = [
        {
          Titulo: tituloBase,
          Diarista: diaristaNome || "-",
          Banco: diaristaInfo?.banco || "-",
          "Agencia": diaristaInfo?.agencia || "-",
          "Numero da conta": diaristaInfo?.numero_conta || "-",
          "Tipo de conta": diaristaInfo?.tipo_conta || "-",
          Pix: diaristaInfo?.pix || "-",
          "Data inicial": start,
          "Data final": end,
          Cliente: clienteNome || Array.from(clientes).join(", ") || "-",
          Contrato: Array.from(contratos).join(", ") || "-",
          Unidade: Array.from(unidades).join(", ") || "-",
          Posto: Array.from(postos).join(", ") || "-",
          "Valor total (R$)": total ?? 0,
        },
      ];

      const sheet = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheet, "Total");
      const fileName = clienteNome
        ? `total-diarista-cliente-${normalizeStatus(statusKey)}-${Date.now()}.xlsx`
        : `total-diarista-${normalizeStatus(statusKey)}-${Date.now()}.xlsx`;
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
        toast.info("Nenhuma di\u00e1ria no intervalo para exportar.");
        return;
      }
      const clienteNome = clienteFilterOptions.find((c) => c.id === clienteId)?.nome || "";
      const titulo = `Valor a receber do cliente ${clienteNome || "(sem nome)"} entre ${startDate} e ${endDate}`;
      const rows = [
        {
          Titulo: titulo,
          Cliente: clienteNome || "-",
          "Data inicial": startDate,
          "Data final": endDate,
          "Valor total (R$)": clienteTotal ?? 0,
        },
      ];
      const sheet = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheet, "Total Cliente");
      const fileName = `total-cliente-${normalizeStatus(statusKey)}-${Date.now()}.xlsx`;
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
      });

    const fallbackMonth = useMemo(() => {
      for (const diaria of diariasDoStatusFull) {
        const diaInfo =
          postoDiaVagoMap.get(diaria.posto_dia_vago_id) ?? diaria.posto_dia_vago ?? null;
        const monthValue = getMonthValue(diaInfo?.data);
        if (monthValue) return monthValue;
      }
      return null;
    }, [diariasDoStatusFull, postoDiaVagoMap]);

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
        return "Deseja confirmar esta diária?";
      }
      if (normalized === normalizeStatus(STATUS.aprovada)) {
        return "Deseja aprovar esta diária?";
      }
      if (normalized === normalizeStatus(STATUS.lancada)) {
        return "Deseja lan\u00e7ar esta diária para pagamento?";
      }
      if (normalized === normalizeStatus(STATUS.aprovadaPagamento)) {
        return "Deseja aprovar esta diária para pagamento?";
      }
      if (normalized === normalizeStatus(STATUS.reprovada)) {
        return "Deseja reprovar esta diária?";
      }
      if (normalized === normalizeStatus(STATUS.cancelada)) {
        return "Deseja cancelar esta diária?";
      }
      return `Deseja alterar o status da diária para ${STATUS_LABELS[status] || status}?`;
    };

    const confirmStatusChange = (status: string) => {
      if (typeof window === "undefined") return true;
      return window.confirm(getConfirmationMessage(status));
    };

    const handleDeleteDiaria = async (id: string) => {
      if (typeof window !== "undefined") {
        const confirmed = window.confirm("Deseja excluir esta diária cancelada?");
        if (!confirmed) return;
      }
      setDeletingId(id);
      try {
        const { error } = await supabase.from("diarias").delete().eq("id", id);
        if (error) throw error;
        toast.success("Diária excluÍda.");
        await refetchDiarias();
      } catch (error: any) {
        toast.error(error.message || "Erro ao excluir a diária.");
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
          .from("diarias")
          .update({ status: nextStatus, ...extraFields })
          .eq("id", id);
        if (error) throw error;
        toast.success(`Status atualizado para ${STATUS_LABELS[nextStatus]}.`);
        await refetchDiarias();
      } catch (error: any) {
        toast.error(error.message || "Erro ao atualizar status da diária.");
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

    const handleRowClick = (diaria: Diaria) => {
      setSelectedDiaria(diaria);
      setDetailsDialogOpen(true);
    };

    const closeDetailsDialog = () => {
      setDetailsDialogOpen(false);
      setSelectedDiaria(null);
    };

    const selectedDiaInfo =
      selectedDiaria
        ? postoDiaVagoMap.get(selectedDiaria.posto_dia_vago_id) ?? selectedDiaria.posto_dia_vago ?? null
        : null;
    const selectedPostoInfo = selectedDiaInfo?.posto;
    const selectedContratoInfo = getContratoInfoFromDia(selectedDiaInfo);
    const selectedDiaristaInfo =
      selectedDiaria
        ? selectedDiaria.diarista ?? diaristaMap.get(selectedDiaria.diarista_id) ?? null
        : null;
    const selectedOcupanteInfo =
      selectedDiaInfo?.posto_servico_id
        ? postoOcupanteMap.get(selectedDiaInfo.posto_servico_id)
        : null;
    const motivoDetalheNormalizado = (selectedDiaInfo?.motivo || "").toLowerCase().trim();
    const deveExibirOcupanteNoDetalhe =
      !!motivoDetalheNormalizado && motivoDetalheNormalizado !== "posto vago";

    const showReasonColumn =
      normalizedKey === normalizedCancelStatus || normalizedKey === normalizedReprovadaStatus;

    return (
      <DashboardLayout>
        <div className="space-y-6 p-4 md:p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-muted-foreground uppercase tracking-wide">Diárias</p>
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
                  Existem diárias neste status fora do mês selecionado.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-red-600 text-white hover:bg-red-700"
                  onClick={() => setSelectedMonth(fallbackMonth)}
                >
                  Ver mês com registros
                </Button>
              </CardContent>
            </Card>
          )}

          <Card className="shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">{STATUS_LABELS[statusKey]}</CardTitle>
                <CardDescription>Período selecionado: {selectedMonth}</CardDescription>
              </div>
              <Badge variant={STATUS_BADGE[statusKey] || "outline"}>
                {diariasDoStatus.length} di├íria(s)
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-1">
                    <Label htmlFor={`filtro-diarista-${statusKey}`}>Diarista</Label>
                    <Select
                      value={filters.diaristaId || selectAllValue}
                      onValueChange={(value) =>
                        setFilters((prev) => ({
                          ...prev,
                          diaristaId: value === selectAllValue ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger id={`filtro-diarista-${statusKey}`}>
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
                    <Label htmlFor={`filtro-motivo-${statusKey}`}>Motivo</Label>
                    <Select
                      value={filters.motivo || selectAllValue}
                      onValueChange={(value) =>
                        setFilters((prev) => ({
                          ...prev,
                          motivo: value === selectAllValue ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger id={`filtro-motivo-${statusKey}`}>
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
                    <Label htmlFor={`filtro-cliente-${statusKey}`}>Cliente</Label>
                    <Select
                      value={filters.clienteId || selectAllValue}
                      onValueChange={(value) =>
                        setFilters((prev) => ({
                          ...prev,
                          clienteId: value === selectAllValue ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger id={`filtro-cliente-${statusKey}`}>
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
                    <Label htmlFor={`filtro-data-inicio-${statusKey}`}>Data inicial</Label>
                    <Input
                      id={`filtro-data-inicio-${statusKey}`}
                      type="date"
                      value={filters.startDate}
                      onChange={(event) =>
                        setFilters((prev) => ({ ...prev, startDate: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`filtro-data-fim-${statusKey}`}>Data final</Label>
                    <Input
                      id={`filtro-data-fim-${statusKey}`}
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
                      : emptyMessage || "Nenhuma diaria encontrada para este status no periodo selecionado."}
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                      <TableHead className="hidden md:table-cell">Posto</TableHead>
                      <TableHead className="hidden md:table-cell">Unidade</TableHead>
                      <TableHead className="hidden md:table-cell">Motivo (dia vago)</TableHead>
                      <TableHead>Diarista</TableHead>
                      <TableHead className="hidden md:table-cell">Valor</TableHead>
                      <TableHead className="hidden md:table-cell">Pix do diarista</TableHead>
                      <TableHead className="hidden md:table-cell text-right">Acoes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {diariasFiltradas.map((diaria) => {
                        const diaInfo =
                          postoDiaVagoMap.get(diaria.posto_dia_vago_id) ?? diaria.posto_dia_vago ?? null;
                        const postoInfo = diaInfo?.posto;
                        const diaristaInfo = diaristaMap.get(diaria.diarista_id);
                        const ocupanteInfo =
                          diaInfo?.posto_servico_id
                            ? postoOcupanteMap.get(diaInfo.posto_servico_id)
                            : null;
                        const motivoLinhaNormalizado = (diaInfo?.motivo || "").toLowerCase().trim();
                        const deveExibirOcupanteNaLinha =
                          !!motivoLinhaNormalizado && motivoLinhaNormalizado !== "posto vago";
                        const isAlreadyReprovada =
                          normalizeStatus(diaria.status) === normalizedReprovadaStatus;
                        const actionElement = renderAction(diaria.id, diaria.status);
                        return (
                          <TableRow
                            key={diaria.id}
                            className="cursor-pointer transition hover:bg-muted/90"
                            onClick={() => handleRowClick(diaria)}
                          >
                            <TableCell>{formatDate(diaInfo?.data)}</TableCell>
                          <TableCell className="hidden md:table-cell">{postoInfo?.nome || "-"}</TableCell>
                          <TableCell className="hidden md:table-cell">
                            {postoInfo?.unidade?.nome || "-"}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <div className="flex flex-col">
                              <span>{diaInfo?.motivo || "-"}</span>
                              {deveExibirOcupanteNaLinha && ocupanteInfo && (
                                <span className="text-xs text-muted-foreground">
                                  Ocupado por: {ocupanteInfo.nome_completo}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-2">
                              <span>{diaristaInfo?.nome_completo || "-"}</span>
                              <div
                                className="md:hidden flex flex-col gap-2 pt-2"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <div className="flex flex-wrap gap-2">
                                  {statusKey === STATUS.confirmada && (
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      disabled={updatingId === diaria.id || isAlreadyReprovada}
                                      onClick={() => openReasonDialog(diaria.id, STATUS.reprovada)}
                                    >
                                      Reprovar
                                    </Button>
                                  )}
                                  {isCancelPage && (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="text-destructive"
                                      disabled={deletingId === diaria.id}
                                      onClick={() => handleDeleteDiaria(diaria.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      <span className="sr-only">Excluir diaria</span>
                                    </Button>
                                  )}
                                </div>
                                {actionElement && <div>{actionElement}</div>}
                                <div className="flex flex-col gap-2">
                                  <Select
                                    value={customStatusSelection[diaria.id] || ""}
                                    onValueChange={(value) =>
                                      setCustomStatusSelection((prev) => ({ ...prev, [diaria.id]: value }))
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
                                      updatingId === diaria.id ||
                                      !customStatusSelection[diaria.id] ||
                                      customStatusSelection[diaria.id] === diaria.status
                                    }
                                    onClick={() => handleCustomStatusApply(diaria.id)}
                                  >
                                    Aplicar
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {currencyFormatter.format(diaria.valor || 0)}
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
                                      disabled={updatingId === diaria.id || isAlreadyReprovada}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        openReasonDialog(diaria.id, STATUS.reprovada);
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
                                      disabled={deletingId === diaria.id}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleDeleteDiaria(diaria.id);
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      <span className="sr-only">Excluir di\u00e1ria</span>
                                    </Button>
                                  )}
                                </div>
                                {actionElement && (
                                  <div onClick={(event) => event.stopPropagation()}>{actionElement}</div>
                                )}
                                <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
                                  <Select
                                    value={customStatusSelection[diaria.id] || ""}
                                    onValueChange={(value) =>
                                      setCustomStatusSelection((prev) => ({ ...prev, [diaria.id]: value }))
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
                                      updatingId === diaria.id ||
                                      !customStatusSelection[diaria.id] ||
                                      customStatusSelection[diaria.id] === diaria.status
                                    }
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleCustomStatusApply(diaria.id);
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
            <p className="text-sm text-muted-foreground text-center">Atualizando informações...</p>
          )}
        </div>

        <Dialog open={reasonDialog.open} onOpenChange={(open) => (open ? null : closeReasonDialog())}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {normalizeStatus(reasonDialog.targetStatus || "") === normalizedReprovadaStatus
                  ? "Reprovar diária"
                  : "Cancelar diária"}
              </DialogTitle>
              <DialogDescription>
                Informe o motivo para {normalizeStatus(reasonDialog.targetStatus || "") === normalizedReprovadaStatus
                  ? "reprovar"
                  : "cancelar"} esta diária.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="motivo-diaria">Motivo</Label>
              <Textarea
                id="motivo-diaria"
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
                Consulte totais das di\u00e1rias neste status. A primeira sess\u00e3o considera apenas diarista e datas; a segunda inclui o cliente vinculado ao posto de servi\u00e7o.
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
                  <p className="text-sm text-muted-foreground">Total no per\u00edodo</p>
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
                  <p className="text-sm text-muted-foreground">Total no per\u00edodo (com cliente)</p>
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
                  <p className="text-sm text-muted-foreground">Total no per\u00edodo (cliente)</p>
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
              <DialogTitle>Detalhes da diária</DialogTitle>
              <DialogDescription>
                Visualize as informações completas da diária selecionada e os dados bancários do diarista.
              </DialogDescription>
            </DialogHeader>
            {selectedDiaria && (
              <div className="space-y-6 text-sm">
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Informações gerais</p>
                  <div className="mt-2 grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-muted-foreground text-xs">Data</p>
                      <p className="font-medium">{formatDate(selectedDiaInfo?.data)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Status</p>
                      <p className="font-medium">
                        {STATUS_LABELS[selectedDiaria.status] || selectedDiaria.status}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Posto</p>
                      <p className="font-medium">{selectedPostoInfo?.nome || "-"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Unidade</p>
                      <p className="font-medium">{selectedPostoInfo?.unidade?.nome || "-"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Motivo (dia vago)</p>
                      <p className="font-medium">{selectedDiaInfo?.motivo || "-"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Contrato</p>
                      <p className="font-medium">{selectedContratoInfo?.negocio || "-"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Cliente</p>
                      <p className="font-medium">{selectedContratoInfo?.clienteNome || "-"}</p>
                    </div>
                    {deveExibirOcupanteNoDetalhe && selectedOcupanteInfo && (
                      <div>
                        <p className="text-muted-foreground text-xs">Colaborador alocado</p>
                        <p className="font-medium">{selectedOcupanteInfo.nome_completo}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-muted-foreground text-xs">Valor</p>
                      <p className="font-medium">
                        {currencyFormatter.format(selectedDiaria.valor || 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Atualizado em</p>
                      <p className="font-medium">{formatDateTime(selectedDiaria.updated_at)}</p>
                    </div>
                    {selectedDiaria.motivo_reprovacao && (
                      <div className="sm:col-span-2">
                        <p className="text-muted-foreground text-xs">Motivo reprovação</p>
                        <p className="font-medium whitespace-pre-line">
                          {selectedDiaria.motivo_reprovacao}
                        </p>
                      </div>
                    )}
                    {selectedDiaria.motivo_cancelamento && (
                      <div className="sm:col-span-2">
                        <p className="text-muted-foreground text-xs">Motivo cancelamento</p>
                        <p className="font-medium whitespace-pre-line">
                          {selectedDiaria.motivo_cancelamento}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Diarista</p>
                  <div className="mt-2 grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-muted-foreground text-xs">Nome</p>
                      <p className="font-medium">{selectedDiaristaInfo?.nome_completo || "-"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Status</p>
                      <p className="font-medium">{selectedDiaristaInfo?.status || "-"}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Dados bancários</p>
                  <div className="mt-2 grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-muted-foreground text-xs">Banco</p>
                      <p className="font-medium">{selectedDiaristaInfo?.banco || "-"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Agência</p>
                      <p className="font-medium">{selectedDiaristaInfo?.agencia || "-"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Número da conta</p>
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

export const DiariasAguardandoPage = createStatusPage(STATUS_CONFIGS[0]);
export const DiariasConfirmadasPage = createStatusPage(STATUS_CONFIGS[1]);
export const DiariasAprovadasPage = createStatusPage(STATUS_CONFIGS[2]);
export const DiariasLancadasPage = createStatusPage(STATUS_CONFIGS[3]);
export const DiariasAprovadasPagamentoPage = createStatusPage(STATUS_CONFIGS[4]);
export const DiariasReprovadasPage = createStatusPage(STATUS_CONFIGS[5]);
export const DiariasCanceladasPage = createStatusPage(STATUS_CONFIGS[6]);


