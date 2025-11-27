import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Edit, Trash2, RefreshCw } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type InspecaoRow = Database["public"]["Tables"]["inspecoes"]["Row"];
type InspecaoInsert = Database["public"]["Tables"]["inspecoes"]["Insert"];
type UnidadeRow = Pick<Database["public"]["Tables"]["unidades"]["Row"], "id" | "nome">;
type PostoRow = Pick<Database["public"]["Tables"]["postos_servico"]["Row"], "id" | "nome" | "unidade_id">;
type ChecklistRow = Database["public"]["Tables"]["checklist"]["Row"];
type ChecklistItemRow = Pick<
  Database["public"]["Tables"]["checklist_item"]["Row"],
  "id" | "descricao" | "checklist_id" | "ordem"
>;

type InspecaoChecklistRelation = {
  checklist_id: string;
  checklist: {
    id: string;
    nome: string;
    periodicidade: Database["public"]["Enums"]["periodicidade_type"];
  } | null;
};

type InspecaoChecklistItemRelation = {
  checklist_item_id: string;
  checklist_item: {
    id: string;
    descricao: string;
    checklist_id: string | null;
  } | null;
};

type InspecaoListItem = Pick<
  InspecaoRow,
  "id" | "unidade_id" | "posto_id" | "responsavel" | "dia_inspecao"
> & {
  unidade?: { nome: string | null } | null;
  posto?: { nome: string | null } | null;
  responsavel_profile?: { full_name: string | null } | null;
  rel_checklists?: InspecaoChecklistRelation[] | null;
  rel_checklist_itens?: InspecaoChecklistItemRelation[] | null;
};

interface InspecaoForm {
  unidade_id: string;
  posto_id: string;
  dia_inspecao: string;
  responsavel: string;
  checklistIds: string[];
  checklistItemIds: string[];
}

const initialForm: InspecaoForm = {
  unidade_id: "",
  posto_id: "",
  dia_inspecao: "",
  responsavel: "",
  checklistIds: [],
  checklistItemIds: [],
};

const allowedRoles = ["supervisor", "gestor_operacoes", "admin"];

const Inspecao = () => {
  const [inspecoes, setInspecoes] = useState<InspecaoListItem[]>([]);
  const [unidades, setUnidades] = useState<UnidadeRow[]>([]);
  const [postos, setPostos] = useState<PostoRow[]>([]);
  const [responsaveis, setResponsaveis] = useState<Array<{ id: string; nome: string }>>([]);
  const [checklists, setChecklists] = useState<ChecklistRow[]>([]);
  const [checklistItems, setChecklistItems] = useState<ChecklistItemRow[]>([]);
  const [formData, setFormData] = useState<InspecaoForm>(initialForm);
  const [editingId, setEditingId] = useState<InspecaoRow["id"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const sanitizeChecklistItemSelection = useCallback(
    (checklistIds: string[], selectedItemIds: string[]) => {
      const allowedIds = new Set(
        checklistItems
          .filter(
            (item) => item.checklist_id !== null && checklistIds.includes(item.checklist_id)
          )
          .map((item) => item.id)
      );
      return selectedItemIds.filter((itemId) => allowedIds.has(itemId));
    },
    [checklistItems]
  );

  const fetchInspecoes = useCallback(async () => {
    const { data, error } = await supabase
      .from("inspecoes")
      .select(`
        id,
        unidade_id,
        posto_id,
        responsavel,
        dia_inspecao,
        unidade:unidades ( nome ),
        posto:postos_servico ( nome ),
        responsavel_profile:profiles ( full_name ),
        rel_checklists:inspecoes_checklists (
          checklist_id,
          checklist:checklist (
            id,
            nome,
            periodicidade
          )
        ),
        rel_checklist_itens:inspecoes_checklist_itens (
          checklist_item_id,
          checklist_item:checklist_item (
            id,
            descricao,
            checklist_id
          )
        )
      `)
      .order("dia_inspecao", { ascending: false });

    if (error) {
      console.error(error);
      toast.error("Nao foi possivel carregar as inspecoes");
      return;
    }

    setInspecoes((data as InspecaoListItem[]) ?? []);
  }, []);

  const fetchUnidades = useCallback(async () => {
    const { data, error } = await supabase.from("unidades").select("id, nome").order("nome");
    if (error) {
      toast.error("Nao foi possivel carregar as unidades");
      return;
    }
    setUnidades((data as UnidadeRow[]) ?? []);
  }, []);

  const fetchPostos = useCallback(async () => {
    const { data, error } = await supabase
      .from("postos_servico")
      .select("id, nome, unidade_id")
      .order("nome");
    if (error) {
      toast.error("Nao foi possivel carregar os postos");
      return;
    }
    setPostos((data as PostoRow[]) ?? []);
  }, []);

  const fetchResponsaveis = useCallback(async () => {
    const { data: rolesData, error } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", allowedRoles);

    if (error) {
      toast.error("Nao foi possivel carregar os responsaveis");
      return;
    }

    const userIds = rolesData?.map((role) => role.user_id) ?? [];
    if (userIds.length === 0) {
      setResponsaveis([]);
      return;
    }

    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);

    if (profilesError) {
      toast.error("Nao foi possivel carregar os perfis");
      return;
    }

    setResponsaveis(
      (profilesData ?? []).map((profile) => ({
        id: profile.id,
        nome: profile.full_name || profile.email || "Usuario sem nome",
      }))
    );
  }, []);

  const fetchChecklists = useCallback(async () => {
    const { data, error } = await supabase
      .from("checklist")
      .select("id, nome, periodicidade")
      .order("nome");
    if (error) {
      toast.error("Nao foi possivel carregar os checklists");
      return;
    }
    setChecklists((data as ChecklistRow[]) ?? []);
  }, []);

  const fetchChecklistItems = useCallback(async () => {
    const { data, error } = await supabase
      .from("checklist_item")
      .select("id, descricao, checklist_id, ordem")
      .order("ordem", { ascending: true });
    if (error) {
      toast.error("Nao foi possivel carregar os itens de checklist");
      return;
    }
    setChecklistItems((data as ChecklistItemRow[]) ?? []);
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchInspecoes(),
        fetchUnidades(),
        fetchPostos(),
        fetchResponsaveis(),
        fetchChecklists(),
        fetchChecklistItems(),
      ]);
    } finally {
      setLoading(false);
    }
  }, [
    fetchInspecoes,
    fetchUnidades,
    fetchPostos,
    fetchResponsaveis,
    fetchChecklists,
    fetchChecklistItems,
  ]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const filteredPostos = useMemo(() => {
    if (!formData.unidade_id) return postos;
    return postos.filter((posto) => posto.unidade_id === formData.unidade_id);
  }, [postos, formData.unidade_id]);

  const availableChecklistItems = useMemo(() => {
    if (!formData.checklistIds.length) return [];
    return checklistItems.filter(
      (item) => item.checklist_id && formData.checklistIds.includes(item.checklist_id)
    );
  }, [checklistItems, formData.checklistIds]);

  const getPeriodicidadeLabel = (value: ChecklistRow["periodicidade"]) => {
    const labels: Record<ChecklistRow["periodicidade"], string> = {
      diaria: "Diária",
      semanal: "Semanal",
      quinzenal: "Quinzenal",
      mensal: "Mensal",
      trimestral: "Trimestral",
      semestral: "Semestral",
      anual: "Anual",
    };
    return labels[value] ?? value;
  };

  const syncInspectionRelations = useCallback(
    async (inspecaoId: number, checklistIds: string[], checklistItemIds: string[]) => {
      await supabase.from("inspecoes_checklists").delete().eq("inspecao_id", inspecaoId);
      if (checklistIds.length) {
        const checklistPayload = checklistIds.map((checklistId) => ({
          inspecao_id: inspecaoId,
          checklist_id: checklistId,
        }));
        const { error } = await supabase.from("inspecoes_checklists").insert(checklistPayload);
        if (error) throw error;
      }

      await supabase.from("inspecoes_checklist_itens").delete().eq("inspecao_id", inspecaoId);
      if (checklistItemIds.length) {
        const itemPayload = checklistItemIds.map((itemId) => ({
          inspecao_id: inspecaoId,
          checklist_item_id: itemId,
        }));
        const { error } = await supabase.from("inspecoes_checklist_itens").insert(itemPayload);
        if (error) throw error;
      }
    },
    []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !formData.unidade_id ||
      !formData.posto_id ||
      !formData.dia_inspecao ||
      !formData.responsavel ||
      formData.checklistIds.length === 0
    ) {
      toast.warning("Preencha todos os campos obrigatorios e selecione ao menos um checklist");
      return;
    }

    setSaving(true);
    const payload: InspecaoInsert = {
      unidade_id: formData.unidade_id,
      posto_id: formData.posto_id,
      responsavel: formData.responsavel,
      dia_inspecao: new Date(formData.dia_inspecao).toISOString(),
    };

    const sanitizedItemSelection = sanitizeChecklistItemSelection(
      formData.checklistIds,
      formData.checklistItemIds
    );

    try {
      let inspecaoId = editingId;

      if (editingId) {
        const { error } = await supabase.from("inspecoes").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("inspecoes")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        inspecaoId = data?.id ?? null;
      }

      if (!inspecaoId) {
        throw new Error("Nao foi possivel identificar a inspecao criada/atualizada.");
      }

      await syncInspectionRelations(inspecaoId, formData.checklistIds, sanitizedItemSelection);

      toast.success("Inspecao salva com sucesso");
      resetForm();
      fetchInspecoes();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar inspecao");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (inspecao: InspecaoListItem) => {
    const nextChecklistIds = (inspecao.rel_checklists ?? []).map((rel) => rel.checklist_id);
    const rawItemIds = (inspecao.rel_checklist_itens ?? []).map((rel) => rel.checklist_item_id);
    setEditingId(inspecao.id);
    setFormData({
      unidade_id: inspecao.unidade_id,
      posto_id: inspecao.posto_id,
      responsavel: inspecao.responsavel,
      dia_inspecao: inspecao.dia_inspecao
        ? new Date(inspecao.dia_inspecao).toISOString().slice(0, 16)
        : "",
      checklistIds: nextChecklistIds,
      checklistItemIds: sanitizeChecklistItemSelection(nextChecklistIds, rawItemIds),
    });
  };

  const handleDelete = async (id: InspecaoRow["id"]) => {
    if (!confirm("Deseja realmente excluir esta inspecao?")) return;
    const { error } = await supabase.from("inspecoes").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir inspecao");
      return;
    }
    toast.success("Inspecao excluida");
    fetchInspecoes();
  };

  const resetForm = () => {
    setFormData(initialForm);
    setEditingId(null);
  };

  const toggleChecklist = (checklistId: string, checked: boolean) => {
    setFormData((prev) => {
      const checklistIds = checked
        ? Array.from(new Set([...prev.checklistIds, checklistId]))
        : prev.checklistIds.filter((id) => id !== checklistId);
      const checklistItemIds = sanitizeChecklistItemSelection(checklistIds, prev.checklistItemIds);
      return { ...prev, checklistIds, checklistItemIds };
    });
  };

  const toggleChecklistItem = (itemId: string, checked: boolean) => {
    setFormData((prev) => {
      const checklistItemIds = checked
        ? Array.from(new Set([...prev.checklistItemIds, itemId]))
        : prev.checklistItemIds.filter((id) => id !== itemId);
      return { ...prev, checklistItemIds };
    });
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">Inspecoes</h1>
            <p className="text-muted-foreground">
              Cadastre e acompanhe inspecoes realizadas em campo.
            </p>
          </div>
          <Button variant="outline" onClick={fetchAll} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Editar inspecao" : "Nova inspecao"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Unidade *</Label>
                  <Select
                    value={formData.unidade_id}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, unidade_id: value, posto_id: "" }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {unidades.map((unidade) => (
                        <SelectItem key={unidade.id} value={unidade.id}>
                          {unidade.nome}
                        </SelectItem>
                      ))}
                      {unidades.length === 0 && (
                        <SelectItem value="__placeholder" disabled>
                          Nenhuma unidade cadastrada
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Posto *</Label>
                  <Select
                    value={formData.posto_id}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, posto_id: value }))}
                    disabled={!formData.unidade_id}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          formData.unidade_id ? "Selecione" : "Escolha uma unidade primeiro"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredPostos.map((posto) => (
                        <SelectItem key={posto.id} value={posto.id}>
                          {posto.nome}
                        </SelectItem>
                      ))}
                      {filteredPostos.length === 0 && (
                        <SelectItem value="__placeholder" disabled>
                          Nenhum posto encontrado
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Responsavel *</Label>
                  <Select
                    value={formData.responsavel}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, responsavel: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {responsaveis.map((responsavel) => (
                        <SelectItem key={responsavel.id} value={responsavel.id}>
                          {responsavel.nome}
                        </SelectItem>
                      ))}
                      {responsaveis.length === 0 && (
                        <SelectItem value="__placeholder" disabled>
                          Nenhum responsavel encontrado
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Data da inspecao *</Label>
                  <Input
                    type="datetime-local"
                    value={formData.dia_inspecao}
                    onChange={(e) => setFormData((prev) => ({ ...prev, dia_inspecao: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Checklists vinculados *</Label>
                {checklists.length > 0 ? (
                  <div className="grid gap-2 md:grid-cols-2">
                    {checklists.map((checklist) => {
                      const checked = formData.checklistIds.includes(checklist.id);
                      return (
                        <label
                          key={checklist.id}
                          className={`flex cursor-pointer items-center justify-between rounded-md border p-3 text-sm ${
                            checked ? "border-primary bg-primary/5" : "border-muted"
                          }`}
                        >
                          <span className="flex flex-col">
                            <span className="font-medium">{checklist.nome}</span>
                            <span className="text-xs text-muted-foreground">
                              {getPeriodicidadeLabel(checklist.periodicidade)}
                            </span>
                          </span>
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={checked}
                            onChange={(e) => toggleChecklist(checklist.id, e.target.checked)}
                          />
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Cadastre um checklist antes de criar uma inspecao.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Itens de checklist (opcional)</Label>
                {formData.checklistIds.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Selecione um checklist para visualizar os itens disponiveis.
                  </p>
                ) : (
                  <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-3">
                    {availableChecklistItems.map((item) => {
                      const checked = formData.checklistItemIds.includes(item.id);
                      return (
                        <label key={item.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={checked}
                            onChange={(e) => toggleChecklistItem(item.id, e.target.checked)}
                          />
                          <span>{item.descricao}</span>
                        </label>
                      );
                    })}
                    {availableChecklistItems.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        Nenhum item cadastrado para os checklists selecionados.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button type="submit" disabled={saving || checklists.length === 0}>
                  {saving ? "Salvando..." : editingId ? "Atualizar inspecao" : "Cadastrar inspecao"}
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

        <Card>
          <CardHeader>
            <CardTitle>Historico de inspecoes</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Posto</TableHead>
                  <TableHead>Responsavel</TableHead>
                  <TableHead>Checklists</TableHead>
                  <TableHead>Itens selecionados</TableHead>
                  <TableHead>Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inspecoes.map((inspecao) => (
                  <TableRow key={inspecao.id}>
                    <TableCell>{inspecao.id}</TableCell>
                    <TableCell>
                      {inspecao.dia_inspecao
                        ? format(new Date(inspecao.dia_inspecao), "dd/MM/yyyy HH:mm", { locale: ptBR })
                        : "-"}
                    </TableCell>
                    <TableCell>{inspecao.unidade?.nome ?? "-"}</TableCell>
                    <TableCell>{inspecao.posto?.nome ?? "-"}</TableCell>
                    <TableCell>{inspecao.responsavel_profile?.full_name ?? "-"}</TableCell>
                    <TableCell className="max-w-xs">
                      {inspecao.rel_checklists?.length
                        ? inspecao.rel_checklists
                            .map((rel) => rel.checklist?.nome)
                            .filter(Boolean)
                            .join(", ")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {inspecao.rel_checklist_itens?.length
                        ? `${inspecao.rel_checklist_itens.length} item(ns)`
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="icon" variant="ghost" onClick={() => handleEdit(inspecao)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(inspecao.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && inspecoes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                      Nenhuma inspecao cadastrada
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Inspecao;
