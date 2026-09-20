/**
 * Expo Push Notification Service (EPNS) helper.
 *
 * Sends batches of push messages to https://exp.host/--/api/v2/push/send.
 * EPNS accepts up to 100 messages per request; this module handles chunking.
 *
 * No SDK required — plain HTTP POST with JSON.
 */

export interface EpnsMessage {
  /** ExponentPushToken[xxxx] — obtained from Notifications.getExpoPushTokenAsync() */
  to:      string;
  title:   string;
  body:    string;
  data?:   Record<string, unknown>;
  sound?:  'default' | null;
  badge?:  number;
  /**
   * Android notification channel id. Must match a channel the app created
   * (see CHANNELS in src/services/notifications.ts) — otherwise Android 8+
   * drops the notification into a generic channel the user cannot tune
   * separately, which is what drives people to disable notifications wholesale.
   */
  channelId?: string;
  /** iOS: keep notification visible until tapped */
  sticky?: boolean;
}

export interface EpnsTicket {
  status:  'ok' | 'error';
  id?:     string;
  message?: string;
  details?: Record<string, unknown>;
}

const EPNS_URL = 'https://exp.host/--/api/v2/push/send';
const CHUNK_SIZE = 100;

/**
 * Send one or more push messages.
 * Returns the EPNS ticket array (useful for debugging; not required to act on).
 * Throws on network error; silently logs EPNS-level errors per message.
 */
export async function sendPush(messages: EpnsMessage[]): Promise<EpnsTicket[]> {
  if (messages.length === 0) return [];

  const tickets: EpnsTicket[] = [];
  const chunks = chunk(messages, CHUNK_SIZE);

  for (const batch of chunks) {
    const res = await fetch(EPNS_URL, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Accept':        'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(batch),
    });

    if (!res.ok) {
      console.error(`[epns] HTTP ${res.status}:`, await res.text());
      continue;
    }

    const json: { data: EpnsTicket[] } = await res.json();
    for (const ticket of json.data ?? []) {
      if (ticket.status === 'error') {
        console.error('[epns] ticket error:', ticket.message, ticket.details);
      }
      tickets.push(ticket);
    }
  }

  return tickets;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
