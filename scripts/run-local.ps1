$ErrorActionPreference = 'Stop'

function Test-LocalPort([int]$Port) {
  return $null -ne (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1)
}

$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$localAiRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../work/local-ai'))
$ollamaExe = Join-Path $localAiRoot 'ollama.exe'
$nodeCommand = Get-Command node.exe -ErrorAction Stop
$runtimeDirectory = Join-Path $projectRoot '.sites-runtime/local'
$studyPort = 5191
$serverLog = Join-Path $runtimeDirectory 'server.log'
New-Item -ItemType Directory -Force -Path $runtimeDirectory | Out-Null

if (!(Test-Path -LiteralPath $ollamaExe)) {
  throw "The local AI runtime is missing: $ollamaExe"
}

if (!(Test-LocalPort 11434)) {
  $ollamaLog = Join-Path $localAiRoot 'ollama.log'
  $ollamaErrorLog = Join-Path $localAiRoot 'ollama-error.log'
  $ollamaEnvironment = @{
    OLLAMA_HOST = '127.0.0.1:11434'
    OLLAMA_MODELS = (Join-Path $localAiRoot 'models')
    OLLAMA_NO_CLOUD = '1'
    OLLAMA_NUM_PARALLEL = '1'
    OLLAMA_MAX_LOADED_MODELS = '1'
    HTTP_PROXY = ''
    HTTPS_PROXY = ''
    ALL_PROXY = ''
  }
  $previousEnvironment = @{}
  foreach ($entry in $ollamaEnvironment.GetEnumerator()) {
    $previousEnvironment[$entry.Key] = [Environment]::GetEnvironmentVariable($entry.Key, 'Process')
    [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, 'Process')
  }
  try {
    Start-Process -FilePath $ollamaExe -ArgumentList 'serve' -WindowStyle Hidden -WorkingDirectory $localAiRoot -RedirectStandardOutput $ollamaLog -RedirectStandardError $ollamaErrorLog
  } finally {
    foreach ($entry in $previousEnvironment.GetEnumerator()) {
      [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, 'Process')
    }
  }
}

if (!(Test-LocalPort $studyPort)) {
  Remove-Item -LiteralPath $serverLog -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath (Join-Path $runtimeDirectory 'server-error.log') -Force -ErrorAction SilentlyContinue
  $previousPort = [Environment]::GetEnvironmentVariable('STUDYSCAN_PORT', 'Process')
  [Environment]::SetEnvironmentVariable('STUDYSCAN_PORT', "$studyPort", 'Process')
  try {
    Start-Process -FilePath $nodeCommand.Source -ArgumentList 'scripts/local-server.mjs' -WindowStyle Hidden -WorkingDirectory $projectRoot -RedirectStandardOutput $serverLog -RedirectStandardError (Join-Path $runtimeDirectory 'server-error.log')
  } finally {
    [Environment]::SetEnvironmentVariable('STUDYSCAN_PORT', $previousPort, 'Process')
  }
}

$deadline = (Get-Date).AddSeconds(8)
$serverStarted = $false
while ((Get-Date) -lt $deadline) {
  if ((Test-Path -LiteralPath $serverLog) -and ((Get-Content -LiteralPath $serverLog -Raw -ErrorAction SilentlyContinue) -match "StudyScan local preview ready: http://127.0.0.1:$studyPort")) {
    $serverStarted = $true
    break
  }
  Start-Sleep -Milliseconds 250
}
if (!$serverStarted) {
  throw "StudyScan did not start. Check $(Join-Path $runtimeDirectory 'server-error.log')."
}

Start-Process "http://127.0.0.1:$studyPort/"
Write-Output "StudyScan is running at http://127.0.0.1:$studyPort/"
