import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
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

import { Badge } from "@/components/ui/badge";

import { Search, Info } from "lucide-react";

import { format } from "date-fns";

import { ptBR } from "date-fns/locale";

import { DashboardLayout } from "@/components/DashboardLayout";
import { toast } from "sonner";

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
  const linked = colaborador?.cost_center_ref;
  const linkedName =
    linked?.name ||
    linked?.convenia_cost_center_name ||
    linked?.descricao ||
    linked?.description;
  if (typeof linkedName === "string" && linkedName.trim()) return linkedName;

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
        .select("*, cost_center_ref:cost_center_id ( id, name, convenia_id )")
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

  const handleExportXlsx = () => {
    if (!filteredColaboradores.length) {
      toast.error("Nenhum colaborador para exportar.");
      return;
    }

    const rows = filteredColaboradores.map((colaborador: any) => ({
      Nome: getColaboradorNome(colaborador),
      "Email corporativo": colaborador.email || "",
      "Email pessoal": colaborador.personal_email || "",
      Telefone:
        colaborador.personal_phone ||
        colaborador.residential_phone ||
        "",
      Status:
        STATUS_COLABORADOR_LABELS[colaborador.status] ||
        colaborador.status ||
        "",
      Cargo: colaborador.job_name || "",
      Departamento: colaborador.department_name || "",
      "Centro de custo": getCostCenterLabel(colaborador),
      Equipe: colaborador.team_name || "",
      Supervisor: getSupervisorNome(colaborador),
      Matricula: colaborador.registration || "",
      CPF: colaborador.cpf || "",
      "Data de nascimento": formatDate(colaborador.birth_date),
      "Data de admissao": formatDate(colaborador.hiring_date),
    }));

    const sheet = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Colaboradores");
    XLSX.writeFile(wb, `colaboradores-convenia-${Date.now()}.xlsx`);
    toast.success("Arquivo XLSX gerado.");
  };

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
            <Button
              type="button"
              variant="outline"
              onClick={handleExportXlsx}
              disabled={!filteredColaboradores.length}
            >
              Exportar XLSX
            </Button>
          </div>

          <div className="divide-y">
            {filteredColaboradores.length ? (
              filteredColaboradores.map((colaborador: any) => (
                <div
                  key={colaborador.id}
                  className="flex flex-col gap-4 p-4 transition hover:bg-muted/40 sm:flex-row sm:items-start sm:justify-between"
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
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-start gap-3">
                      <div>
                        <p className="font-semibold leading-tight">{getColaboradorNome(colaborador)}</p>
                        <p className="text-xs text-muted-foreground">
                          {colaborador.email || colaborador.personal_email || "-"}
                        </p>
                      </div>
                      {colaborador.status && (
                        <Badge
                          variant={getStatusBadgeVariant(colaborador.status)}
                          className="capitalize"
                        >
                          {STATUS_COLABORADOR_LABELS[colaborador.status] || colaborador.status}
                        </Badge>
                      )}
                    </div>

                    <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Cargo</p>
                        <p className="font-medium">{colaborador.job_name || "-"}</p>
                        {colaborador.department_name && (
                          <p className="text-xs text-muted-foreground">
                            Departamento: {colaborador.department_name}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Centro de custo</p>
                        <p className="font-medium">{getCostCenterLabel(colaborador)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Matricula</p>
                        <p className="font-medium">{colaborador.registration || "-"}</p>
                        <p className="text-xs text-muted-foreground">CPF</p>
                        <p className="font-medium">{colaborador.cpf || "-"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
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
                </div>
              ))
            ) : (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Nenhum colaborador encontrado com os filtros selecionados.
              </div>
            )}
          </div>
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
