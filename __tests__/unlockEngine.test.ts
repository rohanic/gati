/**
 * Unlock engine — the daily key economy.
 *
 * This decides what content a user can reach and when, so its edge cases are
 * the ones that either strand a paying-attention user or let someone drain the
 * whole catalogue in an afternoon.
 */
import {
  utcMidnight,
  parseUtcDay,
  utcDaysSinceJoin,
  keysGranted,
  availableKeys,
  nextKeyAt,
  msUntilNextKey,
  formatTimeUntilNextKey,
  summarizeUnlocks,
  DAY_ZERO_KEYS,
  MAX_BANKED_KEYS,
} from '@/engine/unlockEngine';

const AT = (iso: string) => new Date(iso);

/** `n` unlock dates all stamped on the same UTC day. */
const on = (day: string, n = 1): string[] => Array.from({ length: n }, () => day);

describe('parseUtcDay', () => {
  it('parses a yyyy-MM-dd join date', () => {
    expect(parseUtcDay('2026-06-15')).toBe(Date.UTC(2026, 5, 15));
  });

  it('ignores a time component', () => {
    expect(parseUtcDay('2026-06-15T23:59:00Z')).toBe(Date.UTC(2026, 5, 15));
  });

  it('returns null for junk rather than NaN', () => {
    expect(parseUtcDay('')).toBeNull();
    expect(parseUtcDay(null)).toBeNull();
    expect(parseUtcDay(undefined)).toBeNull();
    expect(parseUtcDay('not-a-date')).toBeNull();
    expect(parseUtcDay('2026-13-01')).toBeNull();
    expect(parseUtcDay('2026-06-99')).toBeNull();
  });
});

describe('utcMidnight', () => {
  it('floors to the UTC day', () => {
    expect(utcMidnight(AT('2026-06-15T23:59:59Z'))).toBe(Date.UTC(2026, 5, 15));
    expect(utcMidnight(AT('2026-06-15T00:00:00Z'))).toBe(Date.UTC(2026, 5, 15));
  });
});

describe('utcDaysSinceJoin', () => {
  it('is 0 on the join day', () => {
    expect(utcDaysSinceJoin('2026-06-15', AT('2026-06-15T12:00:00Z'))).toBe(0);
  });

  it('counts whole UTC days', () => {
    expect(utcDaysSinceJoin('2026-06-15', AT('2026-06-16T00:00:01Z'))).toBe(1);
    expect(utcDaysSinceJoin('2026-06-15', AT('2026-06-22T12:00:00Z'))).toBe(7);
  });

  it('rolls over exactly at UTC midnight, not a moment before', () => {
    expect(utcDaysSinceJoin('2026-06-15', AT('2026-06-15T23:59:59Z'))).toBe(0);
    expect(utcDaysSinceJoin('2026-06-15', AT('2026-06-16T00:00:00Z'))).toBe(1);
  });

  /** A rolled-back clock must not produce a negative balance. */
  it('never goes negative when the device clock is behind the join date', () => {
    expect(utcDaysSinceJoin('2026-06-15', AT('2026-01-01T00:00:00Z'))).toBe(0);
  });

  it('spans months and leap years', () => {
    expect(utcDaysSinceJoin('2028-02-27', AT('2028-03-01T00:00:00Z'))).toBe(3);
  });
});

describe('keysGranted', () => {
  it('grants the day-zero batch on install', () => {
    expect(keysGranted('2026-06-15', AT('2026-06-15T12:00:00Z'))).toBe(DAY_ZERO_KEYS);
  });

  it('grants one more per day', () => {
    expect(keysGranted('2026-06-15', AT('2026-06-16T12:00:00Z'))).toBe(DAY_ZERO_KEYS + 1);
    expect(keysGranted('2026-06-15', AT('2026-06-25T12:00:00Z'))).toBe(DAY_ZERO_KEYS + 10);
  });
});

describe('availableKeys', () => {
  const join = '2026-06-15';

  it('gives a new user the day-zero batch', () => {
    expect(availableKeys(join, [], AT('2026-06-15T12:00:00Z'))).toBe(DAY_ZERO_KEYS);
  });

  it('decreases as numbers are opened', () => {
    const at = AT('2026-06-15T12:00:00Z');
    expect(availableKeys(join, on('2026-06-15', 1), at)).toBe(2);
    expect(availableKeys(join, on('2026-06-15', 2), at)).toBe(1);
    expect(availableKeys(join, on('2026-06-15', 3), at)).toBe(0);
  });

  it('never goes below zero even if the ledger is inconsistent', () => {
    expect(availableKeys(join, on('2026-06-15', 9), AT('2026-06-15T12:00:00Z'))).toBe(0);
  });

  it('refills by one the next day', () => {
    expect(availableKeys(join, on('2026-06-15', 3), AT('2026-06-16T00:00:00Z'))).toBe(1);
    expect(availableKeys(join, on('2026-06-15', 3), AT('2026-06-17T00:00:00Z'))).toBe(2);
  });

  /**
   * The exact bug this model replaced.
   *
   * The old formula capped `granted - spent`. On day 10 with three numbers
   * opened that is 13 - 3 = 10, capped to 3 — and opening a fourth moved it to
   * 9, still capped to 3. The counter read "3 keys" forever. Each of these
   * MUST now differ.
   */
  it('decrements visibly for a user several days into their install', () => {
    const at = AT('2026-06-25T12:00:00Z');   // day 10
    expect(availableKeys(join, on('2026-06-15', 3), at)).toBe(MAX_BANKED_KEYS);
    expect(availableKeys(join, [...on('2026-06-15', 3), ...on('2026-06-25', 1)], at)).toBe(2);
    expect(availableKeys(join, [...on('2026-06-15', 3), ...on('2026-06-25', 2)], at)).toBe(1);
    expect(availableKeys(join, [...on('2026-06-15', 3), ...on('2026-06-25', 3)], at)).toBe(0);
  });

  it('forfeits rather than banks when the user is away', () => {
    // Away a fortnight after opening the day-zero batch: 3, not 14.
    expect(availableKeys(join, on('2026-06-15', 3), AT('2026-06-29T12:00:00Z')))
      .toBe(MAX_BANKED_KEYS);
    // Away a year: still 3.
    expect(availableKeys(join, on('2026-06-15', 3), AT('2027-06-15T12:00:00Z')))
      .toBe(MAX_BANKED_KEYS);
  });

  it('regenerates from the last spend, not from the join date', () => {
    // Opened three on day 10 → empty. One day later → exactly 1.
    const spent = [...on('2026-06-15', 3), ...on('2026-06-25', 3)];
    expect(availableKeys(join, spent, AT('2026-06-25T23:00:00Z'))).toBe(0);
    expect(availableKeys(join, spent, AT('2026-06-26T01:00:00Z'))).toBe(1);
    expect(availableKeys(join, spent, AT('2026-06-28T01:00:00Z'))).toBe(3);
  });

  it('handles a daily rhythm without drift', () => {
    const spent: string[] = [];
    // Three on day 0, then one a day for a week.
    spent.push(...on('2026-06-15', 3));
    for (let d = 1; d <= 7; d++) {
      const date = new Date(Date.UTC(2026, 5, 15 + d));
      const iso  = date.toISOString().slice(0, 10);
      // Before spending, exactly one key should be waiting.
      expect(availableKeys(join, spent, new Date(date.getTime() + 9 * 3600_000))).toBe(1);
      spent.push(iso);
      expect(availableKeys(join, spent, new Date(date.getTime() + 10 * 3600_000))).toBe(0);
    }
  });

  it('treats a missing join date as day zero rather than throwing', () => {
    expect(availableKeys(null, [], AT('2026-06-15T12:00:00Z'))).toBe(DAY_ZERO_KEYS);
  });

  it('ignores unparseable unlock dates rather than miscounting', () => {
    const at = AT('2026-06-15T12:00:00Z');
    expect(availableKeys(join, ['garbage', ''], at)).toBe(DAY_ZERO_KEYS);
  });

  it('counts an unlock stamped before the join date as a day-zero spend', () => {
    // Restored backup or clock skew — it still consumed a key.
    expect(availableKeys(join, ['2026-01-01'], AT('2026-06-15T12:00:00Z'))).toBe(2);
  });

  it('counts a future-dated unlock as spent today rather than granting a refund', () => {
    expect(availableKeys(join, ['2030-01-01'], AT('2026-06-15T12:00:00Z'))).toBe(2);
  });

  it('is unaffected by the order of the ledger', () => {
    const at = AT('2026-06-25T12:00:00Z');
    const a  = ['2026-06-15', '2026-06-20', '2026-06-25'];
    const b  = ['2026-06-25', '2026-06-15', '2026-06-20'];
    expect(availableKeys(join, a, at)).toBe(availableKeys(join, b, at));
  });
});

describe('nextKeyAt / msUntilNextKey', () => {
  it('is the next UTC midnight', () => {
    expect(nextKeyAt(AT('2026-06-15T10:00:00Z')).toISOString())
      .toBe('2026-06-16T00:00:00.000Z');
  });

  it('counts down within the day', () => {
    expect(msUntilNextKey(AT('2026-06-15T23:00:00Z'))).toBe(60 * 60 * 1000);
  });

  it('is a full day immediately after a reset', () => {
    expect(msUntilNextKey(AT('2026-06-15T00:00:00Z'))).toBe(86_400_000);
  });
});

describe('formatTimeUntilNextKey', () => {
  it('reads in hours and minutes', () => {
    expect(formatTimeUntilNextKey(AT('2026-06-15T17:48:00Z'))).toBe('6h 12m');
  });

  it('drops the minutes on the hour', () => {
    expect(formatTimeUntilNextKey(AT('2026-06-15T18:00:00Z'))).toBe('6h');
  });

  it('switches to minutes only in the last hour', () => {
    expect(formatTimeUntilNextKey(AT('2026-06-15T23:30:00Z'))).toBe('30m');
  });

  it('degrades gracefully at the boundary', () => {
    expect(formatTimeUntilNextKey(AT('2026-06-15T23:59:59.500Z'))).toBe('1m');
  });
});

describe('summarizeUnlocks', () => {
  const join  = '2026-06-15';
  const TOTAL = 25;

  it('describes a brand-new user', () => {
    const s = summarizeUnlocks(join, [], TOTAL, AT('2026-06-15T12:00:00Z'));
    expect(s.available).toBe(DAY_ZERO_KEYS);
    expect(s.unlocked).toBe(0);
    expect(s.remaining).toBe(TOTAL);
    expect(s.canUnlock).toBe(true);
    expect(s.allComplete).toBe(false);
  });

  it('reports no keys once the day-zero batch is spent', () => {
    const s = summarizeUnlocks(join, on('2026-06-15', 3), TOTAL, AT('2026-06-15T18:00:00Z'));
    expect(s.available).toBe(0);
    expect(s.canUnlock).toBe(false);
  });

  it('reports completion and offers no keys once everything is open', () => {
    const s = summarizeUnlocks(join, on('2026-06-15', TOTAL), TOTAL, AT('2027-06-15T12:00:00Z'));
    expect(s.allComplete).toBe(true);
    expect(s.remaining).toBe(0);
    expect(s.available).toBe(0);
    expect(s.canUnlock).toBe(false);
  });

  it('never offers more keys than there are numbers left', () => {
    const s = summarizeUnlocks(join, on('2026-06-15', TOTAL - 1), TOTAL, AT('2027-06-15T12:00:00Z'));
    expect(s.available).toBe(1);
  });
});

/**
 * A month of real use, asserted day by day. This is the loop the product rests
 * on, so it is verified end to end rather than only in pieces.
 */
describe('a month of daily use', () => {
  const join  = '2026-06-15';
  const TOTAL = 25;
  const day   = (d: number, hour = 9) =>
    new Date(Date.UTC(2026, 5, 15 + d, hour, 0, 0));
  const iso   = (d: number) => day(d).toISOString().slice(0, 10);

  it('opens 3 on day one, then exactly one per day', () => {
    const spent: string[] = [];

    let s = summarizeUnlocks(join, spent, TOTAL, day(0));
    expect(s.available).toBe(3);
    spent.push(...on(iso(0), 3));
    expect(summarizeUnlocks(join, spent, TOTAL, day(0, 20)).available).toBe(0);

    for (let d = 1; d <= 21; d++) {
      s = summarizeUnlocks(join, spent, TOTAL, day(d));
      expect(s.available).toBe(1);
      spent.push(iso(d));
      expect(summarizeUnlocks(join, spent, TOTAL, day(d, 20)).available).toBe(0);
    }

    expect(spent).toHaveLength(24);
    s = summarizeUnlocks(join, spent, TOTAL, day(22));
    expect(s.remaining).toBe(1);
    expect(s.available).toBe(1);

    spent.push(iso(22));
    expect(summarizeUnlocks(join, spent, TOTAL, day(22, 20)).allComplete).toBe(true);
  });

  it('lets a lapsed user catch up to the cap, then drains normally', () => {
    // Three on day 0, then nothing for two weeks.
    const spent = on(iso(0), 3);
    expect(summarizeUnlocks(join, spent, TOTAL, day(14)).available).toBe(MAX_BANKED_KEYS);

    // They spend all three on their return day.
    const caughtUp = [...spent, ...on(iso(14), 3)];
    expect(summarizeUnlocks(join, caughtUp, TOTAL, day(14, 20)).available).toBe(0);
    // And are back to the normal one-a-day rhythm.
    expect(summarizeUnlocks(join, caughtUp, TOTAL, day(15)).available).toBe(1);
  });
});

/**
 * A profile with no usable join date.
 *
 * This is the failure that made the counter read "3 keys remaining" forever.
 * With nothing to measure spends against, every unlock fell out of the ledger
 * and the bank never drained — and because `redeemKey` gates on this same
 * number, the whole catalogue could be opened in one sitting.
 *
 * Reachable from a profile written before `appJoinDate` existed, or restored
 * from a backup without it.
 */
describe('availableKeys with a missing join date', () => {
  const NOW = new Date('2026-09-22T10:00:00Z');

  it('drains the bank exactly as an explicit join date would', () => {
    const dates = ['2026-09-20', '2026-09-21', '2026-09-22'];
    expect(availableKeys(null, dates, NOW))
      .toBe(availableKeys('2026-09-20', dates, NOW));
  });

  it('no longer reports a full bank after nine unlocks', () => {
    const nine = Array.from({ length: 9 }, () => '2026-09-21');
    expect(availableKeys(null, nine, NOW)).toBeLessThan(MAX_BANKED_KEYS);
  });

  it('still gives a genuinely new user a full bank', () => {
    // No join date AND no unlocks is a fresh install, not a broken profile.
    expect(availableKeys(null, [], NOW)).toBe(DAY_ZERO_KEYS);
    expect(availableKeys(undefined, [], NOW)).toBe(DAY_ZERO_KEYS);
    expect(availableKeys('', [], NOW)).toBe(DAY_ZERO_KEYS);
  });

  it('anchors on the earliest unlock, not the first one listed', () => {
    // Unsorted input must not change where the ledger starts.
    const shuffled = ['2026-09-22', '2026-09-18', '2026-09-20'];
    const sorted   = ['2026-09-18', '2026-09-20', '2026-09-22'];
    expect(availableKeys(null, shuffled, NOW))
      .toBe(availableKeys(null, sorted, NOW));
    expect(availableKeys(null, shuffled, NOW))
      .toBe(availableKeys('2026-09-18', shuffled, NOW));
  });

  it('ignores unparseable dates when choosing the anchor', () => {
    const withJunk = ['not-a-date', '2026-09-20', ''];
    expect(availableKeys(null, withJunk, NOW))
      .toBe(availableKeys('2026-09-20', ['2026-09-20'], NOW));
  });

  it('keeps regenerating over time rather than staying drained', () => {
    const dates = ['2026-09-20', '2026-09-20', '2026-09-20'];
    const sameDay = availableKeys(null, dates, new Date('2026-09-20T10:00:00Z'));
    const twoDays = availableKeys(null, dates, new Date('2026-09-22T10:00:00Z'));
    expect(sameDay).toBe(0);
    expect(twoDays).toBeGreaterThan(sameDay);
  });
});
