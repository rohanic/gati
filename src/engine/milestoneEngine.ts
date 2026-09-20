/**
 * Milestone detection engine.
 * Pure functions — detects life celebration moments and returns
 * any milestones whose conditions have just been met.
 *
 * Each milestone is checked against a snapshot of live stats so
 * the logic has no side-effects and can be safely memoised.
 */
import type { LifeStatsOutput } from './statsEngine';
import type { UserProfile } from '@/types';
import { colors } from '@/theme';

// ─── Parameter bag ────────────────────────────────────────────
export interface MilestoneCheckParams {
  profile:       UserProfile;
  lifeStats:     LifeStatsOutput;
  streak:        number;       // consecutive daily app opens
  appDayIndex:   number;       // days since first joining Gati (0-based)
  totalUnlocked: number;       // stat definitions seen at least once
}

// ─── Milestone definition ─────────────────────────────────────
export interface MilestoneDef {
  id:          string;
  title:       string;         // shown in typewriter animation
  subtitle:    string;         // shown after typewriter finishes
  icon:        string;         // Ionicons name (filled)
  iconColor:   string;
  iconBg:      string;
  checkFn:     (p: MilestoneCheckParams) => boolean;
  shareText:   string;         // native share sheet message
}

// ─── Catalogue ────────────────────────────────────────────────
export const MILESTONE_DEFINITIONS: MilestoneDef[] = [

  // ── Streak ──────────────────────────────────────────────────
  {
    id:        'streak_7',
    title:     'One full week',
    subtitle:  "Seven days in a row. Most habits don't make it this far. Yours did.",
    icon:      'flame',
    iconColor: colors.gold,
    iconBg:    colors.goldBg,
    checkFn:   (p) => p.streak >= 7,
    shareText: "7 days in a row with Gati. I haven't missed one.",
  },
  {
    id:        'streak_14',
    title:     'Two weeks straight',
    subtitle:  "Fourteen consecutive days. Your brain has started to expect this. That's not discipline. That's a habit forming.",
    icon:      'flame',
    iconColor: colors.gold,
    iconBg:    colors.goldBg,
    checkFn:   (p) => p.streak >= 14,
    shareText: "14 days in a row with Gati. Streak is real.",
  },
  {
    id:        'streak_30',
    title:     '30-day streak',
    subtitle:  "Thirty consecutive mornings. You've turned a daily choice into a ritual.",
    icon:      'flame',
    iconColor: colors.gold,
    iconBg:    colors.goldBg,
    checkFn:   (p) => p.streak >= 30,
    shareText: "30 days in a row with Gati. That's a real habit.",
  },
  {
    id:        'streak_100',
    title:     '100-day streak',
    subtitle:  "A hundred consecutive days. Most people don't know what that feels like. Now you do.",
    icon:      'star',
    iconColor: colors.gold,
    iconBg:    colors.goldBg,
    checkFn:   (p) => p.streak >= 100,
    shareText: "100 days in a row with Gati. I haven't missed a single one.",
  },
  {
    id:        'streak_365',
    title:     'One full year',
    subtitle:  "Three hundred and sixty-five days. Not one missed. That's not a habit anymore. That's who you are.",
    icon:      'ribbon',
    iconColor: colors.gold,
    iconBg:    colors.goldBg,
    checkFn:   (p) => p.streak >= 365,
    shareText: "365 consecutive days with Gati. A full year, not one skipped.",
  },

  // ── Days alive ───────────────────────────────────────────────
  {
    id:        'days_5k',
    title:     '5,000 days alive',
    subtitle:  "Five thousand mornings you've woken up and started again. Not a single one was guaranteed.",
    icon:      'sunny',
    iconColor: '#E8A020',
    iconBg:    '#FFF8E7',
    checkFn:   (p) => p.lifeStats.daysAlive >= 5_000,
    shareText: "I've been alive for 5,000 days. That number is bigger than it sounds.",
  },
  {
    id:        'days_10k',
    title:     '10,000 days alive',
    subtitle:  "Ten thousand sunrises. Each one a day you filled with something: work, love, rest, or just showing up.",
    icon:      'sunny',
    iconColor: '#E8A020',
    iconBg:    '#FFF8E7',
    checkFn:   (p) => p.lifeStats.daysAlive >= 10_000,
    shareText: "I've been alive for 10,000 days. My life, counted, with Gati.",
  },
  {
    id:        'days_15k',
    title:     '15,000 days alive',
    subtitle:  "Fifteen thousand days. You've lived through enough seasons to know that the hard ones pass.",
    icon:      'sunny',
    iconColor: '#E8A020',
    iconBg:    '#FFF8E7',
    checkFn:   (p) => p.lifeStats.daysAlive >= 15_000,
    shareText: "15,000 days alive. Counting them changes how you see them.",
  },

  // ── Body ─────────────────────────────────────────────────────
  {
    id:        'heartbeats_1bn',
    title:     '1 billion heartbeats',
    subtitle:  "One billion times, without a single break, without a single complaint. No machine ever built has done what your heart has.",
    icon:      'heart',
    iconColor: '#D94F4F',
    iconBg:    '#FFF0F0',
    checkFn:   (p) => p.lifeStats.heartbeats >= 1_000_000_000,
    shareText: "My heart has beaten over a billion times. Without a single pause.",
  },
  {
    id:        'heartbeats_2bn',
    title:     '2 billion heartbeats',
    subtitle:  "Two billion. Not one missed. The quiet, tireless work of being alive, carried out perfectly.",
    icon:      'heart',
    iconColor: '#D94F4F',
    iconBg:    '#FFF0F0',
    checkFn:   (p) => p.lifeStats.heartbeats >= 2_000_000_000,
    shareText: "Two billion heartbeats and still going. My life, in numbers.",
  },
  {
    id:        'steps_1m',
    title:     'One million steps',
    subtitle:  "A million individual moments of movement. Each one carried you somewhere: forward, through, or simply on.",
    icon:      'walk',
    iconColor: colors.green700,
    iconBg:    colors.green50,
    checkFn:   (p) => p.lifeStats.stepsWalked >= 1_000_000,
    shareText: "I've taken over a million steps in my lifetime. My life, in numbers.",
  },

  // ── Habits ───────────────────────────────────────────────────
  {
    id:        'coffee_1k',
    title:     '1,000 cups of coffee',
    subtitle:  "A thousand mornings that began the same way. Some rituals become inseparable from who you are.",
    icon:      'cafe',
    iconColor: colors.gold,
    iconBg:    colors.goldBg,
    checkFn:   (p) => p.lifeStats.coffeeCups >= 1_000,
    shareText: "1,000 cups of coffee and counting. My life, in numbers.",
  },

  // ── App engagement ───────────────────────────────────────────
  {
    id:        'app_first_week',
    title:     'One week with Gati',
    subtitle:  "Seven days, seven numbers. You've already seen things about yourself most people never think to count.",
    icon:      'calendar',
    iconColor: colors.green700,
    iconBg:    colors.green50,
    checkFn:   (p) => p.appDayIndex >= 7,
    shareText: "One week of discovering my life stats with Gati.",
  },
  {
    id:        'stats_5',
    title:     '5 stats discovered',
    subtitle:  "Five numbers you didn't know about yourself last week. You can't unsee them now.",
    icon:      'stats-chart',
    iconColor: colors.green700,
    iconBg:    colors.green50,
    checkFn:   (p) => p.totalUnlocked >= 5,
    shareText: "5 life stats discovered with Gati. My life, by the numbers.",
  },
  {
    id:        'stats_10',
    title:     'Halfway there',
    subtitle:  "Ten of twenty-five stats unlocked. The ones still ahead will hit differently. You'll see.",
    icon:      'stats-chart',
    iconColor: colors.green700,
    iconBg:    colors.green50,
    checkFn:   (p) => p.totalUnlocked >= 10,
    shareText: "Ten of my 25 life stats discovered. My life, in numbers.",
  },
  {
    id:        'stats_all',
    title:     'Every number, unlocked',
    subtitle:  "Twenty-five stats. You've seen the full picture of yourself, in digits. Some of them you'll carry with you.",
    icon:      'trophy',
    iconColor: colors.gold,
    iconBg:    colors.goldBg,
    checkFn:   (p) => p.totalUnlocked >= 25,
    shareText: "I've discovered all 25 life stats. My life, in numbers.",
  },

  // ── App anniversary ──────────────────────────────────────────
  {
    id:        'app_anniversary_1yr',
    title:     'One year with Gati',
    subtitle:  "Three hundred and sixty-five days of numbers. You know yourself a little differently now than when you started.",
    icon:      'heart',
    iconColor: colors.green700,
    iconBg:    colors.green50,
    checkFn:   (p) => p.appDayIndex >= 365,
    shareText: "One year exploring my life with Gati. My numbers, my story.",
  },
];

// ─── Check helper ─────────────────────────────────────────────
/** Returns all milestones whose condition is currently met. */
export function checkMilestones(params: MilestoneCheckParams): MilestoneDef[] {
  return MILESTONE_DEFINITIONS.filter((m) => m.checkFn(params));
}

// ─── Milestone prediction ──────────────────────────────────────

export interface MilestonePrediction {
  milestoneId:    string;
  milestoneTitle: string;
  /** Days from today until this milestone is reached. ≥ 1. */
  daysUntil:      number;
}

/**
 * Returns the single closest upcoming milestone that will trigger within
 * `lookaheadDays` days (default 7), or null if nothing is imminent.
 *
 * Only checks deterministic (time-/habit-based) milestones — streak milestones
 * are intentionally excluded because they depend on daily app opens and are
 * already surfaced by the in-app NextMilestoneHint widget.
 *
 * Categories checked:
 *   - daysAlive  → days_5k / days_10k / days_15k
 *   - heartbeats → heartbeats_1bn / heartbeats_2bn
 *   - coffeeCups → coffee_1k  (requires profile.coffeeCupsPerDay > 0)
 *   - steps      → steps_1m   (only if Health is syncing; stepsWalked is non-zero)
 */
export function getUpcomingMilestonePrediction(
  params:       MilestoneCheckParams,
  lookaheadDays = 7,
): MilestonePrediction | null {
  const { lifeStats, profile } = params;
  const candidates: MilestonePrediction[] = [];

  // ── Days alive ─────────────────────────────────────────────
  for (const [id, threshold, title] of [
    ['days_5k',  5_000,  '5,000 days alive'] as const,
    ['days_10k', 10_000, '10,000 days alive'] as const,
    ['days_15k', 15_000, '15,000 days alive'] as const,
  ]) {
    if (lifeStats.daysAlive >= threshold) continue; // already passed
    const daysUntil = threshold - lifeStats.daysAlive;
    if (daysUntil >= 1 && daysUntil <= lookaheadDays) {
      candidates.push({ milestoneId: id, milestoneTitle: title, daysUntil });
    }
    break; // only the next upcoming one in this category
  }

  // ── Heartbeats (≈ 70 bpm × 60 min × 24 h = 100,800 /day) ─
  const HB_PER_DAY = 70 * 60 * 24;
  for (const [id, threshold, title] of [
    ['heartbeats_1bn', 1_000_000_000, '1 billion heartbeats'] as const,
    ['heartbeats_2bn', 2_000_000_000, '2 billion heartbeats'] as const,
  ]) {
    if (lifeStats.heartbeats >= threshold) continue;
    const daysUntil = Math.ceil((threshold - lifeStats.heartbeats) / HB_PER_DAY);
    if (daysUntil >= 1 && daysUntil <= lookaheadDays) {
      candidates.push({ milestoneId: id, milestoneTitle: title, daysUntil });
    }
    break;
  }

  // ── Coffee ─────────────────────────────────────────────────
  const cupsPerDay = profile.coffeeCupsPerDay;
  if (
    lifeStats.coffeeCups < 1_000 &&
    cupsPerDay != null &&
    cupsPerDay > 0
  ) {
    const daysUntil = Math.ceil((1_000 - lifeStats.coffeeCups) / cupsPerDay);
    if (daysUntil >= 1 && daysUntil <= lookaheadDays) {
      candidates.push({ milestoneId: 'coffee_1k', milestoneTitle: '1,000 cups of coffee', daysUntil });
    }
  }

  // ── Steps ──────────────────────────────────────────────────
  // Derived from the same model the stats engine uses (8,000 steps/day scaled
  // by the exercise answer). This branch previously read
  // `(profile as any).stepsPerDay`, a field that does not exist on
  // UserProfile, so it was unreachable and the milestone never predicted.
  if (lifeStats.stepsWalked > 0 && lifeStats.stepsWalked < 1_000_000) {
    const stepsPerDay = lifeStats.daysAlive > 0
      ? lifeStats.stepsWalked / lifeStats.daysAlive
      : 0;
    if (stepsPerDay > 0) {
      const daysUntil = Math.ceil((1_000_000 - lifeStats.stepsWalked) / stepsPerDay);
      if (daysUntil >= 1 && daysUntil <= lookaheadDays) {
        candidates.push({
          milestoneId: 'steps_1m',
          milestoneTitle: 'one million steps',
          daysUntil,
        });
      }
    }
  }

  if (candidates.length === 0) return null;
  // Return the closest one
  return candidates.sort((a, b) => a.daysUntil - b.daysUntil)[0];
}
