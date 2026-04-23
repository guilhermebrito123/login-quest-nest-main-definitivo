Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$ErrorActionPreference = "Stop"

function Ensure-Directory {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path | Out-Null
  }
}

function Escape-XmlText {
  param(
    [Parameter(Mandatory = $true)]
    [AllowEmptyString()]
    [string]$Text
  )

  return [System.Security.SecurityElement]::Escape($Text)
}

function New-DocumentXml {
  param(
    [Parameter(Mandatory = $true)]
    [AllowEmptyString()]
    [string[]]$Lines
  )

  $paragraphs = foreach ($line in $Lines) {
    $escaped = Escape-XmlText -Text $line
    @"
    <w:p>
      <w:r>
        <w:t xml:space="preserve">$escaped</w:t>
      </w:r>
    </w:p>
"@
  }

  return @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
  xmlns:v="urn:schemas-microsoft-com:vml"
  xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:w10="urn:schemas-microsoft-com:office:word"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
  xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
  xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"
  xmlns:wne="http://schemas.microsoft.com/office/2006/wordml"
  xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
  mc:Ignorable="w14 wp14">
  <w:body>
$(($paragraphs -join "`n"))
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
      <w:cols w:space="708"/>
      <w:docGrid w:linePitch="360"/>
    </w:sectPr>
  </w:body>
</w:document>
"@
}

function New-CoreXml {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Title
  )

  $escapedTitle = Escape-XmlText -Text $Title
  $timestamp = [DateTime]::UtcNow.ToString("s") + "Z"

  return @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:dcterms="http://purl.org/dc/terms/"
  xmlns:dcmitype="http://purl.org/dc/dcmitype/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>$escapedTitle</dc:title>
  <dc:creator>Codex</dc:creator>
  <cp:lastModifiedBy>Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">$timestamp</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">$timestamp</dcterms:modified>
</cp:coreProperties>
"@
}

function Write-ZipEntry {
  param(
    [Parameter(Mandatory = $true)]
    [System.IO.Compression.ZipArchive]$Archive,
    [Parameter(Mandatory = $true)]
    [string]$EntryName,
    [Parameter(Mandatory = $true)]
    [string]$Content
  )

  $entry = $Archive.CreateEntry($EntryName)
  $writer = New-Object System.IO.StreamWriter($entry.Open(), [System.Text.Encoding]::UTF8)
  try {
    $writer.Write($Content)
  } finally {
    $writer.Dispose()
  }
}

function New-DocxFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$OutputPath,
    [Parameter(Mandatory = $true)]
    [string]$Title,
    [Parameter(Mandatory = $true)]
    [AllowEmptyString()]
    [string[]]$Lines
  )

  if (Test-Path -LiteralPath $OutputPath) {
    Remove-Item -LiteralPath $OutputPath -Force
  }

  $archive = [System.IO.Compression.ZipFile]::Open($OutputPath, [System.IO.Compression.ZipArchiveMode]::Create)
  try {
    Write-ZipEntry -Archive $archive -EntryName "[Content_Types].xml" -Content @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>
"@

    Write-ZipEntry -Archive $archive -EntryName "_rels/.rels" -Content @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>
"@

    Write-ZipEntry -Archive $archive -EntryName "docProps/app.xml" -Content @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
  xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Microsoft Office Word</Application>
</Properties>
"@

    Write-ZipEntry -Archive $archive -EntryName "docProps/core.xml" -Content (New-CoreXml -Title $Title)
    Write-ZipEntry -Archive $archive -EntryName "word/_rels/document.xml.rels" -Content @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>
"@
    Write-ZipEntry -Archive $archive -EntryName "word/document.xml" -Content (New-DocumentXml -Lines $Lines)
  } finally {
    $archive.Dispose()
  }
}

$root = Split-Path -Parent $PSScriptRoot
$docsDir = Join-Path $root "docs"
Ensure-Directory -Path $docsDir

$chamadosLines = @(
  "MODULO CHAMADOS",
  "",
  "Objetivo",
  "Registrar, acompanhar e tratar solicitacoes operacionais abertas por colaboradores ou por perfis internos com permissao.",
  "",
  "Quem utiliza",
  "Colaborador: abre e acompanha os proprios chamados.",
  "Perfil interno com permissao operacional: visualiza, filtra, assume, redistribui e conclui chamados.",
  "",
  "Fluxo esperado de uso",
  "1. Acessar o menu Chamados.",
  "2. Clicar em Novo chamado.",
  "3. Informar titulo, descricao, centro de custo, local e prioridade.",
  "4. Opcionalmente selecionar uma categoria para facilitar a triagem.",
  "5. Salvar o chamado. O sistema registra a solicitacao com status inicial aberto.",
  "6. Acompanhar o chamado na listagem principal usando filtros por numero, status, prioridade, categoria, local, responsavel, solicitante e periodo.",
  "7. Abrir os detalhes do chamado para consultar resumo, interacoes, anexos e historico.",
  "8. Quando necessario, adicionar interacoes para complementar informacoes ou registrar tratativas.",
  "9. Anexar evidencias ou documentos no bloco de anexos.",
  "10. O perfil interno responsavel pode assumir o chamado, trocar o responsavel e avancar o status conforme a tratativa.",
  "11. Ao finalizar o atendimento, o chamado fica registrado no historico para consulta e auditoria.",
  "",
  "Regras praticas importantes",
  "Colaborador normalmente visualiza apenas os chamados que ele abriu.",
  "Perfis internos trabalham conforme escopo e acesso ao centro de custo.",
  "A abertura depende de um local valido vinculado ao centro de custo.",
  "Status e responsavel sao administrados no detalhamento do chamado.",
  "",
  "Modulos necessarios para o funcionamento",
  "Gestao de usuarios: define perfis, permissoes e escopo de acesso.",
  "Centros de custo: organiza o contexto operacional do chamado.",
  "Locais: fornece os locais vinculados ao centro de custo, obrigatorios na abertura.",
  "Minha conta e autenticacao: identifica o usuario que solicita ou trata o chamado.",
  "Historico de chamados: apoia rastreabilidade e consulta posterior do ciclo do atendimento.",
  "",
  "Boas praticas",
  "Descrever o problema de forma objetiva.",
  "Selecionar o local correto antes de salvar.",
  "Usar interacoes para registrar cada etapa importante do atendimento.",
  "Anexar evidencias sempre que a tratativa exigir comprovacao."
)

$checklistLines = @(
  "MODULO CHECKLIST",
  "",
  "Objetivo",
  "Planejar, distribuir, responder, revisar e auditar checklists operacionais com tarefas, evidencias e historico preservado por instancia.",
  "",
  "Quem utiliza",
  "Perfil interno permitido: cria estrutura, acompanha execucao e consulta respostas.",
  "Colaborador responsavel: responde tarefas atribuidas e envia evidencias quando permitido.",
  "",
  "Fluxo esperado de uso",
  "1. Acessar o menu Checklists.",
  "2. Cadastrar ou revisar equipes quando o processo depender de distribuicao por time.",
  "3. Criar o template do checklist definindo secoes, tarefas, tipo de resposta, obrigatoriedade, comentario e anexo.",
  "4. Gerar a instancia do checklist a partir do template para um centro de custo, local ou contexto operacional.",
  "5. O sistema cria as tarefas da instancia em formato snapshot, preservando as regras vigentes naquele momento.",
  "6. Distribuir ou confirmar os responsaveis das tarefas.",
  "7. O colaborador entra em Tarefas e responde apenas as tarefas em que ele e responsavel ativo e que ainda nao possuem resposta.",
  "8. Se a tarefa permitir, o colaborador adiciona comentario e anexa evidencias.",
  "9. Depois de respondida, a tarefa passa a ser exibida como Resposta para o colaborador.",
  "10. Usuario com role de perfil interno permitido acessa o fluxo apenas para consulta das respostas, sem responder.",
  "11. O checklist so pode ser finalizado quando todas as tarefas obrigatorias estiverem respondidas.",
  "12. A equipe interna acompanha o andamento por Instancias, Tarefas, Kanban, Avaliacoes, Feedbacks, Planos de acao e Auditoria.",
  "",
  "Regras praticas importantes",
  "A interface sempre deve considerar os dados snapshot da instancia, e nao reler regras do template para responder.",
  "Cada tipo de resposta grava na coluna correta da resposta da tarefa.",
  "Anexos so aparecem e so podem ser enviados quando a tarefa da instancia permite anexo.",
  "Leitura e resposta dependem de permissao, responsabilidade ativa e escopo operacional.",
  "",
  "Principais areas do modulo",
  "Templates: define a estrutura padrao do checklist.",
  "Instancias: controla execucoes abertas, em andamento e concluidas.",
  "Tarefas: concentra a resposta das tarefas da instancia.",
  "Kanban: ajuda no acompanhamento visual da execucao.",
  "Avaliacoes e Feedbacks: suportam analise e retorno sobre a execucao.",
  "Planos de acao: tratam nao conformidades e pendencias originadas no checklist.",
  "Auditoria: registra rastreabilidade do processo.",
  "",
  "Modulos necessarios para o funcionamento",
  "Gestao de usuarios: define papeis, acessos e escopo dos usuarios internos e colaboradores.",
  "Centros de custo: organiza o escopo em que templates, instancias e permissoes operam.",
  "Locais: identifica onde o checklist sera executado quando houver vinculacao operacional.",
  "Colaboradores: fornece os usuarios que podem ser designados como responsaveis das tarefas.",
  "Minha conta e autenticacao: identifica quem responde, revisa e visualiza.",
  "Planos de acao: necessario quando o checklist gera tratativas apos avaliacao.",
  "",
  "Boas praticas",
  "Montar templates com regras claras de resposta.",
  "Distribuir responsaveis antes de iniciar a execucao.",
  "Responder cada tarefa com evidencia suficiente quando houver anexo.",
  "Usar avaliacoes, feedbacks e planos de acao para fechar o ciclo operacional."
)

New-DocxFile -OutputPath (Join-Path $docsDir "Fluxo-Modulo-Chamados.docx") -Title "Fluxo do Modulo Chamados" -Lines $chamadosLines
New-DocxFile -OutputPath (Join-Path $docsDir "Fluxo-Modulo-Checklist.docx") -Title "Fluxo do Modulo Checklist" -Lines $checklistLines

Write-Output "Arquivos gerados em $docsDir"
