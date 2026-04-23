import { useMemo, useRef, useState } from "react";
import {
  Eye,
  File as FileIcon,
  FileText,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  useDeleteAnexoResposta,
  useSignedUrlAnexo,
  useUploadAnexoResposta,
} from "@/modules/checklist/hooks";
import type {
  ChecklistTaskAttachment,
  ChecklistTaskResponseWithAttachments,
} from "@/modules/checklist/types";

const MAX_ATTACHMENT_SIZE_BYTES = 15 * 1024 * 1024;
const ACCEPTED_ATTACHMENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const ACCEPTED_ATTACHMENT_LABEL =
  ".png,.jpg,.jpeg,.webp,.gif,.pdf,.txt,.doc,.docx";

type AnexosRespostaProps = {
  anexos: ChecklistTaskAttachment[];
  canDeleteAsManager: boolean;
  canUpload: boolean;
  currentUserId: string | null;
  disabledReason?: string | null;
  instanciaId: string;
  resposta: ChecklistTaskResponseWithAttachments | null;
  tarefaId: string;
};

function formatFileSize(bytes?: number | null) {
  if (!bytes) return "Tamanho não informado";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageAttachment(type?: string | null, fileName?: string | null) {
  return (
    (type?.startsWith("image/") ?? false) ||
    !!fileName?.toLowerCase().match(/\.(png|jpe?g|gif|webp)$/)
  );
}

function isPdfAttachment(type?: string | null, fileName?: string | null) {
  return type === "application/pdf" || fileName?.toLowerCase().endsWith(".pdf");
}

function getAttachmentIcon(type?: string | null, fileName?: string | null) {
  if (isImageAttachment(type, fileName)) return <ImageIcon className="h-4 w-4" />;
  if (isPdfAttachment(type, fileName)) return <FileText className="h-4 w-4" />;
  return <FileIcon className="h-4 w-4" />;
}

function validateFile(file: File) {
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return `O arquivo ${file.name} excede o limite de 15 MB.`;
  }

  if (!ACCEPTED_ATTACHMENT_TYPES.includes(file.type)) {
    return `O tipo do arquivo ${file.name} não é suportado.`;
  }

  return null;
}

function AnexoItem({
  anexo,
  canDelete,
  instanciaId,
}: {
  anexo: ChecklistTaskAttachment;
  canDelete: boolean;
  instanciaId: string;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const { data: signedUrl, isLoading } = useSignedUrlAnexo(anexo.caminho_storage);
  const deleteAnexo = useDeleteAnexoResposta();

  const previewable = isImageAttachment(anexo.tipo_arquivo, anexo.nome_arquivo) ||
    isPdfAttachment(anexo.tipo_arquivo, anexo.nome_arquivo);

  async function handleDelete() {
    try {
      await deleteAnexo.mutateAsync({
        instanciaId,
        anexo: {
          id: anexo.id,
          caminho_storage: anexo.caminho_storage,
        },
      });
      toast.success("Anexo removido.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Não foi possível remover o anexo.";
      toast.error(message);
    }
  }

  return (
    <>
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              {getAttachmentIcon(anexo.tipo_arquivo, anexo.nome_arquivo)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{anexo.nome_arquivo}</p>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>{formatFileSize(anexo.tamanho_bytes)}</span>
                <span>{new Date(anexo.created_at).toLocaleString("pt-BR")}</span>
                {anexo.tipo_arquivo ? <span>{anexo.tipo_arquivo}</span> : null}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!signedUrl}
              onClick={() => {
                if (signedUrl) {
                  window.open(signedUrl, "_blank", "noopener,noreferrer");
                }
              }}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
              Abrir
            </Button>
            {previewable ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!signedUrl}
                onClick={() => setPreviewOpen(true)}
              >
                Visualizar
              </Button>
            ) : null}
            {canDelete ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-destructive"
                disabled={deleteAnexo.isPending}
                onClick={() => void handleDelete()}
              >
                <Trash2 className="h-4 w-4" />
                Remover
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{anexo.nome_arquivo}</DialogTitle>
            <DialogDescription>
              Visualização temporária via URL assinada.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[70vh] overflow-auto rounded-xl border bg-muted/30 p-4">
            {signedUrl && isImageAttachment(anexo.tipo_arquivo, anexo.nome_arquivo) ? (
              <img
                src={signedUrl}
                alt={anexo.nome_arquivo}
                className="mx-auto max-h-[60vh] rounded-lg object-contain"
              />
            ) : signedUrl && isPdfAttachment(anexo.tipo_arquivo, anexo.nome_arquivo) ? (
              <iframe
                src={signedUrl}
                title={anexo.nome_arquivo}
                className="h-[60vh] w-full rounded-lg"
              />
            ) : (
              <div className="text-sm text-muted-foreground">
                Este arquivo não possui preview incorporado. Use o botão Abrir.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function AnexosResposta({
  anexos,
  canDeleteAsManager,
  canUpload,
  currentUserId,
  disabledReason,
  instanciaId,
  resposta,
  tarefaId,
}: AnexosRespostaProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const uploadAnexo = useUploadAnexoResposta();

  const sortedAnexos = useMemo(
    () =>
      [...anexos].sort((left, right) => right.created_at.localeCompare(left.created_at)),
    [anexos],
  );

  async function handleFiles(fileList: FileList | File[]) {
    if (!resposta?.id) {
      toast.error("Salve a resposta da tarefa antes de enviar anexos.");
      return;
    }

    const files = Array.from(fileList);
    for (const file of files) {
      const validationError = validateFile(file);
      if (validationError) {
        toast.error(validationError);
        continue;
      }

      try {
        await uploadAnexo.mutateAsync({
          instanciaId,
          tarefaId,
          respostaId: resposta.id,
          file,
        });
        toast.success(`Anexo ${file.name} enviado.`);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Não foi possível enviar o anexo.";
        toast.error(message);
      }
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">Anexos</p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Imagens, PDF e documentos leves. Limite de 15 MB por arquivo.
          </p>
        </div>
        <Badge variant="outline">{sortedAnexos.length} arquivo(s)</Badge>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_ATTACHMENT_LABEL}
        className="hidden"
        onChange={(event) => {
          const files = event.target.files;
          if (files?.length) {
            void handleFiles(files);
          }
          event.target.value = "";
        }}
      />

      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          if (canUpload && resposta?.id) {
            inputRef.current?.click();
          }
        }}
        onKeyDown={(event) => {
          if ((event.key === "Enter" || event.key === " ") && canUpload && resposta?.id) {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          if (!canUpload || !resposta?.id) return;
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(event) => {
          if (!canUpload || !resposta?.id) return;
          event.preventDefault();
          setDragActive(false);
          if (event.dataTransfer.files.length) {
            void handleFiles(event.dataTransfer.files);
          }
        }}
        className={cn(
          "rounded-2xl border border-dashed px-4 py-6 text-center transition-colors",
          dragActive ? "border-primary bg-primary/5" : "border-border",
          !canUpload || !resposta?.id ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:bg-muted/30",
        )}
      >
        <div className="mx-auto flex max-w-md flex-col items-center gap-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
            {uploadAnexo.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Upload className="h-5 w-5" />
            )}
          </div>
          <p className="text-sm font-medium">
            {uploadAnexo.isPending ? "Enviando anexo..." : "Arraste arquivos aqui ou clique para selecionar"}
          </p>
          <p className="text-xs text-muted-foreground">
            {!resposta?.id
              ? "Primeiro registre a resposta da tarefa para vincular os anexos."
              : !canUpload
                ? disabledReason ?? "Você não pode anexar arquivos nesta tarefa."
                : "O path é gravado automaticamente no formato exigido pelo bucket privado."}
          </p>
        </div>
      </div>

      {sortedAnexos.length ? (
        <div className="space-y-3">
          {sortedAnexos.map((anexo) => (
            <AnexoItem
              key={anexo.id}
              anexo={anexo}
              instanciaId={instanciaId}
              canDelete={anexo.uploaded_by === currentUserId || canDeleteAsManager}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed px-4 py-5 text-sm text-muted-foreground">
          Nenhum anexo enviado para esta resposta.
        </div>
      )}
    </div>
  );
}
