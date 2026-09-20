/**
 * The number catalogue, as the UI needs it.
 *
 * Replaces the old `useAllStats` / `useTodayStat` pair, which derived what you
 * could see from a fixed day-N schedule. State now comes from the unlock
 * ledger: what you have opened is what you have, and keys decide what you can
 * open next.
 */
import { useMemo } from 'react';
import { useUserStore, useStatsStore } from '@/store/userStore';
import { useClockStore } from '@/store/clockStore';
import { computeLifeStats, type LifeStatsOutput } from '@/engine/statsEngine';
import { STAT_DEFINITIONS, type StatDef } from '@/data/statDefinitions';
import { getTeaser, getSourceLabel } from '@/data/statTeasers';
import { summarizeUnlocks, type UnlockSummary } from '@/engine/unlockEngine';

export interface NumberCard {
  definition: StatDef;
  /** True once the user has spent a key on it. */
  unlocked:   boolean;
  /** The user's own figure. Only meaningful when `unlocked`. */
  value:      number;
  /** ISO date it was opened, or null. */
  openedOn:   string | null;
  /** One-line hook shown while sealed. */
  teaser:     string;
  /** "from your 2 cups a day", when the number is preference-driven. */
  source:     string | null;
  /** True when opened during the current UTC day. */
  openedToday: boolean;
}

export interface NumbersResult {
  cards:    NumberCard[];
  unlocked: NumberCard[];
  locked:   NumberCard[];
  /** Numbers opened during the current UTC day, newest first. */
  today:    NumberCard[];
  /** Full life stats, for screens that need more than one figure. */
  stats:    LifeStatsOutput | null;
  summary:  UnlockSummary;
  /** True before onboarding has produced a profile. */
  empty:    boolean;
}

/** Today's date in UTC, matching how keys are granted. */
function utcToday(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function useNumbers(): NumbersResult {
  const profile       = useUserStore((s) => s.profile);
  const unlockedStats = useStatsStore((s) => s.unlockedStats);
  // Recomputes when wall-clock time moves, so the key counter and the
  // "opened today" grouping stay correct without a remount.
  const tick          = useClockStore((s) => s.tick);

  return useMemo((): NumbersResult => {
    const now   = new Date();
    const today = utcToday(now);

    // Pass the actual unlock DATES, not just a count: the key bank regenerates
    // against when each key was spent, so the dates are the input.
    const summary = summarizeUnlocks(
      profile?.appJoinDate ?? null,
      unlockedStats.map((u) => u.unlockedDate),
      STAT_DEFINITIONS.length,
      now,
    );

    if (!profile) {
      return {
        cards: [], unlocked: [], locked: [], today: [],
        stats: null, summary, empty: true,
      };
    }

    const stats    = computeLifeStats(profile);
    const ledger   = new Map(unlockedStats.map((u) => [u.statId, u]));

    const cards: NumberCard[] = STAT_DEFINITIONS.map((definition) => {
      const record   = ledger.get(definition.id);
      const rawValue = stats[definition.formulaKey as keyof LifeStatsOutput];

      return {
        definition,
        unlocked:    Boolean(record),
        value:       typeof rawValue === 'number' ? rawValue : 0,
        openedOn:    record?.unlockedDate ?? null,
        teaser:      getTeaser(definition.id),
        source:      getSourceLabel(definition.id, profile),
        openedToday: record?.unlockedDate === today,
      };
    });

    const unlocked = cards.filter((c) => c.unlocked);
    const locked   = cards.filter((c) => !c.unlocked);

    // Newest first, so the most recent reveal leads.
    const todayCards = unlocked
      .filter((c) => c.openedToday)
      .reverse();

    return {
      cards,
      unlocked,
      locked,
      today: todayCards,
      stats,
      summary,
      empty: false,
    };
  // `tick` is the signal that wall-clock time moved, which is what the UTC day
  // and the key count are derived from.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, unlockedStats, tick]);
}

/**
 * A suggested number to open next.
 *
 * Deliberately not random: it walks the catalogue in authored order, which is
 * sequenced to open with an anchor (days alive), follow with a surprise
 * (blinks), and pace the heavier ones. The user can always ignore it and pick
 * anything else — this is a nudge for the undecided, not a schedule.
 */
export function useSuggestedNumber(): NumberCard | null {
  const { locked, summary } = useNumbers();
  return useMemo(() => {
    if (!summary.canUnlock) return null;
    return locked[0] ?? null;
  }, [locked, summary.canUnlock]);
}
