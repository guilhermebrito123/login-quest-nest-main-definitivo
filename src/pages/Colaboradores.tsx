import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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

import { Badge } from "@/components/ui/badge";

import { Search, Info } from "lucide-react";

import { format } from "date-fns";

import { ptBR } from "date-fns/locale";

import { DashboardLayout } from "@/components/DashboardLayout";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";



const STATUS_COLABORADOR_LABELS: Record<string, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
};

const STATUS_COLABORADOR_BADGE: Record<string, "default" | "secondary"> = {
  ativo: "default",
  inativo: "secondary",
};

const parseDbDate = (date: string) => new Date(`${date}T00:00:00`);
const getColaboradorNome = (colaborador: any) => {
  const nomeCompleto = [colaborador?.name, colaborador?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return colaborador?.social_name || nomeCompleto || colaborador?.name || colaborador?.last_name || "Colaborador";
};

const getCostCenterLabel = (colaborador: any) => {
  const raw = colaborador?.cost_center;
  const fallback = colaborador?.cost_center_name;

  if (!raw) return fallback || "-";
  if (typeof raw === "string") return raw;

  if (Array.isArray(raw)) {
    const nomes = raw
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const nome =
            (item as any).name ??
            (item as any).convenia_cost_center_name ??
            (item as any).descricao ??
            (item as any).description;
          if (typeof nome === "string" && nome.trim()) return nome;
        }
        return null;
      })
      .filter(Boolean) as string[];
    if (nomes.length) return nomes.join(", ");
  }

  if (raw && typeof raw === "object") {
    const nome =
      (raw as any).name ??
      (raw as any).convenia_cost_center_name ??
      (raw as any).descricao ??
      (raw as any).description;
    if (typeof nome === "string" && nome.trim()) return nome;
  }

  return fallback || "-";
};

const getStatusBadgeVariant = (status?: string | null): "default" | "secondary" | "outline" =>
  status && STATUS_COLABORADOR_BADGE[status] ? STATUS_COLABORADOR_BADGE[status] : "outline";



export default function Colaboradores() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [cargoFilter, setCargoFilter] = useState<string>("all");
  const [costCenterFilter, setCostCenterFilter] = useState<string>("all");
  const [colaboradorDetalhe, setColaboradorDetalhe] = useState<any>(null);

  const { data: colaboradoresConvenia = [] } = useQuery({
    queryKey: ["colaboradores-convenia"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaboradores_convenia")
        .select("*")
        .order("name");

      if (error) throw error;
      return data ?? [];
    },
  });

  const searchLower = searchTerm.trim().toLowerCase();

  const filteredColaboradores = colaboradoresConvenia.filter((colaborador: any) => {
    const nome = getColaboradorNome(colaborador).toLowerCase();
    const email = colaborador.email?.toLowerCase() || "";
    const personalEmail = colaborador.personal_email?.toLowerCase() || "";
    const cpf = colaborador.cpf || "";
    const registration = colaborador.registration?.toLowerCase() || "";
    const costCenterLabel = getCostCenterLabel(colaborador);

    const matchesSearch =
      !searchLower ||
      nome.includes(searchLower) ||
      email.includes(searchLower) ||
      personalEmail.includes(searchLower) ||
      cpf.includes(searchLower) ||
      registration.includes(searchLower);

    const matchesStatus = statusFilter === "all" || colaborador.status === statusFilter;
    const matchesCargo = cargoFilter === "all" || colaborador.job_name === cargoFilter;
    const matchesCostCenter = costCenterFilter === "all" || costCenterLabel === costCenterFilter;

    return matchesSearch && matchesStatus && matchesCargo && matchesCostCenter;
  });

  const statusOptions = Array.from(
    new Set(
      (colaboradoresConvenia ?? [])
        .map((colaborador: any) => colaborador.status)
        .filter((status): status is string => Boolean(status))
    )
  );

  const cargoOptions = Array.from(
    new Set(
      (colaboradoresConvenia ?? [])
        .map((colaborador: any) => colaborador.job_name)
        .filter((cargo): cargo is string => Boolean(cargo))
    )
  );

  const costCenterOptions = Array.from(
    new Set(
      (colaboradoresConvenia ?? [])
        .map((colaborador: any) => getCostCenterLabel(colaborador))
        .filter((centro): centro is string => Boolean(centro && centro !== "-"))
    )
  );

  const totalColaboradores = filteredColaboradores.length;

  const formatDate = (date?: string | null) =>
    date ? format(parseDbDate(date), "dd/MM/yyyy", { locale: ptBR }) : "-";

  const getSupervisorNome = (colaborador: any) =>
    [colaborador?.supervisor_name, colaborador?.supervisor_last_name].filter(Boolean).join(" ") || "-";

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Colaboradores</h1>
            <p className="text-sm text-muted-foreground">
              Visualize os colaboradores sincronizados da Convenia.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="search-colaboradores">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="search-colaboradores"
                placeholder="Nome, CPF, email ou matricula"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {statusOptions.map((status) => (
                  <SelectItem key={status} value={status}>
                    {STATUS_COLABORADOR_LABELS[status] || status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Cargo</Label>
            <Select value={cargoFilter} onValueChange={setCargoFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {cargoOptions.map((cargo) => (
                  <SelectItem key={cargo} value={cargo}>
                    {cargo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Centro de Custo</Label>
            <Select value={costCenterFilter} onValueChange={setCostCenterFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {costCenterOptions.map((centro) => (
                  <SelectItem key={centro} value={centro}>
                    {centro}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-md border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
            <div>
              <p className="text-sm font-semibold">
                {totalColaboradores} {totalColaboradores === 1 ? "colaborador" : "colaboradores"}
              </p>
              <p className="text-xs text-muted-foreground">
                {totalColaboradores !== colaboradoresConvenia.length
                  ? "Exibindo resultados com filtros aplicados"
                  : "Exibindo todos os colaboradores disponiveis"}
              </p>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Centro de Custo</TableHead>
                <TableHead className="w-[120px]">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredColaboradores.length ? (
                filteredColaboradores.map((colaborador: any) => (
                  <TableRow
                    key={colaborador.id}
                    className="cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onClick={() => setColaboradorDetalhe(colaborador)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setColaboradorDetalhe(colaborador);
                      }
                    }}
                  >
                    <TableCell className="align-top">
                      <div className="space-y-2 rounded-md border border-transparent p-2 transition group-hover:border-muted">
                        <p className="font-semibold leading-tight">{getColaboradorNome(colaborador)}</p>
                        <p className="text-xs text-muted-foreground">
                          {colaborador.email || colaborador.personal_email || "-"}
                        </p>
                        {colaborador.status && (
                          <Badge
                            variant={getStatusBadgeVariant(colaborador.status)}
                            className="capitalize"
                          >
                            {STATUS_COLABORADOR_LABELS[colaborador.status] || colaborador.status}
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="align-top">
                      <div className="space-y-1 text-sm">
                        <p className="font-medium">{colaborador.job_name || "-"}</p>
                        {colaborador.department_name && (
                          <p className="text-xs text-muted-foreground">
                            Departamento: {colaborador.department_name}
                          </p>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="align-top">
                      <div className="space-y-1 text-sm">
                        <p className="font-medium">{getCostCenterLabel(colaborador)}</p>
                      </div>
                    </TableCell>

                    <TableCell className="align-top">
                      <div className="flex flex-wrap gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(event) => {
                            event.stopPropagation();
                            setColaboradorDetalhe(colaborador);
                          }}
                          title="Ver detalhes"
                        >
                          <Info className="h-4 w-4" />
                          <span className="sr-only">Ver detalhes</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                    Nenhum colaborador encontrado com os filtros selecionados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <Dialog
          open={!!colaboradorDetalhe}
          onOpenChange={(open) => {
            if (!open) setColaboradorDetalhe(null);
          }}
        >
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {colaboradorDetalhe ? getColaboradorNome(colaboradorDetalhe) : "Colaborador"}
              </DialogTitle>
              <DialogDescription>Informacoes completas do colaborador</DialogDescription>
            </DialogHeader>

            {colaboradorDetalhe && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Email corporativo</p>
                    <p className="font-medium">{colaboradorDetalhe.email || "-"}</p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">Email pessoal</p>
                    <p className="font-medium">{colaboradorDetalhe.personal_email || "-"}</p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">Telefone</p>
                    <p className="font-medium">
                      {colaboradorDetalhe.personal_phone || colaboradorDetalhe.residential_phone || "-"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="font-medium">
                      {STATUS_COLABORADOR_LABELS[colaboradorDetalhe.status] ||
                        colaboradorDetalhe.status ||
                        "-"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">Cargo</p>
                    <p className="font-medium">{colaboradorDetalhe.job_name || "-"}</p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">Departamento</p>
                    <p className="font-medium">{colaboradorDetalhe.department_name || "-"}</p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">Centro de Custo</p>
                    <p className="font-medium">{getCostCenterLabel(colaboradorDetalhe)}</p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">Equipe</p>
                    <p className="font-medium">{colaboradorDetalhe.team_name || "-"}</p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">Supervisor</p>
                    <p className="font-medium">{getSupervisorNome(colaboradorDetalhe)}</p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">Matricula</p>
                    <p className="font-medium">{colaboradorDetalhe.registration || "-"}</p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">CPF</p>
                    <p className="font-medium">{colaboradorDetalhe.cpf || "-"}</p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">Data de nascimento</p>
                    <p className="font-medium">{formatDate(colaboradorDetalhe.birth_date)}</p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">Data de admissao</p>
                    <p className="font-medium">{formatDate(colaboradorDetalhe.hiring_date)}</p>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
