# Vercel demonstration

The Vercel build uses `scripts/build-vercel-demo.mjs` to bundle the existing StudyScan interface with a browser-only demonstration adapter. It does not deploy the Cloudflare database, ChatGPT authentication, local SQLite database, or Ollama runtime.

The banner switches between sample Super Admin, Teacher, and Student identities and resets sample data. Lessons, assignments, questions, flags, teacher notes, progress, classes, and attachments are saved in this browser's localStorage. Other visitors and devices have separate data. Attachments are limited to 1 MB and total storage depends on browser quota. Use sample data only. These controls are demonstrations, not authentication or security boundaries. Teacher-email approval is simulated and sends no invitation.

The assistant retrieves and cites relevant lesson excerpts. It does not generate AI responses. Local AI remains available through `Run-StudyScan.cmd`. Full online operation needs server-enforced authentication, persistent database and file storage, and a reachable AI provider.

Build with `node scripts/build-vercel-demo.mjs`. Vercel's root configuration uses `vercel-demo` as the static output directory. No environment files or local student records belong in the deployment.
