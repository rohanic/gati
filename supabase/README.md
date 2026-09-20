# Gati backend

Everything here runs on Supabase: Postgres (with RLS), Edge Functions (Deno),
and pg_cron for scheduled push.

> **The app will not behave correctly until migration `005` is applied and the
> secrets below are set.** Entitlement enforcement, place search, and account
> deletion all depend on them.

---

## 1. Migrations

Apply in order:

| File | What it adds |
|---|---|
| `001_initial.sql` | `user_data`, `story_annotations`, RLS |
| `002_push_notifications.sql` | `push_tokens`, `scheduled_pushes`, cron helpers |
| `003_place_ratings.sql` | `place_ratings`, `place_quality_scores` view |
| `004_pro_trial.sql` | `trial_started_at`, `is_pro` |
| `005_entitlement_hardening.sql` | entitlement lockdown, purchase ledger, place cache, rate limits, timezone-aware push, account deletion |

```bash
supabase db push
```

> ⚠️ `003_place_ratings.sql` contains a bare `select cron.schedule(...)` between
> comment lines, so it **executes on migrate** and fails if `pg_cron` is not
> enabled yet. Enable `pg_cron` in Dashboard → Database → Extensions *before*
> running migrations, or comment that statement out. `005` deliberately leaves
> all of its cron statements commented for this reason.

### What `005` changes about security

`user_data` has an RLS policy of `for all ... with check (auth.uid() = user_id)`.
That is correct for the user's own data — but it also meant any signed-in
client could `upsert({ is_pro: true })` with the public anon key and grant
itself Pro, bypassing `verify-purchase` entirely.

`005` adds a `before insert or update` trigger that forces
`is_pro`, `pro_expires_at`, `pro_product_id` and `trial_started_at` back to
server-controlled values for every non-`service_role` write. The trial clock is
now stamped by Postgres on row creation rather than supplied by the client.

---

## 2. Secrets

```bash
supabase secrets set \
  GOOGLE_PLACES_KEY='...' \
  GOOGLE_PLAY_SERVICE_ACCOUNT_KEY="$(cat play-service-account.json)" \
  OPENAI_API_KEY='sk-...' \
  CRON_SECRET="$(openssl rand -hex 32)"

# Only when the iOS build ships:
supabase secrets set APPLE_SHARED_SECRET='...'
```

| Secret | Used by | Required |
|---|---|---|
| `GOOGLE_PLACES_KEY` | `nearby-places`, `place-photo` | yes — Wander is empty without it |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_KEY` | `verify-purchase` | yes, to sell anything |
| `CRON_SECRET` | all `push-*` functions | **yes** |
| `OPENAI_API_KEY` | `ai-place-pick` | optional (blurbs degrade to none) |
| `APPLE_SHARED_SECRET` | `verify-purchase` (iOS) | only for iOS |

**`CRON_SECRET` is now mandatory.** `validateCronSecret` used to return `true`
when the secret was unset, so a deploy that forgot it let anyone who knew the
function URL push a notification to every user. It now fails closed: the push
functions refuse to run without it.

### The Google Places key must no longer be in `.env`

`EXPO_PUBLIC_*` variables are inlined into the JS bundle. `EXPO_PUBLIC_GOOGLE_PLACES_KEY`
was therefore readable by anyone who unzipped the release, and Google's Android
app-signature restriction does not help because React Native's `fetch` does not
send the `X-Android-Package` / `X-Android-Cert` headers it checks.

Remove it from `.env`, set it as a Supabase secret instead, and **rotate the old
key** — assume the one that shipped is compromised.

---

## 3. Deploy functions

`supabase/config.toml` declares the per-function `verify_jwt` settings and must
be present before deploying. Note `place-photo` is intentionally
`verify_jwt = false` — it is loaded by React Native's `<Image>`, which sends no
Authorization header, so any JWT gate would 401 every thumbnail.

```bash
supabase functions deploy nearby-places
supabase functions deploy place-photo
supabase functions deploy verify-purchase
supabase functions deploy delete-account
supabase functions deploy ai-place-pick
supabase functions deploy push-daily-stat
supabase functions deploy push-streak-saver
supabase functions deploy push-weekly-digest
supabase functions deploy push-scheduled
supabase functions deploy schedule-milestone-push
```

| Function | Auth | Notes |
|---|---|---|
| `nearby-places` | anon or user JWT | 24h cache per ~1.1 km cell; 40/h signed in, 10/h anon |
| `place-photo` | anon | 302s to Google; key never leaves the server |
| `verify-purchase` | user JWT | **only** writer of `is_pro`; also handles `{revalidate:true}` |
| `delete-account` | user JWT | required by Play & App Store policy |
| `ai-place-pick` | user JWT | 30/h per user, 30-day shared blurb cache |
| `push-*` | `x-cron-secret` | fail closed without the secret |
| `schedule-milestone-push` | user JWT | queues a row in `scheduled_pushes` |

---

## 4. Scheduled jobs

Enable `pg_cron` and `pg_net`, then schedule from the Dashboard
(Edge Functions → Schedule) or via SQL. Every call must send the
`x-cron-secret` header.

| Function | Cron | Why |
|---|---|---|
| `push-daily-stat` | `0 * * * *` | hourly; the SQL picks users whose *local* hour matches |
| `push-scheduled` | `0 * * * *` | drains due `scheduled_pushes` |
| `push-streak-saver` | `0 * * * *` | hourly, so 8pm lands at 8pm in each user's zone |
| `push-weekly-digest` | `0 * * * 0` | Sundays, hourly for the same reason |

Plus the housekeeping jobs at the bottom of `005` (cache sweep, usage sweep,
entitlement expiry) — commented out; run them by hand once `pg_cron` is on.

### Timezone correctness

`push_tokens.time_zone` holds the device's IANA zone, synced on every token
registration. `get_users_for_local_notification_hour()` compares the user's
chosen hour against `now() at time zone <their zone>`, which stays DST-correct
because Postgres carries full tzdata.

Previously `notificationTime` was compared against the current **UTC** hour, so
every signed-in user outside UTC received their "8am" notification at the wrong
time of day — and because signing in cancels local notifications in favour of
server push, signing in actively made notifications worse.

---

## 5. Play Console / App Store setup

1. Create subscriptions `gati_pro_monthly` and `gati_pro_annual` with a base
   plan each (the app reads `offerToken` from the first base-plan offer).
2. Create a Google Cloud service account, grant it **View financial data** in
   Play Console → Users and permissions, and store its JSON as
   `GOOGLE_PLAY_SERVICE_ACCOUNT_KEY`.
3. Host the privacy policy and terms at the URLs in `src/config.ts`
   (`EXPO_PUBLIC_PRIVACY_URL` / `EXPO_PUBLIC_TERMS_URL`). **These must return
   200 before submission** — a 404 is an automatic rejection, and Play also
   wants the account-deletion route reachable from the store listing.
4. Data safety form: declare approximate location (not stored), email address
   (account), and app activity. Point the deletion URL at your web page that
   explains the in-app path (Profile → Delete account).

### Recommended: Real-time developer notifications

`verify-purchase` re-checks receipts whenever the app calls `syncEntitlement()`
(launch and foreground, at most every 6 hours), which is enough to revoke a
lapsed subscription within a day. For near-instant revocation on cancellation
or refund, wire Play RTDN to a Pub/Sub topic and call `verify-purchase` with
`{revalidate:true}` for the affected user.
