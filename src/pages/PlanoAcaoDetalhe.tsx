import { useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  Ban,
  CheckCircle2,
  Loader2,
  RotateCcw,
  UserPlus,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { AtribuirResponsavelDialog } from "@/components/action-plans/AtribuirResponsavelDialog";
import { NovoPlanoDialog } from "@/components/action-plans/NovoPlanoDialog";
import { ActionPlanStatusBadge } from "@/components/action-plans/ActionPlanStatusBadge";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  useAtribuirResponsavel,
  usePlanoAcao,
  usePostarAtualizacao,
  useRemoverResponsavel,
} from "@/hooks/usePlanosAcao";
import {
  actionPlanStatusOptionList,
  formatActionPlanDateTime,
  getActionPlanClassLabel,
  getActionPlanStatusLabel,
} from "@/lib/action-plans";
import {
  canManageChecklistActionPlan,
  canPostChecklistActionPlanUpdate,
} from "@/lib/checklist-module";
import { useChecklistSupervisorScope } from "@/modules/checklist/hooks";
import type { ActionPlanStatus } from "@/modules/checklist/types";

type UpdateFormState = {
  statusNovo: ActionPlanStatus | "none";
  progressoPercentual: string;
  comentario: string;
};

const initialUpdateForm: UpdateFormState = {
  statusNovo: "none",
  progressoPercentual: "",
  comentario: "",
};

export default function PlanoAcaoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [updateForm, setUpdateForm] = useState<UpdateFormState>(initialUpdateForm);
  const planoQuery = usePlanoAcao(id);
  const atribuirResponsavel = useAtribuirResponsavel();
  const postarAtualizacao = usePostarAtualizacao();
  const removerResponsavel = useRemoverResponsavel();
  const { supervisorContext } = useChecklistSupervisorScope();

  const plano = planoQuery.data;

  const canManagePlan = plano
    ? canManageChecklistActionPlan(supervisorContext, plano)
    : false;
  const canPostUpdate = plano
    ? canPostChecklistActionPlanUpdate(supervisorContext, plano)
    : false;

  const activeResponsaveis = useMemo(
    () =>
      (plano?.responsaveis ?? [])
        .filter((responsavel) => responsavel.ativo)
        .sort(
          (left, right) =>
            new Date(right.atribuido_em).getTime() -
            new Date(left.atribuido_em).getTime(),
        ),
    [plano?.responsaveis],
  );

  const inactiveResponsaveis = useMemo(
    () =>
      (plano?.responsaveis ?? [])
        .filter((responsavel) => !responsavel.ativo)
        .sort(
          (left, right) =>
            new Date(right.atribuido_em).getTime() -
            new Date(left.atribuido_em).getTime(),
        ),
    [plano?.responsaveis],
  );

  const timeline = useMemo(
    () =>
      [...(plano?.updates ?? [])].sort(
        (left, right) =>
          new Date(right.created_at).getTime() -
          new Date(left.created_at).getTime(),
      ),
    [plano?.updates],
  );

  if (!id) {
    return <Navigate to="/planos-acao" replace />;
  }

  async function handleQuickStatusChange(status: ActionPlanStatus) {
    if (!plano) return;

    try {
      await postarAtualizacao.mutateAsync({
        planoId: plano.id,
        statusAnterior: plano.status,
        statusNovo: status,
        comentario:
          status === "done"
            ? "Plano encerrado via gestão."
            : "Plano cancelado via gestão.",
      });

      toast.success(
        status === "done"
          ? "Plano encerrado com sucesso."
          : "Plano cancelado com sucesso.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o status do plano.",
      );
    }
  }

  async function handleRemoveResponsible(responsavelId: string) {
    try {
      await removerResponsavel.mutateAsync({ responsavelId });
      toast.success("Responsável desativado no plano.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível desativar o responsável.",
      );
    }
  }

  async function handleReactivateResponsible(assignedUserId: string) {
    if (!plano) return;

    try {
      await atribuirResponsavel.mutateAsync({
        planoAcaoId: plano.id,
        assignedUserId,
      });
      toast.success("Responsável reativado no plano.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível reativar o responsável.",
      );
    }
  }

  async function handleSubmitUpdate() {
    if (!plano) return;

    try {
      await postarAtualizacao.mutateAsync({
        planoId: plano.id,
        statusAnterior: plano.status,
        statusNovo: updateForm.statusNovo === "none" ? null : updateForm.statusNovo,
        progressoPercentual:
          updateForm.progressoPercentual === ""
            ? null
            : Number(updateForm.progressoPercentual),
        comentario: updateForm.comentario,
      });

      toast.success("Atualização registrada.");
      setUpdateForm(initialUpdateForm);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível registrar a atualização.",
      );
    }
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link to="/planos-acao">Gestão</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/meus-planos">Meus planos</Link>
          </Button>
        </div>

        {planoQuery.isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : planoQuery.error || !plano ? (
          <Card>
            <CardHeader>
              <CardTitle>Plano não disponível</CardTitle>
              <CardDescription>
                O plano não foi encontrado ou não está visível para o seu usuário.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <ActionPlanStatusBadge status={plano.status} />
                    <span className="text-sm text-muted-foreground">
                      Prazo: {formatActionPlanDateTime(plano.prazo_em)}
                    </span>
                  </div>
                  <div>
                    <CardTitle>{plano.nao_conformidades_resumo}</CardTitle>
                    <CardDescription className="mt-2">
                      {plano.instance?.titulo_snapshot ?? "Instância de origem não disponível"}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                    <span>Classe: {getActionPlanClassLabel(plano.classe_nao_conformidade)}</span>
                    <span>Equipe: {plano.team?.nome ?? "Sem equipe"}</span>
                    {plano.finalizado_em ? (
                      <span>
                        Finalizado em {formatActionPlanDateTime(plano.finalizado_em)}
                      </span>
                    ) : null}
                  </div>
                </div>

                {canManagePlan ? (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
                      Editar
                    </Button>
                    <Button onClick={() => void handleQuickStatusChange("done")}>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Encerrar
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => void handleQuickStatusChange("cancelled")}
                    >
                      <Ban className="mr-2 h-4 w-4" />
                      Cancelar
                    </Button>
                  </div>
                ) : null}
              </CardHeader>
              <CardContent className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-2">
                  <Label>Ação proposta</Label>
                  <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                    {plano.acao_proposta}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Resumo operacional</Label>
                  <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                    Criado em {formatActionPlanDateTime(plano.created_at)}
                    <br />
                    Atualizado em {formatActionPlanDateTime(plano.updated_at)}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <div>
                    <CardTitle>Responsáveis</CardTitle>
                    <CardDescription>
                      Vínculos ativos e histórico de inativos do plano.
                    </CardDescription>
                  </div>
                  {canManagePlan ? (
                    <Button size="sm" onClick={() => setAssignDialogOpen(true)}>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Atribuir
                    </Button>
                  ) : null}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium">Ativos</p>
                    </div>
                    {activeResponsaveis.length ? (
                      activeResponsaveis.map((responsavel) => (
                        <div
                          key={responsavel.id}
                          className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="font-medium">
                              {responsavel.assigned_user?.full_name ?? responsavel.assigned_user?.email}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {responsavel.assigned_user?.email ?? "E-mail não disponível"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Atribuído em {formatActionPlanDateTime(responsavel.atribuido_em)}
                            </p>
                          </div>
                          {canManagePlan ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => void handleRemoveResponsible(responsavel.id)}
                              disabled={removerResponsavel.isPending}
                            >
                              {removerResponsavel.isPending ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <XCircle className="mr-2 h-4 w-4" />
                              )}
                              Desativar
                            </Button>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                        Nenhum responsável ativo visível neste plano.
                      </div>
                    )}
                  </div>

                  {canManagePlan ? (
                    <div className="space-y-3 border-t pt-4">
                      <div>
                        <p className="text-sm font-medium">Histórico</p>
                        <p className="text-xs text-muted-foreground">
                          Responsáveis inativos podem ser reativados.
                        </p>
                      </div>
                      {inactiveResponsaveis.length ? (
                        inactiveResponsaveis.map((responsavel) => (
                          <div
                            key={responsavel.id}
                            className="flex flex-col gap-3 rounded-lg border border-dashed p-4 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div>
                              <p className="font-medium">
                                {responsavel.assigned_user?.full_name ?? responsavel.assigned_user?.email}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {responsavel.assigned_user?.email ?? "E-mail não disponível"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Última atribuição em {formatActionPlanDateTime(responsavel.atribuido_em)}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                void handleReactivateResponsible(responsavel.assigned_user_id)
                              }
                              disabled={atribuirResponsavel.isPending}
                            >
                              {atribuirResponsavel.isPending ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <RotateCcw className="mr-2 h-4 w-4" />
                              )}
                              Reativar
                            </Button>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                          Nenhum responsável inativo neste plano.
                        </div>
                      )}
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Postar atualização</CardTitle>
                  <CardDescription>
                    Comentário, progresso e mudança de status ficam registrados na linha do tempo.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {canPostUpdate ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Status</Label>
                        <Select
                          value={updateForm.statusNovo}
                          onValueChange={(value: ActionPlanStatus | "none") =>
                            setUpdateForm((current) => ({
                              ...current,
                              statusNovo: value,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Manter status atual" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Manter status atual</SelectItem>
                            {actionPlanStatusOptionList.map((status) => (
                              <SelectItem key={status} value={status}>
                                {getActionPlanStatusLabel(status)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="progresso">Progresso (%)</Label>
                        <Input
                          id="progresso"
                          type="number"
                          min="0"
                          max="100"
                          value={updateForm.progressoPercentual}
                          onChange={(event) =>
                            setUpdateForm((current) => ({
                              ...current,
                              progressoPercentual: event.target.value,
                            }))
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="comentario">Comentário</Label>
                        <Textarea
                          id="comentario"
                          rows={4}
                          value={updateForm.comentario}
                          onChange={(event) =>
                            setUpdateForm((current) => ({
                              ...current,
                              comentario: event.target.value,
                            }))
                          }
                        />
                      </div>

                      <Button
                        type="button"
                        onClick={() => void handleSubmitUpdate()}
                        disabled={postarAtualizacao.isPending}
                      >
                        {postarAtualizacao.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Registrar atualização
                      </Button>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                      Apenas gestores do plano e responsáveis ativos podem postar atualizações.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Linha do tempo</CardTitle>
                <CardDescription>
                  Histórico cronológico de comentários, progresso e mudanças de status.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {timeline.length ? (
                  timeline.map((update) => (
                    <div key={update.id} className="rounded-lg border p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-medium">
                            {update.autor?.full_name ?? update.autor?.email ?? "Autor não disponível"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatActionPlanDateTime(update.created_at)}
                          </p>
                        </div>
                        {update.progresso_percentual != null ? (
                          <div className="w-full max-w-44 space-y-2">
                            <div className="text-right text-sm text-muted-foreground">
                              {update.progresso_percentual}%
                            </div>
                            <Progress value={update.progresso_percentual} />
                          </div>
                        ) : null}
                      </div>

                      {(update.status_anterior || update.status_novo) ? (
                        <p className="mt-3 text-sm">
                          {update.status_anterior
                            ? getActionPlanStatusLabel(update.status_anterior)
                            : "Sem status anterior"}{" "}
                          →{" "}
                          {update.status_novo
                            ? getActionPlanStatusLabel(update.status_novo)
                            : "Sem alteração de status"}
                        </p>
                      ) : null}

                      <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">
                        {update.comentario || "Sem comentário adicional."}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                    Nenhuma atualização registrada até o momento.
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {plano ? (
        <>
          <AtribuirResponsavelDialog
            open={assignDialogOpen}
            onOpenChange={setAssignDialogOpen}
            planoId={plano.id}
            costCenterId={plano.instance?.cost_center_id}
            responsaveis={plano.responsaveis}
          />
          <NovoPlanoDialog
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            checklistInstanciaId={plano.checklist_instancia_id}
            checklistAvaliacaoId={plano.checklist_avaliacao_id}
            costCenterId={plano.instance?.cost_center_id}
            plan={plano}
          />
        </>
      ) : null}
    </DashboardLayout>
  );
}
