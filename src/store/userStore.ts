import { useMemo } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  format, differenceInDays, differenceInCalendarDays,
  parseISO, isValid, subDays,
} from 'date-fns';
import type { UserProfile, StatUnlock, WanderPlace, InterestCategory } from '@/types';
import { useClockStore } from './clockStore';
import { availableKeys } from '@/engine/unlockEngine';
import { IS_FREE_LAUNCH } from '@/config';

// Places older than this with no user action are pruned from the store.
const WANDER_STALE_DAYS = 30;

/** Free-tier cap on saved places. Enforced centrally in `savePlace`. */
export const FREE_SAVE_LIMIT = 10;

/** Length of the Pro trial, in calendar days. */
export const TRIAL_DAYS = 7;

// ─── DateRange — compact streak storage ──────────────────────
/**
 * A closed interval of consecutive calendar days (ISO yyyy-MM-dd).
 *
 * Storing ranges instead of individual dates means a 3-year streak is one
 * object rather than 1,095 strings, so no history ever has to be pruned.
 */
export interface DateRange {
  s: string; // start date, inclusive
  e: string; // end date,   inclusive
}

/**
 * Convert a flat array of ISO date strings → minimal contiguous ranges.
 * Input need not be sorted or deduplicated. O(n log n).
 */
export function toRanges(dates: string[]): DateRange[] {
  if (dates.length === 0) return [];
  const sorted = [...new Set(dates)].sort();
  const out: DateRange[] = [{ s: sorted[0], e: sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const last = out[out.length - 1];
    const gap  = differenceInDays(parseISO(sorted[i]), parseISO(last.e));
    if (gap === 1)    { last.e = sorted[i]; }                        // extend
    else if (gap > 1) { out.push({ s: sorted[i], e: sorted[i] }); }  // new range
    // gap === 0 → duplicate → skip
  }
  return out;
}

/**
 * Insert a single date into a ranges array, merging any ranges it bridges.
 * Returns a new array; the input is never mutated. O(n) in range count.
 */
export function insertDateIntoRanges(ranges: DateRange[], date: string): DateRange[] {
  if (ranges.length === 0) return [{ s: date, e: date }];

  // Already covered — nothing to do.
  for (const r of ranges) {
    if (date >= r.s && date <= r.e) return ranges;
  }

  const next = [...ranges, { s: date, e: date }].sort((a, b) =>
    a.s < b.s ? -1 : a.s > b.s ? 1 : 0,
  );

  const merged: DateRange[] = [];
  for (const r of next) {
    if (merged.length === 0) { merged.push({ s: r.s, e: r.e }); continue; }
    const last = merged[merged.length - 1];
    const gap  = differenceInDays(parseISO(r.s), parseISO(last.e));
    if (gap <= 1) {
      if (r.e > last.e) last.e = r.e; // absorb / merge
    } else {
      merged.push({ s: r.s, e: r.e });
    }
  }
  return merged;
}

/** Length in days of the range ending on `date`, or 0 if none does. */
export function streakEndingOn(ranges: DateRange[], date: string): number {
  if (ranges.length === 0) return 0;
  const last = ranges[ranges.length - 1];
  if (last.e !== date) return 0;
  return differenceInDays(parseISO(last.e), parseISO(last.s)) + 1;
}

// ─── Pro / Trial ──────────────────────────────────────────────

export type ProStatus = 'free' | 'trial' | 'pro';

/** Everything needed to decide the current tier. */
export interface EntitlementSnapshot {
  trialStartedAt: string | null;
  isPro:          boolean;
  /** ISO expiry of the verified receipt, when the store reported one. */
  proExpiresAt:   string | null;
}

/**
 * Derive the current tier. Pure — no store reads, fully testable.
 *
 * A paid entitlement is honoured only until `proExpiresAt`. That matters:
 * `verify-purchase` is the only writer of `is_pro`, but the device can be
 * offline for a long time, and an expired receipt must stop granting Pro
 * without needing a successful network round-trip first.
 */
export function computeProStatus(
  trialStartedAt: string | null,
  isPro:          boolean,
  proExpiresAt:   string | null = null,
  now:            Date = new Date(),
): ProStatus {
  if (isPro) {
    if (!proExpiresAt) return 'pro';            // no expiry reported → treat as active
    const expiry = parseISO(proExpiresAt);
    if (!isValid(expiry) || expiry.getTime() > now.getTime()) return 'pro';
    // Receipt has lapsed — fall through to the trial/free check below.
  }

  if (!trialStartedAt) return 'free';
  const start = parseISO(trialStartedAt);
  if (!isValid(start)) return 'free';

  // Calendar days (not 24h chunks) so the boundary lands on midnight, the
  // same rollover used for daily stat unlocks.
  const days = differenceInCalendarDays(now, start);

  // Clock-tamper guard: a start meaningfully in the FUTURE means the device
  // clock was rolled back to keep the trial alive. The −1 tolerance avoids
  // false positives from timezone / date-line crossings. This is a deterrent
  // only — real enforcement is server-side.
  if (days < -1) return 'free';

  return days < TRIAL_DAYS ? 'trial' : 'free';
}

/** Days remaining in the trial (0 when not in one). Clamped to [0, TRIAL_DAYS]. */
export function trialDaysLeft(trialStartedAt: string | null, now: Date = new Date()): number {
  if (!trialStartedAt) return 0;
  const start = parseISO(trialStartedAt);
  if (!isValid(start)) return 0;
  const days = differenceInCalendarDays(now, start);
  return Math.min(TRIAL_DAYS, Math.max(0, TRIAL_DAYS - days));
}

/**
 * Earliest of two ISO timestamps, ignoring nulls.
 * Used when merging local vs cloud trial starts so the anchor never drifts
 * forward (which would silently extend the trial).
 */
export function earliestDate(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a <= b ? a : b;
}

// ─── User Store ───────────────────────────────────────────────

export interface EntitlementUpdate {
  isPro:      boolean;
  expiresAt:  string | null;
  productId:  string | null;
}

interface UserState {
  /** True once AsyncStorage has been read. Never persisted — see `partialize`. */
  _hasHydrated:       boolean;
  profile:            UserProfile | null;
  onboardingComplete: boolean;
  /** Supabase user ID — null when signed out. */
  userId:             string | null;

  // ── Pro / Trial ────────────────────────────────────────────
  /** ISO timestamp the trial started for the CURRENT account. */
  trialStartedAt:     string | null;
  /**
   * Device-level trial anchor. Deliberately NOT cleared on sign-out.
   *
   * Without this, signing out and registering a fresh email handed out an
   * unlimited supply of 7-day trials while keeping all local data. The
   * effective trial start is the earlier of this and `trialStartedAt`.
   */
  deviceTrialStartedAt: string | null;
  /** True when a server-verified paid subscription is active. */
  isPro:              boolean;
  /** ISO expiry of the verified receipt, when the store reported one. */
  proExpiresAt:       string | null;
  /** Product the active entitlement came from. */
  proProductId:       string | null;

  setProfile:        (profile: UserProfile) => void;
  updateProfile:     (partial: Partial<UserProfile>) => void;
  setOnboardingDone: () => void;
  setUserId:         (id: string | null) => void;
  /** Start the trial. No-op once a device anchor exists, or if already Pro. */
  startTrial:        () => void;
  /**
   * Apply a server-verified entitlement. The ONLY way `isPro` becomes true.
   * Accepts downgrades — this is how a lapsed subscription loses Pro.
   */
  setEntitlement:    (e: EntitlementUpdate) => void;
  /**
   * Merge entitlement pulled from the cloud on sign-in.
   *
   * The cloud row is authoritative for `isPro`/`proExpiresAt` because only the
   * `verify-purchase` edge function can write them. The trial anchor takes the
   * earliest non-null of the two so it can never move forward.
   */
  importEntitlement: (
    trialStartedAt: string | null,
    isPro:          boolean,
    proExpiresAt:   string | null,
    proProductId:   string | null,
  ) => void;
  /**
   * Clear ACCOUNT-bound entitlement on sign-out so a paid account never leaks
   * to the next account on this device. `deviceTrialStartedAt` deliberately
   * survives (see above).
   */
  resetProStatus:    () => void;
  reset:             () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      _hasHydrated:         false,
      profile:              null,
      onboardingComplete:   false,
      userId:               null,
      trialStartedAt:       null,
      deviceTrialStartedAt: null,
      isPro:                false,
      proExpiresAt:         null,
      proProductId:         null,

      setProfile: (profile) => set({ profile }),

      updateProfile: (partial) =>
        set((state) => ({
          profile: state.profile ? { ...state.profile, ...partial } : null,
        })),

      setOnboardingDone: () => set({ onboardingComplete: true }),

      setUserId: (id) => set({ userId: id }),

      startTrial: () => {
        const { trialStartedAt, deviceTrialStartedAt, isPro } = get();
        if (isPro) return;
        // A device anchor means this device already had its trial, even if the
        // account-level value was cleared by a sign-out.
        if (deviceTrialStartedAt) {
          // Keep the account value in step so it syncs to the cloud.
          if (!trialStartedAt) set({ trialStartedAt: deviceTrialStartedAt });
          return;
        }
        const now = new Date().toISOString();
        set({ trialStartedAt: now, deviceTrialStartedAt: now });
      },

      setEntitlement: ({ isPro, expiresAt, productId }) =>
        set({ isPro, proExpiresAt: expiresAt, proProductId: productId }),

      importEntitlement: (trialStartedAt, isPro, proExpiresAt, proProductId) =>
        set((s) => {
          const mergedTrial = earliestDate(
            earliestDate(s.trialStartedAt, trialStartedAt),
            s.deviceTrialStartedAt,
          );
          return {
            isPro,
            proExpiresAt,
            proProductId,
            trialStartedAt:       mergedTrial,
            deviceTrialStartedAt: earliestDate(s.deviceTrialStartedAt, mergedTrial),
          };
        }),

      resetProStatus: () =>
        set({
          trialStartedAt: null,
          isPro:          false,
          proExpiresAt:   null,
          proProductId:   null,
          // deviceTrialStartedAt intentionally preserved.
        }),

      reset: () => set({
        profile:            null,
        onboardingComplete: false,
        userId:             null,
        trialStartedAt:     null,
        isPro:              false,
        proExpiresAt:       null,
        proProductId:       null,
        // deviceTrialStartedAt intentionally preserved.
      }),
    }),
    {
      name:    'gati-user',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ _hasHydrated, ...rest }) => rest,
      onRehydrateStorage: () => () => {
        useUserStore.setState({ _hasHydrated: true });
      },
      /**
       * v1 → v2: split the single `isPro` flag into a verified entitlement
       * (`isPro` + `proExpiresAt` + `proProductId`) and added the device-level
       * trial anchor. A v1 device that believed it was Pro keeps that belief
       * until the first `syncEntitlement()` re-verifies it against the store.
       */
      migrate: (persisted, fromVersion) => {
        const s = (persisted ?? {}) as Partial<UserState>;
        if (fromVersion < 2) {
          return {
            ...s,
            proExpiresAt:         s.proExpiresAt ?? null,
            proProductId:         s.proProductId ?? null,
            deviceTrialStartedAt: s.deviceTrialStartedAt ?? s.trialStartedAt ?? null,
          } as UserState;
        }
        return s as UserState;
      },
    },
  ),
);

/** Effective trial anchor: the earlier of the account and device values. */
export function useTrialStartedAt(): string | null {
  const account = useUserStore((s) => s.trialStartedAt);
  const device  = useUserStore((s) => s.deviceTrialStartedAt);
  return useMemo(() => earliestDate(account, device), [account, device]);
}

/**
 * Reactive Pro status. Reads the entitlement AND subscribes to the clock tick,
 * so the tier recomputes when real time crosses the trial boundary or the
 * receipt expiry — even while the screen stays mounted.
 *
 * Prefer this over calling `computeProStatus` inline in components.
 */
export function useProStatus(): ProStatus {
  const trialStartedAt = useTrialStartedAt();
  const isPro          = useUserStore((s) => s.isPro);
  const proExpiresAt   = useUserStore((s) => s.proExpiresAt);
  const tick           = useClockStore((s) => s.tick);

  return useMemo(
    () => computeProStatus(trialStartedAt, isPro, proExpiresAt),
    // `tick` is deliberately a dependency: it is the signal that wall-clock
    // time moved, which is exactly what computeProStatus reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trialStartedAt, isPro, proExpiresAt, tick],
  );
}

/** Days left in the trial, recomputed on each clock tick. */
export function useTrialDaysLeft(): number {
  const trialStartedAt = useTrialStartedAt();
  const tick           = useClockStore((s) => s.tick);
  return useMemo(
    () => trialDaysLeft(trialStartedAt),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trialStartedAt, tick],
  );
}

// ─── Stats Store ──────────────────────────────────────────────

interface StatsState {
  /** True once AsyncStorage has been read. Never persisted. */
  _hasHydrated:      boolean;
  unlockedStats:     StatUnlock[];
  /**
   * Rolling 400-day window of open dates, kept for components that want a
   * flat list. `openHistoryRanges` is the source of truth.
   */
  openHistory:       string[];
  /** Run-length-encoded open history — never truncated. */
  openHistoryRanges: DateRange[];
  maxStreakEver:     number;
  seenMilestoneIds:  string[];
  /** id → ISO date the milestone was earned (powers the Story timeline). */
  milestoneSeenDates: Record<string, string>;
  /** statIds the user bookmarked from the Today card. */
  savedStatIds:      string[];
  /**
   * Streak freezes available. Earned automatically (+1 per 7-day milestone,
   * capped at 3) and auto-consumed to bridge a single missed day.
   */
  streakFreezeCount: number;
  /** Dates bridged by an auto-used freeze (subset of the ranges, for display). */
  frozenDates:       string[];

  /**
   * Record that a stat has been revealed to the user.
   *
   * Idempotent per statId. This is what drives "N of 25 opened", the Story
   * timeline and the stat-count milestones.
   */
  unlockStat:        (statId: string, unlockedDate?: string) => void;
  /** Bulk version — one store write for several stats. */
  unlockStats:       (statIds: string[], unlockedDate?: string) => void;
  /**
   * Spend a key to open a number, at the user's choosing.
   *
   * Returns false when there is no key available or the number is already
   * open. The key balance is derived from the ledger rather than stored, so
   * the check happens HERE, at the single write point — a caller cannot open
   * a number by skipping a UI guard.
   */
  redeemKey:         (statId: string, joinDate: string | null) => boolean;
  markStatShared:    (statId: string) => void;
  recordOpen:        () => void;
  toggleSavedStat:   (statId: string) => void;
  markMilestoneSeen: (id: string) => void;
  /**
   * Mark milestones seen WITHOUT a celebration or story entry. Used at
   * onboarding for milestones already met before install.
   */
  seedMilestonesSeen: (ids: string[]) => void;
  /** Merge stats data pulled from a cloud backup. Never loses local history. */
  importStatsData: (data: {
    unlockedStats:      StatUnlock[];
    openHistoryRanges:  DateRange[];
    maxStreakEver:      number;
    streakFreezeCount:  number;
    frozenDates:        string[];
    milestoneSeenDates: Record<string, string>;
    seenMilestoneIds:   string[];
    savedStatIds:       string[];
  }) => void;
}

export const useStatsStore = create<StatsState>()(
  persist(
    (set, get) => ({
      _hasHydrated:       false,
      unlockedStats:      [],
      openHistory:        [],
      openHistoryRanges:  [],
      maxStreakEver:      0,
      seenMilestoneIds:   [],
      milestoneSeenDates: {},
      streakFreezeCount:  0,
      frozenDates:        [],
      savedStatIds:       [],

      unlockStat: (statId, unlockedDate) => get().unlockStats([statId], unlockedDate),

      redeemKey: (statId, joinDate) => {
        const { unlockedStats } = get();
        if (unlockedStats.some((u) => u.statId === statId)) return false;

        // Authoritative balance check. The UI also hides the action when there
        // is no key, but this is the gate that actually holds.
        const spentDates = unlockedStats.map((u) => u.unlockedDate);
        if (availableKeys(joinDate, spentDates) < 1) return false;

        // Stamped in UTC, matching how keys are granted — otherwise a user
        // west of UTC could open a number "yesterday" and be handed the next
        // key immediately.
        const today = new Date().toISOString().slice(0, 10);
        set({
          unlockedStats: [
            ...unlockedStats,
            { statId, unlockedDate: today, hasBeenShared: false },
          ],
        });
        return true;
      },

      unlockStats: (statIds, unlockedDate) =>
        set((s) => {
          const date  = unlockedDate ?? format(new Date(), 'yyyy-MM-dd');
          const known = new Set(s.unlockedStats.map((u) => u.statId));
          const fresh = statIds
            .filter((id) => !known.has(id))
            .map((statId) => ({ statId, unlockedDate: date, hasBeenShared: false }));
          if (fresh.length === 0) return s;         // idempotent: no re-render
          return { unlockedStats: [...s.unlockedStats, ...fresh] };
        }),

      markStatShared: (statId) =>
        set((s) => ({
          unlockedStats: s.unlockedStats.map((u) =>
            u.statId === statId ? { ...u, hasBeenShared: true } : u,
          ),
        })),

      recordOpen: () => {
        const today = format(new Date(), 'yyyy-MM-dd');
        const {
          openHistory, openHistoryRanges, maxStreakEver,
          streakFreezeCount, frozenDates,
        } = get();

        // One-time migration: flat history → ranges. After this,
        // openHistoryRanges is the sole source of truth.
        let ranges: DateRange[] = openHistoryRanges.length > 0
          ? openHistoryRanges
          : toRanges(openHistory);

        // Idempotent: bail out if today is already recorded.
        if (ranges.length > 0 && ranges[ranges.length - 1].e >= today) return;
        if (ranges.length === 0 && openHistory.includes(today)) return;

        let freezeCount   = streakFreezeCount;
        let frozen        = [...frozenDates];
        const streakBefore = ranges.length > 0
          ? differenceInDays(
              parseISO(ranges[ranges.length - 1].e),
              parseISO(ranges[ranges.length - 1].s),
            ) + 1
          : 0;

        // Freeze auto-use: today is exactly two days after the last recorded
        // date (one day missed) and a freeze is available → bridge the gap.
        if (ranges.length > 0 && freezeCount > 0) {
          const lastEnd = ranges[ranges.length - 1].e;
          const gap     = differenceInDays(parseISO(today), parseISO(lastEnd));
          if (gap === 2) {
            const missed = format(subDays(parseISO(today), 1), 'yyyy-MM-dd');
            ranges       = insertDateIntoRanges(ranges, missed);
            frozen       = [...frozen, missed];
            freezeCount -= 1;
          }
        }

        ranges = insertDateIntoRanges(ranges, today);

        // insertDateIntoRanges merges adjacent ranges, so the last range is
        // the unbroken run ending today.
        const streak = streakEndingOn(ranges, today);

        // Earn a freeze when the streak crosses a 7-day multiple. Compared
        // against the streak BEFORE this open (not streak-1) so a freeze that
        // bridged a gap and jumped the streak by 2 still awards correctly.
        const hitMilestone =
          streak > 0 &&
          Math.floor(streak / 7) > Math.floor(streakBefore / 7);

        // Backward-compat flat window. Frozen dates are included so the
        // weekly dots and the streak agree with each other.
        const addedDates  = frozen.filter((d) => !openHistory.includes(d));
        const legacyHistory = openHistory.includes(today)
          ? openHistory
          : [...openHistory, ...addedDates, today].slice(-400);

        set({
          openHistory:       legacyHistory,
          openHistoryRanges: ranges,
          maxStreakEver:     Math.max(maxStreakEver, streak),
          streakFreezeCount: Math.min(3, freezeCount + (hitMilestone ? 1 : 0)),
          frozenDates:       frozen,
        });
      },

      toggleSavedStat: (statId) =>
        set((s) => ({
          savedStatIds: s.savedStatIds.includes(statId)
            ? s.savedStatIds.filter((id) => id !== statId)
            : [...s.savedStatIds, statId],
        })),

      markMilestoneSeen: (id) =>
        set((s) => {
          if (s.seenMilestoneIds.includes(id)) return s;
          const today = format(new Date(), 'yyyy-MM-dd');
          return {
            seenMilestoneIds:   [...s.seenMilestoneIds, id],
            milestoneSeenDates: { ...s.milestoneSeenDates, [id]: today },
          };
        }),

      seedMilestonesSeen: (ids) =>
        set((s) => {
          const fresh = ids.filter((id) => !s.seenMilestoneIds.includes(id));
          if (fresh.length === 0) return s;
          // No milestoneSeenDates entry → excluded from the Story timeline.
          return { seenMilestoneIds: [...s.seenMilestoneIds, ...fresh] };
        }),

      importStatsData: (data) =>
        set((s) => {
          // Merge unlocked stats, keeping the EARLIER unlock date per statId.
          const byId = new Map<string, StatUnlock>();
          for (const u of [...data.unlockedStats, ...s.unlockedStats]) {
            const prev = byId.get(u.statId);
            if (!prev || u.unlockedDate < prev.unlockedDate) byId.set(u.statId, u);
          }
          const mergedUnlocks = [...byId.values()];

          // Merge milestone dates, keeping the earlier date per id.
          const mergedMilestoneDates: Record<string, string> = { ...data.milestoneSeenDates };
          for (const [id, date] of Object.entries(s.milestoneSeenDates)) {
            if (!mergedMilestoneDates[id] || date < mergedMilestoneDates[id]) {
              mergedMilestoneDates[id] = date;
            }
          }
          const mergedSeenIds  = [...new Set([...s.seenMilestoneIds, ...data.seenMilestoneIds])];
          const mergedSavedIds = [...new Set([...s.savedStatIds, ...data.savedStatIds])];

          // Fresh install → take cloud history wholesale.
          if (s.openHistoryRanges.length === 0) {
            return {
              unlockedStats:      mergedUnlocks,
              openHistoryRanges:  data.openHistoryRanges,
              maxStreakEver:      data.maxStreakEver,
              streakFreezeCount:  data.streakFreezeCount,
              frozenDates:        data.frozenDates,
              milestoneSeenDates: mergedMilestoneDates,
              seenMilestoneIds:   mergedSeenIds,
              savedStatIds:       mergedSavedIds,
            };
          }

          // Existing device → union the histories rather than picking a side,
          // so a user who used two devices keeps every day they showed up.
          const mergedRanges = mergeRanges(s.openHistoryRanges, data.openHistoryRanges);
          return {
            unlockedStats:      mergedUnlocks,
            openHistoryRanges:  mergedRanges,
            maxStreakEver:      Math.max(s.maxStreakEver, data.maxStreakEver),
            streakFreezeCount:  Math.max(s.streakFreezeCount, data.streakFreezeCount),
            frozenDates:        [...new Set([...s.frozenDates, ...data.frozenDates])],
            milestoneSeenDates: mergedMilestoneDates,
            seenMilestoneIds:   mergedSeenIds,
            savedStatIds:       mergedSavedIds,
          };
        }),
    }),
    {
      name:    'gati-stats',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ _hasHydrated, ...rest }) => rest,
      onRehydrateStorage: () => () => {
        useStatsStore.setState({ _hasHydrated: true });
      },
      /** v1 → v2: `savedStatIds` gained a cloud counterpart; nothing to rewrite. */
      migrate: (persisted, fromVersion) => {
        const s = (persisted ?? {}) as Partial<StatsState>;
        if (fromVersion < 2) {
          return { ...s, savedStatIds: s.savedStatIds ?? [] } as StatsState;
        }
        return s as StatsState;
      },
    },
  ),
);

/**
 * Union two range arrays into a minimal contiguous set.
 * Used when merging cloud and local open history from two devices.
 */
export function mergeRanges(a: DateRange[], b: DateRange[]): DateRange[] {
  const all = [...a, ...b].filter((r) => r?.s && r?.e).sort((x, y) => (x.s < y.s ? -1 : 1));
  if (all.length === 0) return [];
  const out: DateRange[] = [{ s: all[0].s, e: all[0].e }];
  for (let i = 1; i < all.length; i++) {
    const last = out[out.length - 1];
    const gap  = differenceInDays(parseISO(all[i].s), parseISO(last.e));
    if (gap <= 1) {
      if (all[i].e > last.e) last.e = all[i].e;
    } else {
      out.push({ s: all[i].s, e: all[i].e });
    }
  }
  return out;
}

// ─── Wander Store ─────────────────────────────────────────────

interface WanderState {
  /** True once AsyncStorage has been read. Never persisted. */
  _hasHydrated:         boolean;
  places:               WanderPlace[];
  categoryScores:       Record<string, number>;
  interestsInitialized: boolean;
  /**
   * How far Wander is allowed to look, in kilometres.
   *
   * Google ranks by popularity WITHIN whatever radius it is given, so a wide
   * search returns the most famous places in the whole disc rather than the
   * good ones nearby. This is the user's own ceiling on that, and it is
   * enforced twice: sent to the search, and applied again to the results.
   */
  searchRadiusKm:       number;

  addPlace:        (place: WanderPlace) => void;
  /** Bulk insert — one store write instead of one per place. */
  addPlaces:       (places: WanderPlace[]) => void;
  mergeRealPlaces: (fetched: WanderPlace[]) => void;
  /**
   * Save a place, enforcing the free-tier cap centrally.
   * Returns false when the save was blocked; callers route to /pro.
   */
  savePlace:       (placeId: string) => boolean;
  unsavePlace:     (placeId: string) => void;
  markVisited:     (placeId: string) => void;
  removeVisit:     (placeId: string) => void;
  ratePlace:       (placeId: string, rating: WanderPlace['userRating']) => void;
  updateScore:     (category: string, rating: string) => void;
  /** One-time bootstrap from onboarding interest selection. */
  initFromInterests: (interests: InterestCategory[]) => void;
  /** Re-derive scores when interests change in Profile (bypasses the guard). */
  resetInterestScores: (interests: InterestCategory[]) => void;
  /** Restore learned taste scores from a backup, clamped to a safe range. */
  importCategoryScores: (scores: Record<string, number>) => void;
  setSearchRadiusKm:    (km: number) => void;
}

/** Offered radii, in kilometres. 10 is the default — near enough to walk or
 *  ride to, wide enough that a quiet neighbourhood still returns results. */
export const RADIUS_OPTIONS_KM = [2, 5, 10, 25, 50] as const;
export const DEFAULT_RADIUS_KM = 10;

const DEFAULT_SCORES: Record<string, number> = {
  food: 1.0, cafe: 1.0, history: 1.0, nature: 1.0,
  art:  1.0, market: 1.0, nightlife: 1.0, books: 1.0,
};

export const useWanderStore = create<WanderState>()(
  persist(
    (set, get) => ({
      _hasHydrated:         false,
      places:               [],
      categoryScores:       DEFAULT_SCORES,
      interestsInitialized: false,
      searchRadiusKm:       DEFAULT_RADIUS_KM,

      addPlace: (place) => get().addPlaces([place]),

      addPlaces: (incoming) =>
        set((s) => {
          // `known` is mutated as we go so duplicates WITHIN the incoming
          // batch are collapsed too, not just ones already in the store.
          const known = new Set(s.places.map((p) => p.placeId));
          const fresh: WanderPlace[] = [];
          for (const p of incoming) {
            if (!p?.placeId || known.has(p.placeId)) continue;
            known.add(p.placeId);
            fresh.push(p);
          }
          if (fresh.length === 0) return s;
          return { places: [...s.places, ...fresh] };
        }),

      mergeRealPlaces: (fetched) =>
        set((s) => {
          const prevById = new Map(s.places.map((p) => [p.placeId, p]));

          // Fresh data from Google Places, user flags carried over.
          // discoveredDate is preserved from the previous record: the fetch
          // date is always "today" and would otherwise drag saved places to
          // the current month in the Story timeline on every refresh.
          const merged: WanderPlace[] = fetched.map((f) => {
            const prev = prevById.get(f.placeId);
            return prev
              ? {
                  ...f,
                  isSaved:        prev.isSaved,
                  isVisited:      prev.isVisited,
                  userRating:     prev.userRating,
                  visitedDate:    prev.visitedDate,
                  discoveredDate: prev.discoveredDate ?? f.discoveredDate,
                }
              : f;
          });

          // Keep previous places only if the user acted on them; prune the
          // rest so AsyncStorage does not grow without bound.
          const fetchedIds = new Set(fetched.map((f) => f.placeId));
          const today = new Date();
          const keepers = s.places.filter((p) => {
            if (fetchedIds.has(p.placeId)) return false;   // already merged
            if (p.isSaved || p.isVisited || p.userRating !== null) return true;
            // Google places not re-fetched are stale — today's fetch already
            // has the best quality-filtered candidates.
            if (p.placeId.startsWith('gp_')) return false;
            if (!p.discoveredDate) return false;
            const discovered = parseISO(p.discoveredDate);
            return isValid(discovered) && differenceInDays(today, discovered) < WANDER_STALE_DAYS;
          });

          return { places: [...merged, ...keepers] };
        }),

      savePlace: (placeId) => {
        const s = get();
        const target = s.places.find((p) => p.placeId === placeId);

        // Idempotent: already saved → always allowed, no cap check.
        if (target?.isSaved) return true;

        const { trialStartedAt, deviceTrialStartedAt, isPro, proExpiresAt } = useUserStore.getState();
        const tier = computeProStatus(
          earliestDate(trialStartedAt, deviceTrialStartedAt),
          isPro,
          proExpiresAt,
        );
        // IS_FREE_LAUNCH lifts the cap for everyone. Checked here rather than
        // at the call sites so no screen can accidentally bypass or re-impose it.
        if (!IS_FREE_LAUNCH && tier === 'free') {
          const savedCount = s.places.filter((p) => p.isSaved).length;
          if (savedCount >= FREE_SAVE_LIMIT) return false;
        }

        set((st) => ({
          places: st.places.map((p) =>
            p.placeId === placeId ? { ...p, isSaved: true } : p,
          ),
        }));
        return true;
      },

      unsavePlace: (placeId) =>
        set((s) => ({
          places: s.places.map((p) =>
            p.placeId === placeId ? { ...p, isSaved: false } : p,
          ),
        })),

      markVisited: (placeId) => {
        const today = format(new Date(), 'yyyy-MM-dd');
        set((s) => ({
          places: s.places.map((p) =>
            p.placeId === placeId ? { ...p, isVisited: true, visitedDate: today } : p,
          ),
        }));
      },

      removeVisit: (placeId) =>
        set((s) => ({
          places: s.places.map((p) =>
            p.placeId === placeId
              ? { ...p, isVisited: false, visitedDate: null, userRating: null }
              : p,
          ),
        })),

      ratePlace: (placeId, rating) =>
        set((s) => ({
          places: s.places.map((p) =>
            p.placeId === placeId ? { ...p, userRating: rating } : p,
          ),
        })),

      // Taste learning: weighted scoring from ratings.
      updateScore: (category, rating) =>
        set((s) => {
          const current = s.categoryScores[category] ?? 1.0;
          const multiplier =
            rating === 'loved'      ? 1.3 :
            rating === 'good'       ? 1.1 :
            rating === 'not_for_me' ? 0.6 : 1.0;
          return {
            categoryScores: {
              ...s.categoryScores,
              [category]: Math.min(3.0, Math.max(0.1, current * multiplier)),
            },
          };
        }),

      initFromInterests: (interests) =>
        set((s) => {
          if (s.interestsInitialized) return s;
          const boosted = { ...DEFAULT_SCORES };
          interests.forEach((cat) => { boosted[cat] = 1.6; });
          return { categoryScores: boosted, interestsInitialized: true };
        }),

      resetInterestScores: (interests) =>
        set((s) => {
          const interestSet = new Set<string>(interests);
          const next = { ...DEFAULT_SCORES };
          for (const cat of Object.keys(s.categoryScores)) {
            if (interestSet.has(cat)) {
              // Keep the learned score, floor-boosted so a fresh pick ranks up.
              next[cat] = Math.max(1.4, s.categoryScores[cat] ?? 1.0);
            }
            // De-selected categories reset to 1.0 (neutral, not penalised).
          }
          return { categoryScores: next };
        }),

      importCategoryScores: (scores) =>
        set((s) => {
          const KNOWN = new Set(Object.keys(DEFAULT_SCORES));
          const next  = { ...s.categoryScores };
          for (const [cat, val] of Object.entries(scores)) {
            if (!KNOWN.has(cat)) continue;
            if (typeof val !== 'number' || !Number.isFinite(val)) continue;
            next[cat] = Math.min(5.0, Math.max(0.5, val));
          }
          return { categoryScores: next };
        }),

      setSearchRadiusKm: (km) =>
        set(() => ({
          searchRadiusKm: Math.min(50, Math.max(1, Math.round(km))),
        })),
    }),
    {
      name:    'gati-wander',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ _hasHydrated, ...rest }) => rest,
      onRehydrateStorage: () => () => {
        useWanderStore.setState({ _hasHydrated: true });
      },
      /**
       * v0 → v1: the persisted shape did not actually change — `_hasHydrated`
       * is partialized out and `addPlaces` is an action, not state. The
       * version bump alone still REQUIRES a migrator: without one Zustand
       * logs "State loaded from storage couldn't be migrated" and throws the
       * persisted state away, which would wipe every saved place, visit,
       * rating and learned taste score on upgrade.
       *
       * Defensive rather than a pure pass-through, because a v0 payload
       * written by an older build can legitimately be missing keys.
       */
      migrate: (persisted, fromVersion) => {
        const s = (persisted ?? {}) as Partial<WanderState>;
        let next = s;
        if (fromVersion < 1) {
          next = {
            ...next,
            places:               Array.isArray(next.places) ? next.places : [],
            categoryScores:       { ...DEFAULT_SCORES, ...(next.categoryScores ?? {}) },
            interestsInitialized: next.interestsInitialized ?? false,
          };
        }
        // v1 → v2: searchRadiusKm added. Anyone upgrading has never chosen
        // one, so they get the default rather than an undefined that would
        // reach the search as NaN.
        if (fromVersion < 2) {
          next = {
            ...next,
            searchRadiusKm: typeof next.searchRadiusKm === 'number'
              ? next.searchRadiusKm
              : DEFAULT_RADIUS_KM,
          };
        }
        return next as WanderState;
      },
    },
  ),
);

// ─── Hydration ────────────────────────────────────────────────

/**
 * True once every persisted store has finished reading AsyncStorage.
 *
 * Zustand's persist middleware hydrates asynchronously, so the first render
 * sees default state. Routing on `onboardingComplete` before hydration
 * finishes would bounce a returning user into onboarding. Gate the router on
 * this.
 */
export function useStoresHydrated(): boolean {
  const user   = useUserStore((s) => s._hasHydrated);
  const stats  = useStatsStore((s) => s._hasHydrated);
  const wander = useWanderStore((s) => s._hasHydrated);
  return Boolean(user && stats && wander);
}
