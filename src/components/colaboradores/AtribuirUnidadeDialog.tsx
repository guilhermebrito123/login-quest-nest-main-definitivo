import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface AtribuirUnidadeDialogProps {
  colaborador: any;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const formatDateBr = (date: string) => {
  try {
    return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR");
  } catch {
    return date;
  }
};

export function AtribuirUnidadeDialog({
  colaborador,
  open,
  onClose,
  onSuccess,
}: AtribuirUnidadeDialogProps) {
  const [loading, setLoading] = useState(false);
  const [unidadeId, setUnidadeId] = useState(colaborador?.unidade_id || "");
  const [postoServicoId, setPostoServicoId] = useState(
    colaborador?.posto_servico_id || ""
  );

  const { data: unidades, isLoading: loadingUnidades } = useQuery({
    queryKey: ["unidades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unidades")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: postos } = useQuery({
    queryKey: ["postos-unidade", unidadeId],
    queryFn: async () => {
      if (!unidadeId) return [];
      const { data, error } = await supabase
        .from("postos_servico")
        .select("id, nome, status, ultimo_dia_atividade")
        .eq("unidade_id", unidadeId)
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!unidadeId,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!unidadeId) {
      toast.error("Selecione uma unidade");
      return;
    }

    setLoading(true);
    try {
      const isChangingPosto =
        colaborador?.posto_servico_id &&
        colaborador.posto_servico_id !== postoServicoId;

      if (isChangingPosto) {
        // Clean the previous allocation first so the database trigger can free the schedule (dias_trabalho)
        const { error: clearPostoError } = await supabase
          .from("colaboradores")
          .update({ posto_servico_id: null })
          .eq("id", colaborador.id);

        if (clearPostoError) throw clearPostoError;
      }

      const { error } = await supabase
        .from("colaboradores")
        .update({
          unidade_id: unidadeId,
          posto_servico_id: postoServicoId || null,
        })
        .eq("id", colaborador.id);

      if (error) throw error;

      toast.success("Unidade atribuida com sucesso");
      onSuccess();
      onClose();
    } catch (error: any) {
      const message: string =
        typeof error?.message === "string"
          ? error.message
          : "Erro ao atribuir unidade. Tente novamente.";
      const friendly =
        message.includes('status" is of type status_posto') ||
        message.includes("status_posto")
          ? "Erro ao atribuir unidade: o status do posto deve usar valores do enum (vago, ocupado, vago_temporariamente, ocupado_temporariamente, presenca_confirmada ou inativo)."
          : message;
      toast.error(friendly);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Atribuir Unidade - {colaborador?.nome_completo}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="unidade">Unidade *</Label>
            {loadingUnidades ? (
              <p className="text-sm text-muted-foreground">
                Carregando unidades...
              </p>
            ) : !unidades || unidades.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma unidade encontrada. Cadastre unidades primeiro.
              </p>
            ) : (
              <Select
                value={unidadeId}
                onValueChange={(value) => {
                  setUnidadeId(value);
                  setPostoServicoId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma unidade..." />
                </SelectTrigger>
                <SelectContent>
                  {unidades.map((unidade) => (
                    <SelectItem key={unidade.id} value={unidade.id}>
                      {unidade.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="posto">Posto de Serviço (Opcional)</Label>
            <Select
              value={postoServicoId}
              onValueChange={setPostoServicoId}
              disabled={!unidadeId}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    !unidadeId
                      ? "Selecione uma unidade primeiro..."
                      : "Selecione um posto..."
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {postos?.map((posto) => {
                  const statusLabel = posto.status
                    ? `(${posto.status.replaceAll("_", " ")})`
                    : "";
                  const isInativo = posto.status === "inativo";
                  const closingInfo = posto.ultimo_dia_atividade
                    ? formatDateBr(posto.ultimo_dia_atividade)
                    : null;
                  const secondaryText = closingInfo
                    ? isInativo
                      ? `Encerrado em ${closingInfo}`
                      : `Ultimo dia planejado: ${closingInfo}`
                    : null;
                  return (
                    <SelectItem
                      key={posto.id}
                      value={posto.id}
                      disabled={isInativo}
                      className="flex flex-col"
                    >
                      <span>
                        {posto.nome} {statusLabel}
                      </span>
                      {secondaryText && (
                        <span className="text-xs text-muted-foreground">
                          {secondaryText}
                          {isInativo ? " • selecione outro posto" : ""}
                        </span>
                      )}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !unidadeId}>
              {loading ? "Atribuindo..." : "Atribuir"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
