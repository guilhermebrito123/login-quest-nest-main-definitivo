import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ItemEstoqueForm } from "@/components/recursos/ItemEstoqueForm";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, Edit, Trash2, Package, AlertTriangle, CheckCircle2 } from "lucide-react";

const Estoque = () => {
  const [itens, setItens] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [stats, setStats] = useState({ total: 0, abaixoMinimo: 0, quantidadeTotal: 0 });

  useEffect(() => {
    fetchItens();
  }, []);

  const fetchItens = async () => {
    const { data, error } = await supabase
      .from("itens_estoque")
      .select("*, unidades(nome)")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar itens");
      return;
    }

    setItens(data || []);
    calculateStats(data || []);
  };

  const calculateStats = (data: any[]) => {
    const total = data.length;
    const abaixoMinimo = data.filter((item) => item.quantidade_atual < item.quantidade_minima).length;
    const quantidadeTotal = data.reduce((acc, item) => acc + (item.quantidade_atual || 0), 0);
    setStats({ total, abaixoMinimo, quantidadeTotal });
  };

  const filteredItens = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return itens.filter(
      (item) =>
        item.sku?.toLowerCase().includes(term) ||
        item.nome?.toLowerCase().includes(term) ||
        item.descricao?.toLowerCase().includes(term)
    );
  }, [itens, searchTerm]);

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja deletar este item?")) return;
    const { error } = await supabase.from("itens_estoque").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao deletar item");
      return;
    }
    toast.success("Item deletado com sucesso!");
    fetchItens();
  };

  const handleEdit = (item: any) => {
    setSelectedItem(item);
    setFormOpen(true);
  };

  const handleNew = () => {
    setSelectedItem(null);
    setFormOpen(true);
  };

  const isAbaixoMinimo = (item: any) => item.quantidade_atual < item.quantidade_minima;

  const getIndicatorConfig = (item: any) => {
    if (item.quantidade_atual < item.quantidade_minima) {
      return {
        borderClass: "border-red-500",
        textClass: "text-red-600",
        label: "Abaixo do mínimo",
        Icon: AlertTriangle,
      };
    }

    if (item.quantidade_atual === item.quantidade_minima) {
      return {
        borderClass: "border-amber-400",
        textClass: "text-amber-500",
        label: "No limite",
        Icon: AlertTriangle,
      };
    }

    return {
      borderClass: "border-emerald-500",
      textClass: "text-emerald-600",
      label: "Estoque saudável",
      Icon: CheckCircle2,
    };
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Estoque</h1>
            <p className="text-muted-foreground">Controle de materiais e insumos.</p>
          </div>
          <Button onClick={handleNew}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Item
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de itens</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="text-center">
              <div className="text-lg font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Abaixo do mínimo</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="text-center">
              <div className="text-lg font-bold">{stats.abaixoMinimo}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Quantidade total</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="text-center">
              <div className="text-lg font-bold">{stats.quantidadeTotal}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por SKU, nome ou descricao..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {filteredItens.map((item) => {
                const config = getIndicatorConfig(item);
                return (
                  <Card
                    key={`indicator-${item.id}`}
                    className={`border-2 ${config.borderClass} bg-transparent`}
                  >
                    <CardContent className="py-4 flex flex-col items-center text-center space-y-2">
                      <config.Icon className={`h-6 w-6 ${config.textClass}`} />
                      <div>
                        <p className="text-sm font-semibold">{item.nome}</p>
                        <p className={`text-xs ${config.textClass}`}>{config.label}</p>
                      </div>
                      <div className="text-lg font-bold">
                        {item.quantidade_atual}{" "}
                        <span className="text-sm font-normal text-muted-foreground">
                          / {item.quantidade_minima}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {filteredItens.length === 0 && (
                <div className="col-span-full text-center text-sm text-muted-foreground">
                  Nenhum item para exibir nos indicadores.
                </div>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descricao</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Un. Medida</TableHead>
                  <TableHead>Qtd. Minima</TableHead>
                  <TableHead>Qtd. Atual</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItens.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.sku}</TableCell>
                    <TableCell>{item.nome}</TableCell>
                    <TableCell>{item.descricao}</TableCell>
                    <TableCell>{item.unidades?.nome || "-"}</TableCell>
                    <TableCell>{item.unidade_medida}</TableCell>
                    <TableCell>{item.quantidade_minima}</TableCell>
                    <TableCell>{item.quantidade_atual}</TableCell>
                    <TableCell>
                      {isAbaixoMinimo(item) ? (
                        <Badge variant="destructive">Abaixo do minimo</Badge>
                      ) : (
                        <Badge>Normal</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredItens.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-sm text-muted-foreground">
                      Nenhum item encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <ItemEstoqueForm
        open={formOpen}
        onOpenChange={setFormOpen}
        item={selectedItem}
        onSuccess={fetchItens}
      />
    </DashboardLayout>
  );
};

export default Estoque;
