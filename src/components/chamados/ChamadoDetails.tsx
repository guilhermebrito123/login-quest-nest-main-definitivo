import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileDown,
  History,
  Loader2,
  MessageSquare,
  Paperclip,
  Pencil,
  Send,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import type { AccessLevel, UserRole } from "@/hooks/useAccessContext";
import type { ChamadoLocalOption } from "@/components/chamados/ChamadoForm";
import {
  formatChamadoNumero,
  formatChamadoPrioridade,
  formatChamadoStatus,
  formatDateTime,
  formatHistoricoOperacao,
  getChamadoPrioridadeClass,
  getChamadoStatusClass,
  sanitizeStorageFileName,
} from "@/lib/chamados";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ChamadoRow = Tables<"chamados">;
type ChamadoInteracaoRow = Tables<"chamado_interacoes">;
type ChamadoAnexoRow = Tables<"chamado_anexos">;
type ChamadoHistoricoRow = Tables<"chamado_historico">;
type UsuarioPublicoRow = Tables<"usuarios_public">;

type UsuarioResumo = {
  id: string;
  full_name: string | null;
  email?: string | null;
  role?: string | null;
};

type CategoriaResumo = {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
};

type ChamadoDetalhado = ChamadoRow & {
  categoria?: CategoriaResumo | null;
  solicitante?: UsuarioResumo | null;
  resolvido_por_usuario?: UsuarioResumo | null;
};

type ChamadoInteracaoDetalhada = ChamadoInteracaoRow & {
  autor?: UsuarioResumo | null;
};

type ChamadoAnexoDetalhado = ChamadoAnexoRow & {
  uploader?: UsuarioResumo | null;
};

type ChamadoHistoricoDetalhado = ChamadoHistoricoRow & {
  usuario?: UsuarioResumo | null;
};

type ChamadoResponsavelOption = {
  id: string;
  full_name: string | null;
  cargo: string | null;
};

const CHAMADO_STATUS_TRANSITIONS: Record<ChamadoRow["status"], ChamadoRow["status"][]> = {
  aberto: ["em_andamento", "cancelado"],
  em_andamento: ["aberto", "resolvido", "cancelado"],
  pendente: [],
  resolvido: ["em_andamento", "fechado", "cancelado"],
  fechado: [],
  cancelado: ["aberto"],
};

interface ChamadoDetailsProps {
  chamadoId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (chamado: ChamadoRow) => void;
  onDelete: (chamado: Pick<ChamadoRow, "id" | "solicitante_id">) => Promise<void> | void;
  currentUserId: string | null;
  userRole: UserRole;
  accessLevel: AccessLevel;
  responsaveis: ChamadoResponsavelOption[];
  responsaveisLoading?: boolean;
  locais: ChamadoLocalOption[];
}

const HISTORICO_FIELD_LABELS: Record<string, string> = {
  categoria_id: "Categoria",
  created_at: "Criado em",
  data_fechamento: "Data de fechamento",
  descricao: "Descrição",
  id: "ID",
  local_id: "Local",
  numero: "Número",
  prioridade: "Prioridade",
  resolvido_em: "Resolvido em",
  resolvido_por: "Resolvido por",
  responsavel_id: "Responsável",
  solicitante_id: "Solicitante",
  status: "Status",
  titulo: "Título",
  updated_at: "Atualizado em",
};

const HISTORICO_DATE_FIELDS = new Set(["created_at", "updated_at", "resolvido_em", "data_fechamento"]);

function formatHistoricoCampoLabel(campo?: string | null) {
  if (!campo) return "-";
  return (
    HISTORICO_FIELD_LABELS[campo] ??
    campo
      .split("_")
      .filter(Boolean)
      .join(" ")
      .replace(/^\w/, (char) => char.toUpperCase())
  );
}

function formatHistoricoCampoValor(
  campo: string,
  valor: string | null | undefined,
  responsavelNames: Map<string, string>,
  localNames: Map<string, string>
) {
  if (!valor) return "-";

  if (campo === "responsavel_id") {
    return responsavelNames.get(valor) ?? "Responsável não encontrado";
  }

  if (campo === "local_id") {
    return localNames.get(valor) ?? "Local não encontrado";
  }

  if (campo === "status") {
    return formatChamadoStatus(valor as ChamadoRow["status"]);
  }

  if (campo === "prioridade") {
    return formatChamadoPrioridade(valor as ChamadoRow["prioridade"]);
  }

  if (HISTORICO_DATE_FIELDS.has(campo)) {
    return formatDateTime(valor);
  }

  return valor;
}

function renderHistoricoDetalhe(
  item: ChamadoHistoricoDetalhado,
  responsavelNames: Map<string, string>,
  localNames: Map<string, string>
) {
  if (item.operacao === "update" && item.campo_alterado) {
    const valorAnterior = formatHistoricoCampoValor(
      item.campo_alterado,
      item.valor_anterior,
      responsavelNames,
      localNames
    );
    const valorNovo = formatHistoricoCampoValor(
      item.campo_alterado,
      item.valor_novo,
      responsavelNames,
      localNames
    );

    return (
      <div className="space-y-1 text-sm">
        <div>
          <span className="font-medium">Campo:</span> {formatHistoricoCampoLabel(item.campo_alterado)}
        </div>
        <div>
          <span className="font-medium">De:</span> {valorAnterior}
        </div>
        <div>
          <span className="font-medium">Para:</span> {valorNovo}
        </div>
      </div>
    );
  }

  if (item.operacao === "comentario") {
    const alteracoes = (item.alteracoes as Record<string, unknown> | null) ?? {};
    return (
      <div className="space-y-1 text-sm">
        <div>
          <span className="font-medium">Tipo:</span> Interação
        </div>
        <div>
          <span className="font-medium">Mensagem:</span> {String(alteracoes.mensagem || "-")}
        </div>
        <div>
          <span className="font-medium">Interno:</span> {alteracoes.interno ? "Sim" : "Não"}
        </div>
      </div>
    );
  }

  if (item.operacao === "anexo") {
    const alteracoes = (item.alteracoes as Record<string, unknown> | null) ?? {};
    return (
      <div className="space-y-1 text-sm">
        <div>
          <span className="font-medium">Arquivo:</span> {String(alteracoes.nome_arquivo || "-")}
        </div>
        <div>
          <span className="font-medium">Tipo:</span> {String(alteracoes.tipo_arquivo || "-")}
        </div>
        <div>
          <span className="font-medium">Tamanho:</span> {String(alteracoes.tamanho_bytes || "-")}
        </div>
      </div>
    );
  }

  return (
    <div className="text-sm text-muted-foreground">
      {item.registro_completo ? "Registro completo armazenado." : "Sem detalhes adicionais."}
    </div>
  );
}

export function ChamadoDetails({
  chamadoId,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  currentUserId,
  userRole,
  accessLevel,
  responsaveis,
  responsaveisLoading = false,
  locais,
}: ChamadoDetailsProps) {
  const queryClient = useQueryClient();
  const [mensagem, setMensagem] = useState("");
  const [interno, setInterno] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null);
  const [deletingInteractionId, setDeletingInteractionId] = useState<string | null>(null);
  const [deletingChamado, setDeletingChamado] = useState(false);
  const [assigningResponsavel, setAssigningResponsavel] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<ChamadoRow["status"] | null>(null);
  const [selectedResponsavelId, setSelectedResponsavelId] = useState("none");

  const canManageChamados = !!accessLevel && accessLevel !== "cliente_view";
  const canManageStatus =
    userRole === "perfil_interno" && !!accessLevel && accessLevel !== "cliente_view";
  const canSelfManageResponsavel =
    userRole === "perfil_interno" && !!accessLevel && accessLevel !== "cliente_view";
  const canAssignOtherResponsavel =
    userRole === "perfil_interno" && (accessLevel === "admin" || accessLevel === "supervisor");
  const canDeleteChamadoRegistro = (ownerId?: string | null) =>
    canManageChamados ||
    (userRole === "colaborador" && !!currentUserId && ownerId === currentUserId);

  const chamadoQuery = useQuery({
    queryKey: ["chamado-details", chamadoId],
    enabled: open && !!chamadoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chamados")
        .select(
          `
            *,
            categoria:chamado_categorias(id, nome, descricao, ativo),
            solicitante:usuarios!chamados_solicitante_id_fkey(id, full_name, email, role),
            resolvido_por_usuario:usuarios!chamados_resolvido_por_fkey(id, full_name, email, role)
          `
        )
        .eq("id", chamadoId)
        .single();

      if (error) throw error;
      return data as ChamadoDetalhado;
    },
  });

  const interacoesQuery = useQuery({
    queryKey: ["chamado-interacoes", chamadoId],
    enabled: open && !!chamadoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chamado_interacoes")
        .select(
          `
            *,
            autor:usuarios!chamado_interacoes_autor_id_fkey(id, full_name, email)
          `
        )
        .eq("chamado_id", chamadoId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as ChamadoInteracaoDetalhada[];
    },
  });

  const anexosQuery = useQuery({
    queryKey: ["chamado-anexos", chamadoId],
    enabled: open && !!chamadoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chamado_anexos")
        .select(
          `
            *,
            uploader:usuarios!chamado_anexos_uploaded_by_fkey(id, full_name, email)
          `
        )
        .eq("chamado_id", chamadoId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as ChamadoAnexoDetalhado[];
    },
  });

  const historicoQuery = useQuery({
    queryKey: ["chamado-historico", chamadoId],
    enabled: open && !!chamadoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chamado_historico")
        .select(
          `
            *,
            usuario:usuarios!chamado_historico_usuario_id_fkey(id, full_name, email)
          `
        )
        .eq("chamado_id", chamadoId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as ChamadoHistoricoDetalhado[];
    },
  });
  const historicoVisivel = useMemo(
    () => (historicoQuery.data || []).filter((item) => item.campo_alterado !== "updated_at"),
    [historicoQuery.data]
  );

  const responsavelHistoricoIds = useMemo(() => {
    const ids = new Set<string>();

    historicoVisivel.forEach((item) => {
      if (item.campo_alterado !== "responsavel_id") return;
      if (item.valor_anterior) ids.add(item.valor_anterior);
      if (item.valor_novo) ids.add(item.valor_novo);
    });

    return Array.from(ids);
  }, [historicoVisivel]);

  const responsavelHistoricoQuery = useQuery({
    queryKey: ["chamado-historico-responsaveis", chamadoId, responsavelHistoricoIds.join(",")],
    enabled: open && responsavelHistoricoIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("usuarios_public")
        .select("id, full_name, cargo")
        .in("id", responsavelHistoricoIds);

      if (error) throw error;
      return ((data || []) as UsuarioPublicoRow[]).filter(
        (user): user is UsuarioPublicoRow & { id: string } => !!user.id
      );
    },
  });

  const chamado = chamadoQuery.data;
  const canEditChamado =
    !!chamado &&
    (canManageChamados ||
      (userRole === "colaborador" && !!currentUserId && chamado.solicitante_id === currentUserId));
  const canDeleteChamado =
    !!chamado &&
    (canManageChamados ||
      (userRole === "colaborador" && !!currentUserId && chamado.solicitante_id === currentUserId));
  const availableStatusTransitions = chamado ? CHAMADO_STATUS_TRANSITIONS[chamado.status] : [];
  const responsavelMap = useMemo(
    () => new Map(responsaveis.map((user) => [user.id, user])),
    [responsaveis]
  );
  const responsavelAtual = chamado?.responsavel_id ? responsavelMap.get(chamado.responsavel_id) : null;
  const responsavelDisplay =
    responsavelAtual?.full_name ||
    responsavelAtual?.cargo ||
    (chamado?.responsavel_id
      ? responsaveisLoading
        ? "Carregando responsável..."
        : "Responsável não encontrado"
      : "Não atribuído");
  const localSelecionado = useMemo(
    () => locais.find((item) => item.id === chamado?.local_id) ?? null,
    [locais, chamado?.local_id]
  );
  const localHistoricoMap = useMemo(
    () => new Map(locais.map((local) => [local.id, local.nome])),
    [locais]
  );
  const responsavelHistoricoMap = useMemo(
    () =>
      new Map(
        (responsavelHistoricoQuery.data || []).map((user) => [
          user.id,
          user.full_name || user.cargo || "Responsável não encontrado",
        ])
      ),
    [responsavelHistoricoQuery.data]
  );

  useState;

  useMemo;

  const selectedResponsavelOption = useMemo(
    () => responsaveis.find((item) => item.id === selectedResponsavelId) ?? null,
    [responsaveis, selectedResponsavelId]
  );

  useState;

  useMemo;

  useEffect(() => {
    setSelectedResponsavelId(chamado?.responsavel_id ?? "none");
  }, [chamado?.responsavel_id]);

  const invalidateChamado = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["chamados-module"] }),
      queryClient.invalidateQueries({ queryKey: ["chamado-details", chamadoId] }),
      queryClient.invalidateQueries({ queryKey: ["chamado-interacoes", chamadoId] }),
      queryClient.invalidateQueries({ queryKey: ["chamado-anexos", chamadoId] }),
      queryClient.invalidateQueries({ queryKey: ["chamado-historico", chamadoId] }),
    ]);
  };

  const handleAddInteraction = async () => {
    if (!chamadoId || !currentUserId || !mensagem.trim()) {
      return;
    }

    if (typeof window !== "undefined" && !window.confirm("Deseja registrar esta interação no chamado?")) {
      return;
    }

    setSendingMessage(true);
    try {
      const { error } = await supabase.from("chamado_interacoes").insert({
        chamado_id: chamadoId,
        autor_id: currentUserId,
        mensagem: mensagem.trim(),
        interno,
      });

      if (error) throw error;

      setMensagem("");
      setInterno(false);
      await invalidateChamado();
      toast.success("Interação registrada.");
    } catch (error: any) {
      console.error("Erro ao registrar interação:", error);
      toast.error(error?.message ?? "Erro ao registrar interação.");
    } finally {
      setSendingMessage(false);
    }
  };

  const handleAttachmentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!chamadoId || !currentUserId) return;

    const files = event.target.files ? Array.from(event.target.files) : [];
    if (!files.length) return;

    const confirmationMessage =
      files.length === 1
        ? `Deseja anexar o arquivo "${files[0].name}" ao chamado?`
        : `Deseja anexar ${files.length} arquivo(s) ao chamado?`;
    if (typeof window !== "undefined" && !window.confirm(confirmationMessage)) {
      event.target.value = "";
      return;
    }

    setUploading(true);
    try {
      for (const file of files) {
        const storagePath = `${chamadoId}/${Date.now()}-${sanitizeStorageFileName(file.name)}`;

        const { error: uploadError } = await supabase.storage
          .from("chamados-anexos")
          .upload(storagePath, file, { upsert: false });

        if (uploadError) throw uploadError;

        const { error: insertError } = await supabase.from("chamado_anexos").insert({
          chamado_id: chamadoId,
          uploaded_by: currentUserId,
          nome_arquivo: file.name,
          caminho_storage: storagePath,
          tipo_arquivo: file.type || null,
          tamanho_bytes: file.size,
        });

        if (insertError) throw insertError;
      }

      await invalidateChamado();
      toast.success("Anexo(s) enviado(s) com sucesso.");
    } catch (error: any) {
      console.error("Erro ao enviar anexo:", error);
      toast.error(error?.message ?? "Erro ao enviar anexo.");
    } finally {
      event.target.value = "";
      setUploading(false);
    }
  };

  const handleOpenAttachment = async (anexo: ChamadoAnexoDetalhado) => {
    try {
      const { data, error } = await supabase.storage
        .from("chamados-anexos")
        .createSignedUrl(anexo.caminho_storage, 60);

      if (error || !data?.signedUrl) throw error || new Error("Link indisponível.");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      console.error("Erro ao abrir anexo:", error);
      toast.error(error?.message ?? "Erro ao abrir anexo.");
    }
  };

  const handleDeleteAttachment = async (anexo: ChamadoAnexoDetalhado) => {
    if (!canDeleteChamadoRegistro(anexo.uploaded_by)) return;
    if (typeof window !== "undefined" && !window.confirm(`Excluir o anexo ${anexo.nome_arquivo}?`)) return;

    setDeletingAttachmentId(anexo.id);
    try {
      const { error: storageError } = await supabase.storage
        .from("chamados-anexos")
        .remove([anexo.caminho_storage]);
      if (storageError) throw storageError;

      const { error: deleteError } = await supabase
        .from("chamado_anexos")
        .delete()
        .eq("id", anexo.id);
      if (deleteError) throw deleteError;

      await invalidateChamado();
      toast.success("Anexo excluído.");
    } catch (error: any) {
      console.error("Erro ao excluir anexo:", error);
      toast.error(error?.message ?? "Erro ao excluir anexo.");
    } finally {
      setDeletingAttachmentId(null);
    }
  };

  const handleDeleteInteraction = async (interacao: ChamadoInteracaoDetalhada) => {
    if (!canDeleteChamadoRegistro(interacao.autor_id)) return;
    if (typeof window !== "undefined" && !window.confirm("Excluir esta interação?")) return;

    setDeletingInteractionId(interacao.id);
    try {
      const { error } = await supabase.from("chamado_interacoes").delete().eq("id", interacao.id);
      if (error) throw error;

      await invalidateChamado();
      toast.success("Interação excluída.");
    } catch (error: any) {
      console.error("Erro ao excluir interação:", error);
      toast.error(error?.message ?? "Erro ao excluir interação.");
    } finally {
      setDeletingInteractionId(null);
    }
  };

  const handleDeleteChamado = async () => {
    if (!chamado || !canDeleteChamado) return;

    setDeletingChamado(true);
    try {
      await onDelete(chamado);
      onOpenChange(false);
    } finally {
      setDeletingChamado(false);
    }
  };

  const handleUpdateResponsavel = async (responsavelId: string | null, successMessage: string) => {
    if (!chamadoId) return;

    const confirmationMessage =
      responsavelId === null
        ? "Deseja remover o responsável deste chamado?"
        : responsavelId === currentUserId
          ? "Deseja assumir a responsabilidade deste chamado?"
          : "Deseja atualizar o responsável deste chamado?";
    if (typeof window !== "undefined" && !window.confirm(confirmationMessage)) {
      return;
    }

    setAssigningResponsavel(true);
    try {
      const { error } = await supabase
        .from("chamados")
        .update({ responsavel_id: responsavelId })
        .eq("id", chamadoId);

      if (error) throw error;

      await invalidateChamado();
      toast.success(successMessage);
    } catch (error: any) {
      console.error("Erro ao atualizar responsável:", error);
      toast.error(error?.message ?? "Erro ao atualizar responsável.");
    } finally {
      setAssigningResponsavel(false);
    }
  };

  const handleUpdateStatus = async (nextStatus: ChamadoRow["status"]) => {
    if (!chamadoId || !chamado || !currentUserId || !canManageStatus) return;
    if (!chamado.responsavel_id) {
      toast.error("Atribua um responsável antes de alterar o status.");
      return;
    }
    if (!availableStatusTransitions.includes(nextStatus)) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Deseja alterar o status para "${formatChamadoStatus(nextStatus)}"?`)
    ) {
      return;
    }

    const now = new Date().toISOString();
    let resolvidoEm = chamado.resolvido_em ?? null;
    let resolvidoPor = chamado.resolvido_por ?? null;
    let dataFechamento = chamado.data_fechamento ?? null;

    if (nextStatus === "resolvido") {
      resolvidoEm = resolvidoEm ?? now;
      resolvidoPor = resolvidoPor ?? currentUserId;
      dataFechamento = null;
    } else if (nextStatus === "fechado") {
      resolvidoEm = resolvidoEm ?? now;
      resolvidoPor = resolvidoPor ?? currentUserId;
      dataFechamento = dataFechamento ?? now;
    } else {
      resolvidoEm = null;
      resolvidoPor = null;
      dataFechamento = null;
    }

    setUpdatingStatus(nextStatus);
    try {
      const { error } = await supabase
        .from("chamados")
        .update({
          status: nextStatus,
          resolvido_em: resolvidoEm,
          resolvido_por: resolvidoPor,
          data_fechamento: dataFechamento,
        })
        .eq("id", chamadoId);

      if (error) throw error;

      await invalidateChamado();
      toast.success(`Status alterado para ${formatChamadoStatus(nextStatus)}.`);
    } catch (error: any) {
      console.error("Erro ao atualizar status do chamado:", error);
      toast.error(error?.message ?? "Erro ao atualizar status do chamado.");
    } finally {
      setUpdatingStatus(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[96vw] max-h-[92vh] overflow-auto">
        <DialogHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <DialogTitle className="flex flex-wrap items-center gap-2">
                <span>{chamado ? formatChamadoNumero(chamado.numero) : "Chamado"}</span>
                {chamado?.status && (
                  <Badge variant="outline" className={getChamadoStatusClass(chamado.status)}>
                    {formatChamadoStatus(chamado.status)}
                  </Badge>
                )}
                {chamado?.prioridade && (
                  <Badge variant="outline" className={getChamadoPrioridadeClass(chamado.prioridade)}>
                    {formatChamadoPrioridade(chamado.prioridade)}
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription>
                Acompanhe informações, interações, anexos e histórico completo do chamado.
              </DialogDescription>
            </div>

            <div className="flex flex-wrap gap-2">
              {chamado && canEditChamado && (
                <Button variant="outline" onClick={() => onEdit(chamado)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </Button>
              )}
              {canDeleteChamado && (
                <Button variant="destructive" onClick={handleDeleteChamado} disabled={deletingChamado}>
                  {deletingChamado ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  Excluir
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        {chamadoQuery.isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        ) : chamado ? (
          <Tabs defaultValue="geral" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="geral">Geral</TabsTrigger>
              <TabsTrigger value="interacoes">Interações</TabsTrigger>
              <TabsTrigger value="anexos">Anexos</TabsTrigger>
              <TabsTrigger value="historico">Histórico</TabsTrigger>
            </TabsList>

            <TabsContent value="geral" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">{chamado.titulo}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{chamado.descricao}</p>
                  <Separator />
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <div className="space-y-1 text-sm">
                      <div className="font-medium">Categoria</div>
                      <div>{chamado.categoria?.nome || "Sem categoria"}</div>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="font-medium">Local</div>
                      <div>{localSelecionado?.nome || "-"}</div>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="font-medium">Centro de custo</div>
                      <div>{localSelecionado?.cost_center_name || "-"}</div>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="font-medium">Solicitante</div>
                      <div>{chamado.solicitante?.full_name || chamado.solicitante?.email || "-"}</div>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="font-medium">Responsável</div>
                      <div>{responsavelDisplay}</div>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="font-medium">Criado em</div>
                      <div>{formatDateTime(chamado.created_at)}</div>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="font-medium">Atualizado em</div>
                      <div>{formatDateTime(chamado.updated_at)}</div>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="font-medium">Resolvido em</div>
                      <div>{formatDateTime(chamado.resolvido_em)}</div>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="font-medium">Fechado em</div>
                      <div>{formatDateTime(chamado.data_fechamento)}</div>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="font-medium">Resolvido por</div>
                      <div>
                        {chamado.resolvido_por_usuario?.full_name ||
                          chamado.resolvido_por_usuario?.email ||
                          "-"}
                      </div>
                    </div>
                    </div>
                    {canSelfManageResponsavel && (
                      <>
                        <Separator />
                        <div className="space-y-3">
                          <div>
                            <div className="font-medium">Responsabilidade</div>
                            <p className="text-sm text-muted-foreground">
                              Perfis internos podem assumir o chamado ou se desatribuir. Apenas admins e supervisores podem atribuir outras pessoas.
                            </p>
                          </div>
                          <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
                            {canAssignOtherResponsavel && (
                              <div className="xl:w-72">
                                <label className="mb-2 block text-sm font-medium">Atribuir outro responsável</label>
                                <Select
                                  value={selectedResponsavelId}
                                  onValueChange={setSelectedResponsavelId}
                                  disabled={assigningResponsavel}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione um responsável" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">Não atribuído</SelectItem>
                                    {responsaveis.map((responsavel) => (
                                      <SelectItem key={responsavel.id} value={responsavel.id}>
                                        {responsavel.full_name || responsavel.cargo || "Usuário interno"}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="outline"
                                disabled={assigningResponsavel || !currentUserId || chamado.responsavel_id === currentUserId}
                                onClick={() =>
                                  handleUpdateResponsavel(currentUserId, "Você se atribuiu como responsável.")
                                }
                              >
                                {assigningResponsavel ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Assumir chamado
                              </Button>
                              <Button
                                variant="outline"
                                disabled={assigningResponsavel || chamado.responsavel_id !== currentUserId}
                                onClick={() => handleUpdateResponsavel(null, "Responsável removido com sucesso.")}
                              >
                                Desatribuir-se
                              </Button>
                              {canAssignOtherResponsavel && (
                                <Button
                                  disabled={
                                    assigningResponsavel ||
                                    !selectedResponsavelOption ||
                                    selectedResponsavelOption.id === chamado.responsavel_id
                                  }
                                  onClick={() =>
                                    handleUpdateResponsavel(
                                      selectedResponsavelId === "none" ? null : selectedResponsavelId,
                                      "Responsável atualizado com sucesso."
                                    )
                                  }
                                >
                                  Atribuir selecionado
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                    {canManageStatus && (
                      <>
                        <Separator />
                        <div className="space-y-3">
                          <div>
                            <div className="font-medium">Status do chamado</div>
                            <p className="text-sm text-muted-foreground">
                              O status só pode avançar pelas transições permitidas e uma ação por vez.
                            </p>
                          </div>
                          {!chamado.responsavel_id ? (
                            <p className="text-sm text-muted-foreground">
                              Atribua um responsável antes de alterar o status.
                            </p>
                          ) : availableStatusTransitions.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              {chamado.status === "fechado"
                                ? "Chamados fechados não podem mais ter o status alterado."
                                : "Não há transições de status disponíveis para este chamado."}
                            </p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {availableStatusTransitions.map((status) => (
                                <Button
                                  key={status}
                                  variant="outline"
                                  disabled={!!updatingStatus}
                                  onClick={() => handleUpdateStatus(status)}
                                >
                                  {updatingStatus === status ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : null}
                                  Marcar como {formatChamadoStatus(status)}
                                </Button>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

            <TabsContent value="interacoes" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MessageSquare className="h-4 w-4" />
                    Nova interação
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    rows={4}
                    value={mensagem}
                    onChange={(event) => setMensagem(event.target.value)}
                    placeholder="Registre um comentário, atualização ou orientação."
                  />
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <label className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Switch checked={interno} onCheckedChange={setInterno} disabled={!canManageChamados} />
                      Marcar como interação interna
                    </label>
                    <Button onClick={handleAddInteraction} disabled={!mensagem.trim() || sendingMessage}>
                      {sendingMessage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      Enviar
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-3">
                {interacoesQuery.isLoading ? (
                  <Skeleton className="h-40 w-full" />
                ) : interacoesQuery.data && interacoesQuery.data.length > 0 ? (
                  interacoesQuery.data.map((interacao) => (
                    <Card key={interacao.id}>
                      <CardContent className="space-y-3 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                          <div className="flex items-center gap-2 font-medium">
                            <UserRound className="h-4 w-4 text-muted-foreground" />
                            <span>{interacao.autor?.full_name || interacao.autor?.email || "Usuário"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {interacao.interno && <Badge variant="secondary">Interno</Badge>}
                            <span className="text-muted-foreground">{formatDateTime(interacao.created_at)}</span>
                            {canDeleteChamadoRegistro(interacao.autor_id) && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteInteraction(interacao)}
                                disabled={deletingInteractionId === interacao.id}
                              >
                                {deletingInteractionId === interacao.id ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="mr-2 h-4 w-4" />
                                )}
                                Excluir
                              </Button>
                            )}
                          </div>
                        </div>
                        <p className="whitespace-pre-wrap text-sm">{interacao.mensagem}</p>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Card>
                    <CardContent className="py-10 text-center text-sm text-muted-foreground">
                      Nenhuma interação registrada.
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="anexos" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Paperclip className="h-4 w-4" />
                    Adicionar anexos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input type="file" multiple onChange={handleAttachmentUpload} disabled={uploading} />
                  <p className="text-xs text-muted-foreground">
                    Os anexos são armazenados no bucket `chamados-anexos` e auditados automaticamente.
                  </p>
                </CardContent>
              </Card>

              <div className="space-y-3">
                {anexosQuery.isLoading ? (
                  <Skeleton className="h-32 w-full" />
                ) : anexosQuery.data && anexosQuery.data.length > 0 ? (
                  anexosQuery.data.map((anexo) => (
                    <Card key={anexo.id}>
                      <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1 text-sm">
                          <div className="font-medium">{anexo.nome_arquivo}</div>
                          <div className="text-muted-foreground">
                            {anexo.uploader?.full_name || anexo.uploader?.email || "Usuário"} · {formatDateTime(anexo.created_at)}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" onClick={() => handleOpenAttachment(anexo)}>
                            <FileDown className="mr-2 h-4 w-4" />
                            Abrir
                          </Button>
                          {canDeleteChamadoRegistro(anexo.uploaded_by) && (
                            <Button
                              variant="destructive"
                              onClick={() => handleDeleteAttachment(anexo)}
                              disabled={deletingAttachmentId === anexo.id}
                            >
                              {deletingAttachmentId === anexo.id ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="mr-2 h-4 w-4" />
                              )}
                              Excluir
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Card>
                    <CardContent className="py-10 text-center text-sm text-muted-foreground">
                      Nenhum anexo enviado.
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="historico" className="space-y-3">
              {historicoQuery.isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : historicoVisivel.length > 0 ? (
                historicoVisivel.map((item) => (
                  <Card key={item.id}>
                    <CardContent className="space-y-3 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{formatHistoricoOperacao(item.operacao)}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {item.usuario?.full_name || item.usuario?.email || "Sistema"}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground">{formatDateTime(item.created_at)}</div>
                      </div>
                      <div className="flex items-start gap-2">
                        <History className="mt-0.5 h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          {renderHistoricoDetalhe(item, responsavelHistoricoMap, localHistoricoMap)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    Nenhum histórico encontrado.
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Não foi possível carregar o chamado.
            </CardContent>
          </Card>
        )}
      </DialogContent>
    </Dialog>
  );
}


