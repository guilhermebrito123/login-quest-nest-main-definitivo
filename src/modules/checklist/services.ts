import { supabase } from "@/integrations/supabase/client";
import {
  mapChecklistActionPlan,
  mapChecklistFeedback,
  mapChecklistInstance,
  mapChecklistInstanceTask,
  mapChecklistResponsibility,
  mapChecklistReview,
  mapChecklistReviewItem,
  mapChecklistTaskStatusHistory,
  mapChecklistTeam,
  mapChecklistTeamMember,
  mapChecklistTemplate,
  mapLookupOptions,
} from "@/modules/checklist/mappers";
import type {
  ActionPlanStatus,
  ChecklistActionPlanListItem,
  ChecklistFeedbackListItem,
  ChecklistInstanceListItem,
  ChecklistInstanceStatus,
  ChecklistInstanceTaskListItem,
  ChecklistOverviewStats,
  ChecklistResponsibilityListItem,
  ChecklistReviewDecision,
  ChecklistReviewItemInsert,
  ChecklistReviewItemListItem,
  ChecklistReviewListItem,
  ChecklistTaskKanbanStatus,
  ChecklistTaskResponseInsert,
  ChecklistTaskResponsePayload,
  ChecklistTaskStatusHistoryListItem,
  ChecklistTeamListItem,
  ChecklistTeamMemberListItem,
  ChecklistTemplateListItem,
  ChecklistTemplateStatus,
  ModuleRecurrenceType,
} from "@/modules/checklist/types";

function unwrap<T>(response: { data: T; error: any }) {
  if (response.error) throw response.error;
  return response.data;
}

function mapError(error: any) {
  const message = typeof error?.message === "string" ? error.message : "Erro inesperado do Supabase.";
  return new Error(message);
}

export const checklistLookupsService = {
  async getCostCenters() {
    try {
      const data = unwrap(await supabase.from("cost_center").select("id, name").order("name"));
      return mapLookupOptions(data ?? [], (item) => item.name ?? item.id);
    } catch (error) {
      throw mapError(error);
    }
  },

  async getLocais() {
    try {
      const data = unwrap(
        await supabase.from("cost_center_locais").select("id, nome, cost_center_id").order("nome"),
      );
      return mapLookupOptions(
        data ?? [],
        (item) => item.nome ?? item.id,
        (item) => item.cost_center_id,
      );
    } catch (error) {
      throw mapError(error);
    }
  },

  async getAllowedInternalCostCenters(userId?: string | null) {
    if (!userId) return [] as string[];
    try {
      const directLinksResponse = await supabase
        .from("internal_profile_cost_centers")
        .select("cost_center_id")
        .eq("user_id", userId);

      if (!directLinksResponse.error) {
        const directIds = (directLinksResponse.data ?? []).map((item) => item.cost_center_id);
        if (directIds.length > 0) {
          return Array.from(new Set(directIds));
        }
      }

      const costCenters = unwrap(await supabase.from("cost_center").select("id"));
      const scopedCenters = await Promise.all(
        (costCenters ?? []).map(async (center) => {
          const { data, error } = await supabase.rpc("internal_user_has_cost_center_access", {
            p_user_id: userId,
            p_cost_center_id: center.id,
          });

          if (error) throw error;
          return data ? center.id : null;
        }),
      );

      return scopedCenters.filter((centerId): centerId is string => !!centerId);
    } catch (error) {
      throw mapError(error);
    }
  },

  async getUsersPublic() {
    try {
      const data = unwrap(await supabase.from("usuarios_public").select("id, full_name").order("full_name"));
      return (data ?? []).map((item) => ({
        id: item.id,
        label: item.full_name ?? item.id,
      }));
    } catch (error) {
      throw mapError(error);
    }
  },
};

export const checklistTeamsService = {
  async list() {
    try {
      const data = unwrap(
        await supabase
          .from("module_equipes")
          .select(`
            id,
            nome,
            descricao,
            criada_por_user_id,
            escopo,
            ativo,
            created_at,
            updated_at,
            cost_centers:module_equipe_cost_centers (
              id,
              equipe_id,
              cost_center_id,
              created_at,
              cost_center:cost_center!module_equipe_cost_centers_cost_center_id_fkey ( id, name )
            )
          `)
          .order("nome"),
      );

      const teams = (data ?? []).map(mapChecklistTeam);
      const members = unwrap(
        await supabase.from("module_equipe_membros").select("equipe_id, ativo"),
      );
      const counts = new Map<string, number>();
      for (const item of members ?? []) {
        if (!item.ativo) continue;
        counts.set(item.equipe_id, (counts.get(item.equipe_id) ?? 0) + 1);
      }

      return teams.map((team) => ({ ...team, members_count: counts.get(team.id) ?? 0 }));
    } catch (error) {
      throw mapError(error);
    }
  },

  async create(payload: {
    nome: string;
    descricao: string | null;
    criada_por_user_id: string;
    escopo: "global_admin" | "cost_center";
    ativo: boolean;
    cost_center_id?: string | null;
  }) {
    try {
      const created = unwrap(
        await supabase
          .from("module_equipes")
          .insert({
            nome: payload.nome,
            descricao: payload.descricao,
            criada_por_user_id: payload.criada_por_user_id,
            escopo: payload.escopo,
            ativo: payload.ativo,
          })
          .select("id")
          .single(),
      );

      if (payload.escopo === "cost_center" && payload.cost_center_id) {
        unwrap(
          await supabase.from("module_equipe_cost_centers").insert({
            equipe_id: created.id,
            cost_center_id: payload.cost_center_id,
          }),
        );
      }

      return created;
    } catch (error) {
      throw mapError(error);
    }
  },

  async update(
    teamId: string,
    payload: {
      nome: string;
      descricao: string | null;
      escopo: "global_admin" | "cost_center";
      ativo: boolean;
    },
  ) {
    try {
      return unwrap(await supabase.from("module_equipes").update(payload).eq("id", teamId));
    } catch (error) {
      throw mapError(error);
    }
  },

  async linkCostCenter(teamId: string, costCenterId: string) {
    try {
      return unwrap(
        await supabase.from("module_equipe_cost_centers").insert({
          equipe_id: teamId,
          cost_center_id: costCenterId,
        }),
      );
    } catch (error) {
      throw mapError(error);
    }
  },

  async unlinkCostCenter(linkId: string) {
    try {
      return unwrap(await supabase.from("module_equipe_cost_centers").delete().eq("id", linkId));
    } catch (error) {
      throw mapError(error);
    }
  },
};

export const checklistTeamMembersService = {
  async list(teamId: string, costCenterId?: string) {
    try {
      let query = supabase
        .from("module_equipe_membros")
        .select(`
          id,
          equipe_id,
          user_id,
          cost_center_id,
          added_by_user_id,
          ativo,
          created_at,
          updated_at,
          user:usuarios!module_equipe_membros_user_id_fkey ( id, full_name, email, role )
        `)
        .eq("equipe_id", teamId)
        .order("created_at", { ascending: true });

      if (costCenterId) {
        query = query.eq("cost_center_id", costCenterId);
      }

      const data = unwrap(await query);
      return (data ?? []).map(mapChecklistTeamMember);
    } catch (error) {
      throw mapError(error);
    }
  },

  async listEligibleCollaborators(costCenterId: string) {
    try {
      const data = unwrap(
        await supabase
          .from("colaborador_profiles")
          .select(`
            user_id,
            user:usuarios!colaborador_profiles_user_id_fkey ( id, full_name, email, role )
          `)
          .eq("ativo", true)
          .eq("cost_center_id", costCenterId),
      );

      return (data ?? []).map((item) => {
        const user = Array.isArray(item.user) ? item.user[0] : item.user;
        if (user?.role !== "colaborador") return null;
        return {
          id: item.user_id,
          label: user?.full_name ?? user?.email ?? item.user_id,
          description: user?.email ?? null,
        };
      }).filter((item): item is { id: string; label: string; description: string | null } => !!item);
    } catch (error) {
      throw mapError(error);
    }
  },

  async add(payload: {
    equipe_id: string;
    user_id: string;
    cost_center_id: string;
    added_by_user_id: string;
  }) {
    try {
      return unwrap(await supabase.from("module_equipe_membros").insert(payload));
    } catch (error) {
      throw mapError(error);
    }
  },

  async setActive(memberId: string, ativo: boolean) {
    try {
      return unwrap(await supabase.from("module_equipe_membros").update({ ativo }).eq("id", memberId));
    } catch (error) {
      throw mapError(error);
    }
  },

  async remove(memberId: string) {
    try {
      return unwrap(await supabase.from("module_equipe_membros").delete().eq("id", memberId));
    } catch (error) {
      throw mapError(error);
    }
  },
};

export const checklistTemplatesService = {
  async list() {
    try {
      const data = unwrap(
        await supabase
          .from("checklist_templates")
          .select(`
            id,
            titulo,
            descricao,
            observacao,
            criado_por_user_id,
            cost_center_id,
            local_id,
            equipe_responsavel_id,
            status,
            recorrencia,
            recorrencia_intervalo,
            inicia_em,
            encerra_em,
            prazo_padrao_horas,
            exige_plano_acao,
            versao,
            ativo,
            proxima_geracao_em,
            created_at,
            updated_at,
            cost_center:cost_center!checklist_templates_cost_center_id_fkey ( id, name ),
            local:cost_center_locais!checklist_templates_local_id_fkey ( id, nome ),
            equipe:module_equipes!checklist_templates_equipe_responsavel_id_fkey ( id, nome, ativo, escopo )
          `)
          .order("created_at", { ascending: false }),
      );

      return (data ?? []).map(mapChecklistTemplate);
    } catch (error) {
      throw mapError(error);
    }
  },

  async create(payload: {
    titulo: string;
    descricao: string | null;
    observacao: string | null;
    criado_por_user_id: string;
    cost_center_id: string;
    local_id: string;
    equipe_responsavel_id: string;
    status: ChecklistTemplateStatus;
    recorrencia: ModuleRecurrenceType;
    recorrencia_intervalo: number;
    inicia_em: string | null;
    encerra_em: string | null;
    prazo_padrao_horas: number | null;
    exige_plano_acao: boolean;
    ativo: boolean;
  }) {
    try {
      return unwrap(
        await supabase.from("checklist_templates").insert(payload).select("id").single(),
      );
    } catch (error) {
      throw mapError(error);
    }
  },

  async update(templateId: string, payload: Record<string, unknown>) {
    try {
      return unwrap(await supabase.from("checklist_templates").update(payload).eq("id", templateId));
    } catch (error) {
      throw mapError(error);
    }
  },

  async remove(templateId: string) {
    try {
      return unwrap(await supabase.from("checklist_templates").delete().eq("id", templateId));
    } catch (error) {
      throw mapError(error);
    }
  },
};

export const checklistTemplateTasksService = {
  async list(templateId: string) {
    try {
      const data = unwrap(
        await supabase
          .from("checklist_template_tarefas")
          .select("*")
          .eq("checklist_template_id", templateId)
          .order("ordem"),
      );
      return data ?? [];
    } catch (error) {
      throw mapError(error);
    }
  },

  async create(payload: Record<string, unknown>) {
    try {
      return unwrap(await supabase.from("checklist_template_tarefas").insert(payload));
    } catch (error) {
      throw mapError(error);
    }
  },

  async update(taskId: string, payload: Record<string, unknown>) {
    try {
      return unwrap(await supabase.from("checklist_template_tarefas").update(payload).eq("id", taskId));
    } catch (error) {
      throw mapError(error);
    }
  },

  async remove(taskId: string) {
    try {
      return unwrap(await supabase.from("checklist_template_tarefas").delete().eq("id", taskId));
    } catch (error) {
      throw mapError(error);
    }
  },
};

export const checklistInstancesService = {
  async list() {
    try {
      const data = unwrap(
        await supabase
          .from("checklist_instancias")
          .select(`
            id,
            checklist_template_id,
            template_versao,
            titulo_snapshot,
            descricao_snapshot,
            observacao_snapshot,
            criado_por_user_id,
            cost_center_id,
            local_id,
            agendado_para,
            prazo_em,
            status,
            exige_plano_acao,
            finalizado_por_user_id,
            finalizado_em,
            created_at,
            updated_at,
            template:checklist_templates!checklist_instancias_checklist_template_id_fkey (
              id,
              titulo,
              status,
              versao,
              equipe_responsavel_id,
              equipe:module_equipes!checklist_templates_equipe_responsavel_id_fkey (
                id,
                nome,
                ativo,
                escopo
              )
            ),
            cost_center:cost_center!checklist_instancias_cost_center_id_fkey ( id, name ),
            local:cost_center_locais!checklist_instancias_local_id_fkey ( id, nome )
          `)
          .order("created_at", { ascending: false }),
      );

      return (data ?? []).map(mapChecklistInstance);
    } catch (error) {
      throw mapError(error);
    }
  },

  async create(payload: Record<string, unknown>) {
    try {
      return unwrap(await supabase.from("checklist_instancias").insert(payload).select("id").single());
    } catch (error) {
      throw mapError(error);
    }
  },

  async update(instanceId: string, payload: Record<string, unknown>) {
    try {
      return unwrap(await supabase.from("checklist_instancias").update(payload).eq("id", instanceId));
    } catch (error) {
      throw mapError(error);
    }
  },
};

export const checklistInstanceTasksService = {
  async list(instanceId: string) {
    try {
      const data = unwrap(
        await supabase
          .from("checklist_instancia_tarefas")
          .select(`
            id,
            checklist_instancia_id,
            checklist_template_tarefa_id,
            titulo_snapshot,
            descricao_snapshot,
            ajuda_snapshot,
            ordem,
            tipo_resposta_snapshot,
            obrigatoria,
            permite_comentario,
            permite_anexo,
            nota_min,
            nota_max,
            config_json_snapshot,
            created_at,
            responsaveis:checklist_tarefa_responsaveis (
              id,
              checklist_instancia_tarefa_id,
              assigned_user_id,
              assigned_by_user_id,
              status_kanban,
              pode_alterar_status,
              ativo,
              atribuida_em,
              concluida_em,
              assigned_user:usuarios!checklist_tarefa_responsaveis_assigned_user_id_fkey (
                id,
                full_name,
                email
              )
            )
          `)
          .eq("checklist_instancia_id", instanceId)
          .order("ordem"),
      );

      return (data ?? []).map(mapChecklistInstanceTask);
    } catch (error) {
      throw mapError(error);
    }
  },
};

export const checklistResponsibilitiesService = {
  async listActive() {
    try {
      const data = unwrap(
        await supabase
          .from("checklist_tarefa_responsaveis")
          .select(`
            id,
            checklist_instancia_tarefa_id,
            assigned_user_id,
            assigned_by_user_id,
            status_kanban,
            pode_alterar_status,
            ativo,
            atribuida_em,
            concluida_em,
            assigned_user:usuarios!checklist_tarefa_responsaveis_assigned_user_id_fkey (
              id,
              full_name,
              email
            ),
            task:checklist_instancia_tarefas!checklist_tarefa_responsaveis_checklist_instancia_tarefa_i_fkey (
              id,
              checklist_instancia_id,
              checklist_template_tarefa_id,
              titulo_snapshot,
              descricao_snapshot,
              ajuda_snapshot,
              ordem,
              tipo_resposta_snapshot,
              obrigatoria,
              permite_comentario,
              permite_anexo,
              nota_min,
              nota_max,
              config_json_snapshot,
              created_at,
              instance:checklist_instancias!checklist_instancia_tarefas_checklist_instancia_id_fkey (
                id,
                titulo_snapshot,
                status,
                prazo_em,
                cost_center_id
              )
            )
          `)
          .eq("ativo", true)
          .order("atribuida_em", { ascending: false }),
      );

      return (data ?? []).map(mapChecklistResponsibility);
    } catch (error) {
      throw mapError(error);
    }
  },

  async listArchived(limit = 100) {
    try {
      const data = unwrap(
        await supabase
          .from("checklist_tarefa_responsaveis")
          .select(`
            id,
            checklist_instancia_tarefa_id,
            assigned_user_id,
            assigned_by_user_id,
            status_kanban,
            pode_alterar_status,
            ativo,
            atribuida_em,
            concluida_em,
            assigned_user:usuarios!checklist_tarefa_responsaveis_assigned_user_id_fkey (
              id,
              full_name,
              email
            ),
            task:checklist_instancia_tarefas!checklist_tarefa_responsaveis_checklist_instancia_tarefa_i_fkey (
              id,
              checklist_instancia_id,
              checklist_template_tarefa_id,
              titulo_snapshot,
              descricao_snapshot,
              ajuda_snapshot,
              ordem,
              tipo_resposta_snapshot,
              obrigatoria,
              permite_comentario,
              permite_anexo,
              nota_min,
              nota_max,
              config_json_snapshot,
              created_at,
              instance:checklist_instancias!checklist_instancia_tarefas_checklist_instancia_id_fkey (
                id,
                titulo_snapshot,
                status,
                prazo_em,
                cost_center_id
              )
            )
          `)
          .eq("ativo", false)
          .order("atribuida_em", { ascending: false })
          .limit(limit),
      );

      return (data ?? []).map(mapChecklistResponsibility);
    } catch (error) {
      throw mapError(error);
    }
  },

  async updateKanbanStatus(responsibilityId: string, status: ChecklistTaskKanbanStatus) {
    try {
      return unwrap(
        await supabase
          .from("checklist_tarefa_responsaveis")
          .update({ status_kanban: status })
          .eq("id", responsibilityId),
      );
    } catch (error) {
      throw mapError(error);
    }
  },

  async setActive(responsibilityId: string, ativo: boolean, status_kanban?: ChecklistTaskKanbanStatus) {
    try {
      const payload: Record<string, unknown> = { ativo };
      if (status_kanban) payload.status_kanban = status_kanban;
      return unwrap(
        await supabase
          .from("checklist_tarefa_responsaveis")
          .update(payload)
          .eq("id", responsibilityId),
      );
    } catch (error) {
      throw mapError(error);
    }
  },

  async checkKanbanPermission(userId: string, taskId: string) {
    try {
      const data = unwrap(
        await supabase.rpc("can_change_checklist_task_kanban", {
          _user_id: userId,
          _instancia_tarefa_id: taskId,
        }),
      );
      return !!data;
    } catch (error) {
      throw mapError(error);
    }
  },

  async listHistoryByInstance(instanceId: string): Promise<ChecklistTaskStatusHistoryListItem[]> {
    try {
      const tasks = unwrap(
        await supabase
          .from("checklist_instancia_tarefas")
          .select("id")
          .eq("checklist_instancia_id", instanceId),
      );

      const taskIds = (tasks ?? []).map((item) => item.id);
      if (!taskIds.length) return [];

      const data = unwrap(
        await supabase
          .from("checklist_tarefa_status_historico")
          .select(`
            id,
            checklist_instancia_tarefa_id,
            status_anterior,
            status_novo,
            motivo,
            changed_by_user_id,
            assigned_user_id,
            created_at,
            changed_by:usuarios!checklist_tarefa_status_historico_changed_by_user_id_fkey (
              id,
              full_name,
              email
            ),
            assigned_user:usuarios!checklist_tarefa_status_historico_assigned_user_id_fkey (
              id,
              full_name,
              email
            ),
            task:checklist_instancia_tarefas!checklist_tarefa_status_histo_checklist_instancia_tarefa_i_fkey (
              id,
              titulo_snapshot,
              checklist_instancia_id
            )
          `)
          .in("checklist_instancia_tarefa_id", taskIds)
          .order("created_at", { ascending: false }),
      );

      return (data ?? []).map(mapChecklistTaskStatusHistory);
    } catch (error) {
      throw mapError(error);
    }
  },
};

export const checklistResponsesService = {
  async getLatestByResponsibility(responsibilityId: string) {
    try {
      const data = unwrap(
        await supabase
          .from("checklist_tarefa_respostas")
          .select(`
            id,
            checklist_instancia_tarefa_id,
            tarefa_responsavel_id,
            respondido_por_user_id,
            resposta_texto,
            resposta_numero,
            resposta_boolean,
            resposta_data,
            resposta_datetime,
            resposta_json,
            comentario_resposta,
            created_at,
            updated_at
          `)
          .eq("tarefa_responsavel_id", responsibilityId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      );
      return data ?? null;
    } catch (error) {
      throw mapError(error);
    }
  },

  async save(args: {
    existingId?: string | null;
    checklist_instancia_tarefa_id: string;
    tarefa_responsavel_id: string;
    respondido_por_user_id: string;
    payload: ChecklistTaskResponsePayload;
  }) {
    const insertPayload: ChecklistTaskResponseInsert = {
      checklist_instancia_tarefa_id: args.checklist_instancia_tarefa_id,
      tarefa_responsavel_id: args.tarefa_responsavel_id,
      respondido_por_user_id: args.respondido_por_user_id,
      ...args.payload,
    };

    try {
      if (args.existingId) {
        return unwrap(
          await supabase.from("checklist_tarefa_respostas").update(insertPayload).eq("id", args.existingId),
        );
      }

      return unwrap(await supabase.from("checklist_tarefa_respostas").insert(insertPayload));
    } catch (error) {
      throw mapError(error);
    }
  },
};

export const checklistReviewsService = {
  async list() {
    try {
      const data = unwrap(
        await supabase
          .from("checklist_avaliacoes")
          .select(`
            id,
            checklist_instancia_id,
            avaliado_por_user_id,
            decisao,
            comentario_avaliacao,
            plano_acao_necessario,
            avaliado_em,
            created_at,
            instance:checklist_instancias!checklist_avaliacoes_checklist_instancia_id_fkey (
              id,
              titulo_snapshot,
              status,
              cost_center_id
            ),
            reviewer:usuarios!checklist_avaliacoes_avaliado_por_user_id_fkey (
              id,
              full_name,
              email
            )
          `)
          .order("avaliado_em", { ascending: false }),
      );

      return (data ?? []).map(mapChecklistReview);
    } catch (error) {
      throw mapError(error);
    }
  },

  async getByInstance(instanceId: string) {
    try {
      const data = unwrap(
        await supabase
          .from("checklist_avaliacoes")
          .select(`
            id,
            checklist_instancia_id,
            avaliado_por_user_id,
            decisao,
            comentario_avaliacao,
            plano_acao_necessario,
            avaliado_em,
            created_at,
            instance:checklist_instancias!checklist_avaliacoes_checklist_instancia_id_fkey (
              id,
              titulo_snapshot,
              status,
              cost_center_id
            ),
            reviewer:usuarios!checklist_avaliacoes_avaliado_por_user_id_fkey (
              id,
              full_name,
              email
            )
          `)
          .eq("checklist_instancia_id", instanceId)
          .maybeSingle(),
      );

      return data ? mapChecklistReview(data) : null;
    } catch (error) {
      throw mapError(error);
    }
  },

  async upsertReview(args: {
    reviewId?: string | null;
    instanceId: string;
    avaliadoPorUserId: string;
    decisao: ChecklistReviewDecision;
    comentarioAvaliacao: string | null;
    planoAcaoNecessario: boolean;
  }) {
    try {
      if (args.reviewId) {
        return unwrap(
          await supabase
            .from("checklist_avaliacoes")
            .update({
              decisao: args.decisao,
              comentario_avaliacao: args.comentarioAvaliacao,
              plano_acao_necessario: args.planoAcaoNecessario,
            })
            .eq("id", args.reviewId),
        );
      }

      return unwrap(
        await supabase
          .from("checklist_avaliacoes")
          .insert({
            checklist_instancia_id: args.instanceId,
            avaliado_por_user_id: args.avaliadoPorUserId,
            decisao: args.decisao,
            comentario_avaliacao: args.comentarioAvaliacao,
            plano_acao_necessario: args.planoAcaoNecessario,
          })
          .select("id")
          .single(),
      );
    } catch (error) {
      throw mapError(error);
    }
  },

  async listItems(reviewId: string) {
    try {
      const data = unwrap(
        await supabase
          .from("checklist_avaliacao_itens")
          .select(`
            id,
            checklist_avaliacao_id,
            checklist_instancia_tarefa_id,
            resultado_conformidade,
            nota,
            feedback,
            created_at,
            task:checklist_instancia_tarefas!checklist_avaliacao_itens_checklist_instancia_tarefa_id_fkey (
              id,
              titulo_snapshot,
              ordem,
              tipo_resposta_snapshot
            )
          `)
          .eq("checklist_avaliacao_id", reviewId),
      );

      return (data ?? []).map(mapChecklistReviewItem);
    } catch (error) {
      throw mapError(error);
    }
  },

  async upsertItems(reviewId: string, items: ChecklistReviewItemInsert[]) {
    try {
      const normalizedItems = items.map((item) => ({
        ...item,
        checklist_avaliacao_id: reviewId,
      }));
      const itemsToUpdate = normalizedItems.filter(
        (item): item is ChecklistReviewItemInsert & { id: string } => typeof item.id === "string" && item.id.length > 0,
      );
      const itemsToInsert = normalizedItems.map((item) => {
        if (typeof item.id === "string" && item.id.length > 0) {
          return null;
        }

        const { id: _ignoredId, ...insertPayload } = item;
        return insertPayload;
      }).filter(Boolean) as ChecklistReviewItemInsert[];

      const results = await Promise.all([
        ...itemsToUpdate.map((item) => {
          const { id, ...payload } = item;
          return supabase
            .from("checklist_avaliacao_itens")
            .update(payload)
            .eq("id", id)
            .then(unwrap);
        }),
        itemsToInsert.length
          ? supabase
              .from("checklist_avaliacao_itens")
              .insert(itemsToInsert)
              .then(unwrap)
          : Promise.resolve(null),
      ]);

      return results;
    } catch (error) {
      throw mapError(error);
    }
  },
};

export const checklistFeedbacksService = {
  async listAll() {
    try {
      const data = unwrap(
        await supabase
          .from("checklist_feedbacks")
          .select(`
            id,
            checklist_instancia_tarefa_id,
            checklist_avaliacao_item_id,
            autor_user_id,
            destinatario_user_id,
            mensagem,
            ciente,
            ciente_em,
            created_at,
            autor:usuarios!checklist_feedbacks_autor_user_id_fkey (
              id,
              full_name,
              email
            ),
            destinatario:usuarios!checklist_feedbacks_destinatario_user_id_fkey (
              id,
              full_name,
              email
            ),
            task:checklist_instancia_tarefas!checklist_feedbacks_checklist_instancia_tarefa_id_fkey (
              id,
              titulo_snapshot,
              checklist_instancia_id,
              instance:checklist_instancias!checklist_instancia_tarefas_checklist_instancia_id_fkey (
                id,
                titulo_snapshot,
                cost_center_id
              )
            ),
            avaliacao_item:checklist_avaliacao_itens!checklist_feedbacks_checklist_avaliacao_item_id_fkey (
              id,
              resultado_conformidade,
              nota
            )
          `)
          .order("created_at", { ascending: false }),
      );

      return (data ?? []).map(mapChecklistFeedback);
    } catch (error) {
      throw mapError(error);
    }
  },

  async listByTask(taskId: string) {
    const items = await this.listAll();
    return items.filter((item) => item.checklist_instancia_tarefa_id === taskId);
  },

  async createManual(payload: {
    checklist_instancia_tarefa_id: string;
    autor_user_id: string;
    destinatario_user_id: string;
    mensagem: string;
  }) {
    try {
      return unwrap(await supabase.from("checklist_feedbacks").insert(payload));
    } catch (error) {
      throw mapError(error);
    }
  },

  async markAware(feedbackId: string) {
    try {
      return unwrap(
        await supabase
          .from("checklist_feedbacks")
          .update({
            ciente: true,
            ciente_em: new Date().toISOString(),
          })
          .eq("id", feedbackId),
      );
    } catch (error) {
      throw mapError(error);
    }
  },
};

export const checklistActionPlansService = {
  async list() {
    try {
      const data = unwrap(
        await supabase
          .from("planos_acao")
          .select(`
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
              status,
              cost_center_id
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
            ),
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
                email
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
                email
              )
            )
          `)
          .order("created_at", { ascending: false }),
      );

      return (data ?? []).map(mapChecklistActionPlan);
    } catch (error) {
      throw mapError(error);
    }
  },

  async create(payload: Record<string, unknown>) {
    try {
      return unwrap(await supabase.from("planos_acao").insert(payload).select("id").single());
    } catch (error) {
      throw mapError(error);
    }
  },

  async updateStatus(planId: string, status: ActionPlanStatus) {
    try {
      return unwrap(await supabase.from("planos_acao").update({ status }).eq("id", planId));
    } catch (error) {
      throw mapError(error);
    }
  },

  async addResponsible(payload: {
    plano_acao_id: string;
    assigned_user_id: string;
    assigned_by_user_id: string;
  }) {
    try {
      return unwrap(await supabase.from("plano_acao_responsaveis").insert(payload));
    } catch (error) {
      throw mapError(error);
    }
  },

  async removeResponsible(responsibleId: string) {
    try {
      return unwrap(await supabase.from("plano_acao_responsaveis").delete().eq("id", responsibleId));
    } catch (error) {
      throw mapError(error);
    }
  },

  async addUpdate(payload: {
    plano_acao_id: string;
    autor_user_id: string;
    status_anterior: ActionPlanStatus | null;
    status_novo: ActionPlanStatus | null;
    comentario: string | null;
    progresso_percentual: number | null;
  }) {
    try {
      return unwrap(await supabase.from("plano_acao_atualizacoes").insert(payload));
    } catch (error) {
      throw mapError(error);
    }
  },
};

export const checklistOverviewService = {
  async loadStats(): Promise<ChecklistOverviewStats> {
    try {
      const [
        templates,
        instancias,
        tarefasPendentes,
        tarefasBloqueadas,
        tarefasFechadas,
        feedbacksPendentes,
        planosAbertos,
      ] = await Promise.all([
        supabase.from("checklist_templates").select("id", { count: "exact", head: true }).eq("ativo", true),
        supabase
          .from("checklist_instancias")
          .select("id", { count: "exact", head: true })
          .in("status", ["open", "in_progress", "submitted", "under_review"]),
        supabase
          .from("checklist_tarefa_responsaveis")
          .select("id", { count: "exact", head: true })
          .eq("ativo", true)
          .in("status_kanban", ["pending", "doing"]),
        supabase
          .from("checklist_tarefa_responsaveis")
          .select("id", { count: "exact", head: true })
          .eq("ativo", true)
          .eq("status_kanban", "blocked"),
        supabase
          .from("checklist_tarefa_responsaveis")
          .select("id", { count: "exact", head: true })
          .eq("status_kanban", "closed"),
        supabase
          .from("checklist_feedbacks")
          .select("id", { count: "exact", head: true })
          .eq("ciente", false),
        supabase
          .from("planos_acao")
          .select("id", { count: "exact", head: true })
          .in("status", ["open", "in_progress", "waiting_validation"]),
      ]);

      const firstError =
        templates.error ??
        instancias.error ??
        tarefasPendentes.error ??
        tarefasBloqueadas.error ??
        tarefasFechadas.error ??
        feedbacksPendentes.error ??
        planosAbertos.error;

      if (firstError) throw firstError;

      return {
        templates: templates.count ?? 0,
        instanciasAbertas: instancias.count ?? 0,
        tarefasPendentes: tarefasPendentes.count ?? 0,
        tarefasBloqueadas: tarefasBloqueadas.count ?? 0,
        tarefasFechadas: tarefasFechadas.count ?? 0,
        feedbacksPendentes: feedbacksPendentes.count ?? 0,
        planosAbertos: planosAbertos.count ?? 0,
      };
    } catch (error) {
      throw mapError(error);
    }
  },
};
