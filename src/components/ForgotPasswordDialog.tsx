import { useState } from "react";
import { z } from "zod";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, KeyRound } from "lucide-react";

const emailSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: "Email invalido" })
    .max(255, { message: "Email deve ter no maximo 255 caracteres" }),
});

export const ForgotPasswordDialog = () => {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validatedData = emailSchema.parse({ email });

      const { error, data } = await supabase.functions.invoke("request-password-reset", {
        body: { email: validatedData.email },
      });

      if (error) throw error;
      if (data && data.success === false) {
        throw new Error(data.message || "Nao foi possivel enviar o email");
      }

      toast({
        title: "Email enviado!",
        description: "Se o email estiver cadastrado, voce recebera as instrucoes para redefinir sua senha.",
      });
      setEmail("");
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
          description: error.message || "Nao foi possivel enviar o email",
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
        <button
          type="button"
          className="text-sm text-primary hover:underline"
        >
          Esqueci minha senha
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex justify-center mb-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <KeyRound className="h-6 w-6 text-primary" />
            </div>
          </div>
          <DialogTitle>Recuperar Senha</DialogTitle>
          <DialogDescription>
            Digite seu email para receber as instrucoes de redefinicao de senha.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reset-email">Email</Label>
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
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                "Enviar Email"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
