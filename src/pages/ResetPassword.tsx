import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Loader2, Lock } from "lucide-react";

const passwordSchema = z
  .object({
    password: z.string().min(6, { message: "Senha deve ter no minimo 6 caracteres" }).max(72, {
      message: "Senha deve ter no maximo 72 caracteres",
    }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas nao coincidem",
    path: ["confirmPassword"],
  });

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const token = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    return searchParams.get("token");
  }, [location.search]);

  useEffect(() => {
    if (!token) {
      toast({
        title: "Link invalido",
        description: "Token de redefinicao nao encontrado.",
        variant: "destructive",
      });
      navigate("/auth");
    }
  }, [navigate, toast, token]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast({
        title: "Link invalido",
        description: "Token de redefinicao nao encontrado.",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }
    setLoading(true);

    try {
      const validatedData = passwordSchema.parse({ password, confirmPassword });

      const { error, data } = await supabase.functions.invoke("reset-password", {
        body: { token, newPassword: validatedData.password },
      });

      if (error) throw error;
      if (data && data.success === false) {
        throw new Error(data.message || "Nao foi possivel redefinir a senha");
      }

      toast({
        title: "Senha redefinida!",
        description: "Sua senha foi alterada com sucesso. Faca login com a nova senha.",
      });
      navigate("/auth");
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
          description: error.message || "Nao foi possivel redefinir a senha",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-3 text-center">
          <div className="flex justify-center mb-2">
            <div className="p-3 bg-gradient-to-br from-destructive to-destructive/80 rounded-xl">
              <Lock className="h-8 w-8 text-destructive-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Nova Senha</CardTitle>
          <CardDescription>Crie uma nova senha segura para sua conta</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Digite a nova senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={6}
                  maxLength={72}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Minimo de 6 caracteres</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirme a nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={6}
                  maxLength={72}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={showConfirmPassword ? "Ocultar confirmacao" : "Mostrar confirmacao"}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Redefinindo...
                </>
              ) : (
                "Redefinir Senha"
              )}
            </Button>
          </form>
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => navigate("/auth")}
              className="text-sm text-muted-foreground hover:text-primary"
              disabled={loading}
            >
              Voltar para login
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
