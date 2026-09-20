/**
 * push-scheduled — Edge Function
 *
 * Runs every hour (cron: '0 * * * *').
 * Processes the scheduled_pushes table: finds rows where fire_at <= now()
 * and sent = false, sends each push, marks them as sent atomically via
 * the claim_due_scheduled_pushes() SQL function.
 *
 * Currently handles:
 *   type: 'milestone_prediction'
 *     payload: { milestoneId, milestoneTitle, daysUntil (at schedule time) }
 *
 * Deploy: supabase functions deploy push-scheduled
 * Schedule: Supabase Dashboard → '0 * * * *'
 */
// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { supabaseAdmin, validateCronSecret } from '../_shared/supabaseAdmin.ts';
import { sendPush }                          from '../_shared/epns.ts';

function buildMilestonePush(payload: any): { title: string; body: string } {
  const { milestoneTitle } = payload as { milestoneId: string; milestoneTitle: string };
  return {
    title: 'A milestone day is here',
    body:  `Today you reach ${milestoneTitle}. Worth opening Gati to see it.`,
  };
}

serve(async (req) => {
  if (!validateCronSecret(req)) return new Response('Unauthorized', { status: 401 });

  try {
    // Atomically claims due rows and marks them sent in one SQL call
    const { data, error } = await supabaseAdmin.rpc('claim_due_scheduled_pushes');
    if (error) throw error;
    if (!data?.length) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const messages: Parameters<typeof sendPush>[0] = [];

    for (const row of data as any[]) {
      let push: { title: string; body: string } | null = null;

      switch (row.type) {
        case 'milestone_prediction':
          push = buildMilestonePush(row.payload);
          break;
        default:
          console.warn('[push-scheduled] unknown type:', row.type);
      }

      if (push) {
        messages.push({
          to:    row.token as string,
          title: push.title,
          body:  push.body,
          sound: 'default' as const,
          channelId: 'milestones',
          data:  { type: row.type, ...row.payload },
        });
      }
    }

    const tickets = await sendPush(messages);
    const sent    = tickets.filter((t) => t.status === 'ok').length;
    console.log(`[push-scheduled] claimed=${data.length} sent=${sent}`);

    return new Response(JSON.stringify({ sent, claimed: data.length }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[push-scheduled]', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status:  500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
