import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

type DiaristaRestritoRow = {
  id: string;
  nome_completo: string | null;
  telefone: string | null;
  email: string | null;
  cidade: string | null;
  cep?: string | null;
  cpf?: string | null;
  banco?: string | null;
  agencia?: string | null;
  tipo_conta?: string | null;
  numero_conta?: string | null;
  pix?: string | null;
  pix_pertence_beneficiario?: boolean | null;
  anexo_cpf?: string | null;
  anexo_comprovante_endereco?: string | null;
  anexo_dados_bancarios?: string | null;
  anexo_possui_antecedente?: string | null;
  status: string | null;
};

type DiaristaAnexo = {
  id: string;
  nome_arquivo: string;
  caminho_storage: string;
  created_at: string;
  url?: string | null;
};

const BUCKET = "diaristas-anexos";

const DIARISTA_DOCUMENTS = [
  { key: "anexo_cpf", label: "Documento CPF" },
  { key: "anexo_comprovante_endereco", label: "Comprovante de endereco" },
  { key: "anexo_dados_bancarios", label: "Dados bancarios" },
  { key: "anexo_possui_antecedente", label: "Comprovante antecedentes" },
] as const;

export default function DiaristasRestritos() {
  const [searchTerm, setSearchTerm] = useState("");
  const [diaristaDetalhe, setDiaristaDetalhe] = useState<any>(null);
  const [detalheAnexos, setDetalheAnexos] = useState<DiaristaAnexo[]>([]);
  const [loadingAnexos, setLoadingAnexos] = useState(false);
  const { data: diaristasRestritos = [], isLoading } = useQuery({
    queryKey: ["diaristas-restritos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diaristas")
        .select("*")
        .eq("status", "restrito")
        .order("nome_completo");
      if (error) throw error;
      return (data || []) as DiaristaRestritoRow[];
    },
  });

  const filteredDiaristas = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return diaristasRestritos;
    return diaristasRestritos.filter((diarista) =>
      [
        diarista.nome_completo,
        diarista.email,
        diarista.telefone,
        diarista.cidade,
      ]
        .filter(Boolean)
        .some((value) => (value ?? "").toLowerCase().includes(term)),
    );
  }, [diaristasRestritos, searchTerm]);

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
        }),
      );

      setDetalheAnexos(anexosComUrl);
    } catch {
      setDetalheAnexos([]);
    } finally {
      setLoadingAnexos(false);
    }
  };

  const getSignedUrl = async (path: string) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 120);
    if (error || !data?.signedUrl) {
      throw new Error(error?.message || "Nao foi possivel gerar o link");
    }
    return data.signedUrl;
  };

  const handleViewDocumentoObrigatorio = async (path: string) => {
    try {
      const url = await getSignedUrl(path);
      window.open(url, "_blank");
    } catch {
      // Ignora para manter o fluxo simples na listagem de restritos.
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
    } catch {
      // Ignora para manter o fluxo simples na listagem de restritos.
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
        <div>
          <p className="text-sm text-muted-foreground uppercase tracking-wide">Diaristas</p>
          <h1 className="text-3xl font-bold">Diaristas restritos</h1>
          <p className="text-sm text-muted-foreground">
            Listagem de diaristas com status restrito.
          </p>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Restritos</CardTitle>
            <CardDescription>Diaristas com status restrito.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Input
                placeholder="Buscar por nome, email, telefone ou cidade..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Diarista</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : filteredDiaristas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center">
                        Nenhum registro encontrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDiaristas.map((diarista) => (
                      <TableRow
                        key={diarista.id}
                        className="cursor-pointer"
                        onClick={() => setDiaristaDetalhe(diarista)}
                      >
                        <TableCell className="whitespace-nowrap">{diarista.id}</TableCell>
                        <TableCell>{diarista.nome_completo || "-"}</TableCell>
                        <TableCell>{diarista.cidade || "-"}</TableCell>
                        <TableCell>{diarista.telefone || "-"}</TableCell>
                        <TableCell>{diarista.email || "-"}</TableCell>
                        <TableCell>{diarista.status || "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

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
                  <p className="font-medium break-words">{diaristaDetalhe.cpf || "-"}</p>
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
                  <p className="font-medium break-words">{diaristaDetalhe.status || "-"}</p>
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
                <div>
                  <p className="text-xs text-muted-foreground">PIX pertence ao diarista?</p>
                  <p className="font-medium break-words">
                    {diaristaDetalhe.pix_pertence_beneficiario === true
                      ? "Sim"
                      : diaristaDetalhe.pix_pertence_beneficiario === false
                        ? "Nao"
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
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewDocumentoObrigatorio(path)}
                            >
                              Visualizar
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleDownloadDocumentoObrigatorio(path)}
                            >
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
                              <a
                                href={anexo.url}
                                target="_blank"
                                rel="noreferrer"
                                download={anexo.nome_arquivo}
                              >
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
