/**
 * Teasers for sealed numbers.
 *
 * Every number is visible from day one — what is hidden is the value. A locked
 * card shows a hook (what this number is about, with no figure in it) and,
 * where relevant, which of the user's own onboarding answers it is computed
 * from.
 *
 * That second part matters. "Cups of coffee" means nothing until you know it
 * is built from the number you personally entered; then it stops being trivia
 * and becomes yours. It is also the honest answer to "why should I trust this
 * number" — it says exactly what it is derived from.
 */
import type { UserProfile } from '@/types';

/** Which profile answer a number is derived from, if any. */
export interface StatSource {
  /** Profile field that drives this stat. */
  field: keyof UserProfile;
  /** How it reads in the UI: "from your 2 cups a day". */
  label: (profile: UserProfile) => string;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * statId → the profile answer behind it.
 * Numbers derived purely from date of birth are intentionally absent: showing
 * "from your date of birth" on two-thirds of the catalogue is noise.
 */
export const STAT_SOURCES: Record<string, StatSource> = {
  coffee_cups: {
    field: 'coffeeCupsPerDay',
    label: (p) => `from your ${plural(p.coffeeCupsPerDay, 'cup', 'cups')} a day`,
  },
  coffee_volume: {
    field: 'coffeeCupsPerDay',
    label: (p) => `from your ${plural(p.coffeeCupsPerDay, 'cup', 'cups')} a day`,
  },
  sleep_hours: {
    field: 'sleepHoursPerNight',
    label: (p) => `from your ${p.sleepHoursPerNight}h a night`,
  },
  sleep_days: {
    field: 'sleepHoursPerNight',
    label: (p) => `from your ${p.sleepHoursPerNight}h a night`,
  },
  phone_hours: {
    field: 'phoneHoursPerDay',
    label: (p) => `from your ${p.phoneHoursPerDay}h of screen time`,
  },
  phone_days: {
    field: 'phoneHoursPerDay',
    label: (p) => `from your ${p.phoneHoursPerDay}h of screen time`,
  },
  meals_eaten: {
    field: 'mealsPerDay',
    label: (p) => `from your ${plural(p.mealsPerDay, 'meal', 'meals')} a day`,
  },
  water_glasses: {
    field: 'waterGlassesPerDay',
    label: (p) => `from your ${plural(p.waterGlassesPerDay ?? 6, 'glass', 'glasses')} a day`,
  },
  music_hours: {
    field: 'musicHoursPerDay',
    label: (p) => `from your ${p.musicHoursPerDay ?? 2}h of music a day`,
  },
  commute_hours: {
    field: 'commuteMinutesPerDay',
    label: (p) => `from your ${p.commuteMinutesPerDay ?? 30}min commute`,
  },
  steps_walked: {
    field: 'exerciseFrequency',
    label: (p) =>
      p.exerciseFrequency === 'regular'   ? 'from how active you said you are'
      : p.exerciseFrequency === 'rarely'  ? 'from your mostly-sitting days'
      : 'from your moderate activity',
  },
  words_spoken: {
    field: 'talkLevel',
    label: (p) =>
      p.talkLevel === 'chatty' ? 'from how much you said you talk'
      : p.talkLevel === 'quiet' ? 'from your quieter days'
      : 'from your everyday conversations',
  },
  laughs: {
    field: 'talkLevel',
    label: () => 'from how you said you move through a day',
  },
};

/**
 * One-line hooks for sealed cards.
 *
 * Rules these follow, because a teaser that spoils the number is pointless:
 *   • Never contain a figure.
 *   • Say what is being counted, not how much.
 *   • Give a reason to spend today's key on THIS one.
 */
export const STAT_TEASERS: Record<string, string> = {
  days_alive:     'Your whole life, counted in the unit you actually live it in.',
  blinks:         'Something your eyes did all day today without telling you.',
  phone_hours:    'The hours that went somewhere. This is where.',
  laughs:         'The involuntary one. Counted across every day you have had.',
  hours_alive:    'Age, in the unit that makes it feel finite.',
  breaths:        'You have not thought about a single one of these.',
  age_in_months:  'The same life, measured the way you measure a baby.',
  heartbeats:     'The count that has never once paused since before you were born.',
  coffee_cups:    'A morning ritual, compounded across a lifetime.',
  words_spoken:   'Everything you have ever said out loud, as a figure.',
  steps_walked:   'The distance your own legs have carried you.',
  percent_of_80:  'The one that is uncomfortable to look at. Worth it anyway.',
  sleep_hours:    'A third of your life happened with your eyes closed.',
  age_in_weeks:   'Weeks are short. That is precisely the point.',
  phone_days:     'Screen time, converted into whole days of your life.',
  full_moons:     'How many times the sky has reset since you arrived.',
  meals_eaten:    'Breakfast, lunch, dinner, repeated for decades.',
  blood_pumped:   'The volume your heart has quietly moved.',
  seasons_lived:  'Your life measured in the rhythm you actually feel.',
  sleep_days:     'Not hours. Days. Consecutive.',
  coffee_volume:  'Every cup poured into one container.',
  water_glasses:  'The most ordinary thing you do, totalled.',
  music_hours:    'Time spent inside someone else’s idea.',
  commute_hours:  'The hours spent getting somewhere, not being there.',
  age_in_years:   'The number you already know — to a precision you do not.',
};

/** Teaser for a stat, with a safe generic fallback. */
export function getTeaser(statId: string): string {
  return STAT_TEASERS[statId] ?? 'A number from your life you have never counted.';
}

/** "from your 2 cups a day", or null when the stat is not preference-driven. */
export function getSourceLabel(statId: string, profile: UserProfile | null): string | null {
  if (!profile) return null;
  const source = STAT_SOURCES[statId];
  if (!source) return null;
  try {
    return source.label(profile);
  } catch {
    return null;
  }
}

/**
 * True when changing this profile field would change this stat's value.
 * Used by Profile to tell the user which numbers an edit will affect.
 */
export function statsAffectedBy(field: keyof UserProfile): string[] {
  return Object.entries(STAT_SOURCES)
    .filter(([, source]) => source.field === field)
    .map(([statId]) => statId);
}
