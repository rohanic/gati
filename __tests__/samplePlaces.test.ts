/**
 * Curated fallback places.
 *
 * These are what Wander shows when real place search is unavailable — no
 * location permission, no network, rate limited, or the `nearby-places` edge
 * function not deployed yet. If this data is malformed the tab renders an
 * empty screen underneath a banner promising curated places, which is exactly
 * the failure this suite exists to prevent.
 */
import { getInitialWanderPlaces } from '@/data/samplePlaces';
import { buildNearbyFeed } from '@/engine/wanderEngine';
import type { InterestCategory } from '@/types';

const ALL_CATEGORIES: InterestCategory[] = [
  'food', 'cafe', 'history', 'nature', 'art', 'market', 'nightlife', 'books',
];

const NEUTRAL_SCORES = Object.fromEntries(ALL_CATEGORIES.map((c) => [c, 1]));

describe('getInitialWanderPlaces', () => {
  const places = getInitialWanderPlaces();

  it('returns a non-empty pool', () => {
    expect(places.length).toBeGreaterThan(0);
  });

  it('gives every interest category something to show', () => {
    const covered = new Set(places.map((p) => p.category));
    for (const cat of ALL_CATEGORIES) {
      expect(covered.has(cat)).toBe(true);
    }
  });

  it('uses unique place ids', () => {
    const ids = places.map((p) => p.placeId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('starts every place unflagged', () => {
    for (const p of places) {
      expect(p.isSaved).toBe(false);
      expect(p.isVisited).toBe(false);
      expect(p.userRating).toBeNull();
      expect(p.visitedDate).toBeNull();
    }
  });

  it('has renderable coordinates and copy', () => {
    for (const p of places) {
      expect(p.name).toBeTruthy();
      expect(p.aiSummary).toBeTruthy();
      expect(Number.isFinite(p.latitude)).toBe(true);
      expect(Number.isFinite(p.longitude)).toBe(true);
      expect(p.latitude).toBeGreaterThanOrEqual(-90);
      expect(p.latitude).toBeLessThanOrEqual(90);
      expect(p.longitude).toBeGreaterThanOrEqual(-180);
      expect(p.longitude).toBeLessThanOrEqual(180);
      expect(Number.isFinite(p.distanceKm)).toBe(true);
    }
  });

  it('returns a fresh array each call, so seeding cannot mutate the source', () => {
    const a = getInitialWanderPlaces();
    const b = getInitialWanderPlaces();
    expect(a).not.toBe(b);
    a[0].isSaved = true;
    expect(getInitialWanderPlaces()[0].isSaved).toBe(false);
  });
});

/**
 * The fallback only helps if the feed actually surfaces it — and only when
 * there is nothing real to show. Example places carry invented distances, so
 * the radius cannot apply to them, and they must be flagged as examples.
 */
describe('curated pool feeds the Wander list', () => {
  const places = getInitialWanderPlaces();
  const all = (f: ReturnType<typeof buildNearbyFeed>) => [...f.forYou, ...f.nearby];

  it('produces a feed for a user with no declared interests', () => {
    const f = buildNearbyFeed(places, NEUTRAL_SCORES, [], [], 0.5);
    expect(all(f).length).toBeGreaterThan(0);
    expect(f.examplesOnly).toBe(true);
  });

  it.each(ALL_CATEGORIES)('leads with %s for a user interested only in it', (cat) => {
    const f = buildNearbyFeed(places, NEUTRAL_SCORES, [cat], [], 2);
    expect(f.forYou.length).toBeGreaterThan(0);
    expect(f.forYou.every((p) => p.category === cat)).toBe(true);
  });

  it.each(ALL_CATEGORIES)('produces a feed when the %s chip is selected', (cat) => {
    const f = buildNearbyFeed(places, NEUTRAL_SCORES, [], [], 2, cat);
    expect(all(f).length).toBeGreaterThan(0);
    expect(all(f).every((p) => p.category === cat)).toBe(true);
  });
});
