/**
 * Wander recommendation engine.
 * Pure functions — no side effects, fully testable.
 *
 * Ranking lives in `relevance.ts`; this module handles segmentation, filtering
 * and the rotating feed window.
 */
import type { WanderPlace, InterestCategory } from '@/types';
import { relevanceScore } from '@/engine/relevance';

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
/**
 * Returns exactly `count` places drawn from the union of:
 *   1. User's declared interest categories (onboarding)
 *   2. Stat-inferred categories (e.g. high coffee → café, many steps → nature)
 *
 * Nothing outside this combined set ever appears in the feed.
 * Pull-to-refresh increments `offset` to rotate through the pool.
 *
 * Ranking:
 *   - Base: full relevance score (taste × proximity × quality × context)
 *   - Boost: ×1.35 for a stat-bridge category
 */
export function getUnifiedPersonalizedFeed(
  places:           WanderPlace[],
  categoryScores:   Record<string, number>,
  userInterests:    InterestCategory[],
  bridgeCategories: InterestCategory[],   // from active stat bridges
  count:            number = 5,
  offset:           number = 0,
  activeCategory?:  string,              // specific chip overrides filter
  excludeIds?:      Set<string>,
): WanderPlace[] {
  // When a category chip is active, only show that category.
  // Otherwise, restrict to interests ∪ bridge-inferred categories.
  // If the user has neither, fall back to all undiscovered places.
  const effectiveCategories: Set<string> | null =
    activeCategory && activeCategory !== 'all'
      ? new Set([activeCategory])
      : userInterests.length + bridgeCategories.length > 0
        ? new Set([...userInterests, ...bridgeCategories])
        : null;   // null = no filter (new user with no interests yet)

  const bridgeSet = new Set<string>(bridgeCategories);

  const eligible = places.filter((p) => {
    if (p.isSaved || p.isVisited) return false;
    if (excludeIds?.has(p.placeId)) return false;
    if (effectiveCategories !== null) return effectiveCategories.has(p.category);
    return true;
  });

  if (eligible.length === 0) return [];

  const ranked = eligible
    .map((p) => ({
      place: p,
      // Stat-bridge boost, MULTIPLICATIVE to match the rest of the model. It
      // was `+ 0.4`, which in a multiplicative score (typically 0.05–2.0)
      // would have swamped every other signal including distance.
      score: scorePlace(p, categoryScores, userInterests)
           * (bridgeSet.has(p.category) ? 1.35 : 1),
    }))
    .sort((a, b) => b.score - a.score);

  const total     = ranked.length;
  const safeStart = offset % total;
  const feed: WanderPlace[] = [];
  for (let i = 0; i < count && i < total; i++) {
    feed.push(ranked[(safeStart + i) % total].place);
  }
  return feed;
}

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
