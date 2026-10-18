# Local AI for StudyScan

This installation uses Ollama and Qwen3 0.6B on this Windows computer. It requires no API key and has no provider usage bill. Downloading the runtime and model requires internet; inference runs locally afterward. Electricity, storage, and hardware remain your responsibility.

The small model was selected because available RAM was limited. It is suitable for trying the workflow, not a guarantee of reliable educational answers. Teacher review is required. Larger models can improve quality but need more memory.

## Start the installed workspace runtime

From the StudyScan project directory:

```powershell
powershell -File scripts/start-ollama.ps1
node scripts/local-server.mjs
```

The launcher starts only the downloaded official Ollama executable; it binds to 127.0.0.1:11434, disables Ollama cloud features, and stores models in the workspace's work/local-ai/models directory. Start it only once. The local web app is at http://127.0.0.1:5191.

## One-click launch on this PC

Double-click `Run-StudyScan.cmd` in the StudyScan folder. It starts Ollama if it is not already running, starts the local web server, and opens StudyScan in your default browser. Keep the computer on while testing; closing the Node or Ollama process stops the corresponding service.

The private .env.local configuration is:

```dotenv
AI_PROVIDER=ollama
OLLAMA_MODEL=qwen3:0.6b
```

The app checks that Ollama is reachable and the model is installed before showing AI as available. No cloud provider is called when AI_PROVIDER=ollama. Questions, teacher-selected source excerpts, and recent same-lesson conversation history are sent only to the loopback Ollama endpoint. Existing conversation records remain in the StudyScan database.

On a different computer, install Ollama from https://ollama.com/download/windows, disable cloud features if desired with OLLAMA_NO_CLOUD=1, run `ollama pull qwen3:0.6b`, and use the same app environment settings. The portable runtime and model weights are not included in the source archive.

If responses fail, check that Ollama is running, inspect work/local-ai/ollama-error.log, and close memory-heavy apps. First responses can take longer while the model loads. The app waits up to two minutes before falling back to teacher assistance. Citation indexes are checked, but that does not prove the generated explanation is correct.

This configuration works on this PC. An online deployment cannot reach this computer's localhost; remote hosting or a separately secured model server would be a different deployment.

References: https://docs.ollama.com/windows and https://docs.ollama.com/api/chat
