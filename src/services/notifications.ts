import type * as NotificationsType from 'expo-notifications';
import Constants from 'expo-constants';

// expo-notifications has no functional support in Expo Go since SDK 53.
// Guard every exported function so nothing throws in that environment.
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

function getNotifications(): typeof NotificationsType {
  return require('expo-notifications');
}

const NOTIF_IDENTIFIER_STAT   = 'gati-daily-stat';
const NOTIF_IDENTIFIER_STREAK = 'gati-streak-saver';

const STAT_TITLES = [
  'Your daily number is ready',
  'A new number from your life',
  "Time for today's life stat",
  'Something surprising is waiting',
];

function parseTime(time: string): { hour: number; minute: number } {
  const [h, m] = time.split(':').map(Number);
  return { hour: h ?? 8, minute: m ?? 0 };
}

async function cancelGatiNotifications(): Promise<void> {
  const Notifications = getNotifications();
  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIF_IDENTIFIER_STAT);
  } catch { /* not scheduled — fine */ }
  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIF_IDENTIFIER_STREAK);
  } catch { /* not scheduled — fine */ }
}

export async function scheduleGatiNotifications(time: string): Promise<void> {
  if (IS_EXPO_GO) return;
  const Notifications = getNotifications();
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  await cancelGatiNotifications();

  const { hour, minute } = parseTime(time);

  const statTitle = STAT_TITLES[new Date().getDay() % STAT_TITLES.length];
  await Notifications.scheduleNotificationAsync({
    identifier: NOTIF_IDENTIFIER_STAT,
    content: {
      title: statTitle,
      body:  "Tap to discover today's number.",
      sound: true,
      data:  { type: 'daily_stat' },
    },
    trigger: {
      type:   Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });

  const streakHour   = 20;
  const streakMinute = 0;
  if (hour !== streakHour || minute !== streakMinute) {
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIF_IDENTIFIER_STREAK,
      content: {
        title: 'Keep your streak going',
        body:  'Open Gati to keep your streak alive.',
        sound: false,
        data:  { type: 'streak_saver' },
      },
      trigger: {
        type:   Notifications.SchedulableTriggerInputTypes.DAILY,
        hour:   streakHour,
        minute: streakMinute,
      },
    });
  }
}

export async function cancelAllGatiNotifications(): Promise<void> {
  if (IS_EXPO_GO) return;
  await cancelGatiNotifications();
}
