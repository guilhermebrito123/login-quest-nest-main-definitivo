import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PostoServicoRow = Tables<"postos_servico">;
type CostCenter = Pick<Tables<"cost_center">, "id" | "name" | "convenia_id">;
type Cliente = Pick<Tables<"clientes">, "id" | "nome_fantasia" | "razao_social">;
type Unidade = Pick<Tables<"unidades">, "id" | "nome">;

type PostoServico = PostoServicoRow & {
  cost_center?: CostCenter | null;
  clientes?: Cliente | null;
  unidades?: Unidade | null;
};

type ColumnDef = {
  key: keyof PostoServicoRow;
  label: string;
  render?: (posto: PostoServico) => ReactNode;
};

const formatBoolean = (value: boolean | null | undefined) => {
  if (value === null || value === undefined) return "-";
  return value ? "Sim" : "Nao";
};

const formatArray = (value: unknown[] | null | undefined) => {
  if (!value || value.length === 0) return "-";
  return value.join(", ");
};

const formatDate = (value: string | null | undefined, withTime = false) => {
  if (!value) return "-";
  const date = new Date(value);
  return withTime ? date.toLocaleString("pt-BR") : date.toLocaleDateString("pt-BR");
};

const formatValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Sim" : "Nao";
  if (Array.isArray(value)) return formatArray(value);
  if (typeof value === "number") return value.toLocaleString("pt-BR");
  return String(value);
};

const formatRelationLabel = (
  name: string | null | undefined,
  id: string | number | null | undefined
) => {
  if (name && id !== null && id !== undefined) return `${name} (${id})`;
  if (name) return name;
  if (id !== null && id !== undefined) return String(id);
  return "-";
};

const columnDefs: ColumnDef[] = [
  { key: "nome", label: "Nome" },
  { key: "funcao", label: "Funcao" },
  { key: "status", label: "Status" },
  {
    key: "cliente_id",
    label: "Cliente",
    render: (posto) =>
      formatRelationLabel(
        posto.clientes?.nome_fantasia || posto.clientes?.razao_social,
        posto.cliente_id
      ),
  },
  {
    key: "cost_center_id",
    label: "Cost center",
    render: (posto) =>
      formatRelationLabel(posto.cost_center?.name, posto.cost_center_id),
  },
  {
    key: "unidade_id",
    label: "Unidade",
    render: (posto) =>
      formatRelationLabel(posto.unidades?.nome, posto.unidade_id),
  },
  { key: "escala", label: "Escala" },
  { key: "turno", label: "Turno" },
  {
    key: "dias_semana",
    label: "Dias semana",
    render: (posto) => formatArray(posto.dias_semana),
  },
  { key: "horario_inicio", label: "Horario inicio" },
  { key: "horario_fim", label: "Horario fim" },
  { key: "intervalo_refeicao", label: "Intervalo refeicao" },
  { key: "jornada", label: "Jornada" },
  {
    key: "intrajornada",
    label: "Intrajornada",
    render: (posto) => formatBoolean(posto.intrajornada),
  },
  { key: "efetivo_planejado", label: "Efetivo planejado" },
  { key: "salario", label: "Salario" },
  { key: "valor_diaria", label: "Valor diaria" },
  { key: "valor_unitario", label: "Valor unitario" },
  { key: "vr_dia", label: "VR dia" },
  { key: "vt_dia", label: "VT dia" },
  {
    key: "adicional_noturno",
    label: "Adicional noturno",
    render: (posto) => formatBoolean(posto.adicional_noturno),
  },
  {
    key: "insalubridade",
    label: "Insalubridade",
    render: (posto) => formatBoolean(posto.insalubridade),
  },
  {
    key: "adc_insalubridade_percentual",
    label: "Adc. insalubridade (%)",
  },
  {
    key: "periculosidade",
    label: "Periculosidade",
    render: (posto) => formatBoolean(posto.periculosidade),
  },
  { key: "acumulo_funcao", label: "Acumulo funcao" },
  { key: "acumulo_funcao_percentual", label: "Acumulo funcao (%)" },
  {
    key: "assistencia_medica",
    label: "Assistencia medica",
    render: (posto) => formatBoolean(posto.assistencia_medica),
  },
  {
    key: "cesta",
    label: "Cesta",
    render: (posto) => formatBoolean(posto.cesta),
  },
  {
    key: "gratificacao",
    label: "Gratificacao",
    render: (posto) => formatBoolean(posto.gratificacao),
  },
  {
    key: "premio_assiduidade",
    label: "Premio assiduidade",
    render: (posto) => formatBoolean(posto.premio_assiduidade),
  },
  {
    key: "outros_beneficios",
    label: "Outros beneficios",
    render: (posto) => formatArray(posto.outros_beneficios),
  },
  { key: "observacoes_especificas", label: "Observacoes especificas" },
  {
    key: "primeiro_dia_atividade",
    label: "Primeiro dia atividade",
    render: (posto) => formatDate(posto.primeiro_dia_atividade),
  },
  {
    key: "ultimo_dia_atividade",
    label: "Ultimo dia atividade",
    render: (posto) => formatDate(posto.ultimo_dia_atividade),
  },
  {
    key: "created_at",
    label: "Criado em",
    render: (posto) => formatDate(posto.created_at, true),
  },
  {
    key: "updated_at",
    label: "Atualizado em",
    render: (posto) => formatDate(posto.updated_at, true),
  },
  { key: "id", label: "ID" },
];

const PostosServico = () => {
  const [costCenterFilter, setCostCenterFilter] = useState("all");

  const { data: postos = [], isFetching } = useQuery({
    queryKey: ["postos-servico"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("postos_servico")
        .select("*, cost_center(id, name, convenia_id), clientes(id, nome_fantasia, razao_social), unidades(id, nome)")
        .order("nome");

      if (error) throw error;
      return (data as PostoServico[]) ?? [];
    },
  });

  const { data: costCenters = [] } = useQuery({
    queryKey: ["postos-servico-cost-centers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cost_center")
        .select("id, name, convenia_id")
        .order("name");

      if (error) throw error;
      return (data as CostCenter[]) ?? [];
    },
  });

  const filteredPostos = useMemo(() => {
    if (costCenterFilter === "all") return postos;
    return postos.filter((posto) => posto.cost_center_id === costCenterFilter);
  }, [postos, costCenterFilter]);

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Postos de Servico</h1>
          <p className="text-sm text-muted-foreground">
            Lista completa dos postos de servico cadastrados.
          </p>
        </div>

        <div className="rounded-md border bg-card">
          <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
            <div className="text-sm font-semibold">
              {filteredPostos.length} {filteredPostos.length === 1 ? "posto" : "postos"}
            </div>
            <div className="w-full md:max-w-sm">
              <Select value={costCenterFilter} onValueChange={setCostCenterFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por centro de custo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os centros de custo</SelectItem>
                  {costCenters.map((center) => (
                    <SelectItem key={center.id} value={center.id}>
                      {center.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {columnDefs.map((column) => (
                    <TableHead key={column.key} className="whitespace-nowrap">
                      {column.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPostos.length ? (
                  filteredPostos.map((posto) => (
                    <TableRow key={posto.id}>
                      {columnDefs.map((column) => {
                        const content = column.render
                          ? column.render(posto)
                          : formatValue(posto[column.key]);
                        return (
                          <TableCell key={`${posto.id}-${column.key}`} className="whitespace-nowrap">
                            {content}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columnDefs.length}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      {isFetching
                        ? "Carregando postos de servico..."
                        : "Nenhum posto de servico encontrado."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default PostosServico;
