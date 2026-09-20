/**
 * Streak utilities — the single source of truth for "how many days in a row".
 *
 * There used to be three separate implementations (this file, `useMilestone`,
 * and the edge functions), two of which read the truncated 400-entry flat
 * `openHistory` and none of which agreed about freeze-bridged days. The
 * milestone that fired and the streak on screen could differ.
 *
 * Everything now derives from `openHistoryRanges`, which is never truncated
 * and always includes freeze-bridged dates.
 */
import { useMemo } from 'react';
import { format, subDays, differenceInDays, parseISO } from 'date-fns';
import { useStatsStore } from '@/store/userStore';
import type { DateRange } from '@/store/userStore';

/**
 * Current running streak as of `now`.
 *
 * A streak stays "alive" if the last recorded day is today OR yesterday —
 * yesterday covers the window between midnight and the user's first open.
 * Pure, so it can be unit-tested and reused outside React.
 */
export function computeCurrentStreak(
  ranges: DateRange[],
  now:    Date = new Date(),
): number {
  if (ranges.length === 0) return 0;

  const today     = format(now, 'yyyy-MM-dd');
  const yesterday = format(subDays(now, 1), 'yyyy-MM-dd');

  const last = ranges[ranges.length - 1];
  if (last.e !== today && last.e !== yesterday) return 0;

  return differenceInDays(parseISO(last.e), parseISO(last.s)) + 1;
}

/**
 * Longest streak in the given ranges.
 * Each range is contiguous by construction, so this is the longest range.
 */
export function computeBestStreakFromRanges(ranges: DateRange[]): number {
  let best = 0;
  for (const r of ranges) {
    const len = differenceInDays(parseISO(r.e), parseISO(r.s)) + 1;
    if (len > best) best = len;
  }
  return best;
}

/**
 * Longest streak from a flat list of ISO dates.
 * Retained for restoring older exports; prefer the range version.
 */
export function computeBestStreak(openHistory: string[]): number {
  if (openHistory.length === 0) return 0;
  const sorted = [...new Set(openHistory)].sort();
  let best    = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i++) {
    const diff = differenceInDays(parseISO(sorted[i]), parseISO(sorted[i - 1]));
    if (diff === 1) { current++; best = Math.max(best, current); }
    else if (diff > 1) { current = 1; }
  }
  return best;
}

/** All-time best streak (persisted, survives history merges). */
export function useMaxStreakEver(): number {
  const stored = useStatsStore((s) => s.maxStreakEver);
  const ranges = useStatsStore((s) => s.openHistoryRanges);
  return useMemo(
    () => Math.max(stored, computeBestStreakFromRanges(ranges)),
    [stored, ranges],
  );
}

/** Current running streak. */
export function useStreak(): number {
  const ranges = useStatsStore((s) => s.openHistoryRanges);
  const legacy = useStatsStore((s) => s.openHistory);

  return useMemo(() => {
    if (ranges.length > 0) return computeCurrentStreak(ranges);
    // First open after an upgrade, before `recordOpen` has migrated the flat
    // list into ranges.
    if (legacy.length === 0) return 0;
    return computeCurrentStreak(toRangesLocal(legacy));
  }, [ranges, legacy]);
}

/** Set of ISO dates the user opened the app, for calendar-style displays. */
export function useOpenDateSet(): Set<string> {
  const ranges = useStatsStore((s) => s.openHistoryRanges);
  const legacy = useStatsStore((s) => s.openHistory);

  return useMemo(() => {
    const out = new Set<string>(legacy);
    // Expand only the recent tail: callers render at most a few weeks, and a
    // multi-year history would otherwise expand to thousands of strings.
    const HORIZON_DAYS = 60;
    const cutoff = format(subDays(new Date(), HORIZON_DAYS), 'yyyy-MM-dd');
    for (const r of ranges) {
      if (r.e < cutoff) continue;
      let cursor = r.s < cutoff ? cutoff : r.s;
      while (cursor <= r.e) {
        out.add(cursor);
        cursor = format(
          new Date(parseISO(cursor).getTime() + 86_400_000),
          'yyyy-MM-dd',
        );
      }
    }
    return out;
  }, [ranges, legacy]);
}

/** Local copy of the flat→ranges conversion, to avoid a store import cycle. */
function toRangesLocal(dates: string[]): DateRange[] {
  if (dates.length === 0) return [];
  const sorted = [...new Set(dates)].sort();
  const out: DateRange[] = [{ s: sorted[0], e: sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const last = out[out.length - 1];
    const gap  = differenceInDays(parseISO(sorted[i]), parseISO(last.e));
    if (gap === 1)    { last.e = sorted[i]; }
    else if (gap > 1) { out.push({ s: sorted[i], e: sorted[i] }); }
  }
  return out;
}
