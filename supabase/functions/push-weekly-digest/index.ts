/**
 * push-weekly-digest — Edge Function
 *
 * Runs every Sunday at 09:00 UTC (cron: '0 9 * * 0').
 * Summarises the user's week: how many days they opened the app,
 * their current streak, and a motivating message.
 *
 * Deploy: supabase functions deploy push-weekly-digest
 * Schedule: Supabase Dashboard → '0 9 * * 0'
 */
// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { supabaseAdmin, validateCronSecret } from '../_shared/supabaseAdmin.ts';
import { sendPush }                          from '../_shared/epns.ts';

interface DateRange { s: string; e: string; }

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Today's calendar date in a given IANA time zone (see push-streak-saver). */
function localISODate(now: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(now);
  } catch {
    return toISODate(now);
  }
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

/** Count calendar dates in [weekStart, weekEnd] that fall within any range. */
function countDaysInWeek(
  ranges: DateRange[],
  weekStart: string,
  weekEnd: string,
): number {
  let count = 0;
  let cur   = new Date(weekStart + 'T00:00:00Z');
  const end = new Date(weekEnd   + 'T00:00:00Z');

  while (cur <= end) {
    const d = toISODate(cur);
    if (ranges.some((r) => d >= r.s && d <= r.e)) count++;
    cur = new Date(cur.getTime() + 86_400_000);
  }
  return count;
}

/** Length of the active streak as of today (0 if broken). */
function currentStreak(ranges: DateRange[], today: string): number {
  if (!ranges.length) return 0;
  const last = ranges[ranges.length - 1];
  if (last.e < today) return 0;  // hasn't opened today
  const start = new Date(last.s + 'T00:00:00Z');
  const end   = new Date(last.e + 'T00:00:00Z');
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

function buildDigestCopy(daysOpened: number, streak: number): { title: string; body: string } {
  const title = 'Your week, in numbers';
  let body: string;

  if (daysOpened >= 6) {
    body = `${daysOpened} of 7 days this week. That's about as close to perfect as it gets.`;
  } else if (daysOpened >= 4) {
    body = streak > 0
      ? `${daysOpened} of 7 days — ${streak}-day streak still going.`
      : `${daysOpened} of 7 days this week. Solid.`;
  } else if (daysOpened >= 2) {
    body = streak >= 3
      ? `${daysOpened} days this week — ${streak}-day streak alive. New week ahead.`
      : `${daysOpened} of 7 days. A new week is a clean slate.`;
  } else if (daysOpened === 1) {
    body = 'You showed up once this week. Once is always better than none.';
  } else {
    body = 'A new week starts today. Your numbers are waiting.';
  }

  return { title, body };
}

serve(async (req) => {
  if (!validateCronSecret(req)) return new Response('Unauthorized', { status: 401 });

  try {
    const now = new Date();

    const { data, error } = await supabaseAdmin.rpc('get_users_for_weekly_digest');
    if (error) throw error;
    if (!data?.length) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const messages: Parameters<typeof sendPush>[0] = [];

    for (const row of data as any[]) {
      const ranges: DateRange[] = Array.isArray(row.open_history_ranges)
        ? row.open_history_ranges
        : [];

      // Week = Mon–Sun ending today, in the user's own time zone.
      const today     = localISODate(now, row.time_zone ?? 'UTC');
      const weekStart = addDays(today, -6);

      const daysOpened = countDaysInWeek(ranges, weekStart, today);
      const streak     = currentStreak(ranges, today);
      const { title, body } = buildDigestCopy(daysOpened, streak);

      messages.push({
        to:    row.token as string,
        title,
        body,
        sound: null,
        channelId: 'weekly-digest',
        data:  { type: 'weekly_digest' },
      });
    }

    const tickets = await sendPush(messages);
    const sent    = tickets.filter((t) => t.status === 'ok').length;
    console.log(`[push-weekly-digest] users=${data.length} sent=${sent}`);

    return new Response(JSON.stringify({ sent, total: data.length }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[push-weekly-digest]', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status:  500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
