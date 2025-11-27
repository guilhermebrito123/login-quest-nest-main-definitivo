import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, Package } from "lucide-react";
import { AtivoForm } from "@/components/recursos/AtivoForm";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Ativo = {
  id: string;
  tag_patrimonio: string | null;
  categoria: string | null;
  fabricante: string | null;
  modelo: string | null;
  status: string | null;
  critico: boolean | null;
  unidades?: { id: string; nome: string } | null;
};

export default function Ativos() {
  const [ativos, setAtivos] = useState<Ativo[]>([]);
  const [filteredAtivos, setFilteredAtivos] = useState<Ativo[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoriaFilter, setCategoriaFilter] = useState("all");
  const [fabricanteFilter, setFabricanteFilter] = useState("all");
  const [unidadeFilter, setUnidadeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [criticoFilter, setCriticoFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [ativoDetalhe, setAtivoDetalhe] = useState<Ativo | null>(null);
  const [selectedAtivo, setSelectedAtivo] = useState<Ativo | null>(null);
  const [stats, setStats] = useState<any>({});

  useEffect(() => {
    fetchAtivos();
  }, []);

  useEffect(() => {
    const filtered = ativos.filter((ativo) => {
      const matchesSearch =
        ativo.tag_patrimonio?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ativo.categoria?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ativo.fabricante?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ativo.modelo?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategoria = categoriaFilter === "all" || ativo.categoria === categoriaFilter;
      const matchesFabricante = fabricanteFilter === "all" || ativo.fabricante === fabricanteFilter;
      const matchesUnidade = unidadeFilter === "all" || ativo.unidades?.id === unidadeFilter;
      const matchesStatus = statusFilter === "all" || ativo.status === statusFilter;
      const matchesCritico =
        criticoFilter === "all" ||
        (criticoFilter === "critico" ? !!ativo.critico : !ativo.critico);

      return (
        matchesSearch &&
        matchesCategoria &&
        matchesFabricante &&
        matchesUnidade &&
        matchesStatus &&
        matchesCritico
      );
    });
    setFilteredAtivos(filtered);
  }, [searchTerm, ativos, categoriaFilter, fabricanteFilter, unidadeFilter, statusFilter, criticoFilter]);

  const fetchAtivos = async () => {
    const { data, error } = await supabase
      .from("ativos")
      .select("*, unidades(id, nome)")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar ativos");
      return;
    }

    setAtivos((data as Ativo[]) || []);
    calculateStats((data as Ativo[]) || []);
  };

  const calculateStats = (data: Ativo[]) => {
    const totalAtivos = data.length;
    const categorias = data.reduce((acc: any, ativo) => {
      const cat = ativo.categoria || "Sem categoria";
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {});

    const operacionais = data.filter((a) => a.status === "operacional").length;
    const criticos = data.filter((a) => a.critico).length;

    setStats({ totalAtivos, categorias, operacionais, criticos });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja deletar este ativo?")) return;

    const { error } = await supabase.from("ativos").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao deletar ativo");
      return;
    }
    toast.success("Ativo deletado com sucesso!");
    fetchAtivos();
  };

  const handleEdit = (ativo: Ativo) => {
    setSelectedAtivo(ativo);
    setFormOpen(true);
  };

  const handleNewAtivo = () => {
    setSelectedAtivo(null);
    setFormOpen(true);
  };

  const categoriasDisponiveis = Array.from(new Set(ativos.map((a) => a.categoria).filter(Boolean)));
  const fabricantesDisponiveis = Array.from(new Set(ativos.map((a) => a.fabricante).filter(Boolean)));
  const unidadesDisponiveis = Array.from(
    new Set(
      ativos
        .map((a) => (a.unidades ? { id: a.unidades.id, nome: a.unidades.nome } : null))
        .filter(Boolean)
        .map((u: any) => JSON.stringify(u))
    )
  ).map((str) => JSON.parse(str));
  const statusDisponiveis = Array.from(new Set(ativos.map((a) => a.status).filter(Boolean)));

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Gestão de Ativos</h1>
          <Button onClick={handleNewAtivo}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Ativo
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-col items-center justify-center space-y-1 pb-2 text-center">
              <CardTitle className="text-sm font-medium">Total de Ativos</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="text-center">
              <div className="text-2xl font-bold">{stats.totalAtivos || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col items-center justify-center space-y-1 pb-2 text-center">
              <CardTitle className="text-sm font-medium">Operacionais</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="text-center">
              <div className="text-2xl font-bold">{stats.operacionais || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col items-center justify-center space-y-1 pb-2 text-center">
              <CardTitle className="text-sm font-medium">Críticos</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="text-center">
              <div className="text-2xl font-bold">{stats.criticos || 0}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Object.entries(stats.categorias || {}).map(([categoria, count]) => (
            <Card key={categoria}>
              <CardHeader className="flex flex-col items-center justify-center space-y-1 pb-2 text-center">
                <CardTitle className="text-sm font-medium capitalize">{categoria}</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="text-center">
                <div className="text-2xl font-bold">{count as number}</div>
              </CardContent>
          </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3">
              <div className="relative w-full">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por tag, categoria, fabricante ou modelo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-2 md:gap-3 w-full">
                <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas categorias</SelectItem>
                    {categoriasDisponiveis.map((cat) => (
                      <SelectItem key={cat} value={cat as string}>
                        {cat as string}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={fabricanteFilter} onValueChange={setFabricanteFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Fabricante" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos fabricantes</SelectItem>
                    {fabricantesDisponiveis.map((fab) => (
                      <SelectItem key={fab} value={fab as string}>
                        {fab as string}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={unidadeFilter} onValueChange={setUnidadeFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Unidade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas unidades</SelectItem>
                    {unidadesDisponiveis.map((u: any) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos status</SelectItem>
                    {statusDisponiveis.map((s) => (
                      <SelectItem key={s} value={s as string}>
                        {s as string}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={criticoFilter} onValueChange={setCriticoFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Crítico" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="critico">Crítico</SelectItem>
                    <SelectItem value="nao_critico">Não crítico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto sm:overflow-x-visible">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tag Patrimônio</TableHead>
                  <TableHead className="hidden sm:table-cell">Categoria</TableHead>
                  <TableHead className="hidden sm:table-cell">Fabricante</TableHead>
                  <TableHead className="hidden sm:table-cell">Modelo</TableHead>
                  <TableHead className="hidden sm:table-cell">Unidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Crítico</TableHead>
                  <TableHead className="hidden sm:table-cell">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAtivos.map((ativo) => (
                  <TableRow
                    key={ativo.id}
                    className="cursor-pointer"
                    onClick={() => setAtivoDetalhe(ativo)}
                  >
                    <TableCell className="font-medium">{ativo.tag_patrimonio}</TableCell>
                    <TableCell className="hidden sm:table-cell">{ativo.categoria}</TableCell>
                    <TableCell className="hidden sm:table-cell">{ativo.fabricante}</TableCell>
                    <TableCell className="hidden sm:table-cell">{ativo.modelo}</TableCell>
                    <TableCell className="hidden sm:table-cell">{ativo.unidades?.nome || "-"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          ativo.status === "operacional"
                            ? "default"
                            : ativo.status === "manutencao"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {ativo.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {ativo.critico ? (
                        <Badge variant="destructive">Sim</Badge>
                      ) : (
                        <Badge variant="outline">Não</Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(ativo);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(ativo.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <AtivoForm
        open={formOpen}
        onOpenChange={setFormOpen}
        ativo={selectedAtivo}
        onSuccess={fetchAtivos}
      />

      <Dialog
        open={!!ativoDetalhe}
        onOpenChange={(open) => {
          if (!open) setAtivoDetalhe(null);
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="space-y-1">
            <DialogTitle>{ativoDetalhe?.tag_patrimonio || "Ativo"}</DialogTitle>
            <DialogDescription>Detalhes completos do ativo</DialogDescription>
          </DialogHeader>
          {ativoDetalhe && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Categoria</span>
                <span className="font-medium">{ativoDetalhe.categoria || "-"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Fabricante</span>
                <span className="font-medium">{ativoDetalhe.fabricante || "-"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Modelo</span>
                <span className="font-medium">{ativoDetalhe.modelo || "-"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Unidade</span>
                <span className="font-medium">{ativoDetalhe.unidades?.nome || "-"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Status</span>
                <span className="font-medium">{ativoDetalhe.status}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Crítico</span>
                <span className="font-medium">{ativoDetalhe.critico ? "Sim" : "Não"}</span>
              </div>
              <div className="flex gap-2 pt-2 sm:col-span-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedAtivo(ativoDetalhe);
                    setFormOpen(true);
                    setAtivoDetalhe(null);
                  }}
                >
                  Editar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    handleDelete(ativoDetalhe.id);
                    setAtivoDetalhe(null);
                  }}
                >
                  Excluir
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
