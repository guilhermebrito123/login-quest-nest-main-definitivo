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
    contratos?: {
      cliente_id: string | null;
      clientes?: {
        id: string;
        razao_social: string | null;
      } | null;
    }[] | null;
  } | null;
};

export type ColaboradorAlocado = {
  id: string;
  nome_completo: string;
  cargo: string | null;
  posto_servico_id: string | null;
  posto?: PostoServicoResumo | null;
};

export type DiariaTemporaria = {
  id: number;
  diarista_id: string;
  colaborador_ausente: string | null;
  posto_servico_id: string | null;
  valor_diaria: number;
  status: string;
  data_diaria: string;
  created_at: string;
  updated_at: string;
  motivo_cancelamento: string | null;
  motivo_reprovacao: string | null;
  motivo_vago: string;
  diarista?: Diarista | null;
  colaborador?: ColaboradorAlocado | null;
  posto?: PostoServicoResumo | null;
};

export function useDiariasTemporariasData(selectedMonth: string) {
  const monthRangeStrings = useMemo(() => getMonthRange(selectedMonth), [selectedMonth]);

  const { data: diaristas = [] } = useQuery({
    queryKey: ["diaristas-temporarias"],
    queryFn: async () => {
      const { data, error } = await supabase.from("diaristas").select("*").order("nome_completo");
      if (error) throw error;
      if (!data) return [] as Diarista[];
      return (data as any[]).map((item) => ({
        id: item.id,
        nome_completo: item.nome_completo,
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
              contratos (
                cliente_id,
                clientes (
                  id,
                  razao_social
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

  return {
    colaboradores,
    colaboradoresMap,
    diaristas,
    diaristaMap,
    diarias,
    filteredDiarias,
    postoMap,
    refetchDiarias,
    loadingDiarias,
  };
}
