import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface ContratoFormProps {
  contratoId?: string;
  clienteId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

const ContratoForm = ({ contratoId, clienteId, onClose, onSuccess }: ContratoFormProps) => {
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState<any[]>([]);
  const initialState = {
    cliente_id: clienteId || "",
    negocio: "",
    data_inicio: "",
    data_fim: "",
    conq_perd: new Date().getFullYear().toString(),
  };
  const [formData, setFormData] = useState(initialState);

  useEffect(() => {
    loadClientes();
  }, []);

  useEffect(() => {
    if (!contratoId) {
      setFormData((prev) => ({ ...initialState, cliente_id: clienteId || "" }));
      return;
    }

    const loadContrato = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("contratos")
        .select("cliente_id, negocio, data_inicio, data_fim, conq_perd")
        .eq("id", contratoId)
        .single();

      if (error) {
        toast({
          title: "Erro",
          description: "Não foi possível carregar os dados do contrato",
          variant: "destructive",
        });
      } else if (data) {
        setFormData({
          cliente_id: data.cliente_id ?? "",
          negocio: data.negocio ?? "",
          data_inicio: data.data_inicio ?? "",
          data_fim: data.data_fim ?? "",
          conq_perd: data.conq_perd?.toString() ?? new Date().getFullYear().toString(),
        });
      }
      setLoading(false);
    };

    loadContrato();
  }, [contratoId, clienteId]);

  const loadClientes = async () => {
    const { data } = await supabase
      .from("clientes")
      .select("id, razao_social, nome_fantasia")
      .order("razao_social");
    setClientes(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.cliente_id) {
        toast({
          title: "Cliente obrigatório",
          description: "Selecione o cliente responsável pelo contrato.",
          variant: "destructive",
        });
        return;
      }
      if (!formData.negocio.trim()) {
        toast({
          title: "Nome do negócio obrigatório",
          description: "Informe um identificador para o contrato.",
          variant: "destructive",
        });
        return;
      }
      const parsedConqPerd = parseInt(formData.conq_perd, 10);
      if (Number.isNaN(parsedConqPerd)) {
        toast({
          title: "Ano inválido",
          description: "Informe um ano válido para Conq/Perd.",
          variant: "destructive",
        });
        return;
      }

      const dataToSave = {
        cliente_id: formData.cliente_id,
        negocio: formData.negocio.trim(),
        data_inicio: formData.data_inicio,
        data_fim: formData.data_fim || null,
        conq_perd: parsedConqPerd,
      };

      if (contratoId) {
        const { error } = await supabase
          .from("contratos")
          .update(dataToSave)
          .eq("id", contratoId);

        if (error) throw error;

        toast({
          title: "Contrato atualizado",
          description: "Contrato atualizado com sucesso",
        });
      } else {
        const { error } = await supabase.from("contratos").insert([dataToSave]);

        if (error) throw error;

        toast({
          title: "Contrato criado",
          description: "Contrato criado com sucesso",
        });
      }

      onSuccess();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-full">
        <DialogHeader>
          <DialogTitle>{contratoId ? "Editar Contrato" : "Novo Contrato"}</DialogTitle>
          <DialogDescription>
            Preencha os dados do contrato
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="cliente_id">Cliente *</Label>
              <Select
                value={formData.cliente_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, cliente_id: value })
                }
                disabled={!!clienteId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((cliente) => (
                    <SelectItem key={cliente.id} value={cliente.id}>
                      {cliente.nome_fantasia || cliente.razao_social || cliente.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="negocio">Nome do negócio *</Label>
              <Input
                id="negocio"
                value={formData.negocio}
                onChange={(e) =>
                  setFormData({ ...formData, negocio: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="data_inicio">Data Início *</Label>
              <Input
                id="data_inicio"
                type="date"
                value={formData.data_inicio}
                onChange={(e) =>
                  setFormData({ ...formData, data_inicio: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="data_fim">Data Fim</Label>
              <Input
                id="data_fim"
                type="date"
                value={formData.data_fim}
                onChange={(e) =>
                  setFormData({ ...formData, data_fim: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="conq_perd">Ano Conq/Perd *</Label>
              <Input
                id="conq_perd"
                type="number"
                min="1900"
                max="2100"
                value={formData.conq_perd}
                onChange={(e) =>
                  setFormData({ ...formData, conq_perd: e.target.value })
                }
                required
              />
            </div>

          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {contratoId ? "Atualizar" : "Criar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ContratoForm;



