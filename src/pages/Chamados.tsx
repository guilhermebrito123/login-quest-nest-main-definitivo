import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, MessageSquare, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";

import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAccessContext } from "@/hooks/useAccessContext";
import {
  CHAMADO_PRIORIDADE_LABELS,
  CHAMADO_PRIORIDADE_OPTIONS,
  CHAMADO_STATUS_LABELS,
  CHAMADO_STATUS_OPTIONS,
  canManageCategoriasByAccess,
  formatChamadoNumero,
  formatDateTime,
  getChamadoPrioridadeClass,
  getChamadoStatusClass,
  matchesChamadoNumeroFilter,
  normalizeChamadoNumeroFilter,
} from "@/lib/chamados";
import { ChamadoDetails } from "@/components/chamados/ChamadoDetails";
import { ChamadosDashboard } from "@/components/chamados/ChamadosDashboard";
import {
  ChamadoForm,
  type ChamadoCostCenterOption,
  type ChamadoLocalOption,
} from "@/components/chamados/ChamadoForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ChamadoRow = Tables<"chamados">;
type CategoriaRow = Tables<"chamado_categorias">;
type CostCenterRow = Tables<"cost_center">;
type UsuarioRow = Tables<"usuarios">;
type UsuarioPublicoRow = Tables<"usuarios_public">;
type LocalRow = Tables<"cost_center_locais">;
type ChamadoResponsavelOption = {
  id: string;
  full_name: string | null;
  cargo: string | null;
};

type ChamadoListItem = ChamadoRow & {
  categoria?: Pick<CategoriaRow, "id" | "nome" | "ativo"> | null;
  solicitante?: Pick<UsuarioRow, "id" | "full_name" | "email" | "role"> | null;
  responsavel?: Pick<UsuarioRow, "id" | "full_name" | "email" | "role"> | null;
};

type CategoriaDraft = {
  nome: string;
  descricao: string;
  ativo: boolean;
};

type MultiSelectOption = {
  value: string;
  label: string;
  hint?: string | null;
};

const EMPTY_CATEGORIA_DRAFT: CategoriaDraft = {
  nome: "",
  descricao: "",
  ativo: true,
};

const buildCategoriaDraft = (categoria?: CategoriaRow | null): CategoriaDraft =>
  categoria
    ? {
        nome: categoria.nome,
        descricao: categoria.descricao ?? "",
        ativo: categoria.ativo,
      }
    : EMPTY_CATEGORIA_DRAFT;

function toggleMultiValue<T extends string>(values: T[], value: T) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function getMultiSelectSummary(
  values: string[],
  options: MultiSelectOption[],
  emptyLabel: string
) {
  if (!values.length) return emptyLabel;

  const selectedLabels = options
    .filter((option) => values.includes(option.value))
    .map((option) => option.label);

  if (!selectedLabels.length) return emptyLabel;
  if (selectedLabels.length <= 2) return selectedLabels.join(", ");
  return `${selectedLabels.length} selecionados`;
}

async function filterCostCentersByInternalScope(
  userId: string,
  costCenters: CostCenterRow[]
) {
  const scopedCenters = await Promise.all(
    costCenters.map(async (center) => {
      const { data, error } = await supabase.rpc("internal_user_has_cost_center_access", {
        p_user_id: userId,
        p_cost_center_id: center.id,
      });

      if (error) throw error;
      return data ? center : null;
    })
  );

  return scopedCenters.filter((center): center is CostCenterRow => center !== null);
}

function MultiSelectFilter({
  title,
  emptyLabel,
  options,
  values,
  onChange,
}: {
  title: string;
  emptyLabel: string;
  options: MultiSelectOption[];
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const summary = getMultiSelectSummary(values, options, emptyLabel);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="min-w-0 w-full justify-between font-normal">
          <span className="truncate">{summary}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[calc(100vw-2rem)] max-w-[320px] p-0">
        <div className="border-b p-3">
          <div className="text-sm font-medium">{title}</div>
          <div className="mt-2 flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => onChange(options.map((option) => option.value))}
            >
              Selecionar todos
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => onChange([])}
            >
              Limpar
            </Button>
          </div>
        </div>
        <div className="max-h-72 space-y-1 overflow-auto p-2">
          {options.length > 0 ? (
            options.map((option) => {
              const checked = values.includes(option.value);

              return (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => onChange(toggleMultiValue(values, option.value))}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{option.label}</span>
                    {option.hint ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {option.hint}
                      </span>
                    ) : null}
                  </span>
                </label>
              );
            })
          ) : (
            <div className="px-2 py-4 text-sm text-muted-foreground">
              Nenhuma opção disponível.
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function Chamados() {
  const queryClient = useQueryClient();
  const { accessContext, accessLoading } = useAccessContext();
  const shouldReduceMotion = useReducedMotion();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [numeroFilter, setNumeroFilter] = useState("");
  const [statusFilters, setStatusFilters] = useState<ChamadoRow["status"][]>([]);
  const [prioridadeFilters, setPrioridadeFilters] = useState<ChamadoRow["prioridade"][]>([]);
  const [categoriaFilters, setCategoriaFilters] = useState<string[]>([]);
  const [localFilters, setLocalFilters] = useState<string[]>([]);
  const [costCenterFilter, setCostCenterFilter] = useState("all");
  const [responsavelFilter, setResponsavelFilter] = useState("all");
  const [solicitanteFilter, setSolicitanteFilter] = useState("all");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editingChamado, setEditingChamado] = useState<ChamadoRow | null>(null);
  const [selectedChamadoId, setSelectedChamadoId] = useState<string | null>(null);
  const [categoriaDialogOpen, setCategoriaDialogOpen] = useState(false);
  const [editingCategoria, setEditingCategoria] = useState<CategoriaRow | null>(null);
  const [categoriaDraft, setCategoriaDraft] = useState<CategoriaDraft>(EMPTY_CATEGORIA_DRAFT);
  const [savingCategoria, setSavingCategoria] = useState(false);
  const [deletingCategoriaId, setDeletingCategoriaId] = useState<string | null>(null);

  const canReadChamados = accessContext.canReadChamados;
  const canCreateChamados = accessContext.canCreateChamados;
  const canManageCategorias = canManageCategoriasByAccess(accessContext.accessLevel);
  const isColaborador = accessContext.role === "colaborador";
  const isInternalAboveClienteView =
    accessContext.role === "perfil_interno" &&
    !!accessContext.accessLevel &&
    accessContext.accessLevel !== "cliente_view";
  const isInternalScopedByCostCenter =
    isInternalAboveClienteView && !accessContext.isAdmin;
  const showCostCenterFilter = isInternalAboveClienteView;
  const isRestrictedToOwnChamados =
    isColaborador || accessContext.accessLevel === "cliente_view";
  const canReadScopedData =
    accessContext.isAdmin ||
    isColaborador ||
    (isInternalAboveClienteView && !!accessContext.userId);
  const canEditChamado = (chamado: ChamadoRow) =>
    accessContext.canManageChamados ||
    (isColaborador && accessContext.userId === chamado.solicitante_id);
  const canDeleteChamado = (chamado: Pick<ChamadoRow, "solicitante_id">) =>
    (!!accessContext.accessLevel && accessContext.accessLevel !== "cliente_view") ||
    (isColaborador && accessContext.userId === chamado.solicitante_id);

  const { data: categorias = [], refetch: refetchCategorias } = useQuery({
    queryKey: ["chamado-categorias-module"],
    queryFn: async () => {
      const { data, error } = await supabase.from("chamado_categorias").select("*").order("nome");
      if (error) throw error;
      return (data || []) as CategoriaRow[];
    },
  });

  const { data: costCenters = [] } = useQuery({
    queryKey: [
      "cost-centers-module",
      "chamados",
      accessContext.userId,
      accessContext.role,
      accessContext.accessLevel,
      accessContext.colaboradorCostCenterId,
    ],
    enabled: !accessLoading && canReadScopedData,
    queryFn: async () => {
      if (isColaborador && accessContext.colaboradorCostCenterId) {
        const { data, error } = await supabase
          .from("cost_center")
          .select("id, name, convenia_id, created_at, updated_at")
          .eq("id", accessContext.colaboradorCostCenterId)
          .order("name");

        if (error) throw error;
        return (data || []) as CostCenterRow[];
      }

      const { data, error } = await supabase
        .from("cost_center")
        .select("id, name, convenia_id, created_at, updated_at")
        .order("name");
      if (error) throw error;

      const loadedCostCenters = (data || []) as CostCenterRow[];
      if (accessContext.isAdmin) return loadedCostCenters;
      if (!isInternalScopedByCostCenter || !accessContext.userId) return [];

      return filterCostCentersByInternalScope(accessContext.userId, loadedCostCenters);
    },
  });

  const scopedCostCenterIds = useMemo(
    () => costCenters.map((center) => center.id),
    [costCenters]
  );

  const { data: locais = [] } = useQuery({
    queryKey: [
      "chamado-locais-module",
      accessContext.userId,
      accessContext.role,
      accessContext.accessLevel,
      scopedCostCenterIds.join(","),
    ],
    enabled: !accessLoading && canReadScopedData,
    queryFn: async () => {
      let query = supabase.from("cost_center_locais").select("*").order("nome");

      if (!accessContext.isAdmin) {
        if (scopedCostCenterIds.length === 0) return [] as LocalRow[];
        query = query.in("cost_center_id", scopedCostCenterIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as LocalRow[];
    },
  });

  const canCreateChamadosResolved =
    canCreateChamados &&
    (accessContext.isAdmin || isColaborador || costCenters.length > 0);

  const { data: responsaveis = [], isLoading: responsaveisLoading } = useQuery({
    queryKey: ["chamado-responsaveis-module", accessContext.userId],
    enabled: !accessLoading && !!accessContext.userId && canReadChamados,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("usuarios_public")
        .select("id, full_name, cargo")
        .order("full_name");
      if (error) throw error;

      return ((data || []) as UsuarioPublicoRow[])
        .filter((user): user is UsuarioPublicoRow & { id: string } => !!user.id)
        .map((user) => ({
          id: user.id,
          full_name: user.full_name,
          cargo: user.cargo,
        }));
    },
  });

  const costCenterMap = useMemo(
    () => new Map(costCenters.map((center) => [center.id, { name: center.name, convenia_id: center.convenia_id }])),
    [costCenters]
  );

  const localOptions = useMemo<ChamadoLocalOption[]>(
    () =>
      locais.map((local) => ({
        ...local,
        cost_center_name: costCenterMap.get(local.cost_center_id)?.name ?? null,
        convenia_id: costCenterMap.get(local.cost_center_id)?.convenia_id ?? null,
      })),
    [locais, costCenterMap]
  );

  const costCenterOptions = useMemo<ChamadoCostCenterOption[]>(
    () =>
      costCenters.map((center) => ({
        id: center.id,
        name: center.name,
        convenia_id: center.convenia_id,
      })),
    [costCenters]
  );

  const localLookup = useMemo(() => new Map(localOptions.map((local) => [local.id, local])), [localOptions]);

  const localIdsByCostCenter = useMemo(() => {
    if (costCenterFilter === "all") return null;
    return localOptions.filter((local) => local.cost_center_id === costCenterFilter).map((local) => local.id);
  }, [costCenterFilter, localOptions]);

  const categoriaFilterOptions = useMemo<MultiSelectOption[]>(
    () => categorias.map((categoria) => ({ value: categoria.id, label: categoria.nome })),
    [categorias]
  );
  const statusFilterOptions = useMemo<MultiSelectOption[]>(
    () =>
      CHAMADO_STATUS_OPTIONS.map((status) => ({
        value: status,
        label: CHAMADO_STATUS_LABELS[status],
      })),
    []
  );
  const prioridadeFilterOptions = useMemo<MultiSelectOption[]>(
    () =>
      CHAMADO_PRIORIDADE_OPTIONS.map((prioridade) => ({
        value: prioridade,
        label: CHAMADO_PRIORIDADE_LABELS[prioridade],
      })),
    []
  );
  const localFilterOptions = useMemo<MultiSelectOption[]>(
    () =>
      localOptions.map((local) => ({
        value: local.id,
        label: local.nome,
        hint: showCostCenterFilter ? local.cost_center_name ?? null : null,
      })),
    [localOptions, showCostCenterFilter]
  );
  const statusFilterKey = useMemo(() => [...statusFilters].sort().join(","), [statusFilters]);
  const prioridadeFilterKey = useMemo(
    () => [...prioridadeFilters].sort().join(","),
    [prioridadeFilters]
  );
  const categoriaFilterKey = useMemo(
    () => [...categoriaFilters].sort().join(","),
    [categoriaFilters]
  );
  const localFilterKey = useMemo(() => [...localFilters].sort().join(","), [localFilters]);
  const numeroFilterKey = useMemo(
    () => normalizeChamadoNumeroFilter(numeroFilter),
    [numeroFilter]
  );

  const { data: chamados = [], refetch: refetchChamados, isFetching } = useQuery({
    queryKey: [
      "chamados-module",
      accessContext.userId,
      canReadChamados,
      statusFilterKey,
      prioridadeFilterKey,
      categoriaFilterKey,
      localFilterKey,
      responsavelFilter,
      solicitanteFilter,
      createdFrom,
      createdTo,
      costCenterFilter,
      numeroFilterKey,
      localIdsByCostCenter?.join(",") ?? "all",
    ],
    enabled: !!accessContext.userId && canReadChamados,
    queryFn: async () => {
      if (localIdsByCostCenter && localIdsByCostCenter.length === 0) return [] as ChamadoListItem[];

      let query = supabase
        .from("chamados")
        .select(`
          *,
          categoria:chamado_categorias(id, nome, ativo),
          solicitante:usuarios!chamados_solicitante_id_fkey(id, full_name, email, role),
          responsavel:usuarios!chamados_responsavel_id_fkey(id, full_name, email, role)
        `)
        .order("created_at", { ascending: false });

      if (isRestrictedToOwnChamados) query = query.eq("solicitante_id", accessContext.userId);
      if (statusFilters.length > 0) query = query.in("status", statusFilters);
      if (prioridadeFilters.length > 0) query = query.in("prioridade", prioridadeFilters);
      if (categoriaFilters.length > 0) query = query.in("categoria_id", categoriaFilters);
      if (localFilters.length > 0) query = query.in("local_id", localFilters);
      if (!isRestrictedToOwnChamados && responsavelFilter !== "all") query = query.eq("responsavel_id", responsavelFilter);
      if (!isRestrictedToOwnChamados && solicitanteFilter !== "all") query = query.eq("solicitante_id", solicitanteFilter);
      if (createdFrom) query = query.gte("created_at", `${createdFrom}T00:00:00`);
      if (createdTo) query = query.lte("created_at", `${createdTo}T23:59:59`);
      if (numeroFilterKey) query = query.eq("numero", Number(numeroFilterKey));
      if (localIdsByCostCenter && localIdsByCostCenter.length > 0) query = query.in("local_id", localIdsByCostCenter);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ChamadoListItem[];
    },
  });
  const responsavelMap = useMemo(
    () => new Map(responsaveis.map((user) => [user.id, user])),
    [responsaveis]
  );
  const getResponsavelDisplay = (
    chamado: Pick<ChamadoRow, "responsavel_id"> & {
      responsavel?: Pick<UsuarioRow, "full_name" | "email"> | null;
    }
  ) => {
    if (chamado.responsavel?.full_name) return chamado.responsavel.full_name;
    if (chamado.responsavel?.email) return chamado.responsavel.email;

    const responsavel = chamado.responsavel_id ? responsavelMap.get(chamado.responsavel_id) : null;
    if (responsavel?.full_name) return responsavel.full_name;
    if (chamado.responsavel_id && responsaveisLoading) {
      return "Carregando...";
    }
    if (responsavel?.cargo) return responsavel.cargo;
    if (chamado.responsavel_id) return "Responsável não encontrado";
    return "-";
  };

  const filteredChamados = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return chamados.filter((chamado) => {
      if (!matchesChamadoNumeroFilter(chamado.numero, numeroFilter)) return false;
      if (!term) return true;

      const local = localLookup.get(chamado.local_id);
      const haystack = [
        chamado.titulo,
        chamado.descricao,
        String(chamado.numero),
        chamado.categoria?.nome,
        local?.nome,
        local?.cost_center_name,
        chamado.solicitante?.full_name,
        chamado.solicitante?.email,
        getResponsavelDisplay(chamado),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [chamados, searchTerm, numeroFilter, localLookup, responsavelMap, responsaveisLoading]);

  const solicitantes = useMemo(() => {
    const map = new Map<string, UsuarioRow>();
    chamados.forEach((chamado) => {
      if (chamado.solicitante?.id) map.set(chamado.solicitante.id, chamado.solicitante as UsuarioRow);
    });
    return Array.from(map.values()).sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
  }, [chamados]);

  const refreshChamadosData = async () => {
    await Promise.all([refetchChamados(), refetchCategorias()]);
  };

  const handleClearFilters = () => {
    setStatusFilters([]);
    setPrioridadeFilters([]);
    setCategoriaFilters([]);
    setLocalFilters([]);
    setCostCenterFilter("all");
    setResponsavelFilter("all");
    setSolicitanteFilter("all");
    setCreatedFrom("");
    setCreatedTo("");
    setNumeroFilter("");
    setSearchTerm("");
  };

  const handleOpenCreate = () => {
    setEditingChamado(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (chamado: ChamadoRow) => {
    if (!canEditChamado(chamado)) return;
    setEditingChamado(chamado);
    setFormOpen(true);
  };

  const handleOpenDetails = (chamado: ChamadoRow) => {
    setSelectedChamadoId(chamado.id);
    setDetailsOpen(true);
  };

  const handleDeleteChamado = async (chamado: Pick<ChamadoRow, "id" | "solicitante_id">) => {
    if (!canDeleteChamado(chamado)) {
      toast.error("Seu perfil não pode excluir este chamado.");
      return;
    }
    if (typeof window !== "undefined" && !window.confirm("Excluir este chamado? Esta ação não pode ser desfeita.")) {
      return;
    }

    try {
      const { error } = await supabase.from("chamados").delete().eq("id", chamado.id);
      if (error) throw error;
      toast.success("Chamado excluído com sucesso.");
      await queryClient.invalidateQueries({ queryKey: ["chamados-module"] });
    } catch (error: any) {
      console.error("Erro ao excluir chamado:", error);
      toast.error(error?.message ?? "Erro ao excluir chamado.");
      throw error;
    }
  };

  const handleOpenCategoriaDialog = (categoria?: CategoriaRow | null) => {
    setEditingCategoria(categoria ?? null);
    setCategoriaDraft(buildCategoriaDraft(categoria));
    setCategoriaDialogOpen(true);
  };

  const handleCategoriaDraftChange = <K extends keyof CategoriaDraft>(key: K, value: CategoriaDraft[K]) => {
    setCategoriaDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveCategoria = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canManageCategorias) {
      toast.error("Seu perfil não pode gerenciar categorias.");
      return;
    }
    if (!categoriaDraft.nome.trim()) {
      toast.error("Informe o nome da categoria.");
      return;
    }

    const actionLabel = editingCategoria
      ? `salvar as alterações da categoria "${categoriaDraft.nome.trim()}"`
      : `criar a categoria "${categoriaDraft.nome.trim()}"`;
    if (typeof window !== "undefined" && !window.confirm(`Deseja ${actionLabel}?`)) {
      return;
    }

    setSavingCategoria(true);
    try {
      if (editingCategoria) {
        const payload: TablesUpdate<"chamado_categorias"> = {
          nome: categoriaDraft.nome.trim(),
          descricao: categoriaDraft.descricao.trim() || null,
          ativo: categoriaDraft.ativo,
        };

        const { error } = await supabase.from("chamado_categorias").update(payload).eq("id", editingCategoria.id);
        if (error) throw error;
        toast.success("Categoria atualizada com sucesso.");
      } else {
        const payload: TablesInsert<"chamado_categorias"> = {
          nome: categoriaDraft.nome.trim(),
          descricao: categoriaDraft.descricao.trim() || null,
          ativo: categoriaDraft.ativo,
        };

        const { error } = await supabase.from("chamado_categorias").insert(payload);
        if (error) throw error;
        toast.success("Categoria criada com sucesso.");
      }

      setCategoriaDialogOpen(false);
      setEditingCategoria(null);
      setCategoriaDraft(EMPTY_CATEGORIA_DRAFT);
      await refetchCategorias();
    } catch (error: any) {
      console.error("Erro ao salvar categoria:", error);
      toast.error(error?.message ?? "Erro ao salvar categoria.");
    } finally {
      setSavingCategoria(false);
    }
  };

  const handleDeleteCategoria = async (categoria: CategoriaRow) => {
    if (!canManageCategorias) {
      toast.error("Seu perfil não pode excluir categorias.");
      return;
    }
    if (typeof window !== "undefined" && !window.confirm(`Excluir a categoria ${categoria.nome}?`)) return;

    setDeletingCategoriaId(categoria.id);
    try {
      const { error } = await supabase.from("chamado_categorias").delete().eq("id", categoria.id);
      if (error) throw error;
      toast.success("Categoria excluída com sucesso.");
      await refetchCategorias();
    } catch (error: any) {
      console.error("Erro ao excluir categoria:", error);
      toast.error(error?.message ?? "Erro ao excluir categoria.");
    } finally {
      setDeletingCategoriaId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold md:text-3xl">Chamados</h1>
            <p className="text-sm text-muted-foreground">
              Gestão operacional baseada em locais, categorias, interações, anexos e auditoria.
            </p>
          </div>
          <div className="flex flex-col gap-2 md:items-end">
            <div className="flex w-full items-center justify-end gap-2 md:w-auto">
              <motion.svg
                aria-hidden="true"
                className="hidden h-10 w-40 text-primary drop-shadow-sm md:block"
                viewBox="0 0 160 40"
                fill="none"
                initial={shouldReduceMotion ? false : { opacity: 0, x: -120, scale: 0.92 }}
                animate={
                  shouldReduceMotion
                    ? undefined
                    : {
                        opacity: 1,
                        x: [-120, -20, -8, 0],
                        scale: [0.92, 1, 1, 1],
                      }
                }
                transition={
                  shouldReduceMotion
                    ? undefined
                    : {
                        duration: 1.35,
                        times: [0, 0.7, 0.88, 1],
                        ease: "easeOut",
                      }
                }
              >
                <path
                  d="M14 20H138"
                  stroke="currentColor"
                  strokeWidth="6.5"
                  strokeLinecap="round"
                />
                <path
                  d="M124 8L138 20L124 32"
                  stroke="currentColor"
                  strokeWidth="6.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </motion.svg>
              <div className="w-full rounded-lg border border-primary/20 bg-primary/5 p-1.5 shadow-sm md:w-auto">
                <Button
                  onClick={handleOpenCreate}
                  disabled={!canCreateChamadosResolved || accessLoading}
                  className="w-full font-semibold shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 md:w-auto"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Novo chamado
                </Button>
              </div>
            </div>
            <p className="hidden text-xs text-muted-foreground md:block">
              Use este botão para registrar um novo chamado.
            </p>
          </div>
        </div>

        {!canReadChamados && !accessLoading ? (
          <Card>
            <CardContent className="space-y-4 py-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <MessageSquare className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Leitura restrita para o perfil atual</h2>
                <p className="text-sm text-muted-foreground">
                  Seu perfil atual não possui acesso à listagem de chamados.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : isInternalScopedByCostCenter && costCenters.length === 0 && !accessLoading ? (
          <Card>
            <CardContent className="space-y-4 py-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <MessageSquare className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Nenhum centro de custo vinculado</h2>
                <p className="text-sm text-muted-foreground">
                  Seu perfil interno precisa de ao menos um vínculo de centro de custo para operar chamados.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="lista" className="space-y-4">
            <TabsList
              className={`grid h-auto w-full gap-2 bg-muted/60 p-1 ${canManageCategorias ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"}`}
            >
              <TabsTrigger value="lista" className="min-h-10 text-xs sm:text-sm">
                Chamados
              </TabsTrigger>
              <TabsTrigger value="dashboard" className="min-h-10 text-xs sm:text-sm">
                Dashboards
              </TabsTrigger>
              {canManageCategorias && (
                <TabsTrigger
                  value="categorias"
                  className="col-span-2 min-h-10 text-xs sm:col-span-1 sm:text-sm"
                >
                  Categorias
                </TabsTrigger>
              )}
            </TabsList>

            <Card>
              <CardContent className="space-y-4 p-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <div className="relative md:col-span-2 xl:col-span-2">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder={
                        isRestrictedToOwnChamados
                          ? "Buscar chamado"
                          : "Buscar por número, título, local..."
                      }
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                    />
                  </div>
                  <Input
                    inputMode="numeric"
                    placeholder="Número do chamado"
                    value={numeroFilter}
                    onChange={(event) => setNumeroFilter(event.target.value)}
                  />
                  <MultiSelectFilter
                    title="Status"
                    emptyLabel="Todos os status"
                    options={statusFilterOptions}
                    values={statusFilters}
                    onChange={(values) => setStatusFilters(values as ChamadoRow["status"][])}
                  />
                  <MultiSelectFilter
                    title="Prioridade"
                    emptyLabel="Todas as prioridades"
                    options={prioridadeFilterOptions}
                    values={prioridadeFilters}
                    onChange={(values) =>
                      setPrioridadeFilters(values as ChamadoRow["prioridade"][])
                    }
                  />
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => setMobileFiltersOpen((prev) => !prev)}
                  >
                    {mobileFiltersOpen ? "Ocultar filtros avançados" : "Mostrar filtros avançados"}
                  </Button>
                  <Button variant="outline" className="w-full sm:w-auto" onClick={handleClearFilters}>
                    Limpar filtros
                  </Button>
                </div>

                <div className={mobileFiltersOpen ? "block space-y-3" : "hidden space-y-3 md:block"}>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <MultiSelectFilter
                      title="Categorias"
                      emptyLabel="Todas as categorias"
                      options={categoriaFilterOptions}
                      values={categoriaFilters}
                      onChange={setCategoriaFilters}
                    />
                    {showCostCenterFilter && (
                      <Select value={costCenterFilter} onValueChange={setCostCenterFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Centro de custo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os centros</SelectItem>
                          {costCenters.map((center) => (
                            <SelectItem key={center.id} value={center.id}>
                              {center.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <MultiSelectFilter
                      title="Locais"
                      emptyLabel="Todos os locais"
                      options={localFilterOptions}
                      values={localFilters}
                      onChange={setLocalFilters}
                    />
                    {!isRestrictedToOwnChamados && (
                      <Select value={responsavelFilter} onValueChange={setResponsavelFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Responsável" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os responsáveis</SelectItem>
                          {responsaveis.map((responsavel) => (
                            <SelectItem key={responsavel.id} value={responsavel.id}>
                              {responsavel.full_name || responsavel.cargo || "Usuário interno"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {!isRestrictedToOwnChamados && (
                      <Select value={solicitanteFilter} onValueChange={setSolicitanteFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Solicitante" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os solicitantes</SelectItem>
                          {solicitantes.map((solicitante) => (
                            <SelectItem key={solicitante.id} value={solicitante.id}>
                              {solicitante.full_name || solicitante.email || solicitante.id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Criado de</label>
                      <Input
                        type="date"
                        value={createdFrom}
                        onChange={(event) => setCreatedFrom(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Criado até</label>
                      <Input
                        type="date"
                        value={createdTo}
                        onChange={(event) => setCreatedTo(event.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <TabsContent value="lista" className="space-y-4">
              <Card>
                <CardContent className="p-3 md:p-0">
                  <div className="space-y-3 md:hidden">
                    {filteredChamados.length > 0 ? (
                      filteredChamados.map((chamado) => {
                        const local = localLookup.get(chamado.local_id);

                        return (
                          <button
                            key={chamado.id}
                            type="button"
                            onClick={() => handleOpenDetails(chamado)}
                            className="w-full rounded-xl border bg-card p-4 text-left shadow-sm transition hover:bg-accent/40"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold">
                                  {formatChamadoNumero(chamado.numero)}
                                </p>
                                <p className="mt-1 line-clamp-2 text-sm font-medium">
                                  {chamado.titulo}
                                </p>
                              </div>
                              <div
                                className="flex shrink-0 gap-2"
                                onClick={(event) => event.stopPropagation()}
                              >
                                {canEditChamado(chamado) && (
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => handleOpenEdit(chamado)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                )}
                                {canDeleteChamado(chamado) && (
                                  <Button
                                    variant="destructive"
                                    size="icon"
                                    onClick={() => handleDeleteChamado(chamado)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              <Badge
                                variant="outline"
                                className={getChamadoStatusClass(chamado.status)}
                              >
                                {CHAMADO_STATUS_LABELS[chamado.status]}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={getChamadoPrioridadeClass(chamado.prioridade)}
                              >
                                {CHAMADO_PRIORIDADE_LABELS[chamado.prioridade]}
                              </Badge>
                            </div>

                            <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                              <p className="line-clamp-2">{chamado.descricao || "Sem descrição"}</p>
                              <p>
                                <span className="font-medium text-foreground">Categoria:</span>{" "}
                                {chamado.categoria?.nome || "-"}
                              </p>
                              <p>
                                <span className="font-medium text-foreground">Local:</span>{" "}
                                {local?.nome || "-"}
                              </p>
                              <p>
                                <span className="font-medium text-foreground">Responsável:</span>{" "}
                                {getResponsavelDisplay(chamado)}
                              </p>
                              <p>
                                <span className="font-medium text-foreground">Criado em:</span>{" "}
                                {formatDateTime(chamado.created_at)}
                              </p>
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <div className="rounded-xl border py-10 text-center text-sm text-muted-foreground">
                        {isFetching
                          ? "Carregando chamados..."
                          : "Nenhum chamado encontrado para os filtros informados."}
                      </div>
                    )}
                  </div>

                  <div className="hidden overflow-x-auto md:block">
                    <Table>
                      <TableHeader><TableRow><TableHead>Número</TableHead><TableHead>Título</TableHead><TableHead>Categoria</TableHead><TableHead>Local</TableHead><TableHead>Centro</TableHead><TableHead>Status</TableHead><TableHead>Prioridade</TableHead><TableHead>Solicitante</TableHead><TableHead>Responsável</TableHead><TableHead>Criado em</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {filteredChamados.length > 0 ? filteredChamados.map((chamado) => {
                          const local = localLookup.get(chamado.local_id);
                          return (
                            <TableRow key={chamado.id} className="cursor-pointer" onClick={() => handleOpenDetails(chamado)}>
                              <TableCell className="font-medium">{formatChamadoNumero(chamado.numero)}</TableCell>
                              <TableCell><div className="max-w-[260px] truncate font-medium">{chamado.titulo}</div><div className="max-w-[260px] truncate text-xs text-muted-foreground">{chamado.descricao}</div></TableCell>
                              <TableCell>{chamado.categoria?.nome || "-"}</TableCell>
                              <TableCell>{local?.nome || "-"}</TableCell>
                              <TableCell>{local?.cost_center_name || "-"}</TableCell>
                              <TableCell><Badge variant="outline" className={getChamadoStatusClass(chamado.status)}>{CHAMADO_STATUS_LABELS[chamado.status]}</Badge></TableCell>
                              <TableCell><Badge variant="outline" className={getChamadoPrioridadeClass(chamado.prioridade)}>{CHAMADO_PRIORIDADE_LABELS[chamado.prioridade]}</Badge></TableCell>
                              <TableCell>{chamado.solicitante?.full_name || chamado.solicitante?.email || "-"}</TableCell>
                              <TableCell>{getResponsavelDisplay(chamado)}</TableCell>
                              <TableCell>{formatDateTime(chamado.created_at)}</TableCell>
                              <TableCell className="text-right"><div className="flex justify-end gap-2" onClick={(event) => event.stopPropagation()}>{canEditChamado(chamado) && <Button variant="outline" size="sm" onClick={() => handleOpenEdit(chamado)}><Pencil className="h-4 w-4" /></Button>}{canDeleteChamado(chamado) && <Button variant="destructive" size="sm" onClick={() => handleDeleteChamado(chamado)}><Trash2 className="h-4 w-4" /></Button>}</div></TableCell>
                            </TableRow>
                          );
                        }) : <TableRow><TableCell colSpan={11} className="py-10 text-center text-sm text-muted-foreground">{isFetching ? "Carregando chamados..." : "Nenhum chamado encontrado para os filtros informados."}</TableCell></TableRow>}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="dashboard" className="space-y-4">
              <ChamadosDashboard
                chamados={filteredChamados}
                localLookup={localLookup}
                getResponsavelDisplay={getResponsavelDisplay}
              />
            </TabsContent>

            {canManageCategorias && <TabsContent value="categorias" className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div><h2 className="text-xl font-semibold">Categorias de chamado</h2><p className="text-sm text-muted-foreground">Use categorias ativas para classificação no cadastro do chamado.</p></div>
                <Button onClick={() => handleOpenCategoriaDialog()} disabled={!canManageCategorias} className="w-full md:w-auto"><Plus className="mr-2 h-4 w-4" />Nova categoria</Button>
              </div>
              <Card>
                <CardContent className="p-3 md:p-0">
                  <div className="space-y-3 md:hidden">
                    {categorias.length > 0 ? (
                      categorias.map((categoria) => (
                        <div key={categoria.id} className="rounded-xl border p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="font-semibold">{categoria.nome}</h3>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {categoria.descricao || "-"}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleOpenCategoriaDialog(categoria)}
                                disabled={!canManageCategorias}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="icon"
                                onClick={() => handleDeleteCategoria(categoria)}
                                disabled={!canManageCategorias || deletingCategoriaId === categoria.id}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <Badge variant={categoria.ativo ? "secondary" : "outline"}>
                              {categoria.ativo ? "Ativa" : "Inativa"}
                            </Badge>
                          </div>

                          <p className="mt-3 text-sm text-muted-foreground">
                            Atualizado em: {formatDateTime(categoria.updated_at)}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border py-10 text-center text-sm text-muted-foreground">
                        Nenhuma categoria cadastrada.
                      </div>
                    )}
                  </div>

                  <div className="hidden md:block">
                    <Table>
                      <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Descrição</TableHead><TableHead>Status</TableHead><TableHead>Atualizado em</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {categorias.length > 0 ? categorias.map((categoria) => (
                          <TableRow key={categoria.id}>
                            <TableCell className="font-medium">{categoria.nome}</TableCell>
                            <TableCell>{categoria.descricao || "-"}</TableCell>
                            <TableCell><Badge variant={categoria.ativo ? "secondary" : "outline"}>{categoria.ativo ? "Ativa" : "Inativa"}</Badge></TableCell>
                            <TableCell>{formatDateTime(categoria.updated_at)}</TableCell>
                            <TableCell className="text-right"><div className="flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => handleOpenCategoriaDialog(categoria)} disabled={!canManageCategorias}><Pencil className="h-4 w-4" /></Button><Button variant="destructive" size="sm" onClick={() => handleDeleteCategoria(categoria)} disabled={!canManageCategorias || deletingCategoriaId === categoria.id}><Trash2 className="h-4 w-4" /></Button></div></TableCell>
                          </TableRow>
                        )) : <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">Nenhuma categoria cadastrada.</TableCell></TableRow>}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>}
          </Tabs>
        )}
      </div>

      <ChamadoForm open={formOpen} onOpenChange={setFormOpen} chamado={editingChamado} currentUserId={accessContext.userId} accessLevel={accessContext.accessLevel} categorias={categorias} costCenters={costCenterOptions} locais={localOptions} onSuccess={async () => { setEditingChamado(null); await refreshChamadosData(); }} />

      <ChamadoDetails chamadoId={selectedChamadoId} open={detailsOpen} onOpenChange={(open) => { setDetailsOpen(open); if (!open) setSelectedChamadoId(null); }} onEdit={(chamado) => { setDetailsOpen(false); handleOpenEdit(chamado); }} onDelete={handleDeleteChamado} currentUserId={accessContext.userId} userRole={accessContext.role} accessLevel={accessContext.accessLevel} responsaveis={responsaveis} responsaveisLoading={responsaveisLoading} locais={localOptions} />

      <Dialog open={categoriaDialogOpen} onOpenChange={setCategoriaDialogOpen}>
        <DialogContent className="max-w-2xl w-[95vw]">
          <DialogHeader>
            <DialogTitle>{editingCategoria ? "Editar categoria" : "Nova categoria"}</DialogTitle>
            <DialogDescription>Cadastre categorias para classificar os chamados do novo módulo.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSaveCategoria}>
            <div className="space-y-2"><label className="text-sm font-medium">Nome</label><Input value={categoriaDraft.nome} onChange={(event) => handleCategoriaDraftChange("nome", event.target.value)} placeholder="Ex: Segurança" /></div>
            <div className="space-y-2"><label className="text-sm font-medium">Descrição</label><Textarea rows={4} value={categoriaDraft.descricao} onChange={(event) => handleCategoriaDraftChange("descricao", event.target.value)} placeholder="Explique quando essa categoria deve ser usada." /></div>
            <label className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm"><Switch checked={categoriaDraft.ativo} onCheckedChange={(checked) => handleCategoriaDraftChange("ativo", checked)} />Categoria ativa</label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCategoriaDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={savingCategoria}>{savingCategoria ? "Salvando..." : editingCategoria ? "Salvar alterações" : "Criar categoria"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
