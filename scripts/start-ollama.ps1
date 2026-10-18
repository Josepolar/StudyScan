$ErrorActionPreference = 'Stop'
$localAiRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../work/local-ai'))
$ollamaExe = Join-Path $localAiRoot 'ollama.exe'
if (!(Test-Path -LiteralPath $ollamaExe)) { throw 'The workspace Ollama runtime is missing. See LOCAL-AI.md.' }
$env:OLLAMA_HOST = '127.0.0.1:11434'
$env:OLLAMA_MODELS = Join-Path $localAiRoot 'models'
$env:OLLAMA_NO_CLOUD = '1'
$env:OLLAMA_NUM_PARALLEL = '1'
$env:OLLAMA_MAX_LOADED_MODELS = '1'
Start-Process -FilePath $ollamaExe -ArgumentList 'serve' -WindowStyle Hidden -WorkingDirectory $localAiRoot -RedirectStandardOutput (Join-Path $localAiRoot 'ollama.log') -RedirectStandardError (Join-Path $localAiRoot 'ollama-error.log')
Write-Output 'Ollama requested on localhost:11434. Cloud inference disabled.'
