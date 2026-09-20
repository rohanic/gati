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
import { getUnifiedPersonalizedFeed } from '@/engine/wanderEngine';
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
 * The fallback only helps if the feed actually surfaces it. The feed filters
 * to the user's declared interests, so a user with a narrow interest list must
 * still get results from the curated pool.
 */
describe('curated pool feeds the Wander list', () => {
  const places = getInitialWanderPlaces();

  it('produces a feed for a user with no declared interests', () => {
    expect(getUnifiedPersonalizedFeed(places, NEUTRAL_SCORES, [], [], 5).length)
      .toBeGreaterThan(0);
  });

  it.each(ALL_CATEGORIES)('produces a feed for a user interested only in %s', (cat) => {
    const feed = getUnifiedPersonalizedFeed(places, NEUTRAL_SCORES, [cat], [], 5);
    expect(feed.length).toBeGreaterThan(0);
    expect(feed.every((p) => p.category === cat)).toBe(true);
  });

  it.each(ALL_CATEGORIES)('produces a feed when the %s chip is selected', (cat) => {
    const feed = getUnifiedPersonalizedFeed(places, NEUTRAL_SCORES, [], [], 5, 0, cat);
    expect(feed.length).toBeGreaterThan(0);
  });
});
