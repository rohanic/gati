/**
 * Persist migrations.
 *
 * Zustand discards persisted state when the stored version differs from the
 * configured one and no `migrate` is supplied — it logs
 * "State loaded from storage couldn't be migrated since no migrate function
 * was provided" and silently falls back to defaults.
 *
 * For `gati-wander` that means losing every saved place, visit, rating and
 * learned taste score on upgrade. These tests assert that each persisted store
 * declares a migrator and that migrating a v0 payload preserves user data.
 */
import { useUserStore, useStatsStore, useWanderStore } from '@/store/userStore';
import { useStoryStore } from '@/store/storyStore';

type Migratable = {
  persist: {
    getOptions: () => {
      version?: number;
      migrate?: (persisted: unknown, version: number) => unknown;
      name?: string;
    };
  };
};

const STORES: [string, Migratable][] = [
  ['gati-user',   useUserStore   as unknown as Migratable],
  ['gati-stats',  useStatsStore  as unknown as Migratable],
  ['gati-wander', useWanderStore as unknown as Migratable],
  ['gati-story',  useStoryStore  as unknown as Migratable],
];

describe('every persisted store can migrate old data', () => {
  /**
   * The regression guard for this exact bug: a version above 0 without a
   * migrator silently wipes returning users.
   */
  it.each(STORES)('%s declares a migrator whenever it is versioned', (_name, store) => {
    const { version, migrate } = store.persist.getOptions();
    if ((version ?? 0) > 0) {
      expect(typeof migrate).toBe('function');
    }
  });

  it.each(STORES)('%s migrates an empty v0 payload without throwing', (_name, store) => {
    const { migrate, version } = store.persist.getOptions();
    if (!migrate) return;
    expect(() => migrate({}, 0)).not.toThrow();
    expect(() => migrate(undefined, 0)).not.toThrow();
    expect(() => migrate({}, (version ?? 1) - 1)).not.toThrow();
  });
});

describe('gati-wander v0 → v1', () => {
  const migrate = (useWanderStore as unknown as Migratable).persist.getOptions().migrate!;

  const v0 = {
    places: [
      {
        placeId: 'gp_kept', name: 'Saved Cafe', address: '', latitude: 0, longitude: 0,
        rating: 4.6, reviewCount: 200, redditMentions: 40, aiSummary: '',
        category: 'cafe', tags: [], thumbnailUrl: null,
        discoveredDate: '2026-01-01', visitedDate: '2026-02-01', distanceKm: 1.2,
        openNow: null, isSaved: true, isVisited: true, userRating: 'loved',
        gatiScore: null,
      },
    ],
    categoryScores: { cafe: 2.4, nature: 0.8 },
    interestsInitialized: true,
  };

  it('preserves saved places and their flags', () => {
    const out = migrate(v0, 0) as typeof v0;
    expect(out.places).toHaveLength(1);
    expect(out.places[0].placeId).toBe('gp_kept');
    expect(out.places[0].isSaved).toBe(true);
    expect(out.places[0].userRating).toBe('loved');
    expect(out.places[0].discoveredDate).toBe('2026-01-01');
  });

  it('preserves learned taste scores', () => {
    const out = migrate(v0, 0) as typeof v0;
    expect(out.categoryScores.cafe).toBe(2.4);
    expect(out.categoryScores.nature).toBe(0.8);
  });

  it('backfills categories a v0 payload never stored', () => {
    const out = migrate(v0, 0) as { categoryScores: Record<string, number> };
    // Every known category must exist so the ranking engine never reads undefined.
    for (const cat of ['food', 'cafe', 'history', 'nature', 'art', 'market', 'nightlife', 'books']) {
      expect(typeof out.categoryScores[cat]).toBe('number');
    }
  });

  it('keeps the interests-initialised guard', () => {
    expect((migrate(v0, 0) as typeof v0).interestsInitialized).toBe(true);
  });

  it('repairs a payload with a corrupted places field', () => {
    const out = migrate({ ...v0, places: null }, 0) as { places: unknown[] };
    expect(Array.isArray(out.places)).toBe(true);
    expect(out.places).toHaveLength(0);
  });
});

describe('gati-user v0 → v2', () => {
  const migrate = (useUserStore as unknown as Migratable).persist.getOptions().migrate!;

  it('anchors the device trial to the existing account trial', () => {
    const out = migrate(
      { trialStartedAt: '2026-01-01T00:00:00Z', isPro: false },
      0,
    ) as { deviceTrialStartedAt: string | null; trialStartedAt: string | null };

    // Without this an upgrading mid-trial user could sign out and mint a
    // brand-new 7 days.
    expect(out.deviceTrialStartedAt).toBe('2026-01-01T00:00:00Z');
    expect(out.trialStartedAt).toBe('2026-01-01T00:00:00Z');
  });

  it('adds the new entitlement fields as null', () => {
    const out = migrate({ isPro: true }, 0) as {
      proExpiresAt: string | null; proProductId: string | null;
    };
    expect(out.proExpiresAt).toBeNull();
    expect(out.proProductId).toBeNull();
  });

  it('preserves the profile', () => {
    const profile = { firstName: 'Rohan', dateOfBirth: '1996-01-01' };
    const out = migrate({ profile, onboardingComplete: true }, 0) as {
      profile: typeof profile; onboardingComplete: boolean;
    };
    expect(out.profile).toEqual(profile);
    expect(out.onboardingComplete).toBe(true);
  });
});

describe('gati-stats v0 → v2', () => {
  const migrate = (useStatsStore as unknown as Migratable).persist.getOptions().migrate!;

  it('preserves streak history and the unlock ledger', () => {
    const v0 = {
      unlockedStats:     [{ statId: 'heartbeats', unlockedDate: '2026-01-01', hasBeenShared: false }],
      openHistoryRanges: [{ s: '2026-01-01', e: '2026-01-30' }],
      maxStreakEver:     30,
    };
    const out = migrate(v0, 0) as typeof v0;
    expect(out.openHistoryRanges).toEqual(v0.openHistoryRanges);
    expect(out.maxStreakEver).toBe(30);
    expect(out.unlockedStats).toHaveLength(1);
  });

  it('adds savedStatIds when absent', () => {
    const out = migrate({}, 0) as { savedStatIds: string[] };
    expect(out.savedStatIds).toEqual([]);
  });
});

/**
 * The two migrations added alongside the first-run sign-in gate and the
 * Wander radius control. Both change what an EXISTING install sees on the
 * very next launch, which is the worst place for a mistake.
 */
describe('gati-user v2 → v3 (authPromptSeen)', () => {
  const migrate = (useUserStore as unknown as Migratable).persist.getOptions().migrate!;

  it('never sends an existing user to the sign-in screen', () => {
    // The gate routes to /auth when authPromptSeen is false. Someone who has
    // been using Gati for months has already made their choice about an
    // account; an update must not reopen it.
    const out = migrate({ onboardingComplete: true }, 2) as { authPromptSeen: boolean };
    expect(out.authPromptSeen).toBe(true);
  });

  it('still runs the v2 entitlement work when coming from v0', () => {
    const out = migrate({ trialStartedAt: '2026-01-01T00:00:00Z' }, 0) as {
      deviceTrialStartedAt: string | null;
      authPromptSeen: boolean;
    };
    // Chained, not either/or — a v0 payload has to pass through BOTH steps.
    expect(out.deviceTrialStartedAt).toBe('2026-01-01T00:00:00Z');
    expect(out.authPromptSeen).toBe(true);
  });

  it('preserves the profile across the new step', () => {
    const profile = { firstName: 'Rohan', birthDate: '1995-03-02' };
    const out = migrate({ profile, onboardingComplete: true }, 2) as { profile: unknown };
    expect(out.profile).toEqual(profile);
  });
});

describe('gati-wander → v3 (radius 0.5–10 km, 2 km default)', () => {
  const migrate = (useWanderStore as unknown as Migratable).persist.getOptions().migrate!;
  const radius = (p: unknown, from: number) => (migrate(p, from) as { searchRadiusKm: number }).searchRadiusKm;

  it('gives an upgrading user the new default, never NaN', () => {
    // Undefined would reach the search as NaN metres.
    expect(radius({ places: [], categoryScores: {} }, 1)).toBe(2);
  });

  it('moves the old 10 km default to the new one', () => {
    // 10 km was the default almost nobody chose, and is the "area is too big"
    // this change exists to fix.
    expect(radius({ places: [], searchRadiusKm: 10 }, 2)).toBe(2);
  });

  it('keeps a radius the user chose that is still offered', () => {
    expect(radius({ places: [], searchRadiusKm: 5 }, 2)).toBe(5);
    expect(radius({ places: [], searchRadiusKm: 2 }, 2)).toBe(2);
  });

  it('snaps radii that are no longer offered to the nearest one', () => {
    expect(radius({ places: [], searchRadiusKm: 25 }, 2)).toBe(10);
    expect(radius({ places: [], searchRadiusKm: 50 }, 2)).toBe(10);
  });

  it('drops invented demo places, keeping real ones', () => {
    const out = migrate({ searchRadiusKm: 2, places: [
      { placeId: 'wp_001', isSample: true },
      { placeId: 'gp_real' },
    ] }, 2) as { places: { placeId: string }[] };
    expect(out.places.map((p) => p.placeId)).toEqual(['gp_real']);
  });

  it('chains through v0 so an old install gets places AND a radius', () => {
    const out = migrate({ categoryScores: { cafe: 2.0 } }, 0) as {
      places: unknown[]; searchRadiusKm: number; categoryScores: Record<string, number>;
    };
    expect(Array.isArray(out.places)).toBe(true);
    expect(out.searchRadiusKm).toBe(2);
    expect(out.categoryScores.cafe).toBe(2.0);
  });
});
