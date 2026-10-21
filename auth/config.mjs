export function publicAuthConfig(environment) {
  const url = (environment.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const key = (environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '').trim();
  if (!url && !key) return null;
  if (!url || !key) throw Error('Both public Supabase settings are required.');
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.supabase.co') || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) throw Error('Use the HTTPS Supabase project origin.');
  if (!key.startsWith('sb_publishable_')) throw Error('Only a Supabase publishable key may enter the browser build. Secret and service-role keys are forbidden.');
  return { url: parsed.origin, key };
}
