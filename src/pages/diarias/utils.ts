import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, isWithinInterval, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

export const normalizeStatus = (value?: string | null) => {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

export const STATUS = {
  aguardando: "Aguardando confirmacao",
  confirmada: "Confirmada",
  aprovada: "Aprovada",
  lancada: "Lançada para pagamento",
  aprovadaPagamento: "Aprovada para pagamento",
  paga: "Paga",
  reprovada: "Reprovada",
  cancelada: "Cancelada",
} as const;

export const STATUS_LABELS: Record<string, string> = {
  [STATUS.aguardando]: "Aguardando confirmacao",
  [STATUS.confirmada]: "Confirmada",
  [STATUS.aprovada]: "Aprovada",
  [STATUS.lancada]: "Lançada para pagamento",
  [STATUS.aprovadaPagamento]: "Aprovada para pagamento",
  [STATUS.paga]: "Paga",
  [STATUS.reprovada]: "Reprovada",
  [STATUS.cancelada]: "Cancelada",
};

export const STATUS_BADGE: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  [STATUS.aguardando]: "secondary",
  [STATUS.confirmada]: "default",
  [STATUS.aprovada]: "default",
  [STATUS.lancada]: "default",
  [STATUS.aprovadaPagamento]: "default",
  [STATUS.paga]: "secondary",
  [STATUS.reprovada]: "destructive",
  [STATUS.cancelada]: "destructive",
};

export const NEXT_STATUS_ACTIONS: Record<
  string,
  { label: string; nextStatus: string; icon?: "confirm" | "advance" } | undefined
> = {
  [normalizeStatus(STATUS.aguardando)]: {
    label: "Confirmar diaria",
    nextStatus: STATUS.confirmada,
    icon: "confirm",
  },
  [normalizeStatus(STATUS.confirmada)]: {
    label: "Aprovar diaria",
    nextStatus: STATUS.aprovada,
    icon: "advance",
  },
  [normalizeStatus(STATUS.aprovada)]: {
    label: "Lançar para pagamento",
    nextStatus: STATUS.lancada,
    icon: "advance",
  },
  [normalizeStatus(STATUS.lancada)]: {
    label: "Aprovar para pagamento",
    nextStatus: STATUS.aprovadaPagamento,
    icon: "advance",
  },
  [normalizeStatus(STATUS.aprovadaPagamento)]: {
    label: "Paga",
    nextStatus: STATUS.paga,
    icon: "advance",
  },
};

export const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export const formatDate = (value?: string | null) => {
  if (!value) return "-";
  try {
    return format(parseISO(value), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return value;
  }
};

export const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  try {
    return format(new Date(value), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return value;
  }
};

export const getMonthValue = (value?: string | null) => {
  if (!value) return null;
  try {
    return format(parseISO(value), "yyyy-MM");
  } catch {
    return null;
  }
};

export const currentMonthValue = format(new Date(), "yyyy-MM");

export const getMonthRange = (monthValue: string) => {
  const [year, month] = monthValue.split("-").map(Number);
  const base = new Date(year, month - 1, 1);
  return {
    start: format(base, "yyyy-MM-dd"),
    end: format(endOfMonth(base), "yyyy-MM-dd"),
  };
};

const getTodayInBrazilISO = () => {
  const localeString = new Date().toLocaleString("en-US", {
    timeZone: "America/Sao_Paulo",
  });
  const dateInBrazil = new Date(localeString);
  return format(dateInBrazil, "yyyy-MM-dd");
};

export type PostoDiaVago = {
  id: string;
  data: string;
  motivo: string | null;
  posto_servico_id: string;
  posto?: {
    id: string;
    nome: string;
    valor_diaria: number | null;
    unidade?: {
      id: string;
      nome: string;
      contrato_id?: string | null;
      contrato?: {
        id: string;
        negocio?: string | null;
        cliente_id: string | null;
        clientes?: {
          id: string;
          razao_social: string | null;
        } | null;
      } | null;
    } | null;
  } | null;
};

export type Diarista = {
  id: string;
  nome_completo: string;
  cargo: string | null;
  status: string | null;
  banco?: string | null;
  agencia?: string | null;
  numero_conta?: string | null;
  tipo_conta?: string | null;
  pix?: string | null;
};

export type Diaria = {
  id: string;
  posto_dia_vago_id: string;
  diarista_id: string;
  valor: number;
  status: string;
  created_at: string;
  updated_at: string;
  motivo_reprovacao: string | null;
  motivo_cancelamento: string | null;
  posto_dia_vago?: PostoDiaVago | null;
  diarista?: Diarista | null;
};

export function useDiariasData(selectedMonth: string) {
  const todayBrazilISO = getTodayInBrazilISO();
  const monthRangeStrings = useMemo(() => getMonthRange(selectedMonth), [selectedMonth]);
  const { data: postoDiasVagos = [], refetch: refetchDiasVagos } = useQuery({
    queryKey: ["posto-dias-vagos", monthRangeStrings.start, monthRangeStrings.end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posto_dias_vagos")
        .select(
          `
          id,
          data,
          motivo,
          posto_servico_id,
          posto:postos_servico (
            id,
            nome,
            valor_diaria,
            unidade:unidades (
              id,
              nome,
              contrato_id,
              contrato:contratos (
                id,
                negocio,
                cliente_id,
                clientes (
                  id,
                  razao_social
                )
              )
            )
          )
        `
        )
        .gte("data", monthRangeStrings.start)
        .lte("data", monthRangeStrings.end)
        .order("data", { ascending: true });
      if (error) throw error;
      return data as PostoDiaVago[];
    },
  });

  const { data: diaristas = [] } = useQuery({
    queryKey: ["diaristas-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diaristas")
        .select("*")
        .order("nome_completo");
      if (error) throw error;
      if (!data) return [] as Diarista[];
      // map raw rows to the Diarista shape to ensure required properties exist
      return (data as any[]).map((d) => ({
        id: d.id,
        nome_completo: d.nome_completo,
        cargo: d.cargo ?? null,
        status: d.status ?? null,
        banco: d.banco ?? null,
        agencia: d.agencia ?? null,
        numero_conta: d.numero_conta ?? null,
        tipo_conta: d.tipo_conta ?? null,
        pix: d.pix ?? null,
      })) as Diarista[];
    },
  });

  const {
    data: diarias = [],
    isLoading: loadingDiarias,
    refetch: refetchDiarias,
  } = useQuery({
    queryKey: ["diarias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diarias")
        .select(
          `
          *,
          posto_dia_vago:posto_dia_vago_id (
            id,
            data,
            motivo,
            posto:postos_servico (
              id,
              nome,
              valor_diaria,
              unidade:unidades (
                id,
                nome
              )
            )
          )
        `,
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Diaria[];
    },
  });

  const { data: postosOcupados = [] } = useQuery({
    queryKey: ["postos-ocupados"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaboradores")
        .select("id, nome_completo, posto_servico_id")
        .not("posto_servico_id", "is", null)
        .eq("status_colaborador", "ativo");
      if (error) throw error;
      return data as { id: string; nome_completo: string; posto_servico_id: string }[];
    },
  });

  const postoDiaVagoMap = useMemo(() => {
    const map = new Map<string, PostoDiaVago>();
    postoDiasVagos.forEach((dia) => map.set(dia.id, dia));
    return map;
  }, [postoDiasVagos]);

  const diaristaMap = useMemo(() => {
    const map = new Map<string, Diarista>();
    diaristas.forEach((diarista) => map.set(diarista.id, diarista));
    return map;
  }, [diaristas]);

  const postoOcupanteMap = useMemo(() => {
    const map = new Map<string, { id: string; nome_completo: string }>();
    postosOcupados.forEach((colaborador) => {
      if (colaborador.posto_servico_id) {
        map.set(colaborador.posto_servico_id, {
          id: colaborador.id,
          nome_completo: colaborador.nome_completo,
        });
      }
    });
    return map;
  }, [postosOcupados]);

  const usedDiaVagoIds = useMemo(() => new Set(diarias.map((item) => item.posto_dia_vago_id)), [diarias]);

  const monthRange = useMemo(() => {
    return {
      start: parseISO(monthRangeStrings.start),
      end: parseISO(monthRangeStrings.end),
    };
  }, [monthRangeStrings]);

  const filteredDiarias = useMemo(() => {
    return diarias.filter((diaria) => {
      const diaInfo =
        postoDiaVagoMap.get(diaria.posto_dia_vago_id) ?? diaria.posto_dia_vago ?? undefined;
      const data = diaInfo?.data;
      if (!data) return true;
      return isWithinInterval(parseISO(data), monthRange);
    });
  }, [diarias, monthRange, postoDiaVagoMap]);

  const availableDiasVagos = useMemo(() => {
    return postoDiasVagos.filter((dia) => {
      if (usedDiaVagoIds.has(dia.id)) return false;
      if (dia.data < todayBrazilISO) return false;
      return isWithinInterval(parseISO(dia.data), monthRange);
    });
  }, [postoDiasVagos, usedDiaVagoIds, monthRange, todayBrazilISO]);

  return {
    postoDiasVagos,
    diaristas,
    diarias,
    filteredDiarias,
    postoDiaVagoMap,
    diaristaMap,
    postoOcupanteMap,
    availableDiasVagos,
    usedDiaVagoIds,
    refetchDiarias,
    refetchDiasVagos,
    loadingDiarias,
  };
}
