/**
 * schedule-milestone-push — Edge Function (client-callable)
 *
 * Called by the Gati app when it detects an upcoming milestone.
 * Creates (or updates) a row in scheduled_pushes so push-scheduled will
 * fire the notification at 09:00 UTC on the day of the milestone.
 *
 * Auth: requires the user's JWT in the Authorization header
 *       (supabase.functions.invoke() sends it automatically).
 *
 * Body: MilestonePredictionData
 *   { milestoneId: string, milestoneTitle: string, daysUntil: number }
 *
 * Deploy: supabase functions deploy schedule-milestone-push
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { supabaseAdmin, getUserFromRequest } from '../_shared/supabaseAdmin.ts';

interface MilestonePredictionData {
  milestoneId:    string;
  milestoneTitle: string;
  daysUntil:      number;  // days from today until the milestone
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const user = await getUserFromRequest(req);
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  let prediction: MilestonePredictionData;
  try {
    prediction = await req.json();
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  const { milestoneId, milestoneTitle, daysUntil } = prediction;

  if (
    !milestoneId ||
    typeof milestoneId !== 'string' ||
    milestoneId.length > 64 ||
    typeof daysUntil !== 'number' ||
    !Number.isFinite(daysUntil) ||
    daysUntil < 1 ||
    daysUntil > 365
  ) {
    return new Response('Invalid prediction payload', { status: 422 });
  }

  // Fire at 09:00 UTC on the day the milestone is reached
  // daysUntil=1 → fires tomorrow morning; daysUntil=7 → fires in 6 days
  const fireAt = new Date();
  fireAt.setUTCDate(fireAt.getUTCDate() + daysUntil);
  fireAt.setUTCHours(9, 0, 0, 0);

  // One pending push per user per milestone. The delete previously omitted
  // the milestoneId filter, so scheduling a prediction for one milestone
  // silently cancelled every other pending milestone the user had queued.
  await supabaseAdmin
    .from('scheduled_pushes')
    .delete()
    .eq('user_id', user.id)
    .eq('type', 'milestone_prediction')
    .eq('sent', false)
    .eq('payload->>milestoneId', milestoneId);

  const { error } = await supabaseAdmin
    .from('scheduled_pushes')
    .insert({
      user_id: user.id,
      type:    'milestone_prediction',
      payload: { milestoneId, milestoneTitle, daysUntil },
      fire_at: fireAt.toISOString(),
    });

  if (error) {
    console.error('[schedule-milestone-push]', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status:  500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  console.log(
    `[schedule-milestone-push] user=${user.id} milestone=${milestoneId}` +
    ` daysUntil=${daysUntil} fireAt=${fireAt.toISOString()}`,
  );

  return new Response(
    JSON.stringify({ ok: true, fireAt: fireAt.toISOString() }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
