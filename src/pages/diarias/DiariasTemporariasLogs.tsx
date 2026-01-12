import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { STATUS_LABELS, currencyFormatter } from "./utils";

type LogRow = {
  id: string;
  diaria_id: number;
  campo: string;
  operacao: string;
  valor_antigo: string | null;
  valor_novo: string | null;
  usuario_responsavel: string | null;
  operacao_em: string | null;
  criado_em?: string | null;
  usuarios?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
};

const getUsuarioNome = (log: LogRow) => {
  const usuario = log.usuarios;
  if (usuario?.full_name) return usuario.full_name;
  if (usuario?.email) return usuario.email;
  return log.usuario_responsavel || "Sistema";
};

const getLogTimestamp = (log: LogRow) => log.operacao_em ?? log.criado_em ?? null;

const LOG_FIELD_LABELS: Record<string, string> = {
  registro_criado: "Registro criado",
  id: "ID",
  valor_diaria: "Valor da diaria",
  diarista_id: "Diarista (id)",
  status: "Status",
  data_diaria: "Data da diaria",
  posto_servico_id: "Posto (id)",
  cliente_id: "Cliente (id)",
  colaborador_ausente: "Colaborador ausente (id)",
  colaborador_ausente_nome: "Colaborador ausente (nome)",
  colaborador_demitido: "Colaborador demitido (id)",
  colaborador_demitido_nome: "Colaborador demitido",
  colaborador_falecido: "Colaborador falecido",
  motivo_vago: "Motivo",
  motivo_reprovacao: "Motivo reprovacao",
  motivo_reprovacao_observacao: "Observacao reprovacao",
  motivo_cancelamento: "Motivo cancelamento",
  unidade: "Unidade",
  posto_servico: "Posto",
  observacao: "Observacao",
  horario_inicio: "Horario inicio",
  horario_fim: "Horario fim",
  intervalo: "Intervalo (min)",
  jornada_diaria: "Jornada diaria (h)",
  demissao: "Demissao",
  licenca_nojo: "Licenca nojo",
  novo_posto: "Novo posto",
  ok_pagamento: "OK pagamento",
  observacao_pagamento: "Observacao pagamento",
  outros_motivos_reprovacao_pagamento: "Outros motivos reprovacao pagamento",
  criado_por: "Criado por",
  confirmada_por: "Confirmada por",
  confirmada_em: "Confirmada em",
  aprovada_por: "Aprovada por",
  aprovada_em: "Aprovada em",
  lancada_por: "Lancada por",
  lancada_em: "Lancada em",
  aprovada_para_pagamento_em: "Aprovada para pagamento em",
  aprovado_para_pgto_por: "Aprovado para pagamento por",
  paga_por: "Paga por",
  paga_em: "Paga em",
  cancelada_por: "Cancelada por",
  cancelada_em: "Cancelada em",
  reprovada_por: "Reprovada por",
  reprovada_em: "Reprovada em",
  ok_pagamento_por: "OK pagamento por",
  ok_pagamento_em: "OK pagamento em",
};

const BOOLEAN_FIELDS = new Set(["demissao", "licenca_nojo", "novo_posto", "ok_pagamento"]);
const DATE_ONLY_FIELDS = new Set(["data_diaria"]);
const DATE_TIME_FIELDS = new Set([
  "confirmada_em",
  "aprovada_em",
  "lancada_em",
  "aprovada_para_pagamento_em",
  "paga_em",
  "cancelada_em",
  "reprovada_em",
  "ok_pagamento_em",
]);
const TIME_FIELDS = new Set(["horario_inicio", "horario_fim"]);
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const getCampoLabel = (campo?: string | null) =>
  (campo && LOG_FIELD_LABELS[campo]) || campo || "-";

const formatBooleanValue = (value?: string | null) => {
  if (value === "true") return "Sim";
  if (value === "false") return "Nao";
  return value ?? "-";
};

const formatDateOnly = (value?: string | null) => {
  if (!value) return "-";
  if (DATE_ONLY_REGEX.test(value)) {
    const [year, month, day] = value.split("-");
    if (year && month && day) return `${day}/${month}/${year}`;
  }
  const hasTimezone = /([+-]\d{2}:?\d{2}|Z)$/i.test(value);
  const normalized = hasTimezone ? value : `${value}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

const formatTimeValue = (value?: string | null) => {
  if (!value) return "-";
  const [hour = "", minute = ""] = value.split(":");
  if (!hour && !minute) return value;
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
};

const formatObservacaoPagamentoValue = (value?: string | null) => {
  if (!value) return "-";
  const trimmed = value.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) return "-";
    return inner.split(",").map((item) => item.trim()).join(", ");
  }
  return value;
};

const formatNumericValue = (value?: string | null, suffix?: string) => {
  if (value === null || value === undefined || value === "") return "-";
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return value ?? "-";
  if (!suffix) return parsed.toString();
  return `${parsed}${suffix}`;
};

const formatLogValue = (campo?: string | null, value?: string | null) => {
  if (!campo) return value ?? "-";
  if (campo === "status") return STATUS_LABELS[value || ""] || value || "-";
  if (campo === "valor_diaria") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? value ?? "-" : currencyFormatter.format(parsed);
  }
  if (BOOLEAN_FIELDS.has(campo)) return formatBooleanValue(value);
  if (DATE_ONLY_FIELDS.has(campo)) return formatDateOnly(value);
  if (DATE_TIME_FIELDS.has(campo)) return formatLogDateTime(value);
  if (TIME_FIELDS.has(campo)) return formatTimeValue(value);
  if (campo === "intervalo") return formatNumericValue(value, " min");
  if (campo === "jornada_diaria") return formatNumericValue(value, " h");
  if (campo === "observacao_pagamento") return formatObservacaoPagamentoValue(value);
  return value ?? "-";
};

const formatLogDateTime = (value?: string | null) => {
  if (!value) return "-";
  const trimmed = value.trim();
  if (!trimmed) return "-";
  if (DATE_ONLY_REGEX.test(trimmed)) return formatDateOnly(trimmed);
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

export const DiariasTemporariasLogs = () => {
  const ALL_OPTION = "__all__";
  const SYSTEM_OPTION = "__system__";
  const PAGE_SIZE = 10;
  const initialFilters = {
    term: "",
    startDate: "",
    endDate: "",
    diariaId: "",
    campoAlterado: "",
    valorAnterior: "",
    usuarioResponsavel: "",
  };
  const [filters, setFilters] = useState(initialFilters);
  const [currentPage, setCurrentPage] = useState(1);
  const {
    data: diariaLogs = [],
    isLoading: loadingLogs,
    refetch: refetchLogs,
  } = useQuery({
    queryKey: ["diarias-temporarias-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diarias_temporarias_logs")
        .select(
          `
          id,
          diaria_id,
          campo,
          operacao,
          valor_antigo,
          valor_novo,
          usuario_responsavel,
          operacao_em,
          criado_em,
          usuarios:usuarios!diarias_temporarias_logs_usuario_responsavel_fkey (
            full_name,
            email
          )
        `,
        )
        .order("operacao_em", { ascending: false });
      if (error) throw error;
      return (data || []) as LogRow[];
    },
  });

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

  const campoOptions = useMemo(() => {
    const set = new Set<string>();
    diariaLogs.forEach((log) => {
      if (log.campo) set.add(log.campo);
    });
    return Array.from(set)
      .map((campo) => ({ value: campo, label: getCampoLabel(campo) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [diariaLogs]);

  const valorAnteriorOptions = useMemo(() => {
    const set = new Set<string>();
    diariaLogs.forEach((log) => {
      if (log.valor_antigo) set.add(log.valor_antigo);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [diariaLogs]);

  const usuarioOptions = useMemo(() => {
    const map = new Map<string, string>();
    diariaLogs.forEach((log) => {
      if (log.usuario_responsavel) {
        map.set(log.usuario_responsavel, getUsuarioNome(log));
      } else {
        map.set(SYSTEM_OPTION, "Sistema");
      }
    });
    return Array.from(map.entries())
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [diariaLogs, SYSTEM_OPTION]);

  const filteredLogs = useMemo(() => {
    const term = filters.term.trim().toLowerCase();
    const diariaIdTerm = filters.diariaId.trim();
    const startDate = filters.startDate;
    const endDate = filters.endDate;

    return diariaLogs.filter((log) => {
      const logDate = formatLogDate(getLogTimestamp(log));
      if (startDate && (!logDate || logDate < startDate)) return false;
      if (endDate && (!logDate || logDate > endDate)) return false;

      if (diariaIdTerm && !log.diaria_id?.toString().includes(diariaIdTerm)) return false;
      if (filters.campoAlterado && log.campo !== filters.campoAlterado) return false;
      if (filters.valorAnterior && (log.valor_antigo ?? "") !== filters.valorAnterior) return false;
      if (filters.usuarioResponsavel) {
        if (filters.usuarioResponsavel === SYSTEM_OPTION) {
          if (log.usuario_responsavel) return false;
        } else if (log.usuario_responsavel !== filters.usuarioResponsavel) {
          return false;
        }
      }

      if (!term) return true;
      const values = [
        log.campo,
        getCampoLabel(log.campo),
        formatLogValue(log.campo, log.valor_antigo),
        formatLogValue(log.campo, log.valor_novo),
        log.usuario_responsavel,
        log.operacao,
        log.diaria_id?.toString(),
        getUsuarioNome(log),
      ];
      return values.some((value) => (value ?? "").toString().toLowerCase().includes(term));
    });
  }, [diariaLogs, filters, SYSTEM_OPTION]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredLogs.slice(startIndex, startIndex + PAGE_SIZE);
  }, [currentPage, filteredLogs]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    filters.term,
    filters.startDate,
    filters.endDate,
    filters.diariaId,
    filters.campoAlterado,
    filters.valorAnterior,
    filters.usuarioResponsavel,
  ]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <div id="diarias-temporarias-logs">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Logs de diárias</CardTitle>
            <CardDescription>Historico completo de alteracoes registradas.</CardDescription>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Input
              aria-label="Buscar logs"
              value={filters.term}
              onChange={(event) => setFilters((prev) => ({ ...prev, term: event.target.value }))}
              placeholder="Busca geral por diaria, campo ou usuario"
              className="sm:w-72"
            />
            <Button type="button" variant="outline" size="sm" onClick={() => refetchLogs()}>
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
              <span className="text-xs font-medium text-muted-foreground">Numero da diaria</span>
              <Input
                value={filters.diariaId}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, diariaId: event.target.value }))
                }
                placeholder="Ex: 1024"
              />
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
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Valor antigo</span>
              <Select
                value={filters.valorAnterior || ALL_OPTION}
                onValueChange={(value) =>
                  setFilters((prev) => ({
                    ...prev,
                    valorAnterior: value === ALL_OPTION ? "" : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_OPTION}>Todos</SelectItem>
                  {valorAnteriorOptions.map((valor) => (
                    <SelectItem key={valor} value={valor}>
                      {valor}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Responsavel</span>
              <Select
                value={filters.usuarioResponsavel || ALL_OPTION}
                onValueChange={(value) =>
                  setFilters((prev) => ({
                    ...prev,
                    usuarioResponsavel: value === ALL_OPTION ? "" : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_OPTION}>Todos</SelectItem>
                  {usuarioOptions.map((usuario) => (
                    <SelectItem key={usuario.id} value={usuario.id}>
                      {usuario.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {loadingLogs ? (
            <p className="text-sm text-muted-foreground">Carregando logs...</p>
          ) : filteredLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum log encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Diaria</TableHead>
                    <TableHead>Campo alterado</TableHead>
                    <TableHead>Valor antigo</TableHead>
                    <TableHead>Valor novo</TableHead>
                    <TableHead>Responsavel</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {paginatedLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{formatLogDateTime(getLogTimestamp(log))}</TableCell>
                    <TableCell>{log.diaria_id}</TableCell>
                      <TableCell>{getCampoLabel(log.campo)}</TableCell>
                      <TableCell className="whitespace-pre-line">
                        {formatLogValue(log.campo, log.valor_antigo)}
                      </TableCell>
                      <TableCell className="whitespace-pre-line">
                        {formatLogValue(log.campo, log.valor_novo)}
                      </TableCell>
                      <TableCell>{getUsuarioNome(log)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {!loadingLogs && filteredLogs.length > 0 && (
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
  );
};
