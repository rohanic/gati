/**
 * Life stats engine.
 *
 * Every number the app shows comes from here, and a wrong figure is the most
 * visible possible bug in a product whose entire premise is "these numbers are
 * true". None of it was covered before.
 */
import {
  computeLifeStats,
  formatStatNumber,
  formatStatCompact,
} from '@/engine/statsEngine';
import { STAT_DEFINITIONS } from '@/data/statDefinitions';
import type { UserProfile } from '@/types';

const baseProfile: UserProfile = {
  firstName:            'Test',
  dateOfBirth:          '1996-01-01',
  sleepHoursPerNight:   8,
  coffeeCupsPerDay:     2,
  phoneHoursPerDay:     4,
  exerciseFrequency:    'sometimes',
  mealsPerDay:          3,
  talkLevel:            'balanced',
  waterGlassesPerDay:   6,
  musicHoursPerDay:     2,
  commuteMinutesPerDay: 30,
  interestCategories:   ['cafe'],
  notificationTime:     '08:00',
  isPro:                false,
  appJoinDate:          '2026-01-01',
};

// Freeze the clock so every derived figure is deterministic.
beforeAll(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-06-15T12:00:00Z'));
});
afterAll(() => {
  jest.useRealTimers();
});

describe('computeLifeStats', () => {
  it('computes days alive from the date of birth', () => {
    const stats = computeLifeStats(baseProfile);
    // 1996-01-01 → 2026-06-15 is 30 years and change.
    expect(stats.daysAlive).toBeGreaterThan(11_100);
    expect(stats.daysAlive).toBeLessThan(11_200);
  });

  it('keeps age in years consistent with days alive', () => {
    const stats = computeLifeStats(baseProfile);
    expect(stats.ageInYears).toBeCloseTo(stats.daysAlive / 365.25, 0);
  });

  it('scales habit stats by the user’s own answers', () => {
    const stats = computeLifeStats(baseProfile);
    expect(stats.coffeeCups).toBe(Math.floor(stats.daysAlive * 2));
    expect(stats.mealsEaten).toBe(Math.floor(stats.daysAlive * 3));
    expect(stats.sleepHours).toBe(Math.floor(stats.daysAlive * 8));
  });

  it('applies the exercise multiplier to steps', () => {
    const sedentary = computeLifeStats({ ...baseProfile, exerciseFrequency: 'rarely' });
    const moderate  = computeLifeStats({ ...baseProfile, exerciseFrequency: 'sometimes' });
    const active    = computeLifeStats({ ...baseProfile, exerciseFrequency: 'regular' });

    expect(sedentary.stepsWalked).toBeLessThan(moderate.stepsWalked);
    expect(moderate.stepsWalked).toBeLessThan(active.stepsWalked);
  });

  it('never produces a negative or NaN value', () => {
    const stats = computeLifeStats(baseProfile);
    for (const [key, value] of Object.entries(stats)) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(`${key}:${value}`).not.toContain('NaN');
    }
  });

  it('clamps a newborn to at least one day rather than dividing by zero', () => {
    const today = new Date().toISOString().slice(0, 10);
    const stats = computeLifeStats({ ...baseProfile, dateOfBirth: today });
    expect(stats.daysAlive).toBe(1);
    expect(stats.heartbeats).toBeGreaterThan(0);
    expect(Number.isFinite(stats.percentOf80)).toBe(true);
  });

  /**
   * Music listening is credited from ~age 10 and commuting from ~18, so a
   * child must not be told they have commuted for years.
   */
  it('does not credit a young child with music or commute hours', () => {
    const stats = computeLifeStats({ ...baseProfile, dateOfBirth: '2024-01-01' });
    expect(stats.musicHours).toBe(0);
    expect(stats.commuteHours).toBe(0);
  });

  it('credits an adult with both', () => {
    const stats = computeLifeStats(baseProfile);
    expect(stats.musicHours).toBeGreaterThan(0);
    expect(stats.commuteHours).toBeGreaterThan(0);
  });

  it('falls back to sane defaults for optional profile fields', () => {
    const sparse = { ...baseProfile };
    delete (sparse as Partial<UserProfile>).waterGlassesPerDay;
    delete (sparse as Partial<UserProfile>).musicHoursPerDay;
    delete (sparse as Partial<UserProfile>).commuteMinutesPerDay;

    const stats = computeLifeStats(sparse);
    expect(stats.waterGlasses).toBeGreaterThan(0);
    expect(Number.isFinite(stats.musicHours)).toBe(true);
  });

  it('varies words and laughs with talkativeness', () => {
    const quiet  = computeLifeStats({ ...baseProfile, talkLevel: 'quiet' });
    const chatty = computeLifeStats({ ...baseProfile, talkLevel: 'chatty' });
    expect(chatty.wordsSpoken).toBeGreaterThan(quiet.wordsSpoken);
    expect(chatty.laughsLaughed).toBeGreaterThan(quiet.laughsLaughed);
  });

  it('caps percentOf80 at 100 for someone over 80', () => {
    const stats = computeLifeStats({ ...baseProfile, dateOfBirth: '1900-01-01' });
    expect(stats.percentOf80).toBe(100);
  });

  it('keeps day-derived stats stable within the same day', () => {
    const a = computeLifeStats(baseProfile);
    const b = computeLifeStats(baseProfile);
    expect(a.daysAlive).toBe(b.daysAlive);
    expect(a.coffeeCups).toBe(b.coffeeCups);
  });
});

/**
 * Every stat definition must map to a real key on the engine output —
 * otherwise a card silently renders 0.
 */
describe('stat definitions ↔ engine contract', () => {
  it('resolves every formulaKey to a finite number', () => {
    const stats = computeLifeStats(baseProfile) as unknown as Record<string, number>;
    for (const def of STAT_DEFINITIONS) {
      const value = stats[def.formulaKey];
      expect(
        typeof value === 'number' && Number.isFinite(value),
      ).toBe(true);
    }
  });
});

describe('formatters', () => {
  it('groups whole numbers with separators', () => {
    expect(formatStatNumber(1234567, 0)).toBe('1,234,567');
  });

  it('honours the requested precision', () => {
    expect(formatStatNumber(26.44, 1)).toBe('26.4');
    expect(formatStatNumber(26.46, 1)).toBe('26.5');
  });

  it('compacts large numbers for share cards', () => {
    expect(formatStatCompact(1_500_000_000)).toBe('1.5B');
    expect(formatStatCompact(2_400_000)).toBe('2.4M');
    expect(formatStatCompact(15_000)).toBe('15K');
  });

  it('leaves small numbers readable', () => {
    expect(formatStatCompact(999)).toBe('999');
    expect(formatStatCompact(9_999)).toBe('9,999');
  });
});
