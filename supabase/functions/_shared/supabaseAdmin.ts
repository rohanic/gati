/**
 * Supabase admin client — uses the service role key so it bypasses RLS.
 * Only for use inside Edge Functions. Never expose to client code.
 */
// @deno-types="https://esm.sh/@supabase/supabase-js@2/dist/module/index.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

/**
 * Validates a CRON_SECRET header sent by pg_cron or Supabase Dashboard
 * scheduled invocations. Prevents unauthorized callers from triggering sends.
 *
 * Set CRON_SECRET in Supabase Dashboard → Edge Functions → [fn] → Secrets.
 * Use the same value when scheduling via pg_cron.
 */
export function validateCronSecret(req: Request): boolean {
  const secret = Deno.env.get('CRON_SECRET');

  // FAIL CLOSED. This used to `return true` when CRON_SECRET was unset, so a
  // production deploy that forgot the secret let anyone who knew the function
  // URL blast a push notification to every user on the platform.
  if (!secret) {
    console.error(
      '[cron] CRON_SECRET is not set — refusing to run. ' +
      'Set it with: supabase secrets set CRON_SECRET=<random>',
    );
    return false;
  }

  const provided = req.headers.get('x-cron-secret');
  if (!provided) return false;
  return timingSafeEqual(provided, secret);
}

/**
 * Constant-time string comparison, so response timing cannot be used to
 * recover the secret byte by byte.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Extracts and verifies the user JWT from the Authorization header.
 * Returns the user object if valid, null otherwise.
 */
export async function getUserFromRequest(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const jwt = authHeader.slice(7);
  const { data, error } = await supabaseAdmin.auth.getUser(jwt);
  if (error || !data.user) return null;
  return data.user;
}
