import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {

  Select,

  SelectContent,

  SelectItem,

  SelectTrigger,

  SelectValue,

} from "@/components/ui/select";

import { Badge } from "@/components/ui/badge";

import { Search, Info } from "lucide-react";

import { format } from "date-fns";

import { ptBR } from "date-fns/locale";

import { DashboardLayout } from "@/components/DashboardLayout";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";



const STATUS_COLABORADOR_LABELS: Record<string, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
};

const STATUS_COLABORADOR_BADGE: Record<string, "default" | "secondary"> = {
  ativo: "default",
  inativo: "secondary",
};

const parseDbDate = (date: string) => new Date(`${date}T00:00:00`);
const formatDate = (date?: string | null) =>
  date ? format(parseDbDate(date), "dd/MM/yyyy", { locale: ptBR }) : "-";
const getColaboradorNome = (colaborador: any) => {
  const nomeCompleto = [colaborador?.name, colaborador?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return colaborador?.social_name || nomeCompleto || colaborador?.name || colaborador?.last_name || "Colaborador";
};

const getCostCenterLabel = (colaborador: any) => {
  const linked = colaborador?.cost_center_ref;
  const linkedName =
    linked?.name ||
    linked?.convenia_cost_center_name ||
    linked?.descricao ||
    linked?.description;
  if (typeof linkedName === "string" && linkedName.trim()) return linkedName;

  const raw = colaborador?.cost_center;
  const fallback = colaborador?.cost_center_name;

  if (!raw) return fallback || "-";
  if (typeof raw === "string") return raw;

  if (Array.isArray(raw)) {
    const nomes = raw
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const nome =
            (item as any).name ??
            (item as any).convenia_cost_center_name ??
            (item as any).descricao ??
            (item as any).description;
          if (typeof nome === "string" && nome.trim()) return nome;
        }
        return null;
      })
      .filter(Boolean) as string[];
    if (nomes.length) return nomes.join(", ");
  }

  if (raw && typeof raw === "object") {
    const nome =
      (raw as any).name ??
      (raw as any).convenia_cost_center_name ??
      (raw as any).descricao ??
      (raw as any).description;
    if (typeof nome === "string" && nome.trim()) return nome;
  }

  return fallback || "-";
};

const getStatusBadgeVariant = (status?: string | null): "default" | "secondary" | "outline" =>
  status && STATUS_COLABORADOR_BADGE[status] ? STATUS_COLABORADOR_BADGE[status] : "outline";

const FIELD_LABELS: Record<string, string> = {
  id: "ID",
  convenia_id: "ID Convenia",
  name: "Nome",
  last_name: "Sobrenome",
  social_name: "Nome social",
  status: "Status",
  registration: "Matrícula",
  cpf: "CPF",
  birth_date: "Data de nascimento",
  hiring_date: "Data de admissão",
  email: "Email corporativo",
  personal_email: "Email pessoal",
  personal_phone: "Telefone pessoal",
  residential_phone: "Telefone residencial",
  job_id: "Cargo (ID)",
  job_name: "Cargo",
  department_id: "Departamento (ID)",
  department_name: "Departamento",
  team_id: "Equipe (ID)",
  team_name: "Equipe",
  supervisor_id: "Supervisor (ID)",
  supervisor_name: "Supervisor (nome)",
  supervisor_last_name: "Supervisor (sobrenome)",
  cost_center_id: "Centro de custo (ID)",
  cost_center_name: "Centro de custo (nome)",
  cost_center: "Centro de custo (payload)",
  address_street: "Rua",
  address_number: "Número",
  address_complement: "Complemento",
  address_district: "Bairro",
  address_city: "Cidade",
  address_state: "Estado",
  address_zip_code: "CEP",
  rg_number: "RG - Número",
  rg_issuing_agency: "RG - Órgão emissor",
  rg_emission_date: "RG - Data de emissão",
  ctps_number: "CTPS - Número",
  ctps_serial_number: "CTPS - Série",
  ctps_emission_date: "CTPS - Data de emissão",
  pis: "PIS",
  electoral_card: "Título de eleitor",
  reservist: "Reservista",
  driver_license_number: "CNH - Número",
  driver_license_category: "CNH - Categoria",
  driver_license_emission_date: "CNH - Data de emissão",
  driver_license_validate_date: "CNH - Validade",
  salary: "Salário",
  payroll: "Folha de pagamento",
  bank_accounts: "Contas bancárias",
  emergency_contacts: "Contatos de emergência",
  educations: "Formação",
  experience_period: "Período de experiência",
  intern_data: "Dados de estágio",
  disability: "Deficiência",
  aso: "ASO",
  nationalities: "Nacionalidades",
  annotations: "Anotações",
  foreign_data: "Dados estrangeiros",
  raw_data: "Dados brutos",
  synced_at: "Sincronizado em",
  created_at: "Criado em",
  updated_at: "Atualizado em",
  "cost_center_ref.id": "Centro de custo (ref ID)",
  "cost_center_ref.name": "Centro de custo (ref nome)",
  "cost_center_ref.convenia_id": "Centro de custo (ref Convenia ID)",
};

const BANK_ACCOUNT_LABELS: Record<string, string> = {
  bank_name: "Banco",
  bank_code: "Código do banco",
  branch: "Agência",
  agency: "Agência",
  agency_digit: "Dígito da agência",
  account: "Conta",
  account_number: "Número da conta",
  account_digit: "Dígito da conta",
  account_type: "Tipo de conta",
  pix_key: "Chave PIX",
  pix_key_type: "Tipo da chave PIX",
  holder_name: "Titular",
  holder_document: "Documento do titular",
  holder_document_type: "Tipo de documento do titular",
  is_default: "Conta principal",
};

const DATE_ONLY_FIELDS = new Set([
  "birth_date",
  "hiring_date",
  "ctps_emission_date",
  "driver_license_emission_date",
  "driver_license_validate_date",
  "rg_emission_date",
]);

const DATE_TIME_FIELDS = new Set(["created_at", "updated_at", "synced_at"]);

const TABLE_FIELD_ORDER = [
  "id",
  "convenia_id",
  "name",
  "last_name",
  "social_name",
  "status",
  "registration",
  "cpf",
  "birth_date",
  "hiring_date",
  "email",
  "personal_email",
  "personal_phone",
  "residential_phone",
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
  "address_street",
  "address_number",
  "address_complement",
  "address_district",
  "address_city",
  "address_state",
  "address_zip_code",
  "rg_number",
  "rg_issuing_agency",
  "rg_emission_date",
  "ctps_number",
  "ctps_serial_number",
  "ctps_emission_date",
  "pis",
  "electoral_card",
  "reservist",
  "driver_license_number",
  "driver_license_category",
  "driver_license_emission_date",
  "driver_license_validate_date",
  "salary",
  "payroll",
  "bank_accounts",
  "emergency_contacts",
  "educations",
  "experience_period",
  "intern_data",
  "disability",
  "aso",
  "nationalities",
  "annotations",
  "foreign_data",
  "raw_data",
  "synced_at",
  "created_at",
  "updated_at",
];

const BANK_ACCOUNT_FIELD_ORDER = [
  "bank_name",
  "bank_code",
  "branch",
  "agency",
  "agency_digit",
  "account",
  "account_number",
  "account_digit",
  "account_type",
  "pix_key",
  "pix_key_type",
  "holder_name",
  "holder_document",
  "holder_document_type",
  "is_default",
];

const TAB_FIELDS = {
  pessoal: [
    "name",
    "last_name",
    "social_name",
    "cpf",
    "birth_date",
    "nationalities",
    "disability",
  ],
  contato: [
    "email",
    "personal_email",
    "personal_phone",
    "residential_phone",
    "address_street",
    "address_number",
    "address_complement",
    "address_district",
    "address_city",
    "address_state",
    "address_zip_code",
    "emergency_contacts",
  ],
  profissional: [
    "id",
    "status",
    "registration",
    "hiring_date",
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
    "cost_center_ref.id",
    "cost_center_ref.name",
    "cost_center_ref.convenia_id",
    "experience_period",
    "intern_data",
    "convenia_id",
  ],
  documentos: [
    "rg_number",
    "rg_issuing_agency",
    "rg_emission_date",
    "ctps_number",
    "ctps_serial_number",
    "ctps_emission_date",
    "pis",
    "electoral_card",
    "reservist",
    "driver_license_number",
    "driver_license_category",
    "driver_license_emission_date",
    "driver_license_validate_date",
  ],
  financeiro: ["salary", "payroll"],
  outros: [
    "aso",
    "annotations",
    "educations",
    "foreign_data",
    "raw_data",
    "synced_at",
    "created_at",
    "updated_at",
  ],
};

const humanizeKey = (key: string) => {
  const tokenMap: Record<string, string> = {
    id: "ID",
    name: "Nome",
    last: "Sobrenome",
    social: "Social",
    status: "Status",
    registration: "Matrícula",
    cpf: "CPF",
    birth: "Nascimento",
    hiring: "Admissão",
    email: "Email",
    personal: "Pessoal",
    phone: "Telefone",
    job: "Cargo",
    department: "Departamento",
    team: "Equipe",
    supervisor: "Supervisor",
    cost: "Custo",
    center: "Centro",
    address: "Endereço",
    street: "Rua",
    number: "Número",
    complement: "Complemento",
    district: "Bairro",
    city: "Cidade",
    state: "Estado",
    zip: "CEP",
    rg: "RG",
    issuing: "Emissor",
    ctps: "CTPS",
    serial: "Série",
    pis: "PIS",
    electoral: "Eleitor",
    reservist: "Reservista",
    driver: "CNH",
    license: "CNH",
    validate: "Validade",
    salary: "Salário",
    payroll: "Folha",
    bank: "Banco",
    accounts: "Contas",
    emergency: "Emergência",
    contacts: "Contatos",
    educations: "Formação",
    experience: "Experiência",
    intern: "Estágio",
    disability: "Deficiência",
    aso: "ASO",
    nationalities: "Nacionalidades",
    annotations: "Anotações",
    foreign: "Estrangeiro",
    raw: "Brutos",
    synced: "Sincronizado",
    created: "Criado",
    updated: "Atualizado",
    convenia: "Convenia",
    ref: "Referência",
  };

  return key
    .replace(/\./g, " ")
    .split("_")
    .map((segment) => tokenMap[segment] || segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
};

const getFieldLabel = (key: string) => FIELD_LABELS[key] || humanizeKey(key);
const getBankAccountLabel = (key: string) => BANK_ACCOUNT_LABELS[key] || humanizeKey(key);

const parseJsonSafe = (value: any) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const normalizeBankAccounts = (value: any) => {
  const parsed = parseJsonSafe(value);
  if (!parsed) return [];
  if (Array.isArray(parsed)) {
    return parsed
      .filter(Boolean)
      .map((item) => (item && typeof item === "object" && !Array.isArray(item) ? item : { value: item }));
  }
  if (typeof parsed === "object") return [parsed as Record<string, any>];
  return [{ value: parsed }];
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, "dd/MM/yyyy HH:mm", { locale: ptBR });
};

const formatPrimitiveValue = (key: string, value: any, emptyValue: string) => {
  if (value === null || value === undefined || value === "") return emptyValue;
  if (DATE_ONLY_FIELDS.has(key)) return formatDate(value);
  if (DATE_TIME_FIELDS.has(key)) return formatDateTime(value);
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  return String(value);
};

const flattenValueEntries = (
  label: string,
  rawValue: any,
  key: string,
  emptyValue: string,
): Array<{ label: string; value: string }> => {
  const value = parseJsonSafe(rawValue);

  if (value === null || value === undefined || value === "") {
    return [{ label, value: emptyValue }];
  }

  if (Array.isArray(value)) {
    if (!value.length) return [{ label, value: emptyValue }];
    return value.flatMap((item, index) => {
      const indexedLabel = `${label} ${index + 1}`;
      if (item && typeof item === "object") {
        return flattenValueEntries(indexedLabel, item, key, emptyValue);
      }
      return [{ label: indexedLabel, value: formatPrimitiveValue(key, item, emptyValue) }];
    });
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, any>);
    if (!entries.length) return [{ label, value: emptyValue }];
    return entries.flatMap(([subKey, subValue]) =>
      flattenValueEntries(`${label} - ${humanizeKey(subKey)}`, subValue, subKey, emptyValue),
    );
  }

  return [{ label, value: formatPrimitiveValue(key, value, emptyValue) }];
};

const getFieldValue = (colaborador: any, key: string) => {
  if (key.startsWith("cost_center_ref.")) {
    const nestedKey = key.replace("cost_center_ref.", "");
    return colaborador?.cost_center_ref?.[nestedKey];
  }
  return colaborador?.[key];
};

const buildBankAccountEntries = (
  account: Record<string, any>,
  prefix: string,
  emptyValue: string,
) => {
  const orderedKeys = [
    ...BANK_ACCOUNT_FIELD_ORDER,
    ...Object.keys(account).filter((key) => !BANK_ACCOUNT_FIELD_ORDER.includes(key)),
  ];
  const uniqueKeys = Array.from(new Set(orderedKeys));

  return uniqueKeys.flatMap((key) =>
    flattenValueEntries(`${prefix}${getBankAccountLabel(key)}`, account[key], key, emptyValue),
  );
};

const buildExportRow = (colaborador: any) => {
  const row: Record<string, any> = {};
  const includedKeys = new Set<string>();
  const addEntries = (entries: Array<{ label: string; value: string }>) => {
    entries.forEach((entry) => {
      row[entry.label] = entry.value;
    });
  };

  TABLE_FIELD_ORDER.forEach((key) => {
    if (key === "bank_accounts") return;
    const value = getFieldValue(colaborador, key);
    addEntries(flattenValueEntries(getFieldLabel(key), value, key, ""));
    includedKeys.add(key);
  });

  ["cost_center_ref.id", "cost_center_ref.name", "cost_center_ref.convenia_id"].forEach((key) => {
    const value = getFieldValue(colaborador, key);
    if (value === null || value === undefined || value === "") return;
    addEntries(flattenValueEntries(getFieldLabel(key), value, key, ""));
  });

  const bankAccounts = normalizeBankAccounts(colaborador?.bank_accounts);
  bankAccounts.forEach((account, index) => {
    addEntries(buildBankAccountEntries(account, `Conta bancária ${index + 1} - `, ""));
  });

  Object.keys(colaborador ?? {}).forEach((key) => {
    if (includedKeys.has(key)) return;
    if (key === "bank_accounts" || key === "cost_center_ref") return;
    addEntries(flattenValueEntries(getFieldLabel(key), colaborador[key], key, ""));
  });

  return row;
};



export default function Colaboradores() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [cargoFilter, setCargoFilter] = useState<string>("all");
  const [costCenterFilter, setCostCenterFilter] = useState<string>("all");
  const [colaboradorDetalhe, setColaboradorDetalhe] = useState<any>(null);

  const { data: colaboradoresConvenia = [] } = useQuery({
    queryKey: ["colaboradores-convenia"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaboradores_convenia")
        .select("*, cost_center_ref:cost_center_id ( id, name, convenia_id )")
        .order("name");

      if (error) throw error;
      return data ?? [];
    },
  });

  const searchLower = searchTerm.trim().toLowerCase();

  const filteredColaboradores = colaboradoresConvenia.filter((colaborador: any) => {
    const nome = getColaboradorNome(colaborador).toLowerCase();
    const email = colaborador.email?.toLowerCase() || "";
    const personalEmail = colaborador.personal_email?.toLowerCase() || "";
    const cpf = colaborador.cpf || "";
    const registration = colaborador.registration?.toLowerCase() || "";
    const costCenterLabel = getCostCenterLabel(colaborador);

    const matchesSearch =
      !searchLower ||
      nome.includes(searchLower) ||
      email.includes(searchLower) ||
      personalEmail.includes(searchLower) ||
      cpf.includes(searchLower) ||
      registration.includes(searchLower);

    const matchesStatus = statusFilter === "all" || colaborador.status === statusFilter;
    const matchesCargo = cargoFilter === "all" || colaborador.job_name === cargoFilter;
    const matchesCostCenter = costCenterFilter === "all" || costCenterLabel === costCenterFilter;

    return matchesSearch && matchesStatus && matchesCargo && matchesCostCenter;
  });

  const statusOptions = Array.from(
    new Set(
      (colaboradoresConvenia ?? [])
        .map((colaborador: any) => colaborador.status)
        .filter((status): status is string => Boolean(status))
    )
  );

  const cargoOptions = Array.from(
    new Set(
      (colaboradoresConvenia ?? [])
        .map((colaborador: any) => colaborador.job_name)
        .filter((cargo): cargo is string => Boolean(cargo))
    )
  );

  const costCenterOptions = Array.from(
    new Set(
      (colaboradoresConvenia ?? [])
        .map((colaborador: any) => getCostCenterLabel(colaborador))
        .filter((centro): centro is string => Boolean(centro && centro !== "-"))
    )
  );

  const totalColaboradores = filteredColaboradores.length;

  const bankAccounts = normalizeBankAccounts(colaboradorDetalhe?.bank_accounts);

  const renderFieldGrid = (fields: string[]) => {
    const entries = fields.flatMap((field) =>
      flattenValueEntries(
        getFieldLabel(field),
        getFieldValue(colaboradorDetalhe, field),
        field,
        "-",
      ),
    );

    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((entry, index) => (
          <div key={`${entry.label}-${index}`}>
            <p className="text-xs text-muted-foreground">{entry.label}</p>
            <p className="font-medium break-words whitespace-pre-wrap">{entry.value}</p>
          </div>
        ))}
      </div>
    );
  };

  const handleExportXlsx = () => {
    if (!filteredColaboradores.length) {
      toast.error("Nenhum colaborador para exportar.");
      return;
    }

    const rows = filteredColaboradores.map((colaborador: any) => buildExportRow(colaborador));
    const headers: string[] = [];
    const headerSet = new Set<string>();

    rows.forEach((row) => {
      Object.keys(row).forEach((key) => {
        if (!headerSet.has(key)) {
          headerSet.add(key);
          headers.push(key);
        }
      });
    });

    const sheet = XLSX.utils.json_to_sheet(rows, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Colaboradores");
    XLSX.writeFile(wb, `colaboradores-convenia-${Date.now()}.xlsx`);
    toast.success("Arquivo XLSX gerado.");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Colaboradores</h1>
            <p className="text-sm text-muted-foreground">
              Visualize os colaboradores sincronizados da Convenia.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="search-colaboradores">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="search-colaboradores"
                placeholder="Nome, CPF, email ou matricula"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {statusOptions.map((status) => (
                  <SelectItem key={status} value={status}>
                    {STATUS_COLABORADOR_LABELS[status] || status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Cargo</Label>
            <Select value={cargoFilter} onValueChange={setCargoFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {cargoOptions.map((cargo) => (
                  <SelectItem key={cargo} value={cargo}>
                    {cargo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Centro de Custo</Label>
            <Select value={costCenterFilter} onValueChange={setCostCenterFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {costCenterOptions.map((centro) => (
                  <SelectItem key={centro} value={centro}>
                    {centro}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-md border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
            <div>
              <p className="text-sm font-semibold">
                {totalColaboradores} {totalColaboradores === 1 ? "colaborador" : "colaboradores"}
              </p>
              <p className="text-xs text-muted-foreground">
                {totalColaboradores !== colaboradoresConvenia.length
                  ? "Exibindo resultados com filtros aplicados"
                  : "Exibindo todos os colaboradores disponiveis"}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleExportXlsx}
              disabled={!filteredColaboradores.length}
            >
              Exportar XLSX
            </Button>
          </div>

          <div className="divide-y">
            {filteredColaboradores.length ? (
              filteredColaboradores.map((colaborador: any) => (
                <div
                  key={colaborador.id}
                  className="flex flex-col gap-4 p-4 transition hover:bg-muted/40 sm:flex-row sm:items-start sm:justify-between"
                  role="button"
                  tabIndex={0}
                  onClick={() => setColaboradorDetalhe(colaborador)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setColaboradorDetalhe(colaborador);
                    }
                  }}
                >
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-start gap-3">
                      <div>
                        <p className="font-semibold leading-tight">{getColaboradorNome(colaborador)}</p>
                        <p className="text-xs text-muted-foreground">
                          {colaborador.email || colaborador.personal_email || "-"}
                        </p>
                      </div>
                      {colaborador.status && (
                        <Badge
                          variant={getStatusBadgeVariant(colaborador.status)}
                          className="capitalize"
                        >
                          {STATUS_COLABORADOR_LABELS[colaborador.status] || colaborador.status}
                        </Badge>
                      )}
                    </div>

                    <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Cargo</p>
                        <p className="font-medium">{colaborador.job_name || "-"}</p>
                        {colaborador.department_name && (
                          <p className="text-xs text-muted-foreground">
                            Departamento: {colaborador.department_name}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Centro de custo</p>
                        <p className="font-medium">{getCostCenterLabel(colaborador)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Matricula</p>
                        <p className="font-medium">{colaborador.registration || "-"}</p>
                        <p className="text-xs text-muted-foreground">CPF</p>
                        <p className="font-medium">{colaborador.cpf || "-"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(event) => {
                        event.stopPropagation();
                        setColaboradorDetalhe(colaborador);
                      }}
                      title="Ver detalhes"
                    >
                      <Info className="h-4 w-4" />
                      <span className="sr-only">Ver detalhes</span>
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Nenhum colaborador encontrado com os filtros selecionados.
              </div>
            )}
          </div>
        </div>

        <Dialog
          open={!!colaboradorDetalhe}
          onOpenChange={(open) => {
            if (!open) setColaboradorDetalhe(null);
          }}
        >
        <DialogContent className="w-[95vw] max-w-6xl h-[90vh] overflow-hidden">
          <div className="flex h-full min-h-0 flex-col gap-3">
            <DialogHeader>
              <DialogTitle>
                {colaboradorDetalhe ? getColaboradorNome(colaboradorDetalhe) : "Colaborador"}
              </DialogTitle>
              <DialogDescription>Informacoes completas do colaborador</DialogDescription>
            </DialogHeader>

            {colaboradorDetalhe && (
              <Tabs defaultValue="pessoal" className="flex h-full min-h-0 flex-col">
                <TabsList className="h-auto flex-wrap justify-start gap-2">
                  <TabsTrigger value="pessoal">Pessoal</TabsTrigger>
                  <TabsTrigger value="contato">Contato</TabsTrigger>
                  <TabsTrigger value="profissional">Profissional</TabsTrigger>
                  <TabsTrigger value="documentos">Documentos</TabsTrigger>
                  <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
                  <TabsTrigger value="outros">Outros</TabsTrigger>
                </TabsList>

                <div className="mt-3 flex-1 min-h-0 overflow-y-auto pr-2">
                  <TabsContent value="pessoal" className="mt-0">
                    {renderFieldGrid(TAB_FIELDS.pessoal)}
                  </TabsContent>

                  <TabsContent value="contato" className="mt-0">
                    {renderFieldGrid(TAB_FIELDS.contato)}
                  </TabsContent>

                  <TabsContent value="profissional" className="mt-0">
                    {renderFieldGrid(TAB_FIELDS.profissional)}
                  </TabsContent>

                  <TabsContent value="documentos" className="mt-0">
                    {renderFieldGrid(TAB_FIELDS.documentos)}
                  </TabsContent>

                  <TabsContent value="financeiro" className="mt-0">
                    <div className="space-y-4">
                      {renderFieldGrid(TAB_FIELDS.financeiro)}

                      <div className="space-y-3">
                        <p className="text-sm font-semibold">Contas bancárias</p>
                        {bankAccounts.length ? (
                          bankAccounts.map((account, index) => {
                            const entries = buildBankAccountEntries(account, "", "-");
                            return (
                              <div key={index} className="rounded-md border p-3">
                                <p className="text-sm font-medium">Conta bancária {index + 1}</p>
                                {entries.length ? (
                                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    {entries.map((entry) => (
                                      <div key={`${index}-${entry.label}`}>
                                        <p className="text-xs text-muted-foreground">{entry.label}</p>
                                        <p className="font-medium break-words whitespace-pre-wrap">
                                          {entry.value}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="mt-2 text-sm text-muted-foreground">
                                    Nenhum dado disponível para esta conta.
                                  </p>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Nenhuma conta bancária cadastrada.
                          </p>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="outros" className="mt-0">
                    {renderFieldGrid(TAB_FIELDS.outros)}
                  </TabsContent>
                </div>
              </Tabs>
            )}
          </div>
        </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
