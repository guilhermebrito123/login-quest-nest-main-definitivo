from pathlib import Path
path = Path("src/pages/ChecklistExecucoes.tsx")
text = path.read_text(encoding="utf-8")
idx = text.index("Conclu")
start = text.rfind("        <div>", 0, idx)
end = text.index("</div>", idx) + len("</div>\n")
new_block = "        {execucaoConclusoes[execucao.id] && (\n          <div>\n            Concluido em:{\" \"}\n            {new Date(execucaoConclusoes[execucao.id]).toLocaleString(\"pt-BR\")}\n          </div>\n        )}\n"
text = text[:start] + new_block + text[end:]
path.write_text(text, encoding="utf-8")
