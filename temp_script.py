# -*- coding: utf-8 -*-
from pathlib import Path
path = Path("src/pages/ChecklistExecucoes.tsx")
text = path.read_text(encoding="utf-8")
old = "  const [loading, setLoading] = useState(false);\n  const [saving, setSaving] = useState(false);\n  const [expandedExecucao, setExpandedExecucao] = useState<string | null>(null);"
if old not in text:
    raise SystemExit("state block not found")
text = text.replace(old, old + "\n  const [execucaoConclusoes, setExecucaoConclusoes] = useState<Record<string, string>>({});", 1)
old_fetchall = "      await Promise.all([fetchExecucoes(), fetchChecklists(), fetchColaboradores()]);"
new_fetchall = "      await Promise.all([\n        fetchExecucoes(),\n        fetchChecklists(),\n        fetchColaboradores(),\n        fetchExecucaoConclusoes(),\n      ]);"
if old_fetchall not in text:
    raise SystemExit("fetchAll block not found")
text = text.replace(old_fetchall, new_fetchall, 1)
old_collab = "  const fetchColaboradores = async () => {\n    const { data, error } = await supabase\n      .from(\"colaboradores\")\n      .select(\"id, nome_completo\")\n      .order(\"nome_completo\");\n    if (error) {\n      toast.error(\"Erro ao carregar colaboradores\");\n      return;\n    }\n    setColaboradores(data ?? []);\n  };\n\n"
if old_collab not in text:
    raise SystemExit("colaboradores block not found")
new_collab = old_collab + "  const fetchExecucaoConclusoes = async () => {\n    const { data, error } = await supabase\n      .from(\"checklist_respostas\")\n      .select(\"execucao_id, created_at\")\n      .order(\"created_at\", { ascending: true });\n\n    if (error) {\n      console.error(\"Erro ao carregar conclusões de execuções:\", error);\n      return;\n    }\n\n    const map: Record<string, string> = {};\n    data?.forEach((resposta) => {\n      if (resposta.execucao_id and resposta.execucao_id not in map):\n        map[resposta.execucao_id] = resposta.created_at or \"\"\n    })\n    setExecucaoConclusoes(map)\n  };\n\n"
text = text.replace(old_collab, new_collab, 1)
old_detail = "                        <div>\n                          Conclu??do em:{\" \"}\n                          {execucao.created_at\n                            ? new Date(execucao.created_at).toLocaleString(\"pt-BR\")\n                            : \"-\"}\n                        </div>\n"
if old_detail not in text:
    raise SystemExit("detail block not found")
new_detail = "                        {execucaoConclusoes[execucao.id] && (\n                          <div>\n                            Concluído em:{\" \"}\n                            {new Date(execucaoConclusoes[execucao.id]).toLocaleString(\"pt-BR\")}\n                          </div>\n                        )}\n"
text = text.replace(old_detail, new_detail, 1)
path.write_text(text, encoding="utf-8")
