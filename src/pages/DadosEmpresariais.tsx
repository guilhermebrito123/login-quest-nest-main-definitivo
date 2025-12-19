import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, Database } from "@/integrations/supabase/types";
import { DashboardLayout } from "@/components/DashboardLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cidadesBrasil } from "@/data/cidades-brasil";
import { ufsBrasil } from "@/data/ufs-brasil";

type Candidate = Tables<"candidatos">;
type Colaborador = Tables<"colaboradores">;
type InternalProfile = Tables<"internal_profiles">;
type UserRole = Database["public"]["Enums"]["user_type"];

const CANDIDATO_ANEXOS_BUCKET = "candidatos-anexos";
const MAX_CURRICULO_BYTES = 20 * 1024 * 1024;

const roleLabels: Record<UserRole, string> = {
  candidato: "Candidato",
  colaborador: "Colaborador",
  perfil_interno: "Perfil interno",
};

const sanitizeFilename = (name: string) => {
  const noAccents = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return noAccents.replace(/[^a-zA-Z0-9._-]/g, "_");
};

const buildCandidateDefaults = (email: string, userId?: string): Candidate => ({
  id: userId ?? crypto.randomUUID(),
  user_id: userId ?? null,
  email,
  nome_completo: "",
  cidade: null,
  estado: null,
  telefone: null,
  celular: null,
  curriculo_path: null,
  experiencia_relevante: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

const buildColaboradorDefaults = (email: string, userId?: string): Colaborador => ({
  id: userId ?? crypto.randomUUID(),
  user_id: userId ?? null,
  email,
  nome_completo: "",
  cpf: "",
  status_colaborador: "ativo",
  telefone: "",
  cargo: "",
  unidade_id: null,
  posto_servico_id: null,
  escala_id: null,
  observacoes: null,
  data_admissao: null,
  data_desligamento: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

const buildInternalDefaults = (userId: string, email?: string): InternalProfile => ({
  user_id: userId,
  cargo: null,
  departamento: null,
  nome_completo: null,
  email: email ?? null,
  phone: null,
  cpf: null,
  nivel_acesso: "cliente_view",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

export default function DadosEmpresariais() {
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [candidateForm, setCandidateForm] = useState<Candidate | null>(null);
  const [colaboradorForm, setColaboradorForm] = useState<Colaborador | null>(null);
  const [internalProfile, setInternalProfile] = useState<InternalProfile | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingCandidate, setSavingCandidate] = useState(false);
  const [uploadingCurriculo, setUploadingCurriculo] = useState(false);
  const [curriculoFile, setCurriculoFile] = useState<File | null>(null);
  const [curriculoSignedUrl, setCurriculoSignedUrl] = useState<string | null>(null);
  const [savingColaborador, setSavingColaborador] = useState(false);
  const [savingInternalProfile, setSavingInternalProfile] = useState(false);
  const [deletingRoleData, setDeletingRoleData] = useState(false);
  const [cidadeSelectOpen, setCidadeSelectOpen] = useState(false);
  const [estadoSelectOpen, setEstadoSelectOpen] = useState(false);
  const [experienceInput, setExperienceInput] = useState("");
  const navigate = useNavigate();

  const cidadeOptions = useMemo(() => Array.from(new Set(cidadesBrasil)), []);
  const ufOptions = useMemo(() => Array.from(new Set(ufsBrasil)), []);
  const cidadeSelectItems = useMemo(
    () =>
      cidadeOptions.map((cidade, idx) => (
        <SelectItem key={`${cidade}-${idx}`} value={cidade}>
          {cidade}
        </SelectItem>
      )),
    [cidadeOptions],
  );
  const ufSelectItems = useMemo(
    () =>
      ufOptions.map((uf) => (
        <SelectItem key={uf} value={uf}>
          {uf}
        </SelectItem>
      )),
    [ufOptions],
  );

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    const refreshUrl = async () => {
      if (candidateForm?.curriculo_path) {
        const { data, error } = await supabase.storage
          .from(CANDIDATO_ANEXOS_BUCKET)
          .createSignedUrl(candidateForm.curriculo_path, 3600);
        if (!error && data?.signedUrl) {
          setCurriculoSignedUrl(data.signedUrl);
          return;
        }
      }
      setCurriculoSignedUrl(null);
    };
    refreshUrl();
  }, [candidateForm?.curriculo_path]);

  useEffect(() => {
    const fetchFromStorage = async () => {
      if (!userId || !userRole || userRole !== "candidato") return;
      if (candidateForm?.curriculo_path) return;
      try {
        const { data, error } = await supabase.storage
          .from(CANDIDATO_ANEXOS_BUCKET)
          .list(`${userId}/curriculo`, { sortBy: { column: "created_at", order: "desc" } });
        if (error) throw error;
        const latest = (data || []).filter((f) => f.name).sort((a, b) => {
          const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
          return bDate - aDate;
        })[0];
        if (!latest) return;
        const path = `${userId}/curriculo/${latest.name}`;
        const { data: signed } = await supabase.storage
          .from(CANDIDATO_ANEXOS_BUCKET)
          .createSignedUrl(path, 3600);
        setCandidateForm((prev) => (prev ? { ...prev, curriculo_path: path } : prev));
        setCurriculoSignedUrl(signed?.signedUrl ?? null);
        // Atualiza no banco, se já existir registro
        await supabase
          .from("candidatos")
          .update({ curriculo_path: path, updated_at: new Date().toISOString() })
          .eq("user_id", userId);
      } catch (err) {
        console.error("Erro ao recuperar curriculo do storage", err);
      }
    };
    fetchFromStorage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, userRole, candidateForm?.curriculo_path]);

  const loadUser = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) {
        navigate("/auth");
        return;
      }

      const email = user.email || "";
      setUserId(user.id);
      setUserEmail(email);
      const { data: userRow, error: profileError } = await supabase
        .from("usuarios")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (profileError) throw profileError;
      await loadRoleData(email, (userRow?.role as UserRole | null) ?? null, user.id);
    } catch (error: any) {
      console.error("Erro ao carregar perfil empresarial", error);
      toast.error(error.message || "Nao foi possivel carregar seus dados");
    } finally {
      setLoading(false);
    }
  };

  const loadRoleData = async (email: string, roleMeta: UserRole | null, userId?: string) => {
    setRoleLoading(true);
    try {
      let role = roleMeta;
      if (!role && userId) {
        const { data } = await supabase.from("usuarios").select("role").eq("id", userId).maybeSingle();
        role = data?.role ?? null;
      }
      setUserRole(role);

      if (role === "candidato") {
        let candidateData: Candidate | null = null;
        const { data: byUser, error: userErr } = await supabase
          .from("candidatos")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();
        if (userErr && userErr.code !== "PGRST116") throw userErr;
        candidateData = byUser ?? null;
        if (!candidateData) {
          const { data: byEmail, error: emailErr } = await supabase
            .from("candidatos")
            .select("*")
            .eq("email", email)
            .maybeSingle();
          if (emailErr && emailErr.code !== "PGRST116") throw emailErr;
          candidateData = byEmail ?? null;
        }
        setCandidateForm(candidateData ?? buildCandidateDefaults(email, userId));
        setColaboradorForm(null);
        setInternalProfile(null);
      } else if (role === "colaborador") {
        let colaboradorData: Colaborador | null = null;
        const { data: byUser, error: userErr } = await supabase
          .from("colaboradores")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();
        if (userErr && userErr.code !== "PGRST116") throw userErr;
        colaboradorData = byUser ?? null;
        if (!colaboradorData) {
          const { data: byEmail, error: emailErr } = await supabase
            .from("colaboradores")
            .select("*")
            .eq("email", email)
            .maybeSingle();
          if (emailErr && emailErr.code !== "PGRST116") throw emailErr;
          colaboradorData = byEmail ?? null;
        }
        setColaboradorForm(colaboradorData ?? buildColaboradorDefaults(email, userId));
        setCandidateForm(null);
        setInternalProfile(null);
      } else if (role === "perfil_interno" && userId) {
        const { data, error } = await supabase
          .from("internal_profiles")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();
        if (error && error.code !== "PGRST116") throw error;
        setInternalProfile(data ?? buildInternalDefaults(userId, email));
        setCandidateForm(null);
        setColaboradorForm(null);
      } else {
        setCandidateForm(null);
        setColaboradorForm(null);
        setInternalProfile(null);
      }
    } catch (error: any) {
      console.error("Erro ao carregar dados empresariais", error);
      toast.error(error.message || "Nao foi possivel carregar dados empresariais");
    } finally {
      setRoleLoading(false);
    }
  };

  const updateCandidateForm = (updates: Partial<Candidate>) => {
    setCandidateForm((prev) => ({
      ...(prev ?? buildCandidateDefaults(userEmail, userId ?? undefined)),
      ...updates,
    }));
  };

  const updateColaboradorForm = (updates: Partial<Colaborador>) => {
    setColaboradorForm((prev) => ({
      ...(prev ?? buildColaboradorDefaults(userEmail, userId ?? undefined)),
      ...updates,
    }));
  };

  const updateInternalProfileForm = (updates: Partial<InternalProfile>) => {
    if (!userId) return;
    setInternalProfile((prev) => ({ ...(prev ?? buildInternalDefaults(userId, userEmail)), ...updates }));
  };

  const handleAddExperience = () => {
    const trimmed = experienceInput.trim();
    if (!trimmed) return;
    updateCandidateForm({
      experiencia_relevante: [...(candidateForm?.experiencia_relevante || []), trimmed],
    });
    setExperienceInput("");
  };

  const handleRemoveExperience = (index: number) => {
    updateCandidateForm({
      experiencia_relevante: (candidateForm?.experiencia_relevante || []).filter((_, i) => i !== index),
    });
  };

  const handleSaveCandidate = async () => {
    if (!userEmail || !userId) {
      toast.error("Usuario nao autenticado");
      return;
    }
    setSavingCandidate(true);
    try {
      // Use existing id se existir para evitar conflito de PK
      let base = candidateForm;
      if (!base) {
        const { data } = await supabase
          .from("candidatos")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();
        base = data ?? null;
      }
      if (!base) {
        const { data } = await supabase
          .from("candidatos")
          .select("*")
          .eq("email", userEmail)
          .maybeSingle();
        base = data ?? buildCandidateDefaults(userEmail, userId);
      }

      let uploadedPath = base.curriculo_path;
      const candidateId = base.id || userId || crypto.randomUUID();
      const previousPath = base.curriculo_path;

      if (curriculoFile) {
        if (curriculoFile.size > MAX_CURRICULO_BYTES) {
          throw new Error("Arquivo de curriculo maior que 20MB");
        }

        const safeName = sanitizeFilename(curriculoFile.name || "curriculo.pdf");
        const path = `${userId}/curriculo/${Date.now()}-${safeName}`;
        setUploadingCurriculo(true);
        const { data, error } = await supabase.storage
          .from(CANDIDATO_ANEXOS_BUCKET)
          .upload(path, curriculoFile, {
            upsert: true,
            cacheControl: "3600",
            contentType: curriculoFile.type || "application/octet-stream",
          });

        if (error) throw error;
        uploadedPath = data?.path ?? path;
        if (previousPath && previousPath !== uploadedPath) {
          await supabase.storage.from(CANDIDATO_ANEXOS_BUCKET).remove([previousPath]);
        }
      }

      const nomeCompleto = base.nome_completo?.trim() || "";
      const cidade = base.cidade?.trim() || null;
      const estado = base.estado?.trim() || null;
      const telefone = base.telefone?.trim() || null;
      const celular = base.celular?.trim() || null;
      const curriculoPath = uploadedPath?.trim() || null;
      const experiencias = (base.experiencia_relevante || [])
        .map((item) => item.trim())
        .filter(Boolean);
      const payload: Candidate = {
        ...base,
        id: candidateId,
        user_id: userId,
        email: userEmail || base.email,
        nome_completo: nomeCompleto,
        cidade,
        estado,
        telefone,
        celular,
        curriculo_path: curriculoPath,
        experiencia_relevante: experiencias.length ? experiencias : null,
        created_at: base.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("candidatos")
        .upsert(payload, { onConflict: "id" })
        .select()
        .maybeSingle();

      if (error) throw error;

      const saved = data ?? payload;
      setCandidateForm(saved);
      setCurriculoFile(null);
      setExperienceInput("");
      if (saved.curriculo_path) {
        const { data: signed } = await supabase.storage
          .from(CANDIDATO_ANEXOS_BUCKET)
          .createSignedUrl(saved.curriculo_path, 3600);
        setCurriculoSignedUrl(signed?.signedUrl ?? null);
      } else {
        setCurriculoSignedUrl(null);
      }
      toast.success("Dados de candidato salvos");
    } catch (error: any) {
      console.error("Erro ao salvar candidato", error);
      toast.error(error.message || "Nao foi possivel salvar dados de candidato");
    } finally {
      setUploadingCurriculo(false);
      setSavingCandidate(false);
    }
  };

  const handleDeleteCandidate = async () => {
    if (!userId) return;
    setDeletingRoleData(true);
    try {
      const { error } = await supabase.from("candidatos").delete().eq("user_id", userId);
      if (error) throw error;
      setCandidateForm(buildCandidateDefaults(userEmail, userId));
      toast.success("Dados de candidato removidos");
    } catch (error: any) {
      console.error("Erro ao remover candidato", error);
      toast.error(error.message || "Nao foi possivel remover dados de candidato");
    } finally {
      setDeletingRoleData(false);
    }
  };

  const handleDeleteCurriculo = async () => {
    if (!userId || !candidateForm?.curriculo_path) return;
    setSavingCandidate(true);
    try {
      const path = candidateForm.curriculo_path;
      await supabase.storage.from(CANDIDATO_ANEXOS_BUCKET).remove([path]);
      const { data, error } = await supabase
        .from("candidatos")
        .update({ curriculo_path: null, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .select()
        .maybeSingle();
      if (error) throw error;
      setCandidateForm((prev) => (prev ? { ...prev, curriculo_path: null, updated_at: data?.updated_at ?? prev.updated_at } : prev));
      setCurriculoFile(null);
      setCurriculoSignedUrl(null);
      toast.success("Curriculo removido");
    } catch (error: any) {
      console.error("Erro ao remover curriculo", error);
      toast.error(error.message || "Nao foi possivel remover o curriculo");
    } finally {
      setSavingCandidate(false);
    }
  };

  const handleSaveColaborador = async () => {
    if (!userEmail || !userId) {
      toast.error("Usuario nao autenticado");
      return;
    }
    setSavingColaborador(true);
    try {
      let base = colaboradorForm;
      if (!base) {
        const { data } = await supabase
          .from("colaboradores")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();
        base = data ?? null;
      }
      if (!base) {
        const { data } = await supabase
          .from("colaboradores")
          .select("*")
          .eq("email", userEmail)
          .maybeSingle();
        base = data ?? buildColaboradorDefaults(userEmail, userId);
      }
      const cpf = base.cpf?.trim() || "CPF nao informado";
      const colaboradorId = userId || base.id || crypto.randomUUID();
      const dataAdmissao = base.data_admissao?.trim() || null;
      const dataDesligamento =
        base.status_colaborador === "inativo" ? base.data_desligamento?.trim() || null : null;
      const payload: Colaborador = {
        ...base,
        id: colaboradorId,
        user_id: userId,
        email: base.email || userEmail,
        nome_completo: base.nome_completo?.trim() || "",
        cpf,
        status_colaborador: base.status_colaborador || "ativo",
        data_admissao: dataAdmissao,
        data_desligamento: dataDesligamento,
        telefone: base.telefone?.trim() || null,
        created_at: base.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("colaboradores")
        .upsert(payload, { onConflict: "id" })
        .select()
        .maybeSingle();

      if (error) throw error;

      const saved = data ?? payload;
      setColaboradorForm(saved);
      toast.success("Dados de colaborador salvos");
    } catch (error: any) {
      console.error("Erro ao salvar colaborador", error);
      toast.error(error.message || "Nao foi possivel salvar dados de colaborador");
    } finally {
      setSavingColaborador(false);
    }
  };

  const handleDeleteColaborador = async () => {
    if (!userId) return;
    setDeletingRoleData(true);
    try {
      const { error } = await supabase.from("colaboradores").delete().eq("user_id", userId);
      if (error) throw error;
      setColaboradorForm(buildColaboradorDefaults(userEmail, userId));
      toast.success("Dados de colaborador removidos");
    } catch (error: any) {
      console.error("Erro ao remover colaborador", error);
      toast.error(error.message || "Nao foi possivel remover dados de colaborador");
    } finally {
      setDeletingRoleData(false);
    }
  };

  const handleSaveInternalProfile = async () => {
    if (!userId) return;
    setSavingInternalProfile(true);
    try {
      const base = internalProfile ?? buildInternalDefaults(userId, userEmail);
      const payload: InternalProfile = {
        ...base,
        user_id: userId,
        cargo: base.cargo?.trim() || null,
        departamento: base.departamento?.trim() || null,
        nome_completo: base.nome_completo?.trim() || null,
        email: base.email?.trim() || null,
        phone: base.phone?.trim() || null,
        cpf: base.cpf?.trim() || null,
        nivel_acesso: base.nivel_acesso || "cliente_view",
        created_at: base.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("internal_profiles")
        .update(payload)
        .eq("user_id", userId)
        .select()
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        toast.error("Nenhum registro interno encontrado para atualizar. Solicite criacao ao administrador.");
        return;
      }

      setInternalProfile(data);
      toast.success("Dados internos salvos");
    } catch (error: any) {
      console.error("Erro ao salvar perfil interno", error);
      toast.error(error.message || "Nao foi possivel salvar dados internos");
    } finally {
      setSavingInternalProfile(false);
    }
  };

  const handleDeleteInternalProfile = async () => {
    if (!userId) return;
    setDeletingRoleData(true);
    try {
      const { error } = await supabase.from("internal_profiles").delete().eq("user_id", userId);
      if (error) throw error;
      setInternalProfile(buildInternalDefaults(userId, userEmail));
      toast.success("Dados internos removidos");
    } catch (error: any) {
      console.error("Erro ao remover perfil interno", error);
      toast.error(error.message || "Nao foi possivel remover dados internos");
    } finally {
      setDeletingRoleData(false);
    }
  };

  const renderRoleFields = () => {
    if (roleLoading) {
      return (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Carregando dados completos...</span>
        </div>
      );
    }

    if (!userRole) {
      return <p className="text-sm text-muted-foreground">Tipo de usuario nao identificado.</p>;
    }

    if (userRole === "candidato") {
      const current = candidateForm ?? buildCandidateDefaults(userEmail, userId ?? undefined);
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Select
                value={current.cidade || undefined}
                onValueChange={(value) => updateCandidateForm({ cidade: value })}
                open={cidadeSelectOpen}
                onOpenChange={setCidadeSelectOpen}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Cidade" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {cidadeSelectOpen
                    ? cidadeSelectItems
                    : current.cidade
                      ? (
                          <SelectItem value={current.cidade}>{current.cidade}</SelectItem>
                        )
                      : null}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select
                value={current.estado || undefined}
                onValueChange={(value) => updateCandidateForm({ estado: value })}
                open={estadoSelectOpen}
                onOpenChange={setEstadoSelectOpen}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Estado (UF)" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {estadoSelectOpen
                    ? ufSelectItems
                    : current.estado
                      ? (
                          <SelectItem value={current.estado}>{current.estado}</SelectItem>
                        )
                      : null}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Celular</Label>
              <Input
                value={current.celular ?? ""}
                onChange={(e) => updateCandidateForm({ celular: e.target.value })}
              />
            </div>
          </div>
          {current.curriculo_path && (
            <div className="space-y-2">
              <Label>Curriculo</Label>
              <div className="flex flex-wrap gap-2 items-center text-sm">
                <span className="text-muted-foreground break-all">{current.curriculo_path}</span>
                {curriculoSignedUrl && (
                  <Button asChild variant="secondary" size="sm">
                    <a href={curriculoSignedUrl} target="_blank" rel="noreferrer">
                      Baixar / abrir
                    </a>
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleDeleteCurriculo} disabled={savingCandidate}>
                  Remover arquivo
                </Button>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label>Enviar curriculo (PDF ou DOC)</Label>
            <Input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(event) => setCurriculoFile(event.target.files?.[0] || null)}
            />
            {curriculoFile ? (
              <p className="text-xs text-muted-foreground">{curriculoFile.name}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                O arquivo sera salvo no bucket privado {CANDIDATO_ANEXOS_BUCKET}.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Experiencias relevantes</Label>
            <div className="flex gap-2">
              <Input
                value={experienceInput}
                onChange={(e) => setExperienceInput(e.target.value)}
                placeholder="Ex: Atendimento ao cliente"
              />
              <Button type="button" onClick={handleAddExperience}>
                Adicionar
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(current.experiencia_relevante || []).map((exp, idx) => (
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
                    x
                  </button>
                </div>
              ))}
              {(current.experiencia_relevante || []).length === 0 && (
                <p className="text-sm text-muted-foreground">Adicione pelo menos uma experiencia.</p>
              )}
            </div>
          </div>
          <div className="flex justify-end">
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleDeleteCandidate} disabled={deletingRoleData}>
                {deletingRoleData ? "Removendo..." : "Remover dados"}
              </Button>
              <Button onClick={handleSaveCandidate} disabled={savingCandidate || uploadingCurriculo}>
                {savingCandidate || uploadingCurriculo ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar dados de candidato"
                )}
              </Button>
            </div>
          </div>
        </div>
      );
    }

    if (userRole === "colaborador") {
      const current = colaboradorForm ?? buildColaboradorDefaults(userEmail, userId ?? undefined);
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>CPF</Label>
              <Input
                value={current.cpf || ""}
                onChange={(e) => updateColaboradorForm({ cpf: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Cargo</Label>
              <Input
                value={current.cargo || ""}
                onChange={(e) => updateColaboradorForm({ cargo: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={current.status_colaborador || undefined}
                onValueChange={(value) =>
                  updateColaboradorForm({ status_colaborador: value as Colaborador["status_colaborador"] })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">ativo</SelectItem>
                  <SelectItem value="inativo">inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data admissao</Label>
              <Input
                type="date"
                value={current.data_admissao || ""}
                onChange={(e) => updateColaboradorForm({ data_admissao: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Data desligamento</Label>
              <Input
                type="date"
                value={current.data_desligamento || ""}
                onChange={(e) => updateColaboradorForm({ data_desligamento: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Unidade ID</Label>
              <Input
                value={current.unidade_id || ""}
                onChange={(e) => updateColaboradorForm({ unidade_id: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Posto de servico ID</Label>
              <Input
                value={current.posto_servico_id || ""}
                onChange={(e) => updateColaboradorForm({ posto_servico_id: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Escala ID</Label>
              <Input
                value={current.escala_id || ""}
                onChange={(e) => updateColaboradorForm({ escala_id: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Observacoes</Label>
            <Textarea
              value={current.observacoes || ""}
              onChange={(e) => updateColaboradorForm({ observacoes: e.target.value })}
            />
          </div>
          <div className="flex justify-end">
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleDeleteColaborador} disabled={deletingRoleData}>
                {deletingRoleData ? "Removendo..." : "Remover dados"}
              </Button>
              <Button onClick={handleSaveColaborador} disabled={savingColaborador}>
                {savingColaborador ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar dados de colaborador"
                )}
              </Button>
            </div>
          </div>
        </div>
      );
    }

    if (!userId) {
      return <p className="text-sm text-muted-foreground">Usuario nao autenticado.</p>;
    }

    const internal = internalProfile ?? buildInternalDefaults(userId, userEmail);
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>CPF</Label>
            <Input
              value={internal.cpf ?? ""}
              onChange={(e) => updateInternalProfileForm({ cpf: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Cargo</Label>
            <Input
              value={internal.cargo ?? ""}
              onChange={(e) => updateInternalProfileForm({ cargo: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Departamento</Label>
            <Input
              value={internal.departamento ?? ""}
              onChange={(e) => updateInternalProfileForm({ departamento: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Nivel de acesso</Label>
            <Input value={internal.nivel_acesso ?? ""} disabled />
          </div>
        </div>
        <div className="flex justify-end">
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDeleteInternalProfile} disabled={deletingRoleData}>
              {deletingRoleData ? "Removendo..." : "Remover dados"}
            </Button>
            <Button onClick={handleSaveInternalProfile} disabled={savingInternalProfile}>
              {savingInternalProfile ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar dados internos"
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Dados empresariais</p>
            <h1 className="text-3xl font-semibold">Perfil empresarial</h1>
            <p className="text-muted-foreground">
              Visualize e edite dados de candidato, colaborador ou perfil interno, conforme seu tipo de usuario.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Dados completos ({userRole ? roleLabels[userRole] : "perfil"})</CardTitle>
            <CardDescription>
              Informacoes especificas do seu papel na empresa.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Carregando...</span>
              </div>
            ) : (
              renderRoleFields()
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
