/**
 * Place categorisation and quality gating.
 *
 * These are hard filters: anything that passes goes in front of the user as a
 * real recommendation, so a closed venue or a two-review nowhere slipping
 * through is a trust problem, not a cosmetic one.
 */
import { categorize, buildWanderPlaces, haversineKm } from '@/services/placesService';

const TODAY = '2026-06-15';
const LAT = 12.9716;
const LON = 77.5946;

/** Minimal Google-shaped place that PASSES every quality gate. */
function raw(over: Record<string, unknown> = {}) {
  return {
    id: 'ChIJtest',
    displayName: { text: 'Test Place' },
    location: { latitude: LAT + 0.01, longitude: LON + 0.01 },
    types: ['cafe'],
    primaryType: 'cafe',
    rating: 4.5,
    userRatingCount: 120,
    businessStatus: 'OPERATIONAL',
    ...over,
  };
}

describe('categorize', () => {
  it.each([
    ['cafe',                 'cafe'],
    ['coffee_shop',          'cafe'],
    ['restaurant',           'food'],
    ['indian_restaurant',    'food'],
    ['bar',                  'nightlife'],
    ['night_club',           'nightlife'],
    ['shopping_mall',        'market'],
    ['supermarket',          'market'],
    ['book_store',           'books'],
    ['library',              'books'],
    ['art_gallery',          'art'],
    ['museum',               'history'],
    ['historical_landmark',  'history'],
    ['park',                 'nature'],
    ['hiking_area',          'nature'],
  ])('maps %s → %s', (type, expected) => {
    expect(categorize(type, [type])).toBe(expected);
  });

  it('returns null for an unmapped type', () => {
    expect(categorize('car_repair', ['car_repair'])).toBeNull();
  });

  it('prefers café over the generic food bucket', () => {
    expect(categorize('cafe', ['cafe', 'restaurant', 'food'])).toBe('cafe');
  });

  it('reads the secondary types when primaryType is empty', () => {
    expect(categorize('', ['park'])).toBe('nature');
  });
});

describe('buildWanderPlaces — quality gates', () => {
  it('accepts a place that clears every floor', () => {
    expect(buildWanderPlaces([raw()], LAT, LON, TODAY)).toHaveLength(1);
  });

  it('rejects a place below the review floor', () => {
    expect(buildWanderPlaces([raw({ userRatingCount: 9 })], LAT, LON, TODAY)).toHaveLength(0);
  });

  it('rejects a place below the rating floor', () => {
    expect(buildWanderPlaces([raw({ rating: 3.7 })], LAT, LON, TODAY)).toHaveLength(0);
  });

  it('rejects a place with no rating at all', () => {
    expect(buildWanderPlaces([raw({ rating: undefined })], LAT, LON, TODAY)).toHaveLength(0);
  });

  it('rejects permanently and temporarily closed venues', () => {
    expect(buildWanderPlaces([raw({ businessStatus: 'CLOSED_PERMANENTLY' })], LAT, LON, TODAY))
      .toHaveLength(0);
    expect(buildWanderPlaces([raw({ businessStatus: 'CLOSED_TEMPORARILY' })], LAT, LON, TODAY))
      .toHaveLength(0);
  });

  it('rejects an uncategorisable place', () => {
    expect(buildWanderPlaces([raw({ primaryType: 'atm', types: ['atm'] })], LAT, LON, TODAY))
      .toHaveLength(0);
  });

  it('survives malformed entries without throwing', () => {
    const input = [
      null,
      {},
      { id: 'x' },
      { id: 'y', displayName: { text: 'Y' } },          // no location
      raw({ id: 'good' }),
    ] as unknown as Parameters<typeof buildWanderPlaces>[0];

    const out = buildWanderPlaces(input, LAT, LON, TODAY);
    expect(out).toHaveLength(1);
    expect(out[0].placeId).toBe('gp_good');
  });

  it('deduplicates by Google place id', () => {
    const out = buildWanderPlaces([raw(), raw()], LAT, LON, TODAY);
    expect(out).toHaveLength(1);
  });
});

describe('buildWanderPlaces — ranking and shape', () => {
  /**
   * This assertion used to be inverted, and that WAS the bug.
   *
   * The pool is capped at ten per category, so whatever loses here is not
   * merely ranked lower — it is dropped entirely and never reaches the feed
   * scorer. Ranking the pool by quality alone meant famous distant places
   * evicted good nearby ones before personalisation ever ran.
   */
  it('keeps a good nearby place above a famous distant one', () => {
    const nearbyGood = raw({
      id: 'near', rating: 4.3, userRatingCount: 250,
      location: { latitude: LAT, longitude: LON },               // ~0 km
    });
    const distantFamous = raw({
      id: 'far', rating: 4.9, userRatingCount: 50000,
      location: { latitude: LAT + 0.06, longitude: LON + 0.06 }, // ~9 km
    });

    const out = buildWanderPlaces([nearbyGood, distantFamous], LAT, LON, TODAY);
    expect(out[0].placeId).toBe('gp_near');
  });

  it('still prefers real quality when two places are equally close', () => {
    const ok = raw({
      id: 'ok', rating: 3.9, userRatingCount: 40,
      location: { latitude: LAT + 0.005, longitude: LON },
    });
    const great = raw({
      id: 'great', rating: 4.8, userRatingCount: 3000,
      location: { latitude: LAT + 0.005, longitude: LON },
    });

    const out = buildWanderPlaces([ok, great], LAT, LON, TODAY);
    expect(out[0].placeId).toBe('gp_great');
  });

  it('caps each category at ten places', () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      raw({ id: `c${i}`, userRatingCount: 100 + i }),
    );
    const out = buildWanderPlaces(many, LAT, LON, TODAY);
    expect(out).toHaveLength(10);
    expect(out.every((p) => p.category === 'cafe')).toBe(true);
  });

  it('caps each category independently', () => {
    const cafes = Array.from({ length: 15 }, (_, i) => raw({ id: `cafe${i}` }));
    const parks = Array.from({ length: 15 }, (_, i) =>
      raw({ id: `park${i}`, primaryType: 'park', types: ['park'] }),
    );
    const out = buildWanderPlaces([...cafes, ...parks], LAT, LON, TODAY);
    expect(out.filter((p) => p.category === 'cafe')).toHaveLength(10);
    expect(out.filter((p) => p.category === 'nature')).toHaveLength(10);
  });

  it('produces a complete WanderPlace', () => {
    const [place] = buildWanderPlaces([raw()], LAT, LON, TODAY);
    expect(place).toMatchObject({
      placeId: 'gp_ChIJtest',
      name: 'Test Place',
      category: 'cafe',
      isSaved: false,
      isVisited: false,
      userRating: null,
      visitedDate: null,
      gatiScore: null,
      discoveredDate: TODAY,
    });
    expect(place.distanceKm).toBeGreaterThan(0);
  });

  it('never embeds an API key in the photo URL', () => {
    const [place] = buildWanderPlaces(
      [raw({ photos: [{ name: 'places/ChIJtest/photos/abc' }] })],
      LAT, LON, TODAY,
    );
    // Either no photo (cloud unconfigured in tests) or a proxied URL — but
    // never a raw Google URL carrying `key=`.
    if (place.thumbnailUrl) {
      expect(place.thumbnailUrl).not.toMatch(/[?&]key=/);
      expect(place.thumbnailUrl).toContain('place-photo');
    }
  });

  it('rounds distance to one decimal', () => {
    const [place] = buildWanderPlaces([raw()], LAT, LON, TODAY);
    expect(place.distanceKm).toBe(Math.round(place.distanceKm * 10) / 10);
  });
});

describe('haversineKm', () => {
  it('is zero for the same point', () => {
    expect(haversineKm(LAT, LON, LAT, LON)).toBe(0);
  });

  it('is symmetric', () => {
    const a = haversineKm(12.97, 77.59, 13.08, 80.27);
    const b = haversineKm(13.08, 80.27, 12.97, 77.59);
    expect(a).toBeCloseTo(b, 6);
  });

  it('matches a known distance (Bengaluru → Chennai ≈ 290 km)', () => {
    const km = haversineKm(12.9716, 77.5946, 13.0827, 80.2707);
    expect(km).toBeGreaterThan(280);
    expect(km).toBeLessThan(300);
  });

  it('handles crossing the antimeridian without going negative', () => {
    expect(haversineKm(0, 179.9, 0, -179.9)).toBeGreaterThan(0);
  });
});

/**
 * Radius enforcement.
 *
 * The radius sent to the search is a request, not a guarantee — popularity
 * ranking reaches for the famous thing in the wider area, which is how a
 * 23 km result came back for a 10 km search. The filter that the user can
 * actually trust is the one applied to our own computed distance, because it
 * is the same number the card shows them.
 */
describe('radius filtering', () => {
  const RADIUS_SLACK = 0.05;
  const withinRadius = (distanceKm: number, radiusKm: number) =>
    distanceKm <= radiusKm * (1 + RADIUS_SLACK);

  it('drops the far result that prompted this', () => {
    expect(withinRadius(23, 10)).toBe(false);
  });

  it('keeps everything genuinely inside the circle', () => {
    for (const km of [0, 0.4, 2.5, 9.9]) {
      expect(withinRadius(km, 10)).toBe(true);
    }
  });

  it('tolerates a result marginally past the line but not a different city', () => {
    // A coarse location fix and a server-side circle will not agree to the
    // metre; 40 m past a 10 km line is noise, 3 km past it is not.
    expect(withinRadius(10.04, 10)).toBe(true);
    expect(withinRadius(13.0,  10)).toBe(false);
  });

  it('scales with the chosen radius rather than assuming one', () => {
    expect(withinRadius(20, 25)).toBe(true);
    expect(withinRadius(20, 10)).toBe(false);
    expect(withinRadius(1.9,  2)).toBe(true);
    expect(withinRadius(4.0,  2)).toBe(false);
  });

  it('computes the distance it filters on from real coordinates', () => {
    // Bengaluru -> a point ~23 km north. If haversine under-reported this,
    // the filter would pass the very result it exists to stop.
    const far = haversineKm(LAT, LON, LAT + 0.207, LON);
    expect(far).toBeGreaterThan(22);
    expect(far).toBeLessThan(24);
    expect(withinRadius(far, 10)).toBe(false);
  });
});
