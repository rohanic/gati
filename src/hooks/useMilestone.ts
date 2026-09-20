/**
 * The first unseen milestone whose condition is currently met.
 *
 * Streak comes from the shared `useStreak` hook rather than a third private
 * copy of the streak logic, so the milestone that fires always matches the
 * number on screen.
 */
import { useMemo } from 'react';
import { differenceInCalendarDays } from 'date-fns';
import { useUserStore, useStatsStore } from '@/store/userStore';
import { useStreak } from '@/hooks/useStreak';
import { parseJoinDate } from '@/utils/date';
import { computeLifeStats } from '@/engine/statsEngine';
import {
  checkMilestones,
  type MilestoneDef,
  type MilestoneCheckParams,
} from '@/engine/milestoneEngine';

/** The parameter bag used for milestone checks, shared by several screens. */
export function useMilestoneParams(): MilestoneCheckParams | null {
  const profile       = useUserStore((s) => s.profile);
  const unlockedStats = useStatsStore((s) => s.unlockedStats);
  const streak        = useStreak();

  return useMemo(() => {
    if (!profile) return null;
    return {
      profile,
      lifeStats:     computeLifeStats(profile),
      streak,
      appDayIndex:   Math.max(
        0,
        differenceInCalendarDays(new Date(), parseJoinDate(profile.appJoinDate)),
      ),
      totalUnlocked: unlockedStats.length,
    };
  }, [profile, streak, unlockedStats.length]);
}

export function usePendingMilestone(): MilestoneDef | null {
  const params           = useMilestoneParams();
  const seenMilestoneIds = useStatsStore((s) => s.seenMilestoneIds);

  return useMemo(() => {
    if (!params) return null;
    const triggered = checkMilestones(params);
    return triggered.find((m) => !seenMilestoneIds.includes(m.id)) ?? null;
  }, [params, seenMilestoneIds]);
}
