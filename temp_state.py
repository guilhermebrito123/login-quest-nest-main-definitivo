# -*- coding: utf-8 -*-
from pathlib import Path
path = Path("src/pages/ChecklistExecucoes.tsx")
text = path.read_text(encoding="utf-8")
old_state = "  const [loading, setLoading] = useState(false);\n  const [saving, setSaving] = useState(false);\n  const [expandedExecucao, setExpandedExecucao] = useState<string | null>(null);"
if old_state not in text:
    raise SystemExit('state block not found')
text = text.replace(old_state, old_state + "\n  const [execucaoConclusoes, setExecucaoConclusoes] = useState<Record<string, string>>({});", 1)
old_fetch = "      await Promise.all([fetchExecucoes(), fetchChecklists(), fetchColaboradores()]);"
if old_fetch not in text:
    raise SystemExit('fetch promise not found')
text = text.replace(old_fetch, "      await Promise.all([\n        fetchExecucoes(),\n        fetchChecklists(),\n        fetchColaboradores(),\n        fetchExecucaoConclusoes(),\n      ]);", 1)
marker = "    setColaboradores(data ?? []);\n  };\n\n"
if marker not in text:
    raise SystemExit('marker not found')
text = text.replace(marker, marker + "  const fetchExecucaoConclusoes = async () => {\n    const { data, error } = await supabase\n      .from(\"checklist_respostas\")\n      .select(\"execucao_id, created_at\")\n      .order(\"created_at\", { ascending: true });\n\n    if (error) {\n      console.error(\"Erro ao carregar conclusões de execuções:\", error);\n      return;\n    }\n\n    const map: Record<string, string> = {};\n    data?.forEach((resposta) => {\n      if (resposta.execucao_id and not map.get(resposta.execucao_id)):\n        map[resposta.execucao_id] = resposta.created_at or \"\"\n    })\n    setExecucaoConclusoes(map)\n  };\n\n", 1)
path.write_text(text, encoding="utf-8")
