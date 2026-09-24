/**
 * Recommendation and milestone engines.
 */
import { scorePlace, buildNearbyFeed, filterByCategory } from '@/engine/wanderEngine';
import {
  checkMilestones,
  getUpcomingMilestonePrediction,
  MILESTONE_DEFINITIONS,
  type MilestoneCheckParams,
} from '@/engine/milestoneEngine';
import { computeLifeStats } from '@/engine/statsEngine';
import type { WanderPlace, UserProfile, InterestCategory } from '@/types';

// ─── Fixtures ─────────────────────────────────────────────────

function place(over: Partial<WanderPlace> = {}): WanderPlace {
  return {
    placeId: 'p', name: 'P', address: '', latitude: 0, longitude: 0,
    rating: 4.0, reviewCount: 100, redditMentions: 50, aiSummary: '',
    category: 'cafe', tags: [], thumbnailUrl: null,
    discoveredDate: '2026-06-15', visitedDate: null, distanceKm: 1,
    openNow: null, isSaved: false, isVisited: false, userRating: null,
    gatiScore: null,
    ...over,
  };
}

const NEUTRAL: Record<string, number> = {
  food: 1, cafe: 1, history: 1, nature: 1, art: 1, market: 1, nightlife: 1, books: 1,
};

const profile: UserProfile = {
  firstName: 'T', dateOfBirth: '1996-01-01',
  sleepHoursPerNight: 8, coffeeCupsPerDay: 2, phoneHoursPerDay: 4,
  exerciseFrequency: 'sometimes', mealsPerDay: 3, talkLevel: 'balanced',
  waterGlassesPerDay: 6, musicHoursPerDay: 2, commuteMinutesPerDay: 30,
  interestCategories: ['cafe'], notificationTime: '08:00',
  isPro: false, appJoinDate: '2026-01-01',
};

// ─── scorePlace ───────────────────────────────────────────────

describe('scorePlace', () => {
  it('boosts a declared interest', () => {
    const p = place();
    expect(scorePlace(p, NEUTRAL, ['cafe']))
      .toBeGreaterThan(scorePlace(p, NEUTRAL, []));
  });

  it('rewards a better rating', () => {
    expect(scorePlace(place({ rating: 4.9 }), NEUTRAL, []))
      .toBeGreaterThan(scorePlace(place({ rating: 3.9 }), NEUTRAL, []));
  });

  it('rewards more community signal', () => {
    // Reads `reviewCount` now. `redditMentions` is a legacy field kept only so
    // places stored by older builds still deserialise; the scorer ignores it.
    expect(scorePlace(place({ reviewCount: 5000 }), NEUTRAL, []))
      .toBeGreaterThan(scorePlace(place({ reviewCount: 30 }), NEUTRAL, []));
  });

  it('prefers nearer places, all else equal', () => {
    expect(scorePlace(place({ distanceKm: 0.5 }), NEUTRAL, []))
      .toBeGreaterThan(scorePlace(place({ distanceKm: 7 }), NEUTRAL, []));
  });

  /**
   * Deliberately REVERSED from what this suite used to assert.
   *
   * The old doctrine was "quality dominates proximity", which is how a
   * landmark 7 km away kept beating a decent place around the corner — the
   * reported bug. 7 km is not a wander, it is an expedition, and everything
   * in the pool has already cleared a 3.8★ / 10-review floor.
   *
   * The guard against over-correcting into "nearest always wins" is the next
   * test, and the calibration cases in relevance.test.ts.
   */
  it('ranks a decent place next door above a great one 7km away', () => {
    const near = place({ rating: 3.9, reviewCount: 60,   distanceKm: 0.1 });
    const far  = place({ rating: 4.9, reviewCount: 2000, distanceKm: 7 });
    expect(scorePlace(near, NEUTRAL, [])).toBeGreaterThan(scorePlace(far, NEUTRAL, []));
  });

  it('still lets a clearly better place a short trip away win', () => {
    const near = place({ rating: 3.9, reviewCount: 15,   distanceKm: 0.4 });
    const far  = place({ rating: 4.8, reviewCount: 4000, distanceKm: 2.2 });
    expect(scorePlace(far, NEUTRAL, [])).toBeGreaterThan(scorePlace(near, NEUTRAL, []));
  });

  it('resurfaces a loved place and buries a rejected one', () => {
    const base = scorePlace(place(), NEUTRAL, []);
    expect(scorePlace(place({ userRating: 'loved' }), NEUTRAL, [])).toBeGreaterThan(base);
    expect(scorePlace(place({ userRating: 'not_for_me' }), NEUTRAL, [])).toBeLessThan(base);
  });

  it('deprioritises a visited place unless it was loved', () => {
    const base   = scorePlace(place(), NEUTRAL, []);
    const seen   = scorePlace(place({ isVisited: true }), NEUTRAL, []);
    const loved  = scorePlace(place({ isVisited: true, userRating: 'loved' }), NEUTRAL, []);
    expect(seen).toBeLessThan(base);
    expect(loved).toBeGreaterThan(seen);
  });

  it('applies the crowd-sourced Gati score when present', () => {
    expect(scorePlace(place({ gatiScore: 1 }), NEUTRAL, []))
      .toBeGreaterThan(scorePlace(place({ gatiScore: 0 }), NEUTRAL, []));
  });

  it('never returns a negative score', () => {
    const worst = place({
      rating: 0, redditMentions: 0, distanceKm: 99,
      userRating: 'not_for_me', isVisited: true,
    });
    expect(scorePlace(worst, NEUTRAL, [])).toBeGreaterThanOrEqual(0);
  });
});

// ─── buildNearbyFeed ──────────────────────────────────────────
//
// The tests this replaces asserted the two behaviours users reported as bugs:
// "restricts to declared interests" (it hid the best nearby places from
// anyone whose interests did not include them) and "rotates the window on
// refresh" (pulling to refresh pushed the best places out, which read as
// random). They passed because they described the code, not what people want.

describe('buildNearbyFeed', () => {
  const pool: WanderPlace[] = [
    place({ placeId: 'a', category: 'cafe',      rating: 4.8, distanceKm: 0.3 }),
    place({ placeId: 'b', category: 'cafe',      rating: 4.2, distanceKm: 0.9 }),
    place({ placeId: 'c', category: 'nature',    rating: 4.9, distanceKm: 1.2 }),
    place({ placeId: 'd', category: 'nightlife', rating: 4.7, distanceKm: 0.6 }),
    place({ placeId: 'e', category: 'books',     rating: 4.6, distanceKm: 1.8 }),
  ];
  const ids = (ps: WanderPlace[]) => ps.map((p) => p.placeId);
  const all = (f: ReturnType<typeof buildNearbyFeed>) => [...ids(f.forYou), ...ids(f.nearby)];

  it('ranks interests higher without hiding everything else', () => {
    const f = buildNearbyFeed(pool, NEUTRAL, ['cafe'], [], 2);
    expect(f.forYou.every((p) => p.category === 'cafe')).toBe(true);
    // The nature place is still offered — just not ahead of the cafés.
    expect(ids(f.nearby)).toContain('c');
  });

  it('gives the same order every time — no rotation, no chance', () => {
    const a = buildNearbyFeed(pool, NEUTRAL, ['cafe'], [], 2);
    const b = buildNearbyFeed(pool, NEUTRAL, ['cafe'], [], 2);
    expect(all(a)).toEqual(all(b));
  });

  it('keeps to the chosen radius', () => {
    const f = buildNearbyFeed(pool, NEUTRAL, [], [], 1);
    expect(all(f).sort()).toEqual(['a', 'b', 'd']);
  });

  it('narrowing the radius removes places at once, before any refetch', () => {
    expect(all(buildNearbyFeed(pool, NEUTRAL, [], [], 0.5))).toEqual(['a']);
  });

  it('tolerates a place a few metres past the line, not one clearly outside', () => {
    const edge = [place({ placeId: 'in',  distanceKm: 0.52 }),
                  place({ placeId: 'out', distanceKm: 0.8 })];
    expect(all(buildNearbyFeed(edge, NEUTRAL, [], [], 0.5))).toEqual(['in']);
  });

  it('lets a category chip show only that category', () => {
    const f = buildNearbyFeed(pool, NEUTRAL, ['cafe'], [], 2, 'nightlife');
    expect(all(f)).toEqual(['d']);
  });

  it('excludes saved, visited and "not for me" places', () => {
    const flagged = [...pool,
      place({ placeId: 'saved',   isSaved: true,   distanceKm: 0.1 }),
      place({ placeId: 'visited', isVisited: true, distanceKm: 0.1 }),
      place({ placeId: 'nope',    userRating: 'not_for_me', distanceKm: 0.1 })];
    const shown = all(buildNearbyFeed(flagged, NEUTRAL, [], [], 2));
    for (const id of ['saved', 'visited', 'nope']) expect(shown).not.toContain(id);
  });

  it('never mixes invented example places in with real ones', () => {
    const mixed = [...pool, place({ placeId: 'wp_001', isSample: true, distanceKm: 0.1 })];
    const f = buildNearbyFeed(mixed, NEUTRAL, [], [], 2);
    expect(all(f)).not.toContain('wp_001');
    expect(f.examplesOnly).toBe(false);
  });

  it('shows examples, flagged, only when nothing real exists', () => {
    const samples = [place({ placeId: 'wp_1', isSample: true, distanceKm: 900 })];
    const f = buildNearbyFeed(samples, NEUTRAL, [], [], 0.5);
    expect(all(f)).toEqual(['wp_1']);          // radius ignored: their distance is fake
    expect(f.examplesOnly).toBe(true);
  });

  it('rejects a place whose distance is not a number', () => {
    const broken = [place({ placeId: 'nan', distanceKm: Number.NaN })];
    expect(all(buildNearbyFeed(broken, NEUTRAL, [], [], 10))).toEqual([]);
  });

  it('returns an empty feed for an empty pool', () => {
    const f = buildNearbyFeed([], NEUTRAL, ['cafe'], [], 2);
    expect(all(f)).toEqual([]);
    expect(f.examplesOnly).toBe(false);
  });
});

describe('filterByCategory', () => {
  const pool = [place({ placeId: 'a', category: 'cafe' }), place({ placeId: 'b', category: 'nature' })];

  it('passes everything through for "all"', () => {
    expect(filterByCategory(pool, 'all')).toHaveLength(2);
  });

  it('filters to one category', () => {
    expect(filterByCategory(pool, 'cafe').map((p) => p.placeId)).toEqual(['a']);
  });
});

// ─── Milestones ───────────────────────────────────────────────

function params(over: Partial<MilestoneCheckParams> = {}): MilestoneCheckParams {
  return {
    profile,
    lifeStats: computeLifeStats(profile),
    streak: 0,
    appDayIndex: 0,
    totalUnlocked: 0,
    ...over,
  };
}

describe('checkMilestones', () => {
  it('fires no streak milestone at zero', () => {
    const ids = checkMilestones(params()).map((m) => m.id);
    expect(ids).not.toContain('streak_7');
  });

  it('fires the 7-day streak milestone', () => {
    expect(checkMilestones(params({ streak: 7 })).map((m) => m.id)).toContain('streak_7');
  });

  it('fires every lower streak milestone once passed', () => {
    const ids = checkMilestones(params({ streak: 30 })).map((m) => m.id);
    expect(ids).toEqual(expect.arrayContaining(['streak_7', 'streak_14', 'streak_30']));
  });

  /**
   * These depend on the unlock ledger, which was never written to — so they
   * could never fire in the shipped app.
   */
  it('fires stat-count milestones from the unlock ledger', () => {
    expect(checkMilestones(params({ totalUnlocked: 5 })).map((m) => m.id)).toContain('stats_5');
    expect(checkMilestones(params({ totalUnlocked: 10 })).map((m) => m.id)).toContain('stats_10');
    expect(checkMilestones(params({ totalUnlocked: 25 })).map((m) => m.id)).toContain('stats_all');
  });

  it('does not fire a stat milestone that has not been reached', () => {
    expect(checkMilestones(params({ totalUnlocked: 4 })).map((m) => m.id)).not.toContain('stats_5');
  });

  it('fires age milestones from real stats', () => {
    // Born 1996 → comfortably past 10,000 days by 2026.
    const ids = checkMilestones(params()).map((m) => m.id);
    expect(ids).toContain('days_5k');
    expect(ids).toContain('days_10k');
  });

  it('has unique milestone ids', () => {
    const ids = MILESTONE_DEFINITIONS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every milestone the copy the modal needs', () => {
    for (const m of MILESTONE_DEFINITIONS) {
      expect(m.title).toBeTruthy();
      expect(m.subtitle).toBeTruthy();
      expect(m.shareText).toBeTruthy();
      expect(typeof m.checkFn).toBe('function');
    }
  });
});

describe('getUpcomingMilestonePrediction', () => {
  it('returns nothing when nothing is close', () => {
    const young = { ...profile, dateOfBirth: '2020-01-01', coffeeCupsPerDay: 0 };
    const p = params({ profile: young, lifeStats: computeLifeStats(young) });
    expect(getUpcomingMilestonePrediction(p)).toBeNull();
  });

  it('predicts a days-alive milestone inside the lookahead window', () => {
    const stats = computeLifeStats(profile);
    // Three days short of 15,000.
    const p = params({ lifeStats: { ...stats, daysAlive: 14_997 } });

    const prediction = getUpcomingMilestonePrediction(p);
    expect(prediction).not.toBeNull();
    expect(prediction!.milestoneId).toBe('days_15k');
    expect(prediction!.daysUntil).toBe(3);
  });

  it('ignores a milestone beyond the lookahead window', () => {
    const stats = computeLifeStats(profile);
    const p = params({ lifeStats: { ...stats, daysAlive: 14_900 } });
    expect(getUpcomingMilestonePrediction(p)).toBeNull();
  });

  it('returns the nearest milestone when several are due', () => {
    const stats = computeLifeStats(profile);
    const p = params({
      lifeStats: { ...stats, daysAlive: 14_999, coffeeCups: 998 },
      profile: { ...profile, coffeeCupsPerDay: 1 },
    });
    const prediction = getUpcomingMilestonePrediction(p);
    expect(prediction!.daysUntil).toBe(1);
  });

  it('never predicts a milestone already reached', () => {
    const stats = computeLifeStats(profile);
    const p = params({ lifeStats: { ...stats, daysAlive: 15_001 } });
    const prediction = getUpcomingMilestonePrediction(p);
    expect(prediction?.milestoneId).not.toBe('days_15k');
  });

  it('always reports a positive daysUntil', () => {
    const stats = computeLifeStats(profile);
    for (const days of [4_998, 9_999, 14_998]) {
      const prediction = getUpcomingMilestonePrediction(
        params({ lifeStats: { ...stats, daysAlive: days } }),
      );
      if (prediction) expect(prediction.daysUntil).toBeGreaterThanOrEqual(1);
    }
  });
});
