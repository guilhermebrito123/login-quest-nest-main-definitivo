import re
from pathlib import Path
path = Path("src/pages/ChecklistExecucoes.tsx")
text = path.read_text(encoding="utf-8")
pattern = r"\s{24}<div>\n\s{26}Concl.+?\n\s{24}</div>\n"
if not re.search(pattern, text):
    raise SystemExit("regex not found")
replacement = "                        {execucaoConclusoes[execucao.id] && (\n                          <div>\n                            Concluido em:{\" \"}\n                            {new Date(execucaoConclusoes[execucao.id]).toLocaleString(\"pt-BR\")}\n                          </div>\n                        )}\n"
text = re.sub(pattern, replacement, text, count=1)
path.write_text(text, encoding="utf-8")
