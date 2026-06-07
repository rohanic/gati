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
  {
    id:         'streak_30',
    title:      '30-day streak',
    subtitle:   "You've opened Gati every day for a month. That's a real habit.",
    icon:       'flame',
    iconColor:  colors.gold,
    iconBg:     colors.goldBg,
    checkFn:    (p) => p.streak >= 30,
    shareText:  '30 days in a row with Gati. My life, in numbers.',
  },
  {
    id:         'streak_100',
    title:      '100-day streak',
    subtitle:   'A hundred consecutive mornings. You have made this part of your day.',
    icon:       'star',
    iconColor:  colors.gold,
    iconBg:     colors.goldBg,
    checkFn:    (p) => p.streak >= 100,
    shareText:  '100 days in a row with Gati. My life, in numbers.',
  },
  {
    id:         'streak_365',
    title:      'One full year of streaks',
    subtitle:   '365 days without missing a single one. Remarkable.',
    icon:       'ribbon',
    iconColor:  colors.gold,
    iconBg:     colors.goldBg,
    checkFn:    (p) => p.streak >= 365,
    shareText:  '365 consecutive days with Gati. My life, in numbers.',
  },
  {
    id:         'days_10k',
    title:      '10,000 days alive',
    subtitle:   "Ten thousand sunrises. Every single one was yours.",
    icon:       'sunny',
    iconColor:  '#E8A020',
    iconBg:     '#FFF8E7',
    checkFn:    (p) => p.lifeStats.daysAlive >= 10_000,
    shareText:  "I have been alive for 10,000 days. My life, in numbers — Gati.",
  },
  {
    id:         'app_anniversary_1yr',
    title:      '1 year with Gati',
    subtitle:   'One full year of discovering your numbers. Thank you for being here.',
    icon:       'heart',
    iconColor:  colors.green700,
    iconBg:     colors.green50,
    checkFn:    (p) => p.appDayIndex >= 365,
    shareText:  'One year exploring my life with Gati. My life, in numbers.',
  },
  {
    id:         'stats_all',
    title:      'Every stat unlocked',
    subtitle:   "You have seen every number in your life. Some left you speechless.",
    icon:       'trophy',
    iconColor:  colors.gold,
    iconBg:     colors.goldBg,
    checkFn:    (p) => p.totalUnlocked >= 22,
    shareText:  'I have discovered all 22 life stats in Gati. My life, in numbers.',
  },
];

// ─── Check helper ─────────────────────────────────────────────
/** Returns all milestones whose condition is currently met. */
export function checkMilestones(params: MilestoneCheckParams): MilestoneDef[] {
  return MILESTONE_DEFINITIONS.filter((m) => m.checkFn(params));
}
