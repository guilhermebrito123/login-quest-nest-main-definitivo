import { useState } from "react";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, KeyRound } from "lucide-react";

const requestSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: "Email invalido" })
    .max(255, { message: "Email deve ter no maximo 255 caracteres" }),
  reason: z
    .string()
    .trim()
    .max(500, { message: "Motivo deve ter no maximo 500 caracteres" })
    .optional(),
});

export const ForgotPasswordDialog = () => {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validated = requestSchema.parse({
        email,
        reason: reason || undefined,
      });

      const { error } = await supabase.functions.invoke("request-manual-recovery", {
        body: { email: validated.email, reason: validated.reason },
      });

      if (error) throw error;

      toast({
        title: "Solicitacao enviada",
        description:
          "Caso a conta exista, sua solicitacao sera analisada pelo suporte. Voce sera notificado quando for aprovada.",
      });

      setEmail("");
      setReason("");
      setOpen(false);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Erro de validacao",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro",
          description: error.message || "Nao foi possivel enviar a solicitacao",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="text-sm text-primary hover:underline">
          Esqueci minha senha
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex justify-center">
            <div className="rounded-lg bg-primary/10 p-2">
              <KeyRound className="h-6 w-6 text-primary" />
            </div>
          </div>
          <DialogTitle>Recuperar acesso</DialogTitle>
          <DialogDescription>
            Informe seu e-mail e, opcionalmente, um motivo. Um administrador ira analisar sua
            solicitacao e, se aprovada, voce recebera um link para definir uma nova senha.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleRequest} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reset-email">E-mail da conta</Label>
            <Input
              id="reset-email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              maxLength={255}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reset-reason">Motivo (opcional)</Label>
            <Textarea
              id="reset-reason"
              placeholder="Ex: Esqueci minha senha e nao consigo acessar..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={loading}
              maxLength={500}
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                "Enviar solicitacao"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
