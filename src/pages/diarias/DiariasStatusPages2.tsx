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
    const statusOptions = useMemo(
      () => Object.values(STATUS).filter((status) => status !== STATUS.reprovada),
      [],
    );

    const normalizedKey = normalizeStatus(statusKey);
    const normalizedCancelStatus = normalizeStatus(STATUS.cancelada);
    const normalizedReprovadaStatus = normalizeStatus(STATUS.reprovada);
    const isCancelPage = normalizedKey === normalizedCancelStatus;

    const diariasDoStatus = useMemo(
      () => filteredDiarias.filter((diaria) => normalizeStatus(diaria.status) === normalizedKey),
      [filteredDiarias, normalizedKey],
    );

    const allDiariasDoStatus = useMemo(
      () => diarias.filter((diaria) => normalizeStatus(diaria.status) === normalizedKey),
      [diarias, normalizedKey],
    );

    const fallbackMonth = useMemo(() => {
      for (const diaria of allDiariasDoStatus) {
        const monthValue = getMonthValue(diaria.data_diaria);
        if (monthValue) return monthValue;
      }
      return null;
    }, [allDiariasDoStatus]);

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
            <CardContent className="overflow-x-auto">
              {diariasDoStatus.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  {emptyMessage || "Nenhuma diaria para este status no periodo selecionado."}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Colaborador ausente</TableHead>
                      <TableHead>Posto</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead>Diarista</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Atualizado em</TableHead>
                      {showReasonColumn && <TableHead>Motivo</TableHead>}
                      <TableHead className="text-right">Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {diariasDoStatus.map((diaria) => {
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
                      const actionElement = renderAction(diaria.id.toString(), diaria.status);
                      return (
                        <TableRow
                          key={diaria.id}
                          className="cursor-pointer transition hover:bg-muted/40"
                          onClick={() => handleRowClick(diaria)}
                        >
                          <TableCell>{formatDate(diaria.data_diaria)}</TableCell>
                          <TableCell>{colaboradorInfo?.nome_completo || "-"}</TableCell>
                          <TableCell>{postoInfo?.nome || "-"}</TableCell>
                          <TableCell>{postoInfo?.unidade?.nome || "-"}</TableCell>
                          <TableCell>{diaristaInfo?.nome_completo || "-"}</TableCell>
                          <TableCell>{currencyFormatter.format(diaria.valor_diaria || 0)}</TableCell>
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

        <Dialog open={detailsDialogOpen} onOpenChange={(open) => (open ? null : closeDetailsDialog())}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Detalhes da diaria temporaria</DialogTitle>
              <DialogDescription>Informacoes completas da diaria selecionada.</DialogDescription>
            </DialogHeader>
            {selectedDiaria && (
              <div className="space-y-6 text-sm">
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Informacoes gerais</p>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
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
                      <p className="text-muted-foreground text-xs">Posto</p>
                      <p className="font-medium">{selectedPostoInfo?.nome || "-"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Unidade</p>
                      <p className="font-medium">{selectedPostoInfo?.unidade?.nome || "-"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Valor</p>
                      <p className="font-medium">{currencyFormatter.format(selectedDiaria.valor_diaria || 0)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Atualizado em</p>
                      <p className="font-medium">{formatDateTime(selectedDiaria.updated_at)}</p>
                    </div>
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
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Colaborador ausente</p>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-muted-foreground text-xs">Nome</p>
                      <p className="font-medium">{selectedColaboradorInfo?.nome_completo || "-"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Cargo</p>
                      <p className="font-medium">{selectedColaboradorInfo?.cargo || "-"}</p>
                    </div>
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
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Dados bancarios</p>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
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
