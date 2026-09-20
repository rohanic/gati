/**
 * Place relevance.
 *
 * The reported symptom was "it shows far places, not popular nearby ones".
 * The cases below pin the behaviour that fixes it, and assert the specific
 * trade-offs the model is supposed to make.
 */
import {
  proximityFactor,
  bayesianRating,
  qualityFactor,
  getDayPart,
  dayPartFactor,
  openNowFactor,
  behaviourFactor,
  tasteFactor,
  relevanceScore,
  explainRelevance,
  relevanceReason,
  candidateWorth,
  DISTANCE_HALF_LIFE_KM,
} from '@/engine/relevance';
import type { WanderPlace, InterestCategory } from '@/types';

const ALL: InterestCategory[] = [
  'food', 'cafe', 'history', 'nature', 'art', 'market', 'nightlife', 'books',
];
const NEUTRAL = Object.fromEntries(ALL.map((c) => [c, 1]));

/** Midday, so time-of-day affinity is neutral-ish and predictable. */
const NOON = new Date('2026-06-15T12:00:00');

function place(over: Partial<WanderPlace> = {}): WanderPlace {
  return {
    placeId: 'p', name: 'P', address: '', latitude: 0, longitude: 0,
    rating: 4.3, reviewCount: 200, redditMentions: 0, aiSummary: '',
    category: 'cafe', tags: [], thumbnailUrl: null,
    discoveredDate: '2026-06-15', visitedDate: null, distanceKm: 1,
    openNow: null, isSaved: false, isVisited: false, userRating: null,
    gatiScore: null,
    ...over,
  };
}

describe('proximityFactor', () => {
  it('is 1 on your doorstep', () => {
    expect(proximityFactor(0)).toBe(1);
  });

  it('halves at the configured half-life', () => {
    expect(proximityFactor(DISTANCE_HALF_LIFE_KM)).toBeCloseTo(0.5, 5);
  });

  it('falls back to the default when given a nonsense half-life', () => {
    expect(proximityFactor(2.5, 0)).toBeCloseTo(0.5, 5);
    expect(proximityFactor(2.5, Number.NaN)).toBeCloseTo(0.5, 5);
  });

  it('decays monotonically', () => {
    const d = [0, 0.5, 1, 2, 4, 8, 20];
    // NOT `d.map(proximityFactor)` — map passes the index as the second
    // argument, which would override `halfLifeKm`.
    const f = d.map((km) => proximityFactor(km));
    for (let i = 1; i < f.length; i++) expect(f[i]).toBeLessThan(f[i - 1]);
  });

  /** The whole point: distance has to be able to overpower fame. */
  it('penalises a distant place severely', () => {
    expect(proximityFactor(8)).toBeLessThan(0.1);
    expect(proximityFactor(0.3)).toBeGreaterThan(0.95);
  });

  it('never returns zero or a negative', () => {
    for (const d of [0, 1, 50, 5000]) {
      expect(proximityFactor(d)).toBeGreaterThan(0);
    }
  });

  it('survives junk input', () => {
    expect(proximityFactor(Number.NaN)).toBe(1);
    expect(proximityFactor(-5)).toBe(1);
  });
});

describe('bayesianRating', () => {
  /** Small-sample inflation is the classic ratings failure mode. */
  it('shrinks a perfect score with few reviews toward the mean', () => {
    const shaky  = bayesianRating(5.0, 3);
    const solid  = bayesianRating(4.6, 8000);
    expect(shaky).toBeLessThan(solid);
  });

  it('barely moves a rating with many reviews', () => {
    expect(bayesianRating(4.6, 20000)).toBeCloseTo(4.6, 1);
  });

  it('returns the prior when there are no reviews', () => {
    expect(bayesianRating(0, 0)).toBeCloseTo(4.15, 5);
  });

  it('clamps an out-of-range rating', () => {
    expect(bayesianRating(9, 1000)).toBeLessThanOrEqual(5);
    expect(bayesianRating(-3, 1000)).toBeGreaterThanOrEqual(0);
  });
});

describe('qualityFactor', () => {
  it('rewards a better rating', () => {
    expect(qualityFactor(4.8, 500)).toBeGreaterThan(qualityFactor(4.0, 500));
  });

  it('rewards being better known, but only a little', () => {
    const known   = qualityFactor(4.5, 20000);
    const obscure = qualityFactor(4.5, 60);
    expect(known).toBeGreaterThan(obscure);
    // Popularity must not be able to carry a place on its own.
    expect(known / obscure).toBeLessThan(1.5);
  });

  it('stays within a bounded band', () => {
    for (const [r, v] of [[3.8, 10], [4.2, 100], [5.0, 100000], [4.0, 0]] as const) {
      const q = qualityFactor(r, v);
      expect(q).toBeGreaterThan(0.3);
      expect(q).toBeLessThan(2.0);
    }
  });
});

describe('time of day', () => {
  it('buckets the clock', () => {
    expect(getDayPart(new Date('2026-06-15T07:00:00'))).toBe('morning');
    expect(getDayPart(new Date('2026-06-15T12:30:00'))).toBe('midday');
    expect(getDayPart(new Date('2026-06-15T16:00:00'))).toBe('afternoon');
    expect(getDayPart(new Date('2026-06-15T20:00:00'))).toBe('evening');
    expect(getDayPart(new Date('2026-06-15T23:30:00'))).toBe('late');
  });

  it('prefers cafés in the morning and bars at night', () => {
    const morning = new Date('2026-06-15T08:00:00');
    const night   = new Date('2026-06-15T23:00:00');
    expect(dayPartFactor('cafe', morning)).toBeGreaterThan(dayPartFactor('cafe', night));
    expect(dayPartFactor('nightlife', night)).toBeGreaterThan(dayPartFactor('nightlife', morning));
  });

  it('does not suggest a museum at midnight over a bar', () => {
    const night = new Date('2026-06-15T23:30:00');
    expect(dayPartFactor('history', night)).toBeLessThan(dayPartFactor('nightlife', night));
  });

  it('never zeroes a category out entirely', () => {
    for (const hour of [2, 8, 13, 17, 20, 23]) {
      const at = new Date(`2026-06-15T${String(hour).padStart(2, '0')}:00:00`);
      for (const cat of ALL) expect(dayPartFactor(cat, at)).toBeGreaterThan(0.3);
    }
  });
});

describe('openNowFactor', () => {
  it('prefers open places', () => {
    expect(openNowFactor(true)).toBeGreaterThan(openNowFactor(null));
    expect(openNowFactor(null)).toBeGreaterThan(openNowFactor(false));
  });

  /** Hours data is often wrong; a closed place is demoted, not deleted. */
  it('does not annihilate a closed place', () => {
    expect(openNowFactor(false)).toBeGreaterThan(0.4);
  });
});

describe('behaviourFactor', () => {
  it('resurfaces loved places and buries rejected ones', () => {
    expect(behaviourFactor(place({ userRating: 'loved' }))).toBeGreaterThan(1);
    expect(behaviourFactor(place({ userRating: 'not_for_me' }))).toBeLessThan(0.1);
  });

  it('demotes somewhere already visited', () => {
    expect(behaviourFactor(place({ isVisited: true }))).toBeLessThan(1);
  });

  it('keeps a loved place high even after visiting', () => {
    expect(behaviourFactor(place({ isVisited: true, userRating: 'loved' })))
      .toBeGreaterThan(1);
  });
});

describe('tasteFactor', () => {
  it('boosts a declared interest', () => {
    expect(tasteFactor(place(), NEUTRAL, ['cafe']))
      .toBeGreaterThan(tasteFactor(place(), NEUTRAL, []));
  });

  it('respects learned scores', () => {
    expect(tasteFactor(place(), { ...NEUTRAL, cafe: 2.5 }, []))
      .toBeGreaterThan(tasteFactor(place(), NEUTRAL, []));
  });

  it('applies the crowd signal', () => {
    expect(tasteFactor(place({ gatiScore: 1 }), NEUTRAL, []))
      .toBeGreaterThan(tasteFactor(place({ gatiScore: 0 }), NEUTRAL, []));
  });
});

// ─── The actual complaint ─────────────────────────────────────

describe('near and good beats far and famous', () => {
  it('ranks a very good café 400m away above a landmark 7km away', () => {
    const nearCafe   = place({ placeId: 'near', distanceKm: 0.4, rating: 4.5, reviewCount: 340 });
    const farLandmark = place({ placeId: 'far', distanceKm: 7.2, rating: 4.7, reviewCount: 21000 });

    expect(relevanceScore(nearCafe, NEUTRAL, [], NOON))
      .toBeGreaterThan(relevanceScore(farLandmark, NEUTRAL, [], NOON));
  });

  it('still prefers the far one when the near one is genuinely mediocre', () => {
    // The model must not become "nearest wins" — that is just as wrong.
    const nearMediocre = place({ placeId: 'near', distanceKm: 0.4, rating: 3.8, reviewCount: 14 });
    const farExcellent = place({ placeId: 'far', distanceKm: 2.2, rating: 4.8, reviewCount: 4000 });

    expect(relevanceScore(farExcellent, NEUTRAL, [], NOON))
      .toBeGreaterThan(relevanceScore(nearMediocre, NEUTRAL, [], NOON));
  });

  it('prefers the nearer of two equally good places', () => {
    const a = place({ placeId: 'a', distanceKm: 0.6, rating: 4.5, reviewCount: 500 });
    const b = place({ placeId: 'b', distanceKm: 3.5, rating: 4.5, reviewCount: 500 });
    expect(relevanceScore(a, NEUTRAL, [], NOON))
      .toBeGreaterThan(relevanceScore(b, NEUTRAL, [], NOON));
  });

  it('does not let review count alone carry a distant place', () => {
    const nearby  = place({ placeId: 'n', distanceKm: 0.5, rating: 4.4, reviewCount: 120 });
    const tourist = place({ placeId: 't', distanceKm: 6.0, rating: 4.4, reviewCount: 250000 });
    expect(relevanceScore(nearby, NEUTRAL, [], NOON))
      .toBeGreaterThan(relevanceScore(tourist, NEUTRAL, [], NOON));
  });

  it('never returns a negative or non-finite score', () => {
    const nasty = place({
      distanceKm: 0, rating: 0, reviewCount: 0,
      userRating: 'not_for_me', isVisited: true, openNow: false, gatiScore: 0,
    });
    const s = relevanceScore(nasty, NEUTRAL, [], NOON);
    expect(Number.isFinite(s)).toBe(true);
    expect(s).toBeGreaterThan(0);
  });
});

describe('candidateWorth (pool selection)', () => {
  /**
   * The root cause. The pool was capped per category by quality ALONE, so the
   * good nearby place was evicted before the feed scorer ever saw it.
   */
  it('keeps a good nearby place above a famous distant one', () => {
    expect(candidateWorth(4.4, 300, 0.5))
      .toBeGreaterThan(candidateWorth(4.7, 50000, 7.0));
  });

  it('still prefers quality at equal distance', () => {
    expect(candidateWorth(4.8, 1000, 2)).toBeGreaterThan(candidateWorth(4.0, 1000, 2));
  });

  it('is positive for every plausible input', () => {
    for (const d of [0, 0.1, 1, 5, 20]) {
      expect(candidateWorth(4.0, 50, d)).toBeGreaterThan(0);
    }
  });
});

describe('explainRelevance / relevanceReason', () => {
  it('decomposes into factors that multiply to the total', () => {
    const b = explainRelevance(place({ distanceKm: 1.2 }), NEUTRAL, ['cafe'], NOON);
    expect(b.taste * b.proximity * b.quality * b.context * b.behaviour)
      .toBeCloseTo(b.total, 10);
  });

  it('names the dominant reason', () => {
    const near = place({ distanceKm: 0.2 });
    expect(relevanceReason(explainRelevance(near, NEUTRAL, [], NOON), near))
      .toBe('Just around the corner');

    const loved = place({ userRating: 'loved' });
    expect(relevanceReason(explainRelevance(loved, NEUTRAL, [], NOON), loved))
      .toBe('You loved this one');
  });

  it('returns null rather than inventing a reason', () => {
    const far = place({ distanceKm: 9, rating: 3.9, reviewCount: 20 });
    expect(relevanceReason(explainRelevance(far, NEUTRAL, [], NOON), far)).toBeNull();
  });
});
