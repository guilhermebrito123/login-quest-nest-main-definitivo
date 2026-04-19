import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

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
import { Input } from "@/components/ui/input";
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
import { useAccessContext } from "@/hooks/useAccessContext";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  formatChamadoNumero,
  formatChamadoStatus,
  formatDateTimeBrSemTimezone,
  getChamadoStatusClass,
  matchesChamadoNumeroFilter,
} from "@/lib/chamados";
import { canOperateInternalModules } from "@/lib/internalAccess";

type ChamadoHistoricoItem = Tables<"chamado_historico"> & {
  usuario?: Pick<Tables<"usuarios">, "id" | "full_name" | "email"> | null;
  chamado?:
    | (Pick<
        Tables<"chamados">,
        "id" | "numero" | "titulo" | "status" | "local_id"
      > & {
        local?: Pick<
          Tables<"cost_center_locais">,
          "id" | "nome" | "cost_center_id"
        > | null;
      })
    | null;
};

const ALL_OPTION = "__all__";
const PAGE_SIZE = 20;
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const HISTORICO_OPERACAO_LABELS: Record<string, string> = {
  insert: "Criacao",
  update: "Atualizacao",
  delete: "Exclusao",
  comentario: "Comentario",
  anexo: "Anexo",
};

const HISTORICO_FIELD_LABELS: Record<string, string> = {
  categoria_id: "Categoria",
  created_at: "Criado em",
  data_fechamento: "Data de fechamento",
  descricao: "Descricao",
  id: "ID",
  local_id: "Local",
  numero: "Numero",
  prioridade: "Prioridade",
  resolvido_em: "Resolvido em",
  resolvido_por: "Resolvido por",
  responsavel_id: "Responsavel",
  solicitante_id: "Solicitante",
  status: "Status",
  titulo: "Titulo",
  updated_at: "Atualizado em",
};

const HISTORICO_DATE_FIELDS = new Set([
  "created_at",
  "updated_at",
  "resolvido_em",
  "data_fechamento",
]);

function formatHistoricoOperacaoLabel(operacao?: string | null) {
  if (!operacao) return "-";
  return HISTORICO_OPERACAO_LABELS[operacao] ?? operacao;
}

function formatHistoricoCampoLabel(campo?: string | null) {
  if (!campo) return "-";

  return (
    HISTORICO_FIELD_LABELS[campo] ??
    campo
      .split("_")
      .filter(Boolean)
      .join(" ")
      .replace(/^\w/, (char) => char.toUpperCase())
  );
}

function formatHistoricoFiltroData(value?: string | null) {
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
}

function formatJsonValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function buildHistoricoResumo(item: ChamadoHistoricoItem) {
  if (item.operacao === "update" && item.campo_alterado) {
    const valorAnterior = HISTORICO_DATE_FIELDS.has(item.campo_alterado)
      ? formatDateTimeBrSemTimezone(item.valor_anterior)
      : item.valor_anterior || "-";
    const valorNovo = HISTORICO_DATE_FIELDS.has(item.campo_alterado)
      ? formatDateTimeBrSemTimezone(item.valor_novo)
      : item.valor_novo || "-";

    return `${formatHistoricoCampoLabel(item.campo_alterado)}: ${valorAnterior} -> ${valorNovo}`;
  }

  if (item.operacao === "comentario") {
    const alteracoes =
      (item.alteracoes as Record<string, unknown> | null) ?? {};
    const mensagem = formatJsonValue(alteracoes.mensagem);
    const interno =
      alteracoes.interno === true
        ? "Sim"
        : alteracoes.interno === false
          ? "Nao"
          : "-";
    return `Mensagem: ${mensagem} | Interno: ${interno}`;
  }

  if (item.operacao === "anexo") {
    const alteracoes =
      (item.alteracoes as Record<string, unknown> | null) ?? {};
    const nomeArquivo = formatJsonValue(alteracoes.nome_arquivo);
    const tipoArquivo = formatJsonValue(alteracoes.tipo_arquivo);
    return `Arquivo: ${nomeArquivo} | Tipo: ${tipoArquivo}`;
  }

  if (item.campo_alterado) {
    return formatHistoricoCampoLabel(item.campo_alterado);
  }

  if (item.registro_completo) {
    return "Registro completo armazenado";
  }

  return "Sem detalhes adicionais";
}

export default function ChamadosHistorico() {
  const { accessContext, accessLoading } = useAccessContext();
  const canViewHistorico =
    accessContext.role === "perfil_interno" &&
    canOperateInternalModules(accessContext.accessLevel);
  const isAdmin = accessContext.accessLevel === "admin";
  const [filters, setFilters] = useState({
    term: "",
    numero: "",
    operacao: "",
    campo: "",
    startDate: "",
    endDate: "",
  });
  const [currentPage, setCurrentPage] = useState(1);

  const {
    data: historico = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: [
      "chamados-historico-geral",
      accessContext.userId,
      accessContext.accessLevel,
    ],
    enabled: canViewHistorico,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chamado_historico")
        .select(
          `
            id,
            chamado_id,
            created_at,
            operacao,
            campo_alterado,
            valor_anterior,
            valor_novo,
            alteracoes,
            registro_completo,
            usuario_id,
            usuario:usuarios!chamado_historico_usuario_id_fkey(id, full_name, email),
            chamado:chamados!chamado_historico_chamado_id_fkey(
              id,
              numero,
              titulo,
              status,
              local_id,
              local:cost_center_locais!chamados_local_id_fkey(id, nome, cost_center_id)
            )
          `,
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []) as ChamadoHistoricoItem[];
    },
  });

  const operacaoOptions = useMemo(() => {
    const values = new Set<string>();
    historico.forEach((item) => {
      if (item.operacao) values.add(item.operacao);
    });

    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [historico]);

  const campoOptions = useMemo(() => {
    const values = new Set<string>();
    historico.forEach((item) => {
      if (item.campo_alterado && item.campo_alterado !== "updated_at") {
        values.add(item.campo_alterado);
      }
    });

    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [historico]);

  const filteredHistorico = useMemo(() => {
    const term = filters.term.trim().toLowerCase();

    return historico.filter((item) => {
      if (item.campo_alterado === "updated_at") return false;
      if (!matchesChamadoNumeroFilter(item.chamado?.numero, filters.numero))
        return false;
      if (filters.operacao && item.operacao !== filters.operacao) return false;
      if (filters.campo && item.campo_alterado !== filters.campo) return false;

      const itemDate = formatHistoricoFiltroData(item.created_at);
      if (filters.startDate && (!itemDate || itemDate < filters.startDate))
        return false;
      if (filters.endDate && (!itemDate || itemDate > filters.endDate))
        return false;

      if (!term) return true;

      const values = [
        item.chamado?.numero ? formatChamadoNumero(item.chamado.numero) : "",
        item.chamado?.titulo,
        item.chamado?.status ? formatChamadoStatus(item.chamado.status) : "",
        item.chamado?.local?.nome,
        item.usuario?.full_name,
        item.usuario?.email,
        item.operacao,
        formatHistoricoOperacaoLabel(item.operacao),
        item.campo_alterado,
        formatHistoricoCampoLabel(item.campo_alterado),
        item.valor_anterior,
        item.valor_novo,
        buildHistoricoResumo(item),
      ];

      return values.some((value) =>
        (value ?? "").toString().toLowerCase().includes(term),
      );
    });
  }, [filters, historico]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredHistorico.length / PAGE_SIZE),
  );

  const paginatedHistorico = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredHistorico.slice(startIndex, startIndex + PAGE_SIZE);
  }, [currentPage, filteredHistorico]);

  const chamadosVisiveis = useMemo(() => {
    const ids = new Set<string>();
    filteredHistorico.forEach((item) => {
      if (item.chamado?.id) ids.add(item.chamado.id);
    });
    return ids.size;
  }, [filteredHistorico]);

  const locaisVisiveis = useMemo(() => {
    const ids = new Set<string>();
    filteredHistorico.forEach((item) => {
      if (item.chamado?.local?.id) ids.add(item.chamado.local.id);
    });
    return ids.size;
  }, [filteredHistorico]);

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
          <p className="text-sm uppercase tracking-wide text-muted-foreground">
            Chamados
          </p>
          <h1 className="text-3xl font-bold">Historico geral</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "Administradores visualizam o historico de todos os chamados."
              : "Perfis internos operacionais visualizam apenas o historico dos chamados dentro do proprio escopo de cost centers."}
          </p>
        </div>

        {!accessLoading && !canViewHistorico ? (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Acesso restrito</CardTitle>
              <CardDescription>
                Este modulo esta disponivel apenas para usuarios com role
                perfil_interno e nivel de acesso diferente de cliente_view.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardDescription>Eventos visiveis</CardDescription>
                  <CardTitle className="text-2xl">
                    {filteredHistorico.length}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardDescription>Chamados com historico</CardDescription>
                  <CardTitle className="text-2xl">{chamadosVisiveis}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardDescription>Locais alcançados</CardDescription>
                  <CardTitle className="text-2xl">{locaisVisiveis}</CardTitle>
                </CardHeader>
              </Card>
            </div>

            <Card className="shadow-lg">
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Historico de chamados</CardTitle>
                  <CardDescription>
                    Operacoes registradas em chamado_historico dentro do escopo
                    liberado pelo banco.
                  </CardDescription>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                  <Input
                    aria-label="Buscar historico de chamados"
                    value={filters.term}
                    onChange={(event) =>
                      setFilters((prev) => ({
                        ...prev,
                        term: event.target.value,
                      }))
                    }
                    placeholder="Busca por chamado, local, usuario ou detalhe"
                    className="sm:w-80"
                  />
                  <Input
                    aria-label="Filtrar historico por numero do chamado"
                    inputMode="numeric"
                    value={filters.numero}
                    onChange={(event) =>
                      setFilters((prev) => ({
                        ...prev,
                        numero: event.target.value,
                      }))
                    }
                    placeholder="Número do chamado"
                    className="sm:w-52"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => refetch()}
                  >
                    Atualizar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setFilters({
                        term: "",
                        numero: "",
                        operacao: "",
                        campo: "",
                        startDate: "",
                        endDate: "",
                      })
                    }
                  >
                    Limpar filtros
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      Data inicial
                    </span>
                    <Input
                      type="date"
                      value={filters.startDate}
                      onChange={(event) =>
                        setFilters((prev) => ({
                          ...prev,
                          startDate: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      Data final
                    </span>
                    <Input
                      type="date"
                      value={filters.endDate}
                      onChange={(event) =>
                        setFilters((prev) => ({
                          ...prev,
                          endDate: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      Operacao
                    </span>
                    <Select
                      value={filters.operacao || ALL_OPTION}
                      onValueChange={(value) =>
                        setFilters((prev) => ({
                          ...prev,
                          operacao: value === ALL_OPTION ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL_OPTION}>Todas</SelectItem>
                        {operacaoOptions.map((operacao) => (
                          <SelectItem key={operacao} value={operacao}>
                            {formatHistoricoOperacaoLabel(operacao)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      Campo
                    </span>
                    <Select
                      value={filters.campo || ALL_OPTION}
                      onValueChange={(value) =>
                        setFilters((prev) => ({
                          ...prev,
                          campo: value === ALL_OPTION ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL_OPTION}>Todos</SelectItem>
                        {campoOptions.map((campo) => (
                          <SelectItem key={campo} value={campo}>
                            {formatHistoricoCampoLabel(campo)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {isLoading || accessLoading ? (
                  <p className="text-sm text-muted-foreground">
                    Carregando historico...
                  </p>
                ) : filteredHistorico.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum evento encontrado para os filtros informados.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Chamado</TableHead>
                          <TableHead>Local</TableHead>
                          <TableHead>Operacao</TableHead>
                          <TableHead>Usuario</TableHead>
                          <TableHead>Detalhes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedHistorico.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="whitespace-nowrap">
                              {formatDateTimeBrSemTimezone(item.created_at)}
                            </TableCell>
                            <TableCell className="min-w-[220px]">
                              <div className="space-y-1">
                                <div className="font-medium">
                                  {item.chamado?.numero
                                    ? formatChamadoNumero(item.chamado.numero)
                                    : "-"}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {item.chamado?.titulo || "Chamado sem titulo"}
                                </div>
                                {item.chamado?.status && (
                                  <Badge
                                    variant="outline"
                                    className={getChamadoStatusClass(
                                      item.chamado.status,
                                    )}
                                  >
                                    {formatChamadoStatus(item.chamado.status)}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {item.chamado?.local?.nome || "-"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {formatHistoricoOperacaoLabel(item.operacao)}
                              </Badge>
                            </TableCell>
                            <TableCell className="min-w-[180px]">
                              {item.usuario?.full_name ||
                                item.usuario?.email ||
                                "Sistema"}
                            </TableCell>
                            <TableCell className="min-w-[320px] whitespace-pre-line text-sm text-muted-foreground">
                              {buildHistoricoResumo(item)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {!isLoading &&
                  !accessLoading &&
                  filteredHistorico.length > 0 && (
                    <div className="mt-4 flex flex-col items-center justify-between gap-2 sm:flex-row">
                      <span className="text-xs text-muted-foreground">
                        Mostrando {paginatedHistorico.length} de{" "}
                        {filteredHistorico.length} eventos
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setCurrentPage((prev) => Math.max(1, prev - 1))
                          }
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
                          onClick={() =>
                            setCurrentPage((prev) =>
                              Math.min(totalPages, prev + 1),
                            )
                          }
                          disabled={currentPage === totalPages}
                        >
                          Proxima
                        </Button>
                      </div>
                    </div>
                  )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
