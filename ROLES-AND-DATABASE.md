# StudyScan roles and database plan

## Implemented roles

| Role | Permissions |
| --- | --- |
| Super Admin | School usage counts, teacher-email approval, role assignment, account suspension/reactivation, school assistance settings, and administrative audit log. |
| Teacher | Their own classes, learning materials, assignments, attachments, assistance settings, and classroom questions. Cannot approve teachers or change roles. |
| Student | Class-code joining, assigned published lessons, personal questions, progress, and flagging their conversations. |

Super Admin summaries exclude lesson bodies and student conversation contents. The primary administrator and the acting administrator are protected against demotion or suspension. Suspension is checked on every authenticated request. Role changes revoke old teacher email approval, preventing a demotion from being undone on the next login. Server administrative changes and audit entries are committed together.

School assistance pauses and blocked topics apply in addition to teacher restrictions. Enabling school assistance does not override disabled lessons or assessments or connect an AI provider.

Changing a teacher's role does not transfer classroom ownership. Keep existing teachers active until their classes have been handed over through an agreed migration; reassignment tooling is outside this update.

## Demo and local operation

Vercel remains a browser-local demonstration. Super Admin, Teacher, and Student buttons select sample identities, not secure login accounts. Roles, sample approvals, suspensions, policies, and audit records are stored in the current browser. Use sample information only. Existing demo lesson data is preserved when role metadata is added. Demo teacher approval creates or updates a sample account, with no invitation email or real authentication.

The loopback local server includes separate administrator, teacher, student, and unassigned-student identities. It applies `drizzle/0001_roles.sql` once, preserving lesson data. Existing local teacher materials remain owned by the teacher while the school administrator becomes a separate account.

Apply tracked database migrations before deploying the authenticated Cloudflare server. A fresh school requires a server-only `SUPER_ADMIN_EMAIL` matching its administrator's authenticated email. An existing `school-owner` remains primary administrator. An arbitrary first visitor is never promoted. The environment must supply trusted authenticated identity; the Vercel static demo does not deploy these API routes.

Verification: `node scripts/local-build.mjs`, `node scripts/verify-roles.mjs`, and `node scripts/verify-demo.mjs`. Server tests use a disposable in-memory database with both migrations.

## Production database recommendation

Use managed PostgreSQL through Supabase for a future Vercel production version. Relational accounts, memberships, lessons, assignments, and interactions fit PostgreSQL. Supabase also provides Auth, Storage, and PostgreSQL Row Level Security. It has not been provisioned or connected by this update.

For **1,000 simultaneous users**, monthly active user allowances are not concurrency benchmarks. Visitors, API requests per second, active SQL queries, database connections, file downloads, and AI requests are different quantities.

Before production:

1. Replace D1 and identity adapters with PostgreSQL/Supabase integration. Translate SQLite migrations deliberately; they cannot be applied directly to PostgreSQL.
2. Use verified Auth identities, school-scoped profiles and memberships, and server-controlled roles. Enforce database RLS for teacher ownership and student access. Never expose service-role credentials to the browser.
3. Use the Data API with RLS or transaction pooling for serverless SQL. Do not open a direct database connection per visitor.
4. Replace whole-table reads and JSON access filtering with indexed, authorized queries and pagination. The current demo API is not optimized or certified for 1,000 concurrent users.
5. Use protected object storage for resources, CDN caching for static assets, and bounded signed downloads. Add foreign keys and indexes during the PostgreSQL migration.
6. Add request and AI rate limits, bounded AI concurrency, queues where needed, and provider timeouts. The small local Ollama model is not sized for 1,000 simultaneous students.
7. Load-test 1,000 virtual users with realistic read/write patterns and teacher/student mixes. Test AI separately against explicit budget and rate limits. Measure latency, errors, CPU, memory, connection waits, and queue times before choosing compute and scaling limits.

Illustrative traffic: 1,000 users making one request every ten seconds means about 100 requests/second. This is not a benchmark or capacity guarantee. A burst of 1,000 AI questions has a separate capacity and cost profile.

Supabase Pro currently starts at US$25/month, including the compute credit for one Micro project. Larger compute and usage may increase the bill. Hosting, email delivery, AI usage, and maintenance are separate costs. No paid plan has been activated.

Primary references:

- https://supabase.com/pricing
- https://supabase.com/docs/guides/database/connecting-to-postgres
- https://supabase.com/docs/guides/database/postgres/row-level-security
