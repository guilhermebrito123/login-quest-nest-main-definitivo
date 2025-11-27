import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PresencaDialogProps {
  colaborador: any;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PRESENCA_TIPOS = [
  { value: "presente", label: "Presente" },
  { value: "falta", label: "Falta" },
  { value: "falta_justificada", label: "Falta Justificada" },
  { value: "ferias", label: "Férias" },
  { value: "atestado", label: "Atestado" },
  { value: "folga", label: "Folga" },
] as const;

export function PresencaDialog({ colaborador, open, onClose, onSuccess }: PresencaDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    data: new Date().toISOString().split("T")[0],
    tipo: "presente",
    horario_entrada: "",
    horario_saida: "",
    observacao: "",
  });

  useEffect(() => {
    if (open) {
      setFormData({
        data: new Date().toISOString().split("T")[0],
        tipo: "presente",
        horario_entrada: "",
        horario_saida: "",
        observacao: "",
      });
    }
  }, [open, colaborador?.id]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!colaborador) return;

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Usuário não autenticado");
      }

      const payload = {
        colaborador_id: colaborador.id,
        data: formData.data,
        tipo: formData.tipo,
        horario_entrada: formData.horario_entrada
          ? new Date(`${formData.data}T${formData.horario_entrada}`).toISOString()
          : null,
        horario_saida: formData.horario_saida
          ? new Date(`${formData.data}T${formData.horario_saida}`).toISOString()
          : null,
        observacao: formData.observacao || null,
        registrado_por: user.id,
      };

      const { error } = await supabase.from("presencas").insert(payload);
      if (error) throw error;

      toast.success("Presença registrada com sucesso");
      onSuccess();
      onClose();
    } catch (error: any) {
      if (error?.message?.includes("duplicate key")) {
        toast.error("Já existe um registro de presença para este colaborador nesta data.");
      } else {
        toast.error(error?.message || "Erro ao registrar presença.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Presença</DialogTitle>
          <p className="text-sm text-muted-foreground">{colaborador?.nome_completo}</p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="data">Data *</Label>
            <Input
              id="data"
              type="date"
              value={formData.data}
              onChange={(event) => handleChange("data", event.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo *</Label>
            <Select value={formData.tipo} onValueChange={(value) => handleChange("tipo", value)}>
              <SelectTrigger id="tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRESENCA_TIPOS.map((tipo) => (
                  <SelectItem key={tipo.value} value={tipo.value}>
                    {tipo.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {formData.tipo === "presente" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="horario_entrada">Horário Entrada</Label>
                <Input
                  id="horario_entrada"
                  type="time"
                  value={formData.horario_entrada}
                  onChange={(event) => handleChange("horario_entrada", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="horario_saida">Horário Saída</Label>
                <Input
                  id="horario_saida"
                  type="time"
                  value={formData.horario_saida}
                  onChange={(event) => handleChange("horario_saida", event.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="observacao">Observação</Label>
            <Textarea
              id="observacao"
              value={formData.observacao}
              onChange={(event) => handleChange("observacao", event.target.value)}
              rows={3}
              placeholder="Informações adicionais..."
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Registrando..." : "Registrar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
