import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";

import { ChecklistField } from "@/components/checklist/ChecklistField";
import { ChecklistModuleLayout } from "@/components/checklist/ChecklistModuleLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import {
  canViewChecklistAudit,
  checklistTaskKanbanStatusLabels,
} from "@/lib/checklist-module";
import { useChecklistSupervisorScope } from "@/modules/checklist/hooks";

type AuditLogRecord = {
  id: string;
  entity_name: string;
  entity_id: string;
  action_name: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  actor?: { id: string; full_name: string | null } | null;
};

type KanbanHistoryRecord = {
  id: string;
  created_at: string;
  status_anterior: keyof typeof checklistTaskKanbanStatusLabels | null;
  status_novo: keyof typeof checklistTaskKanbanStatusLabels;
  motivo: string | null;
  changed_by?: { id: string; full_name: string | null } | null;
  assigned_user?: { id: string; full_name: string | null } | null;
  task?: { id: string; titulo_snapshot: string } | null;
};

const checklistEntityOptions = [
  "module_equipes",
  "module_equipe_cost_centers",
  "module_equipe_membros",
  "checklist_templates",
  "checklist_template_tarefas",
  "checklist_instancias",
  "checklist_tarefa_responsaveis",
  "checklist_tarefa_respostas",
  "checklist_avaliacoes",
  "checklist_avaliacao_itens",
  "checklist_feedbacks",
  "planos_acao",
  "plano_acao_responsaveis",
  "plano_acao_atualizacoes",
] as const;

export default function ChecklistAuditPage() {
  const { supervisorContext } = useChecklistSupervisorScope();
  const [loading, setLoading] = useState(true);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [kanbanHistory, setKanbanHistory] = useState<KanbanHistoryRecord[]>([]);
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadAudit() {
      if (!canViewChecklistAudit(supervisorContext)) {
        if (mounted) setLoading(false);
        return;
      }

      try {
        const [auditResult, kanbanResult] = await Promise.all([
          supabase
            .from("module_audit_logs")
            .select(`
              id,
              entity_name,
              entity_id,
              action_name,
              created_at,
              metadata,
              old_data,
              new_data,
              actor:usuarios!module_audit_logs_actor_user_id_fkey ( id, full_name )
            `)
            .order("created_at", { ascending: false })
            .limit(200),
          supabase
            .from("checklist_tarefa_status_historico")
            .select(`
              id,
              created_at,
              status_anterior,
              status_novo,
              motivo,
              changed_by:usuarios!checklist_tarefa_status_historico_changed_by_user_id_fkey ( id, full_name ),
              assigned_user:usuarios!checklist_tarefa_status_historico_assigned_user_id_fkey ( id, full_name ),
              task:checklist_instancia_tarefas!checklist_tarefa_status_histo_checklist_instancia_tarefa_i_fkey ( id, titulo_snapshot )
            `)
            .order("created_at", { ascending: false })
            .limit(200),
        ]);

        if (auditResult.error) throw auditResult.error;
        if (kanbanResult.error) throw kanbanResult.error;
        if (!mounted) return;

        setAuditLogs((auditResult.data || []) as unknown as AuditLogRecord[]);
        setKanbanHistory((kanbanResult.data || []) as unknown as KanbanHistoryRecord[]);
      } catch (error) {
        console.error("Erro ao carregar auditoria do checklist:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadAudit();

    return () => {
      mounted = false;
    };
  }, [supervisorContext]);

  const filteredAuditLogs = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return auditLogs.filter((item) => {
      const matchesEntity = entityFilter === "all" || item.entity_name === entityFilter;
      if (!matchesEntity) return false;

      if (!normalizedSearch) return true;

      return (
        item.entity_name.toLowerCase().includes(normalizedSearch) ||
        item.action_name.toLowerCase().includes(normalizedSearch) ||
        item.entity_id.toLowerCase().includes(normalizedSearch) ||
        item.actor?.full_name?.toLowerCase().includes(normalizedSearch) ||
        JSON.stringify(item.metadata || {}).toLowerCase().includes(normalizedSearch)
      );
    });
  }, [auditLogs, entityFilter, search]);

  async function reloadAudit() {
    setLoading(true);
    try {
      const [auditResult, kanbanResult] = await Promise.all([
        supabase
          .from("module_audit_logs")
          .select(`
            id,
            entity_name,
            entity_id,
            action_name,
            created_at,
            metadata,
            old_data,
            new_data,
            actor:usuarios!module_audit_logs_actor_user_id_fkey ( id, full_name )
          `)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("checklist_tarefa_status_historico")
          .select(`
            id,
            created_at,
            status_anterior,
            status_novo,
            motivo,
            changed_by:usuarios!checklist_tarefa_status_historico_changed_by_user_id_fkey ( id, full_name ),
            assigned_user:usuarios!checklist_tarefa_status_historico_assigned_user_id_fkey ( id, full_name ),
            task:checklist_instancia_tarefas!checklist_tarefa_status_histo_checklist_instancia_tarefa_i_fkey ( id, titulo_snapshot )
          `)
          .order("created_at", { ascending: false })
          .limit(200),
      ]);

      if (auditResult.error) throw auditResult.error;
      if (kanbanResult.error) throw kanbanResult.error;

      setAuditLogs((auditResult.data || []) as unknown as AuditLogRecord[]);
      setKanbanHistory((kanbanResult.data || []) as unknown as KanbanHistoryRecord[]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ChecklistModuleLayout
      title="Auditoria"
      description="Consulte os rastros das tabelas estruturais do módulo e o histórico específico das mudanças de status no kanban."
      currentPath="/checklists/auditoria"
      canAccessPage={canViewChecklistAudit}
      actions={
        <Button variant="outline" onClick={() => void reloadAudit()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Refine os registros para localizar mudanças de estrutura, conteúdo e operação.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[1fr_280px]">
          <div className="space-y-2">
            <ChecklistField
              label="Busca geral"
              tooltip="Procura por entidade, ação, identificador, ator e metadados resumidos."
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ex.: checklist_templates, update, supervisor, equipe"
            />
          </div>
          <div className="space-y-2">
            <ChecklistField
              label="Entidade"
              tooltip="Filtra a tabela auditada para focar só no trecho do fluxo que você quer revisar."
            />
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma entidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as entidades</SelectItem>
                {checklistEntityOptions.map((entity) => (
                  <SelectItem key={entity} value={entity}>
                    {entity}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Auditoria estrutural</CardTitle>
            <CardDescription>
              Registros do `module_audit_logs` para equipes, templates, instâncias, tarefas, feedbacks e planos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Entidade</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Ator</TableHead>
                    <TableHead>Registro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Carregando auditoria...
                      </TableCell>
                    </TableRow>
                  ) : filteredAuditLogs.length ? (
                    filteredAuditLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{new Date(log.created_at).toLocaleString("pt-BR")}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.entity_name}</Badge>
                        </TableCell>
                        <TableCell>{log.action_name}</TableCell>
                        <TableCell>{log.actor?.full_name || "-"}</TableCell>
                        <TableCell className="max-w-[380px]">
                          <div className="space-y-1 text-sm">
                            <div className="font-medium">{log.entity_id}</div>
                            <div className="line-clamp-2 text-muted-foreground">
                              {JSON.stringify(log.metadata || log.new_data || log.old_data || {})}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Nenhum registro encontrado com os filtros atuais.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Histórico do kanban</CardTitle>
            <CardDescription>
              Mudanças de coluna registradas em `checklist_tarefa_status_historico`.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {loading ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Carregando histórico do kanban...
                </div>
              ) : kanbanHistory.length ? (
                kanbanHistory.map((item) => (
                  <div key={item.id} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">
                        {item.status_anterior
                          ? checklistTaskKanbanStatusLabels[item.status_anterior]
                          : "Sem status anterior"}
                      </Badge>
                      <span className="text-sm text-muted-foreground">→</span>
                      <Badge>{checklistTaskKanbanStatusLabels[item.status_novo]}</Badge>
                    </div>
                    <div className="mt-2 space-y-1 text-sm">
                      <p className="font-medium">{item.task?.titulo_snapshot || "Tarefa não identificada"}</p>
                      <p className="text-muted-foreground">
                        Responsável: {item.assigned_user?.full_name || "-"}
                      </p>
                      <p className="text-muted-foreground">
                        Alterado por: {item.changed_by?.full_name || "-"}
                      </p>
                      <p className="text-muted-foreground">
                        {new Date(item.created_at).toLocaleString("pt-BR")}
                      </p>
                      {item.motivo ? <p className="text-muted-foreground">Motivo: {item.motivo}</p> : null}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Nenhuma movimentação de kanban encontrada.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </ChecklistModuleLayout>
  );
}
