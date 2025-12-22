import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { DashboardLayout } from "@/components/DashboardLayout";
import { 
  Building2, 
  Plus, 
  Search, 
  ArrowLeft,
  FileText,
  AlertCircle,
  TrendingUp,
  Users,
  ClipboardCheck,
  CalendarCheck
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import ClienteForm from "@/components/contratos/ClienteForm";
import ContratoForm from "@/components/contratos/ContratoForm";
import UnidadeForm from "@/components/contratos/UnidadeForm";
import PostoForm from "@/components/contratos/PostoForm";
import ClienteCard from "@/components/contratos/ClienteCard";
import ContratoCard from "@/components/contratos/ContratoCard";
import UnidadeCard from "@/components/contratos/UnidadeCard";
import PostoCard from "@/components/contratos/PostoCard";
import { getEfetivoPlanejadoAjustado } from "@/lib/postos";

interface Cliente {
  id: string; // armazenamos como string no frontend; no DB é numérico
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string;
  contato_nome: string | null;
  contato_email: string | null;
  contato_telefone: string | null;
  itens_adicionais: string | null;
}

interface Contrato {
  id: string; // armazenamos como string no frontend; no DB é numérico/UUID
  cliente_id: string;
  negocio: string;
  data_inicio: string;
  data_fim: string | null;
  conq_perd: number;
}

interface Unidade {
  id: string;
  contrato_id: string;
  nome: string;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  faturamento_vendido: number;
}

interface Posto {
  id: string;
  unidade_id: string;
  cliente_id?: string;
  nome: string;
  funcao: string;
  status: string;
  escala?: string | null;
  turno?: string | null;
  horario_inicio?: string | null;
  horario_fim?: string | null;
  jornada?: number | null;
  de?: string | null;
  ate?: string | null;
  observacoes_especificas?: string | null;
}

const Contratos = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("clientes");
  const [filterUnidadeId, setFilterUnidadeId] = useState<string>("all");
  const [filterOcupacao, setFilterOcupacao] = useState<string>("all");
  const [colaboradoresPorPosto, setColaboradoresPorPosto] = useState<Record<string, number>>({});
  const [ordensAbertas, setOrdensAbertas] = useState(0);
  const [slaMedio, setSlaMedio] = useState(0);
  const [npsMedio, setNpsMedio] = useState(0);
  const [totalChecklists, setTotalChecklists] = useState(0);
  const [totalInspecoes, setTotalInspecoes] = useState(0);
  
  // State for entities
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [postos, setPostos] = useState<Posto[]>([]);
  
  // State for forms
  const [showClienteForm, setShowClienteForm] = useState(false);
  const [showContratoForm, setShowContratoForm] = useState(false);
  const [showUnidadeForm, setShowUnidadeForm] = useState(false);
  const [showPostoForm, setShowPostoForm] = useState(false);
  
  // State for editing entities
  const [editingClienteId, setEditingClienteId] = useState<string | undefined>(undefined);
  const [editingContratoId, setEditingContratoId] = useState<string | undefined>(undefined);
  const [editingUnidadeId, setEditingUnidadeId] = useState<string | undefined>(undefined);
  const [editingPostoId, setEditingPostoId] = useState<string | undefined>(undefined);
  
  // Selected entities for hierarchy
  const [selectedCliente, setSelectedCliente] = useState<string | null>(null);
  const [selectedContrato, setSelectedContrato] = useState<string | null>(null);
  const [selectedUnidade, setSelectedUnidade] = useState<string | null>(null);

  const getClienteDisplayName = (clienteId: string | null) => {
    if (!clienteId) return "";
    const cliente = clientes.find((c) => c.id === clienteId);
    return cliente ? cliente.nome_fantasia || cliente.razao_social : "";
  };

  useEffect(() => {
    checkAuth();
    loadData();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadClientes(),
        loadContratos(),
        loadUnidades(),
        loadPostos(),
        loadOrdensServico(),
        loadIndicadoresChamados(),
        loadChecklistsCount(),
        loadInspecoesCount()
      ]);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadClientes = async () => {
    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .order("razao_social");
    
    if (error) throw error;
    const mapped = (data || []).map((c: any) => ({
      ...c,
      id: c.id?.toString?.() ?? "",
    }));
    setClientes(mapped);
  };

  const loadContratos = async () => {
    const { data, error } = await supabase
      .from("contratos")
      .select("*")
      .order("negocio");
    
    if (error) throw error;
    const mapped = (data || []).map((c: any) => ({
      ...c,
      id: c.id?.toString?.() ?? "",
      cliente_id: c.cliente_id?.toString?.() ?? "",
    }));
    setContratos(mapped);
  };

  const loadUnidades = async () => {
    const { data, error } = await supabase
      .from("unidades")
      .select("*")
      .order("nome");
    
    if (error) throw error;
    setUnidades(data || []);
  };

  const loadPostos = async () => {
    const { data, error } = await supabase
      .from("postos_servico")
      .select("*")
      .order("nome");
    
    if (error) throw error;
    const mapped = (data || []).map((p: any) => ({
      ...p,
      id: p.id?.toString?.() ?? "",
      unidade_id: p.unidade_id?.toString?.() ?? "",
      cliente_id: p.cliente_id?.toString?.() ?? "",
    }));
    setPostos(mapped);
    
    // Load colaboradores count for each posto
    if (data) {
      const postoIds = data.map(p => p.id);
      const { data: colaboradoresData } = await supabase
        .from("colaboradores")
        .select("posto_servico_id")
        .in("posto_servico_id", postoIds);
      
      if (colaboradoresData) {
        const countMap: Record<string, number> = {};
        colaboradoresData.forEach(col => {
          if (col.posto_servico_id) {
            countMap[col.posto_servico_id] = (countMap[col.posto_servico_id] || 0) + 1;
          }
        });
        setColaboradoresPorPosto(countMap);
      }
    }
  };

  const loadOrdensServico = async () => {
    const { count, error } = await supabase
      .from("ordens_servico")
      .select("id", { count: "exact", head: true })
      .eq("status", "aberta");

    if (error) throw error;
    setOrdensAbertas(count || 0);
  };

  const loadIndicadoresChamados = async () => {
    const { data, error } = await supabase
      .from("chamados")
      .select("sla_horas, avaliacao")
      .eq("status", "concluido")
      .not("avaliacao", "is", null);

    if (error) throw error;

    if (data && data.length > 0) {
      const slaValores = data
        .map((c) => c.sla_horas)
        .filter((valor): valor is number => typeof valor === "number");
      const avaliacaoValores = data
        .map((c) => c.avaliacao)
        .filter((valor): valor is number => typeof valor === "number");

      if (slaValores.length > 0) {
        const somaSla = slaValores.reduce((acc, curr) => acc + curr, 0);
        setSlaMedio(Math.round((somaSla / slaValores.length) * 100) / 100);
      }

      if (avaliacaoValores.length > 0) {
        const somaNps = avaliacaoValores.reduce((acc, curr) => acc + curr, 0);
        setNpsMedio(Math.round((somaNps / avaliacaoValores.length) * 10) / 10);
      }
    } else {
      setSlaMedio(0);
      setNpsMedio(0);
    }
  };

  const loadChecklistsCount = async () => {
    const { count, error } = await supabase
      .from("checklist")
      .select("id", { count: "exact", head: true });

    if (error) throw error;
    setTotalChecklists(count || 0);
  };

  const loadInspecoesCount = async () => {
    const { count, error } = await supabase
      .from("inspecoes")
      .select("id", { count: "exact", head: true });

    if (error) throw error;
    setTotalInspecoes(count || 0);
  };

  const filteredClientes = clientes.filter(c => {
    const termo = searchTerm.toLowerCase();
    return (
      c.razao_social.toLowerCase().includes(termo) ||
      (c.nome_fantasia ? c.nome_fantasia.toLowerCase().includes(termo) : false) ||
      c.cnpj.includes(searchTerm)
    );
  });

  const contratoMatchesSearch = (contrato: Contrato) => {
    const termo = searchTerm.toLowerCase();
    const cliente = clientes.find((c) => c.id === contrato.cliente_id);
    const nomeFantasia = cliente?.nome_fantasia?.toLowerCase() ?? "";
    const razaoSocial = cliente?.razao_social?.toLowerCase() ?? "";

    return (
      contrato.negocio.toLowerCase().includes(termo) ||
      String(contrato.conq_perd).includes(searchTerm) ||
      nomeFantasia.includes(termo) ||
      razaoSocial.includes(termo)
    );
  };

  const filteredContratos = contratos.filter((contrato) => {
    const matchesSelectedCliente = selectedCliente ? contrato.cliente_id === selectedCliente : true;
    const matchesSearch = contratoMatchesSearch(contrato);
    return matchesSelectedCliente && matchesSearch;
  });

  const filteredUnidades = selectedContrato
    ? unidades.filter(u => u.contrato_id === selectedContrato)
    : unidades.filter(u => 
        u.nome.toLowerCase().includes(searchTerm.toLowerCase())
      );

  const filteredPostos = selectedUnidade
    ? postos.filter(p => {
        const matchesUnidade = p.unidade_id === selectedUnidade;
        const matchesSearch = p.nome.toLowerCase().includes(searchTerm.toLowerCase());
        
        if (filterOcupacao === "all") return matchesUnidade && matchesSearch;
        
        const totalColaboradores = colaboradoresPorPosto[p.id] || 0;
        const efetivoNecessario = getEfetivoPlanejadoAjustado(p);
        const isOcupado = totalColaboradores >= efetivoNecessario;
        const matchesOcupacao = filterOcupacao === "ocupado" ? isOcupado : !isOcupado;
        
        return matchesUnidade && matchesSearch && matchesOcupacao;
      })
    : postos.filter(p => {
        const matchesSearch = p.nome.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesUnidade = filterUnidadeId === "all" || p.unidade_id === filterUnidadeId;
        
        if (filterOcupacao === "all") return matchesSearch && matchesUnidade;
        
        const totalColaboradores = colaboradoresPorPosto[p.id] || 0;
        const efetivoNecessario = getEfetivoPlanejadoAjustado(p);
        const isOcupado = totalColaboradores >= efetivoNecessario;
        const matchesOcupacao = filterOcupacao === "ocupado" ? isOcupado : !isOcupado;
        
        return matchesSearch && matchesUnidade && matchesOcupacao;
      });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-start">
            <div className="p-2 bg-gradient-to-br from-primary to-accent rounded-lg">
              <Building2 className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Gestão de Contratos</h1>
              <p className="text-sm text-muted-foreground">
                Hierarquia: Cliente → Contrato → Unidade → Posto
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Metrics Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3 text-center flex flex-col items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Clientes</CardTitle>
              <p className="text-2xl font-bold">{clientes.length}</p>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3 text-center flex flex-col items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-emerald-600" />
              <CardTitle className="text-sm font-medium text-muted-foreground">Checklists Ativos</CardTitle>
              <p className="text-2xl font-bold text-emerald-600">{totalChecklists}</p>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3 text-center flex flex-col items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-indigo-600" />
              <CardTitle className="text-sm font-medium text-muted-foreground">Inspeções Registradas</CardTitle>
              <p className="text-2xl font-bold text-indigo-600">{totalInspecoes}</p>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3 text-center flex flex-col items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-sm font-medium text-muted-foreground">Chamados: NPS Médio Geral</CardTitle>
              <p className="text-2xl font-bold text-blue-600">
                {npsMedio > 0 ? npsMedio.toFixed(1) : "0"}
              </p>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3 text-center flex flex-col items-center gap-2">
              <FileText className="h-5 w-5 text-orange-600" />
              <CardTitle className="text-sm font-medium text-muted-foreground">OS Abertas</CardTitle>
              <p className="text-2xl font-bold text-orange-600">{ordensAbertas}</p>
            </CardHeader>
          </Card>
        </div>

        {/* Breadcrumb Navigation */}
        {(selectedCliente || selectedContrato || selectedUnidade) && (
          <div className="mb-4 flex items-center gap-2 text-sm">
            <Button
              variant="link"
              size="sm"
              onClick={() => {
                setSelectedCliente(null);
                setSelectedContrato(null);
                setSelectedUnidade(null);
                setActiveTab("clientes");
              }}
            >
              Clientes
            </Button>
            {selectedCliente && (
              <>
                <span>/</span>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => {
                    setSelectedContrato(null);
                    setSelectedUnidade(null);
                    setActiveTab("contratos");
                  }}
                >
                  {getClienteDisplayName(selectedCliente)}
                </Button>
              </>
            )}
            {selectedContrato && (
              <>
                <span>/</span>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => {
                    setSelectedUnidade(null);
                    setActiveTab("unidades");
                  }}
                >
                  {contratos.find(c => c.id === selectedContrato)?.negocio}
                </Button>
              </>
            )}
            {selectedUnidade && (
              <>
                <span>/</span>
                <span className="text-muted-foreground">
                  {unidades.find(u => u.id === selectedUnidade)?.nome}
                </span>
              </>
            )}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="clientes">Clientes</TabsTrigger>
            <TabsTrigger value="contratos">Contratos</TabsTrigger>
            <TabsTrigger value="unidades">Unidades</TabsTrigger>
            <TabsTrigger value="postos">Postos</TabsTrigger>
          </TabsList>

          {/* Clientes Tab */}
          <TabsContent value="clientes" className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative flex-1 w-full md:max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button className="w-full md:w-auto" onClick={() => setShowClienteForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Cliente
              </Button>
            </div>

            {showClienteForm && (
              <ClienteForm
                clienteId={editingClienteId}
                onClose={() => {
                  setShowClienteForm(false);
                  setEditingClienteId(undefined);
                }}
                onSuccess={() => {
                  loadClientes();
                  setShowClienteForm(false);
                  setEditingClienteId(undefined);
                }}
              />
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredClientes.map((cliente) => (
                <ClienteCard
                  key={cliente.id}
                  cliente={cliente}
                  onSelect={() => {
                    setSelectedCliente(cliente.id);
                    setActiveTab("contratos");
                  }}
                  onEdit={() => {
                    setEditingClienteId(cliente.id);
                    setShowClienteForm(true);
                  }}
                  onDelete={() => loadClientes()}
                />
              ))}
            </div>

            {filteredClientes.length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhum cliente encontrado</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Contratos Tab */}
          <TabsContent value="contratos" className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative flex-1 w-full md:max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar contrato..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button className="w-full md:w-auto" onClick={() => setShowContratoForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Contrato
              </Button>
            </div>

            {showContratoForm && (
              <ContratoForm
                contratoId={editingContratoId}
                clienteId={selectedCliente || undefined}
                onClose={() => {
                  setShowContratoForm(false);
                  setEditingContratoId(undefined);
                }}
                onSuccess={() => {
                  loadContratos();
                  setShowContratoForm(false);
                  setEditingContratoId(undefined);
                }}
              />
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredContratos.map((contrato) => (
                <ContratoCard
                  key={contrato.id}
                  contrato={contrato}
                  cliente={clientes.find(c => c.id === contrato.cliente_id)}
                  onSelect={() => {
                    setSelectedContrato(contrato.id);
                    setActiveTab("unidades");
                  }}
                  onEdit={() => {
                    setEditingContratoId(contrato.id);
                    setShowContratoForm(true);
                  }}
                  onDelete={() => loadContratos()}
                />
              ))}
            </div>

            {filteredContratos.length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhum contrato encontrado</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Unidades Tab */}
          <TabsContent value="unidades" className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative flex-1 w-full md:max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar unidade..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button className="w-full md:w-auto" onClick={() => setShowUnidadeForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Unidade
              </Button>
            </div>

            {showUnidadeForm && (
              <UnidadeForm
                unidadeId={editingUnidadeId}
                contratoId={selectedContrato || undefined}
                onClose={() => {
                  setShowUnidadeForm(false);
                  setEditingUnidadeId(undefined);
                }}
                onSuccess={() => {
                  loadUnidades();
                  setShowUnidadeForm(false);
                  setEditingUnidadeId(undefined);
                }}
              />
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredUnidades.map((unidade) => (
                <UnidadeCard
                  key={unidade.id}
                  unidade={unidade}
                  contrato={contratos.find(c => c.id === unidade.contrato_id)}
                  onSelect={() => {
                    setSelectedUnidade(unidade.id);
                    setActiveTab("postos");
                  }}
                  onEdit={() => {
                    setEditingUnidadeId(unidade.id);
                    setShowUnidadeForm(true);
                  }}
                  onDelete={() => loadUnidades()}
                />
              ))}
            </div>

            {filteredUnidades.length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhuma unidade encontrada</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Postos Tab */}
          <TabsContent value="postos" className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-2 flex-1">
                <div className="relative flex-1 w-full lg:max-w-sm">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar posto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                {!selectedUnidade && (
                  <Select value={filterUnidadeId} onValueChange={setFilterUnidadeId}>
                    <SelectTrigger className="w-full lg:w-[250px]">
                      <SelectValue placeholder="Filtrar por unidade" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      <SelectItem value="all">Todas as unidades</SelectItem>
                      {unidades.map((unidade) => (
                        <SelectItem key={unidade.id} value={unidade.id}>
                          {unidade.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Select value={filterOcupacao} onValueChange={setFilterOcupacao}>
                  <SelectTrigger className="w-full lg:w-[200px]">
                    <SelectValue placeholder="Filtrar por ocupação" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="all">Todos os postos</SelectItem>
                    <SelectItem value="ocupado">Ocupados</SelectItem>
                    <SelectItem value="vago">Vagos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full lg:w-auto" onClick={() => setShowPostoForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Posto
              </Button>
            </div>

            {showPostoForm && (
              <PostoForm
                postoId={editingPostoId}
                unidadeId={selectedUnidade || undefined}
                onClose={() => {
                  setShowPostoForm(false);
                  setEditingPostoId(undefined);
                }}
                onSuccess={() => {
                  loadPostos();
                  setShowPostoForm(false);
                  setEditingPostoId(undefined);
                }}
              />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPostos.map((posto) => (
                <PostoCard
                  key={posto.id}
                  posto={posto}
                  unidade={unidades.find(u => u.id === posto.unidade_id)}
                  onEdit={() => {
                    setEditingPostoId(posto.id);
                    setShowPostoForm(true);
                  }}
                  onDelete={() => loadPostos()}
                />
              ))}
            </div>

            {filteredPostos.length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhum posto encontrado</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
    </DashboardLayout>
  );
};

export default Contratos;

