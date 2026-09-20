/**
 * push-streak-saver — Edge Function
 *
 * Runs daily at 20:00 UTC (cron: '0 20 * * *').
 * Sends a streak-saver push to users who have an active streak but haven't
 * opened the app today. Avoids nagging users who already opened.
 *
 * Streak computation from open_history_ranges (DateRange[] stored as JSONB):
 *   - A range is { s: "YYYY-MM-DD", e: "YYYY-MM-DD" }
 *   - Active streak = the last range ends yesterday or today
 *   - User has NOT opened today = today's ISO date is not in any range
 *
 * Deploy: supabase functions deploy push-streak-saver
 * Schedule: Supabase Dashboard → '0 20 * * *'
 */
// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { supabaseAdmin, validateCronSecret } from '../_shared/supabaseAdmin.ts';
import { sendPush }                          from '../_shared/epns.ts';

interface DateRange { s: string; e: string; }

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Today's calendar date in a given IANA time zone.
 *
 * The streak is stored as LOCAL calendar dates by the app, so comparing it
 * against a UTC date meant users west of UTC were told their streak was at
 * risk while it was still the previous day for them — and users far east were
 * checked a day late.
 */
function localISODate(now: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(now);
  } catch {
    return toISODate(now);   // unknown zone → fall back to UTC
  }
}

function previousISODate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return toISODate(d);
}

function streakFromRanges(ranges: DateRange[], asOfDate: string): number {
  if (!ranges.length) return 0;
  const last = ranges[ranges.length - 1];
  if (last.e !== asOfDate) return 0; // streak broken
  const start = new Date(last.s + 'T00:00:00Z');
  const end   = new Date(last.e + 'T00:00:00Z');
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

function hasOpenedToday(ranges: DateRange[], today: string): boolean {
  return ranges.some((r) => today >= r.s && today <= r.e);
}

const STREAK_COPIES = [
  "You've shown up every day. Don't stop now.",
  "Your streak is still alive — just barely.",
  "Every day matters. One tap keeps the chain.",
  "Don't break the chain. Today's number is waiting.",
  "Still here. Your streak is safe, for now.",
  "The hardest part is not breaking a perfect record.",
];

serve(async (req) => {
  if (!validateCronSecret(req)) return new Response('Unauthorized', { status: 401 });

  try {
    const now = new Date();

    const { data, error } = await supabaseAdmin.rpc('get_users_for_streak_check');
    if (error) throw error;
    if (!data?.length) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const dayNum  = Math.floor(now.getTime() / 86_400_000);
    const messages: Parameters<typeof sendPush>[0] = [];

    for (const row of data as any[]) {
      const ranges: DateRange[] = Array.isArray(row.open_history_ranges)
        ? row.open_history_ranges
        : [];

      // Evaluate against the user's own calendar day, not UTC's.
      const today     = localISODate(now, row.time_zone ?? 'UTC');
      const yesterday = previousISODate(today);

      // Skip if the user already opened today
      if (hasOpenedToday(ranges, today)) continue;

      // Compute streak as of yesterday
      const streak = streakFromRanges(ranges, yesterday);
      if (streak < 2) continue; // No meaningful streak to protect

      const title = streak >= 7
        ? `${streak}-day streak at risk`
        : `Day ${streak} — don't stop now`;
      const body  = STREAK_COPIES[dayNum % STREAK_COPIES.length];

      messages.push({
        to:    row.token as string,
        title,
        body,
        sound: null,
        channelId: 'streak',
        data:  { type: 'streak_saver' },
      });
    }

    const tickets = await sendPush(messages);
    const sent    = tickets.filter((t) => t.status === 'ok').length;
    console.log(`[push-streak-saver] candidates=${data.length} at-risk=${messages.length} sent=${sent}`);

    return new Response(JSON.stringify({ sent, atRisk: messages.length }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[push-streak-saver]', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status:  500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
