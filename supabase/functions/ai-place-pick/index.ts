/**
 * ai-place-pick — Supabase Edge Function
 *
 * Generates a personalised 1-sentence blurb explaining why Gati picked a
 * specific place for this user, based on their interest scores.
 *
 * Request (POST, JSON):
 *   {
 *     placeId:        string,
 *     placeName:      string,
 *     category:       string,          // e.g. "cafe", "nature", "museum"
 *     categoryScores: Record<string, number>,  // e.g. { cafe: 82, nature: 60 }
 *   }
 *   Authorization: Bearer <user JWT>
 *
 * Environment secrets required:
 *   OPENAI_API_KEY  — secret key from platform.openai.com
 *
 * Returns:
 *   200 { blurb: string }   — personalised pick reason (≤ 20 words)
 *   400 { error: string }   — missing/invalid request fields
 *   401 { error: string }   — not authenticated
 *   500 { error: string }   — OpenAI or internal error
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Blurbs per user per hour.
 *
 * This endpoint was previously unmetered: the Wander feed requests five blurbs
 * per refresh, and pull-to-refresh rotates to five NEW places, so a user
 * holding the gesture generated unbounded gpt-4o-mini calls on our key. The
 * client also caches per-device only, so the same place was regenerated for
 * every user — hence the shared server-side cache below.
 */
const RATE_LIMIT_PER_HOUR = 30;
const BLURB_CACHE_TTL_MS  = 30 * 24 * 60 * 60 * 1000;   // 30 days

const admin = () => createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// ── User auth check ──────────────────────────────────────────────

async function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt        = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) return null;

  const { data: { user } } = await admin().auth.getUser(jwt);
  return user ?? null;
}

// ── OpenAI call ──────────────────────────────────────────────────

async function generateBlurb(
  placeName:      string,
  category:       string,
  categoryScores: Record<string, number>,
): Promise<string> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  // Build a compact interest summary (top 3 scores, sorted desc)
  const topInterests = Object.entries(categoryScores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([cat]) => cat)
    .join(', ');

  const prompt = [
    `You are Gati, a life-aware place discovery app.`,
    `Write exactly ONE sentence (≤ 18 words) explaining why this place was picked for a user.`,
    `Place: "${placeName}" (category: ${category})`,
    `User's top interests: ${topInterests || category}`,
    `Rules: personal, specific to the category and user interests, warm tone.`,
    `Start with "Matched to your" or similar. No quotes. No period at the end is fine.`,
  ].join('\n');

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      model:       'gpt-4o-mini',
      max_tokens:  60,
      temperature: 0.75,
      messages:    [{ role: 'user', content: prompt }],
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`OpenAI error ${resp.status}: ${body}`);
  }

  const data = await resp.json();
  const text = (data.choices?.[0]?.message?.content ?? '').trim();
  if (!text) throw new Error('Empty response from OpenAI');
  return text;
}

// ── Handler ──────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Handle CORS pre-flight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // Auth
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // Parse body
  let placeId: string;
  let placeName: string;
  let category: string;
  let categoryScores: Record<string, number>;
  try {
    const body = await req.json();
    placeId        = String(body.placeId ?? '').slice(0, 128);
    placeName      = body.placeName;
    category       = body.category ?? '';
    categoryScores = body.categoryScores ?? {};
    if (!placeName || !placeId) throw new Error('Missing placeId or placeName');
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const supabase = admin();

  // ── Shared cache ──
  // Keyed on place + category only, not on the user's interest scores: the
  // blurb is about the place, and a per-user key would defeat the cache
  // entirely. A cache hit costs nothing and does not consume rate limit.
  const cacheKey = `blurb:${placeId}:${category}`;
  const { data: cached } = await supabase
    .from('places_cache')
    .select('payload, created_at')
    .eq('cache_key', cacheKey)
    .maybeSingle();

  if (cached && Date.now() - new Date(cached.created_at).getTime() < BLURB_CACHE_TTL_MS) {
    const blurb = (cached.payload as { blurb?: string })?.blurb;
    if (blurb) {
      return new Response(JSON.stringify({ blurb, cached: true }), {
        status:  200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
  }

  // ── Rate limit ──
  const { data: allowed, error: rlError } = await supabase.rpc('consume_rate_limit', {
    p_subject:  user.id,
    p_endpoint: 'ai-place-pick',
    p_limit:    RATE_LIMIT_PER_HOUR,
  });
  if (!rlError && allowed === false) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status:  429,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  try {
    const blurb = await generateBlurb(placeName, category, categoryScores);

    await supabase.from('places_cache').upsert(
      { cache_key: cacheKey, payload: { blurb }, created_at: new Date().toISOString() },
      { onConflict: 'cache_key' },
    );

    return new Response(JSON.stringify({ blurb, cached: false }), {
      status:  200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[ai-place-pick]', e);
    // Do not leak the provider error (it can echo the prompt or key state).
    return new Response(JSON.stringify({ error: 'Could not generate a blurb' }), {
      status:  500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
