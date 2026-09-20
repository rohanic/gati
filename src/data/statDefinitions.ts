/**
 * All stat definitions.
 * formulaKey maps directly to a key in LifeStatsOutput.
 * whatIfKeys is a POOL — WhatIfSection cycles through all of them shuffled.
 */
import type { StatDefinition } from '@/types';
import type { LifeStatsOutput } from '@/engine/statsEngine';
import type { UserProfile } from '@/types';

// ─── Extended definition ───────────────────────────────────────
export interface StatDef extends StatDefinition {
  whatIfKeys?:  string[];
  contextFact?: string;
  /**
   * Short surprising comparisons that restore the wow-factor on
   * subsequent views. One is picked per session and shown below
   * the stat description. Keep each under 120 characters.
   */
  comparisons?: string[];
}

// ─── What-If scenario registry ────────────────────────────────
export interface WhatIfResult {
  delta:       number;
  unit:        string;
  description: string;
}

export type WhatIfFn = (
  stats:   LifeStatsOutput,
  profile: UserProfile
) => WhatIfResult;

export const WHAT_IF_SCENARIOS: Record<string, { question: string; fn: WhatIfFn }> = {

  // ── Longevity ──
  live_to_80: {
    question: 'What if you live to 80?',
    fn: (stats) => ({
      delta:       Math.max(0, Math.floor((80 - stats.ageInYears) * 365.25)),
      unit:        'more days ahead of you',
      description: 'living to 80 years old',
    }),
  },
  live_to_90: {
    question: 'What if you live to 90?',
    fn: (stats) => ({
      delta:       Math.max(0, Math.floor((90 - stats.ageInYears) * 365.25)),
      unit:        'more days ahead of you',
      description: 'living to 90 years old',
    }),
  },
  live_to_100: {
    question: 'What if you make it to 100?',
    fn: (stats) => ({
      delta:       Math.max(0, Math.floor((100 - stats.ageInYears) * 365.25)),
      unit:        'more days to fill',
      description: 'living to 100 years old',
    }),
  },

  // ── Sleep ──
  sleep_30min: {
    question: 'What if you slept 30 more minutes each night?',
    fn: (stats) => ({
      delta:       Math.floor(stats.daysAlive * 0.5),
      unit:        'extra hours of sleep, total',
      description: 'sleeping 30 more minutes each night',
    }),
  },
  sleep_1hr: {
    question: 'What if you went to bed 1 hour earlier?',
    fn: (stats) => ({
      delta:       stats.daysAlive,
      unit:        'extra hours of sleep across your life',
      description: 'going to bed 1 hour earlier each night',
    }),
  },
  sleep_9hrs: {
    question: 'What if you slept a full 9 hours each night?',
    fn: (stats, profile) => ({
      delta:       Math.floor(stats.daysAlive * Math.max(0, 9 - profile.sleepHoursPerNight)),
      unit:        'extra hours of deep rest',
      description: 'sleeping a full 9 hours each night',
    }),
  },
  no_snooze: {
    question: 'What if you never hit snooze again?',
    fn: (stats) => ({
      delta:       Math.floor(stats.daysAlive * 9 / 60),
      unit:        'morning hours you would have reclaimed',
      description: 'rising at your first alarm every single day',
    }),
  },

  // ── Movement ──
  steps_2000: {
    question: 'What if you walked 2,000 more steps a day?',
    fn: (stats) => ({
      delta:       Math.floor(stats.daysAlive * 2_000),
      unit:        'more steps across your lifetime',
      description: 'adding 2,000 steps to every day',
    }),
  },
  walk_10k: {
    question: 'What if you hit 10,000 steps every day?',
    fn: (stats) => ({
      delta:       Math.floor(stats.daysAlive * Math.max(0, 10_000 - (stats.stepsWalked / stats.daysAlive))),
      unit:        'more steps you\'d have taken',
      description: 'hitting 10,000 steps every single day',
    }),
  },
  exercise_daily: {
    question: 'What if you moved your body every single day?',
    fn: (stats) => ({
      delta:       Math.floor(stats.daysAlive * 30),
      unit:        'minutes of movement across your life',
      description: 'making 30 minutes of movement a daily ritual',
    }),
  },

  // ── Caffeine ──
  no_coffee: {
    question: 'What if you gave up coffee entirely?',
    fn: (stats) => ({
      delta:       stats.coffeeCups,
      unit:        'cups you would never have drunk',
      description: 'skipping every single cup',
    }),
  },
  reduce_coffee_half: {
    question: 'What if you halved your coffee intake?',
    fn: (stats) => ({
      delta:       Math.floor(stats.coffeeCups / 2),
      unit:        'cups saved over your lifetime so far',
      description: 'cutting your coffee in half',
    }),
  },

  // ── Screen time ──
  reduce_phone_1hr: {
    question: 'What if you spent 1 less hour on your phone each day?',
    fn: (stats) => ({
      delta:       stats.daysAlive,
      unit:        'hours reclaimed from your screen',
      description: '1 less hour of screen time each day',
    }),
  },
  no_social_media: {
    question: 'What if you quit social media entirely?',
    fn: (stats) => ({
      delta:       Math.floor(stats.daysAlive * 2),
      unit:        'hours of life you\'d have back',
      description: 'stepping away from social media entirely',
    }),
  },
  phone_free_mornings: {
    question: 'What if every morning was phone-free?',
    fn: (stats) => ({
      delta:       Math.floor(stats.daysAlive * 1.5),
      unit:        'calm, undistracted morning hours',
      description: 'keeping every morning screen-free',
    }),
  },

  // ── Mind & connection ──
  meditate_daily: {
    question: 'What if you meditated 10 minutes every day?',
    fn: (stats) => ({
      delta:       Math.floor(stats.daysAlive * 10),
      unit:        'minutes of intentional stillness',
      description: 'meditating for 10 minutes each morning',
    }),
  },
  read_30min: {
    question: 'What if you read for 30 minutes each night?',
    fn: (stats) => ({
      delta:       Math.floor((stats.daysAlive * 30) / 60 / 8),
      unit:        'books you could have finished',
      description: 'reading 30 minutes every evening',
    }),
  },
  learn_language: {
    question: 'What if you practiced a language 20 minutes daily?',
    fn: (stats) => ({
      delta:       Math.floor(stats.daysAlive * 20),
      unit:        'minutes invested in a new language',
      description: 'spending 20 minutes daily on a new language',
    }),
  },
  laugh_more: {
    question: 'What if you found 5 more reasons to laugh each day?',
    fn: (stats) => ({
      delta:       Math.floor(stats.daysAlive * 5),
      unit:        'extra moments of genuine joy',
      description: 'finding 5 more reasons to laugh each day',
    }),
  },
  journal_5min: {
    question: 'What if you journalled for 5 minutes each day?',
    fn: (stats) => ({
      delta:       Math.floor(stats.daysAlive * 5),
      unit:        'minutes of self-reflection you\'d have',
      description: 'writing for just 5 minutes every day',
    }),
  },

  // ── Hydration ──
  water_2more: {
    question: 'What if you drank 2 more glasses of water a day?',
    fn: (stats) => ({
      delta:       Math.floor(stats.daysAlive * 2 * 0.25),
      unit:        'extra litres through your body by now',
      description: 'adding 2 glasses of water to every day',
    }),
  },

  // ── Music ──
  music_new_artist: {
    question: 'What if you discovered one new artist a week?',
    fn: (stats) => ({
      delta:       Math.floor(stats.daysAlive / 7),
      unit:        'artists you could have discovered by now',
      description: 'finding one new artist every week',
    }),
  },

  // ── Commute ──
  commute_15_less: {
    question: 'What if your commute were 15 minutes shorter?',
    fn: (stats) => ({
      delta:       Math.floor((Math.max(0, stats.daysAlive - 18 * 365.25) * 15) / 60),
      unit:        'hours of your life handed back',
      description: 'shaving 15 minutes off the daily commute',
    }),
  },
  commute_podcast: {
    question: 'What if every commute became a podcast?',
    fn: (stats) => ({
      delta:       Math.floor(stats.commuteHours / 0.75),
      unit:        'episodes you could have finished',
      description: 'turning travel time into listening time',
    }),
  },
};

// ─── Stat catalogue (25 stats) ─────────────────────────────────
//
// Sequence is deliberately non-alphabetical and non-categorical.
// Psychological principles driving the order:
//   • Contrast rhythm: big/abstract → surprising body → personal habit → emotional warmth
//   • "Converted" stats (phone_days, sleep_days, coffee_volume) placed 10–12 slots
//     after their pair so the scale-shift hits fresh, not immediately
//   • Mortality salience (percent_of_80) lands at the midpoint, not the opening
//   • Cosmic / poetic stats (full_moons, seasons_lived) follow confronting ones
//     as deliberate relief valves
//   • Final stat is exact age — precise decimal, grounding landing
//
export const STAT_DEFINITIONS: StatDef[] = [

  // 1 — ANCHOR: reframes age from years into days immediately
  {
    id:          'days_alive',
    category:    'time',
    title:       'Days alive',
    description: "You've survived every single one. Bad days, forgettable Tuesdays, days you'd rather redo. Every 24 hours is counted here. Each one reshaping you in ways you'll never fully trace.",
    formulaKey:  'daysAlive',
    unit:        'days',
    icon:        'calendar-outline',
    precision:   0,
    whatIfKeys:  ['live_to_80', 'live_to_90', 'live_to_100', 'meditate_daily', 'exercise_daily', 'sleep_1hr', 'read_30min', 'journal_5min', 'laugh_more', 'learn_language'],
    contextFact: "Research shows most people underestimate their age in days by about 40%. Seeing life in days, not years, triggers what psychologists call 'temporal depth': a visceral sense that time is both vast and urgently finite at the same time.",
    comparisons: [
      "Mozart lived just 12,935 days. Galileo: 27,738. Every day you have is one neither of them got.",
      "The internet has existed for roughly 12,000 days. Most people reading this have been alive longer.",
      "The Berlin Wall stood for 10,316 days. Most people alive today have outlived it. More than once.",
    ],
  },

  // 2 — SURPRISE: involuntary, "wait — I blink that many times?"
  {
    id:          'blinks',
    category:    'body',
    title:       'Times you\'ve blinked',
    description: "Every 4 seconds, the world switched off and on, and your brain edited it out completely. You had no idea. This number represents a lifetime of invisible moments your consciousness quietly erased.",
    formulaKey:  'blinks',
    unit:        'blinks',
    icon:        'eye-outline',
    precision:   0,
    whatIfKeys:  ['live_to_90', 'no_social_media', 'live_to_100', 'sleep_9hrs', 'phone_free_mornings', 'reduce_phone_1hr', 'meditate_daily', 'read_30min'],
    contextFact: "Screen use reduces your blink rate by up to 66%, from 15 to 20 per minute down to just 5 to 7. The resulting eye strain is so widespread it has its own clinical name: Computer Vision Syndrome, estimated to affect 50 to 90% of regular screen users.",
  },

  // 3 — MIRROR: personal, slightly confronting
  {
    id:          'phone_hours',
    category:    'habits',
    title:       'Hours on your phone',
    description: "This number tends to be higher than people expect. Your phone holds a record of every moment of boredom, curiosity, avoidance, and connection, logged in total hours your mind spent in the rectangle.",
    formulaKey:  'phoneHours',
    unit:        'hours',
    icon:        'phone-portrait-outline',
    precision:   0,
    whatIfKeys:  ['reduce_phone_1hr', 'no_social_media', 'phone_free_mornings', 'learn_language', 'meditate_daily', 'read_30min', 'journal_5min', 'exercise_daily', 'sleep_1hr'],
    contextFact: "Having a phone face-down on your desk, even switched off, measurably reduces working memory. Your brain uses real cognitive resources suppressing the urge to check it. The device doesn't have to be on to occupy you.",
  },

  // 4 — RELIEF: warm, positive, emotional reset after the confronting stat
  {
    id:          'laughs',
    category:    'social',
    title:       'Times you\'ve laughed',
    description: "Each one was an involuntary response your body chose because something felt right for a moment. Laughter is your nervous system celebrating coherence. You've triggered that circuit this many times.",
    formulaKey:  'laughsLaughed',
    unit:        'laughs',
    icon:        'happy-outline',
    precision:   0,
    whatIfKeys:  ['laugh_more', 'meditate_daily', 'exercise_daily', 'journal_5min', 'read_30min', 'phone_free_mornings', 'learn_language', 'live_to_90'],
    contextFact: "Genuine laughter, the kind involving the eyes, is completely involuntary. You can't fake it perfectly. You're 30 times more likely to laugh in a group than alone. Laughter isn't a reaction to humor; it's a social bonding signal that humor happens to trigger.",
  },

  // 5 — EXPANSION: same concept as #1 but 24× bigger — mind-bending scale shift
  {
    id:          'hours_alive',
    category:    'time',
    title:       'Hours alive',
    description: "Your hours are where your real life happened, not in decades, but in these individual unrepeatable windows. Most people have fewer than 700,000 of them in a lifetime.",
    formulaKey:  'hoursAlive',
    unit:        'hours',
    icon:        'time-outline',
    precision:   0,
    whatIfKeys:  ['live_to_90', 'live_to_100', 'sleep_1hr', 'no_social_media', 'phone_free_mornings', 'meditate_daily', 'exercise_daily', 'read_30min'],
    contextFact: "The 'Finite Time Effect' is well-studied: people who think of remaining time in hours, rather than years, make dramatically different choices about how to spend it. The hours framing tends to eliminate the things people later regret.",
    comparisons: [
      "The average person spends ~90,000 hours at work over a lifetime. You've been alive for far more. Work is a sliver.",
      "A full year is only 8,760 hours. Your life, counted in those units, probably stretches longer than you felt.",
      "700,000 hours is all most people get in a lifetime. How far into yours are you?",
    ],
  },

  // 6 — VISCERAL: happening right now as you read this
  {
    id:          'breaths',
    category:    'body',
    title:       'Breaths taken',
    description: "Every breath was borrowed and returned, borrowed and returned. You've done this so many times, perfectly, without once deciding to. Your body kept you alive while your mind was somewhere else entirely.",
    formulaKey:  'breaths',
    unit:        'breaths',
    icon:        'cloud-outline',
    precision:   0,
    whatIfKeys:  ['meditate_daily', 'sleep_9hrs', 'live_to_90', 'exercise_daily', 'journal_5min', 'phone_free_mornings', 'laugh_more', 'live_to_100'],
    contextFact: "Slowing your breath below 6 breaths per minute, versus the average 12 to 20, activates the parasympathetic nervous system, reducing cortisol and triggering brain patterns nearly identical to deep meditation. The breath is the only automatic function you can consciously override.",
    comparisons: [
      "You passed the complete works of Shakespeare (884,647 words) in breaths before your third birthday.",
      "You took roughly 23,040 breaths today. Your body managed all of them without a single conscious instruction.",
      "In your lifetime, you'll inhale enough air to fill a medium-sized house: every cubic centimetre of it processed without a decision.",
    ],
  },

  // 7 — REFRAME: time in an unfamiliar unit, smaller than days or hours
  {
    id:          'age_in_months',
    category:    'time',
    title:       'Months old',
    description: "Every month you've lived had its own particular sky. January light, July heat, November quiet. This many distinct chapters of your life, compressed into a single number.",
    formulaKey:  'ageInMonths',
    unit:        'months',
    icon:        'today-outline',
    precision:   0,
    whatIfKeys:  ['live_to_90', 'live_to_100', 'exercise_daily', 'sleep_1hr', 'meditate_daily', 'read_30min', 'laugh_more', 'journal_5min'],
  },

  // 8 — AWE: billions, automatic, never stopped before you had a name
  {
    id:          'heartbeats',
    category:    'body',
    title:       'Heartbeats',
    description: "Not once has your heart stopped to ask for a break. Not when you were asleep, not when you were sad, not when you wanted it to. It just kept going, every second, before you even had a name.",
    formulaKey:  'heartbeats',
    unit:        'beats',
    icon:        'heart-outline',
    precision:   0,
    whatIfKeys:  ['live_to_90', 'meditate_daily', 'exercise_daily', 'live_to_100', 'laugh_more', 'sleep_9hrs', 'journal_5min', 'read_30min'],
    contextFact: "Elite endurance athletes' hearts beat as low as 28 times per minute at rest, versus the average 60 to 100. More efficient hearts do the same work in fewer beats. This is one of the core reasons regular aerobic exercise is the single strongest predictor of longevity.",
    comparisons: [
      "Your heart has beaten more times than there are people on Earth. It passed 8 billion long ago.",
      "The average human lifetime totals ~2.5 billion heartbeats. Smaller mammals get more beats per minute , but far fewer years.",
      "Your heart has never taken a day off, a holiday, or a sick day. No machine ever built has matched that record.",
    ],
  },

  // 9 — RITUAL: personal, comforting, habitual — contrast with the awe of #8
  {
    id:          'coffee_cups',
    category:    'habits',
    title:       'Cups of coffee',
    description: "This many mornings began the same way. The smell first, then the warmth, then the illusion of readiness. Whatever else was happening in your life, the ritual stayed constant.",
    formulaKey:  'coffeeCups',
    unit:        'cups',
    icon:        'cafe-outline',
    precision:   0,
    whatIfKeys:  ['no_coffee', 'reduce_coffee_half', 'meditate_daily', 'journal_5min', 'read_30min', 'phone_free_mornings', 'sleep_1hr', 'laugh_more'],
    contextFact: "Caffeine works by blocking adenosine receptors, the ones that signal tiredness. The effect wears off, but the adenosine is still there, waiting. The afternoon crash happens when caffeine clears and your body processes all the tiredness it quietly deferred.",
    comparisons: [
      "London drinks ~70 million cups of coffee per day. At your rate, you'll match London's single-day total across your lifetime.",
      "Stacked in standard 250mL cups, your lifetime coffee reaches higher than you'd comfortably think about.",
      "Coffee is the most-traded agricultural commodity after oil. You're a meaningful participant in that market.",
    ],
  },

  // 10 — CONNECTION: links you to other people, improvised language
  {
    id:          'words_spoken',
    category:    'social',
    title:       'Words you\'ve spoken',
    description: "Spoken ones only, not written, not thought. Every conversation, greeting, whisper, and offhand comment. A library's worth of language, most of it completely improvised, all of it gone the moment it left you.",
    formulaKey:  'wordsSpoken',
    unit:        'words',
    icon:        'chatbubble-outline',
    precision:   0,
    whatIfKeys:  ['learn_language', 'no_social_media', 'journal_5min', 'laugh_more', 'read_30min', 'meditate_daily', 'phone_free_mornings', 'live_to_90'],
    contextFact: "People who engage in more substantive conversations, rather than small talk, consistently report higher life satisfaction, regardless of introversion or extroversion. It's not how much you talk. It's whether the talking actually means something.",
    comparisons: [
      "The complete works of Shakespeare: ~884,000 words. You've spoken more than that in just the last few years.",
      "The entire Harry Potter series runs to 1,084,170 words. Your spoken output dwarfs it every few years.",
      "Most of what you've ever said is gone forever. Language was invented as a workaround for that problem.",
    ],
  },

  // 11 — MOVEMENT: body in space, life force, grounds after the abstract social stat
  {
    id:          'steps_walked',
    category:    'body',
    title:       'Steps taken',
    description: "Every single step was your body choosing to move through the world. Some purposeful. Many forgettable. A handful brought you somewhere that changed everything.",
    formulaKey:  'stepsWalked',
    unit:        'steps',
    icon:        'walk-outline',
    precision:   0,
    whatIfKeys:  ['steps_2000', 'walk_10k', 'exercise_daily', 'no_social_media', 'phone_free_mornings', 'live_to_90', 'laugh_more', 'sleep_1hr'],
    contextFact: "A Cambridge University study found that just 11 minutes of walking per day reduces the risk of early death by 23%. The relationship isn't linear. Those first few thousand daily steps matter most. Movement doesn't have to be intense to count.",
    comparisons: [
      "At 8,000 steps a day, you'd walk the entire length of Australia (~4,000 km) in about 14 months. You've done that, and more.",
      "Earth's circumference is ~40,075 km. At your pace you've walked it at least once. Maybe more.",
      "Every step you've taken in your life, laid end-to-end, stretches further than you'll ever travel by plane.",
    ],
  },

  // 12 — MORTALITY SALIENCE: midpoint placement, not the opener — lands harder here
  {
    id:          'percent_of_80',
    category:    'time',
    title:       'Through a typical life',
    description: "If most lives are an 80-year book, you're this far through yours. Not to create pressure, just to calibrate. The next chapter is still entirely your choice.",
    formulaKey:  'percentOf80',
    unit:        '% of 80 years',
    icon:        'trending-up-outline',
    precision:   1,
    whatIfKeys:  ['live_to_80', 'live_to_90', 'live_to_100', 'meditate_daily', 'exercise_daily', 'sleep_1hr', 'journal_5min', 'laugh_more', 'read_30min'],
    contextFact: "Behavioral economists found that people make significantly different decisions about their time when they think in percentage of life remaining vs. years remaining. The percentage framing activates a more honest and more urgent part of the brain.",
  },

  // 13 — RESTORATION: parallel consciousness, rebuildling — follows the sobering #12
  {
    id:          'sleep_hours',
    category:    'body',
    title:       'Hours of sleep',
    description: "While you slept, your brain cleared toxic proteins, filed memories into long-term storage, and rebuilt your immune system. You weren't absent. You were being rebuilt from the inside.",
    formulaKey:  'sleepHours',
    unit:        'hours',
    icon:        'moon-outline',
    precision:   0,
    whatIfKeys:  ['sleep_30min', 'sleep_1hr', 'sleep_9hrs', 'no_snooze', 'phone_free_mornings', 'meditate_daily', 'reduce_phone_1hr', 'no_social_media', 'laugh_more'],
    contextFact: "Matthew Walker's research found that less than 7 hours of sleep for two weeks creates cognitive impairment equivalent to 24 hours without sleep, but without the subjective feeling of tiredness. The damage is invisible, which is exactly what makes it so dangerous.",
    comparisons: [
      "You've spent roughly a third of your entire life unconscious, and your brain was more active during parts of it than right now.",
      "Scientists didn't understand why we need sleep until the 2010s. Your body was doing it perfectly long before the explanation existed.",
      "During your sleeping hours, your brain replays the day's experiences at 10 to 20 times speed, consolidating what matters and discarding the rest.",
    ],
  },

  // 14 — UNUSUAL UNIT: the "4,000 weeks" reframe — smaller number, bigger feeling
  {
    id:          'age_in_weeks',
    category:    'time',
    title:       'Weeks old',
    description: "Measured in weeks, life suddenly feels both shorter and more spacious at the same time. Most people have fewer than 4,000 of them total. You're already deep into yours.",
    formulaKey:  'ageInWeeks',
    unit:        'weeks',
    icon:        'calendar-number-outline',
    precision:   0,
    whatIfKeys:  ['live_to_90', 'live_to_100', 'read_30min', 'meditate_daily', 'journal_5min', 'learn_language', 'exercise_daily', 'laugh_more'],
    contextFact: "Oliver Burkeman's '4,000 Weeks' reframed how millions think about time. At 80 years you get exactly 4,160 weeks total. The finite number has a way of quietly rearranging your priorities.",
  },

  // 15 — CONVERTED SHOCK: phone_hours from #3 converted to full days — hits harder now
  {
    id:          'phone_days',
    category:    'habits',
    title:       'Full days on your phone',
    description: "Converted to full calendar days, this is how much of your life has been spent looking at glass. No judgment, just the number doing what numbers do: making the invisible visible.",
    formulaKey:  'phoneDays',
    unit:        'days',
    icon:        'phone-portrait-outline',
    precision:   0,
    whatIfKeys:  ['reduce_phone_1hr', 'no_social_media', 'phone_free_mornings', 'meditate_daily', 'read_30min', 'learn_language', 'journal_5min', 'exercise_daily'],
  },

  // 16 — COSMIC RELIEF: poetic, ancient, connects to something larger after the confronting #15
  {
    id:          'full_moons',
    category:    'time',
    title:       'Full moons seen',
    description: "The same moon has completed its cycle this many times since the night you were born. Somewhere, someone else was looking up at the exact same thing. They just didn't know you existed.",
    formulaKey:  'fullMoons',
    unit:        'full moons',
    icon:        'ellipse-outline',
    precision:   0,
    whatIfKeys:  ['live_to_90', 'live_to_100', 'journal_5min', 'sleep_9hrs', 'meditate_daily', 'laugh_more', 'read_30min', 'exercise_daily'],
    contextFact: "The word 'lunatic' literally comes from 'luna'. Before modern medicine, hospitals tracked admissions by lunar cycle. Some recent studies still show correlations between full moons and sleep disruption, though the mechanism remains debated. The fascination is ancient.",
  },

  // 17 — GROUNDING: mostly forgotten, but all kept you alive
  {
    id:          'meals_eaten',
    category:    'habits',
    title:       'Meals eaten',
    description: "Every meal was a pause in whatever else was happening. Some shared with people you love. Some eaten alone over a sink. All of them kept you alive. Most of them you've completely forgotten.",
    formulaKey:  'mealsEaten',
    unit:        'meals',
    icon:        'restaurant-outline',
    precision:   0,
    whatIfKeys:  ['meditate_daily', 'journal_5min', 'live_to_90', 'read_30min', 'laugh_more', 'exercise_daily', 'phone_free_mornings', 'no_social_media'],
    contextFact: "Research consistently shows that eating alone, even occasionally, correlates with higher depression rates and poorer nutrition. The social aspect of meals isn't incidental to human evolution; it's foundational. We are biologically wired to eat together.",
  },

  // 18 — MECHANICAL AWE: massive volume, completely automatic, no conscious instruction
  {
    id:          'blood_pumped',
    category:    'body',
    title:       'Litres of blood pumped',
    description: "Your heart doesn't know your name, your worries, or whether today was hard. It just moves blood, without stopping, since before you had a face. This is its running total.",
    formulaKey:  'bloodPumped',
    unit:        'litres',
    icon:        'water-outline',
    precision:   0,
    whatIfKeys:  ['meditate_daily', 'exercise_daily', 'live_to_90', 'live_to_100', 'sleep_9hrs', 'laugh_more', 'journal_5min', 'read_30min'],
    contextFact: "Your circulatory system, laid end to end, would wrap around Earth's equator twice. Every drop of blood makes a complete circuit in under 60 seconds. Your heart pumps roughly 7,500 litres every single day, without a single conscious instruction from you.",
  },

  // 19 — POETIC: resilience framing — you've survived every single change
  {
    id:          'seasons_lived',
    category:    'time',
    title:       'Seasons lived',
    description: "You've watched the world change color this many times. Same streets, same people, slightly different you each time. Seasons reset. You don't. You just carry more.",
    formulaKey:  'seasonsLived',
    unit:        'seasons',
    icon:        'leaf-outline',
    precision:   0,
    whatIfKeys:  ['live_to_90', 'live_to_100', 'meditate_daily', 'read_30min', 'journal_5min', 'exercise_daily', 'laugh_more', 'sleep_1hr'],
    contextFact: "Ancient Celtic and many Indigenous calendars tracked age by seasons survived, not years passed. In those traditions, old age was a genuine marker of resilience. Each winter you survived was counted like a battle won.",
  },

  // 20 — PARALLEL LIFE: sleep_hours from #13 converted — "a life lived entirely unconscious"
  {
    id:          'sleep_days',
    category:    'body',
    title:       'Full days asleep',
    description: "Converted to days, this is the size of a parallel life you've lived entirely unconscious: a version of you that experienced none of it, but whose sleep made the waking you possible.",
    formulaKey:  'sleepDays',
    unit:        'days',
    icon:        'moon-outline',
    precision:   0,
    whatIfKeys:  ['sleep_30min', 'sleep_1hr', 'sleep_9hrs', 'no_snooze', 'phone_free_mornings', 'meditate_daily', 'exercise_daily', 'laugh_more'],
  },

  // 21 — SCALE SHIFT: same coffee as #9 but in mL — same habit, completely different sensation
  {
    id:          'coffee_volume',
    category:    'habits',
    title:       'Coffee consumed',
    description: "Every drop here represents a deliberate choice: one cup at a time, across years, slowly becoming a habit that's now just part of who you are. Liquid autobiography.",
    formulaKey:  'coffeeVolumeMl',
    unit:        'mL',
    icon:        'cafe-outline',
    precision:   0,
    whatIfKeys:  ['no_coffee', 'reduce_coffee_half', 'sleep_1hr', 'meditate_daily', 'read_30min', 'journal_5min', 'phone_free_mornings', 'exercise_daily'],
  },

  // 22 — QUIET MAINTENANCE: easy to overlook, but fundamental to everything else
  {
    id:          'water_glasses',
    category:    'body',
    title:       'Glasses of water',
    description: "Your body is roughly 60% water, and none of it is the water you were born with. Glass by glass, you've replaced yourself thousands of times over. This is the running total of that quiet maintenance work.",
    formulaKey:  'waterGlasses',
    unit:        'glasses',
    icon:        'water-outline',
    precision:   0,
    whatIfKeys:  ['water_2more', 'live_to_90', 'exercise_daily', 'meditate_daily', 'sleep_1hr'],
    contextFact: "You'll drink roughly 60,000 litres of water in your lifetime: enough to fill a small swimming pool. Mild dehydration of just 2% measurably reduces concentration and mood before you ever feel thirsty.",
  },

  // 23 — EMOTIONAL: what got you through things — positive, cultural, memory-laden
  {
    id:          'music_hours',
    category:    'habits',
    title:       'Hours of music',
    description: "Every song that got you through something is in this number. Music is the only art form your brain processes in nearly every region at once, and you've given it this many hours of your life since you were young.",
    formulaKey:  'musicHours',
    unit:        'hours',
    icon:        'musical-notes-outline',
    precision:   0,
    whatIfKeys:  ['music_new_artist', 'learn_language', 'read_30min', 'meditate_daily', 'laugh_more'],
    contextFact: "Hearing a song from your teens triggers stronger memory recall than photographs do. Neurologists call it the 'reminiscence bump'. The music you loved at 14 is wired deeper than almost anything you learned at 30.",
  },

  // 24 — HIDDEN COST: the unexamined line item in everyone's time budget
  {
    id:          'commute_hours',
    category:    'time',
    title:       'Hours commuting',
    description: "Counted from adulthood: the corridors, traffic lights and platforms between where you sleep and where your life happens. It's one of the largest unexamined line items in anyone's time budget. Now it has a number.",
    formulaKey:  'commuteHours',
    unit:        'hours',
    icon:        'train-outline',
    precision:   0,
    whatIfKeys:  ['commute_15_less', 'commute_podcast', 'learn_language', 'read_30min', 'no_social_media'],
    contextFact: "The average commuter spends about a year of their life travelling to work. Research on the 'commute paradox' shows people consistently underestimate this cost when choosing where to live. An extra 20 minutes each way rivals a 19% pay cut in its effect on life satisfaction.",
  },

  // 25 — LANDING: precise decimal, grounding — you know exactly where you are
  {
    id:          'age_in_years',
    category:    'time',
    title:       'Exact age',
    description: "Not the rounded number you tell people at parties, but the precise decimal you are right now. There's something grounding about knowing exactly where you stand in time.",
    formulaKey:  'ageInYears',
    unit:        'years',
    icon:        'ribbon-outline',
    precision:   1,
    whatIfKeys:  ['live_to_90', 'live_to_100', 'meditate_daily', 'exercise_daily', 'sleep_9hrs', 'laugh_more', 'read_30min', 'journal_5min'],
  },
];
