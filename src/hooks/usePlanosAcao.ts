import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  getDayEndInSaoPaulo,
  getDayStartInSaoPaulo,
} from "@/lib/action-plans";
import type {
  ActionPlanNonconformityClass,
  ActionPlanStatus,
} from "@/modules/checklist/types";

type ActionPlanRow = Database["public"]["Tables"]["planos_acao"]["Row"];
type ActionPlanInsert = Database["public"]["Tables"]["planos_acao"]["Insert"];
type ActionPlanUpdate = Database["public"]["Tables"]["planos_acao"]["Update"];
type ActionPlanResponsibleRow = Database["public"]["Tables"]["plano_acao_responsaveis"]["Row"];
type ActionPlanUpdateRow = Database["public"]["Tables"]["plano_acao_atualizacoes"]["Row"];
type ChecklistInstanceRow = Database["public"]["Tables"]["checklist_instancias"]["Row"];
type ChecklistReviewRow = Database["public"]["Tables"]["checklist_avaliacoes"]["Row"];
type TeamRow = Database["public"]["Tables"]["module_equipes"]["Row"];
type UserRow = Database["public"]["Tables"]["usuarios"]["Row"];

export type PlanoAcaoUsuario = Pick<UserRow, "id" | "full_name" | "email" | "role">;
export type PlanoAcaoInstanciaResumo = Pick<
  ChecklistInstanceRow,
  "id" | "titulo_snapshot" | "cost_center_id" | "prazo_em" | "status" | "exige_plano_acao"
>;
export type PlanoAcaoEquipeResumo = Pick<TeamRow, "id" | "nome" | "ativo">;
export type PlanoAcaoAvaliacaoResumo = Pick<
  ChecklistReviewRow,
  "id" | "decisao" | "plano_acao_necessario"
>;

export type PlanoAcaoResponsavelItem = ActionPlanResponsibleRow & {
  assigned_user: PlanoAcaoUsuario | null;
};

export type PlanoAcaoAtualizacaoItem = ActionPlanUpdateRow & {
  autor: PlanoAcaoUsuario | null;
};

export type PlanoAcaoListItem = ActionPlanRow & {
  instance: PlanoAcaoInstanciaResumo | null;
  team: PlanoAcaoEquipeResumo | null;
  review: PlanoAcaoAvaliacaoResumo | null;
};

export type PlanoAcaoDetalhe = PlanoAcaoListItem & {
  responsaveis: PlanoAcaoResponsavelItem[];
  updates: PlanoAcaoAtualizacaoItem[];
};

export type PlanoAcaoFilters = {
  status?: ActionPlanStatus | "all";
  classe?: ActionPlanNonconformityClass | "all";
  equipeId?: string | "all";
  prazoDe?: string;
  prazoAte?: string;
  checklistInstanciaId?: string;
  checklistAvaliacaoId?: string;
  assignedUserId?: string | null;
};

type CriarPlanoAcaoInput = Omit<ActionPlanInsert, "criado_por_user_id">;

type AtualizarPlanoAcaoInput = {
  id: string;
  values: ActionPlanUpdate;
};

type PostarAtualizacaoInput = {
  planoId: string;
  statusAnterior: ActionPlanStatus | null;
  statusNovo?: ActionPlanStatus | null;
  comentario?: string;
  progressoPercentual?: number | null;
};

type AtribuirResponsavelInput = {
  planoAcaoId: string;
  assignedUserId: string;
};

type RemoverResponsavelInput = {
  responsavelId: string;
};

const PLANOS_ACAO_LIST_SELECT = `
  id,
  checklist_instancia_id,
  checklist_avaliacao_id,
  equipe_responsavel_id,
  nao_conformidades_resumo,
  classe_nao_conformidade,
  acao_proposta,
  prazo_em,
  status,
  criado_por_user_id,
  finalizado_por_user_id,
  finalizado_em,
  created_at,
  updated_at,
  instance:checklist_instancias!planos_acao_checklist_instancia_id_fkey (
    id,
    titulo_snapshot,
    cost_center_id,
    prazo_em,
    status,
    exige_plano_acao
  ),
  review:checklist_avaliacoes!planos_acao_checklist_avaliacao_id_fkey (
    id,
    decisao,
    plano_acao_necessario
  ),
  team:module_equipes!planos_acao_equipe_responsavel_id_fkey (
    id,
    nome,
    ativo
  )
`;

const PLANO_ACAO_DETAIL_SELECT = `
  ${PLANOS_ACAO_LIST_SELECT},
  responsaveis:plano_acao_responsaveis (
    id,
    plano_acao_id,
    assigned_user_id,
    assigned_by_user_id,
    ativo,
    atribuido_em,
    assigned_user:usuarios!plano_acao_responsaveis_assigned_user_id_fkey (
      id,
      full_name,
      email,
      role
    )
  ),
  updates:plano_acao_atualizacoes (
    id,
    plano_acao_id,
    autor_user_id,
    status_anterior,
    status_novo,
    comentario,
    progresso_percentual,
    created_at,
    autor:usuarios!plano_acao_atualizacoes_autor_user_id_fkey (
      id,
      full_name,
      email,
      role
    )
  )
`;

export const planosAcaoQueryKeys = {
  all: ["planos-acao"] as const,
  list: (filters: PlanoAcaoFilters = {}) => ["planos-acao", "list", filters] as const,
  detail: (id?: string | null) => ["planos-acao", "detail", id ?? "none"] as const,
};

async function fetchAssignedPlanIds(userId: string) {
  const { data, error } = await supabase
    .from("plano_acao_responsaveis")
    .select("plano_acao_id")
    .eq("assigned_user_id", userId)
    .eq("ativo", true);

  if (error) {
    throw error;
  }

  return Array.from(new Set((data ?? []).map((item) => item.plano_acao_id)));
}

async function fetchPlanosAcao(filters: PlanoAcaoFilters = {}) {
  if (filters.assignedUserId) {
    const ids = await fetchAssignedPlanIds(filters.assignedUserId);
    if (!ids.length) {
      return [] as PlanoAcaoListItem[];
    }

    let assignedQuery = supabase
      .from("planos_acao")
      .select(PLANOS_ACAO_LIST_SELECT)
      .in("id", ids)
      .order("prazo_em", { ascending: true });

    if (filters.status && filters.status !== "all") {
      assignedQuery = assignedQuery.eq("status", filters.status);
    }

    if (filters.classe && filters.classe !== "all") {
      assignedQuery = assignedQuery.eq("classe_nao_conformidade", filters.classe);
    }

    if (filters.equipeId && filters.equipeId !== "all") {
      assignedQuery = assignedQuery.eq("equipe_responsavel_id", filters.equipeId);
    }

    if (filters.checklistInstanciaId) {
      assignedQuery = assignedQuery.eq("checklist_instancia_id", filters.checklistInstanciaId);
    }

    if (filters.checklistAvaliacaoId) {
      assignedQuery = assignedQuery.eq("checklist_avaliacao_id", filters.checklistAvaliacaoId);
    }

    if (filters.prazoDe) {
      assignedQuery = assignedQuery.gte("prazo_em", getDayStartInSaoPaulo(filters.prazoDe)!);
    }

    if (filters.prazoAte) {
      assignedQuery = assignedQuery.lte("prazo_em", getDayEndInSaoPaulo(filters.prazoAte)!);
    }

    const { data, error } = await assignedQuery;

    if (error) {
      throw error;
    }

    return (data ?? []) as PlanoAcaoListItem[];
  }

  let query = supabase
    .from("planos_acao")
    .select(PLANOS_ACAO_LIST_SELECT)
    .order("prazo_em", { ascending: true });

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters.classe && filters.classe !== "all") {
    query = query.eq("classe_nao_conformidade", filters.classe);
  }

  if (filters.equipeId && filters.equipeId !== "all") {
    query = query.eq("equipe_responsavel_id", filters.equipeId);
  }

  if (filters.checklistInstanciaId) {
    query = query.eq("checklist_instancia_id", filters.checklistInstanciaId);
  }

  if (filters.checklistAvaliacaoId) {
    query = query.eq("checklist_avaliacao_id", filters.checklistAvaliacaoId);
  }

  if (filters.prazoDe) {
    query = query.gte("prazo_em", getDayStartInSaoPaulo(filters.prazoDe)!);
  }

  if (filters.prazoAte) {
    query = query.lte("prazo_em", getDayEndInSaoPaulo(filters.prazoAte)!);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []) as PlanoAcaoListItem[];
}

async function fetchPlanoAcao(id: string) {
  const { data, error } = await supabase
    .from("planos_acao")
    .select(PLANO_ACAO_DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data ?? null) as PlanoAcaoDetalhe | null;
}

function requireUserId(userId?: string | null) {
  if (!userId) {
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  return userId;
}

async function invalidatePlanosAcao(queryClient: ReturnType<typeof useQueryClient>, id?: string | null) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: planosAcaoQueryKeys.all }),
    queryClient.invalidateQueries({ queryKey: ["checklist", "action-plans"] }),
    queryClient.invalidateQueries({ queryKey: ["checklist", "instances"] }),
    queryClient.invalidateQueries({ queryKey: ["checklist", "reviews"] }),
    id
      ? queryClient.invalidateQueries({ queryKey: planosAcaoQueryKeys.detail(id) })
      : Promise.resolve(),
  ]);
}

export function usePlanosAcao(
  filters: PlanoAcaoFilters = {},
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: planosAcaoQueryKeys.list(filters),
    queryFn: () => fetchPlanosAcao(filters),
    enabled: options?.enabled ?? true,
  });
}

export function usePlanoAcao(id?: string | null) {
  return useQuery({
    queryKey: planosAcaoQueryKeys.detail(id),
    queryFn: () => fetchPlanoAcao(id!),
    enabled: !!id,
  });
}

export function useCriarPlanoAcao() {
  const queryClient = useQueryClient();
  const { session } = useSession();

  return useMutation({
    mutationFn: async (values: CriarPlanoAcaoInput) => {
      const userId = requireUserId(session?.user?.id);
      const payload: ActionPlanInsert = {
        ...values,
        criado_por_user_id: userId,
      };

      const { data, error } = await supabase
        .from("planos_acao")
        .insert(payload)
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      return data;
    },
    onSuccess: async (result) => {
      await invalidatePlanosAcao(queryClient, result.id);
    },
  });
}

export function useAtualizarPlanoAcao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, values }: AtualizarPlanoAcaoInput) => {
      const { error } = await supabase.from("planos_acao").update(values).eq("id", id);

      if (error) {
        throw error;
      }

      return { id };
    },
    onSuccess: async ({ id }) => {
      await invalidatePlanosAcao(queryClient, id);
    },
  });
}

export function usePostarAtualizacao() {
  const queryClient = useQueryClient();
  const { session } = useSession();

  return useMutation({
    mutationFn: async ({
      planoId,
      statusAnterior,
      statusNovo,
      comentario,
      progressoPercentual,
    }: PostarAtualizacaoInput) => {
      const userId = requireUserId(session?.user?.id);
      const trimmedComment = comentario?.trim() ?? "";
      const hasComment = trimmedComment.length > 0;
      const hasStatus = typeof statusNovo === "string" && statusNovo.length > 0;
      const hasProgress =
        typeof progressoPercentual === "number" && !Number.isNaN(progressoPercentual);

      if (!hasComment && !hasStatus && !hasProgress) {
        throw new Error("Informe comentário, novo status ou progresso.");
      }

      if (hasStatus) {
        const planUpdate: ActionPlanUpdate = {
          status: statusNovo ?? undefined,
          finalizado_em: statusNovo === "done" ? new Date().toISOString() : null,
          finalizado_por_user_id: statusNovo === "done" ? userId : null,
        };

        const { error: updateError } = await supabase
          .from("planos_acao")
          .update(planUpdate)
          .eq("id", planoId);

        if (updateError) {
          throw updateError;
        }
      }

      const { error } = await supabase.from("plano_acao_atualizacoes").insert({
        plano_acao_id: planoId,
        autor_user_id: userId,
        status_anterior: statusAnterior,
        status_novo: hasStatus ? statusNovo ?? null : null,
        comentario: hasComment ? trimmedComment : null,
        progresso_percentual: hasProgress ? progressoPercentual ?? null : null,
      });

      if (error) {
        throw error;
      }

      return { planoId };
    },
    onSuccess: async ({ planoId }) => {
      await invalidatePlanosAcao(queryClient, planoId);
    },
  });
}

export function useAtribuirResponsavel() {
  const queryClient = useQueryClient();
  const { session } = useSession();

  return useMutation({
    mutationFn: async ({
      planoAcaoId,
      assignedUserId,
    }: AtribuirResponsavelInput) => {
      const userId = requireUserId(session?.user?.id);

      const { data: existingResponsavel, error: loadError } = await supabase
        .from("plano_acao_responsaveis")
        .select("id, ativo")
        .eq("plano_acao_id", planoAcaoId)
        .eq("assigned_user_id", assignedUserId)
        .maybeSingle();

      if (loadError) {
        throw loadError;
      }

      if (existingResponsavel) {
        if (existingResponsavel.ativo) {
          return { planoAcaoId };
        }

        const { error } = await supabase
          .from("plano_acao_responsaveis")
          .update({
            ativo: true,
            assigned_by_user_id: userId,
            atribuido_em: new Date().toISOString(),
          })
          .eq("id", existingResponsavel.id);

        if (error) {
          throw error;
        }

        return { planoAcaoId };
      }

      const { error } = await supabase.from("plano_acao_responsaveis").insert({
        plano_acao_id: planoAcaoId,
        assigned_user_id: assignedUserId,
        assigned_by_user_id: userId,
      });

      if (error) {
        throw error;
      }

      return { planoAcaoId };
    },
    onSuccess: async ({ planoAcaoId }) => {
      await invalidatePlanosAcao(queryClient, planoAcaoId);
    },
  });
}

export function useRemoverResponsavel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ responsavelId }: RemoverResponsavelInput) => {
      const { data: responsavel, error: loadError } = await supabase
        .from("plano_acao_responsaveis")
        .select("id, plano_acao_id")
        .eq("id", responsavelId)
        .maybeSingle();

      if (loadError) {
        throw loadError;
      }

      if (!responsavel) {
        throw new Error("Responsável não encontrado.");
      }

      const { error } = await supabase
        .from("plano_acao_responsaveis")
        .update({ ativo: false })
        .eq("id", responsavelId);

      if (error) {
        throw error;
      }

      return { planoAcaoId: responsavel.plano_acao_id };
    },
    onSuccess: async ({ planoAcaoId }) => {
      await invalidatePlanosAcao(queryClient, planoAcaoId);
    },
  });
}
