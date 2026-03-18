
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Constants, type Database } from "@/integrations/supabase/types";
import { useSession } from "@/hooks/useSession";
import { formatDate, formatDateTime } from "@/pages/diarias/utils";

type HoraExtraRow = Database["public"]["Tables"]["horas_extras"]["Row"];
type FaltaConveniaRow =
  Database["public"]["Tables"]["faltas_colaboradores_convenia"]["Row"];
type ColaboradorConveniaRow =
  Database["public"]["Tables"]["colaboradores_convenia"]["Row"];
type CostCenterRow = Database["public"]["Tables"]["cost_center"]["Row"];
type HoraExtraStatus = Database["public"]["Enums"]["status_hora_extra"];

type HoraExtraWithFalta = HoraExtraRow & {
  falta?: Pick<
    FaltaConveniaRow,
    "id" | "data_falta" | "motivo" | "colaborador_convenia_id"
  > | null;
};

interface StatusPageConfig {
  title: string;
  description: string;
  statusKey: HoraExtraStatus;
  emptyMessage?: string;
}

const STATUS_CONFIGS: StatusPageConfig[] = [
  {
    statusKey: "pendente",
    title: "Horas extras pendentes",
    description: "Registros aguardando confirmacao.",
    emptyMessage: "Nenhuma hora extra pendente.",
  },
  {
    statusKey: "confirmada",
    title: "Horas extras confirmadas",
    description: "Registros confirmados aguardando aprovacao.",
    emptyMessage: "Nenhuma hora extra confirmada.",
  },
  {
    statusKey: "aprovada",
    title: "Horas extras aprovadas",
    description: "Horas extras aprovadas.",
    emptyMessage: "Nenhuma hora extra aprovada.",
  },
  {
    statusKey: "reprovada",
    title: "Horas extras reprovadas",
    description: "Historico de reprovacoes.",
    emptyMessage: "Nenhuma hora extra reprovada.",
  },
  {
    statusKey: "cancelada",
    title: "Horas extras canceladas",
    description: "Historico de cancelamentos.",
    emptyMessage: "Nenhuma hora extra cancelada.",
  },
];

const STATUS_LABELS: Record<HoraExtraStatus, string> = {
  pendente: "Pendente",
  confirmada: "Confirmada",
  aprovada: "Aprovada",
  reprovada: "Reprovada",
  cancelada: "Cancelada",
};

const STATUS_BADGE_VARIANT: Record<
  HoraExtraStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pendente: "outline",
  confirmada: "secondary",
  aprovada: "default",
  reprovada: "destructive",
  cancelada: "destructive",
};

const toLocalInput = (value?: string | null) => {
  if (!value) return "";
  try {
    return format(new Date(value), "yyyy-MM-dd'T'HH:mm");
  } catch {
    return "";
  }
};

const toIsoOrNull = (value: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const getColaboradorNome = (colaborador?: ColaboradorConveniaRow | null) => {
  if (!colaborador) return "-";
  const base = (colaborador.name || "").trim();
  const last = (colaborador.last_name || "").trim();
  const full = [base, last].filter(Boolean).join(" ").trim();
  return full || colaborador.name || colaborador.id || "-";
};

const formatEnumLabel = (value?: string | null) => {
  if (!value) return "-";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const calcDuracaoMin = (hora: HoraExtraWithFalta) => {
  const inicio = new Date(hora.inicio_em).getTime();
  const fim = new Date(hora.fim_em).getTime();
  if (!inicio || !fim || fim <= inicio) return 0;
  let total = Math.round((fim - inicio) / 60000);
  if (hora.intervalo_inicio_em && hora.intervalo_fim_em) {
    const iniIntervalo = new Date(hora.intervalo_inicio_em).getTime();
    const fimIntervalo = new Date(hora.intervalo_fim_em).getTime();
    if (iniIntervalo && fimIntervalo && fimIntervalo > iniIntervalo) {
      total -= Math.round((fimIntervalo - iniIntervalo) / 60000);
    }
  }
  return Math.max(total, 0);
};

const formatDuracao = (minutos: number) => {
  if (!minutos) return "0h";
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (!resto) return `${horas}h`;
  return `${horas}h${resto.toString().padStart(2, "0")}`;
};
const useHoraExtraData = () => {
  const { session, loading: sessionLoading } = useSession();

  const { data: colaboradoresConvenia = [] } = useQuery({
    queryKey: ["colaboradores-convenia-hora-extra", session?.user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaboradores_convenia")
        .select("id, name, last_name, social_name, cost_center_id, cost_center_name")
        .order("name");
      if (error) throw error;
      return (data || []) as ColaboradorConveniaRow[];
    },
    enabled: !!session,
  });

  const { data: costCenters = [] } = useQuery({
    queryKey: ["cost-centers-hora-extra", session?.user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cost_center")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return (data || []) as CostCenterRow[];
    },
    enabled: !!session,
  });

  const {
    data: horasExtras = [],
    isLoading: loadingHoras,
    refetch: refetchHorasExtras,
  } = useQuery({
    queryKey: ["horas-extras", session?.user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("horas_extras")
        .select(
          "*, falta:faltas_colaboradores_convenia(id, data_falta, motivo, colaborador_convenia_id)",
        )
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data || []) as HoraExtraWithFalta[];
    },
    enabled: !!session,
  });

  const usuarioIds = useMemo(() => {
    const set = new Set<string>();
    horasExtras.forEach((hora) => {
      [
        hora.criado_por,
        hora.confirmado_por,
        hora.aprovado_por,
        hora.reprovado_por,
        hora.cancelado_por,
      ].forEach((id) => {
        if (id) set.add(id);
      });
    });
    return Array.from(set).sort();
  }, [horasExtras]);

  const { data: usuarios = [] } = useQuery({
    queryKey: ["usuarios-hora-extra", session?.user?.id, usuarioIds],
    queryFn: async () => {
      if (usuarioIds.length === 0) return [];
      try {
        const rpcResult = await supabase.rpc("get_profiles_names", {
          p_ids: usuarioIds,
        });
        if (!rpcResult.error && rpcResult.data) {
          return rpcResult.data;
        }
      } catch (error) {
        console.warn("RPC get_profiles_names falhou", error);
      }

      const { data, error } = await supabase
        .from("usuarios")
        .select("id, full_name, email")
        .in("id", usuarioIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!session && usuarioIds.length > 0,
  });

  const colaboradoresConveniaMap = useMemo(() => {
    const map = new Map<string, ColaboradorConveniaRow>();
    colaboradoresConvenia.forEach((item) => {
      if (item.id) map.set(item.id, item);
    });
    return map;
  }, [colaboradoresConvenia]);

  const costCenterMap = useMemo(() => {
    const map = new Map<string, string>();
    costCenters.forEach((center) => {
      if (center.id) map.set(center.id, center.name || center.id);
    });
    return map;
  }, [costCenters]);

  const usuarioMap = useMemo(() => {
    const map = new Map<string, string>();
    usuarios.forEach((usuario: any) => {
      if (usuario.id) {
        map.set(
          usuario.id,
          usuario.full_name || usuario.email || usuario.nome || usuario.id,
        );
      }
    });
    return map;
  }, [usuarios]);

  return {
    colaboradoresConvenia,
    colaboradoresConveniaMap,
    costCenters,
    costCenterMap,
    horasExtras,
    loading: sessionLoading || loadingHoras,
    refetchHorasExtras,
    usuarioMap,
  };
};

const createStatusPage = ({
  statusKey,
  title,
  description,
  emptyMessage,
}: StatusPageConfig) => {
  return function HoraExtraStatusPage() {
    const {
      colaboradoresConvenia,
      colaboradoresConveniaMap,
      costCenters,
      costCenterMap,
      horasExtras,
      loading,
      refetchHorasExtras,
      usuarioMap,
    } = useHoraExtraData();

    const [filters, setFilters] = useState({
      search: "",
      colaboradorAusenteId: "",
      colaboradorAusenteCostCenterId: "",
      colaboradorCobrindoId: "",
      colaboradorCobrindoCostCenterId: "",
      costCenterId: "",
      operacao: "",
      inicioDe: "",
      inicioAte: "",
    });
    const [viewMode, setViewMode] = useState<"lista" | "agrupadas">("lista");
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [selectedHoraExtra, setSelectedHoraExtra] =
      useState<HoraExtraWithFalta | null>(null);
    const [reasonDialog, setReasonDialog] = useState<{
      open: boolean;
      type: "reprovar" | "cancelar" | null;
      horaExtra: HoraExtraWithFalta | null;
    }>({ open: false, type: null, horaExtra: null });
    const [reasonValue, setReasonValue] = useState("");
    const [reasonDetail, setReasonDetail] = useState("");
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingSaving, setEditingSaving] = useState(false);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({
      colaboradorCobrindoId: "",
      operacao: "",
      inicioEm: "",
      fimEm: "",
      intervaloInicioEm: "",
      intervaloFimEm: "",
      observacao: "",
    });

    const motivoReprovacaoOptions =
      Constants.public.Enums.motivo_reprovacao_hora_extra || [];
    const motivoCancelamentoOptions =
      Constants.public.Enums.motivo_cancelamento_hora_extra || [];
    const operacaoOptions =
      Constants.public.Enums.operacao_hora_extra || [];

    const horasPorStatus = useMemo(
      () => horasExtras.filter((hora) => hora.status === statusKey),
      [horasExtras, statusKey],
    );
    const allowedActions = useMemo(() => {
      switch (statusKey) {
        case "pendente":
          return {
            confirm: true,
            approve: false,
            reprove: false,
            cancel: true,
            edit: true,
            delete: false,
          };
        case "confirmada":
          return {
            confirm: false,
            approve: true,
            reprove: true,
            cancel: false,
            edit: true,
            delete: false,
          };
        case "aprovada":
          return {
            confirm: false,
            approve: false,
            reprove: false,
            cancel: false,
            edit: false,
            delete: false,
          };
        case "reprovada":
        case "cancelada":
          return {
            confirm: false,
            approve: false,
            reprove: false,
            cancel: false,
            edit: false,
            delete: true,
          };
        default:
          return {
            confirm: false,
            approve: false,
            reprove: false,
            cancel: false,
            edit: false,
            delete: false,
          };
      }
    }, [statusKey]);

    const filteredHoras = useMemo(() => {
      const term = filters.search.trim().toLowerCase();
      const hasTerm = term.length > 0;
      return horasPorStatus.filter((hora) => {
        const falta = hora.falta;
        const colaboradorAusente = falta
          ? colaboradoresConveniaMap.get(falta.colaborador_convenia_id)
          : null;
        const colaboradorCobrindo = colaboradoresConveniaMap.get(
          hora.colaborador_cobrindo_id,
        );
        const costCenterNome =
          costCenterMap.get(hora.local_hora_extra) || "";

        if (
          filters.colaboradorAusenteId &&
          falta?.colaborador_convenia_id !== filters.colaboradorAusenteId
        ) {
          return false;
        }
        if (filters.colaboradorAusenteCostCenterId) {
          const ausenteCostCenterId = colaboradorAusente?.cost_center_id || "";
          if (ausenteCostCenterId !== filters.colaboradorAusenteCostCenterId) {
            return false;
          }
        }
        if (
          filters.colaboradorCobrindoId &&
          hora.colaborador_cobrindo_id !== filters.colaboradorCobrindoId
        ) {
          return false;
        }
        if (filters.colaboradorCobrindoCostCenterId) {
          const cobrindoCostCenterId =
            colaboradorCobrindo?.cost_center_id || "";
          if (cobrindoCostCenterId !== filters.colaboradorCobrindoCostCenterId) {
            return false;
          }
        }
        if (
          filters.costCenterId &&
          hora.local_hora_extra !== filters.costCenterId
        ) {
          return false;
        }
        if (filters.operacao && hora.operacao !== filters.operacao) {
          return false;
        }
        if (filters.inicioDe) {
          const start = new Date(`${filters.inicioDe}T00:00:00`);
          if (new Date(hora.inicio_em) < start) return false;
        }
        if (filters.inicioAte) {
          const end = new Date(`${filters.inicioAte}T23:59:59`);
          if (new Date(hora.inicio_em) > end) return false;
        }
        if (hasTerm) {
          const haystack = [
            hora.operacao,
            getColaboradorNome(colaboradorAusente),
            getColaboradorNome(colaboradorCobrindo),
            costCenterNome,
            falta?.motivo,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(term)) return false;
        }
        return true;
      });
    }, [
      horasPorStatus,
      filters,
      colaboradoresConveniaMap,
      costCenterMap,
    ]);

    const colaboradoresCobrindoOptions = useMemo(() => {
      if (!filters.colaboradorCobrindoCostCenterId) return colaboradoresConvenia;
      return colaboradoresConvenia.filter(
        (colaborador) =>
          colaborador.cost_center_id ===
          filters.colaboradorCobrindoCostCenterId,
      );
    }, [colaboradoresConvenia, filters.colaboradorCobrindoCostCenterId]);

    useEffect(() => {
      if (!filters.colaboradorCobrindoId) return;
      const stillAvailable = colaboradoresCobrindoOptions.some(
        (colaborador) => colaborador.id === filters.colaboradorCobrindoId,
      );
      if (!stillAvailable) {
        setFilters((prev) => ({ ...prev, colaboradorCobrindoId: "" }));
      }
    }, [colaboradoresCobrindoOptions, filters.colaboradorCobrindoId]);

    const groupedHoras = useMemo(() => {
      const collator = new Intl.Collator("pt-BR", {
        sensitivity: "base",
        ignorePunctuation: true,
        numeric: true,
      });
      const map = new Map<
        string,
        {
          colaboradorId: string;
          nome: string;
          itens: HoraExtraWithFalta[];
          totalMin: number;
        }
      >();

      filteredHoras.forEach((hora) => {
        const colaboradorId = hora.colaborador_cobrindo_id || "unknown";
        const colaborador =
          colaboradoresConveniaMap.get(colaboradorId) || null;
        const nome = getColaboradorNome(colaborador);
        const totalMin = calcDuracaoMin(hora);

        if (!map.has(colaboradorId)) {
          map.set(colaboradorId, {
            colaboradorId,
            nome,
            itens: [],
            totalMin: 0,
          });
        }
        const group = map.get(colaboradorId)!;
        group.itens.push(hora);
        group.totalMin += totalMin;
      });

      const groups = Array.from(map.values());
      groups.sort((a, b) => collator.compare(a.nome, b.nome));
      return groups;
    }, [filteredHoras, colaboradoresConveniaMap]);

    const handleOpenDetails = (hora: HoraExtraWithFalta) => {
      setSelectedHoraExtra(hora);
      setDetailsOpen(true);
    };

    const handleConfirmar = async (hora: HoraExtraWithFalta) => {
      try {
        setUpdatingId(hora.id);
        const { error } = await supabase.rpc("confirmar_hora_extra", {
          p_hora_extra_id: hora.id,
        });
        if (error) throw error;
        toast.success("Hora extra confirmada.");
        await refetchHorasExtras();
      } catch (error: any) {
        toast.error(error?.message || "Nao foi possivel confirmar.");
      } finally {
        setUpdatingId(null);
      }
    };

    const handleAprovar = async (hora: HoraExtraWithFalta) => {
      try {
        setUpdatingId(hora.id);
        const { error } = await supabase.rpc("aprovar_hora_extra", {
          p_hora_extra_id: hora.id,
        });
        if (error) throw error;
        toast.success("Hora extra aprovada.");
        await refetchHorasExtras();
      } catch (error: any) {
        toast.error(error?.message || "Nao foi possivel aprovar.");
      } finally {
        setUpdatingId(null);
      }
    };

    const openReasonDialog = (
      type: "reprovar" | "cancelar",
      hora: HoraExtraWithFalta,
    ) => {
      setReasonDialog({ open: true, type, horaExtra: hora });
      setReasonValue("");
      setReasonDetail("");
    };

    const handleReasonSubmit = async () => {
      if (!reasonDialog.horaExtra || !reasonDialog.type) return;
      if (!reasonValue) {
        toast.error("Selecione o motivo.");
        return;
      }
      const hora = reasonDialog.horaExtra;
      try {
        setUpdatingId(hora.id);
        if (reasonDialog.type === "reprovar") {
          const { error } = await supabase.rpc("reprovar_hora_extra", {
            p_hora_extra_id: hora.id,
            p_motivo_reprovacao:
              reasonValue as Database["public"]["Enums"]["motivo_reprovacao_hora_extra"],
            p_detalhe_reprovacao: reasonDetail.trim() || null,
          });
          if (error) throw error;
          toast.success("Hora extra reprovada.");
        } else {
          const { error } = await supabase.rpc("cancelar_hora_extra", {
            p_hora_extra_id: hora.id,
            p_motivo_cancelamento:
              reasonValue as Database["public"]["Enums"]["motivo_cancelamento_hora_extra"],
            p_detalhe_cancelamento: reasonDetail.trim() || null,
          });
          if (error) throw error;
          toast.success("Hora extra cancelada.");
        }
        setReasonDialog({ open: false, type: null, horaExtra: null });
        await refetchHorasExtras();
      } catch (error: any) {
        toast.error(error?.message || "Operacao nao concluida.");
      } finally {
        setUpdatingId(null);
      }
    };

    const handleDelete = async (hora: HoraExtraWithFalta) => {
      const confirm = window.confirm(
        "Deseja realmente excluir esta hora extra? Esta acao nao pode ser desfeita.",
      );
      if (!confirm) return;
      try {
        setDeletingId(hora.id);
        const { error } = await supabase
          .from("horas_extras")
          .delete()
          .eq("id", hora.id);
        if (error) throw error;
        toast.success("Hora extra excluida.");
        await refetchHorasExtras();
      } catch (error: any) {
        toast.error(error?.message || "Nao foi possivel excluir.");
      } finally {
        setDeletingId(null);
      }
    };

    const openEditDialog = (hora: HoraExtraWithFalta) => {
      setSelectedHoraExtra(hora);
      setEditingId(hora.id);
      setEditForm({
        colaboradorCobrindoId: hora.colaborador_cobrindo_id || "",
        operacao: hora.operacao || "",
        inicioEm: toLocalInput(hora.inicio_em),
        fimEm: toLocalInput(hora.fim_em),
        intervaloInicioEm: toLocalInput(hora.intervalo_inicio_em),
        intervaloFimEm: toLocalInput(hora.intervalo_fim_em),
        observacao: hora.observacao || "",
      });
      setEditDialogOpen(true);
    };

    const handleEditSubmit = async () => {
      if (!editingId) return;
      if (!editForm.colaboradorCobrindoId) {
        toast.error("Selecione o colaborador cobrindo.");
        return;
      }
      if (!editForm.operacao.trim()) {
        toast.error("Informe a operacao.");
        return;
      }
      if (!editForm.inicioEm || !editForm.fimEm) {
        toast.error("Informe inicio e fim.");
        return;
      }
      const inicioEm = toIsoOrNull(editForm.inicioEm);
      const fimEm = toIsoOrNull(editForm.fimEm);
      if (!inicioEm || !fimEm) {
        toast.error("Datas invalidas.");
        return;
      }
      const intervaloInicioEm = toIsoOrNull(editForm.intervaloInicioEm);
      const intervaloFimEm = toIsoOrNull(editForm.intervaloFimEm);
      if (
        (intervaloInicioEm && !intervaloFimEm) ||
        (!intervaloInicioEm && intervaloFimEm)
      ) {
        toast.error("Preencha inicio e fim do intervalo.");
        return;
      }

      try {
        setEditingSaving(true);
        const { error } = await supabase
          .from("horas_extras")
          .update({
            colaborador_cobrindo_id: editForm.colaboradorCobrindoId,
            operacao: editForm.operacao.trim(),
            inicio_em: inicioEm,
            fim_em: fimEm,
            intervalo_inicio_em: intervaloInicioEm,
            intervalo_fim_em: intervaloFimEm,
            observacao: editForm.observacao.trim() || null,
          })
          .eq("id", editingId);
        if (error) throw error;
        toast.success("Hora extra atualizada.");
        setEditDialogOpen(false);
        await refetchHorasExtras();
      } catch (error: any) {
        toast.error(error?.message || "Nao foi possivel salvar.");
      } finally {
        setEditingSaving(false);
      }
    };

    const resetFilters = () =>
      setFilters({
        search: "",
        colaboradorAusenteId: "",
        colaboradorAusenteCostCenterId: "",
        colaboradorCobrindoId: "",
        colaboradorCobrindoCostCenterId: "",
        costCenterId: "",
        operacao: "",
        inicioDe: "",
        inicioAte: "",
      });
    const renderTable = (
      items: HoraExtraWithFalta[],
      options?: { hideCobrindo?: boolean },
    ) => (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data falta</TableHead>
            <TableHead>Colaborador ausente</TableHead>
            {!options?.hideCobrindo && (
              <TableHead>Colaborador cobrindo</TableHead>
            )}
            <TableHead>Local da falta</TableHead>
            <TableHead>Operacao</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Acoes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((hora) => {
            const falta = hora.falta;
            const colaboradorAusente = falta
              ? colaboradoresConveniaMap.get(falta.colaborador_convenia_id)
              : null;
            const colaboradorCobrindo = colaboradoresConveniaMap.get(
              hora.colaborador_cobrindo_id,
            );
            const costCenterNome =
              costCenterMap.get(hora.local_hora_extra) || "-";
            const canConfirm = allowedActions.confirm;
            const canApprove = allowedActions.approve;
            const canReprove = allowedActions.reprove;
            const canCancel = allowedActions.cancel;
            const canDelete = allowedActions.delete;
            const isBusy = updatingId === hora.id || deletingId === hora.id;

            return (
              <TableRow
                key={hora.id}
                className="cursor-pointer transition-colors hover:bg-muted/40"
                onClick={() => handleOpenDetails(hora)}
              >
                <TableCell>
                  {falta?.data_falta ? formatDate(falta.data_falta) : "-"}
                </TableCell>
                <TableCell>{getColaboradorNome(colaboradorAusente)}</TableCell>
                {!options?.hideCobrindo && (
                  <TableCell>
                    {getColaboradorNome(colaboradorCobrindo)}
                  </TableCell>
                )}
                <TableCell>{costCenterNome}</TableCell>
                <TableCell>{hora.operacao}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_BADGE_VARIANT[hora.status]}>
                    {STATUS_LABELS[hora.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    {canConfirm && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleConfirmar(hora);
                        }}
                        disabled={isBusy}
                      >
                        Confirmar
                      </Button>
                    )}
                    {canApprove && (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleAprovar(hora);
                        }}
                        disabled={isBusy}
                      >
                        Aprovar
                      </Button>
                    )}
                    {canReprove && (
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={(event) => {
                          event.stopPropagation();
                          openReasonDialog("reprovar", hora);
                        }}
                        disabled={isBusy}
                      >
                        Reprovar
                      </Button>
                    )}
                    {canCancel && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={(event) => {
                          event.stopPropagation();
                          openReasonDialog("cancelar", hora);
                        }}
                        disabled={isBusy}
                      >
                        Cancelar
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDelete(hora);
                        }}
                        disabled={isBusy}
                      >
                        Excluir
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );

    const detailsFalta = selectedHoraExtra?.falta || null;
    const detailsAusente = detailsFalta
      ? colaboradoresConveniaMap.get(detailsFalta.colaborador_convenia_id)
      : null;
    const detailsCobrindo = selectedHoraExtra
      ? colaboradoresConveniaMap.get(
          selectedHoraExtra.colaborador_cobrindo_id,
        )
      : null;

    return (
      <DashboardLayout>
        <div className="space-y-6 p-4 md:p-6">
          <div>
            <p className="text-sm text-muted-foreground uppercase tracking-wide">
              Cobertura
            </p>
            <h1 className="text-3xl font-bold">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Filtros</CardTitle>
              <CardDescription>
                Use os filtros para localizar registros.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <Label>Busca</Label>
                  <Input
                    value={filters.search}
                    onChange={(event) =>
                      setFilters((prev) => ({
                        ...prev,
                        search: event.target.value,
                      }))
                    }
                    placeholder="Operacao, colaborador, centro de custo..."
                  />
                </div>
                <div className="space-y-1">
                  <Label>Colaborador ausente</Label>
                  <Select
                    value={filters.colaboradorAusenteId || "__all__"}
                    onValueChange={(value) =>
                      setFilters((prev) => ({
                        ...prev,
                        colaboradorAusenteId: value === "__all__" ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72 overflow-y-auto">
                      <SelectItem value="__all__">Todos</SelectItem>
                      {colaboradoresCobrindoOptions.map((colaborador) => (
                        <SelectItem key={colaborador.id} value={colaborador.id}>
                          {getColaboradorNome(colaborador)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Centro de custo do colaborador ausente</Label>
                  <Select
                    value={filters.colaboradorAusenteCostCenterId || "__all__"}
                    onValueChange={(value) =>
                      setFilters((prev) => ({
                        ...prev,
                        colaboradorAusenteCostCenterId:
                          value === "__all__" ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72 overflow-y-auto">
                      <SelectItem value="__all__">Todos</SelectItem>
                      {costCenters.map((center) => (
                        <SelectItem key={center.id} value={center.id}>
                          {center.name || center.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Colaborador cobrindo</Label>
                  <Select
                    value={filters.colaboradorCobrindoId || "__all__"}
                    onValueChange={(value) =>
                      setFilters((prev) => ({
                        ...prev,
                        colaboradorCobrindoId:
                          value === "__all__" ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72 overflow-y-auto">
                      <SelectItem value="__all__">Todos</SelectItem>
                      {colaboradoresConvenia.map((colaborador) => (
                        <SelectItem key={colaborador.id} value={colaborador.id}>
                          {getColaboradorNome(colaborador)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Centro de custo do colaborador cobrindo</Label>
                  <Select
                    value={filters.colaboradorCobrindoCostCenterId || "__all__"}
                    onValueChange={(value) =>
                      setFilters((prev) => ({
                        ...prev,
                        colaboradorCobrindoCostCenterId:
                          value === "__all__" ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72 overflow-y-auto">
                      <SelectItem value="__all__">Todos</SelectItem>
                      {costCenters.map((center) => (
                        <SelectItem key={center.id} value={center.id}>
                          {center.name || center.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Local da falta</Label>
                  <Select
                    value={filters.costCenterId || "__all__"}
                    onValueChange={(value) =>
                      setFilters((prev) => ({
                        ...prev,
                        costCenterId: value === "__all__" ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72 overflow-y-auto">
                      <SelectItem value="__all__">Todos</SelectItem>
                      {costCenters.map((center) => (
                        <SelectItem key={center.id} value={center.id}>
                          {center.name || center.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Operacao</Label>
                  <Select
                    value={filters.operacao || "__all__"}
                    onValueChange={(value) =>
                      setFilters((prev) => ({
                        ...prev,
                        operacao: value === "__all__" ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72 overflow-y-auto">
                      <SelectItem value="__all__">Todas</SelectItem>
                      {operacaoOptions.map((operacao) => (
                        <SelectItem key={operacao} value={operacao}>
                          {formatEnumLabel(operacao)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Inicio de</Label>
                  <Input
                    type="date"
                    value={filters.inicioDe}
                    onChange={(event) =>
                      setFilters((prev) => ({
                        ...prev,
                        inicioDe: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Inicio ate</Label>
                  <Input
                    type="date"
                    value={filters.inicioAte}
                    onChange={(event) =>
                      setFilters((prev) => ({
                        ...prev,
                        inicioAte: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" type="button" onClick={resetFilters}>
                  Limpar filtros
                </Button>
                <Button
                  variant={viewMode === "lista" ? "default" : "outline"}
                  type="button"
                  onClick={() => setViewMode("lista")}
                >
                  Lista completa
                </Button>
                <Button
                  variant={viewMode === "agrupadas" ? "default" : "outline"}
                  type="button"
                  onClick={() => setViewMode("agrupadas")}
                >
                  Agrupadas por colaborador
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Registros</CardTitle>
              <CardDescription>
                {loading
                  ? "Carregando horas extras..."
                  : `${filteredHoras.length} registro(s) encontrado(s).`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!loading && filteredHoras.length === 0 && (
                <div className="text-sm text-muted-foreground">
                  {emptyMessage || "Nenhuma hora extra encontrada."}
                </div>
              )}
              {!loading && filteredHoras.length > 0 && viewMode === "lista" && (
                <div className="overflow-x-auto">
                  {renderTable(filteredHoras)}
                </div>
              )}
              {!loading &&
                filteredHoras.length > 0 &&
                viewMode === "agrupadas" && (
                  <div className="space-y-4">
                    {groupedHoras.map((group) => (
                      <Card key={group.colaboradorId}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">
                            {group.nome}
                          </CardTitle>
                          <CardDescription>
                            {group.itens.length} registro(s) •{" "}
                            {formatDuracao(group.totalMin)}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="overflow-x-auto">
                          {renderTable(group.itens, {
                            hideCobrindo: true,
                          })}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
            </CardContent>
          </Card>
        </div>

        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Detalhes da hora extra</DialogTitle>
              <DialogDescription>
                Informacoes completas do registro selecionado.
              </DialogDescription>
            </DialogHeader>
            {selectedHoraExtra && (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Status</Label>
                  <div>
                    <Badge
                      variant={
                        STATUS_BADGE_VARIANT[selectedHoraExtra.status]
                      }
                    >
                      {STATUS_LABELS[selectedHoraExtra.status]}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label>Operacao</Label>
                  <div>{selectedHoraExtra.operacao}</div>
                </div>
                <div>
                  <Label>Data da falta</Label>
                  <div>
                    {detailsFalta?.data_falta
                      ? formatDate(detailsFalta.data_falta)
                      : "-"}
                  </div>
                </div>
                <div>
                  <Label>Motivo da falta</Label>
                  <div>{detailsFalta?.motivo || "-"}</div>
                </div>
                <div>
                  <Label>Colaborador ausente</Label>
                  <div>{getColaboradorNome(detailsAusente)}</div>
                </div>
                <div>
                  <Label>Colaborador cobrindo</Label>
                  <div>{getColaboradorNome(detailsCobrindo)}</div>
                </div>
                <div>
                  <Label>Local da falta</Label>
                  <div>
                    {selectedHoraExtra.local_hora_extra
                      ? costCenterMap.get(selectedHoraExtra.local_hora_extra)
                      : "-"}
                  </div>
                </div>
                <div>
                  <Label>Inicio</Label>
                  <div>{formatDateTime(selectedHoraExtra.inicio_em)}</div>
                </div>
                <div>
                  <Label>Fim</Label>
                  <div>{formatDateTime(selectedHoraExtra.fim_em)}</div>
                </div>
                <div>
                  <Label>Intervalo</Label>
                  <div>
                    {selectedHoraExtra.intervalo_inicio_em &&
                    selectedHoraExtra.intervalo_fim_em
                      ? `${formatDateTime(
                          selectedHoraExtra.intervalo_inicio_em,
                        )} - ${formatDateTime(
                          selectedHoraExtra.intervalo_fim_em,
                        )}`
                      : "-"}
                  </div>
                </div>
                <div className="md:col-span-2">
                  <Label>Observacao</Label>
                  <div>{selectedHoraExtra.observacao || "-"}</div>
                </div>
                <div>
                  <Label>Criado por</Label>
                  <div>
                    {selectedHoraExtra.criado_por
                      ? usuarioMap.get(selectedHoraExtra.criado_por) ||
                        selectedHoraExtra.criado_por
                      : "-"}
                  </div>
                </div>
                <div>
                  <Label>Criado em</Label>
                  <div>{formatDateTime(selectedHoraExtra.criado_em)}</div>
                </div>
                <div>
                  <Label>Confirmado por</Label>
                  <div>
                    {selectedHoraExtra.confirmado_por
                      ? usuarioMap.get(selectedHoraExtra.confirmado_por) ||
                        selectedHoraExtra.confirmado_por
                      : "-"}
                  </div>
                </div>
                <div>
                  <Label>Confirmado em</Label>
                  <div>
                    {selectedHoraExtra.confirmado_em
                      ? formatDateTime(selectedHoraExtra.confirmado_em)
                      : "-"}
                  </div>
                </div>
                <div>
                  <Label>Aprovado por</Label>
                  <div>
                    {selectedHoraExtra.aprovado_por
                      ? usuarioMap.get(selectedHoraExtra.aprovado_por) ||
                        selectedHoraExtra.aprovado_por
                      : "-"}
                  </div>
                </div>
                <div>
                  <Label>Aprovado em</Label>
                  <div>
                    {selectedHoraExtra.aprovado_em
                      ? formatDateTime(selectedHoraExtra.aprovado_em)
                      : "-"}
                  </div>
                </div>
                <div>
                  <Label>Reprovado por</Label>
                  <div>
                    {selectedHoraExtra.reprovado_por
                      ? usuarioMap.get(selectedHoraExtra.reprovado_por) ||
                        selectedHoraExtra.reprovado_por
                      : "-"}
                  </div>
                </div>
                <div>
                  <Label>Reprovado em</Label>
                  <div>
                    {selectedHoraExtra.reprovado_em
                      ? formatDateTime(selectedHoraExtra.reprovado_em)
                      : "-"}
                  </div>
                </div>
                <div>
                  <Label>Motivo reprovacao</Label>
                  <div>
                    {formatEnumLabel(selectedHoraExtra.motivo_reprovacao)}
                  </div>
                </div>
                <div>
                  <Label>Detalhe reprovacao</Label>
                  <div>{selectedHoraExtra.detalhe_reprovacao || "-"}</div>
                </div>
                <div>
                  <Label>Cancelado por</Label>
                  <div>
                    {selectedHoraExtra.cancelado_por
                      ? usuarioMap.get(selectedHoraExtra.cancelado_por) ||
                        selectedHoraExtra.cancelado_por
                      : "-"}
                  </div>
                </div>
                <div>
                  <Label>Cancelado em</Label>
                  <div>
                    {selectedHoraExtra.cancelado_em
                      ? formatDateTime(selectedHoraExtra.cancelado_em)
                      : "-"}
                  </div>
                </div>
                <div>
                  <Label>Motivo cancelamento</Label>
                  <div>
                    {formatEnumLabel(selectedHoraExtra.motivo_cancelamento)}
                  </div>
                </div>
                <div>
                  <Label>Detalhe cancelamento</Label>
                  <div>{selectedHoraExtra.detalhe_cancelamento || "-"}</div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog
          open={reasonDialog.open}
          onOpenChange={(open) =>
            setReasonDialog((prev) => ({ ...prev, open }))
          }
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {reasonDialog.type === "reprovar"
                  ? "Reprovar hora extra"
                  : "Cancelar hora extra"}
              </DialogTitle>
              <DialogDescription>
                Informe o motivo e detalhes se necessario.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Motivo</Label>
                <Select
                  value={reasonValue || "__none__"}
                  onValueChange={(value) =>
                    setReasonValue(value === "__none__" ? "" : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__" disabled>
                      Selecione
                    </SelectItem>
                    {(reasonDialog.type === "reprovar"
                      ? motivoReprovacaoOptions
                      : motivoCancelamentoOptions
                    ).map((motivo) => (
                      <SelectItem key={motivo} value={motivo}>
                        {formatEnumLabel(motivo)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Detalhe (opcional)</Label>
                <Textarea
                  value={reasonDetail}
                  onChange={(event) => setReasonDetail(event.target.value)}
                  placeholder="Descreva se necessario"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setReasonDialog({ open: false, type: null, horaExtra: null })
                }
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleReasonSubmit}
                disabled={!reasonValue || updatingId !== null}
              >
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Editar hora extra</DialogTitle>
              <DialogDescription>
                Ajuste os dados permitidos da hora extra.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1 md:col-span-2">
                <Label>Colaborador cobrindo</Label>
                <Select
                  value={editForm.colaboradorCobrindoId}
                  onValueChange={(value) =>
                    setEditForm((prev) => ({
                      ...prev,
                      colaboradorCobrindoId: value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o colaborador" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72 overflow-y-auto">
                    {colaboradoresConvenia
                      .filter((colaborador) => {
                        if (!selectedHoraExtra?.falta?.colaborador_convenia_id)
                          return true;
                        return (
                          colaborador.id !==
                          selectedHoraExtra.falta.colaborador_convenia_id
                        );
                      })
                      .map((colaborador) => (
                        <SelectItem key={colaborador.id} value={colaborador.id}>
                          {getColaboradorNome(colaborador)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label>Operacao</Label>
                <Input
                  value={editForm.operacao}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      operacao: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-1">
                <Label>Inicio</Label>
                <Input
                  type="datetime-local"
                  value={editForm.inicioEm}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      inicioEm: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Fim</Label>
                <Input
                  type="datetime-local"
                  value={editForm.fimEm}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      fimEm: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Inicio intervalo</Label>
                <Input
                  type="datetime-local"
                  value={editForm.intervaloInicioEm}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      intervaloInicioEm: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Fim intervalo</Label>
                <Input
                  type="datetime-local"
                  value={editForm.intervaloFimEm}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      intervaloFimEm: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Observacao</Label>
                <Textarea
                  value={editForm.observacao}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      observacao: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleEditSubmit}
                disabled={editingSaving}
              >
                {editingSaving ? "Salvando..." : "Salvar alteracoes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    );
  };
};

export const HoraExtraPendentesPage = createStatusPage(STATUS_CONFIGS[0]);
export const HoraExtraConfirmadasPage = createStatusPage(STATUS_CONFIGS[1]);
export const HoraExtraAprovadasPage = createStatusPage(STATUS_CONFIGS[2]);
export const HoraExtraReprovadasPage = createStatusPage(STATUS_CONFIGS[3]);
export const HoraExtraCanceladasPage = createStatusPage(STATUS_CONFIGS[4]);

