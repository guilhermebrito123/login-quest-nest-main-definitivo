import { FormEvent, useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit, Plus, RefreshCw, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

type Periodicidade = Database["public"]["Enums"]["periodicidade_type"];
type ChecklistRow = Database["public"]["Tables"]["checklist"]["Row"];
type ChecklistInsert = Database["public"]["Tables"]["checklist"]["Insert"];
type ChecklistUpdate = Database["public"]["Tables"]["checklist"]["Update"];

interface ChecklistForm {
  nome: string;
  periodicidade: Periodicidade;
}

const periodicidadeOptions: { value: Periodicidade; label: string }[] = [
  { value: "diaria", label: "Diaria" },
  { value: "semanal", label: "Semanal" },
  { value: "quinzenal", label: "Quinzenal" },
  { value: "mensal", label: "Mensal" },
  { value: "trimestral", label: "Trimestral" },
  { value: "semestral", label: "Semestral" },
  { value: "anual", label: "Anual" },
];

const initialFormData: ChecklistForm = {
  nome: "",
  periodicidade: "mensal",
};

const Checklist = () => {
  const [checklists, setChecklists] = useState<ChecklistRow[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ChecklistForm>(initialFormData);

  useEffect(() => {
    void loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      await loadChecklists();
    } catch (error) {
      console.error("Erro ao carregar dados do checklist:", error);
      toast.error("Não foi possível carregar os checklists.");
    } finally {
      setLoading(false);
    }
  };

  const loadChecklists = async () => {
    const { data, error } = await supabase
      .from("checklist")
      .select(
        `
        id,
        nome,
        periodicidade,
        created_at,
        updated_at
      `
      )
      .order("created_at", { ascending: false });

    if (error) throw error;
    setChecklists((data as ChecklistRow[]) ?? []);
  };

  const filteredChecklists = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return checklists.filter((checklist) => !term || checklist.nome.toLowerCase().includes(term));
  }, [checklists, searchTerm]);

  const resetForm = () => {
    setFormData(initialFormData);
    setEditingId(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!formData.nome.trim()) {
      toast.error("Informe o nome do checklist.");
      return;
    }

    const payload: ChecklistInsert = {
      nome: formData.nome.trim(),
      periodicidade: formData.periodicidade,
    };

    const updatePayload: ChecklistUpdate = {
      ...payload,
      updated_at: new Date().toISOString(),
    };

    try {
      setSaving(true);
      if (editingId) {
        const { error } = await supabase.from("checklist").update(updatePayload).eq("id", editingId);
        if (error) throw error;
        toast.success("Checklist atualizado com sucesso.");
      } else {
        const { error } = await supabase.from("checklist").insert(payload);
        if (error) throw error;
        toast.success("Checklist criado com sucesso.");
      }
      await loadChecklists();
      resetForm();
    } catch (error) {
      console.error("Erro ao salvar checklist:", error);
      toast.error("Não foi possível salvar o checklist.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (entry: ChecklistRow) => {
    setEditingId(entry.id);
    setFormData({
      nome: entry.nome,
      periodicidade: entry.periodicidade,
    });
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("checklist").delete().eq("id", id);
      if (error) throw error;
      toast.success("Checklist removido com sucesso.");
      await loadChecklists();
    } catch (error) {
      console.error("Erro ao remover checklist:", error);
      toast.error("Não foi possível remover o checklist.");
    }
  };

  const getPeriodicidadeLabel = (value: Periodicidade) =>
    periodicidadeOptions.find((opt) => opt.value === value)?.label ?? value;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Checklists</h1>
            <p className="text-muted-foreground">Gerencie os checklists e suas periodicidades.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadInitialData}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Novo checklist
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>{editingId ? "Editar checklist" : "Novo checklist"}</CardTitle>
              <CardDescription>Cadastre o checklist conforme o schema atualizado.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    required
                    value={formData.nome}
                    onChange={(e) => setFormData((prev) => ({ ...prev, nome: e.target.value }))}
                    placeholder="Inspecao semanal, checklist de limpeza..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Periodicidade</Label>
                  <Select
                    value={formData.periodicidade}
                    onValueChange={(value: Periodicidade) =>
                      setFormData((prev) => ({ ...prev, periodicidade: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a periodicidade" />
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
              <CardTitle>Checklists cadastrados</CardTitle>
              <CardDescription>Filtros rápidos por nome.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <Input
                  placeholder="Buscar por nome"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <div className="text-sm text-muted-foreground">
                  {filteredChecklists.length} checklist(s) listado(s)
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Periodicidade</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredChecklists.map((checklist) => (
                    <TableRow key={checklist.id}>
                      <TableCell className="font-medium">{checklist.nome}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {getPeriodicidadeLabel(checklist.periodicidade)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {checklist.created_at
                          ? format(new Date(checklist.created_at), "dd/MM/yyyy", { locale: ptBR })
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="icon" variant="ghost" onClick={() => handleEdit(checklist)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDelete(checklist.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredChecklists.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        Nenhum checklist cadastrado.
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

export default Checklist;
