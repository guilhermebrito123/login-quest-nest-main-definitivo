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
                {diariasDoStatus.length} diária(s)
              </Badge>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {diariasDoStatus.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  {emptyMessage || "Nenhuma diária encontrada para este status no período selecionado."}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Posto</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead>Motivo (dia vago)</TableHead>
                      <TableHead>Diarista</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Atualizado em</TableHead>
                      {showReasonColumn && <TableHead>Motivo</TableHead>}
                    <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {diariasDoStatus.map((diaria) => {
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
                          <TableCell>{postoInfo?.nome || "-"}</TableCell>
                          <TableCell>{postoInfo?.unidade?.nome || "-"}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span>{diaInfo?.motivo || "-"}</span>
                              {deveExibirOcupanteNaLinha && ocupanteInfo && (
                                <span className="text-xs text-muted-foreground">
                                  Ocupado por: {ocupanteInfo.nome_completo}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{diaristaInfo?.nome_completo || "-"}</TableCell>
                          <TableCell>{currencyFormatter.format(diaria.valor || 0)}</TableCell>
                          <TableCell>{formatDateTime(diaria.updated_at)}</TableCell>
                          {showReasonColumn && (
                            <TableCell className="text-sm text-muted-foreground max-w-xs whitespace-pre-line">
                              {normalizedKey === normalizedReprovadaStatus
                                ? diaria.motivo_reprovacao || "-"
                                : diaria.motivo_cancelamento || "-"}
                            </TableCell>
                          )}
                          <TableCell onClick={(event) => event.stopPropagation()}>
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
                  ? "Reprovar di\u00e1ria"
                  : "Cancelar di\u00e1ria"}
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
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
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
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
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
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
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
