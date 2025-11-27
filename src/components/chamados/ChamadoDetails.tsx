import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare, Send, UserCircle, Star, UserCheck, Paperclip } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

interface ChamadoDetailsProps {
  chamado: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (chamado: any) => void;
  onDelete: (id: string) => void;
}

type ChamadoAnexo = {
  id: string;
  nome_arquivo: string;
  caminho_storage: string;
  created_at: string | null;
  tipo_arquivo?: string | null;
};

export function ChamadoDetails({ chamado, open, onOpenChange, onEdit, onDelete }: ChamadoDetailsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [novoComentario, setNovoComentario] = useState("");
  const [avaliacao, setAvaliacao] = useState<number | null>(chamado.avaliacao || null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    };
    fetchUser();
  }, []);

  const { data: anexos, isLoading: loadingAnexos } = useQuery<ChamadoAnexo[]>({
  queryKey: ["chamado-anexos-detalhes", chamado.id],
  enabled: open && !!chamado.id,
  queryFn: async () => {
    const { data, error } = await supabase
      .from("chamados_anexos")
      .select("*")
      .eq("chamado_id", chamado.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []) as ChamadoAnexo[];
  },
});

const handleAbrirAnexo = async (anexo: ChamadoAnexo) => {
  try {
    const { data, error } = await supabase.storage
      .from("chamados-anexos") // nome do bucket
      .download(anexo.caminho_storage); // ex: "123/1700000000-arquivo.pdf"

    if (error || !data) {
      throw error || new Error("Nenhum dado retornado do Storage");
    }

    // data já é um Blob no browser
    const blob = data as Blob;
    const url = URL.createObjectURL(blob);

    // Se for imagem ou PDF, abre em nova aba
    if (anexo.tipo_arquivo?.startsWith("image/") || anexo.tipo_arquivo === "application/pdf") {
      window.open(url, "_blank");
      // revoga depois de um tempo para não vazar memória
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } else {
      // Para outros tipos, força download
      const link = document.createElement("a");
      link.href = url;
      link.download = anexo.nome_arquivo;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }
  } catch (err) {
    console.error("Erro ao abrir/baixar anexo:", err);
    toast({
      title: "Erro ao abrir anexo",
      description: "Não foi possível abrir o arquivo. Tente novamente.",
      variant: "destructive",
    });
  }
};


  
  const { data: comentarios, isLoading: loadingComentarios } = useQuery({
    queryKey: ["chamados_comentarios", chamado.id],
    enabled: open && !!chamado.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chamados_comentarios")
        .select(`
          *,
          usuario:profiles(full_name)
        `)
        .eq("chamado_id", chamado.id)
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

const adicionarComentario = useMutation({
  mutationFn: async (comentario: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");

    const { data, error } = await supabase
      .from("chamados_comentarios")
      .insert([{
        chamado_id: chamado.id,
        usuario_id: user.id,
        comentario,
      }])
      .select(`
        *,
        usuario:profiles(full_name)
      `)
      .single();

    if (error) throw error;
    return data;
  },
  onSuccess: (novoComentarioInserido) => {
    queryClient.setQueryData<any[]>(["chamados_comentarios", chamado.id], (oldComentarios) => {
      const lista = oldComentarios || [];
      return [...lista, novoComentarioInserido];
    });
    setNovoComentario("");
    toast({ title: "Comentário adicionado com sucesso!" });
  },
    onError: (error: any) => {
      toast({
        title: "Erro ao adicionar comentário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const avaliarChamado = useMutation({
    mutationFn: async (nota: number) => {
      const { error } = await supabase
        .from("chamados")
        .update({ avaliacao: nota })
        .eq("id", chamado.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Avaliação registrada com sucesso!" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao avaliar chamado",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const atribuirParaMim = useMutation({
    mutationFn: async () => {
      if (!currentUserId) throw new Error("Usuário não autenticado");
      
      const { error } = await supabase
        .from("chamados")
        .update({ atribuido_para_id: currentUserId })
        .eq("id", chamado.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chamados"] });
      toast({ title: "Você foi atribuído ao chamado com sucesso!" });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atribuir chamado",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const concluirChamado = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("chamados")
        .update({ 
          status: "concluido",
          data_conclusao: new Date().toISOString()
        })
        .eq("id", chamado.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chamados"] });
      toast({ title: "Chamado concluído com sucesso!" });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao concluir chamado",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEnviarComentario = () => {
    if (novoComentario.trim()) {
      adicionarComentario.mutate(novoComentario);
    }
  };

  const handleAvaliar = (nota: number) => {
    setAvaliacao(nota);
    avaliarChamado.mutate(nota);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <DialogTitle className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
              <span>{chamado.numero}</span>
              <Badge>{chamado.status?.replace("_", " ")}</Badge>
            </DialogTitle>
            <div className="flex flex-wrap gap-2">
              {!chamado.atribuido_para_id && currentUserId && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => atribuirParaMim.mutate()}
                  disabled={atribuirParaMim.isPending}
                >
                  <UserCheck className="mr-2 h-4 w-4" />
                  Atribuir para mim
                </Button>
              )}
              {chamado.comentario_avaliacao && (
                <p className="text-sm text-muted-foreground mt-1">
                  Coment�rio: {chamado.comentario_avaliacao}
                </p>
              )}
              {chamado.atribuido_para_id === currentUserId && chamado.status !== "concluido" && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    if (confirm("Tem certeza que deseja concluir este chamado?")) {
                      concluirChamado.mutate();
                    }
                  }}
                  disabled={concluirChamado.isPending}
                >
                  Concluir
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onEdit({
                    ...chamado,
                    anexos: anexos ?? [],
                  });
                  onOpenChange(false);
                }}
              >
                Editar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (confirm("Tem certeza que deseja excluir este chamado?")) {
                    onDelete(chamado.id);
                    onOpenChange(false);
                  }
                }}
              >
                Excluir
              </Button>
            </div>
          </div>
          <DialogDescription>
            Consulte dados completos, anexos e comentários antes de atualizar o chamado.
          </DialogDescription>
        </DialogHeader>

        <Separator />

<Card className="p-4">
  <h3 className="font-semibold mb-3 flex items-center gap-2">
    <Paperclip className="h-5 w-5" />
    Anexos
  </h3>

  {loadingAnexos ? (
    <Skeleton className="h-16 w-full" />
  ) : anexos && anexos.length > 0 ? (
    <div className="space-y-2">
      {anexos.map((anexo) => (
        <button
          key={anexo.id}
          type="button"
          onClick={() => handleAbrirAnexo(anexo)}
          className="w-full flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-accent transition-colors"
        >
          <div className="min-w-0 text-left">
            <p className="truncate font-medium">{anexo.nome_arquivo}</p>
            <p className="text-xs text-muted-foreground">
              {anexo.created_at
                ? format(new Date(anexo.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                : "Sem data"}
            </p>
          </div>
          <span className="text-xs text-primary underline">
            Abrir / Baixar
          </span>
        </button>
      ))}
    </div>
  ) : (
    <p className="text-sm text-muted-foreground">
      Nenhum anexo cadastrado para este chamado.
    </p>
  )}
</Card>

<Separator />

        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold mb-2">{chamado.titulo}</h2>
            {chamado.descricao && (
              <p className="text-muted-foreground">{chamado.descricao}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="p-4 space-y-2">
              <h3 className="font-semibold">Informações</h3>
              <div className="text-sm space-y-1">
                <div><span className="font-medium">Tipo:</span> {chamado.tipo}</div>
                {chamado.categoria && (
                  <div><span className="font-medium">Categoria:</span> {chamado.categoria}</div>
                )}
                {chamado.subcategoria && (
                  <div><span className="font-medium">Subcategoria:</span> {chamado.subcategoria}</div>
                )}
                <div><span className="font-medium">Prioridade:</span> {chamado.prioridade}</div>
                <div><span className="font-medium">Canal:</span> {chamado.canal}</div>
                {chamado.sla_horas && (
                  <div><span className="font-medium">SLA:</span> {chamado.sla_horas} horas</div>
                )}
                {typeof chamado.avaliacao === "number" && (
                  <div>
                    <span className="font-medium">Nota NPS:</span> {chamado.avaliacao}/5
                  </div>
                )}
                {chamado.comentario_avaliacao && (
                  <div>
                    <span className="font-medium">Comentário NPS:</span> {chamado.comentario_avaliacao}
                  </div>
                )}
              </div>
            </Card>

            <Card className="p-4 space-y-2">
              <h3 className="font-semibold">Localização</h3>
              <div className="text-sm space-y-1">
                {chamado.contrato && (
                  <div><span className="font-medium">Contrato:</span> {chamado.contrato.nome}</div>
                )}
                {chamado.unidade && (
                  <div><span className="font-medium">Unidade:</span> {chamado.unidade.nome}</div>
                )}
                {chamado.posto_servico && (
                  <div><span className="font-medium">Posto:</span> {chamado.posto_servico.nome}</div>
                )}
              </div>
            </Card>

            <Card className="p-4 space-y-2">
              <h3 className="font-semibold">Pessoas</h3>
              <div className="text-sm space-y-1">
                {chamado.solicitante && (
                  <div><span className="font-medium">Solicitante:</span> {chamado.solicitante.nome_completo}</div>
                )}
                {chamado.atribuido && (
                  <div><span className="font-medium">Atribuído:</span> {chamado.atribuido.nome_completo}</div>
                )}
                {chamado.responsavel && (
                  <div><span className="font-medium">Responsável:</span> {chamado.responsavel.full_name || chamado.responsavel.nome_completo}</div>
                )}
              </div>
            </Card>

            <Card className="p-4 space-y-2">
              <h3 className="font-semibold">Datas</h3>
              <div className="text-sm space-y-1">
                <div>
                  <span className="font-medium">Abertura:</span>{" "}
                  {format(new Date(chamado.data_abertura), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </div>
                {chamado.data_conclusao && (
                  <div>
                    <span className="font-medium">Conclusão:</span>{" "}
                    {format(new Date(chamado.data_conclusao), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </div>
                )}
              </div>
            </Card>
          </div>

          {chamado.status === "concluido" && (
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Star className="h-5 w-5" />
                Avaliacao do Chamado
              </h3>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((nota) => (
                  <Button
                    key={nota}
                    variant={avaliacao === nota ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleAvaliar(nota)}
                  >
                    {nota}
                  </Button>
                ))}
              </div>
              {avaliacao && (
                <p className="text-sm text-muted-foreground mt-2">
                  Avaliação: {avaliacao}/5
                </p>
              )}
              {chamado.comentario_avaliacao && (
                <p className="text-sm text-muted-foreground mt-1">
                  Coment�rio: {chamado.comentario_avaliacao}
                </p>
              )}
            </Card>
          )}

          <Separator />

          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Comentários ({comentarios?.length || 0})
            </h3>

            <div className="space-y-3 mb-4">
              {loadingComentarios ? (
                <Skeleton className="h-20 w-full" />
              ) : comentarios && comentarios.length > 0 ? (
                comentarios.map((comentario: any) => (
                  <Card key={comentario.id} className="p-3">
                    <div className="flex items-start gap-3">
                      <UserCircle className="h-8 w-8 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">
                            {comentario.usuario?.full_name || "Usuário"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(comentario.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        <p className="text-sm">{comentario.comentario}</p>
                      </div>
                    </div>
                  </Card>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum comentário ainda</p>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <Textarea
                className="w-full"
                placeholder="Adicione um comentário..."
                value={novoComentario}
                onChange={(e) => setNovoComentario(e.target.value)}
                rows={2}
              />
              <Button
                onClick={handleEnviarComentario}
                disabled={!novoComentario.trim() || adicionarComentario.isPending}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}








