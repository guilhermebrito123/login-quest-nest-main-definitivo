import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getResponseRenderer, parseChecklistConfigOptions } from "@/modules/checklist/helpers";
import type {
  ChecklistInstanceTask,
  ChecklistResponseDraft,
  ChecklistTaskResponseType,
} from "@/modules/checklist/types";

type ChecklistResponseInputProps = {
  responseType: ChecklistTaskResponseType;
  config: ChecklistInstanceTask["config_json_snapshot"] | null;
  draft: ChecklistResponseDraft;
  onChange: (patch: Partial<ChecklistResponseDraft>) => void;
};

export function ChecklistResponseInput({
  responseType,
  config,
  draft,
  onChange,
}: ChecklistResponseInputProps) {
  const renderer = getResponseRenderer(responseType);
  const options = parseChecklistConfigOptions(config);

  switch (renderer) {
    case "textarea":
      return (
        <div className="space-y-2">
          <Label>Resposta</Label>
          <Textarea value={draft.text} onChange={(event) => onChange({ text: event.target.value })} rows={5} />
        </div>
      );
    case "text":
      return (
        <div className="space-y-2">
          <Label>Resposta</Label>
          <Input value={draft.text} onChange={(event) => onChange({ text: event.target.value })} />
        </div>
      );
    case "time":
      return (
        <div className="space-y-2">
          <Label>Hora</Label>
          <Input type="time" value={draft.time} onChange={(event) => onChange({ time: event.target.value })} />
        </div>
      );
    case "number":
    case "score":
      return (
        <div className="space-y-2">
          <Label>{renderer === "score" ? "Pontuação" : "Número"}</Label>
          <Input
            type="number"
            step="0.01"
            value={renderer === "score" ? draft.score : draft.number}
            onChange={(event) =>
              onChange(renderer === "score" ? { score: event.target.value } : { number: event.target.value })
            }
          />
        </div>
      );
    case "boolean":
      return (
        <div className="space-y-2">
          <Label>Resposta</Label>
          <Select value={draft.boolean || undefined} onValueChange={(value: "true" | "false") => onChange({ boolean: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Sim</SelectItem>
              <SelectItem value="false">Não</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );
    case "date":
      return (
        <div className="space-y-2">
          <Label>Data</Label>
          <Input type="date" value={draft.date} onChange={(event) => onChange({ date: event.target.value })} />
        </div>
      );
    case "datetime":
      return (
        <div className="space-y-2">
          <Label>Data e hora</Label>
          <Input
            type="datetime-local"
            value={draft.datetime}
            onChange={(event) => onChange({ datetime: event.target.value })}
          />
        </div>
      );
    case "single_select":
    case "conformity_radio":
      return (
        <div className="space-y-2">
          <Label>Resposta</Label>
          <Select
            value={(draft.singleSelect || draft.text) || undefined}
            onValueChange={(value) => onChange({ singleSelect: value, text: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma opção" />
            </SelectTrigger>
            <SelectContent>
              {(options.length ? options : ["conforme", "nao_conforme", "nao_aplicavel"]).map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    case "multi_select":
      return (
        <div className="space-y-2">
          <Label>Selecione uma ou mais opções</Label>
          <div className="grid gap-2 rounded-md border p-3">
            {options.map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={draft.multiSelect.includes(option)}
                  onCheckedChange={() =>
                    onChange({
                      multiSelect: draft.multiSelect.includes(option)
                        ? draft.multiSelect.filter((item) => item !== option)
                        : [...draft.multiSelect, option],
                    })
                  }
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        </div>
      );
    default:
      return (
        <div className="space-y-2">
          <Label>JSON</Label>
          <Textarea value={draft.json} onChange={(event) => onChange({ json: event.target.value })} rows={5} />
        </div>
      );
  }
}

