import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cidadesBrasil } from "@/data/cidades-brasil";
import { ufsBrasil } from "@/data/ufs-brasil";
import { toast } from "@/hooks/use-toast";
import { Upload, CheckCircle2, ArrowLeft, ArrowRight } from "lucide-react";

type CandidateInsert = Database["public"]["Tables"]["candidatos"]["Insert"];

const TOTAL_FIELDS = 7; // nome, email, cidade, estado, telefone, celular, experiencias, curriculo

const sanitizeFilename = (name: string) => {
  const noAccents = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return noAccents.replace(/[^a-zA-Z0-9._-]/g, "_");
};

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB
const CANDIDATO_ANEXOS_BUCKET = "candidatos-anexos";

const CandidatoCadastro = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [experienceInput, setExperienceInput] = useState("");
  const [curriculoFile, setCurriculoFile] = useState<File | null>(null);

  const cidadeOptions = useMemo(() => Array.from(new Set(cidadesBrasil)), []);
  const ufOptions = useMemo(() => Array.from(new Set(ufsBrasil)), []);

  const [form, setForm] = useState<CandidateInsert>({
    nome_completo: "",
    email: "",
    cidade: "",
    estado: "",
    telefone: "",
    celular: "",
    curriculo_path: "",
    experiencia_relevante: [],
  });

  const steps = [
    { title: "Dados pessoais", description: "Nome e contato primario" },
    { title: "Localizacao", description: "Cidade e estado" },
    { title: "Contato", description: "Telefones para retorno" },
    { title: "Experiencia", description: "Adicione experiencias relevantes" },
    { title: "Curriculo", description: "Envie seu curriculo" },
    { title: "Revisao", description: "Confirme e envie" },
  ];

  const filledCount = useMemo(() => {
    let count = 0;
    if (form.nome_completo.trim()) count++;
    if (form.email.trim()) count++;
    if (form.cidade.trim()) count++;
    if (form.estado.trim()) count++;
    if (form.telefone.trim()) count++;
    if (form.celular.trim()) count++;
    if ((form.experiencia_relevante || []).length > 0) count++;
    if (form.curriculo_path || curriculoFile) count++;
    return Math.min(count, TOTAL_FIELDS);
  }, [form, curriculoFile]);

  const progress = Math.round((filledCount / TOTAL_FIELDS) * 100);

  const handleAddExperience = () => {
    const trimmed = experienceInput.trim();
    if (!trimmed) return;
    setForm((prev) => ({
      ...prev,
      experiencia_relevante: [...(prev.experiencia_relevante || []), trimmed],
    }));
    setExperienceInput("");
  };

  const handleRemoveExperience = (index: number) => {
    setForm((prev) => ({
      ...prev,
      experiencia_relevante: (prev.experiencia_relevante || []).filter((_, i) => i !== index),
    }));
  };

  const handleUploadCurriculo = async (candidateId: string) => {
    if (!curriculoFile) return form.curriculo_path;
    if (curriculoFile.size > MAX_FILE_BYTES) {
      throw new Error("Arquivo de currículo maior que 20MB");
    }
    setUploading(true);
    const safeName = sanitizeFilename(curriculoFile.name || "curriculo.pdf");
    const path = `${candidateId}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from(CANDIDATO_ANEXOS_BUCKET).upload(path, curriculoFile, {
      upsert: true,
      cacheControl: "3600",
      contentType: curriculoFile.type || "application/octet-stream",
    });
    setUploading(false);
    if (error) throw error;
    return path;
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      const candidateId = crypto.randomUUID();
      const uploadedPath = await handleUploadCurriculo(candidateId);

      const payload: CandidateInsert = {
        ...form,
        id: candidateId,
        curriculo_path: uploadedPath || form.curriculo_path,
        experiencia_relevante: form.experiencia_relevante || [],
      };

      const { error } = await supabase.from("candidatos").insert(payload);
      if (error) throw error;

      toast({
        title: "Cadastro enviado",
        description: "Recebemos seu currículo. Entraremos em contato em breve.",
      });
      navigate("/");
    } catch (error: any) {
      toast({
        title: "Erro ao enviar",
        description: error.message || "Nao foi possivel salvar seu cadastro.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const canGoNext = () => {
    switch (step) {
      case 0:
        return form.nome_completo.trim() && form.email.trim();
      case 1:
        return form.cidade.trim() && form.estado.trim();
      case 2:
        return form.telefone.trim() && form.celular.trim();
      case 3:
        return (form.experiencia_relevante || []).length > 0;
      case 4:
        return !!(form.curriculo_path || curriculoFile);
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (step < steps.length - 1 && canGoNext()) setStep((prev) => prev + 1);
  };

  const prevStep = () => {
    if (step > 0) setStep((prev) => prev - 1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/10">
      <div className="container mx-auto px-4 py-10 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" onClick={() => navigate("/")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <h1 className="text-2xl font-bold">Cadastro de Candidatos</h1>
        </div>

        <Card className="border shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Complete seu cadastro</span>
              <span className="text-sm text-muted-foreground">{progress}%</span>
            </CardTitle>
            <Progress value={progress} className="h-2" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3 mb-6">
              {steps.map((s, idx) => (
                <div
                  key={s.title}
                  className={`px-3 py-2 rounded-lg text-sm ${
                    idx === step
                      ? "bg-primary text-primary-foreground"
                      : idx < step
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                  } transition-all`}
                >
                  {s.title}
                </div>
              ))}
            </div>

            <div className="space-y-6 transition-all duration-200">
              {step === 0 && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nome completo</Label>
                    <Input
                      value={form.nome_completo}
                      onChange={(e) => setForm((prev) => ({ ...prev, nome_completo: e.target.value }))}
                      placeholder="Seu nome completo"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="email@exemplo.com"
                    />
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Cidade</Label>
                    <Select
                      value={form.cidade || undefined}
                      onValueChange={(value) => setForm((prev) => ({ ...prev, cidade: value }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione sua cidade" />
                      </SelectTrigger>
                        <SelectContent className="max-h-72">
                          {cidadeOptions.map((cidade, index) => (
                            <SelectItem key={`${cidade}-${index}`} value={cidade}>
                              {cidade}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Select
                      value={form.estado || undefined}
                      onValueChange={(value) => setForm((prev) => ({ ...prev, estado: value }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione o estado (UF)" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {ufOptions.map((uf) => (
                          <SelectItem key={uf} value={uf}>
                            {uf}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input
                      value={form.telefone}
                      onChange={(e) => setForm((prev) => ({ ...prev, telefone: e.target.value }))}
                      placeholder="(00) 0000-0000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Celular</Label>
                    <Input
                      value={form.celular}
                      onChange={(e) => setForm((prev) => ({ ...prev, celular: e.target.value }))}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Experiencias relevantes</Label>
                    <div className="flex gap-2">
                      <Input
                        value={experienceInput}
                        onChange={(e) => setExperienceInput(e.target.value)}
                        placeholder="Ex: Monitoramento, atendimento ao cliente..."
                      />
                      <Button onClick={handleAddExperience} type="button">
                        Adicionar
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(form.experiencia_relevante || []).map((exp, idx) => (
                      <div
                        key={`${exp}-${idx}`}
                        className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm flex items-center gap-2"
                      >
                        <span>{exp}</span>
                        <button
                          type="button"
                          className="text-primary hover:text-primary/70"
                          onClick={() => handleRemoveExperience(idx)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {(form.experiencia_relevante || []).length === 0 && (
                      <p className="text-sm text-muted-foreground">Adicione pelo menos uma experiencia.</p>
                    )}
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Curriculo (PDF ou DOC)</Label>
                    <div className="border border-dashed rounded-lg p-4 flex flex-col items-center justify-center gap-2">
                      <Upload className="h-6 w-6 text-primary" />
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => setCurriculoFile(e.target.files?.[0] || null)}
                      />
                      {curriculoFile && (
                        <p className="text-sm text-muted-foreground">{curriculoFile.name}</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Ou cole um link para o curriculo</Label>
                    <Input
                      value={form.curriculo_path}
                      onChange={(e) => setForm((prev) => ({ ...prev, curriculo_path: e.target.value }))}
                      placeholder="Link para o curriculo"
                    />
                  </div>
                </div>
              )}

              {step === 5 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-5 w-5" />
                    <span>Revise seus dados antes de enviar</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <p><strong>Nome:</strong> {form.nome_completo}</p>
                      <p><strong>Email:</strong> {form.email}</p>
                      <p><strong>Telefone:</strong> {form.telefone}</p>
                      <p><strong>Celular:</strong> {form.celular}</p>
                    </div>
                    <div className="space-y-1">
                      <p><strong>Cidade/Estado:</strong> {form.cidade} / {form.estado}</p>
                      <p><strong>Experiencias:</strong> {(form.experiencia_relevante || []).join(", ")}</p>
                      <p><strong>Curriculo:</strong> {curriculoFile?.name || form.curriculo_path || "Nao informado"}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8 flex justify-between">
              <Button variant="outline" onClick={prevStep} disabled={step === 0}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              {step < steps.length - 1 ? (
                <Button onClick={nextStep} disabled={!canGoNext()}>
                  Avancar
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={saving || uploading}>
                  {saving || uploading ? "Enviando..." : "Enviar candidatura"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CandidatoCadastro;
