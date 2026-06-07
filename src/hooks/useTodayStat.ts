/**
 * Determines which stat to show today and returns the resolved value.
 * Rotation: one new stat per day, cycling through STAT_DEFINITIONS in order.
 * Once unlocked, today's stat is recorded so it persists across app opens.
 */
import { useMemo, useEffect } from 'react';
import { differenceInDays, format } from 'date-fns';
import { useUserStore, useStatsStore } from '@/store/userStore';
import { computeLifeStats, LifeStatsOutput } from '@/engine/statsEngine';
import { STAT_DEFINITIONS, StatDef } from '@/data/statDefinitions';

export interface TodayStatResult {
  definition:   StatDef;
  value:        number;
  stats:        LifeStatsOutput;
  isNewUnlock:  boolean;     // true if this is the first time seeing today's stat
  dayIndex:     number;      // days since joining, 0-based
}

export function useTodayStat(): TodayStatResult | null {
  const profile          = useUserStore((s) => s.profile);
  const { unlockedStats, unlockStat, recordOpen } = useStatsStore();

  // Record today's open (streak tracking)
  useEffect(() => {
    recordOpen();
  }, []);

  return useMemo((): TodayStatResult | null => {
    if (!profile) return null;

    const stats      = computeLifeStats(profile);
    const joinDate   = new Date(profile.appJoinDate + 'T00:00:00');
    const today      = new Date();
    const dayIndex   = Math.max(0, differenceInDays(today, joinDate));
    const defIndex   = dayIndex % STAT_DEFINITIONS.length;
    const definition = STAT_DEFINITIONS[defIndex];

    // Resolve the numeric value
    const rawValue = stats[definition.formulaKey as keyof LifeStatsOutput];
    const value    = typeof rawValue === 'number' ? rawValue : 0;

    // Check if already unlocked today
    const alreadyUnlocked = unlockedStats.some((u) => {
      const unlockDay = Math.max(
        0,
        differenceInDays(new Date(u.unlockedDate + 'T00:00:00'), joinDate)
      );
      return u.statId === definition.id && unlockDay === dayIndex;
    });

    return {
      definition,
      value,
      stats,
      isNewUnlock: !alreadyUnlocked,
      dayIndex,
    };
  }, [profile, unlockedStats]);
}

/** All previously unlocked stats (before today), for the timeline */
export function usePreviousStats(): Array<{
  definition: StatDef;
  value:      number;
  date:       string;
}> {
  const profile = useUserStore((s) => s.profile);

  return useMemo(() => {
    if (!profile) return [];

    const stats    = computeLifeStats(profile);
    const joinDate = new Date(profile.appJoinDate + 'T00:00:00');
    const today    = new Date();
    const totalDays = Math.max(0, differenceInDays(today, joinDate));

    // Show the last 3 days before today
    const results = [];
    for (let d = Math.max(0, totalDays - 3); d < totalDays; d++) {
      const defIndex   = d % STAT_DEFINITIONS.length;
      const definition = STAT_DEFINITIONS[defIndex];
      const rawValue   = stats[definition.formulaKey as keyof LifeStatsOutput];
      const value      = typeof rawValue === 'number' ? rawValue : 0;
      const date       = format(
        new Date(joinDate.getTime() + d * 86_400_000),
        'yyyy-MM-dd'
      );
      results.push({ definition, value, date });
    }

    return results.reverse(); // most recent first
  }, [profile]);
}
