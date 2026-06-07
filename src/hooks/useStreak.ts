/**
 * Computes the current daily open-streak.
 * Counts consecutive days (including today) that the user opened the app.
 */
import { useMemo } from 'react';
import { format, subDays } from 'date-fns';
import { useStatsStore } from '@/store/userStore';

export function useStreak(): number {
  const openHistory = useStatsStore((s) => s.openHistory);

  return useMemo(() => {
    if (openHistory.length === 0) return 0;

    let streak    = 0;
    let checkDate = new Date();

    // Walk backwards from today until a gap is found
    while (true) {
      const dateStr = format(checkDate, 'yyyy-MM-dd');
      if (openHistory.includes(dateStr)) {
        streak++;
        checkDate = subDays(checkDate, 1);
      } else {
        break;
      }
    }

    return streak;
  }, [openHistory]);
}
