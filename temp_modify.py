from pathlib import Path
path = Path("src/pages/ChecklistExecucoes.tsx")
lines = path.read_text(encoding="utf-8").splitlines()
# add state
for idx, line in enumerate(lines):
    if 'expandedExecucao' in line and 'useState' in line:
        lines.insert(idx + 1, '  const [execucaoConclusoes, setExecucaoConclusoes] = useState<Record<string, string>>({});')
        break
else:
    raise SystemExit('state line not found')
# update fetchAll
for idx, line in enumerate(lines):
    if 'await Promise.all' in line and 'fetchColaboradores' in line:
        new_block = [
'      await Promise.all([',
'        fetchExecucoes(),',
'        fetchChecklists(),',
'        fetchColaboradores(),',
'        fetchExecucaoConclusoes(),',
'      ]);'
        ]
        lines[idx:idx + 1] = new_block
        break
else:
    raise SystemExit('fetchAll line not found')
# insert new function
set_idx = None
for idx, line in enumerate(lines):
    if 'setColaboradores(data ?? [])' in line:
        set_idx = idx
        break
if set_idx is None:
    raise SystemExit('setColaboradores line not found')
end_idx = None
for idx in range(set_idx, len(lines)):
    if lines[idx] == '  };':
        end_idx = idx
        break
if end_idx is None:
    raise SystemExit('end of colaboradores function not found')
insert_idx = end_idx + 2  # after closing brace and blank line
new_func = [
'  const fetchExecucaoConclusoes = async () => {',
'    const { data, error } = await supabase',
'      .from("checklist_respostas")',
'      .select("execucao_id, created_at")',
'      .order("created_at", { ascending: true });',
'',
'    if (error) {',
'      console.error("Erro ao carregar conclusoes de execucoes:", error);',
'      return;',
'    }',
'',
'    const map: Record<string, string> = {};',
'    data?.forEach((resposta) => {',
'      if (resposta.execucao_id && not map.get(resposta.execucao_id)) {',
'        map[resposta.execucao_id] = resposta.created_at or "";',
'      }',
'    });',
'    setExecucaoConclusoes(map);',
'  };',
''
]
lines[insert_idx:insert_idx] = new_func
path.write_text("\n".join(lines) + "\n", encoding="utf-8")
