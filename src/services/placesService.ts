/**
 * Real nearby places.
 *
 * ── Why this goes through an edge function ───────────────────────────────
 * This module used to call the Google Places API directly with
 * `EXPO_PUBLIC_GOOGLE_PLACES_KEY`. That key was inlined into the JS bundle,
 * so anyone could unzip the release and bill Gati's Google Cloud project.
 * Google's Android app-signature restrictions do NOT fix that, because a
 * plain `fetch` from React Native never sends the `X-Android-Package` /
 * `X-Android-Cert` headers the restriction checks.
 *
 * Search now runs through the `nearby-places` edge function, which holds the
 * key as a Supabase secret, caches results per ~1 km grid cell for 24h, and
 * rate-limits per caller. Photos go through `place-photo`, which 302-redirects
 * to Google so images stay lazy (only visible cards cost a Photo request).
 *
 * Quality gating and category mapping stay on the client: they are pure,
 * cheap, and covered by unit tests.
 */
import type { WanderPlace, InterestCategory } from '@/types';
import { SUPABASE_URL, SUPABASE_ANON_KEY, IS_CLOUD_CONFIGURED } from '@/config';
import { supabase } from '@/services/supabase';
import { fetchGatiScores } from '@/services/cloudSync';
import { candidateWorth } from '@/engine/relevance';
import { format } from 'date-fns';

// ─── Constants ────────────────────────────────────────────────
/**
 * Search radius.
 *
 * Reduced from 8 km. Google ranks its own results by popularity WITHIN the
 * radius, so a wide net returns the most famous places in the whole disc —
 * which is how a museum across the city displaced the good café down the
 * street before Gati's own ranking ever ran. 5 km still covers a short drive
 * while keeping the returned set genuinely local.
 */
const SEARCH_RADIUS_M = 5000;
const MAX_PER_CAT     = 10;    // top 10 per category from the ranked pool
const REQUEST_TIMEOUT_MS = 15_000;

// Quality floors — ALL must pass before a place enters the pool.
const QUALITY_MIN_RATING  = 3.8;
const QUALITY_MIN_REVIEWS = 10;

// ─── Raw place shape returned by the edge function ────────────
// Mirrors the Google Places API (New) response, minus anything we do not use.
interface RawPlace {
  id:                    string;
  displayName:           { text: string; languageCode?: string };
  location:              { latitude: number; longitude: number };
  types?:                string[];
  primaryType?:          string;
  rating?:               number;
  userRatingCount?:      number;
  regularOpeningHours?:  { openNow?: boolean };
  businessStatus?:       string;
  photos?:               { name: string; widthPx?: number; heightPx?: number }[];
  formattedAddress?:     string;
  shortFormattedAddress?: string;
  editorialSummary?:     { text: string };
}

// ─── Category mapping ─────────────────────────────────────────
export function categorize(primaryType: string, types: string[]): InterestCategory | null {
  const all = new Set([primaryType, ...types]);

  if (all.has('cafe') || all.has('coffee_shop'))                          return 'cafe';

  if (['restaurant', 'fast_food_restaurant', 'pizza_restaurant',
       'chinese_restaurant', 'indian_restaurant', 'thai_restaurant',
       'meal_takeaway', 'meal_delivery', 'food',
      ].some((t) => all.has(t)))                                          return 'food';

  if (['bar', 'pub', 'night_club', 'wine_bar',
       'cocktail_bar', 'nightclub',
      ].some((t) => all.has(t)))                                          return 'nightlife';

  if (['shopping_mall', 'market', 'food_market',
       'grocery_store', 'supermarket',
      ].some((t) => all.has(t)))                                          return 'market';

  if (all.has('book_store') || all.has('library'))                        return 'books';

  if (all.has('art_gallery'))                                             return 'art';

  if (['museum', 'history_museum', 'historical_landmark', 'monument',
       'cultural_landmark', 'tourist_attraction',
      ].some((t) => all.has(t)))                                          return 'history';

  if (['park', 'national_park', 'botanical_garden', 'garden',
       'nature_preserve', 'hiking_area', 'campground',
      ].some((t) => all.has(t)))                                          return 'nature';

  return null;
}

// ─── Helpers ──────────────────────────────────────────────────

/**
 * Photo URL routed through the `place-photo` edge function.
 * The function adds the Google key server-side and 302-redirects, so the key
 * never reaches the device and images stay lazily loaded.
 */
export function buildPhotoUrl(photoName: string): string | null {
  if (!IS_CLOUD_CONFIGURED) return null;
  // No credential in the URL. `<Image source={{ uri }}>` sends no
  // Authorization header, and Supabase reads `apikey` as a header rather than
  // a query parameter — so an `apikey=` query string would not authenticate
  // anything, it would only leak the anon key into URLs and server logs.
  //
  // `place-photo` is therefore deployed with `verify_jwt = false`
  // (see supabase/config.toml). It is safe to expose: it accepts only a
  // strict `places/<id>/photos/<ref>` reference and 302s to a keyless
  // googleusercontent URL.
  return `${SUPABASE_URL}/functions/v1/place-photo` +
         `?name=${encodeURIComponent(photoName)}&w=480`;
}

export function buildSummary(
  editorial: string | undefined,
  category:  InterestCategory,
): string {
  if (editorial) return editorial;
  const fallbacks: Record<InterestCategory, string> = {
    cafe:      'A real café near you. Tap through to Google Maps for photos and reviews.',
    food:      'A real eatery nearby. Open in Google Maps for menus, photos and reviews.',
    nightlife: 'A nearby spot for after dark. Check reviews before heading out.',
    market:    'A local market nearby. Best judged in person.',
    books:     'Shelves near you. The browsing is up to you.',
    art:       'An art spot mapped near you. See what’s on before you go.',
    history:   'A piece of local history within reach. Worth standing in front of once.',
    nature:    'A green space near you: real coordinates, real walking distance.',
  };
  return fallbacks[category];
}

export function googleMapsUrl(
  place: Pick<WanderPlace, 'name' | 'latitude' | 'longitude'>,
): string {
  const q = encodeURIComponent(place.name);
  return `https://www.google.com/maps/search/?api=1&query=${q}&query_ll=${place.latitude},${place.longitude}`;
}

/** Great-circle distance in km. */
export function haversineKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Errors ───────────────────────────────────────────────────

export class PlacesRateLimitedError extends Error {
  constructor() {
    super('Too many place searches. Try again in a little while.');
    this.name = 'PlacesRateLimitedError';
  }
}

// ─── Edge-function call ───────────────────────────────────────

async function fetchRawPlaces(
  lat: number,
  lon: number,
  radiusM: number,
): Promise<RawPlace[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    // Pass the user's JWT when signed in so the server can rate-limit per
    // account; fall back to the anon key so Wander still works signed out.
    const { data: { session } } = await supabase.auth.getSession();
    const authToken = session?.access_token ?? SUPABASE_ANON_KEY;

    const res = await fetch(`${SUPABASE_URL}/functions/v1/nearby-places`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${authToken}`,
        'apikey':        SUPABASE_ANON_KEY,
      },
      body:   JSON.stringify({ latitude: lat, longitude: lon, radius: radiusM }),
      signal: controller.signal,
    });

    if (res.status === 429) throw new PlacesRateLimitedError();
    if (!res.ok) {
      if (__DEV__) {
        const body = await res.text().catch(() => '');
        if (res.status === 404) {
          // By far the most common cause during setup, and the raw status code
          // gives no hint about the fix.
          console.warn(
            '[placesService] The `nearby-places` edge function is not deployed.\n' +
            '  Wander will show curated sample places until it is.\n' +
            '  Deploy it with:\n' +
            '    supabase functions deploy nearby-places\n' +
            '    supabase functions deploy place-photo\n' +
            '    supabase secrets set GOOGLE_PLACES_KEY=<your key>\n' +
            '  See supabase/README.md.',
          );
        } else {
          console.warn('[placesService] nearby-places error:', res.status, body);
        }
      }
      return [];
    }

    const json = await res.json();
    return Array.isArray(json?.places) ? (json.places as RawPlace[]) : [];
  } finally {
    clearTimeout(timer);
  }
}

// ─── Pure transform (exported for tests) ──────────────────────

interface Candidate {
  raw:      RawPlace;
  category: InterestCategory;
  quality:  number;
  distKm:   number;
}

/**
 * Filter, score, rank and cap a raw place list.
 * Pure — no I/O, no clock beyond the `today` argument.
 */
export function buildWanderPlaces(
  raw:   RawPlace[],
  lat:   number,
  lon:   number,
  today: string,
): WanderPlace[] {
  const seenIds = new Set<string>();
  const candidates: Candidate[] = [];

  for (const g of raw) {
    if (!g?.id || seenIds.has(g.id)) continue;
    if (!g.location || !g.displayName?.text) continue;
    seenIds.add(g.id);

    const category = categorize(g.primaryType ?? '', g.types ?? []);
    if (!category) continue;

    // 1. Closed venues never enter the pool.
    if (g.businessStatus && g.businessStatus !== 'OPERATIONAL') continue;

    // 2. Review floor — fewer than this is no meaningful signal.
    const reviewCount = g.userRatingCount ?? 0;
    if (reviewCount < QUALITY_MIN_REVIEWS) continue;

    // 3. Rating floor — trustworthy once there are enough reviews.
    const rating = g.rating ?? 0;
    if (rating < QUALITY_MIN_RATING) continue;

    const distKm = Math.round(
      haversineKm(lat, lon, g.location.latitude, g.location.longitude) * 10,
    ) / 10;

    // Worth = quality × proximity.
    //
    // This used to be quality alone, with distance as a mere tiebreaker. The
    // per-category cap below then kept the ten most FAMOUS places regardless
    // of how far away they were, so an excellent café 300 m from the user was
    // evicted from the pool by landmarks kilometres away and never reached the
    // feed scorer at all. No amount of downstream proximity weighting can
    // recover a candidate that was never included.
    const quality = candidateWorth(rating, reviewCount, distKm);
    candidates.push({ raw: g, category, quality, distKm });
  }

  candidates.sort((a, b) => {
    const diff = b.quality - a.quality;
    if (Math.abs(diff) > 0.0001) return diff;
    return a.distKm - b.distKm;
  });

  const perCategory: Record<string, number> = {};
  const places: WanderPlace[] = [];

  for (const { raw: g, category, quality, distKm } of candidates) {
    if ((perCategory[category] ?? 0) >= MAX_PER_CAT) continue;
    perCategory[category] = (perCategory[category] ?? 0) + 1;

    places.push({
      placeId:        `gp_${g.id}`,
      name:           g.displayName.text,
      address:        g.shortFormattedAddress ?? g.formattedAddress ?? '',
      latitude:       g.location.latitude,
      longitude:      g.location.longitude,
      rating:         g.rating ?? 0,
      reviewCount:    g.userRatingCount ?? 0,
      // Legacy field name, kept so stored places from older versions still
      // load. The ranking engine no longer reads it — it works from `rating`
      // and `reviewCount` directly, which is both simpler and more honest.
      redditMentions: Math.round(quality * 100),
      aiSummary:      buildSummary(g.editorialSummary?.text, category),
      category,
      tags:           (g.types ?? []).slice(0, 3).map((t) => t.replace(/_/g, ' ')),
      thumbnailUrl:   g.photos?.[0]?.name ? buildPhotoUrl(g.photos[0].name) : null,
      discoveredDate: today,
      distanceKm:     distKm,
      openNow:        g.regularOpeningHours?.openNow ?? null,
      isSaved:        false,
      isVisited:      false,
      userRating:     null,
      visitedDate:    null,
      gatiScore:      null,
    });
  }

  return places;
}

// ─── Main export ──────────────────────────────────────────────

/**
 * Fetch real nearby places.
 * Returns [] on any failure — callers fall back to curated sample data.
 *
 * @throws {PlacesRateLimitedError} when the caller has exceeded its quota,
 *   so the UI can say something honest instead of silently showing samples.
 */
export async function fetchNearbyPlaces(
  lat: number,
  lon: number,
  radiusM: number = SEARCH_RADIUS_M,
): Promise<WanderPlace[]> {
  if (!IS_CLOUD_CONFIGURED) {
    if (__DEV__) console.warn('[placesService] Supabase not configured — place search disabled.');
    return [];
  }

  let raw: RawPlace[];
  try {
    raw = await fetchRawPlaces(lat, lon, radiusM);
  } catch (e) {
    if (e instanceof PlacesRateLimitedError) throw e;
    if (__DEV__) console.warn('[placesService] fetch failed:', e);
    return [];
  }

  const places = buildWanderPlaces(raw, lat, lon, format(new Date(), 'yyyy-MM-dd'));
  if (places.length === 0) return [];

  // Attach crowd-sourced Gati scores — best effort, degrades to null.
  try {
    const gatiScores = await fetchGatiScores(places.map((p) => p.placeId));
    for (const place of places) {
      const gs = gatiScores[place.placeId];
      if (gs !== undefined) place.gatiScore = gs;
    }
  } catch {
    // No scores yet, or offline. Ranking still works without them.
  }

  if (__DEV__) {
    const withScore = places.filter((p) => p.gatiScore !== null).length;
    console.log(
      `[placesService] ${places.length} places` +
      (withScore > 0 ? ` (${withScore} with a Gati score)` : ''),
    );
  }

  return places;
}
