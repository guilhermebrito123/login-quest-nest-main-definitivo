import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import * as XLSX from "xlsx";
import { formatDate, formatDateTime } from "./diarias/utils";
import { useDiariasTemporariasData } from "./diarias/temporariasUtils";
import { FaltaJustificarDialog } from "@/components/faltas/FaltaJustificarDialog";
import { toast } from "sonner";

const BUCKET = "atestados";
const CLIENTE_FILTER_ALL = "__all__";
const COLABORADOR_FILTER_ALL = "__all__";
const ADVANCED_FILTER_ALL = "__all__";
const MOTIVO_FALTA_INJUSTIFICADA = "FALTA INJUSTIFICADA";
const MOTIVO_FALTA_JUSTIFICADA = "FALTA JUSTIFICADA";
const FALTAS_PAGE_SIZE = 10;
const FALTAS_CONVENIA_EXPORT_COLUMNS = [
  "colaborador_convenia_id",
  "data_falta",
  "motivo",
];

type AccessLevel = Database["public"]["Enums"]["internal_access_level"];

const FALTAS_COLABORADOR_JUSTIFICAR_LEVELS: AccessLevel[] = [
  "admin",
  "gestor_operacoes",
  "supervisor",
];

const FALTAS_CONVENIA_JUSTIFICAR_LEVELS: AccessLevel[] = [
  "admin",
  "gestor_operacoes",
  "supervisor",
  "assistente_operacoes",
];

const FALTAS_CONVENIA_REVERTER_LEVELS: AccessLevel[] = [
  "admin",
  "gestor_operacoes",
  "supervisor",
  "assistente_operacoes",
  "analista_centro_controle",
];


type FaltaTipo = "convenia";

type FaltaRow = {
  id: number;
  colaborador_id: string;
  diaria_temporaria_id: number;
  motivo: string;
  documento_url: string | null;
  justificada_em: string | null;
  justificada_por: string | null;
  created_at: string;
  updated_at: string;
  tipo: "colaborador";
};

type FaltaConveniaRow = {
  id: number;
  colaborador_convenia_id: string;
  diaria_temporaria_id: number;
  data_falta: string;
  motivo: string;
  atestado_path: string | null;
  justificada_em: string | null;
  justificada_por: string | null;
  created_at: string;
  updated_at: string;
  tipo: "convenia";
};

type FaltaData = FaltaRow | FaltaConveniaRow;
type FaltaRowDb = Omit<FaltaRow, "tipo">;
type FaltaConveniaRowDb = Omit<FaltaConveniaRow, "tipo">;

const getClienteInfoFromPosto = (postoInfo: any) => {
  const contrato = postoInfo?.unidade?.contrato;
  if (contrato?.cliente_id || contrato?.clientes?.nome_fantasia || contrato?.clientes?.razao_social) {
    return {
      id: contrato.cliente_id ?? "",
      nome: contrato.clientes?.nome_fantasia || contrato.clientes?.razao_social || "Cliente nao informado",
    };
  }
  return null;
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

const STATUS_FILTERS = [
  { value: "todos", label: "Todas" },
  { value: "pendente", label: "Pendentes" },
  { value: "justificada", label: "Justificadas" },
];

const FALTA_TYPE_OPTIONS: { value: FaltaTipo; label: string }[] = [
  { value: "convenia", label: "Convenia" },
];

const Faltas = () => {
  const [statusFilter, setStatusFilter] = useState("pendente");
  const [searchTerm, setSearchTerm] = useState("");
  const [clienteFilter, setClienteFilter] = useState(CLIENTE_FILTER_ALL);
  const [colaboradorFilter, setColaboradorFilter] = useState(COLABORADOR_FILTER_ALL);
  const [faltaType, setFaltaType] = useState<FaltaTipo>("convenia");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedFalta, setSelectedFalta] = useState<FaltaData | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [detailsFalta, setDetailsFalta] = useState<FaltaData | null>(null);
  const [dateRangeFilter, setDateRangeFilter] = useState({
    startDate: "",
    endDate: "",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [advancedDialogOpen, setAdvancedDialogOpen] = useState(false);
  const [advancedDateRange, setAdvancedDateRange] = useState({
    startDate: "",
    endDate: "",
  });
  const [advancedTotalRange, setAdvancedTotalRange] = useState({
    colaboradorId: "",
  });
  const [advancedInjustificadaRange, setAdvancedInjustificadaRange] = useState({
    colaboradorId: "",
  });
  const [advancedJustificadaRange, setAdvancedJustificadaRange] = useState({
    colaboradorId: "",
  });

  const [accessLevel, setAccessLevel] = useState<AccessLevel | null>(null);
  const [accessLoading, setAccessLoading] = useState(true);
  const [revertingId, setRevertingId] = useState<number | null>(null);

  useEffect(() => {
    const loadAccessLevel = async () => {
      try {
        const { data, error } = await supabase.rpc("current_internal_access_level");
        if (error) throw error;
        setAccessLevel(data ?? null);
      } catch (error) {
        console.error("Erro ao carregar nivel de acesso interno", error);
        setAccessLevel(null);
      } finally {
        setAccessLoading(false);
      }
    };
    loadAccessLevel();
  }, []);

  const {
    diarias,
    costCenters,
    colaboradoresConvenia,
    colaboradoresMap,
    colaboradoresConveniaMap,
    postoMap,
    clienteMap,
    refetchDiarias,
  } = useDiariasTemporariasData();

  const diariaMap = useMemo(() => {
    const map = new Map<string, any>();
    diarias.forEach((diaria) => {
      map.set(String(diaria.id), diaria);
    });
    return map;
  }, [diarias]);

  const {
    data: faltasColaboradoresRaw = [],
    isLoading: loadingFaltasColaboradores,
    refetch: refetchFaltasColaboradores,
  } = useQuery({
    queryKey: ["colaborador-faltas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaborador_faltas")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as FaltaRowDb[];
    },
  });

  const {
    data: faltasConveniaRaw = [],
    isLoading: loadingFaltasConvenia,
    refetch: refetchFaltasConvenia,
  } = useQuery({
    queryKey: ["faltas-convenia"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("faltas_colaboradores_convenia")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as FaltaConveniaRowDb[];
    },
  });

  const faltasColaboradores = useMemo(
    () =>
      faltasColaboradoresRaw.map((falta) => ({
        ...falta,
        tipo: "colaborador" as const,
      })),
    [faltasColaboradoresRaw],
  );

  const faltasConvenia = useMemo(
    () =>
      faltasConveniaRaw.map((falta) => ({
        ...falta,
        tipo: "convenia" as const,
      })),
    [faltasConveniaRaw],
  );

  const faltasAtivas = faltaType === "convenia" ? faltasConvenia : faltasColaboradores;
  const loadingFaltas = faltaType === "convenia" ? loadingFaltasConvenia : loadingFaltasColaboradores;

  const justificativaIds = useMemo(() => {
    const ids = new Set<string>();
    [...faltasColaboradores, ...faltasConvenia].forEach((item) => {
      if (item.justificada_por) ids.add(item.justificada_por);
    });
    return Array.from(ids);
  }, [faltasColaboradores, faltasConvenia]);

  const { data: usuarios = [] } = useQuery({
    queryKey: ["faltas-usuarios", justificativaIds],
    queryFn: async () => {
      if (justificativaIds.length === 0) return [];
      const { data, error } = await supabase
        .from("usuarios")
        .select("id, full_name, email")
        .in("id", justificativaIds);
      if (error) throw error;
      return data || [];
    },
    enabled: justificativaIds.length > 0,
  });

  const usuarioMap = useMemo(() => {
    const map = new Map<string, string>();
    usuarios.forEach((usuario: any) => {
      if (!usuario?.id) return;
      map.set(usuario.id, usuario.full_name || usuario.id);
    });
    return map;
  }, [usuarios]);

  const canJustifyFalta = (falta: FaltaData) => {
    if (!accessLevel) return false;
    const allowed =
      falta.tipo === "convenia"
        ? FALTAS_CONVENIA_JUSTIFICAR_LEVELS
        : FALTAS_COLABORADOR_JUSTIFICAR_LEVELS;
    return allowed.includes(accessLevel);
  };

  const canRevertFalta = (falta: FaltaData) => {
    if (!accessLevel) return false;
    if (falta.tipo !== "convenia") return false;
    return FALTAS_CONVENIA_REVERTER_LEVELS.includes(accessLevel);
  };

  const getFaltaColaboradorNome = (falta: FaltaData) => {
    if (falta.tipo === "colaborador") {
      return colaboradoresMap.get(falta.colaborador_id)?.nome_completo || falta.colaborador_id;
    }
    const convenia = colaboradoresConveniaMap.get(falta.colaborador_convenia_id);
    return getConveniaColaboradorNome(convenia) || falta.colaborador_convenia_id;
  };

  const getFaltaColaboradorId = (falta: FaltaData) =>
    falta.tipo === "colaborador" ? falta.colaborador_id : falta.colaborador_convenia_id;

  const getFaltaDocumentoPath = (falta: FaltaData) =>
    falta.tipo === "colaborador" ? falta.documento_url : falta.atestado_path;

  const pendingCount = useMemo(
    () => faltasAtivas.filter((falta) => !falta.justificada_em).length,
    [faltasAtivas],
  );
  const justifiedCount = useMemo(
    () => faltasAtivas.filter((falta) => !!falta.justificada_em).length,
    [faltasAtivas],
  );

  const advancedColaboradorOptions = useMemo(() => {
    const startDate = advancedDateRange.startDate
      ? new Date(`${advancedDateRange.startDate}T00:00:00`)
      : null;
    const endDate = advancedDateRange.endDate
      ? new Date(`${advancedDateRange.endDate}T23:59:59.999`)
      : null;
    const hasRange =
      startDate &&
      endDate &&
      !Number.isNaN(startDate.getTime()) &&
      !Number.isNaN(endDate.getTime()) &&
      startDate <= endDate;

    const idsInRange = new Set<string>();
    if (hasRange) {
      faltasConvenia.forEach((falta) => {
        if (!falta.data_falta) return;
        const faltaDate = new Date(`${falta.data_falta}T00:00:00`);
        if (Number.isNaN(faltaDate.getTime())) return;
        if (faltaDate < startDate || faltaDate > endDate) return;
        if (falta.colaborador_convenia_id) {
          idsInRange.add(falta.colaborador_convenia_id);
        }
      });
    }

    return colaboradoresConvenia
      .map((colaborador) => ({
        id: colaborador.id,
        label: getConveniaColaboradorNome(colaborador),
      }))
      .filter((item) => item.id)
      .filter((item) => (!hasRange ? true : idsInRange.has(item.id)))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [advancedDateRange, colaboradoresConvenia, faltasConvenia]);

  useEffect(() => {
    const validIds = new Set(advancedColaboradorOptions.map((item) => item.id));
    const normalize = (prev: { colaboradorId: string }) =>
      prev.colaboradorId && !validIds.has(prev.colaboradorId)
        ? { ...prev, colaboradorId: "" }
        : prev;

    setAdvancedTotalRange((prev) => normalize(prev));
    setAdvancedInjustificadaRange((prev) => normalize(prev));
    setAdvancedJustificadaRange((prev) => normalize(prev));
  }, [advancedColaboradorOptions]);

  const getFaltasConveniaByRange = (
    range: { colaboradorId: string; startDate: string; endDate: string },
    motivoFiltro?: string,
  ) => {
    if (!range.colaboradorId || !range.startDate || !range.endDate) return null;
    const start = new Date(range.startDate);
    const end = new Date(range.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    end.setHours(23, 59, 59, 999);
    if (start > end) return [];
    const motivoUpper = motivoFiltro?.toUpperCase() || null;

    return faltasConvenia.filter((falta) => {
      if (falta.colaborador_convenia_id !== range.colaboradorId) return false;
      if (!falta.data_falta) return false;
      const faltaDate = new Date(`${falta.data_falta}T00:00:00`);
      if (Number.isNaN(faltaDate.getTime())) return false;
      if (faltaDate < start || faltaDate > end) return false;
      if (motivoUpper) {
        const motivoAtual = (falta.motivo || "").toUpperCase();
        if (motivoAtual !== motivoUpper) return false;
      }
      return true;
    });
  };

  const computeFaltasCount = (
    range: { colaboradorId: string; startDate: string; endDate: string },
    motivoFiltro?: string,
  ) => {
    const faltas = getFaltasConveniaByRange(range, motivoFiltro);
    if (faltas === null) return null;
    return faltas.length;
  };

  const advancedTotalCount = useMemo(
    () =>
      computeFaltasCount({
        colaboradorId: advancedTotalRange.colaboradorId,
        ...advancedDateRange,
      }),
    [faltasConvenia, advancedTotalRange.colaboradorId, advancedDateRange],
  );
  const advancedInjustificadaCount = useMemo(
    () =>
      computeFaltasCount(
        {
          colaboradorId: advancedInjustificadaRange.colaboradorId,
          ...advancedDateRange,
        },
        MOTIVO_FALTA_INJUSTIFICADA,
      ),
    [
      faltasConvenia,
      advancedInjustificadaRange.colaboradorId,
      advancedDateRange,
    ],
  );
  const advancedJustificadaCount = useMemo(
    () =>
      computeFaltasCount(
        {
          colaboradorId: advancedJustificadaRange.colaboradorId,
          ...advancedDateRange,
        },
        MOTIVO_FALTA_JUSTIFICADA,
      ),
    [faltasConvenia, advancedJustificadaRange.colaboradorId, advancedDateRange],
  );

  const colaboradorFilterOptions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const startDate = dateRangeFilter.startDate
      ? new Date(`${dateRangeFilter.startDate}T00:00:00`)
      : null;
    const endDate = dateRangeFilter.endDate
      ? new Date(`${dateRangeFilter.endDate}T23:59:59.999`)
      : null;
    const hasInvalidRange =
      (startDate && Number.isNaN(startDate.getTime())) ||
      (endDate && Number.isNaN(endDate.getTime())) ||
      (startDate && endDate && startDate > endDate);
    if (hasInvalidRange) return [];

    const map = new Map<string, string>();
    faltasAtivas.forEach((falta) => {
      if (statusFilter === "pendente" && falta.justificada_em) return;
      if (statusFilter === "justificada" && !falta.justificada_em) return;

      if (clienteFilter !== CLIENTE_FILTER_ALL) {
        const diaria = diariaMap.get(String(falta.diaria_temporaria_id));
        const centroCustoId = diaria?.centro_custo_id;
        if (!centroCustoId || String(centroCustoId) !== clienteFilter) return;
      }

      if (startDate || endDate) {
        const diaria = diariaMap.get(String(falta.diaria_temporaria_id));
        const dataFalta =
          diaria?.data_diaria || (falta.tipo === "convenia" ? falta.data_falta : null);
        if (!dataFalta) return;
        const faltaDate = new Date(`${dataFalta}T00:00:00`);
        if (Number.isNaN(faltaDate.getTime())) return;
        if (startDate && faltaDate < startDate) return;
        if (endDate && faltaDate > endDate) return;
      }

      if (term) {
        const colaboradorNome = getFaltaColaboradorNome(falta).toLowerCase();
        const diariaId = String(falta.diaria_temporaria_id);
        if (!colaboradorNome.includes(term) && !diariaId.includes(term)) return;
      }

      const colaboradorId = getFaltaColaboradorId(falta);
      if (!colaboradorId) return;
      map.set(colaboradorId, getFaltaColaboradorNome(falta));
    });

    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [
    faltasAtivas,
    statusFilter,
    clienteFilter,
    dateRangeFilter,
    searchTerm,
    diariaMap,
    colaboradoresMap,
    colaboradoresConveniaMap,
  ]);

  const filteredFaltas = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const startDate = dateRangeFilter.startDate
      ? new Date(`${dateRangeFilter.startDate}T00:00:00`)
      : null;
    const endDate = dateRangeFilter.endDate
      ? new Date(`${dateRangeFilter.endDate}T23:59:59.999`)
      : null;
    const hasInvalidRange =
      (startDate && Number.isNaN(startDate.getTime())) ||
      (endDate && Number.isNaN(endDate.getTime())) ||
      (startDate && endDate && startDate > endDate);
    return faltasAtivas.filter((falta) => {
      if (statusFilter === "pendente" && falta.justificada_em) return false;
      if (statusFilter === "justificada" && !falta.justificada_em) return false;

      if (clienteFilter !== CLIENTE_FILTER_ALL) {
        const diaria = diariaMap.get(String(falta.diaria_temporaria_id));
        const centroCustoId = diaria?.centro_custo_id;
        if (!centroCustoId || String(centroCustoId) !== clienteFilter) return false;
      }

      if (startDate || endDate) {
        if (hasInvalidRange) return false;
        const diaria = diariaMap.get(String(falta.diaria_temporaria_id));
        const dataFalta =
          diaria?.data_diaria || (falta.tipo === "convenia" ? falta.data_falta : null);
        if (!dataFalta) return false;
        const faltaDate = new Date(`${dataFalta}T00:00:00`);
        if (Number.isNaN(faltaDate.getTime())) return false;
        if (startDate && faltaDate < startDate) return false;
        if (endDate && faltaDate > endDate) return false;
      }

      if (colaboradorFilter !== COLABORADOR_FILTER_ALL) {
        const colaboradorId = getFaltaColaboradorId(falta);
        if (!colaboradorId || colaboradorId !== colaboradorFilter) return false;
      }

      if (!term) return true;
      const colaboradorNome = getFaltaColaboradorNome(falta).toLowerCase();
      const diariaId = String(falta.diaria_temporaria_id);
      return colaboradorNome.includes(term) || diariaId.includes(term);
    });
  }, [
    faltasAtivas,
    searchTerm,
    statusFilter,
    clienteFilter,
    colaboradorFilter,
    dateRangeFilter,
    diariaMap,
    colaboradoresMap,
    colaboradoresConveniaMap,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredFaltas.length / FALTAS_PAGE_SIZE));
  const paginatedFaltas = useMemo(() => {
    const start = (currentPage - 1) * FALTAS_PAGE_SIZE;
    return filteredFaltas.slice(start, start + FALTAS_PAGE_SIZE);
  }, [filteredFaltas, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, clienteFilter, colaboradorFilter, dateRangeFilter, faltaType]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleClearFilters = () => {
    setSearchTerm("");
    setStatusFilter("pendente");
    setClienteFilter(CLIENTE_FILTER_ALL);
    setColaboradorFilter(COLABORADOR_FILTER_ALL);
    setDateRangeFilter({ startDate: "", endDate: "" });
    setCurrentPage(1);
  };

  const buildFaltasConveniaExportRows = (faltas: FaltaConveniaRow[]) =>
    faltas.map((falta) => ({
      colaborador_convenia_id:
        getConveniaColaboradorNome(
          colaboradoresConveniaMap.get(falta.colaborador_convenia_id),
        ) || falta.colaborador_convenia_id,
      data_falta: falta.data_falta,
      motivo: falta.motivo,
    }));

  const exportFaltasConveniaXlsx = (faltas: FaltaConveniaRow[], filePrefix: string) => {
    if (!faltas.length) {
      toast.info("Nenhuma falta para exportar.");
      return;
    }
    const sheet = XLSX.utils.json_to_sheet(buildFaltasConveniaExportRows(faltas), {
      header: FALTAS_CONVENIA_EXPORT_COLUMNS,
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Faltas");
    XLSX.writeFile(wb, `${filePrefix}-${Date.now()}.xlsx`);
    toast.success("Arquivo XLSX gerado.");
  };

  const handleExportFilteredFaltas = () => {
    const faltasParaExportar = filteredFaltas.filter(
      (falta): falta is FaltaConveniaRow => falta.tipo === "convenia",
    );
    exportFaltasConveniaXlsx(faltasParaExportar, "faltas-convenia");
  };

  const handleExportAdvancedRange = (
    range: { colaboradorId: string; startDate: string; endDate: string },
    motivoFiltro: string | undefined,
    fileSuffix: string,
  ) => {
    const faltas = getFaltasConveniaByRange(range, motivoFiltro);
    if (faltas === null) {
      toast.error("Preencha periodo e colaborador para exportar.");
      return;
    }
    exportFaltasConveniaXlsx(faltas, `faltas-convenia-${fileSuffix}`);
  };

  const handleViewDocumento = async (path: string) => {
    try {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 120);
      if (error || !data?.signedUrl) {
        throw error || new Error("Link temporario indisponivel.");
      }
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      toast.error(error?.message || "Nao foi possivel abrir o documento.");
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setSelectedFalta(null);
  };

  const openJustificarDialog = (falta: FaltaData) => {
    if (accessLoading) return;
    if (!canJustifyFalta(falta)) {
      toast.error("Sem permissao para justificar faltas.");
      return;
    }
    setSelectedFalta(falta);
    setDialogOpen(true);
  };

  const handleReverterJustificativa = async (falta: FaltaData) => {
    if (accessLoading) return;
    if (falta.tipo !== "convenia") {
      toast.error("Reversao disponivel apenas para faltas convenia.");
      return;
    }
    if (!falta.justificada_em) {
      toast.error("Falta nao esta justificada.");
      return;
    }
    if (!canRevertFalta(falta)) {
      toast.error("Sem permissao para reverter justificativas.");
      return;
    }
    const documentoPath = getFaltaDocumentoPath(falta);
    if (!documentoPath) {
      toast.error("Atestado nao encontrado.");
      return;
    }
    const confirmed = window.confirm(
      "Deseja reverter a justificativa desta falta? O atestado sera removido."
    );
    if (!confirmed) return;

    try {
      setRevertingId(falta.id);
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) {
        throw authError || new Error("Usuario nao autenticado.");
      }

      const { error: rpcError } = await supabase.rpc(
        "reverter_justificativa_falta_convenia",
        {
          p_falta_id: falta.id,
          p_user_id: authData.user.id,
          p_bucket_id: BUCKET,
        }
      );
      if (rpcError) throw rpcError;

      const { error: storageError } = await supabase.storage
        .from(BUCKET)
        .remove([documentoPath]);
      if (storageError) {
        toast.error(
          "Justificativa revertida, mas nao foi possivel remover o atestado."
        );
      } else {
        toast.success("Justificativa revertida com sucesso.");
      }

      await Promise.all([refetchFaltasConvenia(), refetchDiarias()]);

      const applyLocalUpdate = (prev: FaltaData | null) => {
        if (!prev || prev.id !== falta.id) return prev;
        if (prev.tipo === "convenia") {
          return {
            ...prev,
            motivo: MOTIVO_FALTA_INJUSTIFICADA,
            justificada_em: null,
            justificada_por: null,
            atestado_path: null,
          };
        }
        return {
          ...prev,
          motivo: MOTIVO_FALTA_INJUSTIFICADA,
          justificada_em: null,
          justificada_por: null,
          documento_url: null,
        };
      };
      setSelectedFalta(applyLocalUpdate);
      setDetailsFalta(applyLocalUpdate);
    } catch (error: any) {
      toast.error(error?.message || "Nao foi possivel reverter a justificativa.");
    } finally {
      setRevertingId(null);
    }
  };

  const handleDetailsDialogOpenChange = (open: boolean) => {
    setDetailsDialogOpen(open);
    if (!open) setDetailsFalta(null);
  };

  const openDetailsDialog = (falta: FaltaData) => {
    setDetailsFalta(falta);
    setDetailsDialogOpen(true);
  };

  const selectedColaboradorId = selectedFalta ? getFaltaColaboradorId(selectedFalta) : null;
  const selectedColaboradorNome = selectedFalta ? getFaltaColaboradorNome(selectedFalta) : null;
  const selectedRpcName =
    selectedFalta?.tipo === "convenia"
      ? "justificar_falta_convenia"
      : "justificar_falta_diaria_temporaria";

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-muted-foreground uppercase tracking-wide">Diarias</p>
            <h1 className="text-3xl font-bold">Faltas</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie faltas de colaboradores e convenia com envio de documentos.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4 md:grid md:grid-cols-3">
          <Card className="shadow-lg">
            <CardHeader className="pb-2">
              <CardDescription>Total de faltas</CardDescription>
              <CardTitle className="text-2xl">{faltasAtivas.length}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Registradas via diarias temporarias.
            </CardContent>
          </Card>
          <Card className="shadow-lg border border-amber-200">
            <CardHeader className="pb-2">
              <CardDescription>Pendentes</CardDescription>
              <CardTitle className="text-2xl">{pendingCount}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Aguardando justificativa.
            </CardContent>
          </Card>
          <Card className="shadow-lg border border-emerald-200">
            <CardHeader className="pb-2">
              <CardDescription>Justificadas</CardDescription>
              <CardTitle className="text-2xl">{justifiedCount}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Com atestado anexado.
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Filtros</CardTitle>
              <CardDescription>Busque faltas por colaborador ou ID da diaria.</CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={handleClearFilters}>
                Limpar filtros
              </Button>
              <Button type="button" variant="outline" onClick={handleExportFilteredFaltas}>
                Exportar XLSX
              </Button>
              <Button type="button" variant="outline" onClick={() => setAdvancedDialogOpen(true)}>
                Filtragem avancada
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 md:grid md:grid-cols-6">
            <div className="space-y-2 md:col-span-2">
              <span className="text-sm text-muted-foreground">Busca</span>
              <Input
                value={searchTerm}
                placeholder="Nome ou ID da diaria"
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <span className="text-sm text-muted-foreground">Tipo</span>
              <Select value={faltaType} onValueChange={(value) => setFaltaType(value as FaltaTipo)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {FALTA_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <span className="text-sm text-muted-foreground">Status</span>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTERS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <span className="text-sm text-muted-foreground">Colaborador</span>
              <Select value={colaboradorFilter} onValueChange={setColaboradorFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={COLABORADOR_FILTER_ALL}>Todos</SelectItem>
                  {colaboradorFilterOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <span className="text-sm text-muted-foreground">Cliente</span>
              <Select value={clienteFilter} onValueChange={setClienteFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CLIENTE_FILTER_ALL}>Todos</SelectItem>
                  {costCenters.map((center) => (
                    <SelectItem key={center.id} value={center.id}>
                      {center.name || center.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <span className="text-sm text-muted-foreground">Data inicial</span>
              <Input
                type="date"
                value={dateRangeFilter.startDate}
                onChange={(event) =>
                  setDateRangeFilter((prev) => ({
                    ...prev,
                    startDate: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <span className="text-sm text-muted-foreground">Data final</span>
              <Input
                type="date"
                value={dateRangeFilter.endDate}
                onChange={(event) =>
                  setDateRangeFilter((prev) => ({
                    ...prev,
                    endDate: event.target.value,
                  }))
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Faltas registradas</CardTitle>
            <CardDescription>Selecione uma falta para justificar com anexo.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingFaltas ? (
              <p className="text-sm text-muted-foreground">Carregando faltas...</p>
            ) : filteredFaltas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma falta encontrada.</p>
            ) : (
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Colaborador</TableHead>
                      <TableHead className="hidden sm:table-cell">Cliente</TableHead>
                      <TableHead className="hidden sm:table-cell">Motivo</TableHead>
                      <TableHead className="hidden sm:table-cell">Status</TableHead>
                      <TableHead className="hidden sm:table-cell">Justificada em</TableHead>
                      <TableHead className="hidden sm:table-cell">Documento</TableHead>
                      <TableHead className="text-right">Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedFaltas.map((falta) => {
                      const diaria = diariaMap.get(String(falta.diaria_temporaria_id));
                      const colaborador =
                        falta.tipo === "colaborador"
                          ? colaboradoresMap.get(falta.colaborador_id)
                          : null;
                      const postoInfo =
                        diaria?.posto_servico_id
                          ? postoMap.get(diaria.posto_servico_id)
                          : colaborador?.posto || null;
                      const clienteNome =
                        (typeof diaria?.cliente_id === "number" &&
                          clienteMap.get(diaria.cliente_id)) ||
                        getClienteInfoFromPosto(postoInfo)?.nome ||
                        "-";
                      const statusLabel = falta.justificada_em ? "Justificada" : "Pendente";
                      const statusVariant: "default" | "destructive" =
                        falta.justificada_em ? "default" : "destructive";
                      const justificadaPorNome = falta.justificada_por
                        ? usuarioMap.get(falta.justificada_por) || falta.justificada_por
                        : "-";
                      const colaboradorNome = getFaltaColaboradorNome(falta);
                      const documentoPath = getFaltaDocumentoPath(falta);
                      const isJustificada = !!falta.justificada_em;
                      const canJustify = canJustifyFalta(falta);
                      const canRevert = isJustificada && canRevertFalta(falta);
                      const isReverting = revertingId === falta.id;
                      const actionLabel = isJustificada
                        ? canRevert
                          ? "Reverter"
                          : "Justificada"
                        : "Justificar";
                      const actionDisabled = accessLoading || isReverting || (
                        isJustificada ? !canRevert : !canJustify
                      );
                      return (
                        <TableRow
                          key={falta.id}
                          className="cursor-pointer"
                          onClick={() => openDetailsDialog(falta)}
                        >
                          <TableCell>{formatDate(diaria?.data_diaria)}</TableCell>
                          <TableCell>{colaboradorNome}</TableCell>
                          <TableCell className="hidden sm:table-cell">{clienteNome}</TableCell>
                          <TableCell className="hidden sm:table-cell">{falta.motivo || "-"}</TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <Badge variant={statusVariant}>{statusLabel}</Badge>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {falta.justificada_em ? (
                              <div className="text-xs">
                                <div>{formatDateTime(falta.justificada_em)}</div>
                                <div className="text-muted-foreground">{justificadaPorNome}</div>
                              </div>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {documentoPath ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleViewDocumento(documentoPath as string);
                                }}
                              >
                                Ver
                              </Button>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              size="sm"
                              disabled={actionDisabled}
                              onClick={(event) => {
                                event.stopPropagation();
                                if (isJustificada) {
                                  if (canRevert) {
                                    handleReverterJustificativa(falta);
                                  }
                                  return;
                                }
                                openJustificarDialog(falta);
                              }}
                            >
                              {isReverting ? "Revertendo..." : actionLabel}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <div className="flex flex-col items-start justify-between gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center">
                  <span>
                    Pagina {currentPage} de {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    >
                      Anterior
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    >
                      Proxima
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <FaltaJustificarDialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        diariaId={selectedFalta?.diaria_temporaria_id ?? null}
        colaboradorId={selectedColaboradorId}
        colaboradorNome={selectedColaboradorNome}
        dataDiariaLabel={
          selectedFalta
            ? formatDate(diariaMap.get(String(selectedFalta.diaria_temporaria_id))?.data_diaria)
            : null
        }
        rpcName={selectedRpcName}
        onSuccess={async () => {
          await Promise.all([
            refetchFaltasColaboradores(),
            refetchFaltasConvenia(),
            refetchDiarias(),
          ]);
        }}
      />
      <Dialog open={detailsDialogOpen} onOpenChange={handleDetailsDialogOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da falta</DialogTitle>
            <DialogDescription>Informacoes completas da falta selecionada.</DialogDescription>
          </DialogHeader>
          {detailsFalta ? (() => {
            const diaria = diariaMap.get(String(detailsFalta.diaria_temporaria_id));
            const colaborador =
              detailsFalta.tipo === "colaborador"
                ? colaboradoresMap.get(detailsFalta.colaborador_id)
                : null;
            const postoInfo =
              diaria?.posto_servico_id
                ? postoMap.get(diaria.posto_servico_id)
                : colaborador?.posto || null;
            const clienteNome =
              (typeof diaria?.cliente_id === "number" && clienteMap.get(diaria.cliente_id)) ||
              getClienteInfoFromPosto(postoInfo)?.nome ||
              "-";
            const statusLabel = detailsFalta.justificada_em ? "Justificada" : "Pendente";
            const statusVariant: "default" | "destructive" =
              detailsFalta.justificada_em ? "default" : "destructive";
            const justificadaPorNome = detailsFalta.justificada_por
              ? usuarioMap.get(detailsFalta.justificada_por) || detailsFalta.justificada_por
              : "-";
            const colaboradorNome = getFaltaColaboradorNome(detailsFalta);
            const documentoPath = getFaltaDocumentoPath(detailsFalta);

            return (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Data</p>
                    <p className="text-sm font-medium">{formatDate(diaria?.data_diaria)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Colaborador</p>
                    <p className="text-sm font-medium">{colaboradorNome}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Cliente</p>
                    <p className="text-sm font-medium">{clienteNome}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Motivo</p>
                    <p className="text-sm font-medium">{detailsFalta.motivo || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <Badge variant={statusVariant}>{statusLabel}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Justificada em</p>
                    <p className="text-sm font-medium">
                      {detailsFalta.justificada_em ? formatDateTime(detailsFalta.justificada_em) : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Justificada por</p>
                    <p className="text-sm font-medium">{justificadaPorNome}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Documento</p>
                    {documentoPath ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewDocumento(documentoPath as string)}
                      >
                        Ver documento
                      </Button>
                    ) : (
                      <p className="text-sm font-medium">-</p>
                    )}
                  </div>
                </div>
                <DialogFooter className="sm:justify-start">
                  {!detailsFalta.justificada_em && (
                    <Button
                      type="button"
                      size="sm"
                      disabled={accessLoading || !canJustifyFalta(detailsFalta)}
                      onClick={() => {
                        handleDetailsDialogOpenChange(false);
                        openJustificarDialog(detailsFalta);
                      }}
                    >
                      Justificar
                    </Button>
                  )}
                  {detailsFalta.justificada_em &&
                    canRevertFalta(detailsFalta) && (
                      <Button
                        type="button"
                        size="sm"
                        disabled={accessLoading || revertingId === detailsFalta.id}
                        onClick={() => handleReverterJustificativa(detailsFalta)}
                      >
                        {revertingId === detailsFalta.id
                          ? "Revertendo..."
                          : "Reverter justificativa"}
                      </Button>
                    )}
                </DialogFooter>
              </div>
            );
          })() : null}
        </DialogContent>
      </Dialog>
      <Dialog open={advancedDialogOpen} onOpenChange={setAdvancedDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Filtragem avancada</DialogTitle>
            <DialogDescription>
              Selecione o periodo (data da falta) e consulte quantidades por colaborador.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2 rounded-md border bg-muted/30 p-4">
              <p className="text-sm font-semibold text-muted-foreground">Periodo das faltas</p>
              <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2">
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">Data inicial</span>
                  <Input
                    type="date"
                    value={advancedDateRange.startDate}
                    onChange={(event) =>
                      setAdvancedDateRange((prev) => ({
                        ...prev,
                        startDate: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">Data final</span>
                  <Input
                    type="date"
                    value={advancedDateRange.endDate}
                    onChange={(event) =>
                      setAdvancedDateRange((prev) => ({
                        ...prev,
                        endDate: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2 rounded-md border bg-muted/30 p-4">
              <p className="text-sm font-semibold text-muted-foreground">
                Quantidade de faltas (justificadas + injustificadas)
              </p>
              <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-1">
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">Colaborador</span>
                  <Select
                    value={advancedTotalRange.colaboradorId || ADVANCED_FILTER_ALL}
                    onValueChange={(value) =>
                      setAdvancedTotalRange((prev) => ({
                        ...prev,
                        colaboradorId: value === ADVANCED_FILTER_ALL ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o colaborador" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ADVANCED_FILTER_ALL}>Selecione o colaborador</SelectItem>
                      {advancedColaboradorOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="rounded-md border bg-background/80 p-3">
                <p className="text-sm text-muted-foreground">
                  Quantidade no periodo selecionado
                </p>
                <p className="text-2xl font-semibold">
                  {advancedTotalCount !== null ? advancedTotalCount : "--"}
                </p>
                <div className="mt-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      handleExportAdvancedRange(
                        {
                          colaboradorId: advancedTotalRange.colaboradorId,
                          ...advancedDateRange,
                        },
                        undefined,
                        "total",
                      )
                    }
                  >
                    Exportar XLSX
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2 rounded-md border bg-muted/30 p-4">
              <p className="text-sm font-semibold text-muted-foreground">
                Quantidade de faltas - {MOTIVO_FALTA_INJUSTIFICADA}
              </p>
              <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-1">
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">Colaborador</span>
                  <Select
                    value={advancedInjustificadaRange.colaboradorId || ADVANCED_FILTER_ALL}
                    onValueChange={(value) =>
                      setAdvancedInjustificadaRange((prev) => ({
                        ...prev,
                        colaboradorId: value === ADVANCED_FILTER_ALL ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o colaborador" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ADVANCED_FILTER_ALL}>Selecione o colaborador</SelectItem>
                      {advancedColaboradorOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="rounded-md border bg-background/80 p-3">
                <p className="text-sm text-muted-foreground">
                  Quantidade no periodo selecionado
                </p>
                <p className="text-2xl font-semibold">
                  {advancedInjustificadaCount !== null ? advancedInjustificadaCount : "--"}
                </p>
                <div className="mt-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      handleExportAdvancedRange(
                        {
                          colaboradorId: advancedInjustificadaRange.colaboradorId,
                          ...advancedDateRange,
                        },
                        MOTIVO_FALTA_INJUSTIFICADA,
                        "injustificadas",
                      )
                    }
                  >
                    Exportar XLSX
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2 rounded-md border bg-muted/30 p-4">
              <p className="text-sm font-semibold text-muted-foreground">
                Quantidade de faltas - {MOTIVO_FALTA_JUSTIFICADA}
              </p>
              <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-1">
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">Colaborador</span>
                  <Select
                    value={advancedJustificadaRange.colaboradorId || ADVANCED_FILTER_ALL}
                    onValueChange={(value) =>
                      setAdvancedJustificadaRange((prev) => ({
                        ...prev,
                        colaboradorId: value === ADVANCED_FILTER_ALL ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o colaborador" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ADVANCED_FILTER_ALL}>Selecione o colaborador</SelectItem>
                      {advancedColaboradorOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="rounded-md border bg-background/80 p-3">
                <p className="text-sm text-muted-foreground">
                  Quantidade no periodo selecionado
                </p>
                <p className="text-2xl font-semibold">
                  {advancedJustificadaCount !== null ? advancedJustificadaCount : "--"}
                </p>
                <div className="mt-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      handleExportAdvancedRange(
                        {
                          colaboradorId: advancedJustificadaRange.colaboradorId,
                          ...advancedDateRange,
                        },
                        MOTIVO_FALTA_JUSTIFICADA,
                        "justificadas",
                      )
                    }
                  >
                    Exportar XLSX
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setAdvancedDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Faltas;
