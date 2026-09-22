/**
 * The Wander notification pick.
 *
 * A notification that names a place makes a much stronger claim than a list
 * does. These guard the three ways that claim goes wrong: naming somewhere
 * invented, calling somewhere far away "nearby", and quoting a distance
 * measured against a location the user has long since left.
 */
import { pickWanderNudge } from '@/engine/wanderEngine';
import type { WanderPlace } from '@/types';

const TODAY = '2026-09-23';
const NOW   = new Date('2026-09-23T17:00:00Z');

function place(over: Partial<WanderPlace> = {}): WanderPlace {
  return {
    placeId: 'gp_1', name: 'Drift Coffee', address: '', latitude: 0, longitude: 0,
    rating: 4.8, reviewCount: 189, redditMentions: 0, aiSummary: '',
    category: 'cafe', tags: [], thumbnailUrl: null,
    isSaved: false, isVisited: false, userRating: null,
    discoveredDate: TODAY, visitedDate: null,
    distanceKm: 0.6, openNow: true, gatiScore: null,
    ...over,
  };
}

const TASTE = { cafe: 1.8, food: 1.0, nature: 1.0 };

describe('pickWanderNudge', () => {
  it('picks a close, well-rated, unvisited place', () => {
    const n = pickWanderNudge([place()], TASTE, [], NOW);
    expect(n?.place.name).toBe('Drift Coffee');
    expect(n?.distanceLabel).toBe('600 m');
  });

  it('never names a demo place', () => {
    // These are invented, with hand-written distances. Sending someone to one
    // would be sending them to a place that does not exist.
    expect(pickWanderNudge([place({ isSample: true })], TASTE, [], NOW)).toBeNull();
  });

  it('will not call somewhere far away nearby', () => {
    expect(pickWanderNudge([place({ distanceKm: 8 })], TASTE, [], NOW)).toBeNull();
    expect(pickWanderNudge([place({ distanceKm: 2.1 })], TASTE, [], NOW)).toBeNull();
    expect(pickWanderNudge([place({ distanceKm: 1.9 })], TASTE, [], NOW)).not.toBeNull();
  });

  it('drops a distance measured too long ago to mean anything', () => {
    // distanceKm is measured once, at fetch, against wherever the user was.
    // The app stores no coordinate, so it cannot be recomputed — a week-old
    // figure could be from another city.
    expect(pickWanderNudge([place({ discoveredDate: '2026-09-10' })], TASTE, [], NOW)).toBeNull();
    expect(pickWanderNudge([place({ discoveredDate: '2026-09-22' })], TASTE, [], NOW)).not.toBeNull();
  });

  it('skips places already visited', () => {
    expect(pickWanderNudge([place({ isVisited: true })], TASTE, [], NOW)).toBeNull();
  });

  it('explains itself from what the user actually rates', () => {
    const n = pickWanderNudge([place()], TASTE, [], NOW);
    expect(n?.reason).toBe('You rate cafés higher than anything else');
  });

  it('falls back to a reason that is still true with no taste history', () => {
    const flat = { cafe: 1.0, food: 1.0 };
    const n = pickWanderNudge([place()], flat, [], NOW);
    expect(n?.reason).toBeTruthy();
    expect(n!.reason.length).toBeGreaterThan(3);
  });

  it('prefers the better of two nearby options', () => {
    const good = place({ placeId: 'a', name: 'Good',  rating: 4.8, reviewCount: 400, distanceKm: 0.5 });
    const weak = place({ placeId: 'b', name: 'Weak',  rating: 3.9, reviewCount: 12,  distanceKm: 0.5 });
    expect(pickWanderNudge([weak, good], TASTE, [], NOW)?.place.name).toBe('Good');
  });

  it('says nothing rather than offering something weak', () => {
    // Silence is the common, correct outcome. A bad nudge teaches people to
    // swipe every future one away.
    expect(pickWanderNudge([], TASTE, [], NOW)).toBeNull();
  });

  it('formats kilometres once past a kilometre', () => {
    expect(pickWanderNudge([place({ distanceKm: 1.4 })], TASTE, [], NOW)?.distanceLabel).toBe('1.4 km');
  });
});
