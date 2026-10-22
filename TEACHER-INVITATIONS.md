# Teacher invitations

Teachers are invited only by an active Super Admin. Students cannot request or grant themselves Teacher access. New accounts always start as Students. Historical email preapprovals no longer affect sign-up; existing staff roles remain unchanged.

## Gmail setup

Use a Gmail account controlled by the school/operator. Enable Google 2-Step Verification, then create an app password specifically for StudyScan. Never use the normal Gmail password, paste credentials into chat, or add them to source control.

Privately add these values in Supabase → Edge Functions → Secrets:

| Name | Value |
| --- | --- |
| `TEACHER_MAIL_GMAIL` | The Gmail sender address, ending in `@gmail.com` |
| `TEACHER_MAIL_APP_PASSWORD` | The Google-generated app password for that sender |
| `TEACHER_MAIL_ENABLED` | `true` when the operator is ready to send invitations; `false` pauses sending |

The endpoint uses Gmail SMTP with certificate validation and implicit TLS on port 465. Credentials remain server-side. Sending uses a fixed StudyScan template and a fixed production URL, not a browser-supplied message or redirect. No invitation email is sent while credentials are absent or delivery is paused. The admin interface reports this instead of falsely reporting success. Gmail is a small-volume option subject to Google's account and sending limits, not a school-wide delivery SLA. Some managed accounts cannot create app passwords.

**Keep delivery paused while the site's browser security warning is unresolved.** Do not ask teachers to bypass browser protections. A final live delivery and recipient acceptance run is required after configuring the sender and clearing that warning.

Official instructions: [Google app passwords](https://support.google.com/mail/answer/185833), [Supabase SMTP example](https://github.com/supabase/supabase/blob/master/examples/edge-functions/supabase/functions/send-email-smtp/README.md).

## Flow and controls

1. Admin enters an existing Google account email. The application cannot silently prove that a Gmail address exists or belongs to a teacher; the school verifies teaching eligibility and Google sign-in proves control of the exact invited email.
2. Server authenticates the administrator and reserves an invitation. It generates a random 256-bit token; only its SHA-256 hash is stored in the database.
3. Gmail receives the fixed invitation email. SMTP acceptance is recorded separately from invitation acceptance; it does not guarantee arrival in the inbox. A failed or unconfirmed delivery cannot grant Teacher access.
4. Recipient opens the production link. Its token is in the URL fragment, removed from the visible URL, and kept temporarily in that browser tab's session storage so it can survive Google sign-in. No GET request accepts an invitation.
5. Recipient signs in with a verified, matching Google identity and clicks **Accept invitation**. Database authorization checks the hash, email, Google identity, account status, inviter's current authority, delivery state, expiry, and revocation before atomically granting Teacher access.
6. Resend rotates the token and resets the 7-day expiry. Old links stop working. A 1-minute resend cooldown, 10 sends/hour per admin, and 30 sends/hour school-wide limit abuse. Accepted invitations cannot be replayed to restore a demoted Teacher role.

Only admins can list/revoke invitations. The browser never receives stored token hashes or email credentials. Invite tokens are not returned in send responses or written to audit records. Admin list displays the latest 200 invitations. Historical access requests remain in the database for recordkeeping but cannot be submitted, reviewed for elevation, or retrieved through the current workspace API.

## Verification

Run `node scripts/verify-invitations.mjs` for PostgreSQL authorization/acceptance boundaries and `node scripts/verify-invitation-email.mjs` for the mocked email endpoint. The email tests deliberately send no real messages. `npx tsc --noEmit` and the production build must also pass. Actual Gmail credentials, SMTP delivery, inbox placement, and cross-device acceptance still require a live operator-assisted check.
