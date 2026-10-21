# StudyScan deployment and school setup

## Current architecture

Vercel serves the signed-in web application. Supabase Auth handles Google and email accounts. PostgreSQL stores school settings, roles, classes, memberships, lessons, activity submissions, teacher feedback, progress, teacher requests, and assistant conversations. Supabase Storage holds private learning resources. The `study-assistant` Edge Function handles document extraction and hosted inference.

Authenticated classrooms no longer use browser-local sample records. The public `?demo=1` shortcut no longer enables a simulated account. An isolated local showcase is available to developers through `node scripts/build-vercel-demo.mjs --preview`; it is excluded from the production bundle.

## School onboarding

1. The designated owner signs in and is promoted through a trusted project operation. There are no default admin passwords or automatic first-user promotion rules.
2. Teachers sign in and submit a Teacher access request, or the owner preapproves a known teacher's verified email.
3. The owner checks the person's teaching role with the school and approves or declines the request. Decisions are visible in the applicant's account. This workflow does not send notification emails.
4. Teachers create classes and share join codes with signed-in students.
5. Teachers create lessons, import accessible PDF/Word/PowerPoint/TXT/Markdown text, review the extracted text, configure assistance, select classes/students, and publish.
6. Students join their classes and use assigned lessons, submit activities, track reviewed lessons, and read teacher feedback. Teachers review submissions and flagged conversations.

School accounts and classrooms initially have no invented students or sample materials. Prior browser sample data is not automatically imported into school records.

## Free hosted AI

The current endpoint uses Groq's Free tier with `openai/gpt-oss-20b` for generation and `openai/gpt-oss-safeguard-20b` for a safety check before an answer is shown. There is no paid provider fallback. Keep the Groq account on Free and do not add or enable billing. Application code cannot independently prove an account's billing tier; the account owner must maintain that setting.

In Supabase → Edge Functions → Secrets, privately configure:

| Secret | Value |
| --- | --- |
| `GROQ_API_KEY` | Key created in the school's/adult operator's Groq Free account |
| `AI_FREE_TIER_CONFIRMED` | `true` after confirming the account is on Free |
| `AI_SCHOOL_USE_CONFIRMED` | `true` after the school authorizes use and addresses age, consent, and privacy requirements |

Do not put keys in source control, browser code, `NEXT_PUBLIC_*` settings, screenshots, or chat. Earlier Gemini/OpenAI setup instructions do not apply to this free-only endpoint. Gemini Developer API is not used because its application-age restrictions do not fit this Grade 9 product.

The Super Admin then enables school assistance and sets a daily request allowance in School settings. The initial allowance is 50 requests/day; assistance starts paused. Each teacher separately authorizes an eligible student's AI use through Manage class. Do not authorize younger learners who do not meet the applicable age and consent requirements under this setup. No birth dates are collected for this attestation.

Limits are checked in PostgreSQL before generation: two school-wide requests/minute, the configured school-wide daily allowance, six interactions/minute per account, and 50 interactions/day per account. Provider token/request limits can still reject a request sooner. Failed safety checks and provider failures never expose an unchecked answer; the student receives a teacher follow-up path. Inference errors and restricted/out-of-scope questions are recorded for classroom review.

**Free inference cannot support a promise of 1,000 simultaneous AI conversations.** Capacity, quotas, latency, and availability remain subject to Groq's Free plan. This is a deployment constraint, not something a frontend change removes. The remaining web modules are independent of inference availability.

## Resource handling

Resources are private and limited to 10 MB. Text is extracted from accessible PDFs, `.docx`, `.pptx`, `.txt`, and `.md`; a teacher must review and save it before it becomes an approved AI source. Image-only/scanned PDFs need OCR or an accessible text version; OCR is not implemented. Extraction does not send documents to an AI provider. The assistant receives selected source text and conversation context without account email/name, but questions and source text may themselves contain personal information. Instruct users not to include personal data.

## Security boundaries

New accounts are Students. Privileged roles cannot come from signup metadata or local storage. Classroom tables have RLS enabled and no direct anonymous/authenticated table-write grants. Authenticated database functions verify active profiles and enforce teacher ownership, lesson assignment, student ownership, and administrator permissions. AI result-writing functions are callable only by the backend service role. Storage policies enforce teacher ownership and student lesson access.

Transfers move classes and lessons to another active teacher and preserve their related work. The original owner/own administrator account is protected. Active classes must be transferred or archived before a teacher is demoted or suspended. Record deletion and archival require explicit in-app confirmation. The service-role key stays inside the Supabase function environment.

Schools still need their own learner access/consent procedures, privacy notice and retention policy, backup/restore procedures, and incident response. This code change does not assert legal compliance or substitute for a school decision. Configure SMTP for reliable email-password registration and recovery; Google login is independent of SMTP. Supabase's password-security advisory should also be reviewed in the project's authentication settings.

## Build and verification

```text
npx tsc --noEmit
node scripts/verify-auth.mjs
node scripts/verify-classroom.mjs
node scripts/verify-cloud-assistant.mjs
node scripts/verify-edge.mjs
node scripts/build-vercel-demo.mjs
node scripts/prepare-vercel.mjs
```

Database verification uses real PostgreSQL in PGlite to check cross-teacher isolation, student assignment boundaries, private resources, submissions/feedback, approval requests, AI permissions/allowances, and membership revocation. Hosted-assistant checks use fixtures to verify request/response contracts and real document extraction. They do not prove live provider access or school-wide capacity.

Apply migrations `supabase/001_accounts.sql` through `009_school_settings_safe_update.sql` in order. Deploy the function with its `index.js`, `core.mjs`, and `documents.mjs`, with JWT verification enabled. The connected Supabase project has received these migrations and the Edge Function.

Before a school launch, complete a real teacher/student cross-account acceptance run, exercise the actual free provider key and safety endpoint, verify recovery-email delivery if email/password is offered, test backup restoration, and measure the intended concurrent workload against the selected infrastructure plan. These live operational checks remain necessary; automated checks alone do not establish production readiness.

Official references: [Groq plan/billing details](https://console.groq.com/docs/billing-faqs), [shared rate limits](https://console.groq.com/docs/rate-limits), [service terms](https://console.groq.com/docs/legal/services-agreement), [Supabase function secrets](https://supabase.com/docs/guides/functions/secrets).
