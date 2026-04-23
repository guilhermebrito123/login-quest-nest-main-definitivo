import { useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, PlusCircle } from "lucide-react";
import { toast } from "sonner";

import { AtribuirResponsavelDialog } from "@/components/action-plans/AtribuirResponsavelDialog";
import { ActionPlanClassCombobox } from "@/components/action-plans/ActionPlanClassCombobox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useAtualizarPlanoAcao,
  useCriarPlanoAcao,
  type PlanoAcaoListItem,
  type PlanoAcaoDetalhe,
} from "@/hooks/usePlanosAcao";
import {
  fromSaoPauloDateTimeInputValue,
  toSaoPauloDateTimeInputValue,
} from "@/lib/action-plans";
import {
  filterChecklistInstancesByScope,
  filterChecklistReviewsByScope,
  filterChecklistTeamsByScope,
} from "@/lib/checklist-module";
import { useChecklistInstances, useChecklistReviews, useChecklistSupervisorScope, useChecklistTeams } from "@/modules/checklist/hooks";
import type { ActionPlanNonconformityClass } from "@/modules/checklist/types";

type NovoPlanoDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checklistInstanciaId?: string;
  checklistAvaliacaoId?: string;
  costCenterId?: string | null;
  plan?: PlanoAcaoDetalhe | null;
  existingPlans?: PlanoAcaoListItem[];
  onSaved?: (planId: string) => void;
};

type FormState = {
  equipeResponsavelId: string;
  classeNaoConformidade: ActionPlanNonconformityClass;
  naoConformidadesResumo: string;
  acaoProposta: string;
  prazoEm: string;
};

const initialFormState: FormState = {
  equipeResponsavelId: "",
  classeNaoConformidade: "organizacao",
  naoConformidadesResumo: "",
  acaoProposta: "",
  prazoEm: "",
};

export function NovoPlanoDialog({
  open,
  onOpenChange,
  checklistInstanciaId,
  checklistAvaliacaoId,
  costCenterId,
  plan = null,
  existingPlans = [],
  onSaved,
}: NovoPlanoDialogProps) {
  const [form, setForm] = useState<FormState>(initialFormState);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [createdPlanId, setCreatedPlanId] = useState<string | null>(null);
  const [createdPlanCostCenterId, setCreatedPlanCostCenterId] = useState<string | null>(null);
  const [selectedContextKey, setSelectedContextKey] = useState("");
  const criarPlano = useCriarPlanoAcao();
  const atualizarPlano = useAtualizarPlanoAcao();
  const { supervisorContext } = useChecklistSupervisorScope();
  const teamsQuery = useChecklistTeams();
  const reviewsQuery = useChecklistReviews();
  const instancesQuery = useChecklistInstances();

  const isEditing = !!plan;
  const requiresContextSelection =
    !isEditing && (!checklistInstanciaId || !checklistAvaliacaoId);

  const availableTeams = useMemo(() => {
    const scopedTeams = filterChecklistTeamsByScope(
      teamsQuery.data ?? [],
      supervisorContext,
    ).filter((team) => team.ativo);

    if (!costCenterId) {
      return scopedTeams;
    }

    return scopedTeams.filter((team) => {
      if (team.escopo === "global_admin") {
        return true;
      }

      return team.cost_centers.some(
        (costCenterLink) => costCenterLink.cost_center_id === costCenterId,
      );
    });
  }, [costCenterId, supervisorContext, teamsQuery.data]);

  const scopedInstances = useMemo(
    () =>
      filterChecklistInstancesByScope(
        instancesQuery.data ?? [],
        supervisorContext,
      ),
    [instancesQuery.data, supervisorContext],
  );

  const instanceMap = useMemo(
    () => new Map(scopedInstances.map((instance) => [instance.id, instance])),
    [scopedInstances],
  );

  const scopedReviews = useMemo(
    () =>
      filterChecklistReviewsByScope(reviewsQuery.data ?? [], supervisorContext),
    [reviewsQuery.data, supervisorContext],
  );

  const existingPlanReviewIds = useMemo(
    () => new Set(existingPlans.map((existingPlan) => existingPlan.checklist_avaliacao_id)),
    [existingPlans],
  );

  const contextOptions = useMemo(
    () =>
      scopedReviews
        .filter((review) => {
          const instance = instanceMap.get(review.checklist_instancia_id);

          if (!instance) {
            return false;
          }

          if (existingPlanReviewIds.has(review.id)) {
            return false;
          }

          return review.plano_acao_necessario || instance.exige_plano_acao;
        })
        .map((review) => {
          const instance = instanceMap.get(review.checklist_instancia_id)!;
          return {
            key: review.id,
            reviewId: review.id,
            instanceId: instance.id,
            costCenterId: instance.cost_center_id,
            label: instance.titulo_snapshot,
          };
        }),
    [existingPlanReviewIds, instanceMap, scopedReviews],
  );

  const selectedContext =
    contextOptions.find((context) => context.key === selectedContextKey) ?? null;

  useEffect(() => {
    if (!open) {
      return;
    }

    if (plan) {
      setForm({
        equipeResponsavelId: plan.equipe_responsavel_id,
        classeNaoConformidade: plan.classe_nao_conformidade,
        naoConformidadesResumo: plan.nao_conformidades_resumo,
        acaoProposta: plan.acao_proposta,
        prazoEm: toSaoPauloDateTimeInputValue(plan.prazo_em),
      });
      return;
    }

    setForm(initialFormState);
    setSelectedContextKey(contextOptions[0]?.key ?? "");
  }, [contextOptions, open, plan]);

  async function handleSubmit() {
    const resolvedInstanceId = plan
      ? plan.checklist_instancia_id
      : checklistInstanciaId ?? selectedContext?.instanceId;
    const resolvedReviewId = plan
      ? plan.checklist_avaliacao_id
      : checklistAvaliacaoId ?? selectedContext?.reviewId;
    const resolvedCostCenterId =
      costCenterId ?? selectedContext?.costCenterId ?? plan?.instance?.cost_center_id ?? null;

    if (!resolvedInstanceId || !resolvedReviewId) {
      toast.error("Instância ou avaliação do checklist não informada.");
      return;
    }

    try {
      if (isEditing && plan) {
        await atualizarPlano.mutateAsync({
          id: plan.id,
          values: {
            equipe_responsavel_id: form.equipeResponsavelId,
            classe_nao_conformidade: form.classeNaoConformidade,
            nao_conformidades_resumo: form.naoConformidadesResumo.trim(),
            acao_proposta: form.acaoProposta.trim(),
            prazo_em: fromSaoPauloDateTimeInputValue(form.prazoEm) ?? plan.prazo_em,
          },
        });

        toast.success("Plano de ação atualizado.");
        onSaved?.(plan.id);
        onOpenChange(false);
        return;
      }

      const created = await criarPlano.mutateAsync({
        checklist_instancia_id: resolvedInstanceId,
        checklist_avaliacao_id: resolvedReviewId,
        equipe_responsavel_id: form.equipeResponsavelId,
        classe_nao_conformidade: form.classeNaoConformidade,
        nao_conformidades_resumo: form.naoConformidadesResumo.trim(),
        acao_proposta: form.acaoProposta.trim(),
        prazo_em: fromSaoPauloDateTimeInputValue(form.prazoEm)!,
        status: "open",
      });

      toast.success("Plano de ação criado.");
      setCreatedPlanId(created.id);
      setCreatedPlanCostCenterId(resolvedCostCenterId);
      setAssignDialogOpen(true);
      onSaved?.(created.id);
      onOpenChange(false);
      setSelectedContextKey("");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o plano de ação.";
      toast.error(message);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Editar plano de ação" : "Novo plano de ação"}
            </DialogTitle>
            <DialogDescription>
              Defina equipe, classe, resumo, ação proposta e prazo. Os responsáveis iniciais podem ser atribuídos logo após salvar.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            {requiresContextSelection ? (
              <div className="space-y-2">
                <Label htmlFor="plano-contexto">Instância / avaliação de origem</Label>
                <Select
                  value={selectedContextKey}
                  onValueChange={setSelectedContextKey}
                >
                  <SelectTrigger id="plano-contexto">
                    <SelectValue placeholder="Selecione a origem do plano" />
                  </SelectTrigger>
                  <SelectContent>
                    {contextOptions.map((context) => (
                      <SelectItem key={context.key} value={context.key}>
                        {context.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!contextOptions.length ? (
                  <p className="text-xs text-muted-foreground">
                    Nenhuma avaliação elegível sem plano de ação foi encontrada no seu escopo.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="plano-equipe">Equipe responsável</Label>
              <Select
                value={form.equipeResponsavelId}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, equipeResponsavelId: value }))
                }
              >
                <SelectTrigger id="plano-equipe">
                  <SelectValue placeholder="Selecione a equipe" />
                </SelectTrigger>
                <SelectContent>
                  {availableTeams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Classe da não conformidade</Label>
              <ActionPlanClassCombobox
                value={form.classeNaoConformidade}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    classeNaoConformidade: value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="plano-resumo">Resumo das não conformidades</Label>
              <Textarea
                id="plano-resumo"
                rows={4}
                value={form.naoConformidadesResumo}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    naoConformidadesResumo: event.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="plano-acao">Ação proposta</Label>
              <Textarea
                id="plano-acao"
                rows={4}
                value={form.acaoProposta}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    acaoProposta: event.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="plano-prazo">Prazo</Label>
              <Input
                id="plano-prazo"
                type="datetime-local"
                value={form.prazoEm}
                onChange={(event) =>
                  setForm((current) => ({ ...current, prazoEm: event.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Horário exibido e salvo considerando America/Sao_Paulo.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={
                criarPlano.isPending ||
                atualizarPlano.isPending ||
                (requiresContextSelection && !selectedContextKey) ||
                !form.equipeResponsavelId ||
                !form.naoConformidadesResumo.trim() ||
                !form.acaoProposta.trim() ||
                !form.prazoEm
              }
            >
              {criarPlano.isPending || atualizarPlano.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : isEditing ? (
                <Pencil className="mr-2 h-4 w-4" />
              ) : (
                <PlusCircle className="mr-2 h-4 w-4" />
              )}
              {isEditing ? "Salvar alterações" : "Criar plano"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {createdPlanId ? (
        <AtribuirResponsavelDialog
          open={assignDialogOpen}
          onOpenChange={(nextOpen) => {
            setAssignDialogOpen(nextOpen);
            if (!nextOpen) {
              setCreatedPlanId(null);
              setCreatedPlanCostCenterId(null);
            }
          }}
          planoId={createdPlanId}
          costCenterId={createdPlanCostCenterId}
          responsaveis={[]}
        />
      ) : null}
    </>
  );
}
