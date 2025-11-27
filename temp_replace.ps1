Set-Location -Path "c:\Users\BT Gaming Store\Downloads\login-quest-nest-main\login-quest-nest-main"
$path = 'src/pages/ChecklistExecucoes.tsx'
$content = Get-Content -Raw -Path $path
$pattern = "                        <div>\r?\n                          Conclu??do em:\{\" \"\}\r?\n                          \{execucao\.created_at\r?\n                            \? new Date\(execucao\.created_at\)\.toLocaleString\(\"pt-BR\"\)\r?\n                            : \"-\"\}\r?\n                        </div>\r?\n"
$replacement = "                        {execucaoConclusoes[execucao.id] && (\r\n                          <div>\r\n                            Concluido em:{\" \"}\r\n                            {new Date(execucaoConclusoes[execucao.id]).toLocaleString(\"pt-BR\")}\r\n                          </div>\r\n                        )}\r\n"
if ($content -notmatch $pattern) { throw 'pattern not found' }
$content = [regex]::Replace($content, $pattern, $replacement, 1)
Set-Content -Path $path -Value $content
