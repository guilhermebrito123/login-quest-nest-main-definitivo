import { supabase } from "@/integrations/supabase/client";

interface AgendarOcupacaoParams {
  postoId: string;
  colaboradorId: string;
  data: string;
  usuarioId?: string | null;
}

export const agendarOcupacaoPosto = async ({
  postoId,
  colaboradorId,
  data,
  usuarioId = null,
}: AgendarOcupacaoParams) => {
  const { error } = await supabase.rpc("agendar_ocupacao_posto", {
    p_posto_servico_id: postoId,
    p_colaborador_id: colaboradorId,
    p_data: data,
    p_usuario_id: usuarioId,
  });

  if (error) throw error;
};
