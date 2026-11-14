# Instala (ou atualiza) o Orbit no Windows com a última versão do GitHub.
#   irm https://raw.githubusercontent.com/leandro5g/orbit/main/install.ps1 | iex
$ErrorActionPreference = 'Stop'
$repo = 'leandro5g/orbit'

Write-Host '✦ Procurando a última versão do Orbit…' -ForegroundColor Magenta
$release = Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest"
$asset = $release.assets | Where-Object { $_.name -like '*-win-x64.exe' } | Select-Object -First 1
if (-not $asset) { throw 'Não achei o instalador do Windows na última release.' }

$file = Join-Path $env:TEMP $asset.name
Write-Host "✦ Baixando $($asset.name)…" -ForegroundColor Magenta
Invoke-WebRequest $asset.browser_download_url -OutFile $file -UseBasicParsing
Unblock-File $file

Write-Host '✦ Instalando… (se o Windows avisar "aplicativo não reconhecido", clique em Mais informações → Executar assim mesmo)' -ForegroundColor Magenta
Start-Process $file -Wait
Remove-Item $file -ErrorAction SilentlyContinue
Write-Host '✦ Pronto! O Orbit fica na bandeja, perto do relógio.' -ForegroundColor Magenta
