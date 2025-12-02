import { useMemo, useState } from "react";
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
    title: "Di├írias aguardando confirma├º├úo",
    description: "Confirme as di├írias rec├®m cadastradas antes de liberar para aprova├º├úo.",
    emptyMessage: "Nenhuma di├íria aguardando confirma├º├úo.",
  },
  {
    statusKey: STATUS.confirmada,
    title: "Di├írias confirmadas",
    description: "Di├írias prontas para aprova├º├úo financeira.",
  },
  {
    statusKey: STATUS.aprovada,
    title: "Di├írias aprovadas",
    description: "Avance as di├írias aprovadas para lan├ºamento.",
  },
  {
    statusKey: STATUS.lancada,
    title: "Di├írias lan├ºadas para pagamento",
    description: "Di├írias lan├ºadas aguardando aprova├º├úo de pagamento.",
  },
  {
    statusKey: STATUS.aprovadaPagamento,
    title: "Di├írias aprovadas para pagamento",
    description: "Acompanhe as di├írias aprovadas que est├úo em fase final de pagamento.",
  },
  {
    statusKey: STATUS.reprovada,
    title: "Di├írias reprovadas",
    description: "Hist├│rico de di├írias reprovadas com seus respectivos motivos.",
    emptyMessage: "Nenhuma di├íria reprovada.",
  },
  {
    statusKey: STATUS.cancelada,
    title: "Di├írias canceladas",
    description: "Hist├│rico de di├írias canceladas.",
    emptyMessage: "Nenhuma di├íria cancelada.",
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
      postoId: "",
      data: "",
    });
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

    const diaristaOptions = useMemo(() => {
      const map = new Map<string, string>();
      diariasDoStatus.forEach((diaria) => {
        const diaristaInfo =
          diaristaMap.get(diaria.diarista_id) ?? diaria.diarista ?? null;
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

    const postoOptions = useMemo(() => {
      const map = new Map<string, string>();
      diariasDoStatus.forEach((diaria) => {
        const diaInfo =
          postoDiaVagoMap.get(diaria.posto_dia_vago_id) ?? diaria.posto_dia_vago ?? null;
        const posto = diaInfo?.posto;
        if (posto?.id && posto.nome) {
          const unidade = posto.unidade?.nome ? ` - ${posto.unidade.nome}` : "";
          map.set(posto.id, `${posto.nome}${unidade}`);
        }
      });
      return Array.from(map.entries())
        .map(([id, nome]) => ({ id, nome }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
    }, [diariasDoStatus, postoDiaVagoMap]);

    const diariasFiltradas = useMemo(() => {
      return diariasDoStatus.filter((diaria) => {
        const diaInfo =
          postoDiaVagoMap.get(diaria.posto_dia_vago_id) ?? diaria.posto_dia_vago ?? null;
        const diaristaId = diaria.diarista_id || "";
        const motivo = diaInfo?.motivo ?? "";
        const postoId = diaInfo?.posto?.id ?? "";
        const data = diaInfo?.data ?? "";

        if (filters.diaristaId && filters.diaristaId !== diaristaId) {
          return false;
        }
        if (filters.motivo && filters.motivo !== motivo) {
          return false;
        }
        if (filters.postoId && filters.postoId !== postoId) {
          return false;
        }
        if (filters.data && filters.data !== data) {
          return false;
        }
        return true;
      });
    }, [diariasDoStatus, filters, postoDiaVagoMap]);

    const hasActiveFilters = useMemo(() => Object.values(filters).some(Boolean), [filters]);

    const handleClearFilters = () =>
      setFilters({
        diaristaId: "",
        motivo: "",
        postoId: "",
        data: "",
      });

    const allDiariasDoStatus = useMemo(
      () => diarias.filter((diaria) => normalizeStatus(diaria.status) === normalizedKey),
      [diarias, normalizedKey],
    );

    const fallbackMonth = useMemo(() => {
      for (const diaria of allDiariasDoStatus) {
        const diaInfo =
          postoDiaVagoMap.get(diaria.posto_dia_vago_id) ?? diaria.posto_dia_vago ?? null;
        const monthValue = getMonthValue(diaInfo?.data);
        if (monthValue) return monthValue;
      }
      return null;
    }, [allDiariasDoStatus, postoDiaVagoMap]);

    const hasHiddenData =
      diariasDoStatus.length === 0 && allDiariasDoStatus.length > 0 && Boolean(fallbackMonth);

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
        return "Deseja confirmar esta di\u00e1ria?";
      }
      if (normalized === normalizeStatus(STATUS.aprovada)) {
        return "Deseja aprovar esta di\u00e1ria?";
      }
      if (normalized === normalizeStatus(STATUS.lancada)) {
        return "Deseja lan\u00e7ar esta di\u00e1ria para pagamento?";
      }
      if (normalized === normalizeStatus(STATUS.aprovadaPagamento)) {
        return "Deseja aprovar esta di\u00e1ria para pagamento?";
      }
      if (normalized === normalizeStatus(STATUS.reprovada)) {
        return "Deseja reprovar esta di\u00e1ria?";
      }
      if (normalized === normalizeStatus(STATUS.cancelada)) {
        return "Deseja cancelar esta di\u00e1ria?";
      }
      return `Deseja alterar o status da di\u00e1ria para ${STATUS_LABELS[status] || status}?`;
    };

    const confirmStatusChange = (status: string) => {
      if (typeof window === "undefined") return true;
      return window.confirm(getConfirmationMessage(status));
    };

    const handleDeleteDiaria = async (id: string) => {
      if (typeof window !== "undefined") {
        const confirmed = window.confirm("Deseja excluir esta di\u00e1ria cancelada?");
        if (!confirmed) return;
      }
      setDeletingId(id);
      try {
        const { error } = await supabase.from("diarias").delete().eq("id", id);
        if (error) throw error;
        toast.success("Di\u00e1ria exclu\u00edda.");
        await refetchDiarias();
      } catch (error: any) {
        toast.error(error.message || "Erro ao excluir a di\u00e1ria.");
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
        toast.error(error.message || "Erro ao atualizar status da di├íria.");
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
              <p className="text-sm text-muted-foreground uppercase tracking-wide">Di├írias</p>
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
                  Existem di├írias neste status fora do m├¬s selecionado.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-red-600 text-white hover:bg-red-700"
                  onClick={() => setSelectedMonth(fallbackMonth)}
                >
                  Ver m├¬s com registros
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
                    <Label htmlFor={`filtro-posto-${statusKey}`}>Posto de servico</Label>
                    <Select
                      value={filters.postoId || selectAllValue}
                      onValueChange={(value) =>
                        setFilters((prev) => ({
                          ...prev,
                          postoId: value === selectAllValue ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger id={`filtro-posto-${statusKey}`}>
                        <SelectValue placeholder="Todos os postos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={selectAllValue}>Todos os postos</SelectItem>
                        {postoOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`filtro-data-${statusKey}`}>Data</Label>
                    <Input
                      id={`filtro-data-${statusKey}`}
                      type="date"
                      value={filters.data}
                      onChange={(event) =>
                        setFilters((prev) => ({ ...prev, data: event.target.value }))
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
                      <TableHead className="hidden md:table-cell">Atualizado em</TableHead>
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
                            className="cursor-pointer transition hover:bg-muted/40"
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
                            {formatDateTime(diaria.updated_at)}
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
            <p className="text-sm text-muted-foreground text-center">Atualizando informa├º├Áes...</p>
          )}
        </div>

        <Dialog open={reasonDialog.open} onOpenChange={(open) => (open ? null : closeReasonDialog())}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {normalizeStatus(reasonDialog.targetStatus || "") === normalizedReprovadaStatus
                  ? "Reprovar di\u00e1ria"
                  : "Cancelar di\u00e1ria"}
              </DialogTitle>
              <DialogDescription>
                Informe o motivo para {normalizeStatus(reasonDialog.targetStatus || "") === normalizedReprovadaStatus
                  ? "reprovar"
                  : "cancelar"} esta di├íria.
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

        <Dialog open={detailsDialogOpen} onOpenChange={(open) => (open ? null : closeDetailsDialog())}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Detalhes da di├íria</DialogTitle>
              <DialogDescription>
                Visualize as informa├º├Áes completas da di├íria selecionada e os dados banc├írios do diarista.
              </DialogDescription>
            </DialogHeader>
            {selectedDiaria && (
              <div className="space-y-6 text-sm">
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Informa├º├Áes gerais</p>
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
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Dados banc├írios</p>
                  <div className="mt-2 grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-muted-foreground text-xs">Banco</p>
                      <p className="font-medium">{selectedDiaristaInfo?.banco || "-"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Ag├¬ncia</p>
                      <p className="font-medium">{selectedDiaristaInfo?.agencia || "-"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">N├║mero da conta</p>
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


