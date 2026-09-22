/**
 * Life Stats Engine
 * Computes all personal statistics from a UserProfile.
 * Pure functions — no side effects.
 */
import { differenceInDays, differenceInHours, differenceInWeeks } from 'date-fns';
import type { UserProfile, ExerciseFrequency, TalkLevel } from '@/types';

// ─── Exercise multiplier ───────────────────────────────────────
const EXERCISE_FACTOR: Record<ExerciseFrequency, number> = {
  regular:   1.30,
  sometimes: 1.00,
  rarely:    0.65,
};

// ─── Talk level: words per day + laughs per day ───────────────
const TALK_WORDS: Record<TalkLevel, number> = {
  quiet:    8_000,
  balanced: 16_000,
  chatty:   25_000,
};
const TALK_LAUGHS: Record<TalkLevel, number> = {
  quiet:    10,
  balanced: 17,
  chatty:   26,
};

// ─── Output shape ─────────────────────────────────────────────
export interface LifeStatsOutput {
  // Time
  daysAlive:     number;
  hoursAlive:    number;
  ageInYears:    number;   // e.g. 26.4
  ageInMonths:   number;
  ageInWeeks:    number;
  seasonsLived:  number;   // daysAlive / 91.3  (replaces mondaysFaced)
  fullMoons:     number;   // daysAlive / 29.53 (replaces weekendsLived)
  percentOf80:   number;   // 0–100, one decimal

  // Body
  heartbeats:    number;
  breaths:       number;
  blinks:        number;
  stepsWalked:   number;
  sleepHours:    number;
  sleepDays:     number;
  bloodPumped:   number;   // litres

  // Habits
  coffeeCups:    number;
  coffeeVolumeMl:number;
  mealsEaten:    number;
  phoneHours:    number;
  phoneDays:     number;
  musicHours:    number;
  musicDays:     number;

  // Body (hydration)
  waterGlasses:  number;
  waterLitres:   number;

  // Time (commute)
  commuteHours:  number;
  commuteDays:   number;

  // Social
  laughsLaughed: number;
  wordsSpoken:   number;
}

// ─── Main compute function ────────────────────────────────────
export function computeLifeStats(profile: UserProfile): LifeStatsOutput {
  const birth = new Date(profile.dateOfBirth + 'T00:00:00');
  const now   = new Date();

  const daysAlive    = Math.max(1, differenceInDays(now, birth));
  const hoursAlive   = Math.max(24, differenceInHours(now, birth));
  const ageInYears   = daysAlive / 365.25;
  const exFactor     = EXERCISE_FACTOR[profile.exerciseFrequency] ?? 1.0;
  // Sub-day precision for live-ticking stats (heartbeats, breaths, blinks)
  const minutesAlive = Math.max(1440, (now.getTime() - birth.getTime()) / 60_000);

  // New profile fields — backward-compat defaults
  const mealsPerDay    = profile.mealsPerDay          ?? 3;
  const talkLevel      = profile.talkLevel            ?? 'balanced';
  const waterPerDay    = profile.waterGlassesPerDay   ?? 6;
  const musicPerDay    = profile.musicHoursPerDay     ?? 2;
  const commutePerDay  = profile.commuteMinutesPerDay ?? 30;

  // Use minutesAlive so the numbers tick every minute (not once per day)
  const heartbeats  = Math.floor(minutesAlive * 70);    // 70 bpm
  const breaths     = Math.floor(minutesAlive * 16);    // 16 brpm
  const blinks      = Math.floor(minutesAlive * 10);    // ~10/min
  const sleepHours  = Math.floor(daysAlive * profile.sleepHoursPerNight);
  const phoneHours  = Math.floor(daysAlive * profile.phoneHoursPerDay);
  const coffeeCups  = Math.floor(daysAlive * profile.coffeeCupsPerDay);
  const stepsWalked = Math.floor(daysAlive * 8_000 * exFactor);

  return {
    daysAlive,
    hoursAlive,
    ageInYears:     Math.floor(ageInYears * 10) / 10,
    ageInMonths:    Math.floor(ageInYears * 12),
    ageInWeeks:     differenceInWeeks(now, birth),
    seasonsLived:   Math.floor(daysAlive / 91.3125),  // 365.25 / 4
    fullMoons:      Math.floor(daysAlive / 29.53059), // synodic month
    percentOf80:    Math.min(100, Math.round((ageInYears / 80) * 1_000) / 10),

    heartbeats,
    breaths,
    blinks,
    stepsWalked,
    sleepHours,
    sleepDays:      Math.floor(sleepHours / 24),
    bloodPumped:    Math.floor(heartbeats * 0.07),  // ~70mL per beat → litres

    coffeeCups,
    coffeeVolumeMl: Math.floor(coffeeCups * 240),   // ~240mL per cup
    mealsEaten:     Math.floor(daysAlive * mealsPerDay),
    phoneHours,
    phoneDays:      Math.floor(phoneHours / 24),
    // Honest baselines: music listening from ~age 10, commuting from ~age 18
    musicHours:     Math.floor(Math.max(0, daysAlive - 10 * 365.25) * musicPerDay),
    musicDays:      Math.floor((Math.max(0, daysAlive - 10 * 365.25) * musicPerDay) / 24),

    waterGlasses:   Math.floor(daysAlive * waterPerDay),
    waterLitres:    Math.floor(daysAlive * waterPerDay * 0.25),   // ~250mL per glass

    commuteHours:   Math.floor((Math.max(0, daysAlive - 18 * 365.25) * commutePerDay) / 60),
    commuteDays:    Math.floor((Math.max(0, daysAlive - 18 * 365.25) * commutePerDay) / 60 / 24),

    laughsLaughed:  Math.floor(daysAlive * TALK_LAUGHS[talkLevel]),
    wordsSpoken:    Math.floor(daysAlive * TALK_WORDS[talkLevel]),
  };
}

// ─── Number formatters ────────────────────────────────────────
export function formatStatNumber(value: number, precision: number): string {
  if (precision > 0) return value.toFixed(precision);
  return Math.floor(value).toLocaleString('en-US');
}

/** Compact format for share cards and small displays */
export function formatStatCompact(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000)     return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000)        return `${(value / 1_000).toFixed(0)}K`;
  return Math.floor(value).toLocaleString('en-US');
}

// ─── Rest-of-day projection ───────────────────────────────────
/**
 * What is still going to happen to this person before midnight.
 *
 * ── Why this exists, and why it is not weather ───────────────
 * The obvious way to make a notification feel current is to reach for
 * outside context — local weather, what is on in their city. All of it
 * requires sending the user's location to a server and keeping it there,
 * which would contradict the Data Safety declaration this app ships with
 * ("approximate location, processed ephemerally, never stored against a
 * user") and turn a one-line copy change into a privacy-policy change.
 *
 * The user's own body is a better source and costs nothing. Everything
 * below is computed on the device from the profile they already gave during
 * onboarding — no permission, no network, no new data leaving the phone —
 * and it is strictly more personal than a temperature.
 *
 * Computed from a fixed hour rather than "now" on purpose: local
 * notifications bake their text at SCHEDULING time and fire hours or days
 * later, so a projection measured from the moment of scheduling would be
 * wrong every time it actually appeared. Measuring from the delivery hour
 * makes the sentence true whenever it fires.
 *
 * @param fromHour  Local hour the line will be read at, 0–23.
 * @returns A complete sentence, or null when too little of the day is left
 *   for any figure to be interesting.
 */
export function projectRestOfDay(
  profile: UserProfile,
  fromHour: number,
  variant = 0,
): string | null {
  if (!Number.isFinite(fromHour) || fromHour < 0 || fromHour > 23) return null;
  const hoursLeft = 24 - fromHour;
  // Under two hours there is nothing left worth projecting, and the figures
  // stop sounding impressive.
  if (hoursLeft < 2) return null;

  const minutesLeft = hoursLeft * 60;
  const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

  // Waking hours only, for anything the body does while up and about.
  const sleepHours  = profile.sleepHoursPerNight ?? 8;
  const awakeLeft   = Math.max(0, hoursLeft - sleepHours);
  const exFactor    = EXERCISE_FACTOR[profile.exerciseFrequency] ?? 1;
  const wakingHours = Math.max(1, 24 - sleepHours);

  const options: string[] = [
    `Your heart will beat about ${fmt(minutesLeft * 70)} more times before midnight.`,
    `You have roughly ${fmt(minutesLeft * 16)} breaths left in today.`,
    `You will blink around ${fmt(minutesLeft * 10)} more times today.`,
  ];

  if (awakeLeft > 1) {
    options.push(
      `About ${fmt((awakeLeft / wakingHours) * 8_000 * exFactor)} steps are still ahead of you today.`,
    );
    const phoneHours = profile.phoneHoursPerDay ?? 4;
    const phoneLeft  = (awakeLeft / wakingHours) * phoneHours;
    if (phoneLeft >= 0.5) {
      options.push(
        `Another ${phoneLeft.toFixed(1)} hours of screen time is the average rest-of-day for you.`,
      );
    }
  }

  return options[Math.abs(Math.trunc(variant)) % options.length];
}

// ─── Where today sits ─────────────────────────────────────────
export interface DayContext {
  /** 1-based day of the calendar year. */
  dayOfYear:    number;
  /** 365, or 366 in a leap year. */
  daysInYear:   number;
  /** Days remaining after today. */
  daysLeft:     number;
  /** 0–100, one decimal. */
  percentOfYear: number;
  /** IANA zone as the device reports it, e.g. "Asia/Kolkata". */
  timeZone:     string;
  /** The city portion of the zone, e.g. "Kolkata". Null when unavailable. */
  place:        string | null;
}

/**
 * Where the user is, and how far through the year they are.
 *
 * Deliberately built from the device's own clock and IANA zone rather than
 * from location. It needs no permission, no network and no stored
 * coordinate, so it costs nothing against the Data Safety declaration —
 * and for an app about counting, "day 266 of 366" is more on-topic than a
 * temperature would be.
 *
 * Reads the zone defensively: `resolvedOptions().timeZone` is specified but
 * has returned undefined on some Android builds, and a crash on the home
 * screen is a poor trade for a subtitle.
 */
export function getDayContext(now: Date = new Date()): DayContext {
  const year       = now.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const isLeap     = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInYear = isLeap ? 366 : 365;

  // Compare calendar days, not elapsed ms — a DST shift inside the year
  // would otherwise move the boundary by an hour and round the wrong way.
  const startDay = Date.UTC(year, 0, 1);
  const today    = Date.UTC(year, now.getMonth(), now.getDate());
  const dayOfYear = Math.floor((today - startDay) / 86_400_000) + 1;

  let timeZone = 'UTC';
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    // Keep the default.
  }
  const tail  = timeZone.split('/').pop() ?? '';
  const place = tail && tail !== timeZone ? tail.replace(/_/g, ' ') : null;

  return {
    dayOfYear,
    daysInYear,
    daysLeft:      Math.max(0, daysInYear - dayOfYear),
    percentOfYear: Math.round((dayOfYear / daysInYear) * 1000) / 10,
    timeZone,
    place,
  };
}
