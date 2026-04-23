import { useEffect, useMemo } from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import {
  ChecklistAccessStateCard,
  ChecklistModuleLayout,
} from "@/components/checklist/ChecklistModuleLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAccessContext } from "@/hooks/useAccessContext";
import {
  canEditChecklistRecord,
  canViewChecklistTasks,
  filterChecklistInstancesByScope,
  getChecklistPermissionMessage,
  isChecklistPermissionError,
} from "@/lib/checklist-module";
import {
  checklistInstanceStatusLabels,
  isChecklistTaskAnswered,
  isEditableInstance,
} from "@/modules/checklist/helpers";
import {
  useChecklistInstances,
  useChecklistSupervisorScope,
  useFinalizarChecklistInstancia,
  useTarefasDaInstancia,
} from "@/modules/checklist/hooks";
import { ChecklistInstanceStatusBadge, TarefaResponderCard } from "@/modules/checklist/components";

export default function ResponderChecklistPage() {
  const { accessContext } = useAccessContext();
  const { supervisorContext } = useChecklistSupervisorScope();
  const { data: instances = [], error: instancesError, isLoading: loadingInstances, refetch } =
    useChecklistInstances();
  const [searchParams, setSearchParams] = useSearchParams();

  const scopedInstances = useMemo(
    () => filterChecklistInstancesByScope(instances, supervisorContext),
    [instances, supervisorContext],
  );

  const selectedInstanceId = searchParams.get("instancia") ?? "";
  const selectedInstance = useMemo(
    () =>
      scopedInstances.find((instance) => instance.id === selectedInstanceId) ??
      scopedInstances[0] ??
      null,
    [scopedInstances, selectedInstanceId],
  );

  useEffect(() => {
    if (!selectedInstance && scopedInstances.length === 0) return;
    if (!selectedInstanceId && scopedInstances[0]) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("instancia", scopedInstances[0].id);
      setSearchParams(nextParams, { replace: true });
    }
  }, [scopedInstances, searchParams, selectedInstance, selectedInstanceId, setSearchParams]);

  const instanceId = selectedInstance?.id ?? "";
  const {
    data: tarefas = [],
    error: tarefasError,
    isLoading: loadingTarefas,
    refetch: refetchTarefas,
  } = useTarefasDaInstancia(instanceId);

  const finalizeChecklist = useFinalizarChecklistInstancia();
  const instanceEditable = selectedInstance ? isEditableInstance(selectedInstance.status) : false;
  const canManageSelectedInstance = selectedInstance
    ? canEditChecklistRecord(supervisorContext, selectedInstance.cost_center_id)
    : false;

  const requiredPendingCount = useMemo(
    () => tarefas.filter((task) => task.obrigatoria && !isChecklistTaskAnswered(task)).length,
    [tarefas],
  );

  const loadError = instancesError ?? tarefasError;
  const canFinalize =
    !!selectedInstance &&
    !!tarefas.length &&
    instanceEditable &&
    canManageSelectedInstance &&
    requiredPendingCount === 0 &&
    accessContext.role !== "perfil_interno";
  const pageTitle =
    accessContext.role === "perfil_interno" ? "Respostas do Checklist" : "Responder Checklist";
  const pageDescription =
    accessContext.role === "perfil_interno"
      ? "Consulte as respostas registradas na instancia a partir do snapshot das tarefas."
      : "Responda as tarefas a partir do snapshot da instancia, com comentarios e anexos vinculados a resposta efetiva.";

  async function handleRefresh() {
    await Promise.all([refetch(), refetchTarefas()]);
  }

  async function handleFinalize() {
    if (!selectedInstance) return;

    if (requiredPendingCount > 0) {
      toast.error("Preencha todas as tarefas obrigatorias antes de finalizar.");
      return;
    }

    try {
      await finalizeChecklist.mutateAsync(selectedInstance.id);
      toast.success("Checklist finalizado e enviado para a proxima etapa.");
    } catch (error) {
      toast.error(
        isChecklistPermissionError(error)
          ? getChecklistPermissionMessage("finalizar o checklist")
          : error instanceof Error
            ? error.message
            : "Nao foi possivel finalizar o checklist.",
      );
    }
  }

  return (
    <ChecklistModuleLayout
      title={pageTitle}
      description={pageDescription}
      currentPath="/checklists/tarefas"
      canAccessPage={canViewChecklistTasks}
      actions={
        <Button variant="outline" onClick={() => void handleRefresh()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      }
    >
      {loadError && isChecklistPermissionError(loadError) ? (
        <ChecklistAccessStateCard
          title="Leitura bloqueada pelo banco"
          description="O Supabase rejeitou o carregamento da instancia ou das tarefas para o seu escopo atual."
        />
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-4">
                <div>
                  <CardTitle>Instancia alvo</CardTitle>
                  <CardDescription>
                    O frontend usa apenas os campos snapshot da instancia para renderizar e validar as respostas.
                  </CardDescription>
                </div>

                <div className="w-full max-w-md">
                  <Select
                    value={selectedInstance?.id ?? ""}
                    onValueChange={(value) => {
                      const nextParams = new URLSearchParams(searchParams);
                      nextParams.set("instancia", value);
                      setSearchParams(nextParams);
                    }}
                    disabled={!scopedInstances.length}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma instancia" />
                    </SelectTrigger>
                    <SelectContent>
                      {scopedInstances.map((instance) => (
                        <SelectItem key={instance.id} value={instance.id}>
                          {instance.titulo_snapshot}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {selectedInstance ? (
                  <Button variant="outline" asChild>
                    <Link to="/checklists/instancias">Voltar as instancias</Link>
                  </Button>
                ) : null}
                {accessContext.role !== "perfil_interno" ? (
                  <Button
                    onClick={() => void handleFinalize()}
                    disabled={!canFinalize || finalizeChecklist.isPending}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {finalizeChecklist.isPending ? "Finalizando..." : "Finalizar checklist"}
                  </Button>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              {!scopedInstances.length && !loadingInstances ? (
                <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                  Nenhuma instancia esta disponivel no seu escopo atual.
                </div>
              ) : selectedInstance ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <ChecklistInstanceStatusBadge status={selectedInstance.status} />
                    <Badge variant="outline">
                      {selectedInstance.template?.titulo ?? "Template nao informado"}
                    </Badge>
                    {selectedInstance.local?.nome ? (
                      <Badge variant="outline">{selectedInstance.local.nome}</Badge>
                    ) : null}
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl border p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                      <p className="mt-2 font-medium">
                        {checklistInstanceStatusLabels[selectedInstance.status]}
                      </p>
                    </div>
                    <div className="rounded-xl border p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Obrigatorias pendentes</p>
                      <p className="mt-2 font-medium">{requiredPendingCount}</p>
                    </div>
                    <div className="rounded-xl border p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Permissao local</p>
                      <p className="mt-2 font-medium">
                        {accessContext.role === "perfil_interno"
                          ? "Consulta de respostas"
                          : "Resposta pelo colaborador responsavel"}
                      </p>
                    </div>
                  </div>

                  {!canManageSelectedInstance && accessContext.role !== "perfil_interno" ? (
                    <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                      O botao de finalizar fica disponivel apenas para quem pode atualizar a instancia.
                    </div>
                  ) : null}

                  {!instanceEditable ? (
                    <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                      Esta instancia esta em modo somente leitura porque o status atual nao aceita novas respostas.
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                  Selecione uma instancia para carregar as tarefas.
                </div>
              )}
            </CardContent>
          </Card>

          {selectedInstance ? (
            <div className="space-y-4">
              {loadingTarefas ? (
                <Card>
                  <CardContent className="p-6 text-sm text-muted-foreground">
                    Carregando tarefas da instancia...
                  </CardContent>
                </Card>
              ) : tarefas.length ? (
                tarefas.map((task) => (
                  <TarefaResponderCard
                    canManageInstance={canManageSelectedInstance}
                    key={task.id}
                    task={task}
                    currentUserId={accessContext.userId}
                    currentUserRole={accessContext.role}
                    instanceEditable={instanceEditable}
                  />
                ))
              ) : (
                <Card>
                  <CardContent className="p-6 text-sm text-muted-foreground">
                    Esta instancia ainda nao possui tarefas visiveis para o seu usuario.
                  </CardContent>
                </Card>
              )}
            </div>
          ) : null}
        </div>
      )}
    </ChecklistModuleLayout>
  );
}
