/**
 * delete-account — Supabase Edge Function
 *
 * Permanently deletes the caller's account and every row belonging to it.
 *
 * Required by Google Play's User Data policy (an app that offers account
 * creation must offer in-app account deletion, and a deletion route must be
 * reachable from the store listing) and by App Store guideline 5.1.1(v).
 * Gati previously had no deletion path at all — only sign-out.
 *
 * POST { confirm: true }
 * Authorization: Bearer <user JWT>
 *
 * Deleting the auth.users row cascades to every table that references it;
 * `purge_user_data` runs first so nothing is left behind by a table that was
 * added without a cascading FK.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'Unauthorized' }, 401);

  // Require an explicit confirmation flag so a stray request can never delete
  // an account by accident.
  try {
    const body = await req.json();
    if (body?.confirm !== true) {
      return json({ error: 'Deletion must be explicitly confirmed' }, 400);
    }
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: { user }, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !user) return json({ error: 'Invalid auth token' }, 401);

  try {
    // Application rows first, so a failure here does not leave an orphaned
    // auth user with no way to sign in and retry.
    const { error: purgeErr } = await supabase.rpc('purge_user_data', {
      p_user_id: user.id,
    });
    if (purgeErr) throw new Error(purgeErr.message);

    const { error: authErr } = await supabase.auth.admin.deleteUser(user.id);
    if (authErr) throw new Error(authErr.message);

    console.log(`[delete-account] deleted user ${user.id}`);
    return json({ ok: true });
  } catch (e) {
    console.error('[delete-account]', e);
    return json(
      { error: 'Could not delete the account. Please try again or contact support.' },
      500,
    );
  }
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });
}
