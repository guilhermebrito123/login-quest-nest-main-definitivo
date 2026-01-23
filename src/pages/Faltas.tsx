import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatDateTime } from "./diarias/utils";
import { useDiariasTemporariasData } from "./diarias/temporariasUtils";
import { FaltaJustificarDialog } from "@/components/faltas/FaltaJustificarDialog";
import { toast } from "sonner";

const BUCKET = "atestados";

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
};

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

const STATUS_FILTERS = [
  { value: "todos", label: "Todas" },
  { value: "pendente", label: "Pendentes" },
  { value: "justificada", label: "Justificadas" },
];

const Faltas = () => {
  const [statusFilter, setStatusFilter] = useState("pendente");
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedFalta, setSelectedFalta] = useState<FaltaRow | null>(null);

  const {
    diarias,
    colaboradoresMap,
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
    data: faltas = [],
    isLoading,
    refetch: refetchFaltas,
  } = useQuery({
    queryKey: ["colaborador-faltas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaborador_faltas")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as FaltaRow[];
    },
  });

  const justificativaIds = useMemo(() => {
    const ids = new Set<string>();
    faltas.forEach((item) => {
      if (item.justificada_por) ids.add(item.justificada_por);
    });
    return Array.from(ids);
  }, [faltas]);

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
      map.set(usuario.id, usuario.full_name || usuario.email || usuario.id);
    });
    return map;
  }, [usuarios]);

  const pendingCount = useMemo(
    () => faltas.filter((falta) => !falta.justificada_em).length,
    [faltas],
  );
  const justifiedCount = useMemo(
    () => faltas.filter((falta) => !!falta.justificada_em).length,
    [faltas],
  );

  const filteredFaltas = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return faltas.filter((falta) => {
      if (statusFilter === "pendente" && falta.justificada_em) return false;
      if (statusFilter === "justificada" && !falta.justificada_em) return false;

      if (!term) return true;
      const colaboradorNome = colaboradoresMap.get(falta.colaborador_id)?.nome_completo?.toLowerCase() || "";
      const diariaId = String(falta.diaria_temporaria_id);
      return colaboradorNome.includes(term) || diariaId.includes(term);
    });
  }, [colaboradoresMap, faltas, searchTerm, statusFilter]);

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

  const openJustificarDialog = (falta: FaltaRow) => {
    setSelectedFalta(falta);
    setDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-muted-foreground uppercase tracking-wide">Diarias</p>
            <h1 className="text-3xl font-bold">Faltas</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie faltas dos colaboradores e envie os documentos de justificativa.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="shadow-lg">
            <CardHeader className="pb-2">
              <CardDescription>Total de faltas</CardDescription>
              <CardTitle className="text-2xl">{faltas.length}</CardTitle>
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
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <span className="text-sm text-muted-foreground">Busca</span>
              <Input
                value={searchTerm}
                placeholder="Nome ou ID da diaria"
                onChange={(event) => setSearchTerm(event.target.value)}
              />
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
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando faltas...</p>
            ) : filteredFaltas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma falta encontrada.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Justificada em</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFaltas.map((falta) => {
                    const diaria = diariaMap.get(String(falta.diaria_temporaria_id));
                    const colaborador = colaboradoresMap.get(falta.colaborador_id);
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
                    return (
                      <TableRow key={falta.id}>
                        <TableCell>{formatDate(diaria?.data_diaria)}</TableCell>
                        <TableCell>{colaborador?.nome_completo || falta.colaborador_id}</TableCell>
                        <TableCell>{clienteNome}</TableCell>
                        <TableCell>{falta.motivo || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant}>{statusLabel}</Badge>
                        </TableCell>
                        <TableCell>
                          {falta.justificada_em ? (
                            <div className="text-xs">
                              <div>{formatDateTime(falta.justificada_em)}</div>
                              <div className="text-muted-foreground">{justificadaPorNome}</div>
                            </div>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {falta.documento_url ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewDocumento(falta.documento_url as string)}
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
                            onClick={() => openJustificarDialog(falta)}
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
        colaboradorId={selectedFalta?.colaborador_id ?? null}
        colaboradorNome={
          selectedFalta ? colaboradoresMap.get(selectedFalta.colaborador_id)?.nome_completo : null
        }
        dataDiariaLabel={
          selectedFalta
            ? formatDate(diariaMap.get(String(selectedFalta.diaria_temporaria_id))?.data_diaria)
            : null
        }
        onSuccess={async () => {
          await Promise.all([refetchFaltas(), refetchDiarias()]);
        }}
      />
    </DashboardLayout>
  );
};

export default Faltas;
