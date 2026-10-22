# Browser warning investigation — October 22, 2026

## Confirmed classification

Google Transparency Report classified `https://studyscan-green.vercel.app/` as unsafe. After ownership verification for the operator-selected Google account, Search Console identified **Deceptive pages** and listed the homepage as the sample URL. This report does not establish why Google's classifier reached that conclusion.

## Checks and changes

- Inspected the sign-in implementation: email/password authentication uses Supabase; Google sign-in uses Supabase OAuth with Google, not an imitation Google credential form.
- Compared the deployed JavaScript to the maintained release bundle; they matched. No Groq `gsk_` or Supabase `sb_secret_` key patterns were detected in that inspected bundle. This pattern check is not an exhaustive secret scan.
- Verified that the homepage only loads the expected local `/client.js` module. No unexpected external script or automatic software download was found in the inspected homepage.
- Verified `/.env` and `/.git/config` return 404. Anonymous workspace, mutation, and assistant requests were rejected.
- Restored Content-Security-Policy, Permissions-Policy, and frame restrictions in `vercel.json`. Prebuilt deployment now derives its headers from the same configuration, preventing the ordinary Git deployment path from losing those controls.
- Added operator identity, explicit separation of StudyScan and Google passwords, and public About and Data & privacy pages. The notice describes actual data processing and does not assert school compliance or automatic retention/deletion.
- Published Google's public site-verification tag for the operator-selected account. Keep it in the homepage build so ownership is retained.

## Review request

With the operator's explicit permission, submitted a Search Console security review describing the above checks and changes. Google displayed **Request submitted successfully.** The warning was still active at the end of this investigation. Submission is not approval, and no clearance date is guaranteed.

Do not disable browser protections, ask learners to bypass the warning, or move domains merely to evade classification. Review the Search Console result and address any further evidence Google provides.

## Verification and limits

`npx tsc --noEmit` passed. Build and deployment succeeded. `node scripts/verify-public-site.mjs` passed against the public deployment. Browser QA checked the updated sign-in disclosure and linked privacy page on a local copy of that release without bypassing the production browser warning.

This was a targeted investigation, not a complete penetration test, account-compromise investigation, dependency audit, or legal review. Previously exposed credentials must be revoked by the operator even if a page review is approved. School onboarding, retention procedures, account security, and operational testing remain separate responsibilities.

References: [Google Security Issues report guidance](https://support.google.com/webmasters/answer/9044101), [Google browser warning guidance](https://support.google.com/chrome/answer/99020).
