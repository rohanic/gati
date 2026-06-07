/**
 * Returns all 22 stat definitions with their unlock status relative
 * to today, plus convenience groups for the Numbers screen.
 */
import { useMemo } from 'react';
import { differenceInDays, format } from 'date-fns';
import { useUserStore } from '@/store/userStore';
import { computeLifeStats, LifeStatsOutput } from '@/engine/statsEngine';
import { STAT_DEFINITIONS, StatDef } from '@/data/statDefinitions';

export type StatStatus = 'today' | 'unlocked' | 'locked';

export interface StatWithStatus {
  definition:   StatDef;
  status:       StatStatus;
  value:        number;         // 0 if locked
  stats:        LifeStatsOutput | null; // null if locked
  unlockedDate: string | null;  // ISO date
  defIndex:     number;         // position in STAT_DEFINITIONS
  daysUntil:    number;         // days until unlock (0 if today/unlocked)
}

interface AllStatsResult {
  todayStat:     StatWithStatus | null;
  unlockedStats: StatWithStatus[]; // most recently unlocked first
  upcomingStats: StatWithStatus[]; // next 3 locked stats, soonest first
  allStats:      StatWithStatus[]; // all 22 for category filtering
  totalUnlocked: number;
}

export function useAllStats(): AllStatsResult {
  const profile = useUserStore((s) => s.profile);

  return useMemo((): AllStatsResult => {
    const empty: AllStatsResult = {
      todayStat:     null,
      unlockedStats: [],
      upcomingStats: [],
      allStats:      [],
      totalUnlocked: 0,
    };
    if (!profile) return empty;

    const lifeStats  = computeLifeStats(profile);
    const joinDate   = new Date(profile.appJoinDate + 'T00:00:00');
    const today      = new Date();
    const dayIndex   = Math.max(0, differenceInDays(today, joinDate));
    const totalDefs  = STAT_DEFINITIONS.length;
    const todayDefIdx = dayIndex % totalDefs;

    const allStats: StatWithStatus[] = STAT_DEFINITIONS.map((def, i) => {
      const rawValue = lifeStats[def.formulaKey as keyof LifeStatsOutput];
      const value    = typeof rawValue === 'number' ? rawValue : 0;

      // ── Today's stat ────────────────────────────────────────
      if (i === todayDefIdx) {
        return {
          definition:   def,
          status:       'today',
          value,
          stats:        lifeStats,
          unlockedDate: format(today, 'yyyy-MM-dd'),
          defIndex:     i,
          daysUntil:    0,
        };
      }

      // ── Unlocked in first cycle (day i has passed) ──────────
      const pastFirstCycle = dayIndex >= totalDefs;
      const unlockedThisCycle = dayIndex > i;

      if (pastFirstCycle || unlockedThisCycle) {
        const unlockDate = format(
          new Date(joinDate.getTime() + i * 86_400_000),
          'yyyy-MM-dd'
        );
        return {
          definition:   def,
          status:       'unlocked',
          value,
          stats:        lifeStats,
          unlockedDate: unlockDate,
          defIndex:     i,
          daysUntil:    0,
        };
      }

      // ── Locked ───────────────────────────────────────────────
      return {
        definition:   def,
        status:       'locked',
        value:        0,
        stats:        null,
        unlockedDate: null,
        defIndex:     i,
        daysUntil:    i - dayIndex,
      };
    });

    const todayStat     = allStats.find((s) => s.status === 'today') ?? null;
    const unlockedStats = allStats
      .filter((s) => s.status === 'unlocked')
      .sort((a, b) => b.defIndex - a.defIndex); // highest defIndex = most recently unlocked
    const upcomingStats = allStats
      .filter((s) => s.status === 'locked')
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 3);
    const totalUnlocked = unlockedStats.length + (todayStat ? 1 : 0);

    return { todayStat, unlockedStats, upcomingStats, allStats, totalUnlocked };
  }, [profile]);
}
