import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DashboardLayout } from "@/components/DashboardLayout";
import {
  TrendingUp,
  AlertTriangle,
  MessageSquare,
  Users,
  Star,
  MapPin,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

interface UnidadeComDados {
  id: string;
  nome: string;
  codigo: string;
  latitude: number;
  longitude: number;
  cidade: string;
  uf: string;
  contrato: {
    nome: string;
    cliente: {
      razao_social: string;
    };
    sla_alvo_pct?: number | null;
  };
  sla_atual: number;
  chamados_abertos: number;
  nps_atual: number;
  postos_vagos: number;
  total_postos: number;
  postos_preenchidos: number;
  porcentagem_ocupacao: number;
  meta_sla: number | null;
}

interface ChamadoFeed {
  id: string;
  numero: string | null;
  titulo: string | null;
  prioridade: string | null;
  status: string | null;
  data_abertura: string | null;
  unidade: {
    nome: string | null;
  } | null;
}

interface ChecklistExecucaoResumo {
  id: string;
  checklist_id: string;
  data_prevista: string;
  status: Database["public"]["Enums"]["status_execucao"];
  finalizado_em: string | null;
  checklist: {
    nome: string | null;
  } | null;
  supervisor: {
    full_name: string | null;
  } | null;
}

export default function Dashboard24h() {
  const navigate = useNavigate();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  const [unidades, setUnidades] = useState<UnidadeComDados[]>([]);
  const [chamadosFeed, setChamadosFeed] = useState<ChamadoFeed[]>([]);
  const [checklistExecucoes, setChecklistExecucoes] = useState<
    ChecklistExecucaoResumo[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Filters
  const [selectedCliente, setSelectedCliente] = useState<string>("all");
  const [selectedContrato, setSelectedContrato] = useState<string>("all");
  const [selectedUnidade, setSelectedUnidade] = useState<string>("all");
  const [selectedSeveridade, setSelectedSeveridade] = useState<string>("all");

  // Stats
  const [stats, setStats] = useState({
    sla_dia: 0,
    incidentes_critico: 0,
    incidentes_alto: 0,
    incidentes_medio: 0,
    chamados_urgente: 0,
    chamados_alto: 0,
    chamados_medio: 0,
    postos_cobertos: 0,
    postos_total: 0,
    variacao_presenca: 0,
    preventivas_prazo: 0,
    nps_7d: 0,
    nps_30d: 0,
    inspecoes_total: 0,
  });

  useEffect(() => {
    checkUserAndLoadData();
  }, []);

  useEffect(() => {
    if (unidades.length > 0) {
      initializeMap();
    }
  }, [unidades]);

  const checkUserAndLoadData = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate("/auth");
        return;
      }

      // Get user role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      setUserRole(roleData?.role || null);

      await Promise.all([
        loadUnidades(roleData?.role),
        loadStats(roleData?.role),
        loadChamadosFeed(),
        loadChecklistExecucoes(),
      ]);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const loadUnidades = async (role: string | null) => {
    try {
      let query = supabase
        .from("unidades")
        .select(
          `
          id,
          nome,
          codigo,
          latitude,
          longitude,
          cidade,
          uf,
          contrato_id,
          contratos (
            nome,
            sla_alvo_pct,
            cliente_id,
            clientes (
              razao_social
            )
          )
        `
        )
        .eq("status", "ativo")
        .not("latitude", "is", null)
        .not("longitude", "is", null);

      const { data: unidadesData, error } = await query;
      if (error) throw error;

      // Calculate data for each unit
      const unidadesComDados = await Promise.all(
        (unidadesData || []).map(async (unidade: any) => {
          const [sla, chamados, nps, postosData] = await Promise.all([
            calculateSLA(unidade.id),
            countChamadosAbertos(unidade.id),
            calculateNPS(unidade.id),
            getPostosInfo(unidade.id),
          ]);
          const postosPreenchidos = postosData.cobertos;
          const porcentagemOcupacao =
            postosData.total > 0
              ? Math.round((postosPreenchidos / postosData.total) * 100)
              : 0;

          return {
            id: unidade.id,
            nome: unidade.nome,
            codigo: unidade.codigo,
            latitude: Number(unidade.latitude),
            longitude: Number(unidade.longitude),
            cidade: unidade.cidade || "",
            uf: unidade.uf || "",
            contrato: {
              nome: unidade.contratos?.nome || "Sem contrato",
              cliente: {
                razao_social:
                  unidade.contratos?.clientes?.razao_social || "Sem cliente",
              },
            },
            sla_atual: sla,
            chamados_abertos: chamados,
            nps_atual: nps,
            postos_vagos: postosData.vagos,
            total_postos: postosData.total,
            postos_preenchidos: postosPreenchidos,
            porcentagem_ocupacao: porcentagemOcupacao,
            meta_sla: unidade.contratos?.sla_alvo_pct || null,
          };
        })
      );

      setUnidades(unidadesComDados);
    } catch (error: any) {
      console.error("Error loading unidades:", error);
      toast.error("Erro ao carregar unidades");
    }
  };

  const getPostosInfo = async (unidadeId: string) => {
    try {
      const { data: postos, error: postosError } = await supabase
        .from("postos_servico")
        .select("id, status")
        .eq("unidade_id", unidadeId);

      if (postosError) throw postosError;

      if (!postos || postos.length === 0) {
        return { total: 0, vagos: 0, cobertos: 0 };
      }

      const totalPostos = postos.length;
      const cobertos = postos.filter((posto) => posto.status === "ocupado").length;
      const vagos = totalPostos - cobertos;

      return {
        total: totalPostos,
        vagos,
        cobertos,
      };
    } catch (error) {
      console.error("Error getting postos info:", error);
      return { total: 0, vagos: 0, cobertos: 0 };
    }
  };
  const calculateSLA = async (unidadeId: string): Promise<number> => {
    const { data } = await supabase
      .from("ordens_servico")
      .select("status")
      .eq("unidade_id", unidadeId);

    if (!data || data.length === 0) return 100;

    const concluidas = data.filter((os) => os.status === "concluida").length;
    return Math.round((concluidas / data.length) * 100);
  };

  const countChamadosAbertos = async (unidadeId: string): Promise<number> => {
    const { count } = await supabase
      .from("chamados")
      .select("*", { count: "exact", head: true })
      .eq("unidade_id", unidadeId)
      .in("status", ["aberto", "em_andamento"]);

    return count || 0;
  };

  const calculateNPS = async (unidadeId: string): Promise<number> => {
    const { data } = await supabase
      .from("chamados")
      .select("avaliacao")
      .eq("unidade_id", unidadeId)
      .not("avaliacao", "is", null)
      .gte(
        "created_at",
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      );

    if (!data || data.length === 0) return 0;

    const promotores = data.filter((c) => c.avaliacao >= 9).length;
    const detratores = data.filter((c) => c.avaliacao <= 6).length;

    return Math.round(((promotores - detratores) / data.length) * 100);
  };

  const loadStats = async (role: string | null) => {
    try {
      // SLA do dia
      const { data: osHoje } = await supabase
        .from("ordens_servico")
        .select("status")
        .gte("data_abertura", new Date().toISOString().split("T")[0]);

      const slaDia =
        osHoje && osHoje.length > 0
          ? Math.round(
              (osHoje.filter((os) => os.status === "concluida").length /
                osHoje.length) *
                100
            )
          : 100;

      // Incidentes por severidade
      const { data: incidentes } = await supabase
        .from("incidentes")
        .select("severidade")
        .in("status", ["aberto", "em_investigacao"]);

      // Chamados por prioridade
      const { data: chamados } = await supabase
        .from("chamados")
        .select("prioridade")
        .in("status", ["aberto", "em_andamento"]);

      // Postos cobertos
      const { data: postos } = await supabase
        .from("postos_servico")
        .select("status");

      const totalPostos = postos?.length || 0;
      const postosCobertos = postos?.filter((posto) => posto.status === "ocupado").length || 0;
      // Preventivas no prazo
      const { data: preventivas } = await supabase
        .from("ordens_servico")
        .select("data_prevista, data_conclusao")
        .eq("tipo", "preventiva")
        .eq("status", "concluida")
        .gte(
          "created_at",
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        );

      const preventivasNoPrazo = preventivas
        ? preventivas.filter(
            (p) =>
              p.data_conclusao &&
              p.data_prevista &&
              new Date(p.data_conclusao) <= new Date(p.data_prevista)
          ).length
        : 0;

      const preventivasPrazo =
        preventivas && preventivas.length > 0
          ? Math.round((preventivasNoPrazo / preventivas.length) * 100)
          : 100;

      // NPS 7d e 30d
      const { data: avaliacoes7d } = await supabase
        .from("chamados")
        .select("avaliacao")
        .not("avaliacao", "is", null)
        .gte(
          "created_at",
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        );

      const { data: avaliacoes30d } = await supabase
        .from("chamados")
        .select("avaliacao")
        .not("avaliacao", "is", null)
        .gte(
          "created_at",
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        );

      const { count: totalInspecoes } = await supabase
        .from("inspecoes")
        .select("*", { count: "exact", head: true });

      const calcNPS = (data: any[]) => {
        if (!data || data.length === 0) return 0;
        const promotores = data.filter((c) => c.avaliacao >= 9).length;
        const detratores = data.filter((c) => c.avaliacao <= 6).length;
        return Math.round(((promotores - detratores) / data.length) * 100);
      };

      setStats({
        sla_dia: slaDia,
        incidentes_critico:
          incidentes?.filter((i) => i.severidade === "critica").length || 0,
        incidentes_alto:
          incidentes?.filter((i) => i.severidade === "alta").length || 0,
        incidentes_medio:
          incidentes?.filter((i) => i.severidade === "media").length || 0,
        chamados_urgente:
          chamados?.filter((c) => c.prioridade === "urgente").length || 0,
        chamados_alto:
          chamados?.filter((c) => c.prioridade === "alta").length || 0,
        chamados_medio:
          chamados?.filter((c) => c.prioridade === "media").length || 0,
        postos_cobertos: postosCobertos,
        postos_total: totalPostos,
        variacao_presenca: 95, // TODO: Calculate real value
        preventivas_prazo: preventivasPrazo,
        nps_7d: calcNPS(avaliacoes7d || []),
        nps_30d: calcNPS(avaliacoes30d || []),
        inspecoes_total: totalInspecoes || 0,
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const loadChecklistExecucoes = async () => {
    try {
      const { data, error } = await supabase
        .from("execucao_checklist")
        .select(
          `
          id,
          checklist_id,
          data_prevista,
          status,
          finalizado_em,
          checklist:checklist ( nome ),
          supervisor:profiles ( full_name )
        `
        )
        .order("data_prevista", { ascending: false })
        .limit(5);

      if (error) throw error;
      const filtradas =
        (data as ChecklistExecucaoResumo[] | null)?.filter(
          (exec) => exec.status !== "concluido" && exec.status !== "cancelado"
        ) || [];
      setChecklistExecucoes(filtradas);
    } catch (error) {
      console.error("Error loading checklist executions:", error);
    }
  };

  const loadChamadosFeed = async () => {
    try {
      const { data, error } = await supabase
        .from("chamados")
        .select(
          `
          id,
          numero,
          titulo,
          prioridade,
          status,
          data_abertura,
          unidade:unidades(nome)
        `
        )
        .neq("status", "concluido")
        .order("data_abertura", { ascending: false });

      if (error) throw error;
      setChamadosFeed((data as ChamadoFeed[]) || []);
    } catch (error) {
      console.error("Error loading chamados feed:", error);
    }
  };

  const initializeMap = async () => {
    if (!mapContainer.current || map.current) return;

    try {
      // Get Mapbox token from edge function
      const { data: tokenData, error: tokenError } =
        await supabase.functions.invoke("get-mapbox-token");

      if (tokenError || !tokenData?.token) {
        toast.error("Erro ao carregar token do Mapbox");
        return;
      }

      mapboxgl.accessToken = tokenData.token;

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/light-v11",
        center: [-47.9292, -15.7801], // Brasília center
        zoom: 4,
      });

      map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

      // Add markers for each unit
      unidades.forEach((unidade) => {
        if (!map.current) return;

        const el = document.createElement("div");
        el.className = "marker";
        el.style.backgroundColor = getOcupacaoColor(
          unidade.porcentagem_ocupacao
        );
        el.style.width = "24px";
        el.style.height = "24px";
        el.style.borderRadius = "50%";
        el.style.border = "3px solid white";
        el.style.cursor = "pointer";
        el.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)";

        const marker = new mapboxgl.Marker(el)
          .setLngLat([unidade.longitude, unidade.latitude])
          .addTo(map.current);

        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(
          `<div style="padding: 12px; min-width: 200px;">
            <h3 style="font-weight: bold; margin-bottom: 8px; font-size: 14px;">${
              unidade.nome
            }</h3>
            <p style="font-size: 12px; color: #666; margin-bottom: 8px;">${
              unidade.cidade
            }/${unidade.uf}</p>
            <div style="border-top: 1px solid #e5e7eb; padding-top: 8px;">
              <p style="font-size: 12px; margin-bottom: 4px;">Meta de SLA: <strong>${
                unidade.meta_sla ?? "N/A"
              }${unidade.meta_sla ? "%" : ""}</strong></p>
              <p style="font-size: 12px; margin-bottom: 4px;">Postos Preenchidos: <strong>${
                unidade.postos_preenchidos
              }/${unidade.total_postos}</strong></p>
              <p style="font-size: 12px;">Taxa de Ocupação: <strong style="color: ${
                unidade.porcentagem_ocupacao >= 90
                  ? "#22c55e"
                  : unidade.porcentagem_ocupacao >= 70
                  ? "#eab308"
                  : "#ef4444"
              };">${unidade.porcentagem_ocupacao}%</strong></p>
            </div>
          </div>`
        );

        marker.setPopup(popup);
      });
    } catch (error) {
      console.error("Error initializing map:", error);
      toast.error("Erro ao inicializar mapa");
    }
  };

  const getSLAColor = (sla: number): string => {
    if (sla >= 100) return "#22c55e";
    if (sla >= 90) return "#eab308";
    return "#ef4444";
  };

  const getOcupacaoColor = (porcentagem: number): string => {
    if (porcentagem >= 100) return "#22c55e";
    if (porcentagem >= 70) return "#eab308";
    return "#ef4444";
  };

  const getSeveridadeColor = (severidade: string): string => {
    const colors: Record<string, string> = {
      critica: "destructive",
      urgente: "destructive",
      alta: "destructive",
      media: "secondary",
      baixa: "default",
    };
    return colors[severidade] || "default";
  };

  const getChecklistStatusVariant = (
    status: Database["public"]["Enums"]["status_execucao"]
  ): "default" | "secondary" | "outline" | "destructive" => {
    if (status === "concluido") return "default";
    if (status === "atrasado") return "destructive";
    if (status === "cancelado") return "outline";
    return "secondary";
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando dashboard...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              Dashboard 24/7 Resumo Executivo
            </h1>
            <p className="text-muted-foreground">Monitoramento em tempo real</p>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString("pt-BR", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
        </div>

        {/* Incidentes e Chamados */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Incidentes por Severidade (Disponível em breve!)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Crítico</span>
                <Badge variant="destructive">{stats.incidentes_critico}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Alto</span>
                <Badge variant="destructive">{stats.incidentes_alto}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Médio</span>
                <Badge variant="secondary">{stats.incidentes_medio}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Chamados por Prioridade
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Urgente</span>
                <Badge variant="destructive">{stats.chamados_urgente}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Alta</span>
                <Badge variant="destructive">{stats.chamados_alto}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Média</span>
                <Badge variant="secondary">{stats.chamados_medio}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Map and Lists */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Chamados */}
          <Card className="h-[500px]">
            <CardHeader>
              <CardTitle>Chamados em aberto</CardTitle>
              <CardDescription>Chamados ainda não conclu�dos</CardDescription>
            </CardHeader>
            <CardContent className="h-[calc(100%-100px)] overflow-y-auto space-y-3">
              {chamadosFeed.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhum chamado pendente no momento.
                </p>
              )}
              {chamadosFeed.map((chamado) => (
                <div key={chamado.id} className="p-3 rounded-lg border bg-background space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">
                        {chamado.titulo || `Chamado ${chamado.numero ?? "-"}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {chamado.unidade?.nome ? `Unidade: ${chamado.unidade.nome}` : "Unidade n�o informada"}
                      </p>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {chamado.status}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>Prioridade: {chamado.prioridade || "-"}</span>
                    <span>
                      Aberto em:{" "}
                      {chamado.data_abertura
                        ? new Date(chamado.data_abertura).toLocaleString("pt-BR")
                        : "-"}
                    </span>
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" variant="outline" onClick={() => navigate("/chamados")}>
                      Ver detalhes
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="h-[500px]">
            <CardHeader>
              <CardTitle>Execução de Checklists</CardTitle>
              <CardDescription>
                Acompanhamento das execuções registradas
              </CardDescription>
            </CardHeader>
                        <CardContent className="h-[calc(100%-100px)] overflow-y-auto space-y-3">
              {checklistExecucoes.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhuma execução de checklist cadastrada até o momento.
                </p>
              )}
              {checklistExecucoes.map((execucao) => (
                <div key={execucao.id} className="p-3 rounded-lg border bg-background space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">
                        {execucao.checklist?.nome || `Checklist ${execucao.checklist_id ?? "-"}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {execucao.supervisor?.full_name
                          ? `Supervisor: ${execucao.supervisor.full_name}`
                          : "Supervisor nao informado"}
                      </p>
                    </div>
                    <Badge variant={getChecklistStatusVariant(execucao.status)} className="capitalize">
                      {execucao.status}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>
                      Previsto:{" "}
                      {execucao.data_prevista
                        ? new Date(execucao.data_prevista).toLocaleDateString("pt-BR")
                        : "-"}
                    </span>
                    <span>
                      Finalizado:{" "}
                      {execucao.finalizado_em
                        ? new Date(execucao.finalizado_em).toLocaleString("pt-BR")
                        : "-"}
                    </span>
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" variant="outline" onClick={() => navigate("/checklist-execucoes")}>
                      Ver detalhes
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
            <div className="px-6 pb-6">
              <Button
                className="w-full"
                variant="outline"
                onClick={() => navigate("/checklist-execucoes")}
              >
                Gerenciar execuções
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}










