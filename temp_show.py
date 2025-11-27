from pathlib import Path
text = Path("src/pages/ChecklistExecucoes.tsx").read_text(encoding="utf-8")
start = text.index("                        <div>\n                          Conclu")
end = text.index("Observa", start)
print(repr(text[start:end]))
