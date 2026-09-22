/**
 * Rest-of-day projection.
 *
 * This is the app's answer to "make the notification feel current" WITHOUT
 * reaching for location or weather. Everything it says must therefore be
 * true from the profile alone, and true at the hour it is read — not at the
 * hour it was scheduled.
 */
import { projectRestOfDay, getDayContext } from '@/engine/statsEngine';
import type { UserProfile } from '@/types';

const profile: UserProfile = {
  firstName: 'Rohan',
  dateOfBirth: '1995-03-02',
  sleepHoursPerNight: 7,
  coffeeCupsPerDay: 2,
  phoneHoursPerDay: 5,
  exerciseFrequency: 'sometimes',
  mealsPerDay: 3,
  talkLevel: 'balanced',
  interestCategories: [],
  notificationTime: '09:00',
  isPro: false,
  appJoinDate: '2026-09-01',
};

describe('projectRestOfDay', () => {
  it('shrinks as the day runs out', () => {
    // The figure quoted at 9am must be larger than the one at 8pm, or the
    // sentence is lying to whoever reads it in the evening.
    const num = (s: string | null) =>
      Number((s ?? '').replace(/,/g, '').match(/\d+/)?.[0] ?? 0);
    expect(num(projectRestOfDay(profile, 9, 0)))
      .toBeGreaterThan(num(projectRestOfDay(profile, 20, 0)));
  });

  it('says nothing when the day is nearly over', () => {
    // The cutoff is two hours left. Below that the figures stop being worth
    // an interruption — "about 4,200 more heartbeats" is not a reason to
    // pick up your phone — and the caller falls back to other copy.
    expect(projectRestOfDay(profile, 23)).toBeNull();   // 1h left
    expect(projectRestOfDay(profile, 22)).not.toBeNull(); // 2h left, still fine
  });

  it('gives a whole sentence, not a fragment', () => {
    for (let v = 0; v < 6; v++) {
      const line = projectRestOfDay(profile, 9, v);
      expect(line).not.toBeNull();
      expect(line!.endsWith('.')).toBe(true);
      expect(line!.length).toBeLessThan(120);   // fits a notification line
    }
  });

  it('rotates so consecutive days do not repeat', () => {
    const lines = new Set([0, 1, 2].map((v) => projectRestOfDay(profile, 9, v)));
    expect(lines.size).toBeGreaterThan(1);
  });

  it('never projects more waking activity than the day can hold', () => {
    // A long sleeper at 9pm has no waking hours left; a steps line claiming
    // otherwise would be plainly wrong.
    const sleepy = { ...profile, sleepHoursPerNight: 10 };
    for (let v = 0; v < 6; v++) {
      const line = projectRestOfDay(sleepy, 21, v) ?? '';
      expect(line).not.toMatch(/steps are still ahead/);
    }
  });

  it('reflects the profile it was given', () => {
    const heavy = { ...profile, exerciseFrequency: 'regular' as const };
    const light = { ...profile, exerciseFrequency: 'rarely'  as const };
    const steps = (p: UserProfile) =>
      Number((projectRestOfDay(p, 9, 3) ?? '').replace(/,/g, '').match(/\d+/)?.[0] ?? 0);
    expect(steps(heavy)).toBeGreaterThan(steps(light));
  });

  it('rejects an out-of-range hour instead of inventing a figure', () => {
    for (const h of [-1, 24, 99, NaN]) expect(projectRestOfDay(profile, h)).toBeNull();
  });
});

/**
 * Day context — the Today screen's local card.
 *
 * Built from the device clock and IANA zone rather than location, so the
 * thing to guard is the arithmetic and the defensive read of the zone.
 */
describe('getDayContext', () => {
  it('counts the day of the year from 1, not 0', () => {
    expect(getDayContext(new Date(2026, 0, 1)).dayOfYear).toBe(1);
    expect(getDayContext(new Date(2026, 11, 31)).dayOfYear).toBe(365);
  });

  it('knows a leap year has an extra day', () => {
    expect(getDayContext(new Date(2028, 0, 1)).daysInYear).toBe(366);
    expect(getDayContext(new Date(2026, 0, 1)).daysInYear).toBe(365);
    // 2100 is divisible by 4 but not a leap year.
    expect(getDayContext(new Date(2100, 0, 1)).daysInYear).toBe(365);
    expect(getDayContext(new Date(2000, 0, 1)).daysInYear).toBe(366);
  });

  it('leaves no days after 31 December', () => {
    expect(getDayContext(new Date(2026, 11, 31)).daysLeft).toBe(0);
    expect(getDayContext(new Date(2028, 11, 31)).daysLeft).toBe(0);
  });

  it('spans 0 to 100 percent across the year', () => {
    expect(getDayContext(new Date(2026, 11, 31)).percentOfYear).toBe(100);
    const mid = getDayContext(new Date(2026, 5, 15)).percentOfYear;
    expect(mid).toBeGreaterThan(40);
    expect(mid).toBeLessThan(60);
  });

  it('counts calendar days, so a DST shift cannot round it wrong', () => {
    // Late-March dates either side of a European DST change must be
    // consecutive, not 0.96 of a day apart.
    const before = getDayContext(new Date(2026, 2, 28)).dayOfYear;
    const after  = getDayContext(new Date(2026, 2, 29)).dayOfYear;
    expect(after - before).toBe(1);
  });

  it('always yields a usable zone', () => {
    const ctx = getDayContext();
    expect(typeof ctx.timeZone).toBe('string');
    expect(ctx.timeZone.length).toBeGreaterThan(0);
    // `place` is optional, but when present it must be display-ready.
    if (ctx.place !== null) expect(ctx.place).not.toContain('_');
  });
});
