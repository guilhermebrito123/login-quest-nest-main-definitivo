import { useEffect, useMemo, useState } from "react";
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
import { Constants } from "@/integrations/supabase/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const BUCKET = "diaristas-anexos";
const STATUS_OPTIONS = Constants.public.Enums.status_diarista;

const DIARISTA_DOCUMENTS = [
  { key: "anexo_cpf", label: "Documento CPF" },
  { key: "anexo_comprovante_endereco", label: "Comprovante de endereco" },
  { key: "anexo_dados_bancarios", label: "Dados bancarios" },
  { key: "anexo_possui_antecedente", label: "Comprovante antecedentes" },
] as const;

const getStatusVariant = (status?: string): "default" | "secondary" | "destructive" => {
  if (status === "ativo") return "default";
  if (status === "desligado") return "destructive";
  if (status === "restrito") return "destructive";
  return "secondary";
};

const stripNonDigits = (value?: string | null) => (value ?? "").replace(/\D/g, "");

const formatCpf = (value?: string | null) => {
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

const TEST_DIARISTA_NAME = "guilherme guerra";
const TEST_DIARISTA_CPFS = new Set(["01999999999", "01999999998"]);
const isTestDiarista = (diarista: any) => {
  const name = (diarista?.nome_completo || "").trim().toLowerCase();
  const cpfDigits = stripNonDigits(diarista?.cpf);
  return name === TEST_DIARISTA_NAME && TEST_DIARISTA_CPFS.has(cpfDigits);
};

const formatCep = (value?: string | null) => {
  const digits = stripNonDigits(value).slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
};

const formatTelefone = (value?: string | null) => {
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
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
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

  const { data: blacklist = [] } = useQuery({
    queryKey: ["blacklist"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blacklist")
        .select("id, diarista_id, motivo, bloqueado_em, bloqueado_por");
      if (error) throw error;
      return data || [];
    },
  });

  const blacklistMap = useMemo(() => {
    const map = new Map<string, any>();
    (blacklist || []).forEach((item: any) => {
      if (item?.diarista_id) map.set(item.diarista_id, item);
    });
    return map;
  }, [blacklist]);

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

  const handleStatusChange = async (
    diaristaId: string,
    nextStatus: string,
    currentStatus?: string | null,
  ) => {
    if (!nextStatus || nextStatus === currentStatus) return;
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(
        `Confirmar alteracao de status para "${nextStatus}"?`,
      );
      if (!confirmed) return;
    } else {
      return;
    }
    const isRestrito = nextStatus === "restrito";
    let motivoRestricao: string | null = null;
    let motivoAlteracao: string | null = null;

    if (isRestrito) {
      const motivo = window.prompt("Informe o motivo da restricao para este diarista.");
      const trimmed = (motivo ?? "").trim();
      if (!trimmed) {
        toast.error("Motivo de restricao obrigatorio para status restrito.");
        return;
      }
      motivoRestricao = trimmed;
    } else {
      const motivoAlteracaoPrompt = window.prompt("Informe o motivo da alteracao do diarista.");
      const trimmed = (motivoAlteracaoPrompt ?? "").trim();
      if (!trimmed) {
        toast.error("Motivo da alteracao obrigatorio.");
        return;
      }
      motivoAlteracao = trimmed;
    }
    setStatusUpdatingId(diaristaId);
    try {
      const updatePayload: Record<string, unknown> = {
        status: nextStatus,
      };
      if (isRestrito) {
        updatePayload.motivo_restricao = motivoRestricao;
        updatePayload.motivo_alteracao = null;
      } else {
        updatePayload.motivo_alteracao = motivoAlteracao;
      }
      const { error } = await supabase
        .from("diaristas")
        .update(updatePayload)
        .eq("id", diaristaId);
      if (error) throw error;
      toast.success("Status do diarista atualizado.");
      queryClient.invalidateQueries({ queryKey: ["diaristas"] });
      queryClient.invalidateQueries({ queryKey: ["diaristas-temporarias"] });
      queryClient.invalidateQueries({ queryKey: ["diaristas-ativos"] });
      queryClient.invalidateQueries({ queryKey: ["diaristas-restritos"] });
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar status do diarista.");
    } finally {
      setStatusUpdatingId(null);
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
                filteredDiaristas?.map((diarista) => {
                  const isTest = isTestDiarista(diarista);
                  return (
                    <TableRow
                      key={diarista.id}
                      className={`cursor-pointer ${isTest ? "bg-yellow-200 hover:bg-yellow-300" : ""}`}
                      onClick={() => setDiaristaDetalhe(diarista)}
                    >
                    <TableCell className="font-medium">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{diarista.nome_completo}</span>
                        {isTest && (
                          <span className="rounded-full bg-yellow-300 px-2 py-0.5 text-xs font-semibold text-yellow-900">
                            Diarista teste (nao compoe a base real de diaristas)
                          </span>
                        )}
                        {blacklistMap.has(diarista.id) && (
                          <span className="rounded-full bg-black px-2 py-0.5 text-xs font-semibold text-white">
                            Blacklist
                          </span>
                        )}
                        {diarista.status === "restrito" && (
                          <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                            Restrito
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{diarista.cidade || "-"}</TableCell>
                    <TableCell>{formatTelefone(diarista.telefone) || "-"}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {diarista.email}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {diarista.banco || "-"}
                    </TableCell>
                    <TableCell>
                      <div
                        className="flex flex-col gap-2"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Badge variant={getStatusVariant(diarista.status)}>
                          {diarista.status || "-"}
                        </Badge>
                        <Select
                          value={diarista.status || ""}
                          onValueChange={(value) =>
                            handleStatusChange(diarista.id, value, diarista.status)
                          }
                          disabled={statusUpdatingId === diarista.id}
                        >
                          <SelectTrigger className="h-8 w-40">
                            <SelectValue placeholder="Alterar status" />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((status) => (
                              <SelectItem key={status} value={status}>
                                {status}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
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
                  );
                })
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
                  <p className="text-xs text-muted-foreground">CPF</p>
                  <p className="font-medium break-words">
                    {formatCpf(diaristaDetalhe.cpf) || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Telefone</p>
                  <p className="font-medium break-words">
                    {formatTelefone(diaristaDetalhe.telefone) || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cidade</p>
                  <p className="font-medium break-words">{diaristaDetalhe.cidade || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">CEP</p>
                  <p className="font-medium break-words">{formatCep(diaristaDetalhe.cep) || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="font-medium break-words">{diaristaDetalhe.status}</p>
                </div>
                {diaristaDetalhe.status === "restrito" && (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-muted-foreground">Motivo restricao</p>
                    <p className="font-medium break-words">
                      {diaristaDetalhe.motivo_restricao || "-"}
                    </p>
                  </div>
                )}
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
                <div>
                  <p className="text-xs text-muted-foreground">PIX pertence ao diarista?</p>
                  <p className="font-medium break-words">
                    {diaristaDetalhe.pix_pertence_beneficiario === true
                      ? "Sim"
                      : diaristaDetalhe.pix_pertence_beneficiario === false
                        ? "Não"
                        : "-"}
                  </p>
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
