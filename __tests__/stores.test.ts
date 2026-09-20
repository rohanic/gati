/**
 * Store actions.
 *
 * `unlockStats` is the headline case: nothing in the app ever called the old
 * `unlockStat`, so the unlock ledger stayed empty forever and silently broke
 * the discovery counter, the Story timeline, the stat-count milestones and the
 * "new unlock" reveal. These tests pin the ledger's behaviour so that cannot
 * regress unnoticed.
 */
import {
  useStatsStore,
  useUserStore,
  useWanderStore,
  FREE_SAVE_LIMIT,
} from '@/store/userStore';
import type { WanderPlace } from '@/types';

/**
 * Launch mode is a build-time constant, but the save cap has to be correct in
 * BOTH modes — free today, paid whenever the flag flips. A getter-backed mock
 * lets each test choose, so the paid-mode rules keep their coverage even while
 * the shipping build is free.
 */
let mockFreeLaunch = false;
jest.mock('@/config', () => ({
  get IS_FREE_LAUNCH() { return mockFreeLaunch; },
  get LAUNCH_MODE()    { return mockFreeLaunch ? 'free' : 'paid'; },
  IS_CLOUD_CONFIGURED: false,
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  PRIVACY_POLICY_URL: '',
  TERMS_URL: '',
  SUPPORT_EMAIL: '',
  PLAY_STORE_URL: '',
  PLAY_SUBSCRIPTIONS_URL: '',
}));

const ISO = (d: string) => d;

function resetStores() {
  useStatsStore.setState({
    unlockedStats:      [],
    openHistory:        [],
    openHistoryRanges:  [],
    maxStreakEver:      0,
    seenMilestoneIds:   [],
    milestoneSeenDates: {},
    streakFreezeCount:  0,
    frozenDates:        [],
    savedStatIds:       [],
  });
  useUserStore.setState({
    profile:              null,
    onboardingComplete:   false,
    userId:               null,
    trialStartedAt:       null,
    deviceTrialStartedAt: null,
    isPro:                false,
    proExpiresAt:         null,
    proProductId:         null,
  });
  useWanderStore.setState({ places: [], interestsInitialized: false });
}

function makePlace(id: string, over: Partial<WanderPlace> = {}): WanderPlace {
  return {
    placeId: id,
    name: `Place ${id}`,
    address: '',
    latitude: 0,
    longitude: 0,
    rating: 4.5,
    reviewCount: 100,
    redditMentions: 0,
    aiSummary: '',
    category: 'cafe',
    tags: [],
    thumbnailUrl: null,
    discoveredDate: '2026-06-15',
    visitedDate: null,
    distanceKm: 1,
    openNow: null,
    isSaved: false,
    isVisited: false,
    userRating: null,
    gatiScore: null,
    ...over,
  };
}

beforeEach(resetStores);

// ─── Unlock ledger ────────────────────────────────────────────

describe('unlockStats', () => {
  it('records a stat with the given date', () => {
    useStatsStore.getState().unlockStats(['heartbeats'], ISO('2026-06-15'));

    const { unlockedStats } = useStatsStore.getState();
    expect(unlockedStats).toHaveLength(1);
    expect(unlockedStats[0]).toEqual({
      statId: 'heartbeats', unlockedDate: '2026-06-15', hasBeenShared: false,
    });
  });

  it('records a whole day’s batch in one write', () => {
    useStatsStore.getState().unlockStats(['a', 'b', 'c'], ISO('2026-06-15'));
    expect(useStatsStore.getState().unlockedStats).toHaveLength(3);
  });

  it('is idempotent — re-unlocking keeps the original date', () => {
    useStatsStore.getState().unlockStats(['a'], ISO('2026-06-01'));
    useStatsStore.getState().unlockStats(['a'], ISO('2026-06-15'));

    const { unlockedStats } = useStatsStore.getState();
    expect(unlockedStats).toHaveLength(1);
    expect(unlockedStats[0].unlockedDate).toBe('2026-06-01');
  });

  /**
   * The Today screen calls this on every render pass. Returning the same
   * state object when there is nothing new is what stops an update loop.
   */
  it('does not change state identity when there is nothing new', () => {
    useStatsStore.getState().unlockStats(['a'], ISO('2026-06-01'));
    const before = useStatsStore.getState().unlockedStats;
    useStatsStore.getState().unlockStats(['a'], ISO('2026-06-01'));
    expect(useStatsStore.getState().unlockedStats).toBe(before);
  });

  it('adds only the genuinely new ids from a mixed batch', () => {
    useStatsStore.getState().unlockStats(['a'], ISO('2026-06-01'));
    useStatsStore.getState().unlockStats(['a', 'b'], ISO('2026-06-02'));

    const ids = useStatsStore.getState().unlockedStats.map((u) => u.statId);
    expect(ids).toEqual(['a', 'b']);
  });
});

// ─── Open history & streak freezes ────────────────────────────

describe('recordOpen', () => {
  it('records today exactly once', () => {
    useStatsStore.getState().recordOpen();
    const first = useStatsStore.getState().openHistoryRanges;

    useStatsStore.getState().recordOpen();
    expect(useStatsStore.getState().openHistoryRanges).toBe(first);
  });

  it('extends yesterday’s run into a streak', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-15T10:00:00Z'));
    useStatsStore.setState({
      openHistoryRanges: [{ s: '2026-06-10', e: '2026-06-14' }],
      openHistory:       [],
    });

    useStatsStore.getState().recordOpen();

    const { openHistoryRanges, maxStreakEver } = useStatsStore.getState();
    expect(openHistoryRanges).toEqual([{ s: '2026-06-10', e: '2026-06-15' }]);
    expect(maxStreakEver).toBe(6);
    jest.useRealTimers();
  });

  it('awards a freeze when the streak crosses seven days', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-15T10:00:00Z'));
    useStatsStore.setState({
      openHistoryRanges: [{ s: '2026-06-09', e: '2026-06-14' }], // 6 days
      streakFreezeCount: 0,
    });

    useStatsStore.getState().recordOpen();

    expect(useStatsStore.getState().streakFreezeCount).toBe(1);
    jest.useRealTimers();
  });

  it('spends a freeze to bridge exactly one missed day', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-15T10:00:00Z'));
    useStatsStore.setState({
      // Last open was the 13th; the 14th was missed. Streak goes 3 → 5, so
      // no 7-day milestone is crossed and the spend is isolated.
      openHistoryRanges: [{ s: '2026-06-11', e: '2026-06-13' }],
      streakFreezeCount: 1,
    });

    useStatsStore.getState().recordOpen();

    const s = useStatsStore.getState();
    expect(s.openHistoryRanges).toEqual([{ s: '2026-06-11', e: '2026-06-15' }]);
    expect(s.frozenDates).toContain('2026-06-14');
    expect(s.streakFreezeCount).toBe(0);
    jest.useRealTimers();
  });

  /**
   * Documents the intentional net-zero case: spending a freeze can push the
   * streak past a 7-day multiple, which legitimately earns one back. The
   * freeze was still consumed — the bridged day is recorded.
   */
  it('re-earns the freeze when bridging carries the streak past a milestone', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-15T10:00:00Z'));
    useStatsStore.setState({
      openHistoryRanges: [{ s: '2026-06-08', e: '2026-06-13' }], // 6 days
      streakFreezeCount: 1,
    });

    useStatsStore.getState().recordOpen();

    const s = useStatsStore.getState();
    expect(s.frozenDates).toContain('2026-06-14');   // freeze was spent
    expect(s.maxStreakEver).toBe(8);
    expect(s.streakFreezeCount).toBe(1);             // and re-earned at 7
    jest.useRealTimers();
  });

  it('cannot bridge a two-day gap', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-15T10:00:00Z'));
    useStatsStore.setState({
      openHistoryRanges: [{ s: '2026-06-08', e: '2026-06-12' }],
      streakFreezeCount: 1,
    });

    useStatsStore.getState().recordOpen();

    const s = useStatsStore.getState();
    expect(s.openHistoryRanges).toHaveLength(2);
    expect(s.streakFreezeCount).toBe(1); // untouched
    jest.useRealTimers();
  });

  it('caps freezes at three', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-15T10:00:00Z'));
    useStatsStore.setState({
      openHistoryRanges: [{ s: '2026-06-09', e: '2026-06-14' }],
      streakFreezeCount: 3,
    });

    useStatsStore.getState().recordOpen();

    expect(useStatsStore.getState().streakFreezeCount).toBe(3);
    jest.useRealTimers();
  });

  /** Weekly dots read the flat list, so it must agree with the ranges. */
  it('includes freeze-bridged days in the flat history', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-15T10:00:00Z'));
    useStatsStore.setState({
      openHistoryRanges: [{ s: '2026-06-08', e: '2026-06-13' }],
      openHistory:       ['2026-06-13'],
      streakFreezeCount: 1,
    });

    useStatsStore.getState().recordOpen();

    const { openHistory } = useStatsStore.getState();
    expect(openHistory).toContain('2026-06-14');
    expect(openHistory).toContain('2026-06-15');
    jest.useRealTimers();
  });
});

// ─── Cloud merge ──────────────────────────────────────────────

describe('importStatsData', () => {
  const cloud = {
    unlockedStats:      [{ statId: 'a', unlockedDate: '2026-01-01', hasBeenShared: false }],
    openHistoryRanges:  [{ s: '2026-01-01', e: '2026-01-10' }],
    maxStreakEver:      10,
    streakFreezeCount:  2,
    frozenDates:        ['2026-01-05'],
    milestoneSeenDates: { streak_7: '2026-01-07' },
    seenMilestoneIds:   ['streak_7'],
    savedStatIds:       ['a'],
  };

  it('takes the cloud snapshot wholesale on a fresh install', () => {
    useStatsStore.getState().importStatsData(cloud);

    const s = useStatsStore.getState();
    expect(s.openHistoryRanges).toEqual(cloud.openHistoryRanges);
    expect(s.maxStreakEver).toBe(10);
  });

  /** A user with two phones must not lose the days they logged on either. */
  it('unions histories on a device that already has data', () => {
    useStatsStore.setState({
      openHistoryRanges: [{ s: '2026-02-01', e: '2026-02-05' }],
      maxStreakEver:     5,
    });

    useStatsStore.getState().importStatsData(cloud);

    const s = useStatsStore.getState();
    expect(s.openHistoryRanges).toHaveLength(2);
    expect(s.maxStreakEver).toBe(10);
  });

  it('keeps the earlier unlock date when both sides know a stat', () => {
    useStatsStore.setState({
      unlockedStats:     [{ statId: 'a', unlockedDate: '2026-03-01', hasBeenShared: true }],
      openHistoryRanges: [{ s: '2026-03-01', e: '2026-03-02' }],
    });

    useStatsStore.getState().importStatsData(cloud);

    const a = useStatsStore.getState().unlockedStats.find((u) => u.statId === 'a');
    expect(a?.unlockedDate).toBe('2026-01-01');
  });
});

// ─── Free-tier save cap ───────────────────────────────────────

describe('savePlace', () => {
  // These assert the PAID-mode rules. See the free-launch block below.
  beforeEach(() => { mockFreeLaunch = false; });
  afterEach(()  => { mockFreeLaunch = false; });

  function seed(count: number) {
    useWanderStore.setState({
      places: Array.from({ length: count }, (_, i) => makePlace(`p${i}`, { isSaved: true })),
    });
  }

  it('allows a free user up to the cap', () => {
    seed(FREE_SAVE_LIMIT - 1);
    useWanderStore.setState((s) => ({ places: [...s.places, makePlace('new')] }));

    expect(useWanderStore.getState().savePlace('new')).toBe(true);
  });

  it('blocks a free user at the cap', () => {
    seed(FREE_SAVE_LIMIT);
    useWanderStore.setState((s) => ({ places: [...s.places, makePlace('new')] }));

    expect(useWanderStore.getState().savePlace('new')).toBe(false);
    expect(useWanderStore.getState().places.find((p) => p.placeId === 'new')?.isSaved).toBe(false);
  });

  it('lets a Pro user past the cap', () => {
    useUserStore.setState({ isPro: true, proExpiresAt: null });
    seed(FREE_SAVE_LIMIT);
    useWanderStore.setState((s) => ({ places: [...s.places, makePlace('new')] }));

    expect(useWanderStore.getState().savePlace('new')).toBe(true);
  });

  it('lets a trialling user past the cap', () => {
    useUserStore.setState({ trialStartedAt: new Date().toISOString() });
    seed(FREE_SAVE_LIMIT);
    useWanderStore.setState((s) => ({ places: [...s.places, makePlace('new')] }));

    expect(useWanderStore.getState().savePlace('new')).toBe(true);
  });

  /** Re-saving something already saved must never be blocked by the cap. */
  it('is idempotent for an already-saved place', () => {
    seed(FREE_SAVE_LIMIT);
    expect(useWanderStore.getState().savePlace('p0')).toBe(true);
  });

  it('honours the cap again once a lapsed subscription expires', () => {
    useUserStore.setState({ isPro: true, proExpiresAt: '2020-01-01T00:00:00Z' });
    seed(FREE_SAVE_LIMIT);
    useWanderStore.setState((s) => ({ places: [...s.places, makePlace('new')] }));

    expect(useWanderStore.getState().savePlace('new')).toBe(false);
  });
});

/**
 * v1 ships with the paywall switched off. Nothing should be capped, and the
 * cap must be lifted centrally — not by every screen remembering to check.
 */
describe('savePlace during a free launch', () => {
  beforeEach(() => { mockFreeLaunch = true; });
  afterEach(()  => { mockFreeLaunch = false; });

  it('ignores the cap for a user with no entitlement at all', () => {
    useWanderStore.setState({
      places: Array.from({ length: FREE_SAVE_LIMIT }, (_, i) =>
        makePlace(`p${i}`, { isSaved: true })),
    });
    useWanderStore.setState((s) => ({ places: [...s.places, makePlace('new')] }));

    expect(useWanderStore.getState().savePlace('new')).toBe(true);
    expect(useWanderStore.getState().places.find((p) => p.placeId === 'new')?.isSaved)
      .toBe(true);
  });

  it('keeps saving well past the paid limit', () => {
    useWanderStore.setState({
      places: Array.from({ length: FREE_SAVE_LIMIT * 3 }, (_, i) =>
        makePlace(`p${i}`, { isSaved: true })),
    });
    useWanderStore.setState((s) => ({ places: [...s.places, makePlace('extra')] }));

    expect(useWanderStore.getState().savePlace('extra')).toBe(true);
  });
});

// ─── Trial anchoring ──────────────────────────────────────────

describe('startTrial', () => {
  it('starts a trial for a brand-new device', () => {
    useUserStore.getState().startTrial();

    const s = useUserStore.getState();
    expect(s.trialStartedAt).not.toBeNull();
    expect(s.deviceTrialStartedAt).toBe(s.trialStartedAt);
  });

  it('does not restart an in-flight trial', () => {
    useUserStore.getState().startTrial();
    const first = useUserStore.getState().trialStartedAt;

    useUserStore.getState().startTrial();
    expect(useUserStore.getState().trialStartedAt).toBe(first);
  });

  /**
   * The trial-farming regression guard: signing out cleared the account-level
   * trial, so a fresh email handed out another 7 days while every byte of
   * local data survived. The device anchor closes that.
   */
  it('refuses a second trial after sign-out and a new account', () => {
    useUserStore.getState().startTrial();
    const original = useUserStore.getState().deviceTrialStartedAt;

    useUserStore.getState().resetProStatus();
    expect(useUserStore.getState().trialStartedAt).toBeNull();
    expect(useUserStore.getState().deviceTrialStartedAt).toBe(original);

    useUserStore.getState().startTrial();
    expect(useUserStore.getState().trialStartedAt).toBe(original);
  });

  it('does not start a trial for an existing Pro subscriber', () => {
    useUserStore.setState({ isPro: true });
    useUserStore.getState().startTrial();
    expect(useUserStore.getState().trialStartedAt).toBeNull();
  });
});

describe('setEntitlement', () => {
  it('applies a verified upgrade', () => {
    useUserStore.getState().setEntitlement({
        isPro: true, expiresAt: '2026-12-01T00:00:00Z', productId: 'gati_pro_monthly',
    });
    expect(useUserStore.getState().isPro).toBe(true);
  });

  /**
   * The old `importProStatus` merged with "never downgrade", so a lapsed
   * subscription could never lose Pro. Downgrades must apply.
   */
  it('applies a downgrade', () => {
    useUserStore.setState({ isPro: true, proExpiresAt: '2026-12-01T00:00:00Z' });
    useUserStore.getState().setEntitlement({ isPro: false, expiresAt: null, productId: null });
    expect(useUserStore.getState().isPro).toBe(false);
  });
});

describe('resetProStatus', () => {
  it('clears account entitlement but preserves the device trial anchor', () => {
    useUserStore.setState({
      isPro: true,
      proExpiresAt: '2026-12-01T00:00:00Z',
      trialStartedAt: '2026-01-01T00:00:00Z',
      deviceTrialStartedAt: '2026-01-01T00:00:00Z',
    });

    useUserStore.getState().resetProStatus();

    const s = useUserStore.getState();
    expect(s.isPro).toBe(false);
    expect(s.proExpiresAt).toBeNull();
    expect(s.trialStartedAt).toBeNull();
    expect(s.deviceTrialStartedAt).toBe('2026-01-01T00:00:00Z');
  });
});

describe('importCategoryScores', () => {
  it('clamps corrupted values into the safe range', () => {
    useWanderStore.getState().importCategoryScores({ cafe: 9999, food: -50 });
    const s = useWanderStore.getState().categoryScores;
    expect(s.cafe).toBeLessThanOrEqual(5);
    expect(s.food).toBeGreaterThanOrEqual(0.5);
  });

  it('ignores unknown categories and non-numbers', () => {
    useWanderStore.getState().importCategoryScores({
        notACategory: 3,
        cafe: Number.NaN as unknown as number,
      } as Record<string, number>);
    const s = useWanderStore.getState().categoryScores;
    expect(s).not.toHaveProperty('notACategory');
    expect(Number.isFinite(s.cafe)).toBe(true);
  });
});

describe('addPlaces', () => {
  it('deduplicates by place id', () => {
    useWanderStore.getState().addPlaces([makePlace('a'), makePlace('b'), makePlace('a')]);
    expect(useWanderStore.getState().places).toHaveLength(2);
  });

  it('does not change state identity when everything is already known', () => {
    useWanderStore.getState().addPlaces([makePlace('a')]);
    const before = useWanderStore.getState().places;
    useWanderStore.getState().addPlaces([makePlace('a')]);
    expect(useWanderStore.getState().places).toBe(before);
  });
});

describe('mergeRealPlaces', () => {
  it('preserves user flags and the original discovery date', () => {
    useWanderStore.setState({
      places: [makePlace('gp_1', {
        isSaved: true, isVisited: true, userRating: 'loved',
        visitedDate: '2026-01-01', discoveredDate: '2025-12-01',
      })],
    });

    useWanderStore.getState().mergeRealPlaces([
        makePlace('gp_1', { discoveredDate: '2026-06-15', rating: 4.9 }),
      ]);

    const p = useWanderStore.getState().places[0];
    expect(p.isSaved).toBe(true);
    expect(p.userRating).toBe('loved');
    expect(p.rating).toBe(4.9);              // fresh data applied
    expect(p.discoveredDate).toBe('2025-12-01'); // original date kept
  });

  it('prunes stale unflagged Google places but keeps acted-on ones', () => {
    useWanderStore.setState({
      places: [
        makePlace('gp_old', { isSaved: false }),
        makePlace('gp_saved', { isSaved: true }),
      ],
    });

    useWanderStore.getState().mergeRealPlaces([makePlace('gp_new')]);

    const ids = useWanderStore.getState().places.map((p) => p.placeId);
    expect(ids).toContain('gp_new');
    expect(ids).toContain('gp_saved');
    expect(ids).not.toContain('gp_old');
  });
});
