/**
 * Life Stats Engine
 * Computes all personal statistics from a UserProfile.
 * Pure functions — no side effects.
 */
import { differenceInDays, differenceInHours, differenceInWeeks } from 'date-fns';
import type { UserProfile, ExerciseFrequency } from '@/types';

// ─── Exercise multiplier ───────────────────────────────────────
const EXERCISE_FACTOR: Record<ExerciseFrequency, number> = {
  regular:   1.30,
  sometimes: 1.00,
  rarely:    0.65,
};

// ─── Output shape ─────────────────────────────────────────────
export interface LifeStatsOutput {
  // Time
  daysAlive:     number;
  hoursAlive:    number;
  ageInYears:    number;   // e.g. 26.4
  ageInMonths:   number;
  ageInWeeks:    number;
  mondaysFaced:  number;
  weekendsLived: number;
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

  // Social
  laughsLaughed: number;
  wordsSpoken:   number;
}

// ─── Main compute function ────────────────────────────────────
export function computeLifeStats(profile: UserProfile): LifeStatsOutput {
  const birth = new Date(profile.dateOfBirth + 'T00:00:00');
  const now   = new Date();

  const daysAlive   = Math.max(1, differenceInDays(now, birth));
  const hoursAlive  = Math.max(24, differenceInHours(now, birth));
  const ageInYears  = daysAlive / 365.25;
  const exFactor    = EXERCISE_FACTOR[profile.exerciseFrequency] ?? 1.0;

  const heartbeats  = Math.floor(daysAlive * 100_800);  // 70 bpm × 1440 min/day
  const breaths     = Math.floor(daysAlive * 23_040);   // 16/min × 1440
  const blinks      = Math.floor(daysAlive * 14_400);   // 10/min × 1440
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
    mondaysFaced:   Math.floor(daysAlive / 7),
    weekendsLived:  Math.floor(daysAlive / 7),
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
    mealsEaten:     Math.floor(daysAlive * 3),
    phoneHours,
    phoneDays:      Math.floor(phoneHours / 24),

    laughsLaughed:  Math.floor(daysAlive * 17),     // ~17 laughs/day avg
    wordsSpoken:    Math.floor(daysAlive * 16_000),  // ~16k words/day avg
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
