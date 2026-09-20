/**
 * Place relevance — how Gati decides what is worth showing you right now.
 *
 * ── Why this replaced the previous scorer ────────────────────────────────
 * The old model was ADDITIVE: a base taste score plus small bonuses.
 * Proximity could contribute at most +0.30 while quality signals contributed
 * well over +1.30, so distance was effectively decorative. Combined with a
 * candidate pool that was itself capped by pure quality, a famous landmark
 * 7 km away beat an excellent café 300 m away every single time — which is
 * exactly the "shows far places" complaint.
 *
 * Everything here is MULTIPLICATIVE instead. Each factor is a ratio centred
 * near 1.0, so no single signal can run away, and being far away genuinely
 * scales a place down rather than merely failing to add a small bonus.
 *
 *   relevance = taste × proximity × quality × context × behaviour
 *
 * Pure functions; no clock reads except via an injected `now`.
 */
import type { WanderPlace, InterestCategory } from '@/types';

// ─── Tunables ─────────────────────────────────────────────────

/**
 * Distance at which a place is worth HALF as much as one on your doorstep.
 *
 * The curve is a Hill/Cauchy decay, `1 / (1 + (d/d50)²)`, chosen over a linear
 * falloff because the difference between 0.3 km and 1 km matters enormously to
 * whether someone actually goes, while 6 km vs 7 km barely matters — both are
 * "a trip".
 *
 *   0.0 km → 1.00      2.5 km → 0.50
 *   0.5 km → 0.96      5.0 km → 0.20
 *   1.0 km → 0.86      8.0 km → 0.09
 *
 * Tuned to 2.5 km rather than something tighter: at 1.8 km a barely-passing
 * 3.8★ place 400 m away outranked an outstanding 4.8★ place 2.2 km away, which
 * over-corrects the original bug into "nearest wins" — just as wrong in the
 * other direction. 2.5 km keeps a genuinely excellent place a short trip away
 * competitive while still burying famous landmarks across town.
 */
export const DISTANCE_HALF_LIFE_KM = 2.5;

/**
 * Bayesian prior for ratings.
 *
 * A 5.0★ with 12 reviews should not outrank a 4.6★ with 8,000. Each place's
 * rating is shrunk toward the global mean by a prior worth `PRIOR_REVIEWS`
 * votes, which is the standard fix for small-sample rating inflation.
 */
export const PRIOR_REVIEWS = 40;
export const PRIOR_RATING  = 4.15;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

// ─── Distance ─────────────────────────────────────────────────

/** Proximity factor in (0, 1]. 1.0 on your doorstep. */
export function proximityFactor(
  distanceKm: number,
  halfLifeKm: number = DISTANCE_HALF_LIFE_KM,
): number {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return 1;
  // Guard the tunable too: a zero or nonsense half-life would silently make
  // every place score identically, or divide by zero.
  const half = Number.isFinite(halfLifeKm) && halfLifeKm > 0
    ? halfLifeKm
    : DISTANCE_HALF_LIFE_KM;
  const ratio = distanceKm / half;
  return 1 / (1 + ratio * ratio);
}

// ─── Quality ──────────────────────────────────────────────────

/** Rating shrunk toward the global mean by a prior. */
export function bayesianRating(rating: number, reviewCount: number): number {
  const v = Math.max(0, reviewCount);
  const r = Math.min(5, Math.max(0, rating));
  return (v * r + PRIOR_REVIEWS * PRIOR_RATING) / (v + PRIOR_REVIEWS);
}

/**
 * Quality factor, roughly 0.45–1.65.
 *
 * Two separable ideas, deliberately kept apart:
 *   • how GOOD is it   → the Bayesian rating
 *   • how KNOWN is it  → log-scaled review count
 *
 * A beloved neighbourhood place with 200 reviews should be competitive with a
 * tourist landmark with 50,000, not buried by it — so popularity is bounded to
 * a narrow band while rating carries the weight.
 */
export function qualityFactor(rating: number, reviewCount: number): number {
  const bayes = bayesianRating(rating, reviewCount);
  // 3.6★ → 0.55, 4.9★ → ~1.45
  const ratingPart = 0.55 + 0.90 * clamp01((bayes - 3.6) / 1.3);
  // 0 reviews → 0.80, 10k+ → 1.15
  const popPart    = 0.80 + 0.35 * clamp01(Math.log10(1 + Math.max(0, reviewCount)) / 4);
  return ratingPart * popPart;
}

// ─── Time of day ──────────────────────────────────────────────

export type DayPart = 'morning' | 'midday' | 'afternoon' | 'evening' | 'late';

export function getDayPart(now: Date = new Date()): DayPart {
  const h = now.getHours();
  if (h >= 5  && h < 11) return 'morning';
  if (h >= 11 && h < 15) return 'midday';
  if (h >= 15 && h < 18) return 'afternoon';
  if (h >= 18 && h < 22) return 'evening';
  return 'late';
}

/**
 * How well a category fits the current part of the day.
 *
 * Suggesting a cocktail bar at 8am or a museum at 11pm is the fastest way to
 * make a recommendation feel automated. These multipliers are gentle — they
 * re-order a good list, they do not censor it.
 */
const DAY_PART_AFFINITY: Record<DayPart, Partial<Record<InterestCategory, number>>> = {
  morning:   { cafe: 1.30, nature: 1.15, market: 1.12, books: 1.05, food: 0.95, art: 0.90, history: 0.95, nightlife: 0.45 },
  midday:    { food: 1.30, market: 1.15, cafe: 1.05, history: 1.10, art: 1.05, nature: 1.05, books: 1.00, nightlife: 0.50 },
  afternoon: { art: 1.22, books: 1.18, history: 1.18, cafe: 1.12, nature: 1.10, market: 1.02, food: 0.98, nightlife: 0.75 },
  evening:   { food: 1.28, nightlife: 1.25, cafe: 0.92, art: 0.85, history: 0.72, books: 0.85, market: 0.80, nature: 0.70 },
  late:      { nightlife: 1.40, food: 1.05, cafe: 0.70, art: 0.45, history: 0.45, books: 0.50, market: 0.45, nature: 0.40 },
};

export function dayPartFactor(
  category: InterestCategory,
  now: Date = new Date(),
): number {
  return DAY_PART_AFFINITY[getDayPart(now)][category] ?? 1;
}

// ─── Context ──────────────────────────────────────────────────

/**
 * Open/closed. A closed place is deprioritised but never hidden: Google's
 * opening-hours data is frequently wrong or missing, and burying a great place
 * because of a stale timetable is worse than showing it.
 */
export function openNowFactor(openNow: boolean | null): number {
  if (openNow === true)  return 1.08;
  if (openNow === false) return 0.60;
  return 1;   // unknown
}

// ─── Behaviour ────────────────────────────────────────────────

export function behaviourFactor(place: WanderPlace): number {
  if (place.userRating === 'loved')      return 1.90;
  if (place.userRating === 'not_for_me') return 0.05;
  // Been there, felt nothing in particular — push it well down but keep it.
  if (place.isVisited)                   return 0.25;
  return 1;
}

// ─── Taste ────────────────────────────────────────────────────

export function tasteFactor(
  place: WanderPlace,
  categoryScores: Record<string, number>,
  userInterests: readonly InterestCategory[],
): number {
  const learned  = categoryScores[place.category] ?? 1;
  const declared = userInterests.includes(place.category) ? 1.35 : 1;
  // Crowd signal from other Gati users, 0–1, worth up to +35%.
  const crowd    = place.gatiScore != null ? 1 + 0.35 * clamp01(place.gatiScore) : 1;
  return learned * declared * crowd;
}

// ─── Combined ─────────────────────────────────────────────────

export interface RelevanceBreakdown {
  total:     number;
  taste:     number;
  proximity: number;
  quality:   number;
  context:   number;
  behaviour: number;
}

/**
 * Full relevance score with its components, so the ranking can be explained
 * (and asserted in tests) rather than being an opaque number.
 */
export function explainRelevance(
  place: WanderPlace,
  categoryScores: Record<string, number>,
  userInterests: readonly InterestCategory[],
  now: Date = new Date(),
): RelevanceBreakdown {
  const taste     = tasteFactor(place, categoryScores, userInterests);
  const proximity = proximityFactor(place.distanceKm);
  const quality   = qualityFactor(place.rating, place.reviewCount);
  const context   = openNowFactor(place.openNow) * dayPartFactor(place.category, now);
  const behaviour = behaviourFactor(place);

  return {
    total: taste * proximity * quality * context * behaviour,
    taste, proximity, quality, context, behaviour,
  };
}

export function relevanceScore(
  place: WanderPlace,
  categoryScores: Record<string, number>,
  userInterests: readonly InterestCategory[],
  now: Date = new Date(),
): number {
  return explainRelevance(place, categoryScores, userInterests, now).total;
}

/**
 * Worth of a candidate at POOL-BUILDING time, before anything is known about
 * the user.
 *
 * This is the fix for the root cause of "it shows far places". The candidate
 * pool was capped per category by pure quality with distance as a mere
 * tiebreaker, so an excellent café 300 m away was evicted by ten famous
 * landmarks 7 km away and never reached the scorer at all. Distance belongs in
 * the selection step too.
 */
export function candidateWorth(
  rating: number,
  reviewCount: number,
  distanceKm: number,
): number {
  return qualityFactor(rating, reviewCount) * proximityFactor(distanceKm);
}

/**
 * A short, honest reason this place is being shown, derived from whichever
 * factor actually drove the score. Shown on the card so the feed is legible
 * rather than magic.
 */
export function relevanceReason(b: RelevanceBreakdown, place: WanderPlace): string | null {
  if (place.userRating === 'loved')          return 'You loved this one';
  if (b.proximity >= 0.80)                   return 'Just around the corner';
  if (b.quality   >= 1.30)                   return 'Exceptionally well rated';
  if (b.taste     >= 1.60)                   return 'Matches your taste';
  if (place.openNow === true && b.context >= 1.15) return 'Open now, good time for it';
  if (b.proximity >= 0.50)                   return 'A short trip away';
  return null;
}
