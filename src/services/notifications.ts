/**
 * Gati notification service.
 *
 * Two delivery paths, mutually exclusive:
 *
 *   Signed OUT → local scheduled notifications (expo-notifications).
 *   Signed IN  → server push via Supabase edge functions + EPNS.
 *
 * `refreshNotificationsOnOpen` picks the path on every app open and cancels
 * the other one, so a user never receives both.
 *
 * Everything is guarded for Expo Go, where expo-notifications has had no
 * functional support since SDK 53.
 */
import type * as NotificationsType from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { formatTimeUntilNextKey } from '@/engine/unlockEngine';

const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

function getNotifications(): typeof NotificationsType {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-notifications');
}

// ─── Identifiers ──────────────────────────────────────────────
const NOTIF_STAT           = 'gati-daily-stat';
const NOTIF_STREAK         = 'gati-streak-saver';
const NOTIF_WEEKLY_DIGEST  = 'gati-weekly-digest';
const NOTIF_MILESTONE_PRED = 'gati-milestone-prediction';

const ALL_LOCAL_IDS = [
  NOTIF_STAT,
  NOTIF_STREAK,
  NOTIF_WEEKLY_DIGEST,
  NOTIF_MILESTONE_PRED,
];

// ─── Android channels ─────────────────────────────────────────
/**
 * Android 8+ routes every notification through a channel. Declaring them
 * explicitly (rather than letting one catch-all "default" channel absorb
 * everything) lets users silence the streak nags without losing their daily
 * number — which is what stops them disabling notifications outright.
 */
export const CHANNELS = {
  daily:     'daily-stat',
  streak:    'streak',
  milestone: 'milestones',
  digest:    'weekly-digest',
} as const;

let channelsReady = false;

export async function ensureAndroidChannels(): Promise<void> {
  if (IS_EXPO_GO || Platform.OS !== 'android' || channelsReady) return;
  const N = getNotifications();
  channelsReady = true;
  try {
    await Promise.all([
      N.setNotificationChannelAsync(CHANNELS.daily, {
        name:             'Your daily number',
        importance:       N.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 200],
        lightColor:       '#2A7D4F',
        description:      'One new life stat every day.',
      }),
      N.setNotificationChannelAsync(CHANNELS.streak, {
        name:        'Streak reminders',
        importance:  N.AndroidImportance.LOW,
        lightColor:  '#2A7D4F',
        description: 'A nudge only on evenings you have not opened Gati.',
      }),
      N.setNotificationChannelAsync(CHANNELS.milestone, {
        name:             'Milestones',
        importance:       N.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 200, 100, 200],
        lightColor:       '#C9A227',
        description:      'Rare moments, like your one-billionth heartbeat.',
      }),
      N.setNotificationChannelAsync(CHANNELS.digest, {
        name:        'Weekly recap',
        importance:  N.AndroidImportance.LOW,
        lightColor:  '#2A7D4F',
        description: 'A short summary of your week, on Sundays.',
      }),
    ]);
  } catch {
    channelsReady = false; // allow a retry on the next open
  }
}

// ─── Foreground presentation ──────────────────────────────────
/**
 * Without a handler, expo-notifications silently drops notifications that
 * arrive while the app is foregrounded. Gati's notifications are always
 * worth showing, so present them as a banner.
 *
 * Call once, as early as possible (app/_layout.tsx).
 */
export function configureNotificationHandler(): void {
  if (IS_EXPO_GO) return;
  const N = getNotifications();
  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList:   true,
      shouldPlaySound:  false,
      shouldSetBadge:   false,
    }),
  });
}

// ─── Copy: daily stat ─────────────────────────────────────────
/**
 * What changed here, and why.
 *
 * The old copy was all tease and no substance — "A new number is ready",
 * "Curiosity rewarded. One tap away." Nothing in it was about the person
 * reading it, so every day's notification was interchangeable with every
 * other day's, which is precisely how a notification trains someone to swipe
 * it away without reading.
 *
 * The replacement leads with something TRUE and SPECIFIC to that user on that
 * day, while still protecting the reveal:
 *
 *   • the size of the number ("ten digits", "in the billions") — derived from
 *     their real figure, spoils nothing, and is far more arresting than an
 *     adjective
 *   • the state of their key bank, which carries genuine loss (keys stop
 *     accruing at the cap, so a full bank is a countdown to waste)
 *   • a place they saved themselves and never went to, by name
 *
 * Specificity is doing the work, not urgency. Nothing below claims anything
 * that is not true at the moment it fires.
 */

/**
 * Describe how big a number is without saying what it is.
 *
 * Digit count is the sweet spot: concrete enough to be genuinely surprising
 * — most people have never considered that a fact about them runs to ten
 * digits — and useless for guessing which stat it belongs to.
 */
export function magnitudeHook(value: number | undefined): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) return null;
  const whole  = Math.floor(value);
  const digits = String(whole).length;
  if (whole >= 1_000_000_000) return `Today’s number runs to ${digits} digits.`;
  if (whole >= 1_000_000)     return 'Today’s number is in the millions.';
  if (whole >= 100_000)       return `Today’s number has ${digits} digits.`;
  if (whole >= 1_000)         return 'Today’s number is in the thousands.';
  return null;
}

/**
 * A structured daily body, in the shape a sleep or activity app uses.
 *
 * Android collapses a notification to one line and expands it on a pull, so
 * the first line has to stand alone while the rest rewards opening it. A
 * single sentence wastes that second state entirely — which is what the copy
 * did before, whether expanded or not.
 *
 * Every row is a fact this app already holds. Nothing is padded to fill the
 * shape: a row with nothing true to say is left out rather than given a
 * placeholder, so three rows means three real things.
 */
export function buildDigest(person: NotificationPersonalisation | undefined): string | null {
  if (!person) return null;
  const rows: string[] = [];

  if (person.dayProjection) rows.push(`Body · ${toDigestRow(person.dayProjection)}`);

  if (typeof person.keysAvailable === 'number' && person.keysAvailable > 0) {
    const k = person.keysAvailable;
    rows.push(
      person.keysAtCap
        ? `Keys · ${k} ready, and no more will stack`
        : `Keys · ${k} ready, next in ${formatTimeUntilNextKey()}`,
    );
  }

  if (typeof person.streak === 'number' && person.streak > 0) {
    rows.push(`Streak · ${person.streak} ${person.streak === 1 ? 'day' : 'days'}, today not counted yet`);
  }

  if (person.unvisitedPlace) rows.push(`Saved · ${person.unvisitedPlace}, still not visited`);

  // Two rows is the minimum that reads as a digest rather than a stray line.
  return rows.length >= 2 ? rows.slice(0, 4).join('\n') : null;
}

/**
 * Rewrite a projection sentence into a digest row.
 *
 * The standalone sentence and the labelled row want different grammar —
 * "Your heart will beat about 67,200 more times before midnight" is right on
 * its own and wrong after "Body · ". Rewriting the whole phrase rather than
 * trimming a prefix is what keeps the row readable; trimming left fragments
 * like "about 67,200 more times before midnight", which names no subject at
 * all.
 */
const ROW_FORMS: [RegExp, string][] = [
  [/^Your heart will beat about ([\d,]+) more times.*$/, 'about $1 heartbeats left today'],
  [/^You have roughly ([\d,]+) breaths left.*$/,         'roughly $1 breaths left today'],
  [/^You will blink around ([\d,]+) more times.*$/,      'around $1 blinks left today'],
  [/^About ([\d,]+) steps are still ahead.*$/,           'about $1 steps still ahead'],
  [/^Another ([\d.]+) hours of screen time.*$/,          '$1h of screen time left, on average'],
];

function toDigestRow(line: string): string {
  for (const [pattern, form] of ROW_FORMS) {
    if (pattern.test(line)) return line.replace(pattern, form);
  }
  // Unknown phrasing: keep the sentence whole rather than mangle it.
  return line.replace(/\.$/, '');
}

const STAT_TITLES = [
  'Your number for today',
  'Something from your life',
  'A new number is ready',
  'Have you ever counted this?',
  'One thing about today',
  'Your life, measured',
];

const STAT_BODIES = [
  'One number from your life that nobody has ever counted for you.',
  'It has been adding up since the day you were born.',
  'You produced this figure without once thinking about it.',
  'Everything in it already happened. You just have not seen the total.',
  'The counting is done. The number is waiting.',
];

const CATEGORY_HOOKS: Record<string, string[]> = {
  time: [
    'How much time have you actually lived? The answer might recalibrate your day.',
    'A unit of time you’ve never counted before. It’s bigger than you’d guess.',
    'You’ve been alive for a while. Today’s number puts it into perspective.',
    'Time only moves one direction. Today’s number tracks how far you’ve come.',
  ],
  body: [
    'Your body has been doing something every second of your life. Today’s number is the count.',
    'Something your body did 1,000+ times today alone, across your whole life.',
    'Your body kept a quiet tally. Today you get to see it.',
    'A number your body produced without you ever asking it to.',
  ],
  habits: [
    'One of your daily habits, totalled across every day you’ve been alive.',
    'A small daily ritual, compounded into a single staggering number.',
    'You do this every day without thinking. Across your life, it adds up.',
    'Something you’ve done thousands of times. Today’s number proves it.',
  ],
  social: [
    'Something you do every day. Never counted. Until now.',
    'A number that says more about how you live than your age ever could.',
    'The social side of your life, measured in a way you’ve never seen before.',
    'You’ve shared this world with a lot of people. Today’s number tracks part of how.',
  ],
};

const STREAK_BODIES = [
  'Today has not been counted yet.',
  'One number keeps it going.',
  'The chain holds until midnight.',
  'It takes one tap to keep.',
  'Still unbroken. Today is the only day that can change that.',
];

// ─── Helpers ──────────────────────────────────────────────────

/** Deterministic per-day pick: stable within a day, different each day. */
function pickByDay<T>(arr: T[], offset = 0): T {
  const start     = new Date(new Date().getFullYear(), 0, 0).getTime();
  const dayOfYear = Math.floor((Date.now() - start) / 86_400_000);
  return arr[(dayOfYear + offset) % arr.length];
}

function parseTime(time: string): { hour: number; minute: number } {
  const [h, m] = (time ?? '').split(':').map(Number);
  return {
    hour:   Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 8,
    minute: Number.isFinite(m) ? Math.min(59, Math.max(0, m)) : 0,
  };
}

/**
 * The device's IANA time zone, e.g. "Asia/Kolkata".
 *
 * Synced to the server so push-daily-stat can fire at the user's LOCAL time.
 * Previously the server treated `notificationTime` as UTC, so every signed-in
 * user outside UTC got their daily notification at the wrong hour.
 */
export function getDeviceTimeZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && tz.includes('/')) return tz;
  } catch {
    // Intl unavailable — fall through.
  }
  return 'UTC';
}

async function hasPermission(): Promise<boolean> {
  const N = getNotifications();
  const { status } = await N.getPermissionsAsync();
  return status === 'granted';
}

async function cancelById(ids: string[]): Promise<void> {
  const N = getNotifications();
  await Promise.all(
    ids.map((id) =>
      N.cancelScheduledNotificationAsync(id).catch(() => {
        /* not scheduled */
      }),
    ),
  );
}

// ─── Personalisation ──────────────────────────────────────────

export interface NotificationPersonalisation {
  name?:   string;
  /** Current streak — personalises the title from 3 days up. */
  streak?: number;
  /** Category of tomorrow's stat, for a category-specific curiosity hook. */
  nextStatCategory?: string;
  /** Tomorrow's stat id, so a tap deep-links straight to it. */
  nextStatId?: string;
  /**
   * The actual figure behind the next number.
   *
   * Used for its SIZE, never printed — see `magnitudeHook`. A notification
   * that says "today's number has ten digits" is specific and true and still
   * leaves the reveal intact; one that prints the figure has given away the
   * only thing the user was going to open the app for.
   */
  nextStatValue?: number;
  /** Title of a place the user saved and never visited. */
  unvisitedPlace?: string;
  /**
   * One sentence about what is still going to happen to this person before
   * midnight, computed on-device from their own profile.
   *
   * This is deliberately where "local context" comes from instead of weather
   * or city data: it needs no location, no network and no new declaration,
   * and it is more personal than either.
   */
  dayProjection?: string;
  /** Keys available right now. */
  keysAvailable?: number;
  /** True when the key bank is full, so further days accrue nothing. */
  keysAtCap?: boolean;
}

// ─── Public API ───────────────────────────────────────────────

/** Cancel every locally-scheduled Gati notification. */
export async function cancelAllLocalNotifications(): Promise<void> {
  if (IS_EXPO_GO) return;
  await cancelById(ALL_LOCAL_IDS);
}

/** Back-compat alias. */
export const cancelAllGatiNotifications = cancelAllLocalNotifications;

/**
 * Cancel then re-schedule the daily stat and streak-saver notifications.
 * Exits silently without permission — call `requestAndSchedule` first.
 */
export async function scheduleGatiNotifications(
  time:    string,
  person?: NotificationPersonalisation,
): Promise<void> {
  if (IS_EXPO_GO) return;
  const N = getNotifications();
  if (!(await hasPermission())) return;

  await ensureAndroidChannels();
  await cancelById([NOTIF_STAT, NOTIF_STREAK]);

  const { hour, minute } = parseTime(time);
  const streak   = person?.streak ?? 0;
  const category = person?.nextStatCategory;

  // ── Daily stat ───────────────────────────────────────────
  let title: string;
  let body:  string;

  const magnitude = magnitudeHook(person?.nextStatValue);
  const keys      = person?.keysAvailable ?? 0;
  const atCap     = person?.keysAtCap === true;
  const place     = person?.unvisitedPlace;

  /**
   * Priority order, most-at-stake first.
   *
   * A full key bank goes above everything because it is the only case where
   * waiting actively costs the user something: keys stop accruing at the cap,
   * so every further day throws one away. That is real loss, not invented
   * urgency, and it is the one message worth interrupting someone for.
   */
  const digest = buildDigest(person);

  if (atCap && keys > 0) {
    title = `${keys} keys, and they have stopped stacking`;
    body  = digest ?? 'You earn one a day up to three. At three, tomorrow’s is lost.';
  } else if (streak >= 14) {
    title = `${streak} days without missing one`;
    body  = digest ?? person?.dayProjection ?? magnitude ?? 'Today has not been counted yet.';
  } else if (streak >= 7) {
    title = `Day ${streak}`;
    body  = digest ?? magnitude ?? pickByDay(STREAK_BODIES, 2);
  } else if (streak >= 3) {
    title = `Day ${streak} in a row`;
    body  = magnitude
      ?? pickByDay((category ? CATEGORY_HOOKS[category] : undefined) ?? STAT_BODIES, 2);
  } else if (person?.dayProjection && magnitude) {
    // The best pairing available: what is still ahead of them today, and how
    // big the number waiting in the app is. Both true, both about them, and
    // neither gives the number away.
    title = person.dayProjection;
    body  = digest ?? magnitude;
  } else if (person?.dayProjection) {
    title = person.dayProjection;
    body  = pickByDay((category ? CATEGORY_HOOKS[category] : undefined) ?? STAT_BODIES, 3);
  } else if (magnitude) {
    // The strongest opener for someone with no streak to protect: a true,
    // specific fact about the size of their own number.
    title = magnitude;
    body  = pickByDay((category ? CATEGORY_HOOKS[category] : undefined) ?? STAT_BODIES, 3);
  } else if (place) {
    // No number worth teasing — point them at something they chose themselves.
    title = `You saved ${place}`;
    body  = 'And never went. It is still there.';
  } else {
    title = pickByDay(STAT_TITLES);
    body  = pickByDay((category ? CATEGORY_HOOKS[category] : undefined) ?? STAT_BODIES, 3);
  }

  await N.scheduleNotificationAsync({
    identifier: NOTIF_STAT,
    content: {
      title,
      body,
      sound: true,
      data:  { type: 'daily_stat', statId: person?.nextStatId ?? null },
      ...(Platform.OS === 'android' ? { channelId: CHANNELS.daily } : {}),
    },
    trigger: {
      type:    N.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      ...(Platform.OS === 'android' ? { channelId: CHANNELS.daily } : {}),
    },
  });

  // ── Streak saver — ONE-SHOT for tomorrow evening ─────────
  // A daily repeating trigger fired even on days the user had already opened
  // the app, which trains people to ignore notifications. Each app open now
  // re-arms a single shot for tomorrow: open tomorrow and it gets pushed
  // another day; don't, and it fires exactly when it is actually needed.
  const STREAK_HOUR   = 20;
  const STREAK_MINUTE = 0;

  // Skip when the daily notification already lands at 8pm.
  if (hour === STREAK_HOUR && minute === STREAK_MINUTE) return;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(STREAK_HOUR, STREAK_MINUTE, 0, 0);

  await N.scheduleNotificationAsync({
    identifier: NOTIF_STREAK,
    content: {
      title: streak >= 3
        ? `${streak} days. Today is not counted yet`
        : 'Today is not counted yet',
      body:  pickByDay(STREAK_BODIES, 7),
      sound: false,
      data:  { type: 'streak_saver' },
      ...(Platform.OS === 'android' ? { channelId: CHANNELS.streak } : {}),
    },
    trigger: {
      type: N.SchedulableTriggerInputTypes.DATE,
      date: tomorrow,
      ...(Platform.OS === 'android' ? { channelId: CHANNELS.streak } : {}),
    },
  });
}

/**
 * Called on every app open. Picks the delivery path and keeps copy fresh.
 *
 * @param serverPushEnabled true when the user is signed in AND this device has
 *   a registered push token. Only then are local notifications cancelled —
 *   cancelling them on sign-in alone left users with no notifications at all
 *   whenever token registration failed.
 */
export async function refreshNotificationsOnOpen(
  time:    string,
  person?: NotificationPersonalisation,
  serverPushEnabled = false,
): Promise<void> {
  if (IS_EXPO_GO) return;
  try {
    await ensureAndroidChannels();
    if (serverPushEnabled) {
      await cancelAllLocalNotifications();
      return;
    }
    await scheduleGatiNotifications(time, person);
  } catch {
    // Notification plumbing must never crash the app.
  }
}

/**
 * Request permission, then schedule. Idempotent.
 * @returns true when permission is granted.
 */
export async function requestAndSchedule(
  time:    string,
  person?: NotificationPersonalisation,
): Promise<boolean> {
  if (IS_EXPO_GO) return false;
  const N = getNotifications();

  let { status, canAskAgain } = await N.getPermissionsAsync();
  if (status !== 'granted' && canAskAgain) {
    const result = await N.requestPermissionsAsync();
    status = result.status;
  }
  if (status !== 'granted') return false;

  await ensureAndroidChannels();
  await scheduleGatiNotifications(time, person);
  return true;
}

// ─── Weekly digest ────────────────────────────────────────────

export interface WeeklyDigestData {
  daysOpenedThisWeek: number;
  currentStreak:      number;
  totalPlacesSaved:   number;
}

/**
 * Schedule (or replace) the Sunday 9am weekly recap.
 * Re-called on each open so the body reflects the current week.
 */
export async function scheduleWeeklyDigest(data: WeeklyDigestData): Promise<void> {
  if (IS_EXPO_GO) return;
  const N = getNotifications();
  if (!(await hasPermission())) return;

  await ensureAndroidChannels();
  await cancelById([NOTIF_WEEKLY_DIGEST]);

  const { daysOpenedThisWeek, currentStreak, totalPlacesSaved } = data;

  let body: string;
  if (daysOpenedThisWeek >= 6) {
    body = `${daysOpenedThisWeek} of 7 days this week. That’s about as close to perfect as it gets.`;
  } else if (daysOpenedThisWeek >= 4) {
    const places = totalPlacesSaved > 0
      ? `, ${totalPlacesSaved} place${totalPlacesSaved === 1 ? '' : 's'} saved`
      : '';
    body = `${daysOpenedThisWeek} of 7 days this week${places}. Solid week.`;
  } else if (daysOpenedThisWeek >= 2) {
    body = currentStreak >= 3
      ? `${daysOpenedThisWeek} days this week — ${currentStreak}-day streak still alive.`
      : `${daysOpenedThisWeek} of 7 days this week. A new week is a clean slate.`;
  } else {
    body = 'A new week starts tomorrow. Your numbers are waiting.';
  }

  await N.scheduleNotificationAsync({
    identifier: NOTIF_WEEKLY_DIGEST,
    content: {
      title: 'Your week, in numbers',
      body,
      sound: false,
      data:  { type: 'weekly_digest' },
      ...(Platform.OS === 'android' ? { channelId: CHANNELS.digest } : {}),
    },
    trigger: {
      type:    N.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 1,   // Expo: 1 = Sunday
      hour:    9,
      minute:  0,
      ...(Platform.OS === 'android' ? { channelId: CHANNELS.digest } : {}),
    },
  });
}

// ─── Milestone prediction ─────────────────────────────────────

export interface MilestonePredictionData {
  milestoneId:    string;
  milestoneTitle: string;
  /** Days from today until the milestone is reached. */
  daysUntil:      number;
}

/**
 * Schedule (or replace) a one-shot notification for an imminent milestone,
 * firing at 9am on the morning the milestone lands.
 */
export async function scheduleMilestonePrediction(
  prediction: MilestonePredictionData,
): Promise<void> {
  if (IS_EXPO_GO) return;
  const N = getNotifications();
  if (!(await hasPermission())) return;

  await ensureAndroidChannels();
  await cancelById([NOTIF_MILESTONE_PRED]);

  const { milestoneTitle, daysUntil } = prediction;
  const title = daysUntil === 1 ? 'Tomorrow is a milestone day' : `${daysUntil} days to go`;
  const body  = daysUntil === 1
    ? `You’ll reach ${milestoneTitle} tomorrow. Worth showing up for.`
    : `In ${daysUntil} days, you’ll hit ${milestoneTitle}. Keep the streak alive.`;

  const fireAt = new Date();
  fireAt.setDate(fireAt.getDate() + (daysUntil - 1));
  fireAt.setHours(9, 0, 0, 0);
  if (fireAt.getTime() <= Date.now()) return; // already past

  await N.scheduleNotificationAsync({
    identifier: NOTIF_MILESTONE_PRED,
    content: {
      title,
      body,
      sound: true,
      data:  { type: 'milestone_prediction', milestoneId: prediction.milestoneId },
      ...(Platform.OS === 'android' ? { channelId: CHANNELS.milestone } : {}),
    },
    trigger: {
      type: N.SchedulableTriggerInputTypes.DATE,
      date: fireAt,
      ...(Platform.OS === 'android' ? { channelId: CHANNELS.milestone } : {}),
    },
  });
}

// ─── Server-side push ─────────────────────────────────────────

/**
 * Register this device's Expo push token so edge functions can reach it.
 *
 * Also syncs the device's IANA time zone, which is what lets the server fire
 * the daily notification at the user's LOCAL chosen hour.
 *
 * @returns true when a token was successfully registered. Callers use this to
 *   decide whether it is safe to cancel local notifications.
 */
export async function registerPushToken(userId: string): Promise<boolean> {
  if (IS_EXPO_GO) return false;
  try {
    const N = getNotifications();
    if (!(await hasPermission())) return false;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    if (!projectId) {
      if (__DEV__) console.warn('[notifications] Missing EAS projectId; cannot get a push token.');
      return false;
    }

    const tokenData = await N.getExpoPushTokenAsync({ projectId });
    const token     = tokenData.data;
    if (!token) return false;

    const { supabase } = await import('@/services/supabase');
    const { error } = await supabase.from('push_tokens').upsert(
      {
        user_id:    userId,
        token,
        platform:   Platform.OS,
        time_zone:  getDeviceTimeZone(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
    return !error;
  } catch (e) {
    // Non-fatal: local notifications remain the fallback.
    if (__DEV__) console.warn('[notifications] registerPushToken failed:', e);
    return false;
  }
}

/**
 * Remove this device's push token. Called on sign-out so the server stops
 * pushing to a device that is no longer signed in.
 */
export async function unregisterPushToken(userId: string): Promise<void> {
  if (IS_EXPO_GO) return;
  try {
    const { supabase } = await import('@/services/supabase');
    await supabase.from('push_tokens').delete().eq('user_id', userId);
  } catch {
    // Best effort.
  }
}

/**
 * Queue a server-side milestone push. The server fires it at 9am local time
 * on the day the milestone is reached.
 */
export async function scheduleServerMilestonePush(
  prediction: MilestonePredictionData,
): Promise<void> {
  if (IS_EXPO_GO) return;
  try {
    const { supabase } = await import('@/services/supabase');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.functions.invoke('schedule-milestone-push', { body: prediction });
  } catch (e) {
    if (__DEV__) console.warn('[notifications] scheduleServerMilestonePush failed:', e);
  }
}
