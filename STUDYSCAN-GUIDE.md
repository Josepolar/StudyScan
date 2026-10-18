# StudyScan — first functional version

StudyScan is a teacher-controlled academic support application. This version has a working local preview, persistent SQLite data, a React interface, and Cloudflare D1/R2 production source. It is not yet published or evaluated with students.

## Try it locally

The running preview is at http://127.0.0.1:5173. The **LOCAL DEMO** controls switch between fictional teacher Alex Reyes and student Jamie Santos. The demo contains three sample lessons and one activity. These identities are available only in the loopback development server; they are not production authentication.

From this project folder, with Node.js 24 installed:

```powershell
npm install
node scripts/local-build.mjs
node scripts/local-server.mjs
```

Open http://127.0.0.1:5173. The server listens only on this computer. Data is stored in `.sites-runtime/local/studyscan.sqlite`; resource files are in `.sites-runtime/local/files`. Both are excluded from the source archive. Stop the server with Ctrl+C. Restarting it preserves data.

On this machine, if the npm wrapper fails, use:

```powershell
node 'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js' install --ignore-scripts --cache .npm-cache
```

## Teacher workflow

1. Create a class in **Classes & people** and share its join code.
2. Add a learning material. Enter its title, subject, topic, grade, quarter, and approved source text. TXT and Markdown can be imported.
3. In **Assignments & access**, assign classes or individual students and enable **Publish this material**. Drafts are hidden from students.
4. In **AI settings**, choose the assistance level, direct-answer preference, availability dates, restricted topics, and custom instructions.
5. Attach PDF, Word, PowerPoint, TXT, or Markdown resources after saving. Files must be under 10 MB. Students can download assigned resources. Automatic PDF/slide/OCR extraction is not included: paste the text to be used by the assistant into the lesson.
6. Create an activity linked to a lesson. Its AI permission can be more restrictive than the lesson setting.
7. Review questions, sources, flags, and responses in **Student questions**. Add a follow-up note or mark a conversation reviewed. Students can read the note.

Students join a class, read assigned material, choose an activity context, ask lesson questions, view source passages, flag a question, and mark a lesson reviewed. Lesson-reviewed status is self-reported, not a test of mastery.

## AI connection

**This computer now uses local Ollama mode.** See [LOCAL-AI.md](LOCAL-AI.md) for the installed runtime, startup steps, and limitations. The cloud settings below are optional alternatives; they are not used when AI_PROVIDER=ollama.

No API key is included or stored in browser code. Without a key, **Reference mode** retrieves and quotes matching teacher-written passages. It does not simulate an AI explanation.

Copy .env.example to .env.local in this folder, and enter OPENAI_API_KEY privately in your editor. Set AI_PROVIDER=openai and OPENAI_MODEL=gpt-4.1-mini. The local server reads it on startup. Do not paste the secret in chat, commit it, or include it in a source archive.

Default provider: OpenAI, using gpt-4.1-mini. OPENAI_MODEL is configurable; choose a compatible Chat Completions model supporting strict JSON schema output and temperature. Restart the server after changing settings. For hosted deployments, configure OPENAI_API_KEY as a server runtime secret and AI_PROVIDER/OPENAI_MODEL as runtime variables. There is no frontend key setting. An optional Groq adapter remains available only when AI_PROVIDER=groq, with GROQ_API_KEY and GROQ_MODEL. There is no automatic provider fallback or cross-provider key reuse.

The default integration uses [OpenAI Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create) with strict structured output. Requests set store=false, which does not itself enable zero data retention. Account access, limits, and API billing are managed in the OpenAI Platform. Do not enable paid upgrades without agreeing a budget.

The standard Gemini Developer API is no longer used because of its restrictions on under-18-directed applications. Before a school rollout, follow [OpenAI's under-18 guidance](https://developers.openai.com/api/docs/guides/safety-checks/under-18-api-guidance), including age-appropriate safeguards, moderation, and escalation. Do not process personal data of children under 13 or the applicable age of digital consent without implementing the required zero data retention. The current prototype has teacher flags and age-appropriate instructions but is not a completed student-safety deployment. Use sample lessons and fictional accounts during development.

The live provider path is implemented but has not been tested with a real API key. It supplies matching source passages, four recent turns from the same lesson/activity, teacher policy, and the student's question. It validates the response format and citation indexes. A provider error or unsupported response becomes a teacher-review item.

Retrieval currently uses word matching, not vector embeddings. Citations establish which passages were supplied; they do not prove that every generated statement is correct. Teacher instructions for hints, direct answers, and custom behavior are model instructions, not an absolute guarantee. Adversarial and pedagogical testing is needed before using generated responses with students.

## Accounts and deployment

Production uses platform-authenticated identity headers and server-side roles. On the new private site, the first signed-in user becomes the school owner and teacher. The owner must initialize the application **before** sharing access. All other accounts start as students. Only the owner can approve additional teacher emails. Each teacher controls their own classes and lesson records. Teacher approval does not send an email or grant access through the hosting platform; site sharing is a separate setting.

The source is configured for a private Sites application with D1 (`DB`) and R2 (`BUCKET`). The existing production build is `npm run build`; schema migrations are in `drizzle/`. No runtime schema creation occurs in the production API. The local preview uses a separate database adapter and cannot be deployed as the production server.

Publication did not complete in this session. The Windows environment prevented the normal build tools from launching child processes (`spawn EPERM`); the repository setup step was then blocked by automatic approval review. There is no verified live deployment URL. The local in-process build works without those child processes.

## What is implemented

- Teacher and student interfaces, plus teacher preview of the student interface.
- Classes, join codes, owner-approved teacher roles, and per-teacher lesson ownership.
- Lesson creation, editing, deletion, organization, search, draft/published state, and class/individual assignment.
- Activity creation/editing/removal, due dates, and independent-work settings.
- Per-lesson assistance modes, schedules, restricted topics, and custom policy.
- Source-based retrieval, Gemini integration, response citations, recorded conversation history, and rate limiting.
- Teacher question filters by subject, lesson, student, status, date, and search (including topic).
- Topic question counts, distinct learner counts, and repeated normalized question counts.
- Student flags, teacher follow-up notes, and review status.
- Resource upload/download, persistent records, and self-reported lesson review progress.

## Practical limits of this version

- Hosted accounts require access through the platform; school SSO and independent username/password registration are not implemented.
- No scan/OCR or automatic PDF, DOCX, or PPTX extraction.
- No assignment submission, grading, notifications, or learning-outcome measurement.
- Availability is date/time based; campus-only access, network location, and recurring weekly schedules are not implemented.
- Activity restrictions apply to the selected activity context. They cannot determine whether a student is doing a prohibited activity while asking in general lesson review. Disable assistance for the whole lesson during assessments when necessary.
- Analytics cover up to the latest 1,000 interactions. Repeated questions are grouped by normalized exact text, not semantic similarity; topic counts are not evidence of learning difficulty by themselves.
- The current small-school data access loads and filters lesson records before returning authorized records. Larger deployments should use normalized assignment tables and indexed database filtering.
- File validation restricts extension and size, and downloads as attachments. Content scanning is not included.
- Student data retention, backup/restore, institutional consent procedures, accessibility auditing, and a real school pilot remain deployment tasks.

## Verification

```powershell
node node_modules/typescript/bin/tsc --noEmit
node scripts/local-build.mjs
# With the local server running:
node scripts/verify-local.mjs
```

The functional suite exercised 36 API checks: teacher/student roles, unauthorized edits, unassigned students, class joining, draft visibility, source retrieval, out-of-scope handling, disabled assistance, future schedules, blocked topics, disabled activities, flags, teacher notes, attachment access, progress, and cross-origin rejection. It creates a temporary verification lesson and removes that lesson afterward. It uses fictional local accounts only.

Browser checks confirmed the dashboard renders at mobile and desktop widths, the student lesson view is usable, and a question submitted through the interface returns reference excerpts. No browser console errors were observed during these checks. Live Gemini, actual platform authentication, and production D1/R2 deployment remain unverified.

## Source map

- `app/study-scan.tsx`: teacher and student interface.
- `app/globals.css`: responsive application styling.
- `app/api/study/route.ts`: roles, lesson/class/activity operations, questions, and reviews.
- `app/api/files/route.ts`: authorized resource upload/download.
- `lib/server.ts`: database access, identity, authorization, and sample initialization.
- `lib/learning.ts`: availability and source retrieval.
- `db/schema.ts`, `drizzle/`: schema and generated migrations.
- `scripts/local-build.mjs`, `scripts/local-server.mjs`: in-process build and local demo server.
- `scripts/verify-local.mjs`: functional checks.
- `EVALUATION-PLAN.md`: proposed evaluation protocol; no fabricated results.
