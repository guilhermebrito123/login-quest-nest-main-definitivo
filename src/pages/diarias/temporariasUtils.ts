import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseISO, isWithinInterval } from "date-fns";
import { getMonthRange, Diarista } from "./utils";

export type PostoServicoResumo = {
  id: string;
  nome: string;
  valor_diaria: number | null;
  unidade?: {
    id: string;
    nome: string | null;
    contrato_id?: string | null;
    contrato?: {
      id: string;
      negocio?: string | null;
      cliente_id: string | null;
      clientes?: {
        id: string;
        razao_social: string | null;
        nome_fantasia: string | null;
      } | null;
    } | null;
  } | null;
};

export type ColaboradorAlocado = {
  id: string;
  nome_completo: string;
  cargo: string | null;
  posto_servico_id: string | null;
  posto?: PostoServicoResumo | null;
};

export type ClienteResumo = {
  id: number;
  razao_social: string;
  nome_fantasia: string | null;
};

export type DiariaTemporaria = {
  id: number;
  diarista_id: string;
  colaborador_ausente: string | null;
  colaborador_ausente_nome?: string | null;
  colaborador_falecido?: string | null;
  posto_servico_id: string | null;
  posto_servico?: string | null;
  cliente_id?: number | null;
  criado_por?: string | null;
  confirmada_por?: string | null;
  aprovada_por?: string | null;
  lancada_por?: string | null;
  aprovado_para_pgto_por?: string | null;
  paga_por?: string | null;
  cancelada_por?: string | null;
  reprovada_por?: string | null;
  intervalo?: number | null;
  horario_inicio?: string | null;
  horario_fim?: string | null;
  jornada_diaria?: number | null;
  valor_diaria: number;
  status: string;
  data_diaria: string;
  created_at: string;
  updated_at: string;
  motivo_cancelamento: string | null;
  motivo_reprovacao: string | null;
  motivo_vago: string;
  demissao?: boolean | null;
  colaborador_demitido?: string | null;
  colaborador_demitido_nome?: string | null;
  observacao?: string | null;
  diarista?: Diarista | null;
  colaborador?: ColaboradorAlocado | null;
  posto?: PostoServicoResumo | null;
};

export function useDiariasTemporariasData(selectedMonth: string) {
  const monthRangeStrings = useMemo(() => getMonthRange(selectedMonth), [selectedMonth]);

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes-temporarias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, razao_social, nome_fantasia")
        .order("razao_social");
      if (error) throw error;
      return (data || []) as ClienteResumo[];
    },
  });

  const { data: diaristas = [] } = useQuery({
    queryKey: ["diaristas-temporarias"],
    queryFn: async () => {
      const { data, error } = await supabase.from("diaristas").select("*").order("nome_completo");
      if (error) throw error;
      if (!data) return [] as Diarista[];
      return (data as any[]).map((item) => ({
        id: item.id,
        nome_completo: item.nome_completo,
        cpf: item.cpf ?? null,
        cargo: item.cargo ?? null,
        status: item.status ?? null,
        banco: item.banco ?? null,
        agencia: item.agencia ?? null,
        numero_conta: item.numero_conta ?? null,
        tipo_conta: item.tipo_conta ?? null,
        pix: item.pix ?? null,
      })) as Diarista[];
    },
  });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ["colaboradores-alocados-temporarias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaboradores")
        .select(
          `
          id,
          nome_completo,
          cargo,
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
                  razao_social,
                  nome_fantasia
                )
              )
            )
          )
        `,
        )
        .not("posto_servico_id", "is", null)
        .order("nome_completo", { ascending: true });
      if (error) throw error;
      return (data || []) as ColaboradorAlocado[];
    },
  });

  const {
    data: diarias = [],
    isLoading: loadingDiarias,
    refetch: refetchDiarias,
  } = useQuery({
    queryKey: ["diarias-temporarias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diarias_temporarias")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as DiariaTemporaria[];
    },
  });

  const profileIdsFromDiarias = useMemo(() => {
    const set = new Set<string>();
    diarias.forEach((diaria) => {
      [
        diaria.criado_por,
        diaria.confirmada_por,
        diaria.aprovada_por,
        diaria.lancada_por,
        diaria.aprovado_para_pgto_por,
        diaria.paga_por,
        diaria.cancelada_por,
        diaria.reprovada_por,
      ].forEach((id) => {
        if (id) set.add(id);
      });
    });
    return Array.from(set).sort();
  }, [diarias]);

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-temporarias", profileIdsFromDiarias],
    queryFn: async () => {
      if (profileIdsFromDiarias.length === 0) return [];
      // Try RPC first (security definer bypasses restrictive RLS). Fallback to direct select.
      const rpcResult = await supabase.rpc("get_profiles_names", {
        p_ids: profileIdsFromDiarias,
      });
      if (!rpcResult.error && rpcResult.data) {
        return rpcResult.data;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", profileIdsFromDiarias);
      if (error) throw error;
      return data || [];
    },
    enabled: profileIdsFromDiarias.length > 0,
  });

  const monthRange = useMemo(() => {
    return {
      start: parseISO(monthRangeStrings.start),
      end: parseISO(monthRangeStrings.end),
    };
  }, [monthRangeStrings]);

  const filteredDiarias = useMemo(() => {
    return diarias.filter((diaria) => {
      if (!diaria.data_diaria) return false;
      try {
        return isWithinInterval(parseISO(diaria.data_diaria), monthRange);
      } catch {
        return false;
      }
    });
  }, [diarias, monthRange]);

  const diaristaMap = useMemo(() => {
    const map = new Map<string, Diarista>();
    diaristas.forEach((item) => map.set(item.id, item));
    return map;
  }, [diaristas]);

  const colaboradoresMap = useMemo(() => {
    const map = new Map<string, ColaboradorAlocado>();
    colaboradores.forEach((item) => map.set(item.id, item));
    return map;
  }, [colaboradores]);

  const postoMap = useMemo(() => {
    const map = new Map<string, PostoServicoResumo>();
    colaboradores.forEach((colaborador) => {
      if (colaborador.posto_servico_id && colaborador.posto) {
        map.set(colaborador.posto_servico_id, colaborador.posto);
      }
    });
    return map;
  }, [colaboradores]);

  const clienteMap = useMemo(() => {
    const map = new Map<number, string>();
    clientes.forEach((cliente) => {
      map.set(cliente.id, cliente.nome_fantasia || cliente.razao_social);
    });
    return map;
  }, [clientes]);

  const profileMap = useMemo(() => {
    const map = new Map<string, string>();
    profiles.forEach((profile: any) => {
      if (profile.id) {
        map.set(profile.id, profile.full_name || "");
      }
    });
    return map;
  }, [profiles]);

  return {
    clientes,
    colaboradores,
    colaboradoresMap,
    diaristas,
    diaristaMap,
    diarias,
    filteredDiarias,
    postoMap,
    clienteMap,
    profileMap,
    refetchDiarias,
    loadingDiarias,
  };
}
