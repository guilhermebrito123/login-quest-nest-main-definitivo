import { useState, useEffect } from "react";
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

interface UnidadeFormProps {
  unidadeId?: string;
  contratoId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

const UnidadeForm = ({ unidadeId, contratoId, onClose, onSuccess }: UnidadeFormProps) => {
  const [loading, setLoading] = useState(false);
  const [contratos, setContratos] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    contrato_id: contratoId || "",
    nome: "",
    endereco: "",
    cidade: "",
    uf: "",
    cep: "",
    latitude: "",
    longitude: "",
    created_at: "",
    faturamento_vendido: "",
  });
  const [cepLoading, setCepLoading] = useState(false);

  useEffect(() => {
    loadContratos();
    if (unidadeId) {
      loadUnidade();
    }
  }, [unidadeId]);

  const loadContratos = async () => {
    const { data } = await supabase
      .from("contratos")
      .select("id, negocio, conq_perd")
      .order("negocio");
    setContratos(data || []);
  };

  const loadUnidade = async () => {
    if (!unidadeId) return;

    const { data, error } = await supabase
      .from("unidades")
      .select("*")
      .eq("id", unidadeId)
      .single();

    if (error) {
      toast({
        title: "Erro ao carregar unidade",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    if (data) {
      setFormData({
        contrato_id: data.contrato_id || "",
        nome: data.nome,
        endereco: data.endereco || "",
        cidade: data.cidade || "",
        uf: data.uf || "",
        cep: data.cep || "",
        latitude: data.latitude ? String(data.latitude) : "",
        longitude: data.longitude ? String(data.longitude) : "",
        created_at: data.created_at || "",
        faturamento_vendido:
          data.faturamento_vendido !== undefined && data.faturamento_vendido !== null
            ? String(data.faturamento_vendido)
            : "",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.contrato_id) {
      toast({
        title: "Contrato obrigatório",
        description: "Selecione um contrato para vincular a unidade.",
        variant: "destructive",
      });
      return;
    }

    const trimmedNome = formData.nome.trim();
    const trimmedEndereco = formData.endereco.trim();
    const trimmedCidade = formData.cidade.trim();
    const trimmedUf = formData.uf.trim().toUpperCase();

    if (!trimmedNome || !trimmedEndereco || !trimmedCidade || trimmedUf.length !== 2) {
      toast({
        title: "Preencha todos os campos obrigatórios",
        description: "Nome, endereço, cidade e UF precisam ser informados.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.latitude || !formData.longitude) {
      toast({
        title: "Coordenadas obrigatórias",
        description: "Informe latitude e longitude válidas para a unidade.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.faturamento_vendido) {
      toast({
        title: "Faturamento obrigatório",
        description: "Informe o faturamento vendido da unidade.",
        variant: "destructive",
      });
      return;
    }

    const latitude = parseFloat(formData.latitude);
    const longitude = parseFloat(formData.longitude);
    const faturamento = parseFloat(formData.faturamento_vendido);

    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      toast({
        title: "Coordenadas inválidas",
        description: "Latitude e longitude devem ser números válidos.",
        variant: "destructive",
      });
      return;
    }

    if (Number.isNaN(faturamento)) {
      toast({
        title: "Valor inválido",
        description: "O faturamento vendido deve ser um número válido.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const now = new Date().toISOString();
      const payload = {
        contrato_id: formData.contrato_id,
        nome: trimmedNome,
        endereco: trimmedEndereco,
        cidade: trimmedCidade,
        uf: trimmedUf,
        cep: formData.cep || null,
        latitude,
        longitude,
        faturamento_vendido: faturamento,
        created_at: unidadeId ? formData.created_at || now : now,
        updated_at: now,
      };

      if (unidadeId) {
        const { error } = await supabase.from("unidades").update(payload).eq("id", unidadeId);
        if (error) throw error;
        toast({
          title: "Unidade atualizada",
          description: "Unidade atualizada com sucesso",
        });
      } else {
        const { error } = await supabase.from("unidades").insert([payload]);
        if (error) throw error;
        toast({
          title: "Unidade criada",
          description: "Unidade criada com sucesso",
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

  const handleCepChange = async (value: string) => {
    setFormData((prev) => ({ ...prev, cep: value }));

    const digitsOnly = value.replace(/\D/g, "");
    if (digitsOnly.length !== 8) return;

    try {
      setCepLoading(true);
      const response = await fetch(`https://viacep.com.br/ws/${digitsOnly}/json/`);
      if (!response.ok) return;
      const data = await response.json();
      if (data.erro) {
        toast({
          title: "CEP não encontrado",
          description: "Verifique o CEP informado e tente novamente.",
          variant: "destructive",
        });
        return;
      }
      setFormData((prev) => ({
        ...prev,
        endereco: data.logradouro || prev.endereco,
        cidade: data.localidade || prev.cidade,
        uf: (data.uf || prev.uf || "").toUpperCase(),
        cep: value,
      }));
    } catch (error) {
      console.error("Erro ao buscar CEP", error);
      toast({
        title: "Erro ao buscar CEP",
        description: "Não foi possível obter o endereço automaticamente.",
        variant: "destructive",
      });
    } finally {
      setCepLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{unidadeId ? "Editar Unidade" : "Nova Unidade"}</DialogTitle>
          <DialogDescription>Preencha os dados da unidade</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="contrato_id">Contrato *</Label>
              <Select
                value={formData.contrato_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, contrato_id: value })
                }
                disabled={!!contratoId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um contrato" />
                </SelectTrigger>
                <SelectContent>
                  {contratos.map((contrato) => (
                    <SelectItem key={contrato.id} value={contrato.id}>
                      {contrato.negocio} ({contrato.conq_perd})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="faturamento_vendido">Faturamento vendido (R$)</Label>
              <Input
                id="faturamento_vendido"
                type="number"
                step="0.01"
                value={formData.faturamento_vendido}
                onChange={(e) => setFormData({ ...formData, faturamento_vendido: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="endereco">Endereço</Label>
              <Input
                id="endereco"
                value={formData.endereco}
                onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cidade">Cidade</Label>
              <Input
                id="cidade"
                value={formData.cidade}
                onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="uf">UF</Label>
              <Input
                id="uf"
                value={formData.uf}
                onChange={(e) => setFormData({ ...formData, uf: e.target.value.toUpperCase() })}
                maxLength={2}
                placeholder="SP"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cep">CEP</Label>
              <Input
                id="cep"
                value={formData.cep}
                onChange={(e) => handleCepChange(e.target.value)}
                placeholder="00000-000"
                disabled={cepLoading}
              />
              {cepLoading && (
                <p className="text-xs text-muted-foreground">Buscando endereço...</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="latitude">Latitude</Label>
              <Input
                id="latitude"
                type="number"
                step="any"
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                placeholder="-15.7801"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="longitude">Longitude</Label>
              <Input
                id="longitude"
                type="number"
                step="any"
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                placeholder="-47.9292"
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
              {unidadeId ? "Atualizar" : "Criar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default UnidadeForm;
