import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
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
import { toast } from "sonner";

const BUCKET = "diaristas-anexos";

const SPECIFIC_ATTACHMENT_FIELDS = [
  { key: "anexo_cpf", label: "Documento CPF" },
  { key: "anexo_comprovante_endereco", label: "Comprovante de endereco" },
  { key: "anexo_dados_bancarios", label: "Dados bancarios" },
  { key: "anexo_possui_antecedente", label: "Comprovante antecedentes" },
] as const;

const BRAZIL_BANKS = [
  "Banco do Brasil",
  "Caixa Economica Federal",
  "Bradesco",
  "Itau Unibanco",
  "Santander",
  "Banco Safra",
  "Banco BV",
  "Banco Inter",
  "Nubank",
  "C6 Bank",
  "Banco Pan",
  "Banco Original",
  "Banco BTG Pactual",
  "Banco Daycoval",
  "Banco Mercantil do Brasil",
  "Banco Banrisul",
  "Banco Sicoob",
  "Banco Sicredi",
  "Banco Modal",
  "Banco Sofisa",
  "Banco Cooperativo do Brasil",
  "Banco Cooperativo Sicredi",
  "Banco Neon",
  "Banco Rendimento",
  "Banco Topazio",
  "Banco BS2",
  "Banco Banestes",
  "Banco Industrial do Brasil",
  "Banco Agibank",
  "Banco Votorantim",
] as const;

const stripNonDigits = (value: string) => value.replace(/\D/g, "");

const formatCpf = (value: string) => {
  const digits = stripNonDigits(value).slice(0, 11);
  const part1 = digits.slice(0, 3);
  const part2 = digits.slice(3, 6);
  const part3 = digits.slice(6, 9);
  const part4 = digits.slice(9, 11);
  let result = part1;
  if (part2) result += `.${part2}`;
  if (part3) result += `.${part3}`;
  if (part4) result += `-${part4}`;
  return result;
};

const formatCep = (value: string) => {
  const digits = stripNonDigits(value).slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
};

const formatTelefone = (value: string) => {
  const digits = stripNonDigits(value).slice(0, 11);
  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (rest.length <= 4) return `(${ddd}) ${rest}`;
  const splitIndex = rest.length <= 8 ? 4 : 5;
  const first = rest.slice(0, splitIndex);
  const second = rest.slice(splitIndex);
  return `(${ddd}) ${first}${second ? `-${second}` : ""}`;
};

type SpecificAttachmentKey = (typeof SPECIFIC_ATTACHMENT_FIELDS)[number]["key"];

interface DiaristaFormState {
  nome_completo: string;
  cpf: string;
  cep: string;
  endereco: string;
  cidade: string;
  telefone: string;
  email: string;
  possui_antecedente: boolean;
  status: "ativo" | "inativo" | "desligado";
  banco: string;
  agencia: string;
  tipo_conta: "conta corrente" | "conta poupanca" | "conta salario";
  numero_conta: string;
  pix: string;
  pix_pertence_beneficiario: boolean | null;
}

const createInitialFormState = (): DiaristaFormState => ({
  nome_completo: "",
  cpf: "",
  cep: "",
  endereco: "",
  cidade: "",
  telefone: "",
  email: "",
  possui_antecedente: false,
  status: "ativo",
  banco: "",
  agencia: "",
  tipo_conta: "conta corrente",
  numero_conta: "",
  pix: "",
  pix_pertence_beneficiario: null,
});

const createEmptySpecificFiles = () =>
  SPECIFIC_ATTACHMENT_FIELDS.reduce(
    (acc, field) => {
      acc[field.key] = null;
      return acc;
    },
    {} as Record<SpecificAttachmentKey, File | null>
  );

const createEmptySpecificAttachmentState = () =>
  SPECIFIC_ATTACHMENT_FIELDS.reduce(
    (acc, field) => {
      acc[field.key] = "";
      return acc;
    },
    {} as Record<SpecificAttachmentKey, string>
  );

interface DiaristaAnexo {
  id: string;
  nome_arquivo: string;
  caminho_storage: string;
  tipo_arquivo: string | null;
  tamanho_bytes: number | null;
  created_at: string;
}

interface DiaristaFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  diarista?: any;
}

export function DiaristaForm({ open, onClose, onSuccess, diarista }: DiaristaFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<DiaristaFormState>(createInitialFormState());
  const [attachments, setAttachments] = useState<DiaristaAnexo[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [specificAttachments, setSpecificAttachments] = useState<Record<SpecificAttachmentKey, string>>(
    createEmptySpecificAttachmentState()
  );
  const [specificFiles, setSpecificFiles] = useState<Record<SpecificAttachmentKey, File | null>>(
    createEmptySpecificFiles()
  );
  const [cepLoading, setCepLoading] = useState(false);
  const lastCepLookupRef = useRef<string>(""); 

  const loadAttachments = useCallback(async () => {
    if (!diarista?.id) {
      setAttachments([]);
      return;
    }
    setAttachmentsLoading(true);
    try {
      const { data, error } = await supabase
        .from("diaristas_anexos")
        .select("*")
        .eq("diarista_id", diarista.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setAttachments(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar anexos: " + error.message);
    } finally {
      setAttachmentsLoading(false);
    }
  }, [diarista?.id]);

  const loadSpecificAttachments = useCallback(() => {
    const nextState = createEmptySpecificAttachmentState();
    if (diarista) {
      SPECIFIC_ATTACHMENT_FIELDS.forEach(({ key }) => {
        nextState[key] = diarista[key] || "";
      });
    }
    setSpecificAttachments(nextState);
  }, [diarista]);

  useEffect(() => {
    if (diarista) {
      setFormData({
        nome_completo: diarista.nome_completo || "",
        cpf: formatCpf(diarista.cpf || ""),
        cep: formatCep(diarista.cep || ""),
        endereco: diarista.endereco || "",
        cidade: diarista.cidade || "",
        telefone: formatTelefone(diarista.telefone || ""),
        email: diarista.email || "",
        possui_antecedente: diarista.possui_antecedente || false,
        status: diarista.status || "ativo",
        banco: diarista.banco || "",
        agencia: diarista.agencia || "",
        tipo_conta: diarista.tipo_conta || "conta corrente",
        numero_conta: diarista.numero_conta || "",
        pix: diarista.pix || "",
        pix_pertence_beneficiario:
          diarista.pix_pertence_beneficiario === null || diarista.pix_pertence_beneficiario === undefined
            ? null
            : !!diarista.pix_pertence_beneficiario,
      });
      lastCepLookupRef.current = diarista.cep?.replace(/\D/g, "") || "";
      loadAttachments();
      loadSpecificAttachments();
    } else {
      setFormData(createInitialFormState());
      setAttachments([]);
      loadSpecificAttachments();
      lastCepLookupRef.current = "";
    }
    setNewFiles([]);
    setSpecificFiles(createEmptySpecificFiles());
  }, [diarista, open, loadAttachments, loadSpecificAttachments]);

  const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    setNewFiles((prev) => [...prev, ...Array.from(files)]);
    event.target.value = "";
  };

  const handleSpecificFileChange = (key: SpecificAttachmentKey, fileList: FileList | null) => {
    const file = fileList?.[0] || null;
    setSpecificFiles((prev) => ({ ...prev, [key]: file }));
  };

  const removeSpecificFile = (key: SpecificAttachmentKey) => {
    setSpecificFiles((prev) => ({ ...prev, [key]: null }));
  };

  const removeNewFile = (index: number) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCepChange = (value: string) => {
    const digits = stripNonDigits(value).slice(0, 8);
    const formatted = formatCep(digits);
    setFormData((prev) => ({ ...prev, cep: formatted }));
    if (digits.length < 8) {
      lastCepLookupRef.current = "";
    }
  };

  useEffect(() => {
    const digits = formData.cep.replace(/\D/g, "");
    if (digits.length !== 8 || digits === lastCepLookupRef.current) return;

    let cancelled = false;
    const fetchCep = async () => {
      setCepLoading(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
        if (!response.ok) throw new Error("CEP inválido");
        const data = await response.json();
        if (data.erro) throw new Error("CEP não encontrado");
        if (cancelled) return;
        setFormData((prev) => ({
          ...prev,
          endereco: data.logradouro
            ? `${data.logradouro}${data.bairro ? ` - ${data.bairro}` : ""}`
            : prev.endereco,
          cidade: data.localidade || prev.cidade,
        }));
        lastCepLookupRef.current = digits;
        toast.success("Endereço preenchido automaticamente");
      } catch (error: any) {
        if (cancelled) return;
        lastCepLookupRef.current = "";
        toast.error(error?.message || "Erro ao buscar CEP");
      } finally {
        if (!cancelled) setCepLoading(false);
      }
    };

    fetchCep();
    return () => {
      cancelled = true;
    };
  }, [formData.cep]);

  const deleteAttachment = async (attachment: DiaristaAnexo) => {
    setAttachmentsLoading(true);
    try {
      const { error: storageError } = await supabase.storage.from(BUCKET).remove([attachment.caminho_storage]);
      if (storageError) throw storageError;

      const { error: dbError } = await supabase.from("diaristas_anexos").delete().eq("id", attachment.id);
      if (dbError) throw dbError;

      toast.success("Anexo removido");
      loadAttachments();
    } catch (error: any) {
      toast.error("Erro ao remover anexo: " + error.message);
    } finally {
      setAttachmentsLoading(false);
    }
  };

  const getSignedUrl = async (path: string) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 120);
    if (error || !data?.signedUrl) {
      throw new Error("Link temporario indisponivel");
    }
    return data.signedUrl;
  };

  const handleViewAttachment = async (attachment: DiaristaAnexo | { nome?: string; caminho_storage: string }) => {
    try {
      const url = await getSignedUrl(attachment.caminho_storage);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      toast.error("Erro ao visualizar anexo: " + (error?.message || "Tente novamente"));
    }
  };

  const handleDownloadAttachment = async (attachment: DiaristaAnexo) => {
    try {
      const url = await getSignedUrl(attachment.caminho_storage);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.nome_arquivo || "anexo";
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error: any) {
      toast.error("Erro ao baixar anexo: " + (error?.message || "Tente novamente"));
    }
  };

  const uploadAttachments = async (diaristaId: string) => {
    if (!newFiles.length) return;

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      throw new Error("Usuario nao autenticado");
    }

    for (const file of newFiles) {
      const path = `${diaristaId}/${Date.now()}-${file.name}`;
      const { error: storageError } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
      if (storageError) throw storageError;

      const { error: insertError } = await supabase.from("diaristas_anexos").insert({
        diarista_id: diaristaId,
        nome_arquivo: file.name,
        caminho_storage: path,
        tipo_arquivo: file.type || null,
        tamanho_bytes: file.size,
        uploaded_by: authData.user.id,
      });

      if (insertError) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw insertError;
      }
    }

    setNewFiles([]);
    await loadAttachments();
  };

  const uploadSpecificAttachments = async (diaristaId: string) => {
    const nextPaths = { ...specificAttachments };

    for (const field of SPECIFIC_ATTACHMENT_FIELDS) {
      const file = specificFiles[field.key];
      if (!file) continue;

      const path = `${diaristaId}/docs/${field.key}-${Date.now()}-${file.name}`;
      const { error: storageError } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
      if (storageError) throw storageError;

      const existingPath = nextPaths[field.key];
      if (existingPath) {
        await supabase.storage.from(BUCKET).remove([existingPath]);
      }

      nextPaths[field.key] = path;
    }

    for (const field of SPECIFIC_ATTACHMENT_FIELDS) {
      if (!nextPaths[field.key]) {
        nextPaths[field.key] = "";
      }
    }

    setSpecificAttachments(nextPaths);
    setSpecificFiles(createEmptySpecificFiles());

    return nextPaths;
  };

  const getSpecificAttachmentLabel = (key: SpecificAttachmentKey) =>
    SPECIFIC_ATTACHMENT_FIELDS.find((field) => field.key === key)?.label || "Documento";

  const handleViewSpecificAttachment = async (key: SpecificAttachmentKey) => {
    const path = specificAttachments[key];
    if (!path) return;
    try {
      await handleViewAttachment({ nome: key, caminho_storage: path });
    } catch (error: any) {
      toast.error("Erro ao visualizar anexo: " + error.message);
    }
  };

  const handleDownloadSpecificAttachment = async (key: SpecificAttachmentKey) => {
    const path = specificAttachments[key];
    if (!path) return;

    try {
      const url = await getSignedUrl(path);
      const link = document.createElement("a");
      link.href = url;
      link.download = getSpecificAttachmentLabel(key);
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error: any) {
      toast.error("Erro ao baixar anexo: " + error.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.possui_antecedente) {
      toast.error("Nao e permitido cadastrar diaristas com antecedentes criminais");
      return;
    }

    const payload = {
      ...formData,
      cpf: stripNonDigits(formData.cpf),
      cep: stripNonDigits(formData.cep),
      telefone: stripNonDigits(formData.telefone),
    };
    const hasSpecificAttachmentChanges = Object.values(specificFiles).some((file) => Boolean(file));
    const hasNewFiles = newFiles.length > 0;
    const hasFieldChanges = diarista
      ? (diarista.nome_completo || "") !== payload.nome_completo ||
        stripNonDigits(String(diarista.cpf ?? "")) !== payload.cpf ||
        stripNonDigits(String(diarista.cep ?? "")) !== payload.cep ||
        (diarista.endereco || "") !== payload.endereco ||
        (diarista.cidade || "") !== payload.cidade ||
        stripNonDigits(String(diarista.telefone ?? "")) !== payload.telefone ||
        (diarista.email || "") !== payload.email ||
        Boolean(diarista.possui_antecedente) !== payload.possui_antecedente ||
        (diarista.status || "ativo") !== payload.status ||
        (diarista.banco || "") !== payload.banco ||
        (diarista.agencia || "") !== payload.agencia ||
        (diarista.tipo_conta || "conta corrente") !== payload.tipo_conta ||
        (diarista.numero_conta || "") !== payload.numero_conta ||
        (diarista.pix || "") !== payload.pix ||
        (diarista.pix_pertence_beneficiario ?? null) !== payload.pix_pertence_beneficiario
      : false;
    const hasUpdateChanges = hasFieldChanges || hasSpecificAttachmentChanges;

    let motivoAlteracao: string | null = null;
    if (diarista) {
      if (!hasUpdateChanges && !hasNewFiles) {
        toast.info("Nenhuma alteracao para salvar.");
        return;
      }
      if (hasUpdateChanges) {
        if (typeof window === "undefined") return;
        const motivo = window.prompt("Informe o motivo da alteracao do diarista.");
        const trimmed = (motivo ?? "").trim();
        if (!trimmed) {
          toast.error("Motivo da alteracao obrigatorio.");
          return;
        }
        motivoAlteracao = trimmed;
      }
    }

    setLoading(true);

    try {
      const diaristaId = diarista?.id ?? crypto.randomUUID();
      let updatedDiarista = false;

      if (diarista) {
        if (hasUpdateChanges) {
          const finalSpecificPaths = await uploadSpecificAttachments(diaristaId);
          const { error } = await supabase
            .from("diaristas")
            .update({
              ...payload,
              ...finalSpecificPaths,
              motivo_alteracao: motivoAlteracao,
            })
            .eq("id", diaristaId);
          if (error) throw error;
          updatedDiarista = true;
          toast.success("Diarista atualizado com sucesso");
        }
      } else {
        const finalSpecificPaths = await uploadSpecificAttachments(diaristaId);
        const { error } = await supabase.from("diaristas").insert([
          {
            id: diaristaId,
            ...payload,
            ...finalSpecificPaths,
          },
        ]);
        if (error) throw error;
        updatedDiarista = true;
        toast.success("Diarista cadastrado com sucesso");
      }

      await uploadAttachments(diaristaId);
      if (diarista && !updatedDiarista && hasNewFiles) {
        toast.success("Anexos atualizados.");
      }

      onSuccess();
    } catch (error: any) {
      toast.error("Erro ao salvar diarista: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{diarista ? "Editar Diarista" : "Novo Diarista"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="nome_completo">Nome completo *</Label>
              <Input
                id="nome_completo"
                value={formData.nome_completo}
                onChange={(e) => setFormData({ ...formData, nome_completo: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cpf">CPF</Label>
              <Input
                id="cpf"
                value={formData.cpf}
                onChange={(e) => setFormData({ ...formData, cpf: formatCpf(e.target.value) })}
                placeholder="000.000.000-00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cep">CEP</Label>
              <Input
                id="cep"
                value={formData.cep}
                onChange={(e) => handleCepChange(e.target.value)}
                placeholder="00000-000"
              />
              {cepLoading && <p className="text-xs text-muted-foreground">Consultando CEP...</p>}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="endereco">Endereco</Label>
              <Input
                id="endereco"
                value={formData.endereco}
                onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cidade">Cidade</Label>
              <Input
                id="cidade"
                value={formData.cidade}
                onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                type="tel"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: formatTelefone(e.target.value) })}
                placeholder="(00) 00000-0000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="possui_antecedente">Possui antecedente criminal?</Label>
              <Select
                value={formData.possui_antecedente ? "true" : "false"}
                onValueChange={(value) => setFormData({ ...formData, possui_antecedente: value === "true" })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">Nao</SelectItem>
                  <SelectItem value="true">Sim</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as DiaristaFormState["status"] })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                  <SelectItem value="desligado">Desligado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border rounded-md p-4 space-y-4">
            <p className="text-sm font-medium">Dados bancarios</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="banco">Banco</Label>
                <Select
                  value={formData.banco}
                  onValueChange={(value) => setFormData({ ...formData, banco: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o banco" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {BRAZIL_BANKS.map((bank) => (
                      <SelectItem key={bank} value={bank}>
                        {bank}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="agencia">Agencia</Label>
                <Input
                  id="agencia"
                  value={formData.agencia}
                  onChange={(e) => setFormData({ ...formData, agencia: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tipo_conta">Tipo de conta</Label>
                <Select
                  value={formData.tipo_conta}
                  onValueChange={(value) =>
                    setFormData({ ...formData, tipo_conta: value as DiaristaFormState["tipo_conta"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conta corrente">Conta corrente</SelectItem>
                    <SelectItem value="conta poupanca">Conta poupanca</SelectItem>
                    <SelectItem value="conta salario">Conta salario</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="numero_conta">Numero da conta</Label>
                <Input
                  id="numero_conta"
                  value={formData.numero_conta}
                  onChange={(e) => setFormData({ ...formData, numero_conta: e.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="pix">Chave PIX *</Label>
                <Input
                  id="pix"
                  value={formData.pix}
                  onChange={(e) => setFormData({ ...formData, pix: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="pix_pertence_beneficiario">PIX pertence ao diarista?</Label>
                <Select
                  value={
                    formData.pix_pertence_beneficiario === null
                      ? "unset"
                      : formData.pix_pertence_beneficiario
                        ? "true"
                        : "false"
                  }
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      pix_pertence_beneficiario: value === "unset" ? null : value === "true",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma opção" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unset" disabled>
                      Selecione
                    </SelectItem>
                    <SelectItem value="true">Sim</SelectItem>
                    <SelectItem value="false">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-sm font-medium">Documentos</p>
            <div className="grid grid-cols-1 gap-4">
              {SPECIFIC_ATTACHMENT_FIELDS.map(({ key, label }) => {
                const currentPath = specificAttachments[key];
                const selectedFile = specificFiles[key];
                return (
                  <div key={key} className="rounded-md border p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label>{label}</Label>
                      {currentPath && (
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => handleViewSpecificAttachment(key)}>
                            Visualizar
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => handleDownloadSpecificAttachment(key)}>
                            Baixar
                          </Button>
                        </div>
                      )}
                    </div>
                    <Input type="file" onChange={(e) => handleSpecificFileChange(key, e.target.files)} />
                    {selectedFile ? (
                      <div className="flex items-center justify-between text-xs">
                        <span className="truncate">{selectedFile.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => removeSpecificFile(key)}
                        >
                          Remover
                        </Button>
                      </div>
                    ) : currentPath ? (
                      <p className="text-xs text-muted-foreground break-all">
                        Arquivo atual: {currentPath.split("/").pop()}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Nenhum arquivo enviado.</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <Label>Documentos / anexos adicionais</Label>
            <Input type="file" multiple onChange={handleFilesSelected} />

            {newFiles.length > 0 && (
              <div className="rounded-md border p-3 space-y-2 text-sm">
                <p className="font-medium">Anexos novos</p>
                {newFiles.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate">{file.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => removeNewFile(index)}
                    >
                      Remover
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-md border p-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-medium">Anexos existentes</p>
                {attachmentsLoading && <span className="text-xs text-muted-foreground">Atualizando...</span>}
              </div>
              {attachments.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum anexo cadastrado.</p>
              ) : (
                attachments.map((attachment) => (
                  <div key={attachment.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate">{attachment.nome_arquivo}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => handleViewAttachment(attachment)}
                      >
                        Visualizar
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => handleDownloadAttachment(attachment)}
                      >
                        Baixar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => deleteAttachment(attachment)}
                      >
                        Excluir
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : diarista ? "Atualizar" : "Cadastrar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
