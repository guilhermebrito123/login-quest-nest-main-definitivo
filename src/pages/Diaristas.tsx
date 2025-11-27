import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DiaristaForm } from "@/components/diaristas/DiaristaForm";

const BUCKET = "diaristas-anexos";

const DIARISTA_DOCUMENTS = [
  { key: "anexo_cpf", label: "Documento CPF" },
  { key: "anexo_comprovante_endereco", label: "Comprovante de endereco" },
  { key: "anexo_dados_bancarios", label: "Dados bancarios" },
  { key: "anexo_possui_antecedente", label: "Comprovante antecedentes" },
] as const;

const getStatusVariant = (status?: string): "default" | "secondary" | "destructive" => {
  if (status === "ativo") return "default";
  if (status === "desligado") return "destructive";
  return "secondary";
};

interface DiaristaAnexo {
  id: string;
  nome_arquivo: string;
  caminho_storage: string;
  created_at: string;
  url?: string | null;
}

export default function Diaristas() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingDiarista, setEditingDiarista] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [diaristaDetalhe, setDiaristaDetalhe] = useState<any>(null);
  const [detalheAnexos, setDetalheAnexos] = useState<DiaristaAnexo[]>([]);
  const [loadingAnexos, setLoadingAnexos] = useState(false);
  const queryClient = useQueryClient();

  const { data: diaristas, isLoading } = useQuery({
    queryKey: ["diaristas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diaristas")
        .select("*")
        .order("nome_completo");

      if (error) throw error;
      return data || [];
    },
  });

  const filteredDiaristas = diaristas?.filter((diarista) =>
    diarista.nome_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    diarista.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    diarista.telefone.includes(searchTerm)
  );

  const handleEdit = (diarista: any) => {
    setEditingDiarista(diarista);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("diaristas").delete().eq("id", id);

      if (error) throw error;

      toast.success("Diarista excluído com sucesso");
      queryClient.invalidateQueries({ queryKey: ["diaristas"] });
      setDeletingId(null);
    } catch (error: any) {
      toast.error("Erro ao excluir diarista: " + error.message);
    }
  };

  const carregarAnexosDetalhe = async (diaristaId: string) => {
    setLoadingAnexos(true);
    try {
      const { data, error } = await supabase
        .from("diaristas_anexos")
        .select("*")
        .eq("diarista_id", diaristaId)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const anexosComUrl: DiaristaAnexo[] = await Promise.all(
        (data || []).map(async (anexo: any) => {
          const { data: signedData } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(anexo.caminho_storage, 120);
          return {
            id: anexo.id,
            nome_arquivo: anexo.nome_arquivo,
            caminho_storage: anexo.caminho_storage,
            created_at: anexo.created_at,
            url: signedData?.signedUrl || null,
          };
        })
      );

      setDetalheAnexos(anexosComUrl);
    } catch (error: any) {
      toast.error("Erro ao carregar anexos: " + error.message);
      setDetalheAnexos([]);
    } finally {
      setLoadingAnexos(false);
    }
  };

  const getSignedUrl = async (path: string) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 120);
    if (error || !data?.signedUrl) {
      throw new Error(error?.message || "Não foi possível gerar o link");
    }
    return data.signedUrl;
  };

  const handleViewDocumentoObrigatorio = async (path: string) => {
    try {
      const url = await getSignedUrl(path);
      window.open(url, "_blank");
    } catch (error: any) {
      toast.error("Erro ao visualizar documento: " + error.message);
    }
  };

  const handleDownloadDocumentoObrigatorio = async (path: string) => {
    try {
      const url = await getSignedUrl(path);
      const link = document.createElement("a");
      link.href = url;
      link.download = path.split("/").pop() || "documento";
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error: any) {
      toast.error("Erro ao baixar documento: " + error.message);
    }
  };

  useEffect(() => {
    if (diaristaDetalhe?.id) {
      carregarAnexosDetalhe(diaristaDetalhe.id);
    } else {
      setDetalheAnexos([]);
    }
  }, [diaristaDetalhe?.id]);

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Diaristas</h1>
          <Button
            onClick={() => {
              setEditingDiarista(null);
              setShowForm(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo Diarista
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar por nome, email ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="hidden sm:table-cell">Email</TableHead>
                <TableHead className="hidden lg:table-cell">Banco</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredDiaristas?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">
                    Nenhum diarista encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredDiaristas?.map((diarista) => (
                  <TableRow
                    key={diarista.id}
                    className="cursor-pointer"
                    onClick={() => setDiaristaDetalhe(diarista)}
                  >
                    <TableCell className="font-medium">
                      {diarista.nome_completo}
                    </TableCell>
                    <TableCell>{diarista.cidade || "-"}</TableCell>
                    <TableCell>{diarista.telefone}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {diarista.email}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {diarista.banco || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(diarista.status)}>
                        {diarista.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(diarista);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingId(diarista.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <DiaristaForm
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingDiarista(null);
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["diaristas"] });
          setShowForm(false);
          setEditingDiarista(null);
        }}
        diarista={editingDiarista}
      />

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este diarista? Esta ação não pode
              ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && handleDelete(deletingId)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!diaristaDetalhe}
        onOpenChange={(open) => {
          if (!open) setDiaristaDetalhe(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{diaristaDetalhe?.nome_completo || "Diarista"}</DialogTitle>
            <DialogDescription>Dados completos do diarista</DialogDescription>
          </DialogHeader>

          {diaristaDetalhe && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-medium break-words">{diaristaDetalhe.email || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Telefone</p>
                  <p className="font-medium break-words">{diaristaDetalhe.telefone || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cidade</p>
                  <p className="font-medium break-words">{diaristaDetalhe.cidade || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">CEP</p>
                  <p className="font-medium break-words">{diaristaDetalhe.cep || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="font-medium break-words">{diaristaDetalhe.status}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Banco</p>
                  <p className="font-medium break-words">{diaristaDetalhe.banco || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Agencia</p>
                  <p className="font-medium break-words">{diaristaDetalhe.agencia || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tipo de conta</p>
                  <p className="font-medium break-words">{diaristaDetalhe.tipo_conta || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Numero da conta</p>
                  <p className="font-medium break-words">{diaristaDetalhe.numero_conta || "-"}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-muted-foreground">Chave PIX</p>
                  <p className="font-medium break-words">{diaristaDetalhe.pix || "-"}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Documentos obrigatorios</p>
                <div className="space-y-2">
                  {DIARISTA_DOCUMENTS.map(({ key, label }) => {
                    const path = diaristaDetalhe[key];
                    return (
                      <div
                        key={key}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
                      >
                        <div>
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <p className="text-sm font-medium break-all">
                            {path ? path.split("/").pop() : "Nao enviado"}
                          </p>
                        </div>
                        {path ? (
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleViewDocumentoObrigatorio(path)}>
                              Visualizar
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => handleDownloadDocumentoObrigatorio(path)}>
                              Baixar
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sem arquivo</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Anexos</p>
                {loadingAnexos ? (
                  <p className="text-xs text-muted-foreground">Carregando anexos...</p>
                ) : detalheAnexos.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum anexo cadastrado.</p>
                ) : (
                  <div className="space-y-2">
                    {detalheAnexos.map((anexo) => (
                      <div
                        key={anexo.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium break-all">{anexo.nome_arquivo}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(anexo.created_at).toLocaleString("pt-BR")}
                          </p>
                        </div>
                        {anexo.url ? (
                          <div className="flex flex-wrap gap-2 mt-1">
                            <Button asChild size="sm" variant="outline">
                              <a href={anexo.url} target="_blank" rel="noreferrer">
                                Visualizar
                              </a>
                            </Button>
                            <Button asChild size="sm" variant="secondary">
                              <a href={anexo.url} target="_blank" rel="noreferrer" download={anexo.nome_arquivo}>
                                Baixar
                              </a>
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sem link</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
