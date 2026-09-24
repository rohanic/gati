/**
 * Wander store: the radius and what a fresh search does to the stored list.
 *
 * Two faults lived here. Demo places survived real results arriving, so the
 * feed mixed invented places in with real ones. And places the user had
 * saved or rated elsewhere kept the distance measured wherever they were at
 * the time — a café rated last month in another city still read "0.8 km".
 */
import { useWanderStore, snapRadiusKm, RADIUS_OPTIONS_KM, DEFAULT_RADIUS_KM } from '@/store/userStore';
import type { WanderPlace } from '@/types';

function place(over: Partial<WanderPlace>): WanderPlace {
  return {
    placeId: 'gp_x', name: 'X', address: '', latitude: 12.97, longitude: 77.59,
    rating: 4.5, reviewCount: 100, redditMentions: 0, aiSummary: '',
    category: 'cafe', tags: [], thumbnailUrl: null, isSaved: false, isVisited: false,
    userRating: null, discoveredDate: '2026-09-01', visitedDate: null,
    distanceKm: 0.8, openNow: null, gatiScore: null,
    ...over,
  };
}

beforeEach(() => useWanderStore.setState({ places: [], searchRadiusKm: DEFAULT_RADIUS_KM }));

describe('radius', () => {
  it('offers exactly 500 m, 1, 2, 5 and 10 km', () => {
    expect([...RADIUS_OPTIONS_KM]).toEqual([0.5, 1, 2, 5, 10]);
    expect(DEFAULT_RADIUS_KM).toBe(2);
  });

  it('can actually be set to 500 m', () => {
    // The old setter used Math.round, which turned 0.5 into 1.
    useWanderStore.getState().setSearchRadiusKm(0.5);
    expect(useWanderStore.getState().searchRadiusKm).toBe(0.5);
  });

  it('snaps anything else to the nearest offered value', () => {
    expect(snapRadiusKm(0.7)).toBe(0.5);
    expect(snapRadiusKm(3)).toBe(2);
    expect(snapRadiusKm(40)).toBe(10);
  });

  it('turns broken input into the default rather than NaN', () => {
    for (const v of [undefined, NaN, -1, 0, 'far'] as unknown[]) {
      expect(snapRadiusKm(v)).toBe(DEFAULT_RADIUS_KM);
    }
  });
});

describe('mergeRealPlaces', () => {
  const HERE = { lat: 12.9716, lon: 77.5946 };   // Bengaluru

  it('drops every demo place once real ones arrive', () => {
    useWanderStore.setState({ places: [
      place({ placeId: 'wp_001', isSample: true }),
      place({ placeId: 'wp_002', isSample: true, isSaved: true }),   // even saved ones
    ] });
    useWanderStore.getState().mergeRealPlaces([place({ placeId: 'gp_new' })], HERE);
    expect(useWanderStore.getState().places.map((p) => p.placeId)).toEqual(['gp_new']);
  });

  it('re-measures a kept place from where the user is now', () => {
    // Saved in Delhi when the user stood next to it; the user is now in Bengaluru.
    const delhi = place({ placeId: 'gp_delhi', isSaved: true,
      latitude: 28.6139, longitude: 77.2090, distanceKm: 0.8 });
    useWanderStore.setState({ places: [delhi] });
    useWanderStore.getState().mergeRealPlaces([place({ placeId: 'gp_new' })], HERE);
    const kept = useWanderStore.getState().places.find((p) => p.placeId === 'gp_delhi')!;
    expect(kept.distanceKm).toBeGreaterThan(1500);   // ~1,740 km, not 0.8
    expect(kept.measuredOn).toBeDefined();
  });

  it('keeps what the user acted on and drops untouched stale results', () => {
    useWanderStore.setState({ places: [
      place({ placeId: 'gp_rated', userRating: 'loved' }),
      place({ placeId: 'gp_stale' }),
    ] });
    useWanderStore.getState().mergeRealPlaces([place({ placeId: 'gp_new' })], HERE);
    const ids = useWanderStore.getState().places.map((p) => p.placeId).sort();
    expect(ids).toEqual(['gp_new', 'gp_rated']);
  });

  it('carries the user\'s flags onto a re-fetched place', () => {
    useWanderStore.setState({ places: [place({ placeId: 'gp_a', isSaved: true, userRating: 'loved' })] });
    useWanderStore.getState().mergeRealPlaces([place({ placeId: 'gp_a', rating: 4.9 })], HERE);
    const a = useWanderStore.getState().places[0];
    expect(a.isSaved).toBe(true);
    expect(a.userRating).toBe('loved');
    expect(a.rating).toBe(4.9);          // fresh data wins
  });
});
