import { supabase } from "@/integrations/supabase/client";

const TIPOS_PERMITIDOS = new Set(["12x36", "6x1", "5x2", "administrativa", "personalizada"]);

const normalizeString = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
};

const normalizeTipo = (escala?: string | null) => {
  if (!escala) {
    return "personalizada";
  }
  const lower = escala.toLowerCase();
  return TIPOS_PERMITIDOS.has(lower) ? lower : "personalizada";
};

interface PostoEscalaInfo {
  id: string;
  nome: string;
  escala?: string | null;
  turno?: string | null;
  jornada?: number | null;
  horario_inicio?: string | null;
  horario_fim?: string | null;
  observacoes?: string | null;
}

export const ensureEscalaModeloFromPosto = async (posto: PostoEscalaInfo) => {
  const escalaNome = normalizeString(posto.escala) ?? "Escala Personalizada";
  const turnoNormalizado = normalizeString(posto.turno);
  const tipo = normalizeTipo(posto.escala);
  const horarioInicio = posto.horario_inicio || null;
  const horarioFim = posto.horario_fim || null;

  try {
    const { data, error } = await supabase
      .from("escalas")
      .select("id, turno, jornada, horario_inicio, horario_fim")
      .eq("nome", escalaNome)
      .eq("tipo", tipo);

    if (error) {
      console.error("Erro ao verificar escala existente:", error);
      return;
    }

    const alreadyExists = (data || []).some((escala) => {
      const turnoAtual = escala.turno || null;
      const jornadaAtual = escala.jornada ?? null;
      const inicioAtual = escala.horario_inicio || null;
      const fimAtual = escala.horario_fim || null;
      return (
        turnoAtual === turnoNormalizado &&
        jornadaAtual === (posto.jornada ?? null) &&
        inicioAtual === horarioInicio &&
        fimAtual === horarioFim
      );
    });

    if (alreadyExists) {
      return;
    }

    await supabase.from("escalas").insert({
      nome: escalaNome,
      tipo,
      turno: turnoNormalizado,
      jornada: posto.jornada ?? null,
      horario_inicio: horarioInicio,
      horario_fim: horarioFim,
      descricao:
        posto.observacoes?.slice(0, 250) ||
        `Gerada automaticamente a partir do posto ${posto.nome}`,
    });
  } catch (error) {
    console.error("Erro ao criar escala a partir do posto:", error);
  }
};
