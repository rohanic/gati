/**
 * Notification copy.
 *
 * A notification is the app's only way to reach someone who has not opened
 * it, and the fastest way to be muted forever. These guard the two things
 * that make the copy worth sending: it must be SPECIFIC to that user, and it
 * must never leak the number it is inviting them to unlock.
 */
import { magnitudeHook } from '@/services/notifications';

describe('magnitudeHook', () => {
  it('never prints the figure it describes', () => {
    // The whole point: the size is the hook, the value is the payoff.
    for (const v of [2_847_193_200, 1_500_000, 328_500, 8_760]) {
      const hook = magnitudeHook(v);
      expect(hook).not.toBeNull();
      const digitRuns = hook!.match(/\d[\d,]*/g) ?? [];
      for (const run of digitRuns) {
        // Only a small digit COUNT may appear, never the number itself.
        expect(Number(run.replace(/,/g, ''))).toBeLessThan(20);
      }
      expect(hook).not.toContain(String(Math.floor(v)));
      expect(hook).not.toContain(Math.floor(v).toLocaleString('en-US'));
    }
  });

  it('reports the digit count correctly for the big ones', () => {
    // 2,847,193,200 is ten digits — that is the fact doing the work.
    expect(magnitudeHook(2_847_193_200)).toContain('10 digits');
    expect(magnitudeHook(999_999_999_999)).toContain('12 digits');
  });

  it('describes mid-range numbers by scale instead of digits', () => {
    expect(magnitudeHook(1_500_000)).toContain('millions');
    expect(magnitudeHook(8_760)).toContain('thousands');
  });

  it('declines to say anything about a number too small to impress', () => {
    // "Today's number is in the... tens" is worse than saying nothing, so the
    // caller falls through to other copy.
    for (const v of [0, 1, 42, 999]) expect(magnitudeHook(v)).toBeNull();
  });

  it('survives the values a broken profile can produce', () => {
    for (const v of [undefined, NaN, Infinity, -1, -2_000_000]) {
      expect(magnitudeHook(v as number | undefined)).toBeNull();
    }
  });
});
