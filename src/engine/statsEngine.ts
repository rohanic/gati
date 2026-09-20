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
