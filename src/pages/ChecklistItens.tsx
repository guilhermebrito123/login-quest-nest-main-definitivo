import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Edit, Plus, RefreshCw, Trash2 } from "lucide-react";

type Periodicidade = Database["public"]["Enums"]["periodicidade_type"];
type ChecklistItemRow = Database["public"]["Tables"]["checklist_item"]["Row"];
type ChecklistItemInsert = Database["public"]["Tables"]["checklist_item"]["Insert"];
type ChecklistSummary = Pick<Database["public"]["Tables"]["checklist"]["Row"], "id" | "nome" | "periodicidade">;
type AtivoSummary = Pick<Database["public"]["Tables"]["ativos"]["Row"], "id" | "tag_patrimonio" | "modelo">;

type ChecklistItemWithRelations = ChecklistItemRow & {
  checklist?: ChecklistSummary | null;
  ativo?: AtivoSummary | null;
};

interface ChecklistItemForm {
  checklist_id: string;
  descricao: string;
  periodicidade: Periodicidade;
  ordem: number;
  ativo_id: string;
}

const periodicidadeOptions: { value: Periodicidade; label: string }[] = [
  { value: "diaria", label: "Diária" },
  { value: "semanal", label: "Semanal" },
  { value: "quinzenal", label: "Quinzenal" },
  { value: "mensal", label: "Mensal" },
  { value: "trimestral", label: "Trimestral" },
  { value: "semestral", label: "Semestral" },
  { value: "anual", label: "Anual" },
];

const ChecklistItens = () => {
  const [items, setItems] = useState<ChecklistItemWithRelations[]>([]);
  const [checklists, setChecklists] = useState<ChecklistSummary[]>([]);
  const [ativos, setAtivos] = useState<AtivoSummary[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [checklistFilter, setChecklistFilter] = useState("all");
  const [formData, setFormData] = useState<ChecklistItemForm>({
    checklist_id: "",
    descricao: "",
    periodicidade: "mensal",
    ordem: 0,
    ativo_id: "",
  });

  useEffect(() => {
    loadInitial();
  }, []);

  const loadInitial = async () => {
    try {
      await Promise.all([loadItems(), loadChecklists(), loadAtivos()]);
    } catch (error) {
      console.error("Erro ao carregar itens de checklist:", error);
      toast.error("Não foi possível carregar os itens de checklist.");
    } finally {
      setLoading(false);
    }
  };

  const loadChecklists = async () => {
    const { data } = await supabase.from("checklist").select("id, nome, periodicidade");
    setChecklists((data as ChecklistSummary[]) ?? []);
  };

  const loadAtivos = async () => {
    const { data } = await supabase.from("ativos").select("id, tag_patrimonio, modelo");
    setAtivos((data as AtivoSummary[]) ?? []);
  };

  const loadItems = async () => {
    const { data, error } = await supabase
      .from("checklist_item")
      .select(
        `
        *,
        checklist:checklist ( id, nome, periodicidade ),
        ativo:ativos ( id, tag_patrimonio, modelo )
      `
      )
      .order("checklist_id", { ascending: true })
      .order("ordem", { ascending: true });

    if (error) throw error;
    setItems((data as ChecklistItemWithRelations[]) ?? []);
  };

  const resetForm = () => {
    setFormData({
      checklist_id: "",
      descricao: "",
      periodicidade: "mensal",
      ordem: 0,
      ativo_id: "",
    });
    setEditingId(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.checklist_id) {
      toast.error("Selecione um checklist.");
      return;
    }

    const payload: ChecklistItemInsert = {
      checklist_id: formData.checklist_id,
      descricao: formData.descricao,
      periodicidade: formData.periodicidade,
      ordem: formData.ordem ?? 0,
      ativo_id: formData.ativo_id || null,
    };

    try {
      setSaving(true);
      if (editingId) {
        const { error } = await supabase.from("checklist_item").update(payload).eq("id", editingId);
        if (error) throw error;
        toast.success("Item atualizado.");
      } else {
        const { error } = await supabase.from("checklist_item").insert(payload);
        if (error) throw error;
        toast.success("Item criado.");
      }
      await loadItems();
      resetForm();
    } catch (error) {
      console.error("Erro ao salvar item:", error);
      toast.error("Não foi possível salvar o item.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item: ChecklistItemWithRelations) => {
    setEditingId(item.id);
    setFormData({
      checklist_id: item.checklist_id,
      descricao: item.descricao,
      periodicidade: item.periodicidade,
      ordem: item.ordem ?? 0,
      ativo_id: item.ativo_id ?? "",
    });
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("checklist_item").delete().eq("id", id);
      if (error) throw error;
      toast.success("Item removido.");
      await loadItems();
    } catch (error) {
      console.error("Erro ao remover item de checklist:", error);
      toast.error("Não foi possível remover o item.");
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        item.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.checklist?.nome?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesChecklist = checklistFilter === "all" || item.checklist_id === checklistFilter;
      return matchesSearch && matchesChecklist;
    });
  }, [items, searchTerm, checklistFilter]);

  const getPeriodicidadeLabel = (value: Periodicidade) =>
    periodicidadeOptions.find((opt) => opt.value === value)?.label ?? value;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Itens de checklist</h1>
            <p className="text-muted-foreground">Cadastre e organize os itens executáveis de cada checklist.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadInitial}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Novo item
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>{editingId ? "Editar item" : "Novo item"}</CardTitle>
              <CardDescription>Descreva o item e vincule ao checklist correto.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label>Checklist</Label>
                  <Select
                    value={formData.checklist_id}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, checklist_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o checklist" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {checklists.map((checklist) => (
                        <SelectItem key={checklist.id} value={checklist.id}>
                          {checklist.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input
                    required
                    value={formData.descricao}
                    onChange={(e) => setFormData((prev) => ({ ...prev, descricao: e.target.value }))}
                    placeholder="Ex.: Verificar iluminação, aferir temperatura..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Periodicidade específica</Label>
                  <Select
                    value={formData.periodicidade}
                    onValueChange={(value: Periodicidade) =>
                      setFormData((prev) => ({ ...prev, periodicidade: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Periodicidade" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {periodicidadeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Ordem</Label>
                  <Input
                    type="number"
                    value={formData.ordem}
                    onChange={(e) => setFormData((prev) => ({ ...prev, ordem: Number(e.target.value) }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Ativo relacionado (opcional)</Label>
                  <Select
                    value={formData.ativo_id}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, ativo_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um ativo" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="">Nenhum</SelectItem>
                      {ativos.map((ativo) => (
                        <SelectItem key={ativo.id} value={ativo.id}>
                          {ativo.tag_patrimonio} {ativo.modelo ? `- ${ativo.modelo}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={saving}>
                    {saving ? "Salvando..." : editingId ? "Atualizar" : "Cadastrar"}
                  </Button>
                  {editingId && (
                    <Button type="button" variant="secondary" onClick={resetForm}>
                      Cancelar
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Itens cadastrados</CardTitle>
              <CardDescription>Visualize e filtre os itens por checklist.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <Input
                  placeholder="Buscar por descrição ou checklist"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="md:w-1/2"
                />
                <Select value={checklistFilter} onValueChange={setChecklistFilter}>
                  <SelectTrigger className="w-[240px]">
                    <SelectValue placeholder="Filtrar checklist" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="all">Todos</SelectItem>
                    {checklists.map((checklist) => (
                      <SelectItem key={checklist.id} value={checklist.id}>
                        {checklist.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ordem</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Checklist</TableHead>
                    <TableHead>Periodicidade</TableHead>
                    <TableHead>Ativo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.ordem}</TableCell>
                      <TableCell className="font-medium">{item.descricao}</TableCell>
                      <TableCell>{item.checklist?.nome || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {getPeriodicidadeLabel(item.periodicidade)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {item.ativo ? (
                          <div className="flex flex-col">
                            <span>{item.ativo.tag_patrimonio}</span>
                            <span className="text-xs text-muted-foreground">{item.ativo.modelo}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="icon" variant="ghost" onClick={() => handleEdit(item)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDelete(item.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Nenhum item cadastrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ChecklistItens;
