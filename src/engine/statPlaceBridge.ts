/**
 * Numbers ↔ Wander bridge.
 *
 * Maps specific life stats to Wander place categories so that the
 * onboarding answers → daily numbers → nearby real places loop closes:
 *
 *   coffee_cups  → cafe       "At 3 cups a day, you're 18,284 deep."
 *   steps_walked → nature     "Your 73.1M steps led here."
 *   meals_eaten  → food       "28,470 meals. Make this one count."
 *   words_spoken → books      "151M words spoken — shelves hold better ones."
 *   phone_days   → art        "212 days on screen. Stand in front of something real."
 *   days_alive   → history    "X days of living. This place has been here longer."
 *   music_hours  → nightlife  "X hours of music. Some of the best happened live."
 *   water_glasses→ market     "X glasses of water. Local markets are where it starts."
 *
 * Context lines become sharper when the user's own habits (profile)
 * are passed in — the same data they gave during onboarding.
 *
 * Pure functions — no side effects, fully testable.
 */
import type { LifeStatsOutput } from './statsEngine';
import type { InterestCategory, UserProfile } from '@/types';

// ─── Bridge shape ────────────────────────────────────────────────────
export interface StatPlaceBridge {
  /** stat definition id (snake_case) */
  statId:          string;
  /** key in LifeStatsOutput */
  formulaKey:      keyof LifeStatsOutput;
  /** WanderPlace category this stat maps to */
  placeCategory:   InterestCategory;
  /**
   * Minimum stat value before context is shown.
   * Avoids awkward "0 cups of coffee" lines.
   */
  minValue:        number;
  /**
   * Personal context line shown on the place card.
   * Sharper when the user's profile habits are available.
   */
  getContextLine:  (value: number, profile?: UserProfile) => string | null;
  /** Compact section title — goes in the Wander section header */
  getSectionTitle: (value: number) => string;
  /** Wander section subtitle */
  getSectionSub:   () => string;
}

function compactM(v: number): string {
  return v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v.toLocaleString();
}

// ─── Bridge definitions ──────────────────────────────────────────────
export const STAT_PLACE_BRIDGES: StatPlaceBridge[] = [
  {
    statId:        'coffee_cups',
    formulaKey:    'coffeeCups',
    placeCategory: 'cafe',
    minValue:      50,
    getContextLine: (v, profile) =>
      profile && profile.coffeeCupsPerDay > 0
        ? `At ${profile.coffeeCupsPerDay} ${profile.coffeeCupsPerDay === 1 ? 'cup' : 'cups'} a day, you're ${v.toLocaleString()} cups deep. Cup ${(v + 1).toLocaleString()} could be here.`
        : `You've had ${v.toLocaleString()} cups of coffee in your life.`,
    getSectionTitle: (v) =>
      `${v.toLocaleString()} cups deep`,
    getSectionSub: () =>
      'The next one could be the best one.',
  },
  {
    statId:        'steps_walked',
    formulaKey:    'stepsWalked',
    placeCategory: 'nature',
    minValue:      500_000,
    getContextLine: (v) =>
      `Your feet have walked ${compactM(v)} steps. These are worth a few more.`,
    getSectionTitle: (v) => {
      const m = v / 1_000_000;
      return m >= 1
        ? `${m.toFixed(1)} million steps`
        : `${(v / 1000).toFixed(0)}K steps walked`;
    },
    getSectionSub: () =>
      'Some of the best ones are still ahead.',
  },
  {
    statId:        'meals_eaten',
    formulaKey:    'mealsEaten',
    placeCategory: 'food',
    minValue:      500,
    getContextLine: (v, profile) =>
      profile
        ? `${v.toLocaleString()} meals so far. ${profile.mealsPerDay ?? 3} more today. Worth making one count.`
        : `${v.toLocaleString()} meals in your life.`,
    getSectionTitle: (v) =>
      `${v.toLocaleString()} meals eaten`,
    getSectionSub: () =>
      'The ones worth remembering are worth seeking.',
  },
  {
    statId:        'words_spoken',
    formulaKey:    'wordsSpoken',
    placeCategory: 'books',
    minValue:      1_000_000,
    getContextLine: (v) =>
      `${compactM(v)} words spoken. These shelves hold a few you haven't met.`,
    getSectionTitle: (v) =>
      `${compactM(v)} words spoken`,
    getSectionSub: () =>
      'The best ones you know came from somewhere.',
  },
  {
    statId:        'phone_days',
    formulaKey:    'phoneDays',
    placeCategory: 'art',
    minValue:      30,
    getContextLine: (v) =>
      `${v.toLocaleString()} full days of your life on a screen. This one isn't.`,
    getSectionTitle: (v) =>
      `${v.toLocaleString()} days on screen`,
    getSectionSub: () =>
      'Trade one hour of it for something unscrollable.',
  },

  // ── History ──────────────────────────────────────────────────
  {
    statId:        'days_alive',
    formulaKey:    'daysAlive',
    placeCategory: 'history',
    minValue:      3_650,  // ~10 years
    getContextLine: (v) =>
      `${v.toLocaleString()} days of living. Some places nearby have been standing longer than all of them.`,
    getSectionTitle: (v) => {
      const years = (v / 365.25).toFixed(0);
      return `${years} years of living`;
    },
    getSectionSub: () =>
      'Places that were here before you, and will be after.',
  },

  // ── Nightlife ─────────────────────────────────────────────────
  {
    statId:        'music_hours',
    formulaKey:    'musicHours',
    placeCategory: 'nightlife',
    minValue:      1_000,
    getContextLine: (v) =>
      `${v.toLocaleString()} hours of music in your life. Some of the best happened live.`,
    getSectionTitle: (v) =>
      `${v.toLocaleString()} hours of music`,
    getSectionSub: () =>
      'The recorded version is never the whole story.',
  },

  // ── Market ───────────────────────────────────────────────────
  {
    statId:        'water_glasses',
    formulaKey:    'waterGlasses',
    placeCategory: 'market',
    minValue:      5_000,
    getContextLine: (v) =>
      `${v.toLocaleString()} glasses of water. Local markets are where the rest of what you consume comes from.`,
    getSectionTitle: (v) =>
      `${v.toLocaleString()} glasses of water`,
    getSectionSub: () =>
      'Everything you consume has a source. Here are a few.',
  },
];

// ─── Lookup helpers ──────────────────────────────────────────────────

/** Bridge for a given stat ID, or null if no bridge exists. */
export function getBridgeForStat(statId: string): StatPlaceBridge | null {
  return STAT_PLACE_BRIDGES.find((b) => b.statId === statId) ?? null;
}

/** Bridge for a given place category, or null. */
export function getBridgeForCategory(
  category: InterestCategory
): StatPlaceBridge | null {
  return STAT_PLACE_BRIDGES.find((b) => b.placeCategory === category) ?? null;
}

/**
 * Personal context line for a place card.
 * Returns null when there's no bridge for this category,
 * or when the user's stat value is below the bridge's minValue.
 */
export function getPlaceContextLine(
  category: InterestCategory,
  stats:    LifeStatsOutput,
  profile?: UserProfile
): string | null {
  const bridge = getBridgeForCategory(category);
  if (!bridge) return null;
  const value = stats[bridge.formulaKey] as number;
  if (value < bridge.minValue) return null;
  return bridge.getContextLine(value, profile);
}

/**
 * Returns only bridges whose stat value clears the minValue threshold.
 * Used by Wander to decide which "Through your numbers" sub-sections to show.
 */
export function getActiveBridges(stats: LifeStatsOutput): StatPlaceBridge[] {
  return STAT_PLACE_BRIDGES.filter(
    (b) => (stats[b.formulaKey] as number) >= b.minValue
  );
}
