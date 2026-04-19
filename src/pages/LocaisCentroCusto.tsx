import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAccessContext } from "@/hooks/useAccessContext";
import { canManageLocaisByAccess } from "@/lib/chamados";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type CostCenterRow = Tables<"cost_center">;
type LocalRow = Tables<"cost_center_locais">;

type LocalDraft = {
  cost_center_id: string;
  nome: string;
  descricao: string;
  ativo: boolean;
};

const EMPTY_DRAFT: LocalDraft = {
  cost_center_id: "",
  nome: "",
  descricao: "",
  ativo: true,
};

const buildDraft = (local?: LocalRow | null): LocalDraft =>
  local
    ? {
        cost_center_id: local.cost_center_id,
        nome: local.nome,
        descricao: local.descricao ?? "",
        ativo: local.ativo,
      }
    : EMPTY_DRAFT;

const normalizeLocalName = (value: string) =>
  value
    .trimStart()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

async function filterManageableCostCenters(
  userId: string,
  costCenters: CostCenterRow[]
) {
  const scopedCenters = await Promise.all(
    costCenters.map(async (center) => {
      const { data, error } = await supabase.rpc("internal_user_has_cost_center_access", {
        p_user_id: userId,
        p_cost_center_id: center.id,
      });

      if (error) throw error;
      return data ? center : null;
    })
  );

  return scopedCenters.filter((center): center is CostCenterRow => center !== null);
}

export default function LocaisCentroCusto() {
  const { accessContext, accessLoading } = useAccessContext();
  const shouldReduceMotion = useReducedMotion();
  const [searchTerm, setSearchTerm] = useState("");
  const [costCenterFilter, setCostCenterFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "ativos" | "inativos">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLocal, setEditingLocal] = useState<LocalRow | null>(null);
  const [draft, setDraft] = useState<LocalDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: costCenters = [], refetch: refetchCenters } = useQuery({
    queryKey: ["cost-centers-module"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cost_center")
        .select("id, name, convenia_id, created_at, updated_at")
        .order("name");

      if (error) throw error;
      return (data || []) as CostCenterRow[];
    },
  });

  const { data: locais = [], refetch: refetchLocais, isFetching } = useQuery({
    queryKey: ["cost-center-locais-module"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cost_center_locais")
        .select("*")
        .order("nome");

      if (error) throw error;
      return (data || []) as LocalRow[];
    },
  });

  useEffect(() => {
    if (!dialogOpen) return;
    setDraft(buildDraft(editingLocal));
  }, [dialogOpen, editingLocal]);

  const { data: manageableCostCenters = [] } = useQuery({
    queryKey: [
      "manageable-cost-centers-module",
      accessContext.userId,
      accessContext.role,
      accessContext.accessLevel,
      costCenters.map((center) => center.id).join(","),
    ],
    enabled:
      !accessLoading &&
      !!accessContext.userId &&
      costCenters.length > 0 &&
      accessContext.role === "perfil_interno" &&
      canManageLocaisByAccess(accessContext.accessLevel),
    queryFn: async () => {
      if (accessContext.isAdmin) return costCenters;
      if (!accessContext.userId) return [] as CostCenterRow[];
      return filterManageableCostCenters(accessContext.userId, costCenters);
    },
  });

  const manageableCostCenterIds = useMemo(
    () => new Set(manageableCostCenters.map((center) => center.id)),
    [manageableCostCenters]
  );
  const canManageLocais =
    accessContext.role === "perfil_interno" &&
    canManageLocaisByAccess(accessContext.accessLevel) &&
    (accessContext.isAdmin || manageableCostCenters.length > 0);
  const canManageLocal = (local: Pick<LocalRow, "cost_center_id">) =>
    accessContext.isAdmin || manageableCostCenterIds.has(local.cost_center_id);

  const costCenterMap = useMemo(
    () =>
      new Map(
        costCenters.map((center) => [
          center.id,
          {
            name: center.name,
            convenia_id: center.convenia_id,
          },
        ])
      ),
    [costCenters]
  );

  const filteredLocais = useMemo(() => {
    return locais.filter((local) => {
      const center = costCenterMap.get(local.cost_center_id);
      const normalized = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !normalized ||
        local.nome.toLowerCase().includes(normalized) ||
        (local.descricao || "").toLowerCase().includes(normalized) ||
        (center?.name || "").toLowerCase().includes(normalized) ||
        (center?.convenia_id || "").toLowerCase().includes(normalized);

      const matchesCenter =
        costCenterFilter === "all" || local.cost_center_id === costCenterFilter;

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "ativos" ? local.ativo : !local.ativo);

      return matchesSearch && matchesCenter && matchesStatus;
    });
  }, [locais, costCenterMap, searchTerm, costCenterFilter, statusFilter]);

  const handleOpenCreate = () => {
    if (!canManageLocais) {
      toast.error("Seu perfil não pode criar locais neste momento.");
      return;
    }
    setEditingLocal(null);
    setDraft(EMPTY_DRAFT);
    setDialogOpen(true);
  };

  const handleOpenEdit = (local: LocalRow) => {
    if (!canManageLocal(local)) {
      toast.error("Seu perfil não pode editar este local.");
      return;
    }
    setEditingLocal(local);
    setDraft(buildDraft(local));
    setDialogOpen(true);
  };

  const handleDraftChange = <K extends keyof LocalDraft>(key: K, value: LocalDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const refreshAll = async () => {
    await Promise.all([refetchCenters(), refetchLocais()]);
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedName = normalizeLocalName(draft.nome);

    if (!canManageLocais) {
      toast.error("Seu perfil não pode gerenciar locais.");
      return;
    }

    if (!draft.cost_center_id) {
      toast.error("Selecione um centro de custo.");
      return;
    }

    if (!accessContext.isAdmin && !manageableCostCenterIds.has(draft.cost_center_id)) {
      toast.error("Seu perfil não possui acesso ao centro de custo selecionado.");
      return;
    }

    if (!normalizedName) {
      toast.error("Informe o nome do local.");
      return;
    }

    const actionLabel = editingLocal
      ? `salvar as alterações do local "${normalizedName}"`
      : `criar o local "${normalizedName}"`;
    if (typeof window !== "undefined" && !window.confirm(`Deseja ${actionLabel}?`)) {
      return;
    }

    setSaving(true);
    try {
      if (editingLocal) {
        const payload: TablesUpdate<"cost_center_locais"> = {
          cost_center_id: draft.cost_center_id,
          nome: normalizedName,
          descricao: draft.descricao.trim() || null,
          ativo: draft.ativo,
        };

        const { error } = await supabase
          .from("cost_center_locais")
          .update(payload)
          .eq("id", editingLocal.id);

        if (error) throw error;
        toast.success("Local atualizado com sucesso.");
      } else {
        const payload: TablesInsert<"cost_center_locais"> = {
          cost_center_id: draft.cost_center_id,
          nome: normalizedName,
          descricao: draft.descricao.trim() || null,
          ativo: draft.ativo,
        };

        const { error } = await supabase.from("cost_center_locais").insert(payload);
        if (error) throw error;
        toast.success("Local criado com sucesso.");
      }

      setDialogOpen(false);
      setEditingLocal(null);
      setDraft(EMPTY_DRAFT);
      await refreshAll();
    } catch (error: any) {
      console.error("Erro ao salvar local:", error);
      toast.error(error?.message ?? "Erro ao salvar local.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (local: LocalRow) => {
    if (!canManageLocais || !canManageLocal(local)) {
      toast.error("Seu perfil não pode excluir locais.");
      return;
    }

    if (typeof window !== "undefined" && !window.confirm(`Excluir o local ${local.nome}?`)) return;

    setDeletingId(local.id);
    try {
      const { error } = await supabase.from("cost_center_locais").delete().eq("id", local.id);
      if (error) throw error;

      toast.success("Local excluído com sucesso.");
      await refetchLocais();
    } catch (error: any) {
      console.error("Erro ao excluir local:", error);
      toast.error(error?.message ?? "Erro ao excluir local.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Locais</h1>
            <p className="text-sm text-muted-foreground">
              Cadastre e mantenha os locais vinculados aos centros de custo.
            </p>
            {accessContext.role === "perfil_interno" &&
              canManageLocaisByAccess(accessContext.accessLevel) &&
              !accessContext.isAdmin &&
              manageableCostCenters.length === 0 && (
                <p className="text-xs text-amber-700">
                  Nenhum centro de custo estÃ¡ vinculado ao seu perfil para criaÃ§Ã£o ou ediÃ§Ã£o.
                </p>
              )}
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <motion.svg
                aria-hidden="true"
                className="h-10 w-40 text-primary drop-shadow-sm"
                viewBox="0 0 160 40"
                fill="none"
                initial={shouldReduceMotion ? false : { opacity: 0, x: -120, scale: 0.92 }}
                animate={
                  shouldReduceMotion
                    ? undefined
                    : {
                        opacity: 1,
                        x: [-120, -20, -8, 0],
                        scale: [0.92, 1, 1, 1],
                      }
                }
                transition={
                  shouldReduceMotion
                    ? undefined
                    : {
                        duration: 1.35,
                        times: [0, 0.7, 0.88, 1],
                        ease: "easeOut",
                      }
                }
              >
                <path
                  d="M14 20H138"
                  stroke="currentColor"
                  strokeWidth="6.5"
                  strokeLinecap="round"
                />
                <path
                  d="M124 8L138 20L124 32"
                  stroke="currentColor"
                  strokeWidth="6.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </motion.svg>
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-1.5 shadow-sm">
                <Button
                  onClick={handleOpenCreate}
                  disabled={!canManageLocais || accessLoading}
                  className="font-semibold shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Novo local
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Use este botão para cadastrar um novo local.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{locais.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Ativos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-600">
                {locais.filter((item) => item.ativo).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Centros com locais</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-sky-600">
                {new Set(locais.map((item) => item.cost_center_id)).size}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="grid gap-3 md:grid-cols-[1.5fr,1fr,1fr]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Buscar por local, descrição, centro ou Convenia"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>

              <Select value={costCenterFilter} onValueChange={setCostCenterFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por centro de custo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os centros</SelectItem>
                  {manageableCostCenters.map((center) => (
                    <SelectItem key={center.id} value={center.id}>
                      {center.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="ativos">Ativos</SelectItem>
                  <SelectItem value="inativos">Inativos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Local</TableHead>
                    <TableHead>Centro de custo</TableHead>
                    <TableHead>ID Convenia</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Atualizado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLocais.length > 0 ? (
                    filteredLocais.map((local) => {
                      const center = costCenterMap.get(local.cost_center_id);
                      return (
                        <TableRow key={local.id}>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium">{local.nome}</div>
                              {local.descricao && (
                                <div className="text-xs text-muted-foreground">{local.descricao}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{center?.name || "-"}</TableCell>
                          <TableCell>{center?.convenia_id || "-"}</TableCell>
                          <TableCell>
                            <Badge variant={local.ativo ? "secondary" : "outline"}>
                              {local.ativo ? "Ativo" : "Inativo"}
                            </Badge>
                          </TableCell>
                          <TableCell>{new Date(local.updated_at).toLocaleString("pt-BR")}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenEdit(local)}
                                disabled={!canManageLocais || !canManageLocal(local)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDelete(local)}
                                disabled={!canManageLocais || !canManageLocal(local) || deletingId === local.id}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                        {isFetching ? "Carregando locais..." : "Nenhum local encontrado para os filtros informados."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl w-[95vw]">
          <DialogHeader>
            <DialogTitle>{editingLocal ? "Editar local" : "Novo local"}</DialogTitle>
            <DialogDescription>
              Relacione cada local a um centro de custo já existente.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleSave}>
            <div className="space-y-2">
              <label className="text-sm font-medium">Centro de custo</label>
              <Select
                value={draft.cost_center_id}
                onValueChange={(value) => handleDraftChange("cost_center_id", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o centro de custo" />
                </SelectTrigger>
                <SelectContent>
                  {manageableCostCenters.map((center) => (
                    <SelectItem key={center.id} value={center.id}>
                      {center.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!accessContext.isAdmin && manageableCostCenters.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Seu perfil nÃ£o possui centros de custo habilitados para ediÃ§Ã£o.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Nome do local</label>
              <Input
                value={draft.nome}
                onChange={(event) => handleDraftChange("nome", event.target.value)}
                placeholder="Ex: Recepção Torre A"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Descrição</label>
              <Textarea
                rows={4}
                value={draft.descricao}
                onChange={(event) => handleDraftChange("descricao", event.target.value)}
                placeholder="Observações úteis para o time operacional."
              />
            </div>

            <label className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm">
              <Switch checked={draft.ativo} onCheckedChange={(checked) => handleDraftChange("ativo", checked)} />
              Local ativo
            </label>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : editingLocal ? "Salvar alterações" : "Criar local"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
