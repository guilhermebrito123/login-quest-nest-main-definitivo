import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

type DiaristaLogRow = {
  id: string;
  diarista_id: string;
  campo_alterado: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  motivo: string | null;
  alterado_em: string | null;
  diaristas?: {
    nome_completo?: string | null;
    cpf?: string | null;
  } | null;
};

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const formatLogDateTime = (value?: string | null) => {
  if (!value) return "-";
  const trimmed = value.trim();
  if (!trimmed) return "-";
  if (DATE_ONLY_REGEX.test(trimmed)) return trimmed.split("-").reverse().join("/");
  const normalized = trimmed.replace(" ", "T");
  const hasTimezone = /([+-]\d{2}:?\d{2}|Z)$/i.test(normalized);
  const iso = hasTimezone ? normalized : `${normalized}Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatLogDate = (value?: string | null) => {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (DATE_ONLY_REGEX.test(trimmed)) return trimmed;
  const normalized = trimmed.replace(" ", "T");
  const hasTimezone = /([+-]\d{2}:?\d{2}|Z)$/i.test(normalized);
  const iso = hasTimezone ? normalized : `${normalized}Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

const ATTACHMENT_FIELDS = new Set([
  "anexo_cpf",
  "anexo_comprovante_endereco",
  "anexo_dados_bancarios",
  "anexo_possui_antecedente",
]);
const BOOLEAN_FIELDS = new Set(["possui_antecedente", "pix_pertence_beneficiario"]);
const LOG_FIELD_LABELS: Record<string, string> = {
  nome_completo: "Nome completo",
  cpf: "CPF",
  cep: "CEP",
  endereco: "Endereco",
  cidade: "Cidade",
  telefone: "Telefone",
  email: "Email",
  possui_antecedente: "Possui antecedente",
  status: "Status",
  banco: "Banco",
  agencia: "Agencia",
  tipo_conta: "Tipo de conta",
  numero_conta: "Numero da conta",
  pix: "Chave PIX",
  pix_pertence_beneficiario: "PIX pertence ao diarista",
  motivo_restricao: "Motivo restricao",
  anexo_cpf: "Documento CPF",
  anexo_comprovante_endereco: "Comprovante endereco",
  anexo_dados_bancarios: "Dados bancarios",
  anexo_possui_antecedente: "Comprovante antecedentes",
  motivo_alteracao: "Motivo alteracao",
};

const getCampoLabel = (campo?: string | null) =>
  (campo && LOG_FIELD_LABELS[campo]) || campo || "-";

const formatAttachmentValue = (value?: string | null) => {
  if (!value) return "-";
  const parts = value.split("/");
  return parts[parts.length - 1] || value;
};

const formatBooleanValue = (value?: string | null) => {
  if (value === "true") return "Sim";
  if (value === "false") return "Nao";
  return value ?? "-";
};

const formatLogValue = (campo?: string | null, value?: string | null) => {
  if (!campo) return value ?? "-";
  if (ATTACHMENT_FIELDS.has(campo)) return formatAttachmentValue(value);
  if (BOOLEAN_FIELDS.has(campo)) return formatBooleanValue(value);
  return value ?? "-";
};

const formatCpf = (value?: string | null) => {
  const digits = (value ?? "").replace(/\D/g, "").slice(0, 11);
  const part1 = digits.slice(0, 3);
  const part2 = digits.slice(3, 6);
  const part3 = digits.slice(6, 9);
  const part4 = digits.slice(9, 11);
  let result = part1;
  if (part2) result += `.${part2}`;
  if (part3) result += `.${part3}`;
  if (part4) result += `-${part4}`;
  return result || "";
};

const getDiaristaLabel = (log: DiaristaLogRow) => {
  const nome = (log.diaristas?.nome_completo || "").trim();
  const cpf = formatCpf(log.diaristas?.cpf);
  if (nome && cpf) return `${nome} (${cpf})`;
  if (nome) return nome;
  if (cpf) return cpf;
  return "-";
};

const DiaristasLogs = () => {
  const ALL_OPTION = "__all__";
  const PAGE_SIZE = 10;
  const initialFilters = {
    term: "",
    startDate: "",
    endDate: "",
    diaristaId: "",
    campoAlterado: "",
  };
  const [filters, setFilters] = useState(initialFilters);
  const [currentPage, setCurrentPage] = useState(1);

  const {
    data: diaristasLogs = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["diaristas-historico"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diaristas_historico")
        .select(
          `
          id,
          diarista_id,
          campo_alterado,
          valor_anterior,
          valor_novo,
          motivo,
          alterado_em,
          diaristas (
            nome_completo,
            cpf
          )
        `,
        )
        .order("alterado_em", { ascending: false });
      if (error) throw error;
      return (data || []) as DiaristaLogRow[];
    },
  });

  const campoOptions = useMemo(() => {
    const set = new Set<string>();
    diaristasLogs.forEach((log) => {
      if (log.campo_alterado) set.add(log.campo_alterado);
    });
    return Array.from(set)
      .map((campo) => ({ value: campo, label: getCampoLabel(campo) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [diaristasLogs]);

  const diaristaOptions = useMemo(() => {
    const map = new Map<string, string>();
    diaristasLogs.forEach((log) => {
      if (!log.diarista_id) return;
      map.set(log.diarista_id, getDiaristaLabel(log));
    });
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [diaristasLogs]);

  const filteredLogs = useMemo(() => {
    const term = filters.term.trim().toLowerCase();
    const startDate = filters.startDate;
    const endDate = filters.endDate;
    return diaristasLogs.filter((log) => {
      const logDate = formatLogDate(log.alterado_em);
      if (startDate && (!logDate || logDate < startDate)) return false;
      if (endDate && (!logDate || logDate > endDate)) return false;
      if (filters.diaristaId && log.diarista_id !== filters.diaristaId) return false;
      if (filters.campoAlterado && log.campo_alterado !== filters.campoAlterado) return false;
      if (!term) return true;
      const values = [
        log.diarista_id,
        log.diaristas?.nome_completo,
        log.diaristas?.cpf,
        log.campo_alterado,
        getCampoLabel(log.campo_alterado),
        formatLogValue(log.campo_alterado, log.valor_anterior),
        formatLogValue(log.campo_alterado, log.valor_novo),
        log.motivo,
      ];
      return values.some((value) => (value ?? "").toString().toLowerCase().includes(term));
    });
  }, [diaristasLogs, filters]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredLogs.slice(startIndex, startIndex + PAGE_SIZE);
  }, [currentPage, filteredLogs]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div>
          <p className="text-sm text-muted-foreground uppercase tracking-wide">Diaristas</p>
          <h1 className="text-3xl font-bold">Logs</h1>
          <p className="text-sm text-muted-foreground">
            Historico de alteracoes registradas nos diaristas.
          </p>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Historico</CardTitle>
              <CardDescription>Alteracoes registradas na tabela diaristas_historico.</CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <Input
                aria-label="Buscar logs"
                value={filters.term}
                onChange={(event) => setFilters((prev) => ({ ...prev, term: event.target.value }))}
                placeholder="Busca geral por diarista ou campo"
                className="sm:w-72"
              />
              <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
                Atualizar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setFilters(initialFilters)}
              >
                Limpar filtros
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Data inicial</span>
                <Input
                  type="date"
                  value={filters.startDate}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, startDate: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Data final</span>
                <Input
                  type="date"
                  value={filters.endDate}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, endDate: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Diarista</span>
                <Select
                  value={filters.diaristaId || ALL_OPTION}
                  onValueChange={(value) =>
                    setFilters((prev) => ({
                      ...prev,
                      diaristaId: value === ALL_OPTION ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_OPTION}>Todos</SelectItem>
                    {diaristaOptions.map((id) => (
                      <SelectItem key={id.id} value={id.id}>
                        {id.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Campo alterado</span>
                <Select
                  value={filters.campoAlterado || ALL_OPTION}
                  onValueChange={(value) =>
                    setFilters((prev) => ({
                      ...prev,
                      campoAlterado: value === ALL_OPTION ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_OPTION}>Todos</SelectItem>
                    {campoOptions.map((campo) => (
                      <SelectItem key={campo.value} value={campo.value}>
                        {campo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando logs...</p>
            ) : filteredLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum log encontrado.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Diarista</TableHead>
                      <TableHead>Campo alterado</TableHead>
                      <TableHead>Valor anterior</TableHead>
                      <TableHead>Valor novo</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{formatLogDateTime(log.alterado_em)}</TableCell>
                        <TableCell>{getDiaristaLabel(log)}</TableCell>
                        <TableCell>{getCampoLabel(log.campo_alterado)}</TableCell>
                        <TableCell className="whitespace-pre-line">
                          {formatLogValue(log.campo_alterado, log.valor_anterior)}
                        </TableCell>
                        <TableCell className="whitespace-pre-line">
                          {formatLogValue(log.campo_alterado, log.valor_novo)}
                        </TableCell>
                        <TableCell className="whitespace-pre-line">
                          {formatLogValue(null, log.motivo)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {!isLoading && filteredLogs.length > 0 && (
              <div className="mt-4 flex flex-col items-center justify-between gap-2 sm:flex-row">
                <span className="text-xs text-muted-foreground">
                  Mostrando {paginatedLogs.length} de {filteredLogs.length} logs
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    Anterior
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Pagina {currentPage} de {totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Proxima
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default DiaristasLogs;
