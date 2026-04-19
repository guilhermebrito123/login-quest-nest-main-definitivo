import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Clock3, FolderKanban, ListChecks, TimerReset } from "lucide-react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { Tables } from "@/integrations/supabase/types";
import {
  CHAMADO_PRIORIDADE_LABELS,
  CHAMADO_PRIORIDADE_OPTIONS,
  CHAMADO_STATUS_LABELS,
  CHAMADO_STATUS_OPTIONS,
} from "@/lib/chamados";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ChamadoRow = Tables<"chamados">;
type CategoriaRow = Tables<"chamado_categorias">;
type UsuarioRow = Tables<"usuarios">;

type DashboardChamado = ChamadoRow & {
  categoria?: Pick<CategoriaRow, "id" | "nome" | "ativo"> | null;
  solicitante?: Pick<UsuarioRow, "id" | "full_name" | "email" | "role"> | null;
};

type LocalLookupItem = {
  nome: string;
  cost_center_name?: string | null;
};

type ChamadosDashboardProps = {
  chamados: DashboardChamado[];
  localLookup: Map<string, LocalLookupItem>;
  getResponsavelDisplay: (chamado: Pick<ChamadoRow, "responsavel_id">) => string;
};

const STATUS_COLORS: Record<ChamadoRow["status"], string> = {
  aberto: "hsl(205 88% 55%)",
  em_andamento: "hsl(226 70% 56%)",
  pendente: "hsl(38 92% 50%)",
  resolvido: "hsl(142 72% 42%)",
  fechado: "hsl(215 16% 47%)",
  cancelado: "hsl(0 84% 60%)",
};

const STATUS_SHORT_LABELS: Record<ChamadoRow["status"], string> = {
  aberto: "Aberto",
  em_andamento: "Andam.",
  pendente: "Pendente",
  resolvido: "Resolvido",
  fechado: "Fechado",
  cancelado: "Canc.",
};

const PRIORIDADE_COLORS: Record<ChamadoRow["prioridade"], string> = {
  baixa: "hsl(215 16% 47%)",
  media: "hsl(205 88% 55%)",
  alta: "hsl(38 92% 50%)",
  critica: "hsl(0 84% 60%)",
};

const DASHBOARD_MOTION_DURATION = 1.05;
const DASHBOARD_MOTION_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const CHART_ANIMATION_DURATION = 1400;
const CHART_ANIMATION_BEGIN = 180;

function ChartPlaceholder({ height }: { height: number }) {
  return <div style={{ height }} aria-hidden="true" />;
}

function getDateKey(value?: string | null) {
  if (!value) return null;
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function formatDateLabel(dateKey: string) {
  const [year, month, day] = dateKey.split("-");
  if (!year || !month || !day) return dateKey;
  return `${day}/${month}`;
}

function truncateLabel(value: string, maxLength = 18) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function formatDuration(hours: number | null) {
  if (hours === null || Number.isNaN(hours) || !Number.isFinite(hours)) return "-";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 24) return `${hours.toFixed(1).replace(".", ",")} h`;

  const totalHours = Math.round(hours);
  const days = Math.floor(totalHours / 24);
  const remainingHours = totalHours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

function getResolutionHours(chamado: DashboardChamado) {
  const resolvedAt = chamado.data_fechamento || chamado.resolvido_em;
  if (!resolvedAt) return null;

  const createdTime = new Date(chamado.created_at).getTime();
  const resolvedTime = new Date(resolvedAt).getTime();
  if (Number.isNaN(createdTime) || Number.isNaN(resolvedTime) || resolvedTime < createdTime) return null;

  return (resolvedTime - createdTime) / 36e5;
}

function buildTopSeries(items: Array<{ label: string; total: number }>, maxItems = 5) {
  const sorted = [...items].sort((a, b) => b.total - a.total);
  const topItems = sorted.slice(0, maxItems);
  const otherTotal = sorted.slice(maxItems).reduce((sum, item) => sum + item.total, 0);

  if (otherTotal > 0) {
    topItems.push({ label: "Outros", total: otherTotal });
  }

  return topItems.map((item, index) => ({
    ...item,
    shortLabel: truncateLabel(item.label),
    fill: `hsl(${210 + index * 9} ${Math.max(48, 78 - index * 4)}% ${Math.min(62, 44 + index * 3)}%)`,
  }));
}

function DashboardPanel({
  title,
  description,
  children,
  className = "",
}: {
  title: string;
  description: string;
  children: ReactNode | ((isInView: boolean) => ReactNode);
  className?: string;
}) {
  const shouldReduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const isInView = useInView(panelRef, { once: true, amount: 0.35 });
  const content = typeof children === "function" ? children(isInView) : children;

  return (
    <motion.div
      ref={panelRef}
      initial={shouldReduceMotion ? false : { opacity: 0.18, y: -38 }}
      whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: DASHBOARD_MOTION_DURATION, ease: DASHBOARD_MOTION_EASE }}
      className={className}
    >
      <Card className="h-full border-border/70 shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0.2, y: -22 }}
            whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{
              duration: DASHBOARD_MOTION_DURATION + 0.12,
              delay: shouldReduceMotion ? 0 : 0.08,
              ease: DASHBOARD_MOTION_EASE,
            }}
            className="h-full"
          >
            {content}
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function ChamadosDashboard({
  chamados,
  localLookup,
  getResponsavelDisplay,
}: ChamadosDashboardProps) {
  const shouldReduceMotion = useReducedMotion();
  const [isMobileChart, setIsMobileChart] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const syncMobileChart = (event?: MediaQueryListEvent) => {
      setIsMobileChart(event ? event.matches : mediaQuery.matches);
    };

    syncMobileChart();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncMobileChart);
      return () => mediaQuery.removeEventListener("change", syncMobileChart);
    }

    mediaQuery.addListener(syncMobileChart);
    return () => mediaQuery.removeListener(syncMobileChart);
  }, []);

  const dashboardData = useMemo(() => {
    const total = chamados.length;
    const statusMap = new Map<ChamadoRow["status"], number>();
    const prioridadeMap = new Map<ChamadoRow["prioridade"], number>();
    const createdMap = new Map<string, number>();
    const resolvedMap = new Map<string, number>();
    const categoriaMap = new Map<string, number>();
    const localMap = new Map<string, number>();
    const responsavelMap = new Map<string, number>();

    let openCount = 0;
    let inProgressCount = 0;
    let pendingCount = 0;
    let resolvedCount = 0;
    let resolvedWithTimeCount = 0;
    let totalResolutionHours = 0;

    chamados.forEach((chamado) => {
      statusMap.set(chamado.status, (statusMap.get(chamado.status) ?? 0) + 1);
      prioridadeMap.set(chamado.prioridade, (prioridadeMap.get(chamado.prioridade) ?? 0) + 1);

      const createdKey = getDateKey(chamado.created_at);
      if (createdKey) {
        createdMap.set(createdKey, (createdMap.get(createdKey) ?? 0) + 1);
      }

      const resolvedKey = getDateKey(chamado.data_fechamento || chamado.resolvido_em);
      if (resolvedKey) {
        resolvedMap.set(resolvedKey, (resolvedMap.get(resolvedKey) ?? 0) + 1);
      }

      const categoriaLabel = chamado.categoria?.nome || "Sem categoria";
      categoriaMap.set(categoriaLabel, (categoriaMap.get(categoriaLabel) ?? 0) + 1);

      const localLabel = localLookup.get(chamado.local_id)?.nome || "Local não encontrado";
      localMap.set(localLabel, (localMap.get(localLabel) ?? 0) + 1);

      const responsavelLabel = getResponsavelDisplay(chamado);
      responsavelMap.set(responsavelLabel, (responsavelMap.get(responsavelLabel) ?? 0) + 1);

      if (chamado.status === "aberto") openCount += 1;
      if (chamado.status === "em_andamento") inProgressCount += 1;
      if (chamado.status === "pendente") pendingCount += 1;
      if (chamado.status === "resolvido" || chamado.status === "fechado") resolvedCount += 1;

      const resolutionHours = getResolutionHours(chamado);
      if (resolutionHours !== null) {
        totalResolutionHours += resolutionHours;
        resolvedWithTimeCount += 1;
      }
    });

    const avgResolutionHours =
      resolvedWithTimeCount > 0 ? totalResolutionHours / resolvedWithTimeCount : null;

    const statusData = CHAMADO_STATUS_OPTIONS.map((status) => ({
      status,
      label: CHAMADO_STATUS_LABELS[status],
      total: statusMap.get(status) ?? 0,
      fill: STATUS_COLORS[status],
    }));

    const prioridadeData = CHAMADO_PRIORIDADE_OPTIONS.map((prioridade) => ({
      prioridade,
      label: CHAMADO_PRIORIDADE_LABELS[prioridade],
      total: prioridadeMap.get(prioridade) ?? 0,
      fill: PRIORIDADE_COLORS[prioridade],
    })).filter((item) => item.total > 0);

    const timelineKeys = Array.from(new Set([...createdMap.keys(), ...resolvedMap.keys()])).sort();
    const timelineData = timelineKeys.map((dateKey) => ({
      dateKey,
      label: formatDateLabel(dateKey),
      criados: createdMap.get(dateKey) ?? 0,
      resolvidos: resolvedMap.get(dateKey) ?? 0,
    }));

    const categoryData = buildTopSeries(
      Array.from(categoriaMap.entries()).map(([label, total]) => ({ label, total })),
    );
    const localData = buildTopSeries(
      Array.from(localMap.entries()).map(([label, total]) => ({ label, total })),
    );
    const responsavelData = buildTopSeries(
      Array.from(responsavelMap.entries())
        .filter(([label]) => label !== "-")
        .map(([label, total]) => ({ label, total })),
    );

    const resolutionRate = total > 0 ? Math.round((resolvedCount / total) * 100) : 0;

    return {
      total,
      openCount,
      inProgressCount,
      pendingCount,
      resolvedCount,
      resolutionRate,
      avgResolutionHours,
      statusData,
      prioridadeData,
      timelineData,
      categoryData,
      localData,
      responsavelData,
    };
  }, [chamados, getResponsavelDisplay, localLookup]);

  const maxResponsavelTotal = Math.max(
    ...dashboardData.responsavelData.map((item) => item.total),
    1,
  );

  const kpis = [
    {
      label: "Total filtrado",
      value: dashboardData.total.toLocaleString("pt-BR"),
      hint: "Base para todos os gráficos",
      icon: ListChecks,
      tone: "from-primary/10 to-primary/5",
    },
    {
      label: "Abertos",
      value: dashboardData.openCount.toLocaleString("pt-BR"),
      hint: "Exigem acompanhamento imediato",
      icon: AlertCircle,
      tone: "from-sky-500/12 to-sky-500/5",
    },
    {
      label: "Em andamento",
      value: dashboardData.inProgressCount.toLocaleString("pt-BR"),
      hint: "Já estão em tratamento",
      icon: Clock3,
      tone: "from-indigo-500/12 to-indigo-500/5",
    },
    {
      label: "Resolvidos/fechados",
      value: dashboardData.resolvedCount.toLocaleString("pt-BR"),
      hint: `${dashboardData.resolutionRate}% da base filtrada`,
      icon: CheckCircle2,
      tone: "from-emerald-500/12 to-emerald-500/5",
    },
    {
      label: "Tempo médio de resolução",
      value: formatDuration(dashboardData.avgResolutionHours),
      hint: "Calculado com resolvido em/data fechamento",
      icon: TimerReset,
      tone: "from-amber-500/12 to-amber-500/5",
    },
    {
      label: "Pendentes",
      value: dashboardData.pendingCount.toLocaleString("pt-BR"),
      hint: "Chamados aguardando retorno ou ação",
      icon: FolderKanban,
      tone: "from-orange-500/12 to-orange-500/5",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {kpis.map((item, index) => (
          <motion.div
            key={item.label}
            initial={shouldReduceMotion ? false : { opacity: 0.18, y: 34 }}
            whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{
              duration: DASHBOARD_MOTION_DURATION,
              delay: shouldReduceMotion ? 0 : index * 0.08,
              ease: DASHBOARD_MOTION_EASE,
            }}
          >
            <Card className={`overflow-hidden border-border/70 bg-gradient-to-br ${item.tone}`}>
              <CardContent className="flex items-start justify-between gap-4 p-5">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">{item.label}</p>
                  <div className="text-3xl font-bold tracking-tight">{item.value}</div>
                  <p className="text-xs text-muted-foreground">{item.hint}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/80 p-2.5">
                  <item.icon className="h-5 w-5 text-foreground/80" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {dashboardData.total === 0 ? (
        <DashboardPanel
          title="Sem dados para o dashboard"
          description="Ajuste os filtros do módulo para voltar a visualizar os gráficos."
        >
          <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            Nenhum chamado encontrado com os filtros atuais.
          </div>
        </DashboardPanel>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            <DashboardPanel
              title="Volume por status"
              description="Comparação direta da quantidade de chamados em cada etapa."
            >
              {(isChartVisible) =>
                isChartVisible ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={dashboardData.statusData}
                      margin={{
                        top: 16,
                        right: 12,
                        left: isMobileChart ? -12 : 0,
                        bottom: isMobileChart ? 18 : 0,
                      }}
                    >
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        interval={0}
                        height={isMobileChart ? 64 : 48}
                        tickMargin={isMobileChart ? 10 : 6}
                        angle={isMobileChart ? -18 : 0}
                        textAnchor={isMobileChart ? "end" : "middle"}
                        tick={{ fontSize: isMobileChart ? 11 : 12 }}
                        tickFormatter={(value, index) => {
                          const status = dashboardData.statusData[index]?.status;
                          if (!isMobileChart || !status) return value;
                          return STATUS_SHORT_LABELS[status];
                        }}
                      />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                      <Tooltip
                        formatter={(value: number) => [value.toLocaleString("pt-BR"), "Chamados"]}
                        labelFormatter={(label: string) => label}
                      />
                      <Bar
                        dataKey="total"
                        radius={[10, 10, 0, 0]}
                        isAnimationActive={isChartVisible}
                        animationBegin={CHART_ANIMATION_BEGIN}
                        animationDuration={CHART_ANIMATION_DURATION}
                        animationEasing="ease-out"
                      >
                        {dashboardData.statusData.map((entry) => (
                          <Cell key={entry.status} fill={entry.fill} />
                        ))}
                        <LabelList dataKey="total" position="top" className="fill-foreground text-xs" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartPlaceholder height={300} />
                )
              }
            </DashboardPanel>

            <DashboardPanel
              title="Distribuição por prioridade"
              description="Leitura rápida da proporção entre prioridades na base filtrada."
            >
              {(isChartVisible) =>
                isChartVisible ? (
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                    <motion.div
                      initial={shouldReduceMotion ? false : { opacity: 0, y: -26, rotate: -160, scale: 0.88 }}
                      animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0, rotate: 0, scale: 1 }}
                      transition={{
                        duration: CHART_ANIMATION_DURATION / 1000 + 0.15,
                        ease: DASHBOARD_MOTION_EASE,
                      }}
                    >
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Tooltip
                            formatter={(value: number) => [value.toLocaleString("pt-BR"), "Chamados"]}
                            labelFormatter={(label: string) => label}
                          />
                          <Pie
                            data={dashboardData.prioridadeData}
                            dataKey="total"
                            nameKey="label"
                            innerRadius={70}
                            outerRadius={105}
                            paddingAngle={3}
                            isAnimationActive={isChartVisible}
                            animationBegin={CHART_ANIMATION_BEGIN + 120}
                            animationDuration={CHART_ANIMATION_DURATION + 220}
                            animationEasing="ease-out"
                          >
                            {dashboardData.prioridadeData.map((entry) => (
                              <Cell key={entry.prioridade} fill={entry.fill} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </motion.div>

                    <div className="space-y-3">
                      {dashboardData.prioridadeData.map((item, index) => (
                        <motion.div
                          key={item.prioridade}
                          initial={shouldReduceMotion ? false : { opacity: 0, y: -16 }}
                          animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                          transition={{
                            duration: 0.75,
                            delay: shouldReduceMotion ? 0 : 0.14 + index * 0.06,
                            ease: DASHBOARD_MOTION_EASE,
                          }}
                          className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/70 px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.fill }} />
                            <span className="text-sm">{item.label}</span>
                          </div>
                          <span className="text-sm font-semibold">{item.total.toLocaleString("pt-BR")}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <ChartPlaceholder height={300} />
                )
              }
            </DashboardPanel>
          </div>

          <div className="grid gap-4">
            <DashboardPanel
              title="Criados x resolvidos ao longo do tempo"
              description="Tendência diária para leitura de entrada e saída de demanda."
            >
              {(isChartVisible) =>
                isChartVisible ? (
                  <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={dashboardData.timelineData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="criados"
                        name="Criados"
                        stroke="hsl(210 80% 42%)"
                        strokeWidth={3}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                        isAnimationActive={isChartVisible}
                        animationBegin={CHART_ANIMATION_BEGIN}
                        animationDuration={CHART_ANIMATION_DURATION}
                        animationEasing="ease-out"
                      />
                      <Line
                        type="monotone"
                        dataKey="resolvidos"
                        name="Resolvidos"
                        stroke="hsl(142 72% 42%)"
                        strokeWidth={3}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                        isAnimationActive={isChartVisible}
                        animationBegin={CHART_ANIMATION_BEGIN + 120}
                        animationDuration={CHART_ANIMATION_DURATION}
                        animationEasing="ease-out"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartPlaceholder height={320} />
                )
              }
            </DashboardPanel>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <DashboardPanel
              title="Top categorias"
              description="Onde o volume filtrado se concentra por categoria."
            >
              {(isChartVisible) =>
                isChartVisible ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={dashboardData.categoryData}
                      layout="vertical"
                      margin={{ top: 8, right: 20, left: 8, bottom: 0 }}
                    >
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                      <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                      <YAxis
                        type="category"
                        dataKey="shortLabel"
                        width={120}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        formatter={(value: number) => [value.toLocaleString("pt-BR"), "Chamados"]}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.label || ""}
                      />
                      <Bar
                        dataKey="total"
                        radius={[0, 10, 10, 0]}
                        isAnimationActive={isChartVisible}
                        animationBegin={CHART_ANIMATION_BEGIN}
                        animationDuration={CHART_ANIMATION_DURATION}
                        animationEasing="ease-out"
                      >
                        {dashboardData.categoryData.map((entry) => (
                          <Cell key={entry.label} fill={entry.fill} />
                        ))}
                        <LabelList dataKey="total" position="right" className="fill-foreground text-xs" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartPlaceholder height={300} />
                )
              }
            </DashboardPanel>

            <DashboardPanel
              title="Top locais"
              description="Locais com maior concentração de chamados dentro do filtro atual."
            >
              {(isChartVisible) =>
                isChartVisible ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={dashboardData.localData}
                      layout="vertical"
                      margin={{ top: 8, right: 20, left: 8, bottom: 0 }}
                    >
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                      <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                      <YAxis
                        type="category"
                        dataKey="shortLabel"
                        width={120}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        formatter={(value: number) => [value.toLocaleString("pt-BR"), "Chamados"]}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.label || ""}
                      />
                      <Bar
                        dataKey="total"
                        radius={[0, 10, 10, 0]}
                        isAnimationActive={isChartVisible}
                        animationBegin={CHART_ANIMATION_BEGIN}
                        animationDuration={CHART_ANIMATION_DURATION}
                        animationEasing="ease-out"
                      >
                        {dashboardData.localData.map((entry) => (
                          <Cell key={entry.label} fill={entry.fill} />
                        ))}
                        <LabelList dataKey="total" position="right" className="fill-foreground text-xs" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartPlaceholder height={300} />
                )
              }
            </DashboardPanel>
          </div>

          {dashboardData.responsavelData.length > 0 ? (
            <div className="grid gap-4">
              <DashboardPanel
                title="Carga por responsável"
                description="Distribuição de volume por responsável dentro do recorte atual."
              >
                {(isChartVisible) =>
                  isChartVisible ? (
                    isMobileChart ? (
                      <div className="space-y-3">
                        {dashboardData.responsavelData.map((entry, index) => (
                          <motion.div
                            key={entry.label}
                            initial={shouldReduceMotion ? false : { opacity: 0, y: -14 }}
                            animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                            transition={{
                              duration: 0.55,
                              delay: shouldReduceMotion ? 0 : index * 0.08,
                              ease: DASHBOARD_MOTION_EASE,
                            }}
                            className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <p
                                className="min-w-0 flex-1 truncate text-sm font-medium text-foreground"
                                title={entry.label}
                              >
                                {entry.label}
                              </p>
                              <div className="shrink-0 text-right">
                                <p className="text-sm font-semibold text-foreground">
                                  {entry.total.toLocaleString("pt-BR")}
                                </p>
                                <p className="text-[11px] text-muted-foreground">chamados</p>
                              </div>
                            </div>
                            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                              <motion.div
                                initial={shouldReduceMotion ? false : { width: 0, opacity: 0.75 }}
                                animate={{
                                  width: `${(entry.total / maxResponsavelTotal) * 100}%`,
                                  opacity: 1,
                                }}
                                transition={{
                                  duration: shouldReduceMotion ? 0 : 0.95,
                                  delay: shouldReduceMotion ? 0 : 0.12 + index * 0.08,
                                  ease: DASHBOARD_MOTION_EASE,
                                }}
                                className="h-full rounded-full"
                                style={{ backgroundColor: entry.fill }}
                              />
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={320}>
                        <BarChart
                          data={dashboardData.responsavelData}
                          layout="vertical"
                          margin={{ top: 8, right: 20, left: 8, bottom: 0 }}
                        >
                          <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                          <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                          <YAxis
                            type="category"
                            dataKey="shortLabel"
                            width={18}
                            tickLine={false}
                            axisLine={false}
                            tick={false}
                          />
                          <Tooltip
                            formatter={(value: number) => [value.toLocaleString("pt-BR"), "Chamados"]}
                            labelFormatter={(_, payload) => payload?.[0]?.payload?.label || ""}
                          />
                          <Bar
                            dataKey="total"
                            radius={[0, 10, 10, 0]}
                            fill="hsl(197 92% 50%)"
                            isAnimationActive={isChartVisible}
                            animationBegin={CHART_ANIMATION_BEGIN}
                            animationDuration={CHART_ANIMATION_DURATION}
                            animationEasing="ease-out"
                          >
                            {dashboardData.responsavelData.map((entry) => (
                              <Cell key={entry.label} fill={entry.fill} />
                            ))}
                            <LabelList
                              dataKey="shortLabel"
                              position="insideLeft"
                              offset={10}
                              className="fill-white text-[11px] font-medium"
                            />
                            <LabelList dataKey="total" position="right" className="fill-foreground text-xs" />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )
                  ) : (
                    <ChartPlaceholder height={320} />
                  )
                }
              </DashboardPanel>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
