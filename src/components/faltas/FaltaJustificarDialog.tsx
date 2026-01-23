import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const BUCKET = "atestados";
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

const sanitizeFileName = (name: string) => name.replace(/[^\w.-]+/g, "_");

type FaltaJustificarDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diariaId: number | null;
  colaboradorId: string | null;
  colaboradorNome?: string | null;
  dataDiariaLabel?: string | null;
  onSuccess?: () => Promise<void> | void;
};

export const FaltaJustificarDialog = ({
  open,
  onOpenChange,
  diariaId,
  colaboradorId,
  colaboradorNome,
  dataDiariaLabel,
  onSuccess,
}: FaltaJustificarDialogProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setSaving(false);
    }
  }, [open]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    if (!selected) {
      setFile(null);
      return;
    }

    const extension = `.${selected.name.split(".").pop()?.toLowerCase() || ""}`;
    if (!ALLOWED_ATTACHMENT_EXTENSIONS.includes(extension as (typeof ALLOWED_ATTACHMENT_EXTENSIONS)[number])) {
      toast.error("Formato de arquivo nao permitido.");
      event.target.value = "";
      setFile(null);
      return;
    }

    setFile(selected);
  };

  const handleSubmit = async () => {
    if (!diariaId || !colaboradorId) {
      toast.error("Falta sem vinculo valido.");
      return;
    }
    if (!file) {
      toast.error("Selecione um arquivo para justificar.");
      return;
    }

    try {
      setSaving(true);
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) {
        throw new Error("Usuario nao autenticado.");
      }

      const sanitizedFileName = sanitizeFileName(file.name);
      const storagePath = `${colaboradorId}/${diariaId}/${Date.now()}-${sanitizedFileName}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file, { upsert: false });
      if (uploadError) throw uploadError;

      const { error: rpcError } = await supabase.rpc("justificar_falta_diaria_temporaria", {
        p_diaria_temporaria_id: diariaId,
        p_documento_url: storagePath,
        p_user_id: authData.user.id,
      });

      if (rpcError) {
        await supabase.storage.from(BUCKET).remove([storagePath]);
        throw rpcError;
      }

      toast.success("Falta justificada com sucesso.");
      setFile(null);
      if (onSuccess) {
        await onSuccess();
      }
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error?.message || "Nao foi possivel justificar a falta.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Justificar falta</DialogTitle>
          <DialogDescription>
            Envie o atestado para justificar a falta registrada.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <p>
              <span className="text-muted-foreground">Colaborador:</span>{" "}
              <span className="font-medium">{colaboradorNome || "-"}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Data da diaria:</span>{" "}
              <span className="font-medium">{dataDiariaLabel || "-"}</span>
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="falta-documento">Documento (atestado)</Label>
            <Input
              id="falta-documento"
              type="file"
              accept={ALLOWED_ATTACHMENT_EXTENSIONS.join(",")}
              onChange={handleFileChange}
            />
            <p className="text-xs text-muted-foreground">
              Formatos aceitos: {ALLOWED_ATTACHMENT_EXTENSIONS.join(", ")}.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={saving}>
            {saving ? "Salvando..." : "Justificar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
