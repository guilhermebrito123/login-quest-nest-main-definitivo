import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import * as XLSX from "xlsx";
import { formatDate, formatDateTime, normalizeStatus, STATUS } from "./diarias/utils";
import { useDiariasTemporariasData } from "./diarias/temporariasUtils";
import { FaltaJustificarDialog } from "@/components/faltas/FaltaJustificarDialog";
import { toast } from "sonner";
import { useSession } from "@/hooks/useSession";
import { format } from "date-fns";

const BUCKET = "atestados";
const CLIENTE_FILTER_ALL = "__all__";
const COLABORADOR_FILTER_ALL = "__all__";
const DIARIA_VINCULO_FILTER_ALL = "__all__";
const DIARIA_VINCULO_FILTER_COM = "com_diaria";
const DIARIA_VINCULO_FILTER_SEM = "sem_diaria";
const ADVANCED_FILTER_ALL = "__all__";
const MOTIVO_FALTA_INJUSTIFICADA = "FALTA INJUSTIFICADA";
const MOTIVO_FALTA_JUSTIFICADA = "FALTA JUSTIFICADA";
const MOTIVO_DIARIA_FALTA = "DIÁRIA - FALTA";
const MOTIVO_DIARIA_FALTA_ATESTADO = "DIÁRIA - FALTA ATESTADO";
const FALTAS_PAGE_SIZE = 10;
const BASE_FALTAS_EXPORT_HEADERS = [
  "COLABORADOR",
  "COLABORADOR ID",
  "DATA DA FALTA",
  "MOTIVO",
  "JUSTIFICADA POR",
];

const CONVENIA_FIELD_DEFS = [
  { key: "id", label: "ID colaborador convenia" },
  { key: "convenia_id", label: "ID convenia" },
  { key: "name", label: "Nome" },
  { key: "last_name", label: "Sobrenome" },
  { key: "social_name", label: "Nome social" },
  { key: "cpf", label: "CPF" },
  { key: "registration", label: "Matricula" },
  { key: "pis", label: "PIS" },
  { key: "birth_date", label: "Data de nascimento" },
  { key: "email", label: "Email" },
  { key: "personal_email", label: "Email pessoal" },
  { key: "personal_phone", label: "Telefone pessoal" },
  { key: "residential_phone", label: "Telefone residencial" },
  { key: "address_zip_code", label: "CEP" },
  { key: "address_street", label: "Logradouro" },
  { key: "address_number", label: "Numero" },
  { key: "address_complement", label: "Complemento" },
  { key: "address_district", label: "Bairro" },
  { key: "address_city", label: "Cidade" },
  { key: "address_state", label: "Estado" },
  { key: "job_id", label: "ID cargo" },
  { key: "job_name", label: "Cargo" },
  { key: "department_id", label: "ID departamento" },
  { key: "department_name", label: "Departamento" },
  { key: "team_id", label: "ID equipe" },
  { key: "team_name", label: "Equipe" },
  { key: "supervisor_id", label: "ID supervisor" },
  { key: "supervisor_name", label: "Supervisor nome" },
  { key: "supervisor_last_name", label: "Supervisor sobrenome" },
  { key: "cost_center_id", label: "Centro de custo ID" },
  { key: "cost_center_name", label: "Centro de custo" },
  { key: "cost_center", label: "Centro de custo (detalhes)" },
  { key: "salary", label: "Salario" },
  { key: "status", label: "Status" },
  { key: "hiring_date", label: "Data de admissao" },
  { key: "ctps_number", label: "CTPS numero" },
  { key: "ctps_serial_number", label: "CTPS serie" },
  { key: "ctps_emission_date", label: "CTPS emissao" },
  { key: "rg_number", label: "RG numero" },
  { key: "rg_issuing_agency", label: "RG orgao emissor" },
  { key: "rg_emission_date", label: "RG emissao" },
  { key: "driver_license_number", label: "CNH numero" },
  { key: "driver_license_category", label: "CNH categoria" },
  { key: "driver_license_emission_date", label: "CNH emissao" },
  { key: "driver_license_validate_date", label: "CNH validade" },
  { key: "annotations", label: "Anotacoes" },
  { key: "aso", label: "ASO" },
  { key: "bank_accounts", label: "Contas bancarias" },
  { key: "disability", label: "Deficiencia" },
  { key: "educations", label: "Educacoes" },
  { key: "electoral_card", label: "Titulo de eleitor" },
  { key: "emergency_contacts", label: "Contatos de emergencia" },
  { key: "experience_period", label: "Periodo de experiencia" },
  { key: "foreign_data", label: "Dados estrangeiro" },
  { key: "intern_data", label: "Dados estagiario" },
  { key: "nationalities", label: "Nacionalidades" },
  { key: "payroll", label: "Folha de pagamento" },
  { key: "raw_data", label: "Dados brutos" },
  { key: "reservist", label: "Reservista" },
  { key: "synced_at", label: "Sincronizado em" },
  { key: "created_at", label: "Criado em" },
  { key: "updated_at", label: "Atualizado em" },
] as const;

const CONVENIA_FIELD_LABEL_MAP = new Map(
  CONVENIA_FIELD_DEFS.map((field) => [field.key, field.label]),
);

const CONVENIA_FIELD_GROUPS = [
  {
    id: "identificacao",
    label: "Identificacao",
    keys: [
      "id",
      "convenia_id",
      "name",
      "last_name",
      "social_name",
      "cpf",
      "registration",
      "pis",
      "birth_date",
      "status",
    ],
  },
  {
    id: "contato",
    label: "Contato",
    keys: ["email", "personal_email", "personal_phone", "residential_phone"],
  },
  {
    id: "endereco",
    label: "Endereco",
    keys: [
      "address_zip_code",
      "address_street",
      "address_number",
      "address_complement",
      "address_district",
      "address_city",
      "address_state",
    ],
  },
  {
    id: "organizacao",
    label: "Organizacao",
    keys: [
      "job_id",
      "job_name",
      "department_id",
      "department_name",
      "team_id",
      "team_name",
      "supervisor_id",
      "supervisor_name",
      "supervisor_last_name",
      "cost_center_id",
      "cost_center_name",
      "cost_center",
      "salary",
      "hiring_date",
    ],
  },
  {
    id: "documentos",
    label: "Documentos",
    keys: [
      "ctps_number",
      "ctps_serial_number",
      "ctps_emission_date",
      "rg_number",
      "rg_issuing_agency",
      "rg_emission_date",
      "driver_license_number",
      "driver_license_category",
      "driver_license_emission_date",
      "driver_license_validate_date",
      "electoral_card",
      "reservist",
      "aso",
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    keys: ["bank_accounts", "payroll"],
  },
  {
    id: "pessoal",
    label: "Pessoal",
    keys: [
      "disability",
      "educations",
      "nationalities",
      "foreign_data",
      "intern_data",
      "experience_period",
      "emergency_contacts",
    ],
  },
  {
    id: "sistema",
    label: "Sistema",
    keys: ["annotations", "raw_data", "synced_at", "created_at", "updated_at"],
  },
];

const CONVENIA_FIELD_GROUPS_WITH_FALLBACK = (() => {
  const groupedKeys = new Set(CONVENIA_FIELD_GROUPS.flatMap((group) => group.keys));
  const remainingKeys = CONVENIA_FIELD_DEFS.map((field) => field.key).filter(
    (key) => !groupedKeys.has(key),
  );
  if (remainingKeys.length === 0) return CONVENIA_FIELD_GROUPS;
  return [
    ...CONVENIA_FIELD_GROUPS,
    {
      id: "outros",
      label: "Outros",
      keys: remainingKeys,
    },
  ];
})();

const CONVENIA_EXPORT_FIELDS = CONVENIA_FIELD_DEFS.filter(
  (field) => field.key !== "id",
);

const FALTAS_CONVENIA_EXPORT_COLUMNS = Array.from(
  new Set([
    ...BASE_FALTAS_EXPORT_HEADERS,
    ...CONVENIA_EXPORT_FIELDS.map((field) => field.label.toUpperCase()),
  ]),
);

type AccessLevel = Database["public"]["Enums"]["internal_access_level"];

const FALTAS_COLABORADOR_JUSTIFICAR_LEVELS: AccessLevel[] = [
  "admin",
  "gestor_operacoes",
  "supervisor",
];

const FALTAS_CONVENIA_JUSTIFICAR_LEVELS: AccessLevel[] = [
  "admin",
  "gestor_operacoes",
  "supervisor",
  "assistente_operacoes",
];

const FALTAS_CONVENIA_REVERTER_LEVELS: AccessLevel[] = [
  "admin",
  "gestor_operacoes",
  "supervisor",
  "assistente_operacoes",
  "analista_centro_controle",
];

const FALTAS_CONVENIA_CREATE_LEVELS: AccessLevel[] = [
  "admin",
  "gestor_operacoes",
  "supervisor",
];

const FALTAS_CONVENIA_UPDATE_LEVELS: AccessLevel[] = [
  "admin",
  "gestor_operacoes",
  "supervisor",
];

const FALTAS_CONVENIA_DELETE_LEVELS: AccessLevel[] = ["admin"];

type FaltaTipo = "convenia";

type FaltaRow = {
  id: number;
  colaborador_id: string;
  diaria_temporaria_id: number;
  motivo: string;
  documento_url: string | null;
  justificada_em: string | null;
  justificada_por: string | null;
  created_at: string;
  updated_at: string;
  tipo: "colaborador";
};

type FaltaConveniaRow = {
  id: number;
  colaborador_convenia_id: string;
  diaria_temporaria_id: number | null;
  data_falta: string;
  motivo: string;
  atestado_path: string | null;
  justificada_em: string | null;
  justificada_por: string | null;
  created_at: string;
  updated_at: string;
  tipo: "convenia";
};

type FaltaData = FaltaRow | FaltaConveniaRow;
type FaltaRowDb = Omit<FaltaRow, "tipo">;
type FaltaConveniaRowDb = Omit<FaltaConveniaRow, "tipo">;
type FaltaGroup = {
  key: string;
  colaboradorId: string;
  colaboradorNome: string;
  ids: number[];
  clientes: Set<string>;
  count: number;
  pendentes: number;
  justificadas: number;
  lastDateKey: number;
  lastDateLabel: string;
  clienteLabel: string;
};

const getClienteInfoFromPosto = (postoInfo: any) => {
  const contrato = postoInfo?.unidade?.contrato;
  if (contrato?.cliente_id || contrato?.clientes?.nome_fantasia || contrato?.clientes?.razao_social) {
    return {
      id: contrato.cliente_id ?? "",
      nome: contrato.clientes?.nome_fantasia || contrato.clientes?.razao_social || "Cliente nao informado",
    };
  }
  return null;
};

const getConveniaColaboradorNome = (colaborador?: {
  name?: string | null;
  last_name?: string | null;
  social_name?: string | null;
  id?: string;
} | null) => {
  if (!colaborador) return "-";
  const base = (colaborador.social_name || colaborador.name || "").trim();
  const last = (colaborador.last_name || "").trim();
  const full = [base, last].filter(Boolean).join(" ").trim();
  return full || colaborador.name || colaborador.id || "-";
};

const STATUS_FILTERS = [
  { value: "todos", label: "Todas" },
  { value: "pendente", label: "Injustificadas" },
  { value: "justificada", label: "Justificadas" },
];

const FALTA_TYPE_OPTIONS: { value: FaltaTipo; label: string }[] = [
  { value: "convenia", label: "Convenia" },
];

const Faltas = () => {
  const { session, loading: sessionLoading } = useSession();
  const [statusFilter, setStatusFilter] = useState("pendente");
  const [searchTerm, setSearchTerm] = useState("");
  const [clienteFilter, setClienteFilter] = useState(CLIENTE_FILTER_ALL);
  const [colaboradorFilter, setColaboradorFilter] = useState(COLABORADOR_FILTER_ALL);
  const [diariaVinculoFilter, setDiariaVinculoFilter] = useState(DIARIA_VINCULO_FILTER_ALL);
  const [faltaType, setFaltaType] = useState<FaltaTipo>("convenia");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedFalta, setSelectedFalta] = useState<FaltaData | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [detailsFalta, setDetailsFalta] = useState<FaltaData | null>(null);
  const [dateRangeFilter, setDateRangeFilter] = useState({
    startDate: "",
    endDate: "",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [advancedDialogOpen, setAdvancedDialogOpen] = useState(false);
  const [advancedDateRange, setAdvancedDateRange] = useState({
    startDate: "",
    endDate: "",
  });
  const [advancedTotalRange, setAdvancedTotalRange] = useState({
    colaboradorId: "",
  });
  const [advancedInjustificadaRange, setAdvancedInjustificadaRange] = useState({
    colaboradorId: "",
  });
  const [advancedJustificadaRange, setAdvancedJustificadaRange] = useState({
    colaboradorId: "",
  });
  const [faltaFormOpen, setFaltaFormOpen] = useState(false);
  const [faltaFormMode, setFaltaFormMode] = useState<"create" | "edit">("create");
  const [faltaFormSaving, setFaltaFormSaving] = useState(false);
  const [faltaFormTarget, setFaltaFormTarget] = useState<FaltaConveniaRow | null>(null);
  const [faltaForm, setFaltaForm] = useState({
    colaboradorId: "",
    dataFalta: "",
    diariaId: "",
  });
  const [faltaFormDates, setFaltaFormDates] = useState<Date[]>([]);
  const [faltasView, setFaltasView] = useState<"lista" | "agrupadas">("lista");
  const [ordenarListaAlfabetica, setOrdenarListaAlfabetica] = useState(false);
  const [ordenarListaPorDataDesc, setOrdenarListaPorDataDesc] = useState(false);
  const [ordenarAgrupadasAlfabetica, setOrdenarAgrupadasAlfabetica] = useState(true);
  const [ordenarAgrupadasPorDataDesc, setOrdenarAgrupadasPorDataDesc] = useState(false);
  const [groupDetailsDialogOpen, setGroupDetailsDialogOpen] = useState(false);
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);

  const [accessLevel, setAccessLevel] = useState<AccessLevel | null>(null);
  const [accessLoading, setAccessLoading] = useState(true);
  const [revertingId, setRevertingId] = useState<number | null>(null);

  useEffect(() => {
    if (sessionLoading || !session) return;
    const loadAccessLevel = async () => {
      try {
        const { data, error } = await supabase.rpc("current_internal_access_level");
        if (error) throw error;
        setAccessLevel(data ?? null);
      } catch (error) {
        console.error("Erro ao carregar nivel de acesso interno", error);
        setAccessLevel(null);
      } finally {
        setAccessLoading(false);
      }
    };
    loadAccessLevel();
  }, [sessionLoading, session?.user?.id]);

  const {
    diarias,
    costCenters,
    colaboradoresConvenia,
    colaboradoresMap,
    colaboradoresConveniaMap,
    postoMap,
    clienteMap,
    costCenterMap,
    refetchDiarias,
  } = useDiariasTemporariasData();

  const diariaMap = useMemo(() => {
    const map = new Map<string, any>();
    diarias.forEach((diaria) => {
      map.set(String(diaria.id), diaria);
    });
    return map;
  }, [diarias]);
  const normalizedCancelada = normalizeStatus(STATUS.cancelada);
  const normalizedReprovada = normalizeStatus(STATUS.reprovada);

  const {
    data: faltasColaboradoresRaw = [],
    isLoading: loadingFaltasColaboradores,
    refetch: refetchFaltasColaboradores,
  } = useQuery({
    queryKey: ["colaborador-faltas", session?.user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaborador_faltas")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as FaltaRowDb[];
    },
    enabled: !!session,
  });

  const {
    data: faltasConveniaRaw = [],
    isLoading: loadingFaltasConvenia,
    refetch: refetchFaltasConvenia,
  } = useQuery({
    queryKey: ["faltas-convenia", session?.user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("faltas_colaboradores_convenia")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as FaltaConveniaRowDb[];
    },
    enabled: !!session,
  });

  const faltasColaboradores = useMemo(
    () =>
      faltasColaboradoresRaw.map((falta) => ({
        ...falta,
        tipo: "colaborador" as const,
      })),
    [faltasColaboradoresRaw],
  );

  const faltasConvenia = useMemo(
    () =>
      faltasConveniaRaw.map((falta) => ({
        ...falta,
        tipo: "convenia" as const,
      })),
    [faltasConveniaRaw],
  );

  const faltasAtivas = faltaType === "convenia" ? faltasConvenia : faltasColaboradores;
  const loadingFaltas = faltaType === "convenia" ? loadingFaltasConvenia : loadingFaltasColaboradores;

  const justificativaIds = useMemo(() => {
    const ids = new Set<string>();
    [...faltasColaboradores, ...faltasConvenia].forEach((item) => {
      if (item.justificada_por) ids.add(item.justificada_por);
    });
    return Array.from(ids);
  }, [faltasColaboradores, faltasConvenia]);

  const { data: usuarios = [] } = useQuery({
    queryKey: ["faltas-usuarios", session?.user?.id, justificativaIds],
    queryFn: async () => {
      if (justificativaIds.length === 0) return [];
      const { data, error } = await supabase
        .from("usuarios")
        .select("id, full_name, email")
        .in("id", justificativaIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!session && justificativaIds.length > 0,
  });

  const usuarioMap = useMemo(() => {
    const map = new Map<string, string>();
    usuarios.forEach((usuario: any) => {
      if (!usuario?.id) return;
      map.set(usuario.id, usuario.full_name || usuario.id);
    });
    return map;
  }, [usuarios]);

  const colaboradorConveniaOptions = useMemo(
    () =>
      colaboradoresConvenia
        .map((colaborador) => ({
          id: colaborador.id,
          label: getConveniaColaboradorNome(colaborador),
        }))
        .filter((item) => item.id)
        .sort((a, b) => a.label.localeCompare(b.label)),
    [colaboradoresConvenia],
  );

  const canCreateFaltaConvenia = () =>
    !!accessLevel && FALTAS_CONVENIA_CREATE_LEVELS.includes(accessLevel);
  const canUpdateFaltaConvenia = () =>
    !!accessLevel && FALTAS_CONVENIA_UPDATE_LEVELS.includes(accessLevel);
  const canDeleteFaltaConvenia = () =>
    !!accessLevel && FALTAS_CONVENIA_DELETE_LEVELS.includes(accessLevel);

  const canJustifyFalta = (falta: FaltaData) => {
    if (!accessLevel) return false;
    const allowed =
      falta.tipo === "convenia"
        ? FALTAS_CONVENIA_JUSTIFICAR_LEVELS
        : FALTAS_COLABORADOR_JUSTIFICAR_LEVELS;
    return allowed.includes(accessLevel);
  };

  const canRevertFalta = (falta: FaltaData) => {
    if (!accessLevel) return false;
    if (falta.tipo !== "convenia") return false;
    return FALTAS_CONVENIA_REVERTER_LEVELS.includes(accessLevel);
  };

  const getFaltaColaboradorNome = (falta: FaltaData) => {
    if (falta.tipo === "colaborador") {
      return colaboradoresMap.get(falta.colaborador_id)?.nome_completo || falta.colaborador_id;
    }
    const convenia = colaboradoresConveniaMap.get(falta.colaborador_convenia_id);
    return getConveniaColaboradorNome(convenia) || falta.colaborador_convenia_id;
  };

  const getConveniaCostCenterName = (colaboradorId: string) => {
    const convenia = colaboradoresConveniaMap.get(colaboradorId);
    if (!convenia) return "-";
    const costCenterId = convenia.cost_center_id || "";
    const costCenterName = costCenterId ? costCenterMap.get(costCenterId) : null;
    return costCenterName || "-";
  };

  const getConveniaCostCenterId = (colaboradorId: string) => {
    const convenia = colaboradoresConveniaMap.get(colaboradorId);
    return convenia?.cost_center_id || "";
  };

  const CONVENIA_JSON_FIELDS = new Set([
    "annotations",
    "aso",
    "bank_accounts",
    "cost_center",
    "disability",
    "educations",
    "electoral_card",
    "emergency_contacts",
    "experience_period",
    "foreign_data",
    "intern_data",
    "nationalities",
    "payroll",
    "raw_data",
    "reservist",
  ]);

  const CONVENIA_DATE_FIELDS = new Set([
    "birth_date",
    "ctps_emission_date",
    "driver_license_emission_date",
    "driver_license_validate_date",
    "hiring_date",
    "rg_emission_date",
  ]);

const CONVENIA_DATETIME_FIELDS = new Set(["created_at", "updated_at", "synced_at"]);

const humanizeConveniaKey = (value: string) =>
  value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const parseConveniaJsonValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }
  return value;
};

const formatConveniaLeafValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

type ConveniaFieldEntry = {
  id: string;
  label: string;
  value: string;
};

const buildConveniaEntryId = (fieldKey: string, pathParts: string[]) => {
  const suffix = pathParts.length > 0 ? pathParts.join("__") : "root";
  return `${fieldKey}__${suffix}`.replace(/\s+/g, "_");
};

const buildConveniaJsonEntries = (
  fieldKey: string,
  baseLabel: string,
  value: unknown,
  pathParts: string[] = [],
): ConveniaFieldEntry[] => {
  const labelSuffix = pathParts.length > 0 ? ` - ${pathParts.join(" - ")}` : "";
  const label = `${baseLabel}${labelSuffix}`;
  if (value === null || value === undefined || value === "") {
    return [
      {
        id: buildConveniaEntryId(fieldKey, pathParts),
        label,
        value: "-",
      },
    ];
  }
  if (typeof value !== "object") {
    return [
      {
        id: buildConveniaEntryId(fieldKey, pathParts),
        label,
        value: formatConveniaLeafValue(value),
      },
    ];
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return [
        {
          id: buildConveniaEntryId(fieldKey, pathParts),
          label,
          value: "-",
        },
      ];
    }
    return value.flatMap((item, index) =>
      buildConveniaJsonEntries(fieldKey, baseLabel, item, [
        ...pathParts,
        `Item ${index + 1}`,
      ]),
    );
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) {
    return [
      {
        id: buildConveniaEntryId(fieldKey, pathParts),
        label,
        value: "-",
      },
    ];
  }
  return entries.flatMap(([key, entryValue]) =>
    buildConveniaJsonEntries(fieldKey, baseLabel, entryValue, [
      ...pathParts,
      humanizeConveniaKey(key),
    ]),
  );
};

const buildConveniaFieldEntries = (
  fieldKey: string,
  label: string,
  value: unknown,
): ConveniaFieldEntry[] => {
  if (!CONVENIA_JSON_FIELDS.has(fieldKey)) {
    return [
      {
        id: buildConveniaEntryId(fieldKey, []),
        label,
        value: formatConveniaValue(value, fieldKey),
      },
    ];
  }
  const normalized = parseConveniaJsonValue(value);
  return buildConveniaJsonEntries(fieldKey, label, normalized);
};

const formatConveniaValue = (value: unknown, key?: string) => {
  if (value === null || value === undefined || value === "") return "-";
  if (key && CONVENIA_JSON_FIELDS.has(key)) {
      if (typeof value === "string") return value;
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    if (key && CONVENIA_DATE_FIELDS.has(key) && typeof value === "string") {
      return formatDate(value);
    }
    if (key && CONVENIA_DATETIME_FIELDS.has(key) && typeof value === "string") {
      return formatDateTime(value);
    }
    return String(value);
  };

  const getFaltaColaboradorId = (falta: FaltaData) =>
    falta.tipo === "colaborador" ? falta.colaborador_id : falta.colaborador_convenia_id;

  const getFaltaDocumentoPath = (falta: FaltaData) =>
    falta.tipo === "colaborador" ? falta.documento_url : falta.atestado_path;

  const hasDiariaVinculadaAtiva = (falta: FaltaData) => {
    if (!falta.diaria_temporaria_id) return false;
    const diaria = diariaMap.get(String(falta.diaria_temporaria_id));
    if (!diaria?.status) return false;
    const statusNorm = normalizeStatus(diaria.status);
    return statusNorm !== normalizedCancelada && statusNorm !== normalizedReprovada;
  };

  const matchDiariaVinculoFilter = (falta: FaltaData) => {
    if (diariaVinculoFilter === DIARIA_VINCULO_FILTER_ALL) return true;
    if (falta.tipo !== "convenia") return true;
    const hasDiaria = !!falta.diaria_temporaria_id;
    if (diariaVinculoFilter === DIARIA_VINCULO_FILTER_COM) return hasDiaria;
    if (diariaVinculoFilter === DIARIA_VINCULO_FILTER_SEM) return !hasDiaria;
    return true;
  };

  const getFaltaDataValue = (falta: FaltaData) => {
    const diaria = diariaMap.get(String(falta.diaria_temporaria_id));
    return diaria?.data_diaria || (falta.tipo === "convenia" ? falta.data_falta : null);
  };

  const getFaltaDateKey = (falta: FaltaData) => {
    const dataFalta = getFaltaDataValue(falta);
    if (dataFalta) {
      const dateKey = new Date(`${dataFalta}T00:00:00`).getTime();
      if (!Number.isNaN(dateKey)) return dateKey;
    }
    const createdKey = falta.created_at ? new Date(falta.created_at).getTime() : 0;
    return Number.isNaN(createdKey) ? 0 : createdKey;
  };

  const getFaltaDataLabel = (falta: FaltaData) => {
    const dataFalta = getFaltaDataValue(falta);
    return dataFalta ? formatDate(dataFalta) : "-";
  };

  const getFaltaClienteNome = (falta: FaltaData) => {
    const diaria = diariaMap.get(String(falta.diaria_temporaria_id));
    const colaborador =
      falta.tipo === "colaborador" ? colaboradoresMap.get(falta.colaborador_id) : null;
    const postoInfo =
      diaria?.posto_servico_id ? postoMap.get(diaria.posto_servico_id) : colaborador?.posto || null;
    return falta.colaborador_convenia_id
      ? getConveniaCostCenterName(falta.colaborador_convenia_id)
      : (typeof diaria?.cliente_id === "number" && clienteMap.get(diaria.cliente_id)) ||
          getClienteInfoFromPosto(postoInfo)?.nome ||
          "-";
  };

  const faltasParaCards = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const startDate = dateRangeFilter.startDate
      ? new Date(`${dateRangeFilter.startDate}T00:00:00`)
      : null;
    const endDate = dateRangeFilter.endDate
      ? new Date(`${dateRangeFilter.endDate}T23:59:59.999`)
      : null;
      const hasInvalidRange =
        (startDate && Number.isNaN(startDate.getTime())) ||
        (endDate && Number.isNaN(endDate.getTime())) ||
        (startDate && endDate && startDate > endDate);
      return faltasAtivas.filter((falta) => {
        if (!matchDiariaVinculoFilter(falta)) return false;
        if (clienteFilter !== CLIENTE_FILTER_ALL) {
          const centroCustoId = falta.colaborador_convenia_id
            ? getConveniaCostCenterId(falta.colaborador_convenia_id)
            : String(diariaMap.get(String(falta.diaria_temporaria_id))?.centro_custo_id ?? "");
          if (!centroCustoId || String(centroCustoId) !== clienteFilter) return false;
      }

      if (startDate || endDate) {
        if (hasInvalidRange) return false;
        const diaria = diariaMap.get(String(falta.diaria_temporaria_id));
        const dataFalta =
          diaria?.data_diaria || (falta.tipo === "convenia" ? falta.data_falta : null);
        if (!dataFalta) return false;
        const faltaDate = new Date(`${dataFalta}T00:00:00`);
        if (Number.isNaN(faltaDate.getTime())) return false;
        if (startDate && faltaDate < startDate) return false;
        if (endDate && faltaDate > endDate) return false;
      }

      if (colaboradorFilter !== COLABORADOR_FILTER_ALL) {
        const colaboradorId = getFaltaColaboradorId(falta);
        if (!colaboradorId || colaboradorId !== colaboradorFilter) return false;
      }

      if (!term) return true;
      const colaboradorNome = getFaltaColaboradorNome(falta).toLowerCase();
      const referenciaId = String(falta.diaria_temporaria_id ?? falta.id);
      return colaboradorNome.includes(term) || referenciaId.includes(term);
    });
  }, [
      faltasAtivas,
      searchTerm,
      diariaVinculoFilter,
      clienteFilter,
      colaboradorFilter,
      dateRangeFilter,
      diariaMap,
      colaboradoresMap,
    colaboradoresConveniaMap,
  ]);

  const pendingCount = useMemo(
    () => faltasParaCards.filter((falta) => !falta.justificada_em).length,
    [faltasParaCards],
  );
  const justifiedCount = useMemo(
    () => faltasParaCards.filter((falta) => !!falta.justificada_em).length,
    [faltasParaCards],
  );

  const advancedColaboradorOptions = useMemo(() => {
    const startDate = advancedDateRange.startDate
      ? new Date(`${advancedDateRange.startDate}T00:00:00`)
      : null;
    const endDate = advancedDateRange.endDate
      ? new Date(`${advancedDateRange.endDate}T23:59:59.999`)
      : null;
    const hasRange =
      startDate &&
      endDate &&
      !Number.isNaN(startDate.getTime()) &&
      !Number.isNaN(endDate.getTime()) &&
      startDate <= endDate;

    const idsInRange = new Set<string>();
    if (hasRange) {
      faltasConvenia.forEach((falta) => {
        if (!falta.data_falta) return;
        const faltaDate = new Date(`${falta.data_falta}T00:00:00`);
        if (Number.isNaN(faltaDate.getTime())) return;
        if (faltaDate < startDate || faltaDate > endDate) return;
        if (falta.colaborador_convenia_id) {
          idsInRange.add(falta.colaborador_convenia_id);
        }
      });
    }

    return colaboradoresConvenia
      .map((colaborador) => ({
        id: colaborador.id,
        label: getConveniaColaboradorNome(colaborador),
      }))
      .filter((item) => item.id)
      .filter((item) => (!hasRange ? true : idsInRange.has(item.id)))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [advancedDateRange, colaboradoresConvenia, faltasConvenia]);

  useEffect(() => {
    const validIds = new Set(advancedColaboradorOptions.map((item) => item.id));
    const normalize = (prev: { colaboradorId: string }) =>
      prev.colaboradorId && !validIds.has(prev.colaboradorId)
        ? { ...prev, colaboradorId: "" }
        : prev;

    setAdvancedTotalRange((prev) => normalize(prev));
    setAdvancedInjustificadaRange((prev) => normalize(prev));
    setAdvancedJustificadaRange((prev) => normalize(prev));
  }, [advancedColaboradorOptions]);

  const getFaltasConveniaByRange = (
    range: { colaboradorId: string; startDate: string; endDate: string },
    motivoFiltro?: string,
  ) => {
    if (!range.colaboradorId || !range.startDate || !range.endDate) return null;
    const start = new Date(range.startDate);
    const end = new Date(range.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    end.setHours(23, 59, 59, 999);
    if (start > end) return [];
    const motivoUpper = motivoFiltro?.toUpperCase() || null;

    return faltasConvenia.filter((falta) => {
      if (falta.colaborador_convenia_id !== range.colaboradorId) return false;
      if (!falta.data_falta) return false;
      const faltaDate = new Date(`${falta.data_falta}T00:00:00`);
      if (Number.isNaN(faltaDate.getTime())) return false;
      if (faltaDate < start || faltaDate > end) return false;
      if (motivoUpper) {
        const motivoAtual = (falta.motivo || "").toUpperCase();
        if (motivoAtual !== motivoUpper) return false;
      }
      return true;
    });
  };

  const computeFaltasCount = (
    range: { colaboradorId: string; startDate: string; endDate: string },
    motivoFiltro?: string,
  ) => {
    const faltas = getFaltasConveniaByRange(range, motivoFiltro);
    if (faltas === null) return null;
    return faltas.length;
  };

  const advancedTotalCount = useMemo(
    () =>
      computeFaltasCount({
        colaboradorId: advancedTotalRange.colaboradorId,
        ...advancedDateRange,
      }),
    [faltasConvenia, advancedTotalRange.colaboradorId, advancedDateRange],
  );
  const advancedInjustificadaCount = useMemo(
    () =>
      computeFaltasCount(
        {
          colaboradorId: advancedInjustificadaRange.colaboradorId,
          ...advancedDateRange,
        },
        MOTIVO_FALTA_INJUSTIFICADA,
      ),
    [
      faltasConvenia,
      advancedInjustificadaRange.colaboradorId,
      advancedDateRange,
    ],
  );
  const advancedJustificadaCount = useMemo(
    () =>
      computeFaltasCount(
        {
          colaboradorId: advancedJustificadaRange.colaboradorId,
          ...advancedDateRange,
        },
        MOTIVO_FALTA_JUSTIFICADA,
      ),
    [faltasConvenia, advancedJustificadaRange.colaboradorId, advancedDateRange],
  );

  const colaboradorFilterOptions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const startDate = dateRangeFilter.startDate
      ? new Date(`${dateRangeFilter.startDate}T00:00:00`)
      : null;
    const endDate = dateRangeFilter.endDate
      ? new Date(`${dateRangeFilter.endDate}T23:59:59.999`)
      : null;
    const hasInvalidRange =
      (startDate && Number.isNaN(startDate.getTime())) ||
      (endDate && Number.isNaN(endDate.getTime())) ||
      (startDate && endDate && startDate > endDate);
    if (hasInvalidRange) return [];

    const map = new Map<string, string>();
    faltasAtivas.forEach((falta) => {
      if (statusFilter === "pendente" && falta.justificada_em) return;
      if (statusFilter === "justificada" && !falta.justificada_em) return;
      if (!matchDiariaVinculoFilter(falta)) return;

      if (clienteFilter !== CLIENTE_FILTER_ALL) {
        const centroCustoId = falta.colaborador_convenia_id
          ? getConveniaCostCenterId(falta.colaborador_convenia_id)
          : String(diariaMap.get(String(falta.diaria_temporaria_id))?.centro_custo_id ?? "");
        if (!centroCustoId || String(centroCustoId) !== clienteFilter) return;
      }

      if (startDate || endDate) {
        const diaria = diariaMap.get(String(falta.diaria_temporaria_id));
        const dataFalta =
          diaria?.data_diaria || (falta.tipo === "convenia" ? falta.data_falta : null);
        if (!dataFalta) return;
        const faltaDate = new Date(`${dataFalta}T00:00:00`);
        if (Number.isNaN(faltaDate.getTime())) return;
        if (startDate && faltaDate < startDate) return;
        if (endDate && faltaDate > endDate) return;
      }

      if (term) {
        const colaboradorNome = getFaltaColaboradorNome(falta).toLowerCase();
        const referenciaId = String(falta.diaria_temporaria_id ?? falta.id);
        if (!colaboradorNome.includes(term) && !referenciaId.includes(term)) return;
      }

      const colaboradorId = getFaltaColaboradorId(falta);
      if (!colaboradorId) return;
      map.set(colaboradorId, getFaltaColaboradorNome(falta));
    });

    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [
      faltasAtivas,
      statusFilter,
      diariaVinculoFilter,
      clienteFilter,
      dateRangeFilter,
      searchTerm,
      diariaMap,
    colaboradoresMap,
    colaboradoresConveniaMap,
  ]);

  const filteredFaltas = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const startDate = dateRangeFilter.startDate
      ? new Date(`${dateRangeFilter.startDate}T00:00:00`)
      : null;
    const endDate = dateRangeFilter.endDate
      ? new Date(`${dateRangeFilter.endDate}T23:59:59.999`)
      : null;
      const hasInvalidRange =
        (startDate && Number.isNaN(startDate.getTime())) ||
        (endDate && Number.isNaN(endDate.getTime())) ||
        (startDate && endDate && startDate > endDate);
      return faltasAtivas.filter((falta) => {
        if (statusFilter === "pendente" && falta.justificada_em) return false;
        if (statusFilter === "justificada" && !falta.justificada_em) return false;
        if (!matchDiariaVinculoFilter(falta)) return false;

        if (clienteFilter !== CLIENTE_FILTER_ALL) {
          const centroCustoId = falta.colaborador_convenia_id
            ? getConveniaCostCenterId(falta.colaborador_convenia_id)
            : String(diariaMap.get(String(falta.diaria_temporaria_id))?.centro_custo_id ?? "");
        if (!centroCustoId || String(centroCustoId) !== clienteFilter) return false;
      }

      if (startDate || endDate) {
        if (hasInvalidRange) return false;
        const diaria = diariaMap.get(String(falta.diaria_temporaria_id));
        const dataFalta =
          diaria?.data_diaria || (falta.tipo === "convenia" ? falta.data_falta : null);
        if (!dataFalta) return false;
        const faltaDate = new Date(`${dataFalta}T00:00:00`);
        if (Number.isNaN(faltaDate.getTime())) return false;
        if (startDate && faltaDate < startDate) return false;
        if (endDate && faltaDate > endDate) return false;
      }

      if (colaboradorFilter !== COLABORADOR_FILTER_ALL) {
        const colaboradorId = getFaltaColaboradorId(falta);
        if (!colaboradorId || colaboradorId !== colaboradorFilter) return false;
      }

      if (!term) return true;
      const colaboradorNome = getFaltaColaboradorNome(falta).toLowerCase();
      const referenciaId = String(falta.diaria_temporaria_id ?? falta.id);
      return colaboradorNome.includes(term) || referenciaId.includes(term);
    });
  }, [
      faltasAtivas,
      searchTerm,
      statusFilter,
      diariaVinculoFilter,
      clienteFilter,
      colaboradorFilter,
      dateRangeFilter,
      diariaMap,
    colaboradoresMap,
    colaboradoresConveniaMap,
  ]);

  const faltasOrdenadas = useMemo(() => {
    if (!ordenarListaAlfabetica && !ordenarListaPorDataDesc) return filteredFaltas;
    const ordenadas = [...filteredFaltas];
    if (ordenarListaPorDataDesc) {
      ordenadas.sort((a, b) => {
        const keyA = getFaltaDateKey(a);
        const keyB = getFaltaDateKey(b);
        if (keyA === keyB) return 0;
        return keyA < keyB ? 1 : -1;
      });
      return ordenadas;
    }
    if (ordenarListaAlfabetica) {
      ordenadas.sort((a, b) =>
        getFaltaColaboradorNome(a).localeCompare(getFaltaColaboradorNome(b)),
      );
    }
    return ordenadas;
  }, [
    filteredFaltas,
    ordenarListaAlfabetica,
    ordenarListaPorDataDesc,
    colaboradoresMap,
    colaboradoresConveniaMap,
    costCenterMap,
    clienteMap,
    diariaMap,
    postoMap,
  ]);

  const faltasAgrupadas = useMemo(() => {
    const groups = new Map<string, Omit<FaltaGroup, "clienteLabel">>();
    filteredFaltas.forEach((falta) => {
      const colaboradorId = getFaltaColaboradorId(falta);
      if (!colaboradorId) return;
      const key = String(colaboradorId);
      const colaboradorNome = getFaltaColaboradorNome(falta);
      const clienteNome = getFaltaClienteNome(falta);
      const dataKey = getFaltaDateKey(falta);
      const dataLabel = getFaltaDataLabel(falta);
      const group =
        groups.get(key) || ({
          key,
          colaboradorId: key,
          colaboradorNome,
          ids: [],
          clientes: new Set<string>(),
          count: 0,
          pendentes: 0,
          justificadas: 0,
          lastDateKey: 0,
          lastDateLabel: "-",
        } as Omit<FaltaGroup, "clienteLabel">);
      group.ids.push(falta.id);
      group.count += 1;
      if (falta.justificada_em) {
        group.justificadas += 1;
      } else {
        group.pendentes += 1;
      }
      group.clientes.add(clienteNome);
      if (dataKey >= group.lastDateKey) {
        group.lastDateKey = dataKey;
        group.lastDateLabel = dataLabel;
      }
      groups.set(key, group);
    });

    const agrupadas = Array.from(groups.values()).map((group) => {
      let clienteLabel = "-";
      if (group.clientes.size > 1) {
        clienteLabel = "Diversos";
      } else {
        clienteLabel = Array.from(group.clientes)[0] || "-";
      }
      return { ...group, clienteLabel } as FaltaGroup;
    });

    if (ordenarAgrupadasPorDataDesc) {
      agrupadas.sort((a, b) => b.lastDateKey - a.lastDateKey);
      return agrupadas;
    }
    if (ordenarAgrupadasAlfabetica) {
      agrupadas.sort((a, b) => a.colaboradorNome.localeCompare(b.colaboradorNome));
    }
    return agrupadas;
  }, [
    filteredFaltas,
    ordenarAgrupadasAlfabetica,
    ordenarAgrupadasPorDataDesc,
    colaboradoresMap,
    colaboradoresConveniaMap,
    costCenterMap,
    clienteMap,
    diariaMap,
    postoMap,
  ]);

  const selectedGroup = useMemo(() => {
    if (!selectedGroupKey) return null;
    return faltasAgrupadas.find((group) => group.key === selectedGroupKey) || null;
  }, [faltasAgrupadas, selectedGroupKey]);

  const selectedGroupFaltas = useMemo(() => {
    if (!selectedGroup) return [];
    return filteredFaltas
      .filter((falta) => getFaltaColaboradorId(falta) === selectedGroup.colaboradorId)
      .sort((a, b) => getFaltaDateKey(b) - getFaltaDateKey(a));
  }, [filteredFaltas, selectedGroup]);

  const totalPages = Math.max(1, Math.ceil(faltasOrdenadas.length / FALTAS_PAGE_SIZE));
  const paginatedFaltas = useMemo(() => {
    const start = (currentPage - 1) * FALTAS_PAGE_SIZE;
    return faltasOrdenadas.slice(start, start + FALTAS_PAGE_SIZE);
  }, [faltasOrdenadas, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    statusFilter,
    clienteFilter,
    colaboradorFilter,
    dateRangeFilter,
    faltaType,
    ordenarListaAlfabetica,
    ordenarListaPorDataDesc,
    faltasView,
  ]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleClearFilters = () => {
    setSearchTerm("");
    setStatusFilter("pendente");
    setClienteFilter(CLIENTE_FILTER_ALL);
    setColaboradorFilter(COLABORADOR_FILTER_ALL);
    setDiariaVinculoFilter(DIARIA_VINCULO_FILTER_ALL);
    setDateRangeFilter({ startDate: "", endDate: "" });
    setCurrentPage(1);
  };

  const buildFaltasConveniaExportRows = (faltas: FaltaConveniaRow[]) =>
    faltas.map((falta) => {
      const colaborador = colaboradoresConveniaMap.get(falta.colaborador_convenia_id);
      const colaboradorNome =
        getConveniaColaboradorNome(colaborador) || falta.colaborador_convenia_id;
      const justificadaPorNome = falta.justificada_por
        ? usuarioMap.get(falta.justificada_por) || falta.justificada_por
        : "-";

      const row: Record<string, string> = {
        COLABORADOR: colaboradorNome,
        "COLABORADOR ID": falta.colaborador_convenia_id,
        "DATA DA FALTA": falta.data_falta,
        MOTIVO: falta.motivo,
        "JUSTIFICADA POR": justificadaPorNome,
      };

      CONVENIA_EXPORT_FIELDS.forEach((field) => {
        const header = field.label.toUpperCase();
        if (row[header] !== undefined) return;
        if (field.key === "cost_center_name") {
          row[header] = getConveniaCostCenterName(falta.colaborador_convenia_id);
          return;
        }
        const value = colaborador ? (colaborador as any)[field.key] : null;
        row[header] = formatConveniaValue(value, field.key);
      });

      return row;
    });

  const exportFaltasConveniaXlsx = (faltas: FaltaConveniaRow[], filePrefix: string) => {
    if (!faltas.length) {
      toast.info("Nenhuma falta para exportar.");
      return;
    }
    const sheet = XLSX.utils.json_to_sheet(buildFaltasConveniaExportRows(faltas), {
      header: FALTAS_CONVENIA_EXPORT_COLUMNS,
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Faltas");
    XLSX.writeFile(wb, `${filePrefix}-${Date.now()}.xlsx`);
    toast.success("Arquivo XLSX gerado.");
  };

  const handleExportFilteredFaltas = () => {
    const faltasParaExportar = filteredFaltas.filter(
      (falta): falta is FaltaConveniaRow => falta.tipo === "convenia",
    );
    exportFaltasConveniaXlsx(faltasParaExportar, "faltas-convenia");
  };

  const handleExportAdvancedRange = (
    range: { colaboradorId: string; startDate: string; endDate: string },
    motivoFiltro: string | undefined,
    fileSuffix: string,
  ) => {
    const faltas = getFaltasConveniaByRange(range, motivoFiltro);
    if (faltas === null) {
      toast.error("Preencha periodo e colaborador para exportar.");
      return;
    }
    exportFaltasConveniaXlsx(faltas, `faltas-convenia-${fileSuffix}`);
  };

  const handleViewDocumento = async (path: string) => {
    try {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 120);
      if (error || !data?.signedUrl) {
        throw error || new Error("Link temporario indisponivel.");
      }
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      toast.error(error?.message || "Nao foi possivel abrir o documento.");
    }
  };

  const parseOptionalDiariaId = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return undefined;
    return parsed;
  };

  const resetFaltaForm = (falta?: FaltaConveniaRow | null) => {
    const parsedDate =
      falta?.data_falta && !Number.isNaN(new Date(`${falta.data_falta}T00:00:00`).getTime())
        ? new Date(`${falta.data_falta}T00:00:00`)
        : null;
    setFaltaForm({
      colaboradorId: falta?.colaborador_convenia_id ?? "",
      dataFalta: falta?.data_falta ?? "",
      diariaId: falta?.diaria_temporaria_id ? String(falta.diaria_temporaria_id) : "",
    });
    setFaltaFormDates(parsedDate ? [parsedDate] : []);
  };

  const handleFaltaFormOpenChange = (open: boolean) => {
    setFaltaFormOpen(open);
    if (!open) {
      setFaltaFormSaving(false);
      setFaltaFormTarget(null);
      setFaltaFormMode("create");
      resetFaltaForm(null);
    }
  };

  const openCreateFaltaForm = () => {
    if (accessLoading) return;
    if (!canCreateFaltaConvenia()) {
      toast.error("Sem permissao para cadastrar faltas.");
      return;
    }
    setFaltaFormMode("create");
    setFaltaFormTarget(null);
    resetFaltaForm(null);
    setFaltaFormOpen(true);
  };

  const openEditFaltaForm = (falta: FaltaConveniaRow) => {
    if (accessLoading) return;
    if (!canUpdateFaltaConvenia()) {
      toast.error("Sem permissao para editar faltas.");
      return;
    }
    if (falta.justificada_em) {
      toast.error("Reverta a justificativa antes de editar a falta.");
      return;
    }
    setFaltaFormMode("edit");
    setFaltaFormTarget(falta);
    resetFaltaForm(falta);
    setFaltaFormOpen(true);
  };

  const handleSubmitFaltaForm = async () => {
    if (accessLoading) return;
    if (!faltaForm.colaboradorId) {
      toast.error("Selecione o colaborador.");
      return;
    }
    const parsedDiariaId = parseOptionalDiariaId(faltaForm.diariaId);
    if (parsedDiariaId === undefined) {
      toast.error("ID da diaria invalido.");
      return;
    }
    const isCreateMode = faltaFormMode === "create";
    const selectedDates =
      isCreateMode
        ? faltaFormDates
        : faltaForm.dataFalta
          ? [new Date(`${faltaForm.dataFalta}T00:00:00`)]
          : [];
    if (selectedDates.length === 0) {
      toast.error(isCreateMode ? "Selecione as datas da falta." : "Informe a data da falta.");
      return;
    }
    if (isCreateMode && selectedDates.length > 1 && parsedDiariaId) {
      toast.error("Para multiplas datas, deixe o ID da diaria em branco.");
      return;
    }
    const dateValues = Array.from(
      new Set(
        selectedDates
          .filter((date) => !Number.isNaN(date.getTime()))
          .map((date) => format(date, "yyyy-MM-dd")),
      ),
    );
    if (dateValues.length === 0) {
      toast.error(isCreateMode ? "Selecione as datas da falta." : "Informe a data da falta.");
      return;
    }

    try {
      setFaltaFormSaving(true);
      if (faltaFormMode === "create") {
        const payload = dateValues.map((dateValue) => ({
          colaborador_convenia_id: faltaForm.colaboradorId,
          data_falta: dateValue,
          diaria_temporaria_id: parsedDiariaId,
          motivo: MOTIVO_FALTA_INJUSTIFICADA,
        }));
        const { error } = await supabase
          .from("faltas_colaboradores_convenia")
          .insert(payload);
        if (error) throw error;
        toast.success("Falta cadastrada com sucesso.");
      } else {
        if (!faltaFormTarget) {
          throw new Error("Falta nao selecionada.");
        }
        const [dateValue] = dateValues;
        const { error } = await supabase
          .from("faltas_colaboradores_convenia")
          .update({
            colaborador_convenia_id: faltaForm.colaboradorId,
            data_falta: dateValue,
            diaria_temporaria_id: parsedDiariaId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", faltaFormTarget.id);
        if (error) throw error;
        toast.success("Falta atualizada com sucesso.");
      }

      await Promise.all([refetchFaltasConvenia(), refetchDiarias()]);
      handleFaltaFormOpenChange(false);
    } catch (error: any) {
      toast.error(error?.message || "Nao foi possivel salvar a falta.");
    } finally {
      setFaltaFormSaving(false);
    }
  };

  const handleDeleteFaltaConvenia = async (falta: FaltaConveniaRow) => {
    if (accessLoading) return;
    if (!canDeleteFaltaConvenia()) {
      toast.error("Sem permissao para excluir faltas.");
      return;
    }
    const confirmed = window.confirm(
      "Deseja excluir esta falta? Esta acao nao podera ser desfeita."
    );
    if (!confirmed) return;

    try {
      const documentoPath = falta.atestado_path;
      const { error } = await supabase
        .from("faltas_colaboradores_convenia")
        .delete()
        .eq("id", falta.id);
      if (error) throw error;

      if (documentoPath) {
        const { error: storageError } = await supabase.storage
          .from(BUCKET)
          .remove([documentoPath]);
        if (storageError) {
          toast.error(
            "Falta removida, mas nao foi possivel excluir o atestado."
          );
        }
      }

      if (detailsFalta?.id === falta.id) {
        setDetailsDialogOpen(false);
        setDetailsFalta(null);
      }
      if (selectedFalta?.id === falta.id) {
        setSelectedFalta(null);
      }

      await Promise.all([refetchFaltasConvenia(), refetchDiarias()]);
      toast.success("Falta excluida com sucesso.");
    } catch (error: any) {
      toast.error(error?.message || "Nao foi possivel excluir a falta.");
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setSelectedFalta(null);
  };

  const openJustificarDialog = (falta: FaltaData) => {
    if (accessLoading) return;
    if (!canJustifyFalta(falta)) {
      toast.error("Sem permissao para justificar faltas.");
      return;
    }
    setSelectedFalta(falta);
    setDialogOpen(true);
  };

  const handleReverterJustificativa = async (falta: FaltaData) => {
    if (accessLoading) return;
    if (falta.tipo !== "convenia") {
      toast.error("Reversao disponivel apenas para faltas convenia.");
      return;
    }
    if (!falta.justificada_em) {
      toast.error("Falta nao esta justificada.");
      return;
    }
    if (!canRevertFalta(falta)) {
      toast.error("Sem permissao para reverter justificativas.");
      return;
    }
    const documentoPath = getFaltaDocumentoPath(falta);
    if (!documentoPath) {
      toast.error("Atestado nao encontrado.");
      return;
    }
    const confirmed = window.confirm(
      "Deseja reverter a justificativa desta falta? O atestado sera removido."
    );
    if (!confirmed) return;

    try {
      setRevertingId(falta.id);
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) {
        throw authError || new Error("Usuario nao autenticado.");
      }

      const { data: revertedPath, error: rpcError } = await supabase.rpc(
        "reverter_justificativa_falta_convenia",
        {
          p_falta_id: falta.id,
          p_user_id: authData.user.id,
          p_bucket_id: BUCKET,
        }
      );
      if (rpcError) throw rpcError;

        const pathToRemove = revertedPath || documentoPath;
        if (pathToRemove) {
          const { error: storageError } = await supabase.storage
            .from(BUCKET)
            .remove([pathToRemove]);
          if (storageError) {
            toast.error(
              "Justificativa revertida, mas nao foi possivel remover o atestado."
            );
          } else {
            toast.success("Justificativa revertida com sucesso.");
          }
        } else {
          toast.success("Justificativa revertida com sucesso.");
        }

        const updateErrors: string[] = [];
        const { error: faltaUpdateError } = await supabase
          .from("faltas_colaboradores_convenia")
          .update({ motivo: MOTIVO_FALTA_INJUSTIFICADA })
          .eq("id", falta.id);
        if (faltaUpdateError) updateErrors.push("falta");

        if (falta.diaria_temporaria_id) {
          const { error: diariaUpdateError } = await supabase
            .from("diarias_temporarias")
            .update({ motivo_vago: MOTIVO_DIARIA_FALTA })
            .eq("id", falta.diaria_temporaria_id);
          if (diariaUpdateError) updateErrors.push("diaria");
        }
        if (updateErrors.length > 0) {
          toast.error(
            "Justificativa revertida, mas nao foi possivel atualizar o motivo da falta/diaria."
          );
        }

        await Promise.all([refetchFaltasConvenia(), refetchDiarias()]);

      const applyLocalUpdate = (prev: FaltaData | null) => {
        if (!prev || prev.id !== falta.id) return prev;
          if (prev.tipo === "convenia") {
            return {
              ...prev,
              motivo: MOTIVO_FALTA_INJUSTIFICADA,
              justificada_em: null,
              justificada_por: null,
              atestado_path: null,
            };
          }
          return {
            ...prev,
            motivo: MOTIVO_FALTA_INJUSTIFICADA,
            justificada_em: null,
            justificada_por: null,
            documento_url: null,
          };
        };
      setSelectedFalta(applyLocalUpdate);
      setDetailsFalta(applyLocalUpdate);
    } catch (error: any) {
      toast.error(error?.message || "Nao foi possivel reverter a justificativa.");
    } finally {
      setRevertingId(null);
    }
  };

  const handleDetailsDialogOpenChange = (open: boolean) => {
    setDetailsDialogOpen(open);
    if (!open) setDetailsFalta(null);
  };

  const openDetailsDialog = (falta: FaltaData) => {
    setDetailsFalta(falta);
    setDetailsDialogOpen(true);
  };

  const openGroupDetailsDialog = (groupKey: string) => {
    setSelectedGroupKey(groupKey);
    setGroupDetailsDialogOpen(true);
  };

  const closeGroupDetailsDialog = () => {
    setGroupDetailsDialogOpen(false);
    setSelectedGroupKey(null);
  };

  const handleOpenGroupFaltaDetails = (falta: FaltaData) => {
    closeGroupDetailsDialog();
    openDetailsDialog(falta);
  };

  const selectedColaboradorId = selectedFalta ? getFaltaColaboradorId(selectedFalta) : null;
  const selectedColaboradorNome = selectedFalta ? getFaltaColaboradorNome(selectedFalta) : null;
  const selectedRpcName =
    selectedFalta?.tipo === "convenia"
      ? selectedFalta.diaria_temporaria_id
        ? "justificar_falta_convenia"
        : "justificar_falta_convenia_por_falta_id"
      : "justificar_falta_diaria_temporaria";
  const selectedFaltaDataLabel = selectedFalta
    ? formatDate(
        selectedFalta.tipo === "convenia"
          ? diariaMap.get(String(selectedFalta.diaria_temporaria_id))?.data_diaria ||
              selectedFalta.data_falta
          : diariaMap.get(String(selectedFalta.diaria_temporaria_id))?.data_diaria,
      )
    : null;

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-muted-foreground uppercase tracking-wide">Diarias</p>
            <h1 className="text-3xl font-bold">Faltas</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie faltas de colaboradores e convenia com envio de documentos.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4 md:grid md:grid-cols-3">
            <Card className="shadow-lg">
              <CardHeader className="pb-2">
                <CardDescription>Total de faltas</CardDescription>
                <CardTitle className="text-2xl">{faltasParaCards.length}</CardTitle>
              </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Registradas via diarias temporarias ou manualmente.
            </CardContent>
          </Card>
          <Card className="shadow-lg border border-amber-200">
            <CardHeader className="pb-2">
              <CardDescription>Pendentes</CardDescription>
              <CardTitle className="text-2xl">{pendingCount}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Aguardando justificativa.
            </CardContent>
          </Card>
          <Card className="shadow-lg border border-emerald-200">
            <CardHeader className="pb-2">
              <CardDescription>Justificadas</CardDescription>
              <CardTitle className="text-2xl">{justifiedCount}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Com atestado anexado.
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Filtros</CardTitle>
              <CardDescription>Busque faltas por colaborador ou ID da diaria/falta.</CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={handleClearFilters}>
                Limpar filtros
              </Button>
              <Button type="button" variant="outline" onClick={handleExportFilteredFaltas}>
                Exportar XLSX
              </Button>
              <Button type="button" variant="outline" onClick={() => setAdvancedDialogOpen(true)}>
                Filtragem avancada
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 md:grid md:grid-cols-6">
            <div className="space-y-2 md:col-span-2">
              <span className="text-sm text-muted-foreground">Busca</span>
              <Input
                value={searchTerm}
                placeholder="Nome ou ID da diaria"
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <span className="text-sm text-muted-foreground">Tipo</span>
              <Select value={faltaType} onValueChange={(value) => setFaltaType(value as FaltaTipo)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {FALTA_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
              <div className="space-y-2 md:col-span-2">
                <span className="text-sm text-muted-foreground">Status</span>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTERS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <span className="text-sm text-muted-foreground">Diaria vinculada</span>
                <Select value={diariaVinculoFilter} onValueChange={setDiariaVinculoFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DIARIA_VINCULO_FILTER_ALL}>Todas</SelectItem>
                    <SelectItem value={DIARIA_VINCULO_FILTER_COM}>Com diaria</SelectItem>
                    <SelectItem value={DIARIA_VINCULO_FILTER_SEM}>Sem diaria</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <span className="text-sm text-muted-foreground">Colaborador</span>
                <Select value={colaboradorFilter} onValueChange={setColaboradorFilter}>
                  <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={COLABORADOR_FILTER_ALL}>Todos</SelectItem>
                  {colaboradorFilterOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <span className="text-sm text-muted-foreground">Cliente</span>
              <Select value={clienteFilter} onValueChange={setClienteFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CLIENTE_FILTER_ALL}>Todos</SelectItem>
                  {costCenters.map((center) => (
                    <SelectItem key={center.id} value={center.id}>
                      {center.name || center.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <span className="text-sm text-muted-foreground">Data inicial</span>
              <Input
                type="date"
                value={dateRangeFilter.startDate}
                onChange={(event) =>
                  setDateRangeFilter((prev) => ({
                    ...prev,
                    startDate: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <span className="text-sm text-muted-foreground">Data final</span>
              <Input
                type="date"
                value={dateRangeFilter.endDate}
                onChange={(event) =>
                  setDateRangeFilter((prev) => ({
                    ...prev,
                    endDate: event.target.value,
                  }))
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Faltas registradas</CardTitle>
              <CardDescription>Selecione uma falta para justificar com anexo.</CardDescription>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={faltasView === "lista" ? "default" : "outline"}
                  onClick={() => setFaltasView("lista")}
                >
                  Lista completa
                </Button>
                <Button
                  size="sm"
                  variant={faltasView === "agrupadas" ? "default" : "outline"}
                  onClick={() => setFaltasView("agrupadas")}
                >
                  Agrupadas
                </Button>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button type="button" variant="outline" onClick={openCreateFaltaForm}>
                  Nova falta
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingFaltas ? (
              <p className="text-sm text-muted-foreground">Carregando faltas...</p>
            ) : faltasView === "agrupadas" ? (
              faltasAgrupadas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma falta encontrada.</p>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <div className="inline-flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-1 text-xs">
                      <Checkbox
                        id="ordenar-agrupadas-az"
                        checked={ordenarAgrupadasAlfabetica}
                        onCheckedChange={(checked) => {
                          const next = checked === true;
                          setOrdenarAgrupadasAlfabetica(next);
                          if (next) {
                            setOrdenarAgrupadasPorDataDesc(false);
                          }
                        }}
                      />
                      <Label htmlFor="ordenar-agrupadas-az" className="cursor-pointer">
                        Ordenar A-Z
                      </Label>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-1 text-xs">
                      <Checkbox
                        id="ordenar-agrupadas-data"
                        checked={ordenarAgrupadasPorDataDesc}
                        onCheckedChange={(checked) => {
                          const next = checked === true;
                          setOrdenarAgrupadasPorDataDesc(next);
                          if (next) {
                            setOrdenarAgrupadasAlfabetica(false);
                          }
                        }}
                      />
                      <Label htmlFor="ordenar-agrupadas-data" className="cursor-pointer">
                        Mais recentes
                      </Label>
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Colaborador</TableHead>
                        <TableHead className="hidden sm:table-cell">Cliente</TableHead>
                        <TableHead className="hidden md:table-cell">Mais recente</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="hidden sm:table-cell text-right">Pendentes</TableHead>
                        <TableHead className="hidden sm:table-cell text-right">Justificadas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {faltasAgrupadas.map((group) => (
                        <TableRow
                          key={group.key}
                          className="cursor-pointer"
                          onClick={() => openGroupDetailsDialog(group.key)}
                        >
                          <TableCell>{group.colaboradorNome}</TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {group.clienteLabel}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {group.lastDateLabel}
                          </TableCell>
                          <TableCell className="text-right">{group.count}</TableCell>
                          <TableCell className="hidden sm:table-cell text-right">
                            {group.pendentes}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-right">
                            {group.justificadas}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )
            ) : filteredFaltas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma falta encontrada.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <div className="inline-flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-1 text-xs">
                    <Checkbox
                      id="ordenar-lista-az"
                      checked={ordenarListaAlfabetica}
                      onCheckedChange={(checked) => {
                        const next = checked === true;
                        setOrdenarListaAlfabetica(next);
                        if (next) {
                          setOrdenarListaPorDataDesc(false);
                        }
                      }}
                    />
                    <Label htmlFor="ordenar-lista-az" className="cursor-pointer">
                      Ordenar A-Z
                    </Label>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-1 text-xs">
                    <Checkbox
                      id="ordenar-lista-data"
                      checked={ordenarListaPorDataDesc}
                      onCheckedChange={(checked) => {
                        const next = checked === true;
                        setOrdenarListaPorDataDesc(next);
                        if (next) {
                          setOrdenarListaAlfabetica(false);
                        }
                      }}
                    />
                    <Label htmlFor="ordenar-lista-data" className="cursor-pointer">
                      Mais recentes
                    </Label>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Colaborador</TableHead>
                      <TableHead className="hidden sm:table-cell">Cliente</TableHead>
                      <TableHead className="hidden sm:table-cell">Motivo</TableHead>
                      <TableHead className="hidden sm:table-cell">Status</TableHead>
                      <TableHead className="hidden sm:table-cell">Justificada em</TableHead>
                      <TableHead className="hidden sm:table-cell">Documento</TableHead>
                      <TableHead className="text-right">Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedFaltas.map((falta) => {
                      const clienteNome = getFaltaClienteNome(falta);
                      const dataFaltaLabel = getFaltaDataLabel(falta);
                      const statusLabel = falta.justificada_em ? "Justificada" : "Pendente";
                      const statusVariant: "default" | "destructive" =
                        falta.justificada_em ? "default" : "destructive";
                      const justificadaPorNome = falta.justificada_por
                        ? usuarioMap.get(falta.justificada_por) || falta.justificada_por
                        : "-";
                      const colaboradorNome = getFaltaColaboradorNome(falta);
                      const documentoPath = getFaltaDocumentoPath(falta);
                      const isJustificada = !!falta.justificada_em;
                      const canJustify = canJustifyFalta(falta);
                      const canRevert = isJustificada && canRevertFalta(falta);
                      const isReverting = revertingId === falta.id;
                      const actionLabel = isJustificada
                        ? canRevert
                          ? "Reverter"
                          : "Justificada"
                        : "Justificar";
                      const actionDisabled = accessLoading || isReverting || (
                        isJustificada ? !canRevert : !canJustify
                      );
                      return (
                        <TableRow
                          key={falta.id}
                          className="cursor-pointer"
                          onClick={() => openDetailsDialog(falta)}
                        >
                          <TableCell>
                            <div className="flex flex-col">
                              <span>{dataFaltaLabel}</span>
                                {hasDiariaVinculadaAtiva(falta) && (
                                  <span className="text-xs font-semibold text-red-600">
                                    Diária vinculada
                                  </span>
                                )}
                            </div>
                          </TableCell>
                          <TableCell>{colaboradorNome}</TableCell>
                          <TableCell className="hidden sm:table-cell">{clienteNome}</TableCell>
                          <TableCell className="hidden sm:table-cell">{falta.motivo || "-"}</TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <Badge variant={statusVariant}>{statusLabel}</Badge>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {falta.justificada_em ? (
                              <div className="text-xs">
                                <div>{formatDateTime(falta.justificada_em)}</div>
                                <div className="text-muted-foreground">{justificadaPorNome}</div>
                              </div>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {documentoPath ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleViewDocumento(documentoPath as string);
                                }}
                              >
                                Ver
                              </Button>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              size="sm"
                              disabled={actionDisabled}
                              onClick={(event) => {
                                event.stopPropagation();
                                if (isJustificada) {
                                  if (canRevert) {
                                    handleReverterJustificativa(falta);
                                  }
                                  return;
                                }
                                openJustificarDialog(falta);
                              }}
                            >
                              {isReverting ? "Revertendo..." : actionLabel}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <div className="flex flex-col items-start justify-between gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center">
                  <span>
                    Pagina {currentPage} de {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    >
                      Anterior
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    >
                      Proxima
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={groupDetailsDialogOpen}
        onOpenChange={(open) => (open ? null : closeGroupDetailsDialog())}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Detalhes do agrupamento</DialogTitle>
            <DialogDescription>
              Informacoes completas das faltas deste colaborador.
            </DialogDescription>
          </DialogHeader>
          {selectedGroup ? (
            <div className="space-y-4 text-sm">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Colaborador</p>
                  <p className="font-medium">{selectedGroup.colaboradorNome}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cliente</p>
                  <p className="font-medium">{selectedGroup.clienteLabel}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Mais recente</p>
                  <p className="font-medium">{selectedGroup.lastDateLabel}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Quantidade</p>
                  <p className="font-medium">{selectedGroup.count}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pendentes</p>
                  <p className="font-medium">{selectedGroup.pendentes}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Justificadas</p>
                  <p className="font-medium">{selectedGroup.justificadas}</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                {selectedGroupFaltas.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">
                    Nenhuma falta encontrada para este grupo.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead className="hidden sm:table-cell">Motivo</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="hidden md:table-cell">
                          Justificada em
                        </TableHead>
                        <TableHead className="text-right">Acoes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedGroupFaltas.map((falta) => {
                        const statusLabel = falta.justificada_em ? "Justificada" : "Pendente";
                        const statusVariant: "default" | "destructive" =
                          falta.justificada_em ? "default" : "destructive";
                        const justificadaPorNome = falta.justificada_por
                          ? usuarioMap.get(falta.justificada_por) || falta.justificada_por
                          : "-";
                        return (
                          <TableRow key={falta.id}>
                            <TableCell>{getFaltaDataLabel(falta)}</TableCell>
                            <TableCell className="hidden sm:table-cell">
                              {falta.motivo || "-"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusVariant}>{statusLabel}</Badge>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              {falta.justificada_em ? (
                                <div className="text-xs">
                                  <div>{formatDateTime(falta.justificada_em)}</div>
                                  <div className="text-muted-foreground">
                                    {justificadaPorNome}
                                  </div>
                                </div>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenGroupFaltaDetails(falta)}
                              >
                                Detalhes
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Grupo nao encontrado.</p>
          )}
          <DialogFooter>
            <Button type="button" onClick={closeGroupDetailsDialog}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={faltaFormOpen} onOpenChange={handleFaltaFormOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {faltaFormMode === "create" ? "Nova falta" : "Editar falta"}
            </DialogTitle>
            <DialogDescription>
              {faltaFormMode === "create"
                ? "Registre faltas manualmente quando nao houver diaria vinculada."
                : "Atualize os dados da falta selecionada."}
            </DialogDescription>
          </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <span className="text-sm text-muted-foreground">Colaborador</span>
                <Select
                  value={faltaForm.colaboradorId}
                onValueChange={(value) =>
                  setFaltaForm((prev) => ({ ...prev, colaboradorId: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o colaborador" />
                </SelectTrigger>
                <SelectContent>
                  {colaboradorConveniaOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <span className="text-sm text-muted-foreground">
                  {faltaFormMode === "create" ? "Datas da falta" : "Data da falta"}
                </span>
                {faltaFormMode === "create" ? (
                  <div className="rounded-md border bg-muted/20">
                    <Calendar
                      mode="multiple"
                      selected={faltaFormDates}
                      onSelect={(dates) => setFaltaFormDates(dates ?? [])}
                    />
                  </div>
                ) : (
                  <Input
                    type="date"
                    value={faltaForm.dataFalta}
                    onChange={(event) =>
                      setFaltaForm((prev) => ({
                        ...prev,
                        dataFalta: event.target.value,
                      }))
                    }
                  />
                )}
                {faltaFormMode === "create" && (
                  <div className="text-xs text-muted-foreground">
                    {faltaFormDates.length === 0
                      ? "Selecione uma ou mais datas no calendario."
                      : `Selecionadas: ${faltaFormDates
                          .map((date) => format(date, "dd/MM/yyyy"))
                          .join(", ")}`}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <span className="text-sm text-muted-foreground">
                  ID da diaria temporaria (opcional)
                </span>
                <Input
                  value={faltaForm.diariaId}
                  onChange={(event) =>
                    setFaltaForm((prev) => ({
                      ...prev,
                      diariaId: event.target.value,
                    }))
                  }
                  placeholder="Ex.: 12345"
                />
                <p className="text-xs text-muted-foreground">
                  Se a falta estiver vinculada a uma diaria, informe o ID. Caso
                  contrario, deixe em branco.
                </p>
                {faltaFormMode === "create" && faltaFormDates.length > 1 && (
                  <p className="text-xs text-amber-700">
                    Para multiplas datas, deixe o ID da diaria em branco.
                  </p>
                )}
              </div>
            <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
              A falta sera registrada como{" "}
              <span className="font-semibold">{MOTIVO_FALTA_INJUSTIFICADA}</span>
              . Para justificar, utilize o botao "Justificar" com atestado.
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleFaltaFormOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handleSubmitFaltaForm} disabled={faltaFormSaving}>
              {faltaFormSaving
                ? "Salvando..."
                : faltaFormMode === "create"
                  ? "Cadastrar"
                  : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FaltaJustificarDialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        diariaId={selectedFalta?.diaria_temporaria_id ?? null}
        faltaId={selectedFalta?.tipo === "convenia" ? selectedFalta.id : null}
        colaboradorId={selectedColaboradorId}
        colaboradorNome={selectedColaboradorNome}
        dataDiariaLabel={selectedFaltaDataLabel}
        rpcName={selectedRpcName}
        onSuccess={async () => {
          await Promise.all([
            refetchFaltasColaboradores(),
            refetchFaltasConvenia(),
            refetchDiarias(),
          ]);
        }}
      />
      <Dialog open={detailsDialogOpen} onOpenChange={handleDetailsDialogOpenChange}>
        <DialogContent className="w-full max-w-[calc(100vw-1rem)] max-h-[90vh] p-4 sm:max-w-5xl sm:p-6">
          <div className="flex max-h-[90vh] min-h-0 flex-col gap-3 sm:gap-4">
            <DialogHeader className="text-left">
              <DialogTitle>Detalhes da falta</DialogTitle>
              <DialogDescription>Informacoes completas da falta selecionada.</DialogDescription>
            </DialogHeader>
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1 sm:pr-2">
              {detailsFalta ? (() => {
            const diaria = diariaMap.get(String(detailsFalta.diaria_temporaria_id));
            const colaborador =
              detailsFalta.tipo === "colaborador"
                ? colaboradoresMap.get(detailsFalta.colaborador_id)
                : null;
            const postoInfo =
              diaria?.posto_servico_id
                ? postoMap.get(diaria.posto_servico_id)
                : colaborador?.posto || null;
            const clienteNome =
              detailsFalta.colaborador_convenia_id
                ? getConveniaCostCenterName(detailsFalta.colaborador_convenia_id)
                : (typeof diaria?.cliente_id === "number" &&
                    clienteMap.get(diaria.cliente_id)) ||
                  getClienteInfoFromPosto(postoInfo)?.nome ||
                  "-";
            const statusLabel = detailsFalta.justificada_em ? "Justificada" : "Pendente";
            const statusVariant: "default" | "destructive" =
              detailsFalta.justificada_em ? "default" : "destructive";
            const justificadaPorNome = detailsFalta.justificada_por
              ? usuarioMap.get(detailsFalta.justificada_por) || detailsFalta.justificada_por
              : "-";
            const colaboradorNome = getFaltaColaboradorNome(detailsFalta);
            const documentoPath = getFaltaDocumentoPath(detailsFalta);
            const conveniaInfo =
              detailsFalta.tipo === "convenia"
                ? colaboradoresConveniaMap.get(detailsFalta.colaborador_convenia_id)
                : null;
            const cargoLabel = conveniaInfo?.job_name || "-";
            const costCenterLabel =
              conveniaInfo?.cost_center_name ||
              (conveniaInfo?.cost_center_id
                ? costCenterMap.get(conveniaInfo.cost_center_id)
                : null) ||
              "-";
            const dataFaltaLabel = formatDate(
              diaria?.data_diaria ||
                (detailsFalta.tipo === "convenia" ? detailsFalta.data_falta : null),
            );
            const conveniaFieldEntriesByGroup =
              detailsFalta.tipo === "convenia"
                ? CONVENIA_FIELD_GROUPS_WITH_FALLBACK.map((group) => {
                    const entries = group.keys.flatMap((key) => {
                      const label = CONVENIA_FIELD_LABEL_MAP.get(key) ?? key;
                      const rawValue =
                        key === "cost_center_name"
                          ? costCenterLabel
                          : conveniaInfo && key in conveniaInfo
                            ? (conveniaInfo as any)[key]
                            : null;
                      return buildConveniaFieldEntries(key, label, rawValue);
                    });
                    return { ...group, entries };
                  })
                : [];
            const conveniaTabsDefault =
              conveniaFieldEntriesByGroup[0]?.id ?? "identificacao";

              return (
                  <div className="space-y-4">
                      {hasDiariaVinculadaAtiva(detailsFalta) && (
                        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                          Diária vinculada
                        </div>
                      )}
                    <div className="grid min-w-0 gap-3 lg:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Data</p>
                      <p className="text-sm font-medium break-words">{dataFaltaLabel}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Colaborador</p>
                      <p className="text-sm font-medium break-words">{colaboradorNome}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Cliente</p>
                      <p className="text-sm font-medium break-words">{clienteNome}</p>
                    </div>
                    {detailsFalta.tipo === "convenia" && (
                      <>
                        <div>
                          <p className="text-xs text-muted-foreground">Centro de custo</p>
                          <p className="text-sm font-medium break-words">{costCenterLabel}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Cargo</p>
                          <p className="text-sm font-medium break-words">{cargoLabel}</p>
                        </div>
                      </>
                    )}
                    <div>
                      <p className="text-xs text-muted-foreground">Motivo</p>
                      <p className="text-sm font-medium break-words">{detailsFalta.motivo || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Status</p>
                      <Badge variant={statusVariant}>{statusLabel}</Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Justificada em</p>
                      <p className="text-sm font-medium">
                        {detailsFalta.justificada_em ? formatDateTime(detailsFalta.justificada_em) : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Justificada por</p>
                      <p className="text-sm font-medium break-words">{justificadaPorNome}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Documento</p>
                    {documentoPath ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewDocumento(documentoPath as string)}
                      >
                        Ver documento
                      </Button>
                    ) : (
                      <p className="text-sm font-medium">-</p>
                    )}
                  </div>
                </div>

                {detailsFalta.tipo === "convenia" && (
                    <div className="space-y-3 rounded-md border bg-muted/20 p-3 sm:p-4">
                      <p className="text-sm font-semibold text-muted-foreground">
                        Dados do colaborador Convenia
                      </p>
                      <Tabs defaultValue={conveniaTabsDefault} className="w-full min-w-0">
                        <TabsList className="w-full h-auto flex-wrap items-start justify-start gap-2 mb-3">
                          {conveniaFieldEntriesByGroup.map((group) => (
                            <TabsTrigger
                              key={group.id}
                              value={group.id}
                              className="flex-1 text-xs sm:flex-none sm:text-sm"
                            >
                              {group.label}
                            </TabsTrigger>
                          ))}
                        </TabsList>
                      {conveniaFieldEntriesByGroup.map((group) => (
                        <TabsContent key={group.id} value={group.id} className="mt-4">
                          {group.entries.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Sem informacoes.</p>
                          ) : (
                              <div className="grid min-w-0 gap-3 grid-cols-1 lg:grid-cols-2">
                                {group.entries.map((entry) => (
                                  <div key={entry.id}>
                                    <p className="text-xs text-muted-foreground">{entry.label}</p>
                                    <p className="text-sm font-medium break-words whitespace-pre-wrap">
                                      {entry.value}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </TabsContent>
                        ))}
                      </Tabs>
                    </div>
                  )}

                  <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-start">
                    {!detailsFalta.justificada_em && (
                      <Button
                        type="button"
                        size="sm"
                        className="w-full sm:w-auto"
                        disabled={accessLoading || !canJustifyFalta(detailsFalta)}
                        onClick={() => {
                          handleDetailsDialogOpenChange(false);
                          openJustificarDialog(detailsFalta);
                        }}
                    >
                      Justificar
                    </Button>
                  )}
                  {detailsFalta.justificada_em &&
                    canRevertFalta(detailsFalta) && (
                        <Button
                          type="button"
                          size="sm"
                          className="w-full sm:w-auto"
                          disabled={accessLoading || revertingId === detailsFalta.id}
                          onClick={() => handleReverterJustificativa(detailsFalta)}
                        >
                          {revertingId === detailsFalta.id
                            ? "Revertendo..."
                          : "Reverter justificativa"}
                      </Button>
                    )}
                  {detailsFalta.tipo === "convenia" && (
                    <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="w-full sm:w-auto"
                          disabled={accessLoading || !canUpdateFaltaConvenia()}
                          onClick={() => {
                            handleDetailsDialogOpenChange(false);
                            openEditFaltaForm(detailsFalta);
                          }}
                        >
                          Editar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          className="w-full sm:w-auto"
                          disabled={accessLoading || !canDeleteFaltaConvenia()}
                          onClick={() => handleDeleteFaltaConvenia(detailsFalta)}
                        >
                          Excluir
                        </Button>
                    </>
                  )}
                </DialogFooter>
              </div>
            );
          })() : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={advancedDialogOpen} onOpenChange={setAdvancedDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Filtragem avancada</DialogTitle>
            <DialogDescription>
              Selecione o periodo (data da falta) e consulte quantidades por colaborador.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2 rounded-md border bg-muted/30 p-4">
              <p className="text-sm font-semibold text-muted-foreground">Periodo das faltas</p>
              <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2">
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">Data inicial</span>
                  <Input
                    type="date"
                    value={advancedDateRange.startDate}
                    onChange={(event) =>
                      setAdvancedDateRange((prev) => ({
                        ...prev,
                        startDate: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">Data final</span>
                  <Input
                    type="date"
                    value={advancedDateRange.endDate}
                    onChange={(event) =>
                      setAdvancedDateRange((prev) => ({
                        ...prev,
                        endDate: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2 rounded-md border bg-muted/30 p-4">
              <p className="text-sm font-semibold text-muted-foreground">
                Quantidade de faltas (justificadas + injustificadas)
              </p>
              <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-1">
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">Colaborador</span>
                  <Select
                    value={advancedTotalRange.colaboradorId || ADVANCED_FILTER_ALL}
                    onValueChange={(value) =>
                      setAdvancedTotalRange((prev) => ({
                        ...prev,
                        colaboradorId: value === ADVANCED_FILTER_ALL ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o colaborador" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ADVANCED_FILTER_ALL}>Selecione o colaborador</SelectItem>
                      {advancedColaboradorOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="rounded-md border bg-background/80 p-3">
                <p className="text-sm text-muted-foreground">
                  Quantidade no periodo selecionado
                </p>
                <p className="text-2xl font-semibold">
                  {advancedTotalCount !== null ? advancedTotalCount : "--"}
                </p>
                <div className="mt-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      handleExportAdvancedRange(
                        {
                          colaboradorId: advancedTotalRange.colaboradorId,
                          ...advancedDateRange,
                        },
                        undefined,
                        "total",
                      )
                    }
                  >
                    Exportar XLSX
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2 rounded-md border bg-muted/30 p-4">
              <p className="text-sm font-semibold text-muted-foreground">
                Quantidade de faltas - {MOTIVO_FALTA_INJUSTIFICADA}
              </p>
              <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-1">
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">Colaborador</span>
                  <Select
                    value={advancedInjustificadaRange.colaboradorId || ADVANCED_FILTER_ALL}
                    onValueChange={(value) =>
                      setAdvancedInjustificadaRange((prev) => ({
                        ...prev,
                        colaboradorId: value === ADVANCED_FILTER_ALL ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o colaborador" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ADVANCED_FILTER_ALL}>Selecione o colaborador</SelectItem>
                      {advancedColaboradorOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="rounded-md border bg-background/80 p-3">
                <p className="text-sm text-muted-foreground">
                  Quantidade no periodo selecionado
                </p>
                <p className="text-2xl font-semibold">
                  {advancedInjustificadaCount !== null ? advancedInjustificadaCount : "--"}
                </p>
                <div className="mt-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      handleExportAdvancedRange(
                        {
                          colaboradorId: advancedInjustificadaRange.colaboradorId,
                          ...advancedDateRange,
                        },
                        MOTIVO_FALTA_INJUSTIFICADA,
                        "injustificadas",
                      )
                    }
                  >
                    Exportar XLSX
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2 rounded-md border bg-muted/30 p-4">
              <p className="text-sm font-semibold text-muted-foreground">
                Quantidade de faltas - {MOTIVO_FALTA_JUSTIFICADA}
              </p>
              <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-1">
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">Colaborador</span>
                  <Select
                    value={advancedJustificadaRange.colaboradorId || ADVANCED_FILTER_ALL}
                    onValueChange={(value) =>
                      setAdvancedJustificadaRange((prev) => ({
                        ...prev,
                        colaboradorId: value === ADVANCED_FILTER_ALL ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o colaborador" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ADVANCED_FILTER_ALL}>Selecione o colaborador</SelectItem>
                      {advancedColaboradorOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="rounded-md border bg-background/80 p-3">
                <p className="text-sm text-muted-foreground">
                  Quantidade no periodo selecionado
                </p>
                <p className="text-2xl font-semibold">
                  {advancedJustificadaCount !== null ? advancedJustificadaCount : "--"}
                </p>
                <div className="mt-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      handleExportAdvancedRange(
                        {
                          colaboradorId: advancedJustificadaRange.colaboradorId,
                          ...advancedDateRange,
                        },
                        MOTIVO_FALTA_JUSTIFICADA,
                        "justificadas",
                      )
                    }
                  >
                    Exportar XLSX
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setAdvancedDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Faltas;
