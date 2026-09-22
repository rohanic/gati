#!/usr/bin/env node
/**
 * Probe the live backend and say what is actually working.
 *
 * Written because "the command finished" and "the thing works" kept turning
 * out to be different: db push succeeded while 005 had not applied, functions
 * deployed while nearby-places answered "not configured", and the cron
 * template would have returned 401 on every call while pg_cron recorded each
 * run as a success.
 *
 * Checks only what can be proven from outside. Anything it cannot reach says
 * so rather than guessing.
 *
 *   node scripts/verify-backend.mjs
 */
import { readFileSync, existsSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);

const URL = env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!URL || !KEY) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY in .env');
  process.exit(1);
}

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const pass = [], fail = [], manual = [];
const ok   = (m) => { pass.push(m);   console.log(`  \x1b[32m✓\x1b[0m ${m}`); };
const bad  = (m, fix) => { fail.push({ m, fix }); console.log(`  \x1b[31m✗\x1b[0m ${m}`); };
const note = (m) => { manual.push(m); console.log(`  \x1b[33m?\x1b[0m ${m}`); };

async function code(path, init) {
  try {
    const r = await fetch(`${URL}${path}`, { headers: H, ...init });
    return r.status;
  } catch { return 0; }
}

console.log('\n\x1b[1mSchema\x1b[0m');
for (const t of ['user_data', 'push_tokens', 'place_ratings', 'purchases', 'places_cache', 'api_usage']) {
  const s = await code(`/rest/v1/${t}?select=*&limit=1`);
  s === 404 ? bad(`table ${t} missing`, 'supabase db push') : ok(`table ${t}`);
}
for (const c of ['pro_expires_at', 'pro_product_id', 'saved_stat_ids']) {
  const s = await code(`/rest/v1/user_data?select=${c}&limit=1`);
  s === 400 ? bad(`user_data.${c} missing`, 'supabase db push') : ok(`user_data.${c}`);
}

console.log('\n\x1b[1mEdge functions\x1b[0m');
// The expected code IS the assertion: 401 proves the gate works, 404 proves
// nothing is deployed, and 500 usually means a missing secret.
const EXPECT = {
  'nearby-places':           [200, 400],
  'place-photo':             [405, 400],
  'verify-purchase':         [401],
  'delete-account':          [400, 401],
  'ai-place-pick':           [401, 400],
  'push-daily-stat':         [401],
  'push-scheduled':          [401],
  'push-streak-saver':       [401],
  'push-weekly-digest':      [401],
  'schedule-milestone-push': [401, 400],
};
for (const [fn, expected] of Object.entries(EXPECT)) {
  const s = await code(`/functions/v1/${fn}`, { method: 'POST', body: '{}' });
  if (s === 404) bad(`${fn} not deployed`, 'supabase functions deploy');
  else if (expected.includes(s)) ok(`${fn} (${s})`);
  else bad(`${fn} returned ${s}, expected ${expected.join(' or ')}`, 'check its logs in the dashboard');
}

console.log('\n\x1b[1mPlace search\x1b[0m');
try {
  const r = await fetch(`${URL}/functions/v1/nearby-places`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ latitude: 12.9716, longitude: 77.5946, radius: 10000 }),
  });
  const body = await r.json();
  if (body?.error) bad(`nearby-places: ${body.error}`, 'supabase secrets set GOOGLE_PLACES_KEY=...');
  else {
    const places = body.places ?? body;
    Array.isArray(places) && places.length
      ? ok(`returns ${places.length} real places`)
      : bad('returned no places', 'check the key is enabled for the Places API');
  }
} catch (e) { bad(`nearby-places unreachable: ${e.message}`, ''); }

console.log('\n\x1b[1mAuth\x1b[0m');
try {
  const s = await (await fetch(`${URL}/auth/v1/settings`, { headers: H })).json();
  s?.external?.google ? ok('Google provider enabled') : bad('Google provider disabled', 'enable it in Authentication → Providers');
  s?.external?.email  ? ok('Email OTP enabled') : bad('Email sign-in disabled', '');
} catch { bad('could not read auth settings', ''); }
note('redirect allow-list must contain gati://auth/callback — Supabase only validates it after Google returns, so it cannot be probed');

console.log('\n\x1b[1mPush delivery\x1b[0m');
if (existsSync('google-services.json')) {
  try {
    const g = JSON.parse(readFileSync('google-services.json', 'utf8'));
    const pkgs = (g.client ?? []).map((c) => c?.client_info?.android_client_info?.package_name);
    pkgs.includes('com.gati.app')
      ? ok('google-services.json present, package matches com.gati.app')
      : bad(`google-services.json is for ${pkgs.join(', ') || 'no package'}, not com.gati.app`,
            'download it again from the Firebase Android app for com.gati.app');
  } catch { bad('google-services.json is not valid JSON', 're-download it from Firebase'); }
} else {
  bad('google-services.json missing — tokens register, nothing is delivered',
      'Firebase → add Android app com.gati.app → download to project root');
}
note('FCM V1 key upload cannot be checked from here — run: eas credentials');

console.log('\n\x1b[1mScheduled push\x1b[0m');
note('cron.job is not exposed over REST — run the verify queries in supabase/cron-setup.sql');

console.log(`\n\x1b[1m${pass.length} passing, ${fail.length} failing, ${manual.length} to check by hand\x1b[0m`);
if (fail.length) {
  console.log('\n\x1b[1mTo fix:\x1b[0m');
  for (const { m, fix } of fail) console.log(`  • ${m}${fix ? `\n      ${fix}` : ''}`);
}
process.exit(fail.length ? 1 : 0);
