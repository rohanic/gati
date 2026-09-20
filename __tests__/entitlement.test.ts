/**
 * Entitlement derivation.
 *
 * These rules decide who pays and what they get, and none of them were
 * covered before. Every case below corresponds to a real defect found in the
 * pre-upgrade code.
 */
import {
  computeProStatus,
  trialDaysLeft,
  earliestDate,
  TRIAL_DAYS,
} from '@/store/userStore';

const AT = (iso: string) => new Date(iso);

describe('computeProStatus', () => {
  const now = AT('2026-06-15T12:00:00Z');

  it('is free with no trial and no purchase', () => {
    expect(computeProStatus(null, false, null, now)).toBe('free');
  });

  it('is trial on the first day', () => {
    expect(computeProStatus('2026-06-15T09:00:00Z', false, null, now)).toBe('trial');
  });

  it('stays trial on the last day of the window', () => {
    // Day 6 of a 7-day trial.
    expect(computeProStatus('2026-06-09T09:00:00Z', false, null, now)).toBe('trial');
  });

  it('expires the trial exactly on day 7', () => {
    expect(computeProStatus('2026-06-08T09:00:00Z', false, null, now)).toBe('free');
  });

  it('uses calendar days, not 24h chunks', () => {
    // Started 23:59 yesterday — that is already "day 1", not day 0.
    const status = computeProStatus('2026-06-08T23:59:00Z', false, null, now);
    expect(status).toBe('free');
  });

  it('refuses a trial start rolled far into the future (clock tamper)', () => {
    expect(computeProStatus('2026-07-01T00:00:00Z', false, null, now)).toBe('free');
  });

  it('tolerates a one-day future skew from a date-line crossing', () => {
    expect(computeProStatus('2026-06-16T00:00:00Z', false, null, now)).toBe('trial');
  });

  // ── Paid entitlement ────────────────────────────────────────────────────
  it('is pro when the receipt has not expired', () => {
    expect(computeProStatus(null, true, '2026-07-15T00:00:00Z', now)).toBe('pro');
  });

  it('is pro when no expiry was reported by the store', () => {
    expect(computeProStatus(null, true, null, now)).toBe('pro');
  });

  /**
   * The previous implementation had no expiry concept at all: once `isPro`
   * was true it stayed true forever, so a cancelled subscription never lost
   * access. This is the regression guard for that.
   */
  it('revokes Pro once the receipt has expired', () => {
    expect(computeProStatus(null, true, '2026-06-01T00:00:00Z', now)).toBe('free');
  });

  it('falls back to an active trial when the receipt has expired', () => {
    const status = computeProStatus('2026-06-14T00:00:00Z', true, '2026-06-01T00:00:00Z', now);
    expect(status).toBe('trial');
  });

  it('ignores an unparseable trial date rather than throwing', () => {
    expect(computeProStatus('not-a-date', false, null, now)).toBe('free');
  });

  it('treats an unparseable expiry as still active', () => {
    // Better to over-grant than to strip a paying user's access on bad data.
    expect(computeProStatus(null, true, 'garbage', now)).toBe('pro');
  });
});

describe('trialDaysLeft', () => {
  const now = AT('2026-06-15T12:00:00Z');

  it('is 0 without a trial', () => {
    expect(trialDaysLeft(null, now)).toBe(0);
  });

  it('is the full window on day 0', () => {
    expect(trialDaysLeft('2026-06-15T01:00:00Z', now)).toBe(TRIAL_DAYS);
  });

  it('counts down by calendar day', () => {
    expect(trialDaysLeft('2026-06-12T01:00:00Z', now)).toBe(4);
  });

  it('clamps to 0 once expired', () => {
    expect(trialDaysLeft('2026-01-01T00:00:00Z', now)).toBe(0);
  });

  it('never exceeds the window even with a future start', () => {
    expect(trialDaysLeft('2026-09-01T00:00:00Z', now)).toBe(TRIAL_DAYS);
  });
});

describe('earliestDate', () => {
  it('returns the other value when one is null', () => {
    expect(earliestDate(null, 'b')).toBe('b');
    expect(earliestDate('a', null)).toBe('a');
  });

  it('returns null when both are null', () => {
    expect(earliestDate(null, null)).toBeNull();
  });

  /**
   * This is what stops the trial anchor drifting forward and silently
   * extending itself when local and cloud values disagree.
   */
  it('always picks the earlier timestamp', () => {
    expect(earliestDate('2026-06-10T00:00:00Z', '2026-06-01T00:00:00Z'))
      .toBe('2026-06-01T00:00:00Z');
    expect(earliestDate('2026-06-01T00:00:00Z', '2026-06-10T00:00:00Z'))
      .toBe('2026-06-01T00:00:00Z');
  });
});
