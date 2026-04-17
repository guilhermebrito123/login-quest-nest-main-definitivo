import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import type { AccessLevel } from "@/hooks/useAccessContext";
import {
  CHAMADO_PRIORIDADE_OPTIONS,
  CHAMADO_PRIORIDADE_LABELS,
  CHAMADO_STATUS_OPTIONS,
  CHAMADO_STATUS_LABELS,
  canManageChamadoByAccess,
} from "@/lib/chamados";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type ChamadoRow = Tables<"chamados">;
type CategoriaRow = Tables<"chamado_categorias">;
type LocalRow = Tables<"cost_center_locais">;
type CostCenterRow = Tables<"cost_center">;

export type ChamadoLocalOption = LocalRow & {
  cost_center_name?: string | null;
  convenia_id?: string | null;
};

export type ChamadoCostCenterOption = Pick<CostCenterRow, "id" | "name" | "convenia_id">;

type ChamadoDraft = {
  titulo: string;
  descricao: string;
  categoriaId: string;
  costCenterId: string;
  localId: string;
  prioridade: ChamadoRow["prioridade"];
  status: ChamadoRow["status"];
  responsavelId: string;
};

interface ChamadoFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chamado?: ChamadoRow | null;
  currentUserId: string | null;
  accessLevel: AccessLevel;
  categorias: CategoriaRow[];
  costCenters: ChamadoCostCenterOption[];
  locais: ChamadoLocalOption[];
  onSuccess: () => Promise<void> | void;
}

const EMPTY_DRAFT: ChamadoDraft = {
  titulo: "",
  descricao: "",
  categoriaId: "",
  costCenterId: "",
  localId: "",
  prioridade: "media",
  status: "aberto",
  responsavelId: "",
};

function buildDraft(chamado?: ChamadoRow | null, locais: ChamadoLocalOption[] = []): ChamadoDraft {
  if (!chamado) return EMPTY_DRAFT;

  const local = locais.find((item) => item.id === chamado.local_id);

  return {
    titulo: chamado.titulo ?? "",
    descricao: chamado.descricao ?? "",
    categoriaId: chamado.categoria_id ?? "",
    costCenterId: local?.cost_center_id ?? "",
    localId: chamado.local_id ?? "",
    prioridade: chamado.prioridade,
    status: chamado.status,
    responsavelId: chamado.responsavel_id ?? "",
  };
}

export function ChamadoForm({
  open,
  onOpenChange,
  chamado,
  currentUserId,
  accessLevel,
  categorias,
  costCenters,
  locais,
  onSuccess,
}: ChamadoFormProps) {
  const [draft, setDraft] = useState<ChamadoDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  const canManageChamados = canManageChamadoByAccess(accessLevel);

  useEffect(() => {
    if (!open) return;
    setDraft(buildDraft(chamado, locais));
  }, [open, chamado, locais]);

  useEffect(() => {
    if (!open || chamado || draft.costCenterId || costCenters.length !== 1) return;
    setDraft((prev) => ({
      ...prev,
      costCenterId: costCenters[0].id,
    }));
  }, [open, chamado, draft.costCenterId, costCenters]);

  const categoriasDisponiveis = useMemo(
    () =>
      categorias.filter((categoria) => categoria.ativo || categoria.id === draft.categoriaId),
    [categorias, draft.categoriaId]
  );

  const locaisDisponiveis = useMemo(
    () =>
      locais.filter(
        (local) =>
          (local.ativo || local.id === draft.localId) &&
          (!draft.costCenterId || local.cost_center_id === draft.costCenterId)
      ),
    [locais, draft.localId, draft.costCenterId]
  );

  const isEditing = !!chamado;

  const handleChange = <K extends keyof ChamadoDraft>(key: K, value: ChamadoDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleCostCenterChange = (value: string) => {
    setDraft((prev) => {
      const selectedLocalStillMatches = prev.localId
        ? locais.some((local) => local.id === prev.localId && local.cost_center_id === value)
        : false;

      return {
        ...prev,
        costCenterId: value,
        localId: selectedLocalStillMatches ? prev.localId : "",
      };
    });
  };

  const handleLocalChange = (value: string) => {
    const selectedLocal = locais.find((local) => local.id === value);
    setDraft((prev) => ({
      ...prev,
      localId: value,
      costCenterId: selectedLocal?.cost_center_id ?? prev.costCenterId,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!currentUserId) {
      toast.error("Não foi possível identificar o usuário atual.");
      return;
    }

    if (!draft.titulo.trim()) {
      toast.error("Informe o título do chamado.");
      return;
    }

    if (!draft.descricao.trim()) {
      toast.error("Informe a descrição do chamado.");
      return;
    }

    if (!draft.localId) {
      toast.error("Selecione um local.");
      return;
    }

    const actionLabel = isEditing ? "salvar as alterações deste chamado" : "criar este chamado";
    if (typeof window !== "undefined" && !window.confirm(`Deseja ${actionLabel}?`)) {
      return;
    }

    setSaving(true);
    try {
      const nextStatus = isEditing && chamado ? chamado.status : "aberto";
      const nextResponsavelId = canManageChamados
        ? draft.responsavelId || null
        : isEditing && chamado
          ? chamado.responsavel_id ?? null
          : null;
      const nextCategoriaId = draft.categoriaId || null;

      const resolvidoEm: string | null = isEditing ? chamado?.resolvido_em ?? null : null;
      const resolvidoPor: string | null = isEditing ? chamado?.resolvido_por ?? null : null;
      const dataFechamento: string | null = isEditing ? chamado?.data_fechamento ?? null : null;

      if (isEditing && chamado) {
        const payload: TablesUpdate<"chamados"> = {
          titulo: draft.titulo.trim(),
          descricao: draft.descricao.trim(),
          categoria_id: nextCategoriaId,
          local_id: draft.localId,
          prioridade: draft.prioridade,
          status: nextStatus,
          responsavel_id: nextResponsavelId,
          resolvido_em: resolvidoEm,
          resolvido_por: resolvidoPor,
          data_fechamento: dataFechamento,
        };

        const { error } = await supabase.from("chamados").update(payload).eq("id", chamado.id);
        if (error) throw error;
        toast.success("Chamado atualizado com sucesso.");
      } else {
        const payload: TablesInsert<"chamados"> = {
          titulo: draft.titulo.trim(),
          descricao: draft.descricao.trim(),
          categoria_id: nextCategoriaId,
          local_id: draft.localId,
          prioridade: draft.prioridade,
          status: nextStatus,
          responsavel_id: nextResponsavelId,
          solicitante_id: currentUserId,
          resolvido_em: resolvidoEm,
          resolvido_por: resolvidoPor,
          data_fechamento: dataFechamento,
        };

        const { error } = await supabase.from("chamados").insert(payload);
        if (error) throw error;
        toast.success("Chamado criado com sucesso.");
      }

      await onSuccess();
      onOpenChange(false);
      setDraft(EMPTY_DRAFT);
    } catch (error: any) {
      console.error("Erro ao salvar chamado:", error);
      toast.error(error?.message ?? "Erro ao salvar chamado.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar chamado" : "Novo chamado"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Atualize os dados principais do chamado."
              : "Preencha as informações abaixo para registrar um novo chamado."}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={handleSubmit}>
          {isEditing && chamado && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <span className="font-medium">Chamado em edição</span>
              <Badge variant="outline">{`#${String(chamado.numero).padStart(6, "0")}`}</Badge>
              <Badge variant="outline">{CHAMADO_STATUS_LABELS[chamado.status]}</Badge>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Título</label>
              <Input
                value={draft.titulo}
                onChange={(event) => handleChange("titulo", event.target.value)}
                placeholder="Ex: Lâmpada queimada na recepção"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Descrição</label>
              <Textarea
                value={draft.descricao}
                onChange={(event) => handleChange("descricao", event.target.value)}
                rows={5}
                placeholder="Descreva o problema, contexto e urgência."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Categoria</label>
              <Select
                value={draft.categoriaId || "none"}
                onValueChange={(value) => handleChange("categoriaId", value === "none" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem categoria</SelectItem>
                  {categoriasDisponiveis.map((categoria) => (
                    <SelectItem key={categoria.id} value={categoria.id}>
                      {categoria.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Centro de custo</label>
              <Select value={draft.costCenterId} onValueChange={handleCostCenterChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o centro de custo" />
                </SelectTrigger>
                <SelectContent>
                  {costCenters.map((costCenter) => (
                    <SelectItem key={costCenter.id} value={costCenter.id}>
                      {costCenter.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Local</label>
              <Select
                value={draft.localId}
                onValueChange={handleLocalChange}
                disabled={!draft.costCenterId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o local" />
                </SelectTrigger>
                <SelectContent>
                  {locaisDisponiveis.map((local) => (
                    <SelectItem key={local.id} value={local.id}>
                      {local.nome}
                      {local.cost_center_name ? ` · ${local.cost_center_name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!draft.costCenterId && (
                <p className="text-xs text-muted-foreground">
                  Selecione primeiro o centro de custo para filtrar os locais.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Prioridade</label>
              <Select
                value={draft.prioridade}
                onValueChange={(value) =>
                  handleChange("prioridade", value as ChamadoDraft["prioridade"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHAMADO_PRIORIDADE_OPTIONS.map((prioridade) => (
                    <SelectItem key={prioridade} value={prioridade}>
                      {CHAMADO_PRIORIDADE_LABELS[prioridade]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select
                disabled
                value={draft.status}
                onValueChange={() => {}}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHAMADO_STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>
                      {CHAMADO_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {isEditing
                  ? "O status deve ser alterado pelas ações disponíveis no detalhe do chamado."
                  : "Todo chamado é criado como aberto. Depois, o status deve ser alterado pelas ações do detalhe do chamado."}
              </p>
            </div>

          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Salvar alterações" : "Criar chamado"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
