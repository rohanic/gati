/**
 * Wander recommendation engine.
 * Pure functions — no side effects, fully testable.
 *
 * Ranking lives in `relevance.ts`; this module handles segmentation, filtering
 * and the rotating feed window.
 */
import type { WanderPlace, InterestCategory } from '@/types';
import { relevanceScore, explainRelevance, relevanceReason } from '@/engine/relevance';

// ─── Place scoring ────────────────────────────────────────────────────
/**
 * Relevance score for a single place.
 *
 * Thin wrapper over `relevance.ts`, which holds the actual model. Kept so the
 * many existing call sites do not all have to change, and so the segmentation
 * helpers below read the same way they always did.
 *
 * The scoring is now MULTIPLICATIVE. The previous additive version capped
 * proximity at +0.30 while quality could add well over +1.30, which is why a
 * famous landmark kilometres away consistently beat a very good place around
 * the corner.
 */
export function scorePlace(
  place:          WanderPlace,
  categoryScores: Record<string, number>,
  userInterests:  InterestCategory[],
  now:            Date = new Date(),
): number {
  return relevanceScore(place, categoryScores, userInterests, now);
}

// ─── Segmentation ─────────────────────────────────────────────────────
export interface PlaceSegments {
  /** Bookmarked by the user — shown at the top regardless of score. */
  saved:    WanderPlace[];
  /**
   * Top interest-matched unvisited unsaved places.
   * Only populated when the user has declared interests in onboarding.
   * Shown in a dedicated "Picked for you" strip.
   */
  forYou:   WanderPlace[];
  /** Remaining unvisited unsaved places, sorted by score descending. */
  discover: WanderPlace[];
  /** Places the user has marked visited but not saved. */
  visited:  WanderPlace[];
}

/**
 * Partitions all places into display sections.
 * Caller is responsible for applying the active category filter afterward.
 */
export function segmentPlaces(
  places:         WanderPlace[],
  categoryScores: Record<string, number>,
  userInterests:  InterestCategory[],
  forYouCount     = 4
): PlaceSegments {
  // Saved: bookmarked (can also be visited)
  const saved = places.filter((p) => p.isSaved);

  // Visited: been there, not bookmarked
  const visited = places.filter((p) => p.isVisited && !p.isSaved);

  // Score + rank all undiscovered places
  const undiscovered = places
    .filter((p) => !p.isSaved && !p.isVisited)
    .map((p) => ({ place: p, score: scorePlace(p, categoryScores, userInterests) }))
    .sort((a, b) => b.score - a.score);

  // "For You": best interest-matching undiscovered places
  const forYouItems: WanderPlace[] =
    userInterests.length > 0
      ? undiscovered
          .filter(({ place }) => userInterests.includes(place.category as InterestCategory))
          .slice(0, forYouCount)
          .map(({ place }) => place)
      : [];

  const forYouIds = new Set(forYouItems.map((p) => p.placeId));

  // Discover: everything else, already sorted by score
  const discover = undiscovered
    .filter(({ place }) => !forYouIds.has(place.placeId))
    .map(({ place }) => place);

  return { saved, forYou: forYouItems, discover, visited };
}

// ─── Unified smart feed ───────────────────────────────────────────────

// ─── Personalized feed (legacy — use getUnifiedPersonalizedFeed) ──────────
/**
 * Returns exactly `count` interest-matched places, starting at `offset`
 * (wrapping around the pool).  Pull-to-refresh increments offset by
 * `count` so each pull surfaces the NEXT batch without a network call.
 *
 * When `activeCategory` is a specific category (not 'all'), that
 * overrides the interest filter so the user sees the best places in
 * the category they tapped — whether or not they listed it in interests.
 *
 * When the user has no interests declared, falls back to all undiscovered
 * places ranked by quality + proximity.
 */
export function getPersonalizedFeed(
  places:          WanderPlace[],
  categoryScores:  Record<string, number>,
  userInterests:   InterestCategory[],
  count:           number = 5,
  offset:          number = 0,
  activeCategory?: string,         // when set, overrides interest filter
  excludeIds?:     Set<string>,    // placeIds already shown in other sections
): WanderPlace[] {
  const hasInterests = userInterests.length > 0;

  // Which interests to filter by: either the user's list, or the single
  // tapped category (overrides interests), or nothing (no interests declared).
  const effectiveInterests: InterestCategory[] =
    activeCategory && activeCategory !== 'all'
      ? [activeCategory as InterestCategory]
      : userInterests;

  const eligible = places.filter((p) => {
    if (p.isSaved || p.isVisited) return false;
    if (excludeIds?.has(p.placeId)) return false;
    if (effectiveInterests.length > 0) {
      return effectiveInterests.includes(p.category as InterestCategory);
    }
    return true; // no interests declared — show everything
  });

  if (eligible.length === 0) return [];

  // Score + sort descending
  const ranked = eligible
    .map((p) => ({ place: p, score: scorePlace(p, categoryScores, userInterests) }))
    .sort((a, b) => b.score - a.score);

  // Rotate through the pool using offset (wraps around so it never dead-ends)
  const total     = ranked.length;
  const safeStart = offset % total;
  const feed: WanderPlace[] = [];
  for (let i = 0; i < count && i < total; i++) {
    feed.push(ranked[(safeStart + i) % total].place);
  }
  return feed;
}

// ─── Helpers ──────────────────────────────────────────────────────────
/** True when a place's category matches the user's declared interests. */
export function isInterestMatch(
  place:         WanderPlace,
  userInterests: InterestCategory[]
): boolean {
  return userInterests.includes(place.category as InterestCategory);
}

/**
 * Applies a category chip filter to a segment array.
 * Passing 'all' returns the original array unchanged.
 */
export function filterByCategory(
  places:   WanderPlace[],
  category: string
): WanderPlace[] {
  if (category === 'all') return places;
  return places.filter((p) => p.category === category);
}

// ─── Notification pick ────────────────────────────────────────────────
export interface WanderNudge {
  place:  WanderPlace;
  /** Why this one, phrased from the user's own behaviour. */
  reason: string;
  /** "600 m" / "1.4 km". */
  distanceLabel: string;
}

/**
 * How near a place must be to be described as nearby.
 *
 * Tighter than the search radius on purpose. A notification that names a
 * place is making a stronger claim than a list is, and "there is somewhere
 * good 9 km away" is not a reason to put your shoes on.
 */
const NUDGE_MAX_KM = 2;

/**
 * How stale a place may be before its distance stops meaning anything.
 *
 * `distanceKm` is measured once, when the place is fetched, against wherever
 * the user was then. That is the only distance the app has — it never stores
 * a coordinate, so it cannot recompute later. A fortnight-old figure could
 * be from another city, so places older than this are not offered.
 */
const NUDGE_MAX_AGE_DAYS = 3;

/**
 * Pick one place worth interrupting someone for, or nothing.
 *
 * Returning null is a real outcome and the common one. A nudge naming a
 * mediocre place 8 km away teaches people to swipe these away, which costs
 * far more than the nudge was ever worth.
 */
export function pickWanderNudge(
  places:         readonly WanderPlace[],
  categoryScores: Record<string, number>,
  userInterests:  InterestCategory[],
  now:            Date = new Date(),
): WanderNudge | null {
  const cutoff = new Date(now.getTime() - NUDGE_MAX_AGE_DAYS * 86_400_000)
    .toISOString().slice(0, 10);

  const candidates = places.filter((p) =>
    // Demo places are invented, with hand-written distances. Naming one in a
    // notification would send someone to a place that does not exist.
    !p.isSample &&
    !p.isVisited &&
    p.distanceKm > 0 &&
    p.distanceKm <= NUDGE_MAX_KM &&
    // When the distance was last MEASURED, not when the place was first
    // seen: discoveredDate is kept stable for the Story timeline, so a place
    // re-measured this morning could look a month old and be skipped.
    (p.measuredOn ?? p.discoveredDate ?? '') >= cutoff,
  );
  if (candidates.length === 0) return null;

  const best = candidates.reduce((a, b) =>
    relevanceScore(b, categoryScores, userInterests, now) >
    relevanceScore(a, categoryScores, userInterests, now) ? b : a,
  );

  return {
    place: best,
    reason: nudgeReason(best, categoryScores, userInterests, now),
    distanceLabel: best.distanceKm < 1
      ? `${Math.round(best.distanceKm * 1000)} m`
      : `${best.distanceKm.toFixed(1)} km`,
  };
}

/**
 * Why this place, in terms of what the user has actually done.
 *
 * Prefers the learned taste score over anything else: "you keep choosing
 * cafés" is a statement about them, and a suggestion that explains itself
 * from their own behaviour is far harder to dismiss than one that asserts a
 * place is good.
 */
function nudgeReason(
  place:          WanderPlace,
  categoryScores: Record<string, number>,
  userInterests:  InterestCategory[],
  now:            Date,
): string {
  const label = CATEGORY_LABELS[place.category] ?? place.category;
  const score = categoryScores[place.category] ?? 1;

  // A score above the 1.0 baseline can only come from the user rating places
  // in this category well, so this is earned rather than assumed.
  const top = Object.entries(categoryScores)
    .sort(([, a], [, b]) => b - a)[0];
  if (score >= 1.4 && top?.[0] === place.category) {
    return `You rate ${label} higher than anything else`;
  }
  if (score >= 1.3) return `You keep choosing ${label}`;
  if (userInterests.includes(place.category)) return `One of the ${label} you asked for`;

  const b = explainRelevance(place, categoryScores, userInterests, now);
  return relevanceReason(b, place) ?? `${label}, and you have not been`;
}

const CATEGORY_LABELS: Record<string, string> = {
  food: 'places to eat', cafe: 'cafés', history: 'historic places',
  nature: 'green spaces', art: 'art places', market: 'markets',
  nightlife: 'nightlife', books: 'bookshops',
};

// ─── Nearby feed ──────────────────────────────────────────────────────
export interface NearbyFeed {
  /** The best matches for the user's interests and learned taste. */
  forYou: WanderPlace[];
  /** Everything else within range, best first. */
  nearby: WanderPlace[];
  /** True when the only places available are the built-in examples. */
  examplesOnly: boolean;
}

/** How many interest matches lead the feed. */
export const FOR_YOU_LIMIT = 5;
/** How many further places follow them. A list, not a lucky dip. */
export const NEARBY_LIMIT  = 20;
/**
 * Tolerance on the radius, as a fraction. A place 20 m past a 500 m line is
 * still "within 500 m" to anyone looking at a map; one at 800 m is not.
 */
export const RADIUS_TOLERANCE = 0.05;

/**
 * The Wander feed.
 *
 * Replaces the old getUnifiedPersonalizedFeed, which had three faults that together
 * read as "random places, too far away":
 *
 *   • It showed five places and ROTATED that window by five on every
 *     refresh, wrapping round — so pulling to refresh pushed the best,
 *     nearest places out and brought in the next five down the list.
 *   • The user's interests EXCLUDED every other category rather than
 *     ranking matches higher, so the best café 300 m away never appeared
 *     for someone who had picked "art". tasteFactor already boosts declared
 *     interests ×1.35 and learned taste from ratings; the filter on top of
 *     it only hid places.
 *   • Nothing bounded the feed to the chosen radius, so places left in the
 *     store from a wider search stayed visible after narrowing it.
 *
 * Deterministic: the same places, position and preferences always produce
 * the same order. Ties break on distance, then id — never on chance.
 *
 * Demo places appear only when there are no real ones at all, and are then
 * flagged, so the screen can say they are examples.
 */
export function buildNearbyFeed(
  places:           readonly WanderPlace[],
  categoryScores:   Record<string, number>,
  userInterests:    InterestCategory[],
  bridgeCategories: InterestCategory[],
  radiusKm:         number,
  activeCategory?:  string,
  now:              Date = new Date(),
): NearbyFeed {
  const hasReal      = places.some((p) => !p.isSample);
  const limitKm      = radiusKm * (1 + RADIUS_TOLERANCE);
  const onlyCategory = activeCategory && activeCategory !== 'all' ? activeCategory : null;
  const preferred    = new Set<string>([...userInterests, ...bridgeCategories]);
  const bridgeSet    = new Set<string>(bridgeCategories);

  const ranked = places
    .filter((p) => {
      if (p.isSaved || p.isVisited) return false;           // their own sections
      if (hasReal && p.isSample) return false;              // never mix in inventions
      if (onlyCategory && p.category !== onlyCategory) return false;
      if (!p.isSample && !(p.distanceKm <= limitKm)) return false;  // also rejects NaN
      if (p.userRating === 'not_for_me') return false;      // they told us
      return true;
    })
    .map((p) => ({
      place: p,
      // Stat bridges (coffee → café, steps → nature) boost, multiplicatively,
      // to match the rest of the model.
      score: relevanceScore(p, categoryScores, userInterests, now)
           * (bridgeSet.has(p.category) ? 1.35 : 1),
    }))
    .sort((a, b) =>
      b.score - a.score ||
      a.place.distanceKm - b.place.distanceKm ||
      a.place.placeId.localeCompare(b.place.placeId),
    )
    .map((r) => r.place);

  // With no preferences at all there is nothing to personalise against, so
  // the whole list is simply "near you".
  const forYou = preferred.size === 0 || onlyCategory
    ? []
    : ranked.filter((p) => preferred.has(p.category)).slice(0, FOR_YOU_LIMIT);
  const shown  = new Set(forYou.map((p) => p.placeId));
  const nearby = ranked.filter((p) => !shown.has(p.placeId)).slice(0, NEARBY_LIMIT);

  return { forYou, nearby, examplesOnly: !hasReal && ranked.length > 0 };
}
