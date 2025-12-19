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
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface ClienteFormProps {
  clienteId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

const ClienteForm = ({ clienteId, onClose, onSuccess }: ClienteFormProps) => {
  const [loading, setLoading] = useState(false);
  const isEditing = Boolean(clienteId);
  const initialState = {
    razao_social: "",
    nome_fantasia: "",
    cnpj: "",
    contato_nome: "",
    contato_email: "",
    contato_telefone: "",
    itens_adicionais: "",
  };
  const [formData, setFormData] = useState(initialState);

  useEffect(() => {
    if (!clienteId) {
      setFormData(initialState);
      return;
    }

    const loadCliente = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("clientes")
        .select("razao_social, nome_fantasia, cnpj, contato_nome, contato_email, contato_telefone, itens_adicionais")
        .eq("id", clienteId)
        .single();

      if (error) {
        toast({
          title: "Erro",
          description: "Não foi possível carregar os dados do cliente",
          variant: "destructive",
        });
      } else if (data) {
        setFormData({
          razao_social: data.razao_social ?? "",
          nome_fantasia: data.nome_fantasia ?? "",
          cnpj: data.cnpj ?? "",
          contato_nome: data.contato_nome ?? "",
          contato_email: data.contato_email ?? "",
          contato_telefone: data.contato_telefone ?? "",
          itens_adicionais: data.itens_adicionais ?? "",
        });
      }
      setLoading(false);
    };

    loadCliente();
  }, [clienteId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const razaoSocial = formData.razao_social.trim();
      const nomeFantasia = formData.nome_fantasia.trim() || razaoSocial;
      const payloadBase = {
        ...formData,
        razao_social: razaoSocial,
        nome_fantasia: nomeFantasia,
        cnpj: formData.cnpj.trim(),
        contato_nome: formData.contato_nome.trim(),
        contato_email: formData.contato_email.trim(),
        contato_telefone: formData.contato_telefone.trim(),
        itens_adicionais: formData.itens_adicionais.trim(),
      };

      if (clienteId) {
        const payload = { ...payloadBase };
        const { error } = await supabase
          .from("clientes")
          .update(payload)
          .eq("id", clienteId);

        if (error) throw error;

        toast({
          title: "Cliente atualizado",
          description: "Cliente atualizado com sucesso",
        });
      } else {
        const payload = { ...payloadBase };
        const { error } = await supabase.from("clientes").insert([payload]);

        if (error) throw error;

        toast({
          title: "Cliente criado",
          description: "Cliente criado com sucesso",
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
          <DialogTitle>{clienteId ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
          <DialogDescription>Preencha os dados do cliente</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="razao_social">Razao Social *</Label>
              <Input
                id="razao_social"
                value={formData.razao_social}
                onChange={(e) =>
                  setFormData({ ...formData, razao_social: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nome_fantasia">Nome Fantasia *</Label>
              <Input
                id="nome_fantasia"
                value={formData.nome_fantasia}
                onChange={(e) =>
                  setFormData({ ...formData, nome_fantasia: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ *</Label>
              <Input
                id="cnpj"
                value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                placeholder="00.000.000/0000-00"
                required
              />
</div>

            <div className="space-y-2">
              <Label htmlFor="contato_nome">Nome do Contato</Label>
              <Input
                id="contato_nome"
                value={formData.contato_nome}
                onChange={(e) =>
                  setFormData({ ...formData, contato_nome: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contato_email">Email do Contato</Label>
              <Input
                id="contato_email"
                type="email"
                value={formData.contato_email}
                onChange={(e) =>
                  setFormData({ ...formData, contato_email: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contato_telefone">Telefone do Contato</Label>
              <Input
                id="contato_telefone"
                value={formData.contato_telefone}
                onChange={(e) =>
                  setFormData({ ...formData, contato_telefone: e.target.value })
                }
                placeholder="(00) 00000-0000"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="itens_adicionais">Itens adicionais</Label>
              <Input
                id="itens_adicionais"
                value={formData.itens_adicionais}
                onChange={(e) =>
                  setFormData({ ...formData, itens_adicionais: e.target.value })
                }
                placeholder="Campos ou observacoes extras do cliente"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {clienteId ? "Atualizar" : "Criar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ClienteForm;
