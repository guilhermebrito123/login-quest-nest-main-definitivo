import { useMemo, useState } from "react";
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
import { formatDate, formatDateTime } from "./diarias/utils";
import { useDiariasTemporariasData } from "./diarias/temporariasUtils";
import { FaltaJustificarDialog } from "@/components/faltas/FaltaJustificarDialog";
import { toast } from "sonner";

const BUCKET = "atestados";

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
  const [faltaType, setFaltaType] = useState<FaltaTipo>("convenia");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedFalta, setSelectedFalta] = useState<FaltaData | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [detailsFalta, setDetailsFalta] = useState<FaltaData | null>(null);

  const {
    diarias,
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

  const filteredFaltas = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return faltasAtivas.filter((falta) => {
      if (statusFilter === "pendente" && falta.justificada_em) return false;
      if (statusFilter === "justificada" && !falta.justificada_em) return false;

      if (!term) return true;
      const colaboradorNome = getFaltaColaboradorNome(falta).toLowerCase();
      const diariaId = String(falta.diaria_temporaria_id);
      return colaboradorNome.includes(term) || diariaId.includes(term);
    });
  }, [faltasAtivas, searchTerm, statusFilter, colaboradoresMap, colaboradoresConveniaMap]);

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
    setSelectedFalta(falta);
    setDialogOpen(true);
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
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>Busque faltas por colaborador ou ID da diaria.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 md:grid md:grid-cols-4">
            <div className="space-y-2">
              <span className="text-sm text-muted-foreground">Busca</span>
              <Input
                value={searchTerm}
                placeholder="Nome ou ID da diaria"
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <div className="space-y-2">
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
            <div className="space-y-2">
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
                  {filteredFaltas.map((falta) => {
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
                      (typeof diaria?.cliente_id === "number" && clienteMap.get(diaria.cliente_id)) ||
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
                            disabled={!!falta.justificada_em}
                            onClick={(event) => {
                              event.stopPropagation();
                              openJustificarDialog(falta);
                            }}
                          >
                            Justificar
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
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
                  <Button
                    type="button"
                    size="sm"
                    disabled={!!detailsFalta.justificada_em}
                    onClick={() => {
                      handleDetailsDialogOpenChange(false);
                      openJustificarDialog(detailsFalta);
                    }}
                  >
                    Justificar
                  </Button>
                </DialogFooter>
              </div>
            );
          })() : null}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Faltas;
