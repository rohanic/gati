/**
 * Streak range maths.
 *
 * Streaks are stored run-length-encoded so a multi-year history stays one
 * small object. Every helper below is used by the UI, the milestone engine
 * and the push functions, which previously each had their own subtly
 * different implementation.
 */
import {
  toRanges,
  insertDateIntoRanges,
  mergeRanges,
  streakEndingOn,
  type DateRange,
} from '@/store/userStore';
import {
  computeCurrentStreak,
  computeBestStreakFromRanges,
  computeBestStreak,
} from '@/hooks/useStreak';

describe('toRanges', () => {
  it('returns nothing for an empty list', () => {
    expect(toRanges([])).toEqual([]);
  });

  it('collapses consecutive days into one range', () => {
    expect(toRanges(['2026-01-01', '2026-01-02', '2026-01-03']))
      .toEqual([{ s: '2026-01-01', e: '2026-01-03' }]);
  });

  it('splits on a gap', () => {
    expect(toRanges(['2026-01-01', '2026-01-02', '2026-01-05'])).toEqual([
      { s: '2026-01-01', e: '2026-01-02' },
      { s: '2026-01-05', e: '2026-01-05' },
    ]);
  });

  it('is order- and duplicate-insensitive', () => {
    expect(toRanges(['2026-01-03', '2026-01-01', '2026-01-02', '2026-01-01']))
      .toEqual([{ s: '2026-01-01', e: '2026-01-03' }]);
  });

  it('spans a month boundary', () => {
    expect(toRanges(['2026-01-30', '2026-01-31', '2026-02-01']))
      .toEqual([{ s: '2026-01-30', e: '2026-02-01' }]);
  });

  it('spans a leap day', () => {
    expect(toRanges(['2028-02-28', '2028-02-29', '2028-03-01']))
      .toEqual([{ s: '2028-02-28', e: '2028-03-01' }]);
  });
});

describe('insertDateIntoRanges', () => {
  it('creates the first range', () => {
    expect(insertDateIntoRanges([], '2026-01-01'))
      .toEqual([{ s: '2026-01-01', e: '2026-01-01' }]);
  });

  it('extends a range forward', () => {
    expect(insertDateIntoRanges([{ s: '2026-01-01', e: '2026-01-02' }], '2026-01-03'))
      .toEqual([{ s: '2026-01-01', e: '2026-01-03' }]);
  });

  it('extends a range backward', () => {
    expect(insertDateIntoRanges([{ s: '2026-01-02', e: '2026-01-03' }], '2026-01-01'))
      .toEqual([{ s: '2026-01-01', e: '2026-01-03' }]);
  });

  /** A streak freeze bridges a missed day; the two runs must become one. */
  it('merges two ranges when the date bridges them', () => {
    const ranges: DateRange[] = [
      { s: '2026-01-01', e: '2026-01-03' },
      { s: '2026-01-05', e: '2026-01-07' },
    ];
    expect(insertDateIntoRanges(ranges, '2026-01-04'))
      .toEqual([{ s: '2026-01-01', e: '2026-01-07' }]);
  });

  it('is a no-op for a date already covered', () => {
    const ranges: DateRange[] = [{ s: '2026-01-01', e: '2026-01-05' }];
    expect(insertDateIntoRanges(ranges, '2026-01-03')).toBe(ranges);
  });

  it('never mutates the input', () => {
    const ranges: DateRange[] = [{ s: '2026-01-01', e: '2026-01-02' }];
    const snapshot = JSON.parse(JSON.stringify(ranges));
    insertDateIntoRanges(ranges, '2026-01-03');
    expect(ranges).toEqual(snapshot);
  });

  it('starts a new range across a gap', () => {
    expect(insertDateIntoRanges([{ s: '2026-01-01', e: '2026-01-02' }], '2026-01-10'))
      .toEqual([
        { s: '2026-01-01', e: '2026-01-02' },
        { s: '2026-01-10', e: '2026-01-10' },
      ]);
  });
});

describe('mergeRanges', () => {
  it('unions two devices’ histories', () => {
    const a: DateRange[] = [{ s: '2026-01-01', e: '2026-01-03' }];
    const b: DateRange[] = [{ s: '2026-01-04', e: '2026-01-06' }];
    expect(mergeRanges(a, b)).toEqual([{ s: '2026-01-01', e: '2026-01-06' }]);
  });

  it('keeps genuinely separate runs separate', () => {
    const a: DateRange[] = [{ s: '2026-01-01', e: '2026-01-02' }];
    const b: DateRange[] = [{ s: '2026-02-01', e: '2026-02-02' }];
    expect(mergeRanges(a, b)).toHaveLength(2);
  });

  it('absorbs a fully contained range', () => {
    const a: DateRange[] = [{ s: '2026-01-01', e: '2026-01-10' }];
    const b: DateRange[] = [{ s: '2026-01-03', e: '2026-01-05' }];
    expect(mergeRanges(a, b)).toEqual([{ s: '2026-01-01', e: '2026-01-10' }]);
  });

  it('survives malformed rows from an old cloud row', () => {
    const a = [{ s: '2026-01-01', e: '2026-01-02' }] as DateRange[];
    const b = [null, undefined, { s: '', e: '' }] as unknown as DateRange[];
    expect(mergeRanges(a, b)).toEqual([{ s: '2026-01-01', e: '2026-01-02' }]);
  });
});

describe('streakEndingOn', () => {
  it('measures the run ending on the given date', () => {
    expect(streakEndingOn([{ s: '2026-01-01', e: '2026-01-07' }], '2026-01-07')).toBe(7);
  });

  it('is 0 when the last range ends elsewhere', () => {
    expect(streakEndingOn([{ s: '2026-01-01', e: '2026-01-05' }], '2026-01-07')).toBe(0);
  });

  it('is 0 with no history', () => {
    expect(streakEndingOn([], '2026-01-07')).toBe(0);
  });
});

describe('computeCurrentStreak', () => {
  const now = new Date('2026-06-15T12:00:00Z');

  it('counts a run ending today', () => {
    expect(computeCurrentStreak([{ s: '2026-06-10', e: '2026-06-15' }], now)).toBe(6);
  });

  /**
   * A streak is still alive between midnight and the user's first open of
   * the day, so a run ending yesterday must still count.
   */
  it('counts a run ending yesterday', () => {
    expect(computeCurrentStreak([{ s: '2026-06-10', e: '2026-06-14' }], now)).toBe(5);
  });

  it('is broken once two days have passed', () => {
    expect(computeCurrentStreak([{ s: '2026-06-01', e: '2026-06-13' }], now)).toBe(0);
  });

  it('is 0 with no history', () => {
    expect(computeCurrentStreak([], now)).toBe(0);
  });

  it('counts a single day', () => {
    expect(computeCurrentStreak([{ s: '2026-06-15', e: '2026-06-15' }], now)).toBe(1);
  });
});

describe('computeBestStreakFromRanges', () => {
  it('finds the longest run', () => {
    const ranges: DateRange[] = [
      { s: '2026-01-01', e: '2026-01-03' },  // 3
      { s: '2026-02-01', e: '2026-02-10' },  // 10
      { s: '2026-03-01', e: '2026-03-02' },  // 2
    ];
    expect(computeBestStreakFromRanges(ranges)).toBe(10);
  });

  it('is 0 with no history', () => {
    expect(computeBestStreakFromRanges([])).toBe(0);
  });
});

describe('computeBestStreak (flat legacy list)', () => {
  it('agrees with the range implementation', () => {
    const dates = [
      '2026-01-01', '2026-01-02', '2026-01-03',
      '2026-02-01', '2026-02-02',
    ];
    expect(computeBestStreak(dates)).toBe(3);
    expect(computeBestStreak(dates)).toBe(computeBestStreakFromRanges(toRanges(dates)));
  });

  it('ignores duplicates', () => {
    expect(computeBestStreak(['2026-01-01', '2026-01-01', '2026-01-02'])).toBe(2);
  });

  it('is 0 for an empty list', () => {
    expect(computeBestStreak([])).toBe(0);
  });
});
