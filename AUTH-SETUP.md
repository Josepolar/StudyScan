# StudyScan account sign-in

The Vercel homepage now presents sign-in and sign-up. It supports Google OAuth, email/password registration with email confirmation, password recovery, session verification, and sign-out through Supabase Auth.

## Account data and permissions

Apply `supabase/001_accounts.sql` using the Supabase SQL Editor or an authenticated management connection. This creates namespaced PostgreSQL account tables with RLS. The migration has been applied to the connected StudyScan project.

New verified accounts receive the Student role. Signup metadata never determines privileged roles. Approved teacher emails receive Teacher access. Existing users get a profile on their first verified StudyScan sign-in. Super Admin role/status management uses database functions that verify the current authenticated administrator, protect the primary owner, and record changes atomically. Ordinary users cannot directly update role/status or read other profiles.

After the school owner signs in once, a trusted project operator can promote that exact verified account in the SQL Editor:

```sql
update public.studyscan_profiles
set role='super-admin',is_primary_admin=true
where email='YOUR_VERIFIED_ADMIN_EMAIL';
```

There is no hardcoded administrator, default password, first-visitor promotion, or role selection during signup. Real authenticated sessions have no demo role-switch buttons. Only the separate public sample preview at `/?demo=1` has simulated role switching.

## Public build configuration

Set these Vercel production environment variables, then rebuild:

```text
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

These settings are intentionally public. The build rejects secret/service-role keys. Never put a Google secret, service-role key, database password, or OAuth management token in frontend code, source control, or public environment variables.

## Required dashboard configuration

Supabase Authentication → URL Configuration:

- Site URL: `https://studyscan-green.vercel.app`
- Redirect URL: `https://studyscan-green.vercel.app/`
- Password recovery Redirect URL: `https://studyscan-green.vercel.app/?auth=recovery`

For Google, create an OAuth client of type Web application in Google Cloud:

- Authorized JavaScript origin: `https://studyscan-green.vercel.app`
- Authorized redirect URI: `https://xnhkpavzbgxvptxocubf.supabase.co/auth/v1/callback`

Configure the Google consent screen and audience. If the Google application is in testing, add the intended test users there. Enter its Client ID and secret directly in Supabase → Authentication → Sign In / Providers → Google; enable and save the provider. Do not paste the secret into chat. A Google password is entered only on Google's sign-in page.

The frontend checks provider availability. When Google is disabled, it explains that Google sign-in is being configured and offers email sign-in instead.

Keep email confirmation enabled. Configure custom SMTP before inviting broader school use; Supabase's built-in mail service has recipient and rate limits. Never claim an account was created solely from a confirmation screen: verify that email confirmation, sign-in, and the account profile all succeed.

## Scope of this version

Authentication and profile/role administration are real Supabase operations. Lessons, class settings, assignments, files, and conversations remain sample data stored in the current browser. Each authenticated user has a separate sample storage namespace; resetting sample data preserves their account. Administrators' account lists and account audit records come from Supabase; classroom counts/settings remain samples. Live AI is still separate and is not enabled by this integration.

This does not complete the future migration of classroom data or certify capacity for 1,000 simultaneous users. The existing authenticated Cloudflare API remains a separate implementation; the Vercel build serves this browser app and Supabase integration.

## Verification

```text
node scripts/verify-auth.mjs
node scripts/verify-demo.mjs
npx tsc --noEmit
node scripts/build-vercel-demo.mjs
```

`verify-auth.mjs` executes the account migration in PostgreSQL via PGlite, testing RLS, role-metadata spoofing, self-escalation, account privacy, protected ownership, teacher approval/revocation, suspension, and audit records. It does not create a real email account or send email.

Manual acceptance: register an email account, confirm the link, sign in, refresh, sign out, complete password reset, and sign in with Google after enabling it. The Supabase dashboard should show the verified user and Student profile.

References:

- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/auth/redirect-urls
