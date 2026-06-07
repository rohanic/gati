/**
 * Returns the first unseen milestone whose condition is currently met.
 * Driving logic:
 *   - Streak computed from openHistory (consecutive days ending today)
 *   - appDayIndex from joinDate in profile
 *   - totalUnlocked = unlockedStats.length
 */
import { useMemo } from 'react';
import { differenceInDays, parseISO, subDays, format } from 'date-fns';
import { useUserStore, useStatsStore } from '@/store/userStore';
import { computeLifeStats } from '@/engine/statsEngine';
import {
  checkMilestones,
  type MilestoneDef,
  type MilestoneCheckParams,
} from '@/engine/milestoneEngine';

/** Compute current streak from an array of ISO date strings. */
function computeStreak(openHistory: string[]): number {
  if (openHistory.length === 0) return 0;

  const today       = new Date();
  const todayStr    = format(today, 'yyyy-MM-dd');
  const yesterdayStr = format(subDays(today, 1), 'yyyy-MM-dd');

  // Streak only counts if opened today or yesterday (running streak)
  const hasToday     = openHistory.includes(todayStr);
  const hasYesterday = openHistory.includes(yesterdayStr);
  if (!hasToday && !hasYesterday) return 0;

  // Walk backwards from today
  let count = 0;
  let cursor = hasToday ? today : subDays(today, 1);

  while (true) {
    const curStr = format(cursor, 'yyyy-MM-dd');
    if (openHistory.includes(curStr)) {
      count++;
      cursor = subDays(cursor, 1);
    } else {
      break;
    }
  }
  return count;
}

export function usePendingMilestone(): MilestoneDef | null {
  const profile         = useUserStore((s) => s.profile);
  const openHistory     = useStatsStore((s) => s.openHistory);
  const unlockedStats   = useStatsStore((s) => s.unlockedStats);
  const seenMilestoneIds = useStatsStore((s) => s.seenMilestoneIds);

  return useMemo(() => {
    if (!profile) return null;

    const lifeStats    = computeLifeStats(profile);
    const streak       = computeStreak(openHistory);
    const appDayIndex  = differenceInDays(new Date(), parseISO(profile.appJoinDate ?? new Date().toISOString()));
    const totalUnlocked = unlockedStats.length;

    const params: MilestoneCheckParams = {
      profile,
      lifeStats,
      streak,
      appDayIndex,
      totalUnlocked,
    };

    const triggered = checkMilestones(params);
    // Return first one the user has not yet dismissed
    return triggered.find((m) => !seenMilestoneIds.includes(m.id)) ?? null;
  }, [profile, openHistory, unlockedStats, seenMilestoneIds]);
}
