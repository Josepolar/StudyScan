# StudyScan

StudyScan is a school learning workspace where teachers create and share lessons, assign activities, and review student submissions, while students access class materials and teacher-controlled AI study support. It brings classroom resources, assignments, feedback, and progress together in one platform.

## Tech stack

Next.js 16, React 19, TypeScript, and Tailwind CSS 4; Supabase Auth, PostgreSQL, Storage, and Edge Functions; Drizzle ORM; deployed on Vercel.

## Features and impact

- Used by a school community of 1,000 students.
- Teacher-reviewed lesson imports from PDF, Word, PowerPoint, text, and Markdown files, with AI assistance based on teacher-approved source material.
- Classroom assignments, student submissions, teacher feedback, and lesson progress tracking.

See [PRODUCTION-SETUP.md](PRODUCTION-SETUP.md) for the current architecture, school onboarding, free-only Groq setup, verification, and remaining launch checks. Live inference needs a private Groq Free key and school authorization; free-plan capacity is limited.

See [AUTH-SETUP.md](AUTH-SETUP.md) for Google OAuth and recovery-email configuration. [EVALUATION-PLAN.md](EVALUATION-PLAN.md) describes the proposed academic evaluation.

Older demo/local-server guides describe the previous prototype and are not the deployed application's data architecture.
