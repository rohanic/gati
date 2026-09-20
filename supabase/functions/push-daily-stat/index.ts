/**
 * push-daily-stat — Edge Function
 *
 * Runs every hour (cron: '0 * * * *').
 * Finds users whose notificationTime hour matches the current UTC hour,
 * computes a personalized life stat from their profile, and sends via EPNS.
 *
 * Note: notificationTime is treated as UTC in Phase 2.
 * Timezone-aware scheduling is planned for Phase 3.
 *
 * Deploy: supabase functions deploy push-daily-stat
 * Schedule: Supabase Dashboard → Edge Functions → push-daily-stat → Schedule → '0 * * * *'
 */
// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { supabaseAdmin, validateCronSecret } from '../_shared/supabaseAdmin.ts';
import { sendPush }                          from '../_shared/epns.ts';

// ── Stat computation ──────────────────────────────────────────
// Rotates through 6 high-impact stats that are computable from profile alone.
// Uses day-of-year as a seed so each user sees a different stat each day.

interface UserProfile {
  dateOfBirth:       string;  // "YYYY-MM-DD"
  coffeeCupsPerDay:  number;
  sleepHoursPerNight: number;
  mealsPerDay:       number;
  phoneHoursPerDay:  number;
  firstName?:        string;
}

function daysAlive(dob: string, now: Date): number {
  const birth = new Date(dob + 'T00:00:00Z');
  return Math.max(0, Math.floor((now.getTime() - birth.getTime()) / 86_400_000));
}

function dayOfYear(now: Date): number {
  const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 0));
  return Math.floor((now.getTime() - start.getTime()) / 86_400_000);
}

function fmtNum(n: number): string {
  return n.toLocaleString('en-US');
}

function computeFeaturedStat(
  profile: UserProfile,
  now: Date,
): { title: string; body: string } {
  const days       = daysAlive(profile.dateOfBirth, now);
  const heartbeats = days * 70 * 60 * 24;
  const coffee     = Math.floor(days * (profile.coffeeCupsPerDay  ?? 2));
  const meals      = Math.floor(days * (profile.mealsPerDay       ?? 3));
  const sleepHrs   = Math.floor(days * (profile.sleepHoursPerNight ?? 7));
  const phoneHrs   = Math.floor(days * (profile.phoneHoursPerDay  ?? 4));
  const words      = Math.floor(days * 7_000);  // ~7k words/day average

  const stats = [
    {
      title: `${fmtNum(days)} days alive`,
      body:  `You've been alive for ${fmtNum(days)} days. Most people never stop to count.`,
    },
    {
      title: `${(heartbeats / 1_000_000_000).toFixed(2)}B heartbeats`,
      body:  `Your heart has beaten ${fmtNum(heartbeats)} times. Not once on purpose.`,
    },
    {
      title: `${fmtNum(coffee)} cups of coffee`,
      body:  `${fmtNum(coffee)} cups of coffee across your entire life. Some rituals become inseparable from who you are.`,
    },
    {
      title: `${fmtNum(sleepHrs)} hours asleep`,
      body:  `You've spent ${fmtNum(sleepHrs)} hours asleep — roughly ${Math.round(sleepHrs / 24 / 365)} years of your life.`,
    },
    {
      title: `${fmtNum(meals)} meals`,
      body:  `${fmtNum(meals)} meals, across a lifetime of breakfast, lunch, and dinner. The small rituals add up.`,
    },
    {
      // Was `${fmtNum(words)} million words`, which rendered as
      // "70,810,000 million words".
      title: `${(words / 1_000_000).toFixed(1)} million words`,
      body:  `You've spoken roughly ${(words / 1_000_000).toFixed(1)} million words in your life. Give or take a few arguments.`,
    },
  ];

  const index = (dayOfYear(now) + days) % stats.length;
  return stats[index];
}

// ── Handler ───────────────────────────────────────────────────

serve(async (req) => {
  if (!validateCronSecret(req)) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const now = new Date();

    // Timezone-aware targeting: the SQL function compares each user's chosen
    // hour against the current hour in THEIR time zone. The previous version
    // matched against the current UTC hour, so every signed-in user outside
    // UTC received their "8am" notification at the wrong time of day.
    const { data, error } = await supabaseAdmin.rpc(
      'get_users_for_local_notification_hour',
    );

    if (error) throw error;
    if (!data || data.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const messages = (data as any[]).map((row: any) => {
      const { title, body } = computeFeaturedStat(row.profile as UserProfile, now);
      return {
        to:    row.token as string,
        title,
        body,
        sound: 'default' as const,
        channelId: 'daily-stat',
        data:  { type: 'daily_stat' },
      };
    });

    const tickets = await sendPush(messages);
    const sent    = tickets.filter((t) => t.status === 'ok').length;

    console.log(`[push-daily-stat] candidates=${data.length} sent=${sent}`);

    return new Response(JSON.stringify({ sent, total: data.length }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[push-daily-stat]', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status:  500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
