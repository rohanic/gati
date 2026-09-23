# Gati — launch checklist

Live-verified against the project on 23 Sep 2026. Every status below was
probed against the running backend, not inferred from a successful command.

---

## 🚨 Incident — 1.2.1 (36) shipped without a backend

**What users saw:** tapping Google opened
`https://placeholder.supabase.co/auth/v1/authorize`. Email sign-in, Wander's
real places, photos, sync and account deletion were equally dead; Wander
showed only the demo examples.

**Cause:** `EXPO_PUBLIC_*` values are inlined when the bundle is built. EAS
builds on its own machines, and `.env` is gitignored, so it never reaches
them. The build succeeded with both Supabase values empty, and
`src/services/supabase.ts` silently fell back to its placeholder. The bundle
check before release ran a *local* `expo export`, which reads `.env` — the one
place the values did exist — so it passed.

**A second, independent fault** would have kept Google broken even with the
URL fixed: the client used supabase-js's default `implicit` OAuth flow, which
returns tokens in the URL fragment, while `signInWithGoogle` waits for a
`?code=` that only PKCE sends. Now `flowType: 'pkce'`.

**Fixed:**
- Both values set as EAS env vars for production, preview and development,
  verified by hash against `.env`
- `app.config.js` fails any EAS build or production bundle missing them —
  proven by running an export with `.env` hidden
- `verify:backend` checks EAS holds them
- Sign-in refuses up front when no backend is configured, instead of opening
  a dead URL
- `app/auth/callback.tsx` handles the OAuth redirect, including the cold
  start after Android kills the app in the browser — previously an
  "Unmatched Route" screen and a lost sign-in

**Shipping the fix:** every change is JavaScript-only and the project
fingerprint still equals the live build's (`b0f638ee…`), so an EAS Update
reaches existing installs without a Play review. A new store build is still
needed so *fresh* installs start fixed — with `fallbackToCacheTimeout: 0`,
a new install runs its embedded bundle on the first launch and only applies
the update on the second.

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
supabase secrets set GOOGLE_PLACES_KEY="$(grep '^GOOGLE_PLACES_KEY=' .env | cut -d= -f2- | tr -d '"'"'"'\'' ')"
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

### 4. FCM credentials not yet uploaded to EAS

`google-services.json` is in place — Firebase project `gati-e4404`, package
`com.gati.numberswanders`, verified by `npm run verify:backend`. Two steps
remain.

**a. Register it as an EAS file env var.** The file is gitignored because
this repository is public and it carries an Android API key. EAS Build
derives its upload from what git tracks, so an ignored file never reaches
the builder — and `app.config.js` would take its warning branch and ship a
release with push silently disabled.

```bash
eas env:set --name GOOGLE_SERVICES_JSON \
  --type file --visibility secret --scope project \
  --value ./google-services.json \
  --environment production --environment preview --environment development \
  --non-interactive
```

`env:create` is deprecated in favour of `env:set`. The `--environment` flags
matter: without them the command opens an interactive multi-select and exits
with "No environments selected" if you press enter. All three are listed
because a preview APK needs push to work the same way a production build
does — a variable set only on `production` leaves internal testers with
silently dead notifications.

**b. Upload the FCM V1 service-account key.** Firebase → Project settings →
Cloud Messaging → enable **Firebase Cloud Messaging API (V1)**. Then Service
accounts → Generate new private key.

That downloaded file is a real private key — unlike `google-services.json`,
which is designed to ship inside the APK. Keep it **outside the repository**.
`.gitignore` now also covers `*firebase-adminsdk*.json` and `*-adminsdk-*.json`,
because Firebase names these files in a way that matched none of the existing
credential patterns, and this repository is public.

```bash
eas credentials
```

→ **Android** → **production** → **Push Notifications (FCM V1)** → *Upload a
new FCM V1 service account key* → give it the path to that file.

> Two different things in that menu are called a Google service account key:
>
> | Menu entry | What it is |
> |---|---|
> | **Push Notifications (FCM V1)** | ← the Firebase key you just downloaded |
> | Google Service Account (submissions) | a *Play Console* key for `eas submit`, a different file entirely |
>
> Picking the wrong one is the usual reason push stays dead after a
> seemingly successful upload.

Once EAS has it, the local copy is no longer needed — delete it. Firebase can
mint another at any time.

> FCM lives in a different Cloud project (`397188050184`) from the OAuth
> client and Places key (`160901593596`). That is fine — nothing is shared
> between them — but keep it in mind when hunting for a setting.

Until (b) is done, the app falls back to **local** notifications, which work.
Server push only affects signed-in users.

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
