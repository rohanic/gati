# Gati — launch checklist

Live-verified against the project on 23 Sep 2026. Every status below was
probed against the running backend, not inferred from a successful command.

---

## ✅ Done — verified against the live project

### Database

`supabase db push` completed. Migrations 001–005 are all applied and recorded
in the migration history.

| Verified | How |
|---|---|
| `purchases`, `places_cache`, `api_usage` exist | REST returns 200 |
| `user_data.pro_expires_at`, `pro_product_id`, `saved_stat_ids` exist | column select returns 200 |
| `protect_entitlement` trigger installed | 005 applied without error |

**The `is_pro` hole is closed.** Until 005 landed, the RLS policy on
`user_data` was `for all ... with check (auth.uid() = user_id)`, so any
signed-in client could set `is_pro = true` with the public anon key. The
trigger now rejects client writes to the entitlement columns; only
`verify-purchase`, running as the service role, may set them.

### Edge functions

All ten deployed. None returns 404 any more, and the codes they *do* return
are correct behaviour:

| Function | Code | Meaning |
|---|---|---|
| `place-photo` | 405 | expects GET, correctly refuses POST |
| `verify-purchase` | 401 | correctly demands a user JWT |
| `delete-account` | 400 | correctly rejects an empty body |
| `push-*`, `ai-place-pick`, `schedule-milestone-push` | 401 | correctly service-role only |
| `nearby-places` | **500** | deployed, but see blocker 1 |

### pg_cron

Enabled — 003 contains a live `cron.schedule` call and applied cleanly, which
it could not have done otherwise. The nightly
`nightly-place-score-refresh` job exists.

---

## 🔴 Blockers

### 1. `GOOGLE_PLACES_KEY` is not set

`nearby-places` returns `{"error":"Place search is not configured"}`. This is
the only thing still standing between Wander and real places — the ranking,
the radius control and the client are all done and tested.

```bash
supabase secrets set GOOGLE_PLACES_KEY="$(grep '^EXPO_PUBLIC_GOOGLE_PLACES_KEY=' .env | cut -d= -f2- | tr -d '"'"'"'\'' ')"
```

> Rotate this key afterwards. It has sat in a local `.env` under an
> `EXPO_PUBLIC_` name, which is the prefix Expo inlines into the JS bundle.
> It is **not** in the bundle today — verified by scanning the release
> artefact, because nothing in the app references it — but the name invites
> exactly that mistake. Rename it to `GOOGLE_PLACES_KEY` locally once the
> secret is set.
>
> Restrict the new key in Google Cloud to the Places API only. It now lives
> server-side, so it needs no Android app restriction.

### 2. Scheduled push never fires

The `cron.schedule` calls for `push-daily-stat`, `push-streak-saver`,
`push-weekly-digest` and `push-scheduled` are **commented out** in
`002_push_notifications.sql`. The functions are deployed and will work when
called; nothing calls them.

Uncomment the block at the end of 002 — substituting the project ref and
service-role key — and run it in the SQL editor. Verify with
`select * from cron.job;`.

Local notifications work regardless, so this only affects signed-in users on
the server push path.

### 3. `CRON_SECRET` is not set

`_shared/supabaseAdmin.ts` reads it to authenticate scheduled invocations.
Set it before creating the cron jobs, and use the same value in their
`Authorization` header.

```bash
supabase secrets set CRON_SECRET="$(openssl rand -hex 32)"
```

### 4. `google-services.json` is missing

Push tokens register and report success; nothing is delivered. `app.config.js`
warns loudly at build time rather than shipping silently broken push.

Firebase console → add an Android app with package `com.gati.app` → download
`google-services.json` to the project root → `eas credentials` → Android →
Push Notifications → upload the FCM V1 key.

### 5. Google sign-in redirect allow-list

The provider is enabled (`/auth/v1/settings` reports `"google": true`) and
`/auth/v1/authorize` returns a live 302 to Google. Supabase validates the
redirect only *after* Google returns, so this cannot be probed from outside.

Confirm `gati://auth/callback` is listed under **Authentication → URL
Configuration → Redirect URLs**. If it is missing, the app now reports it
instead of failing silently.

---

## 🟡 Only when the paid tier goes live

`LAUNCH_MODE` is `'free'`, so none of this blocks the first release.

- `GOOGLE_PLAY_SERVICE_ACCOUNT_KEY` — `verify-purchase` needs it to validate
  receipts against Google Play
- Real product IDs in `.env` as `EXPO_PUBLIC_MONTHLY_SKU` / `EXPO_PUBLIC_ANNUAL_SKU`
- A subscription with an active base plan per billing period in Play Console

`APPLE_SHARED_SECRET` is read by `verify-purchase` but this build is
Android-only, so it is not needed.

`OPENAI_API_KEY` is optional — `ai-place-pick` writes place blurbs and
degrades to the built-in summaries without it.

---

## 🟡 Play Store

See [play-store-guide.md](play-store-guide.md) for the full submission walk-through.

- Listing copy written, counts verified — `store/listing/en-US.txt`
- 512×512 icon generated — `store/graphics/icon-512.png`
- ⬜ Feature graphic, 1024×500
- ⬜ Six phone screenshots, 1080×1920, real captures
- ⬜ Data Safety form, content rating, target audience
- ⬜ **Closed testing: 12 testers for 14 consecutive days.** A personal
  developer account registered after Nov 2023 cannot apply for production
  access without it. Longest lead time in the whole launch — start it first.
