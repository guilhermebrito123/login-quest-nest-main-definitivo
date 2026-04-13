import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MoreVertical } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useSession } from "@/hooks/useSession";
import { formatDate, formatDateTime } from "./diarias/utils";

const COST_CENTER_FILTER_ALL = "__all__";

type ColaboradorConvenia = Database["public"]["Tables"]["colaboradores_convenia"]["Row"];
type CostCenterRow = Database["public"]["Tables"]["cost_center"]["Row"];
type FaltaConveniaRow = Database["public"]["Tables"]["faltas_colaboradores_convenia"]["Row"];
type UsuarioResumo = { id: string; full_name: string | null; email: string | null };

const getConveniaColaboradorNome = (colaborador?: ColaboradorConvenia | null) => {
  if (!colaborador) return "-";
  const base = (colaborador.social_name || colaborador.name || "").trim();
  const last = (colaborador.last_name || "").trim();
  const full = [base, last].filter(Boolean).join(" ").trim();
  return full || colaborador.name || colaborador.id || "-";
};

const Controladoria = () => {
  const { session } = useSession();
  const [faltasDialogOpen, setFaltasDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [costCenterFilter, setCostCenterFilter] = useState(COST_CENTER_FILTER_ALL);
  const [pendingColaboradorId, setPendingColaboradorId] = useState("");
  const [pendingStartDate, setPendingStartDate] = useState("");
  const [pendingEndDate, setPendingEndDate] = useState("");
  const [appliedFilter, setAppliedFilter] = useState({
    colaboradorId: "",
    startDate: "",
    endDate: "",
  });

  const { data: costCenters = [] } = useQuery({
    queryKey: ["controladoria-cost-centers", session?.user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cost_center")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return (data || []) as Pick<CostCenterRow, "id" | "name">[];
    },
    enabled: !!session,
  });

  const { data: colaboradoresConvenia = [] } = useQuery({
    queryKey: ["controladoria-colaboradores-convenia", session?.user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaboradores_convenia")
        .select("id, name, last_name, social_name, cpf, registration, cost_center_id, cost_center_name")
        .order("name");
      if (error) throw error;
      return (data || []) as ColaboradorConvenia[];
    },
    enabled: !!session,
  });

  const costCenterMap = useMemo(() => {
    const map = new Map<string, string>();
    costCenters.forEach((center) => {
      if (center?.id) {
        map.set(center.id, center.name || center.id);
      }
    });
    return map;
  }, [costCenters]);

  const colaboradoresConveniaMap = useMemo(() => {
    const map = new Map<string, ColaboradorConvenia>();
    colaboradoresConvenia.forEach((colaborador) => {
      if (colaborador.id) map.set(colaborador.id, colaborador);
    });
    return map;
  }, [colaboradoresConvenia]);

  const filteredColaboradores = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return colaboradoresConvenia
      .filter((colaborador) => {
        if (costCenterFilter !== COST_CENTER_FILTER_ALL) {
          if (colaborador.cost_center_id !== costCenterFilter) return false;
        }
        if (!term) return true;
        const name = [
          colaborador.social_name,
          colaborador.name,
          colaborador.last_name,
          colaborador.cpf,
          colaborador.registration,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return name.includes(term);
      })
      .sort((a, b) =>
        getConveniaColaboradorNome(a).localeCompare(getConveniaColaboradorNome(b)),
      );
  }, [colaboradoresConvenia, costCenterFilter, searchTerm]);

  useEffect(() => {
    if (faltasDialogOpen) {
      setPendingColaboradorId(appliedFilter.colaboradorId);
      setPendingStartDate(appliedFilter.startDate);
      setPendingEndDate(appliedFilter.endDate);
      return;
    }
    setSearchTerm("");
    setCostCenterFilter(COST_CENTER_FILTER_ALL);
  }, [faltasDialogOpen, appliedFilter]);

  const {
    data: faltas = [],
    isLoading: loadingFaltas,
    isFetching: fetchingFaltas,
  } = useQuery({
    queryKey: ["controladoria-faltas", session?.user?.id, appliedFilter],
    queryFn: async () => {
      if (!appliedFilter.colaboradorId || !appliedFilter.startDate || !appliedFilter.endDate) {
        return [] as FaltaConveniaRow[];
      }
      const { data, error } = await supabase
        .from("faltas_colaboradores_convenia")
        .select("*")
        .eq("colaborador_convenia_id", appliedFilter.colaboradorId)
        .gte("data_falta", appliedFilter.startDate)
        .lte("data_falta", appliedFilter.endDate)
        .order("data_falta", { ascending: false });
      if (error) throw error;
      return (data || []) as FaltaConveniaRow[];
    },
    enabled:
      !!session &&
      !!appliedFilter.colaboradorId &&
      !!appliedFilter.startDate &&
      !!appliedFilter.endDate,
  });

  const justificativaIds = useMemo(() => {
    const ids = new Set<string>();
    faltas.forEach((falta) => {
      if (falta.justificada_por) ids.add(falta.justificada_por);
    });
    return Array.from(ids);
  }, [faltas]);

  const { data: usuarios = [] } = useQuery({
    queryKey: ["controladoria-faltas-usuarios", session?.user?.id, justificativaIds],
    queryFn: async () => {
      if (justificativaIds.length === 0) return [] as UsuarioResumo[];
      const { data, error } = await supabase
        .from("usuarios")
        .select("id, full_name, email")
        .in("id", justificativaIds);
      if (error) throw error;
      return (data || []) as UsuarioResumo[];
    },
    enabled: !!session && justificativaIds.length > 0,
  });

  const usuarioMap = useMemo(() => {
    const map = new Map<string, string>();
    usuarios.forEach((usuario) => {
      if (usuario.id) {
        map.set(usuario.id, usuario.full_name || usuario.email || usuario.id);
      }
    });
    return map;
  }, [usuarios]);

  const totalJustificadas = useMemo(
    () => faltas.filter((falta) => !!falta.justificada_em).length,
    [faltas],
  );
  const totalInjustificadas = useMemo(
    () => faltas.length - totalJustificadas,
    [faltas, totalJustificadas],
  );

  const pendingColaborador = colaboradoresConveniaMap.get(pendingColaboradorId);
  const pendingCostCenterLabel =
    pendingColaborador?.cost_center_id &&
    costCenterMap.get(pendingColaborador.cost_center_id);
  const selectedColaborador = colaboradoresConveniaMap.get(appliedFilter.colaboradorId);
  const selectedCostCenterLabel =
    selectedColaborador?.cost_center_id &&
    costCenterMap.get(selectedColaborador.cost_center_id);

  const handleApplyFaltasFilters = () => {
    if (!pendingColaboradorId || !pendingStartDate || !pendingEndDate) return;
    setAppliedFilter({
      colaboradorId: pendingColaboradorId,
      startDate: pendingStartDate,
      endDate: pendingEndDate,
    });
    setFaltasDialogOpen(false);
  };

  const hasAppliedFilter =
    !!appliedFilter.colaboradorId && !!appliedFilter.startDate && !!appliedFilter.endDate;
  const hasPendingSelection =
    !!pendingColaboradorId && !!pendingStartDate && !!pendingEndDate;

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Controladoria</h1>
            <p className="text-sm text-muted-foreground">
              Centralize consultas e indicadores operacionais.
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="icon" aria-label="Acoes">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  setFaltasDialogOpen(true);
                }}
              >
                Faltas
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filtro atual</CardTitle>
            <CardDescription>
              Selecione um colaborador e o periodo das faltas para iniciar.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Colaborador</p>
              <p className="text-base font-semibold">
                {selectedColaborador ? getConveniaColaboradorNome(selectedColaborador) : "--"}
              </p>
              <p className="text-xs text-muted-foreground">
                {selectedColaborador
                  ? selectedCostCenterLabel ||
                    selectedColaborador.cost_center_name ||
                    selectedColaborador.cost_center_id ||
                    "-"
                  : "Centro de custo nao selecionado"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Periodo</p>
              <p className="text-base font-semibold">
                {hasAppliedFilter
                  ? `${formatDate(appliedFilter.startDate)} ate ${formatDate(
                      appliedFilter.endDate,
                    )}`
                  : "--"}
              </p>
            </div>
            <Button type="button" variant="outline" onClick={() => setFaltasDialogOpen(true)}>
              Visualizar faltas
            </Button>
          </CardContent>
        </Card>

        {!hasAppliedFilter ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Use o menu de acoes para escolher um colaborador e periodo.
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Faltas injustificadas</CardTitle>
                  <CardDescription>Periodo selecionado</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold">{totalInjustificadas}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Faltas justificadas</CardTitle>
                  <CardDescription>Periodo selecionado</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold">{totalJustificadas}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Detalhamento das faltas</CardTitle>
                <CardDescription>
                  {fetchingFaltas
                    ? "Atualizando dados..."
                    : `${faltas.length} falta(s) encontrada(s).`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingFaltas ? (
                  <p className="text-sm text-muted-foreground">Carregando faltas...</p>
                ) : faltas.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma falta encontrada para o periodo selecionado.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Motivo</TableHead>
                          <TableHead>Local</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Justificada em</TableHead>
                          <TableHead>Justificada por</TableHead>
                          <TableHead>Diaria</TableHead>
                          <TableHead>Atestado</TableHead>
                          <TableHead>Criada em</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {faltas.map((falta) => {
                          const justificada = !!falta.justificada_em;
                          const localLabel =
                            (falta.local_falta &&
                              costCenterMap.get(falta.local_falta)) ||
                            falta.local_falta ||
                            "-";
                          const justificadaPor =
                            (falta.justificada_por &&
                              usuarioMap.get(falta.justificada_por)) ||
                            "-";
                          return (
                            <TableRow key={falta.id}>
                              <TableCell className="whitespace-nowrap">
                                {formatDate(falta.data_falta)}
                              </TableCell>
                              <TableCell className="min-w-[200px]">
                                {falta.motivo || "-"}
                              </TableCell>
                              <TableCell>{localLabel}</TableCell>
                              <TableCell>
                                <Badge variant={justificada ? "secondary" : "destructive"}>
                                  {justificada ? "Justificada" : "Injustificada"}
                                </Badge>
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                {formatDateTime(falta.justificada_em)}
                              </TableCell>
                              <TableCell className="min-w-[160px]">
                                {justificadaPor}
                              </TableCell>
                              <TableCell>{falta.diaria_temporaria_id ?? "-"}</TableCell>
                              <TableCell>{falta.atestado_path ? "Sim" : "-"}</TableCell>
                              <TableCell className="whitespace-nowrap">
                                {formatDateTime(falta.created_at)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Dialog open={faltasDialogOpen} onOpenChange={setFaltasDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Selecionar colaborador e periodo</DialogTitle>
            <DialogDescription>
              Pesquise pelo colaborador e aplique o periodo das faltas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground">Pesquisar colaborador</span>
                <Input
                  placeholder="Digite o nome ou CPF"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground">Centro de custo</span>
                <Select
                  value={costCenterFilter}
                  onValueChange={(value) => setCostCenterFilter(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Filtrar centro de custo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={COST_CENTER_FILTER_ALL}>Todos</SelectItem>
                    {costCenters.map((center) => (
                      <SelectItem key={center.id} value={center.id}>
                        {center.name || center.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-muted-foreground">
                Colaboradores encontrados
              </p>
              <div className="rounded-md border">
                <ScrollArea className="h-64">
                  {filteredColaboradores.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      Nenhum colaborador encontrado.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>CPF</TableHead>
                          <TableHead>Centro de custo</TableHead>
                          <TableHead className="text-right">Acao</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredColaboradores.map((colaborador) => {
                          const label = getConveniaColaboradorNome(colaborador);
                          const centerLabel =
                            (colaborador.cost_center_id &&
                              costCenterMap.get(colaborador.cost_center_id)) ||
                            colaborador.cost_center_name ||
                            colaborador.cost_center_id ||
                            "-";
                          const isSelected = colaborador.id === pendingColaboradorId;
                          return (
                            <TableRow key={colaborador.id} className={isSelected ? "bg-muted/40" : ""}>
                              <TableCell className="min-w-[220px]">{label}</TableCell>
                              <TableCell>{colaborador.cpf || "-"}</TableCell>
                              <TableCell>{centerLabel}</TableCell>
                              <TableCell className="text-right">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={isSelected ? "default" : "outline"}
                                  onClick={() => setPendingColaboradorId(colaborador.id)}
                                >
                                  {isSelected ? "Selecionado" : "Selecionar"}
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </ScrollArea>
              </div>
            </div>

            <div className="space-y-3 rounded-md border bg-muted/30 p-4">
              <p className="text-sm font-semibold text-muted-foreground">
                Colaborador selecionado
              </p>
              <div className="space-y-1">
                <p className="text-base font-semibold">
                  {pendingColaborador ? getConveniaColaboradorNome(pendingColaborador) : "--"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {pendingColaborador
                    ? pendingCostCenterLabel ||
                      pendingColaborador.cost_center_name ||
                      pendingColaborador.cost_center_id ||
                      "-"
                    : "Selecione um colaborador para continuar."}
                </p>
              </div>
              {pendingColaborador && (
                <div className="grid gap-3 pt-2 md:grid-cols-2">
                  <div className="space-y-1">
                    <span className="text-sm text-muted-foreground">Data inicial</span>
                    <Input
                      type="date"
                      value={pendingStartDate}
                      onChange={(event) => setPendingStartDate(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm text-muted-foreground">Data final</span>
                    <Input
                      type="date"
                      value={pendingEndDate}
                      onChange={(event) => setPendingEndDate(event.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setFaltasDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!hasPendingSelection}
              onClick={handleApplyFaltasFilters}
            >
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Controladoria;
