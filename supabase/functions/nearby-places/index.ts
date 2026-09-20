/**
 * nearby-places — Supabase Edge Function
 *
 * Proxies Google Places "Nearby Search (New)" so the API key never ships in
 * the app bundle.
 *
 * Why this exists
 * ───────────────
 * The client used to call Google directly with EXPO_PUBLIC_GOOGLE_PLACES_KEY,
 * which is inlined into the JS bundle — anyone could unzip the release and
 * spend the project's Places quota. Google's Android app-signature restriction
 * does not help, because a plain React Native `fetch` never sends the
 * X-Android-Package / X-Android-Cert headers it checks.
 *
 * Two extra wins over the old direct calls:
 *   • Caching by ~1.1 km grid cell for 24h. Two users on the same street share
 *     a cache entry, and repeated pull-to-refresh costs nothing.
 *   • Per-caller hourly rate limiting, so a stuck retry loop cannot run up an
 *     unbounded Google bill.
 *
 * Secrets: GOOGLE_PLACES_KEY
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const NEARBY_URL  = 'https://places.googleapis.com/v1/places:searchNearby';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Requests per caller per hour. Each request is 2 Google calls. */
const RATE_LIMIT_SIGNED_IN = 40;
const RATE_LIMIT_ANON      = 10;

const MAX_PER_REQUEST = 20;   // Google hard cap
const MAX_RADIUS_M    = 20_000;
const MIN_RADIUS_M    = 500;

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/**
 * Field mask — selects the Nearby Search Pro SKU.
 * Keep in sync with the RawPlace interface in src/services/placesService.ts.
 */
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.location',
  'places.types',
  'places.primaryType',
  'places.rating',
  'places.userRatingCount',
  'places.businessStatus',
  'places.regularOpeningHours.openNow',
  'places.photos',
  'places.formattedAddress',
  'places.shortFormattedAddress',
  'places.editorialSummary',
].join(',');

// Two groups so all eight Gati categories get coverage.
const TYPES_FOOD_SOCIAL = [
  'cafe', 'coffee_shop',
  'restaurant', 'fast_food_restaurant', 'pizza_restaurant',
  'chinese_restaurant', 'indian_restaurant', 'thai_restaurant',
  'bar', 'pub', 'night_club', 'wine_bar', 'cocktail_bar',
  'shopping_mall', 'market', 'supermarket',
];

const TYPES_CULTURE_NATURE = [
  'book_store', 'library',
  'art_gallery', 'art_museum',
  'museum', 'history_museum', 'historical_landmark', 'monument', 'cultural_landmark',
  'tourist_attraction',
  'park', 'national_park', 'botanical_garden', 'garden',
  'hiking_area', 'nature_preserve',
];

// ─── Handler ──────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const apiKey = Deno.env.get('GOOGLE_PLACES_KEY');
  if (!apiKey) {
    console.error('[nearby-places] GOOGLE_PLACES_KEY is not set');
    return json({ error: 'Place search is not configured' }, 500);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // ── Input ──
  let latitude: number;
  let longitude: number;
  let radius: number;
  try {
    const body = await req.json();
    latitude  = Number(body.latitude);
    longitude = Number(body.longitude);
    radius    = Number(body.radius ?? 8000);

    if (!Number.isFinite(latitude)  || latitude  < -90  || latitude  > 90)  throw new Error('lat');
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error('lon');
    if (!Number.isFinite(radius)) radius = 8000;
    radius = Math.min(MAX_RADIUS_M, Math.max(MIN_RADIUS_M, radius));
  } catch {
    return json({ error: 'Invalid coordinates' }, 400);
  }

  // ── Identify the caller for rate limiting ──
  // Signed-in users are limited by account; signed-out users by IP, which is
  // coarse but enough to stop a single device looping the endpoint.
  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  let subject = '';
  let limit   = RATE_LIMIT_ANON;

  if (jwt) {
    const { data } = await supabase.auth.getUser(jwt);
    if (data?.user) {
      subject = data.user.id;
      limit   = RATE_LIMIT_SIGNED_IN;
    }
  }
  if (!subject) {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('cf-connecting-ip') ||
      'unknown';
    subject = `ip:${ip}`;
  }

  const { data: allowed, error: rlError } = await supabase.rpc('consume_rate_limit', {
    p_subject:  subject,
    p_endpoint: 'nearby-places',
    p_limit:    limit,
  });
  // Fail OPEN on a rate-limiter error: a broken counter should not take place
  // search down. Fail CLOSED on an actual limit hit.
  if (!rlError && allowed === false) {
    return json({ error: 'Rate limit exceeded' }, 429);
  }

  // ── Cache ──
  // 2dp ≈ 1.1 km. Coarse enough for a meaningful hit rate, fine enough that
  // results are still genuinely "nearby" for an 8 km search.
  const cacheKey = `${latitude.toFixed(2)},${longitude.toFixed(2)},${radius}`;

  const { data: cached } = await supabase
    .from('places_cache')
    .select('payload, created_at')
    .eq('cache_key', cacheKey)
    .maybeSingle();

  if (cached && Date.now() - new Date(cached.created_at).getTime() < CACHE_TTL_MS) {
    return json({ places: cached.payload, cached: true });
  }

  // ── Fetch from Google ──
  try {
    const [foodSocial, cultureNature] = await Promise.all([
      searchNearby(apiKey, latitude, longitude, TYPES_FOOD_SOCIAL, radius),
      searchNearby(apiKey, latitude, longitude, TYPES_CULTURE_NATURE, radius),
    ]);

    const places = [...foodSocial, ...cultureNature];

    // Only cache a useful answer — caching an empty result would pin a dead
    // grid cell for 24 hours after a transient Google outage.
    if (places.length > 0) {
      await supabase.from('places_cache').upsert(
        { cache_key: cacheKey, payload: places, created_at: new Date().toISOString() },
        { onConflict: 'cache_key' },
      );
    }

    return json({ places, cached: false });
  } catch (e) {
    console.error('[nearby-places]', e);
    // Serve stale cache rather than nothing when Google is unreachable.
    if (cached?.payload) return json({ places: cached.payload, cached: true, stale: true });
    return json({ error: 'Place search is temporarily unavailable' }, 502);
  }
});

// ─── Google call ──────────────────────────────────────────────

async function searchNearby(
  apiKey:       string,
  lat:          number,
  lon:          number,
  includedTypes: string[],
  radius:       number,
): Promise<unknown[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);

  try {
    const res = await fetch(NEARBY_URL, {
      method: 'POST',
      headers: {
        'Content-Type':     'application/json',
        'X-Goog-Api-Key':   apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify({
        locationRestriction: { circle: { center: { latitude: lat, longitude: lon }, radius } },
        includedTypes,
        maxResultCount: MAX_PER_REQUEST,
        rankPreference: 'POPULARITY',
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn('[nearby-places] Google error', res.status, await res.text());
      return [];
    }

    const data = await res.json();
    return Array.isArray(data.places) ? data.places : [];
  } finally {
    clearTimeout(timer);
  }
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });
}
