import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, Lock, MessageSquareText, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { AnexosResposta } from "@/modules/checklist/components/AnexosResposta";
import {
  buildSnapshotResponsePayload,
  checklistTaskResponseTypeLabels,
  formatChecklistTaskResponseValue,
  getChecklistResponseValue,
  getLatestChecklistTaskResponse,
  parseChecklistConfigChoiceOptions,
  parseChecklistConfigStep,
  toDateTimeLocal,
  validateChecklistTaskResponseInput,
} from "@/modules/checklist/helpers";
import { useResponderTarefa } from "@/modules/checklist/hooks";
import { isChecklistPermissionError } from "@/modules/checklist/permissions";
import type {
  ChecklistInstanceTaskWithResponses,
  ChecklistResponseInputValue,
  ChecklistTaskResponseWithAttachments,
  UserRole,
} from "@/modules/checklist/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type TarefaResponderCardProps = {
  currentUserId: string | null;
  currentUserRole: UserRole;
  instanceEditable: boolean;
  task: ChecklistInstanceTaskWithResponses;
};

function TaskAnswerField({
  disabled,
  task,
  value,
  onChange,
}: {
  disabled: boolean;
  task: ChecklistInstanceTaskWithResponses;
  value: ChecklistResponseInputValue;
  onChange: (value: ChecklistResponseInputValue) => void;
}) {
  const options = useMemo(() => {
    const parsed = parseChecklistConfigChoiceOptions(task.config_json_snapshot);
    if (parsed.length > 0) return parsed;

    if (task.tipo_resposta_snapshot === "conformity_radio") {
      return [
        { label: "Conforme", value: "conforme" },
        { label: "Não conforme", value: "nao_conforme" },
        { label: "Não aplicável", value: "nao_aplicavel" },
      ];
    }

    return [];
  }, [task.config_json_snapshot, task.tipo_resposta_snapshot]);

  switch (task.tipo_resposta_snapshot) {
    case "text":
      return (
        <Input
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          placeholder="Digite a resposta"
        />
      );
    case "textarea":
      return (
        <Textarea
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          rows={4}
          placeholder="Digite a resposta"
        />
      );
    case "number":
    case "score":
      return (
        <Input
          type="number"
          step={String(parseChecklistConfigStep(task.config_json_snapshot, 1))}
          min={task.nota_min ?? undefined}
          max={task.nota_max ?? undefined}
          value={typeof value === "number" ? String(value) : ""}
          onChange={(event) =>
            onChange(event.target.value === "" ? null : Number(event.target.value))
          }
          disabled={disabled}
          placeholder="0"
        />
      );
    case "boolean":
      return (
        <Select
          value={typeof value === "boolean" ? String(value) : undefined}
          onValueChange={(nextValue) => onChange(nextValue === "true")}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione uma opção" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Sim</SelectItem>
            <SelectItem value="false">Não</SelectItem>
          </SelectContent>
        </Select>
      );
    case "single_select":
    case "conformity_radio":
      return (
        <Select
          value={typeof value === "string" && value ? value : undefined}
          onValueChange={(nextValue) => onChange(nextValue)}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione uma opção" />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "multi_select": {
      const selectedValues = Array.isArray(value) ? value : [];

      return (
        <div className="space-y-2 rounded-xl border p-3">
          {options.map((option) => {
            const checked = selectedValues.includes(option.value);

            return (
              <label key={option.value} className="flex items-center gap-3 text-sm">
                <Checkbox
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={() =>
                    onChange(
                      checked
                        ? selectedValues.filter((entry) => entry !== option.value)
                        : [...selectedValues, option.value],
                    )
                  }
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
      );
    }
    case "date":
      return (
        <Input
          type="date"
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value || null)}
          disabled={disabled}
        />
      );
    case "datetime":
      return (
        <Input
          type="datetime-local"
          value={typeof value === "string" ? toDateTimeLocal(value) : ""}
          onChange={(event) => onChange(event.target.value || null)}
          disabled={disabled}
        />
      );
    case "time":
      return (
        <Input
          type="time"
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value || null)}
          disabled={disabled}
        />
      );
    default:
      return null;
  }
}

export function TarefaResponderCard({
  currentUserId,
  currentUserRole,
  instanceEditable,
  task,
}: TarefaResponderCardProps) {
  const responderTarefa = useResponderTarefa();
  const response = useMemo(() => getLatestChecklistTaskResponse(task), [task]);
  const activeResponsibility = useMemo(
    () =>
      task.responsaveis.find((item) => item.ativo && item.assigned_user_id === currentUserId) ??
      task.responsaveis.find((item) => item.ativo) ??
      task.responsaveis[0] ??
      null,
    [currentUserId, task.responsaveis],
  );
  const currentUserIsResponsible = useMemo(
    () =>
      !!currentUserId &&
      task.responsaveis.some(
        (item) => item.ativo && item.assigned_user_id === currentUserId,
      ),
    [currentUserId, task.responsaveis],
  );
  const isColaborador = currentUserRole === "colaborador";
  const isInternal = currentUserRole === "perfil_interno";
  const hasExistingResponse = !!response;
  const canRespond =
    isColaborador &&
    instanceEditable &&
    !!activeResponsibility &&
    currentUserIsResponsible &&
    !hasExistingResponse;

  const [value, setValue] = useState<ChecklistResponseInputValue>(
    getChecklistResponseValue(task.tipo_resposta_snapshot, response),
  );
  const [comment, setComment] = useState(response?.comentario_resposta ?? "");

  useEffect(() => {
    setValue(getChecklistResponseValue(task.tipo_resposta_snapshot, response));
    setComment(response?.comentario_resposta ?? "");
  }, [response, task.tipo_resposta_snapshot]);

  const attachments = (response?.anexos ?? []) as ChecklistTaskResponseWithAttachments["anexos"];
  const permissionHint = !instanceEditable
    ? "A instância não está mais editável."
    : !activeResponsibility
      ? "Nenhum responsável ativo está vinculado a esta tarefa."
      : isInternal
        ? "Usuários com perfil interno visualizam apenas as respostas registradas."
        : hasExistingResponse
          ? "Esta tarefa já possui resposta registrada e agora fica somente para consulta."
          : currentUserIsResponsible
            ? "Você é o responsável ativo por esta tarefa."
            : "Você não é o responsável ativo por esta tarefa.";

  async function handleSubmit() {
    if (!activeResponsibility) {
      toast.error("A tarefa precisa ter um responsável ativo antes de receber resposta.");
      return;
    }

    const validationError = validateChecklistTaskResponseInput(task, value);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      await responderTarefa.mutateAsync({
        instanciaId: task.checklist_instancia_id,
        checklist_instancia_tarefa_id: task.id,
        tarefa_responsavel_id: activeResponsibility.id,
        existingId: response?.id,
        payload: buildSnapshotResponsePayload({
          task,
          value,
          comment: task.permite_comentario ? comment : null,
        }),
      });

      toast.success("Resposta registrada.");
    } catch (error) {
      toast.error(
        isChecklistPermissionError(error)
          ? "Você não é responsável ativo por esta tarefa."
          : error instanceof Error
            ? error.message
            : "Não foi possível salvar a resposta.",
      );
    }
  }

  return (
    <Card className="border-border/80">
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">#{task.ordem}</Badge>
              <Badge variant="secondary">
                {checklistTaskResponseTypeLabels[task.tipo_resposta_snapshot]}
              </Badge>
              <Badge variant={canRespond ? "default" : "outline"}>
                {canRespond ? "Responder" : "Resposta"}
              </Badge>
              {task.obrigatoria ? <Badge>Obrigatória</Badge> : null}
              {task.permite_anexo ? <Badge variant="outline">Aceita anexo</Badge> : null}
            </div>
            <CardTitle className="text-lg">{task.titulo_snapshot}</CardTitle>
            {task.descricao_snapshot ? (
              <p className="text-sm text-muted-foreground">{task.descricao_snapshot}</p>
            ) : null}
          </div>

          <div className="rounded-xl border bg-muted/30 px-3 py-2 text-right text-xs text-muted-foreground">
            <div className="flex items-center justify-end gap-2">
              {isInternal ? (
                <ShieldCheck className="h-4 w-4" />
              ) : canRespond ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              <span>{permissionHint}</span>
            </div>
          </div>
        </div>

        {task.ajuda_snapshot ? (
          <div className="rounded-xl border bg-muted/40 p-3 text-sm text-muted-foreground">
            {task.ajuda_snapshot}
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label>{canRespond ? "Responder" : "Resposta"}</Label>
          <TaskAnswerField
            task={task}
            value={value}
            disabled={!canRespond || responderTarefa.isPending}
            onChange={setValue}
          />
          {(task.nota_min != null || task.nota_max != null) &&
          (task.tipo_resposta_snapshot === "number" || task.tipo_resposta_snapshot === "score") ? (
            <p className="text-xs text-muted-foreground">
              Intervalo aceito: {task.nota_min != null ? task.nota_min : "sem mínimo"} até{" "}
              {task.nota_max != null ? task.nota_max : "sem máximo"}.
            </p>
          ) : null}
        </div>

        {task.permite_comentario ? (
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MessageSquareText className="h-4 w-4 text-muted-foreground" />
              Comentário
            </Label>
            <Textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              disabled={!canRespond || responderTarefa.isPending}
              rows={3}
              placeholder="Observações adicionais da resposta"
            />
          </div>
        ) : null}

        {response ? (
          <div className="rounded-xl border bg-muted/20 p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Clock3 className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Última resposta</span>
              <span className="text-muted-foreground">
                {new Date(response.updated_at).toLocaleString("pt-BR")}
              </span>
            </div>
            <p className="mt-2 text-muted-foreground">
              {formatChecklistTaskResponseValue(response)}
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            Responsáveis ativos:{" "}
            {task.responsaveis
              .filter((item) => item.ativo)
              .map((item) => item.assigned_user?.full_name ?? item.assigned_user_id)
              .join(", ") || "nenhum"}
          </div>

          {canRespond ? (
            <Button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={responderTarefa.isPending}
            >
              <Save className="h-4 w-4" />
              {responderTarefa.isPending ? "Salvando..." : "Responder"}
            </Button>
          ) : null}
        </div>

        {!canRespond ? (
          <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            {isInternal
              ? "Perfil interno autorizado consulta apenas as respostas já registradas."
              : hasExistingResponse
                ? "A resposta desta tarefa já foi registrada e agora está disponível apenas para consulta."
                : "Somente o colaborador responsável ativo pode responder esta tarefa."}
          </div>
        ) : null}

        {task.permite_anexo ? (
          <AnexosResposta
            anexos={attachments}
            canDeleteAsManager={false}
            canUpload={canRespond}
            currentUserId={currentUserId}
            disabledReason={permissionHint}
            instanciaId={task.checklist_instancia_id}
            resposta={response}
            tarefaId={task.id}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
