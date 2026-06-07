/**
 * All stat definitions.
 * formulaKey maps directly to a key in LifeStatsOutput.
 * whatIfKeys reference entries in WHAT_IF_SCENARIOS below.
 */
import type { StatDefinition } from '@/types';
import type { LifeStatsOutput } from '@/engine/statsEngine';
import type { UserProfile } from '@/types';

// ─── Extended definition ───────────────────────────────────────
export interface StatDef extends StatDefinition {
  whatIfKeys?:  string[];
  contextFact?: string;   // Interesting fact shown on the detail screen
}

// ─── What-If scenario registry ─────────────────────────────────
export interface WhatIfResult {
  delta:       number;
  unit:        string;
  description: string; // "sleeping 30 more minutes each night"
}

export type WhatIfFn = (
  stats:   LifeStatsOutput,
  profile: UserProfile
) => WhatIfResult;

export const WHAT_IF_SCENARIOS: Record<string, { question: string; fn: WhatIfFn }> = {
  sleep_30min: {
    question: 'What if you slept 30 more minutes each night?',
    fn: (stats) => ({
      delta:       Math.floor(stats.daysAlive * 0.5),
      unit:        'extra hours of sleep',
      description: '30 more minutes each night',
    }),
  },
  sleep_1hr: {
    question: 'What if you went to bed 1 hour earlier?',
    fn: (stats) => ({
      delta:       stats.daysAlive,
      unit:        'extra hours of sleep',
      description: 'going to bed 1 hour earlier each night',
    }),
  },
  steps_2000: {
    question: 'What if you walked 2,000 more steps a day?',
    fn: (stats) => ({
      delta:       Math.floor(stats.daysAlive * 2_000),
      unit:        'more steps',
      description: 'walking 2,000 extra steps each day',
    }),
  },
  no_coffee: {
    question: 'What if you gave up coffee?',
    fn: (stats) => ({
      delta:       stats.coffeeCups,
      unit:        'cups never drunk',
      description: 'skipping every cup',
    }),
  },
  reduce_phone_1hr: {
    question: 'What if you spent 1 less hour on your phone each day?',
    fn: (stats) => ({
      delta:       stats.daysAlive,
      unit:        'hours reclaimed',
      description: '1 less hour of screen time each day',
    }),
  },
  live_to_90: {
    question: 'What if you live to 90?',
    fn: (stats) => ({
      delta:       Math.max(0, Math.floor((90 - stats.ageInYears) * 365.25)),
      unit:        'more days ahead',
      description: 'living to 90 years old',
    }),
  },
  live_to_100: {
    question: 'What if you live to 100?',
    fn: (stats) => ({
      delta:       Math.max(0, Math.floor((100 - stats.ageInYears) * 365.25)),
      unit:        'more days ahead',
      description: 'living to 100 years old',
    }),
  },
};

// ─── Stat catalogue ───────────────────────────────────────────
export const STAT_DEFINITIONS: StatDef[] = [

  // ── TIME ───────────────────────────────────────────────────
  {
    id:          'days_alive',
    category:    'time',
    title:       'Days alive',
    description: 'Every sunrise you have ever woken up to — each one a day that was entirely yours.',
    formulaKey:  'daysAlive',
    unit:        'days',
    icon:        'calendar-outline',
    precision:   0,
    whatIfKeys:  ['live_to_90', 'live_to_100'],
    contextFact: 'The word "day" comes from the Old English "dæg" — one of the oldest words in the language. In a 90-year life there are roughly 32,850 of them.',
  },
  {
    id:          'hours_alive',
    category:    'time',
    title:       'Hours alive',
    description: 'Every hour stacks into the architecture of who you are becoming.',
    formulaKey:  'hoursAlive',
    unit:        'hours',
    icon:        'time-outline',
    precision:   0,
    whatIfKeys:  ['live_to_90'],
    contextFact: 'If you stacked every hour of your life end-to-end, the line would stretch far beyond the Moon.',
  },
  {
    id:          'age_in_years',
    category:    'time',
    title:       'Exact age',
    description: 'Not a round number — your precise position in the river of time.',
    formulaKey:  'ageInYears',
    unit:        'years',
    icon:        'ribbon-outline',
    precision:   1,
  },
  {
    id:          'age_in_weeks',
    category:    'time',
    title:       'Weeks old',
    description: 'Life measured in weeks feels both shorter and more vast at once.',
    formulaKey:  'ageInWeeks',
    unit:        'weeks',
    icon:        'calendar-number-outline',
    precision:   0,
    contextFact: 'You are older in weeks than most cats ever get to be. Domestic cats typically live 12–18 years, or about 624–936 weeks.',
  },
  {
    id:          'age_in_months',
    category:    'time',
    title:       'Months old',
    description: 'Each month brought a new season, a shifted sky, a different you.',
    formulaKey:  'ageInMonths',
    unit:        'months',
    icon:        'today-outline',
    precision:   0,
  },
  {
    id:          'mondays_faced',
    category:    'time',
    title:       'Mondays faced',
    description: 'Each one came — and every single time, you made it to Tuesday.',
    formulaKey:  'mondaysFaced',
    unit:        'Mondays',
    icon:        'briefcase-outline',
    precision:   0,
    whatIfKeys:  ['live_to_90'],
  },
  {
    id:          'weekends_lived',
    category:    'time',
    title:       'Weekends enjoyed',
    description: 'Two days at the end of every week that belonged — at least partly — to you.',
    formulaKey:  'weekendsLived',
    unit:        'weekends',
    icon:        'sunny-outline',
    precision:   0,
    whatIfKeys:  ['live_to_90'],
  },
  {
    id:          'percent_of_80',
    category:    'time',
    title:       'Through a typical life',
    description: 'Based on an 80-year lifespan — a perspective, not a limit.',
    formulaKey:  'percentOf80',
    unit:        '% of 80 years',
    icon:        'trending-up-outline',
    precision:   1,
    whatIfKeys:  ['live_to_90', 'live_to_100'],
  },

  // ── BODY ───────────────────────────────────────────────────
  {
    id:          'heartbeats',
    category:    'body',
    title:       'Heartbeats',
    description: 'Your heart has never stopped — not once, not for a single second.',
    formulaKey:  'heartbeats',
    unit:        'beats',
    icon:        'heart-outline',
    precision:   0,
    whatIfKeys:  ['live_to_90'],
    contextFact: 'In an average lifetime the human heart beats over 2.5 billion times. It never takes a day off — or even a second.',
  },
  {
    id:          'breaths',
    category:    'body',
    title:       'Breaths taken',
    description: 'Every one was automatic, faithful, quiet. Not one was missed.',
    formulaKey:  'breaths',
    unit:        'breaths',
    icon:        'cloud-outline',
    precision:   0,
  },
  {
    id:          'blinks',
    category:    'body',
    title:       'Times you\'ve blinked',
    description: 'Each blink was a tiny curtain drop — then the world appeared again.',
    formulaKey:  'blinks',
    unit:        'blinks',
    icon:        'eye-outline',
    precision:   0,
  },
  {
    id:          'steps_walked',
    category:    'body',
    title:       'Steps taken',
    description: 'Every single one moved you somewhere — literally or figuratively.',
    formulaKey:  'stepsWalked',
    unit:        'steps',
    icon:        'walk-outline',
    precision:   0,
    whatIfKeys:  ['steps_2000'],
    contextFact: 'The average person walks 2–3 times around the Earth over a lifetime. The Earth\'s equatorial circumference is about 40,075 km.',
  },
  {
    id:          'sleep_hours',
    category:    'body',
    title:       'Hours of sleep',
    description: 'A third of your life spent in restoration. Your brain was busy the entire time.',
    formulaKey:  'sleepHours',
    unit:        'hours',
    icon:        'moon-outline',
    precision:   0,
    whatIfKeys:  ['sleep_30min', 'sleep_1hr'],
    contextFact: 'Scientists believe you dream 4–6 times each night. During sleep your brain replays memories, clears toxins, and rewires itself for tomorrow.',
  },
  {
    id:          'sleep_days',
    category:    'body',
    title:       'Full days asleep',
    description: 'Converted into days, your sleep paints a quieter parallel life.',
    formulaKey:  'sleepDays',
    unit:        'days',
    icon:        'moon-outline',
    precision:   0,
    whatIfKeys:  ['sleep_30min'],
  },
  {
    id:          'blood_pumped',
    category:    'body',
    title:       'Litres of blood pumped',
    description: 'Your heart is a quiet engineer, moving a river through your body since day one.',
    formulaKey:  'bloodPumped',
    unit:        'litres',
    icon:        'water-outline',
    precision:   0,
  },

  // ── HABITS ─────────────────────────────────────────────────
  {
    id:          'coffee_cups',
    category:    'habits',
    title:       'Cups of coffee',
    description: 'A ritual that has bookmarked thousands of your mornings.',
    formulaKey:  'coffeeCups',
    unit:        'cups',
    icon:        'cafe-outline',
    precision:   0,
    whatIfKeys:  ['no_coffee'],
    contextFact: 'Coffee is the world\'s second most traded commodity. About 2.25 billion cups are consumed globally every single day.',
  },
  {
    id:          'coffee_volume',
    category:    'habits',
    title:       'Coffee consumed',
    description: 'Enough to fill a bathtub or several — a liquid biography of your mornings.',
    formulaKey:  'coffeeVolumeMl',
    unit:        'mL',
    icon:        'cafe-outline',
    precision:   0,
  },
  {
    id:          'meals_eaten',
    category:    'habits',
    title:       'Meals eaten',
    description: 'Every plate was a pause — a small ceremony repeated three times a day.',
    formulaKey:  'mealsEaten',
    unit:        'meals',
    icon:        'restaurant-outline',
    precision:   0,
  },
  {
    id:          'phone_hours',
    category:    'habits',
    title:       'Hours on your phone',
    description: 'A window to the world — and sometimes a wall between you and it.',
    formulaKey:  'phoneHours',
    unit:        'hours',
    icon:        'phone-portrait-outline',
    precision:   0,
    whatIfKeys:  ['reduce_phone_1hr'],
    contextFact: 'The average person checks their phone 96 times a day — once every 10 minutes. Over a year that adds up to about 35,000 glances.',
  },
  {
    id:          'phone_days',
    category:    'habits',
    title:       'Full days on your phone',
    description: 'Converted into days, this number has a way of giving pause.',
    formulaKey:  'phoneDays',
    unit:        'days',
    icon:        'phone-portrait-outline',
    precision:   0,
    whatIfKeys:  ['reduce_phone_1hr'],
  },

  // ── SOCIAL ─────────────────────────────────────────────────
  {
    id:          'laughs',
    category:    'social',
    title:       'Times you\'ve laughed',
    description: 'Science says 17 times a day. Every single one was good for you.',
    formulaKey:  'laughsLaughed',
    unit:        'laughs',
    icon:        'happy-outline',
    precision:   0,
  },
  {
    id:          'words_spoken',
    category:    'social',
    title:       'Words you\'ve spoken',
    description: 'Enough to fill thousands of novels — a lifetime narrated in your own voice.',
    formulaKey:  'wordsSpoken',
    unit:        'words',
    icon:        'chatbubble-outline',
    precision:   0,
  },
];
