/**
 * Notification copy.
 *
 * A notification is the app's only way to reach someone who has not opened
 * it, and the fastest way to be muted forever. These guard the two things
 * that make the copy worth sending: it must be SPECIFIC to that user, and it
 * must never leak the number it is inviting them to unlock.
 */
import { magnitudeHook, buildDigest } from '@/services/notifications';

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

/**
 * The expanded notification body.
 *
 * Android shows one line collapsed and the rest on a pull. These guard the
 * two ways a digest goes wrong: padding it with rows that say nothing, and
 * leaving fragments behind when a sentence is reshaped into a labelled row.
 */
describe('buildDigest', () => {
  const full = {
    dayProjection: 'Your heart will beat about 67,200 more times before midnight.',
    keysAvailable: 2,
    streak: 5,
    unvisitedPlace: 'Drift Coffee',
  };

  it('names a subject in every row', () => {
    // Trimming a prefix used to leave "about 67,200 more times before
    // midnight", which reads as a fragment under a "Body ·" label.
    const rows = buildDigest(full)!.split('\n');
    expect(rows[0]).toBe('Body · about 67,200 heartbeats left today');
    for (const row of rows) {
      expect(row).toMatch(/^[A-Z][a-z]+ · \S/);
      expect(row).not.toMatch(/·\s*(about|roughly|around)?\s*[\d,]+ more times/);
    }
  });

  it('rewrites every projection variant it can produce', () => {
    const sentences = [
      'You have roughly 15,360 breaths left in today.',
      'You will blink around 9,600 more times today.',
      'About 4,235 steps are still ahead of you today.',
      'Another 2.6 hours of screen time is the average rest-of-day for you.',
    ];
    for (const dayProjection of sentences) {
      const first = buildDigest({ ...full, dayProjection })!.split('\n')[0];
      // Reshaped, not passed through verbatim.
      expect(first).not.toContain(dayProjection);
      expect(first.endsWith('.')).toBe(false);
    }
  });

  it('omits rows it has nothing true to say for', () => {
    const out = buildDigest({ keysAvailable: 2, streak: 3 })!;
    expect(out.split('\n')).toHaveLength(2);
    expect(out).not.toContain('Saved');
    expect(out).not.toContain('Body');
  });

  it('declines rather than emit a one-row "digest"', () => {
    // A single line is not a digest; the caller falls back to normal copy.
    expect(buildDigest({ keysAvailable: 1 })).toBeNull();
    expect(buildDigest({})).toBeNull();
    expect(buildDigest(undefined)).toBeNull();
  });

  it('says keys have stopped stacking only when they have', () => {
    expect(buildDigest({ ...full, keysAtCap: true })).toContain('no more will stack');
    expect(buildDigest({ ...full, keysAtCap: false })).not.toContain('no more will stack');
  });

  it('stays within four rows', () => {
    expect(buildDigest(full)!.split('\n').length).toBeLessThanOrEqual(4);
  });
});
