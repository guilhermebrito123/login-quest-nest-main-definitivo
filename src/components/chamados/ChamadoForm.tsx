import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Paperclip } from "lucide-react";

const chamadoSchema = z.object({
  titulo: z.string().min(3, "Título deve ter no mínimo 3 caracteres"),
  descricao: z.string().optional(),
  tipo: z.string().min(1, "Tipo é obrigatório"),
  categoria: z.enum(["manutencao", "rh", "suprimentos", "atendimento"]),
  subcategoria: z.string().optional(),
  prioridade: z.enum(["baixa", "media", "alta", "critica"]),
  status: z.enum(["aberto", "em_andamento", "pendente", "concluido"]),
  unidade_id: z.string().uuid("Unidade é obrigatória"),
  posto_servico_id: z.string().uuid().optional(),
  contrato_id: z.string().uuid().optional(),
  solicitante_id: z.string().uuid().optional(),
  sla_horas: z.coerce.number().min(1).default(24),
  canal: z.enum(["app", "webhook", "qr"]).default("app"),
});

type ChamadoFormValues = z.infer<typeof chamadoSchema>;

type ChamadoAnexo = {
  id: string;
  nome_arquivo: string;
  caminho_storage: string;
  created_at: string | null;
  usuario?: { full_name?: string | null } | null;
};

type PostoOption = {
  id: string;
  nome: string;
  codigo: string;
  status?: string | null;
};

const ALLOWED_ATTACHMENT_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".jpg",
  ".jpeg",
  ".png",
] as const;

const formatPostoStatus = (status?: string | null) => {
  if (!status) return "";
  const normalized = status.replace(/_/g, " ");
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const subcategorias = {
  manutencao: ["Equipamento", "Veículo", "Infraestrutura"],
  rh: ["Benefícios", "Movimentação", "Dúvidas"],
  suprimentos: ["Material", "Uniforme", "EPI"],
  atendimento: ["Limpeza", "Organização", "Predial", "Outros"],
};

interface ChamadoFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chamado?: any;
  onSuccess: () => void;
}

export function ChamadoForm({ open, onOpenChange, chamado, onSuccess }: ChamadoFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null);
  const chamadoId = chamado?.id ?? null;

  const form = useForm<ChamadoFormValues>({
    resolver: zodResolver(chamadoSchema),
    defaultValues: {
      titulo: "",
      descricao: "",
      tipo: "",
      categoria: "atendimento",
      subcategoria: "",
      prioridade: "media",
      status: "aberto",
      sla_horas: 24,
      canal: "app",
    },
  });

  const selectedContratoId = form.watch("contrato_id");
  const prevContratoRef = useRef<string | null>(null);

  useEffect(() => {
    if (prevContratoRef.current === null) {
      prevContratoRef.current = selectedContratoId ?? null;
      return;
    }

    if (prevContratoRef.current !== selectedContratoId) {
      form.setValue("unidade_id", "");
      form.setValue("posto_servico_id", "");
      prevContratoRef.current = selectedContratoId ?? null;
    }
  }, [selectedContratoId, form]);

  const selectedUnidadeId = form.watch("unidade_id");
  const selectedPostoId = form.watch("posto_servico_id");

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .single();
        
        if (roleData) {
          setUserRole(roleData.role);
        }
      }
    };
    fetchUserData();
  }, []);

  const { data: unidades } = useQuery({
    queryKey: ["unidades", selectedContratoId],
    queryFn: async () => {
      let query = supabase
        .from("unidades")
        .select("id, nome, codigo")
        .eq("status", "ativo")
        .order("nome");

      if (selectedContratoId) {
        query = query.eq("contrato_id", selectedContratoId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: contratos } = useQuery({
    queryKey: ["contratos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contratos")
        .select("id, nome, codigo")
        .eq("status", "ativo")
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: anexosExistentes, isLoading: loadingAnexosExistentes, refetch: refetchAnexosExistentes } = useQuery<ChamadoAnexo[]>({
    queryKey: ["chamado-anexos", chamadoId],
    enabled: !!chamadoId && open,
    initialData: chamado?.anexos as ChamadoAnexo[] | undefined,
    queryFn: async () => {
      if (!chamadoId) return [];

      const { data, error } = await supabase
        .from("chamados_anexos")
        .select(`
          *,
          usuario:profiles(full_name)
        `)
        .eq("chamado_id", chamadoId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as ChamadoAnexo[];
    },
  });

  const { data: postos } = useQuery<PostoOption[]>({
    queryKey: ["postos", selectedUnidadeId],
    queryFn: async () => {
      if (!selectedUnidadeId) return [];
      const { data, error } = await supabase
        .from("postos_servico")
        .select("id, nome, codigo, status")
        .eq("unidade_id", selectedUnidadeId)
        .neq("status", "inativo")
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedUnidadeId,
  });

  const { data: colaboradores } = useQuery({
    queryKey: ["colaboradores", selectedPostoId],
    queryFn: async () => {
      let query = supabase
        .from("colaboradores")
        .select("id, nome_completo, cpf")
        .eq("status_colaborador", "ativo")
        .order("nome_completo");

      if (selectedPostoId) {
        query = query.eq("posto_servico_id", selectedPostoId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const prevPostoRef = useRef<string | null>(null);

  useEffect(() => {
    if (prevPostoRef.current === null) {
      prevPostoRef.current = selectedPostoId ?? null;
      return;
    }

    if (prevPostoRef.current !== selectedPostoId) {
      form.setValue("solicitante_id", "");
      prevPostoRef.current = selectedPostoId ?? null;
    }
  }, [selectedPostoId, form]);

  const existingAttachments =
    anexosExistentes ??
    ((chamado?.anexos as ChamadoAnexo[] | undefined) ?? []);

  const handleFileSelection = (fileList: FileList | null, clearInput?: () => void) => {
    if (!fileList || fileList.length === 0) {
      clearInput?.();
      return;
    }

    const files = Array.from(fileList);
    const accepted: File[] = [];
    const rejected: string[] = [];

    files.forEach((file) => {
      const ext = `.${file.name.split(".").pop()?.toLowerCase() || ""}`;
      if (ALLOWED_ATTACHMENT_EXTENSIONS.includes(ext as typeof ALLOWED_ATTACHMENT_EXTENSIONS[number])) {
        accepted.push(file);
      } else {
        rejected.push(file.name);
      }
    });

    if (rejected.length > 0) {
      toast({
        title: "Formato não suportado",
        description: `Os arquivos (${rejected.join(", ")}) não são permitidos. Use PDF, DOCX, XLS ou imagens.`,
        variant: "destructive",
      });
    }

    // Permite adicionar novos arquivos sem perder sele��es anteriores
    setUploadedFiles((prev) => [...prev, ...accepted]);
    clearInput?.();
  };

  const handleDownloadAnexo = async (anexo: ChamadoAnexo) => {
    try {
      const { data, error } = await supabase.storage
        .from("chamados-anexos")
        .download(anexo.caminho_storage);

      if (error || !data) throw error;

      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = anexo.nome_arquivo;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Erro ao baixar anexo:", error);
      toast({
        title: "Erro ao baixar anexo",
        description: "Não foi possível baixar o arquivo. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteExistingAnexo = async (anexo: ChamadoAnexo) => {
    if (!chamadoId) return;
    try {
      setDeletingAttachmentId(anexo.id);

      // Remove do storage
      const { error: storageError } = await supabase.storage
        .from("chamados-anexos")
        .remove([anexo.caminho_storage]);

      if (storageError) throw storageError;

      // Remove do banco
      const { error: dbError } = await supabase
        .from("chamados_anexos")
        .delete()
        .eq("id", anexo.id);

      if (dbError) throw dbError;

      // Atualiza caches locais para refletir remo��o imediata
      const cacheKeys = [
        ["chamado-anexos", chamadoId],
        ["chamado-anexos-detalhes", chamadoId],
      ];
      cacheKeys.forEach((key) => {
        queryClient.setQueryData<ChamadoAnexo[]>(key, (old) =>
          (old || []).filter((item) => item.id !== anexo.id)
        );
      });

      toast({ title: "Anexo removido com sucesso" });
      await refetchAnexosExistentes();
    } catch (error: any) {
      console.error("Erro ao remover anexo:", error);
      toast({
        title: "Erro ao remover anexo",
        description: error?.message ?? "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setDeletingAttachmentId(null);
    }
  };

  const handleRemoveUploadedFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const selectedCategoria = form.watch("categoria");

  useEffect(() => {
    if (chamado) {
      form.reset({
        titulo: chamado.titulo || "",
        descricao: chamado.descricao || "",
        tipo: chamado.tipo || "",
        categoria: chamado.categoria || "atendimento",
        subcategoria: chamado.subcategoria || "",
        prioridade: chamado.prioridade || "media",
        status: chamado.status || "aberto",
        unidade_id: chamado.unidade_id || "",
        posto_servico_id: chamado.posto_servico_id || "",
        contrato_id: chamado.contrato_id || "",
        solicitante_id: chamado.solicitante_id || "",
        sla_horas: chamado.sla_horas || 24,
        canal: chamado.canal || "app",
      });
    }
  }, [chamado, form]);

const onSubmit = async (data: ChamadoFormValues) => {
  setIsSubmitting(true);
  try {
    const chamadoData: any = {
      titulo: data.titulo,
      descricao: data.descricao || null,
      tipo: data.tipo,
      categoria: data.categoria,
      subcategoria: data.subcategoria || null,
      prioridade: data.prioridade,
      status: data.status,
      unidade_id: data.unidade_id,
      posto_servico_id: data.posto_servico_id || null,
      contrato_id: data.contrato_id || null,
      sla_horas: data.sla_horas,
      canal: data.canal,
      numero: chamado?.numero || `CH-${Date.now()}`,
    };

    let chamadoId = chamado?.id;

    // Criação ou atualização do chamado
    if (chamado) {
      const { error } = await supabase
        .from("chamados")
        .update(chamadoData)
        .eq("id", chamado.id);

      if (error) throw error;
      toast({ title: "Chamado atualizado com sucesso!" });
    } else {
      const { data: newChamado, error } = await supabase
        .from("chamados")
        .insert([chamadoData])
        .select()
        .single();

      if (error) throw error;
      chamadoId = newChamado.id;
      toast({ title: "Chamado criado com sucesso!" });
    }

    // 👉 Upload de arquivos no Supabase Storage
    if (uploadedFiles.length > 0 && chamadoId) {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Não foi possível identificar o usuário para salvar os anexos.");
      }

      for (const file of uploadedFiles) {
        const fileExtension = `.${file.name.split(".").pop()?.toLowerCase() || ""}`;

        if (
          !ALLOWED_ATTACHMENT_EXTENSIONS.includes(
            fileExtension as (typeof ALLOWED_ATTACHMENT_EXTENSIONS)[number]
          )
        ) {
          toast({
            title: "Formato não permitido",
            description: `O arquivo ${file.name} não está em um formato suportado.`,
            variant: "destructive",
          });
          continue;
        }

        const sanitizedFileName = file.name
          .toLowerCase()
          .replace(/[^\w.-]/g, "_");

        const storagePath = `${chamadoId}/${Date.now()}-${sanitizedFileName}`;

        // Upload no bucket "chamados-anexos"
        const { error: uploadError } = await supabase.storage
          .from("chamados-anexos") // ⚠ certifica que esse é o nome do bucket no Storage
          .upload(storagePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          console.error("Erro ao fazer upload:", uploadError);
          toast({
            title: "Erro ao enviar anexo",
            description: `Não foi possível enviar o arquivo ${file.name}.`,
            variant: "destructive",
          });
          continue;
        }

        // Registro do anexo na tabela chamados_anexos
        const { error: insertError } = await supabase
          .from("chamados_anexos")
          .insert({
            chamado_id: chamadoId,
            usuario_id: user.id,
            nome_arquivo: file.name,
            caminho_storage: storagePath,
            tipo_arquivo: file.type,
            tamanho_bytes: file.size,
          });

        if (insertError) {
          console.error("Erro ao registrar anexo:", insertError);
          toast({
            title: "Erro ao registrar anexo",
            description: `O arquivo ${file.name} foi enviado, mas não foi registrado no banco.`,
            variant: "destructive",
          });
        }
      }
    }

    onSuccess();
    form.reset();
    setUploadedFiles([]);
  } catch (error: any) {
    console.error(error);
    toast({
      title: "Erro ao salvar chamado",
      description: error.message ?? "Ocorreu um erro inesperado.",
      variant: "destructive",
    });
  } finally {
    setIsSubmitting(false);
  }
};


  const isAdmin = userRole === "admin";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{chamado ? "Editar Chamado" : "Novo Chamado"}</DialogTitle>
          <DialogDescription>
            {chamado
              ? "Atualize dados, anexos e informações operacionais deste chamado."
              : "Preencha os campos para registrar um novo chamado."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="titulo"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Título *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Digite o título do chamado" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ex: Corretiva, Preventiva" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="categoria"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="manutencao">Manutenção</SelectItem>
                        <SelectItem value="rh">RH</SelectItem>
                        <SelectItem value="suprimentos">Suprimentos</SelectItem>
                        <SelectItem value="atendimento">Atendimento</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="subcategoria"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subcategoria</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {subcategorias[selectedCategoria]?.map((sub) => (
                          <SelectItem key={sub} value={sub.toLowerCase()}>
                            {sub}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="prioridade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prioridade *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="baixa">Baixa</SelectItem>
                        <SelectItem value="media">Média</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                        <SelectItem value="critica">Crítica</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="aberto">Aberto</SelectItem>
                        <SelectItem value="em_andamento">Em Andamento</SelectItem>
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="concluido">Concluído</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sla_horas"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SLA (horas) *</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} min={1} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contrato_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contrato</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o contrato" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {contratos?.map((contrato) => (
                          <SelectItem key={contrato.id} value={contrato.id}>
                            {contrato.codigo} - {contrato.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="unidade_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unidade *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a unidade" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {unidades?.map((unidade) => (
                          <SelectItem key={unidade.id} value={unidade.id}>
                            {unidade.codigo} - {unidade.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="posto_servico_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Posto de Serviço</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!selectedUnidadeId}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={!selectedUnidadeId ? "Selecione a unidade primeiro" : "Selecione o posto"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {postos?.map((posto) => {
                          const statusLabel = formatPostoStatus(posto.status);
                          return (
                            <SelectItem key={posto.id} value={posto.id}>
                              {posto.codigo} - {posto.nome}
                              {statusLabel ? ` (${statusLabel})` : ""}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isAdmin && (
                <FormField
                  control={form.control}
                  name="solicitante_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Solicitante</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o solicitante" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {colaboradores?.map((colab) => (
                            <SelectItem key={colab.id} value={colab.id}>
                              {colab.nome_completo}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="descricao"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Descreva os detalhes do chamado" rows={4} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormItem className="md:col-span-2">
                <FormLabel>Anexos</FormLabel>
                <FormControl>
                  <Input
                    type="file"
                    multiple
                    accept=".doc,.docx,.pdf,.xls,.xlsx,.jpg,.jpeg,.png,image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={(e) =>
                      handleFileSelection(e.target.files, () => {
                        e.target.value = "";
                      })
                    }
                  />
                </FormControl>
                {uploadedFiles.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {uploadedFiles.map((file, index) => (
                      <div
                        key={file.name + index}
                        className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveUploadedFile(index)}
                        >
                          Remover
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </FormItem>

              {chamado && (
                <div className="md:col-span-2 space-y-2">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Paperclip className="h-4 w-4" />
                    Anexos atuais
                  </p>
                  {loadingAnexosExistentes ? (
                    <p className="text-sm text-muted-foreground">Carregando anexos...</p>
                  ) : existingAttachments.length > 0 ? (
                    <div className="space-y-2">
                      {existingAttachments.map((anexo) => (
                        <div
                          key={anexo.id}
                          className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">{anexo.nome_arquivo}</p>
                            <p className="text-xs text-muted-foreground">
                              {anexo.created_at
                                ? new Date(anexo.created_at).toLocaleString("pt-BR")
                                : "Sem data"}
                              {anexo.usuario?.full_name ? ` • ${anexo.usuario.full_name}` : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadAnexo(anexo)}
                            >
                              Baixar
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              disabled={deletingAttachmentId === anexo.id}
                              onClick={() => handleDeleteExistingAnexo(anexo)}
                            >
                              {deletingAttachmentId === anexo.id ? "Removendo..." : "Remover"}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nenhum anexo cadastrado para este chamado.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {chamado ? "Atualizar" : "Criar"} Chamado
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
