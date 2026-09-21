# Gati — launch checklist

Live-verified against the project on 21 Sep 2026. Each item says how it was
checked, so nothing here is guesswork.

---

## 🔴 Blockers — the app does not work without these

### 1. No edge functions are deployed

Probed all four directly. Every one returns **404 NOT_FOUND**:

| Function | Status | What breaks without it |
|---|---|---|
| `nearby-places` | ❌ 404 | Wander shows curated samples only, never real places |
| `place-photo` | ❌ 404 | Every place thumbnail fails to load |
| `verify-purchase` | ❌ 404 | **A purchase takes the money and then errors** |
| `delete-account` | ❌ 404 | The Play-required deletion button throws |
| `ai-place-pick`, `push-*` | ❌ 404 | No blurbs, no server push |

`verify-purchase` is the dangerous one. Play Billing would complete, the app
would call verification, get a 404, and refuse to finalise the transaction. The
user is charged and sees an error. (Google auto-refunds an unacknowledged
purchase after 3 days, so it self-heals — but only after a support complaint.)

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

### 2. Migration 005 is not applied

Probed the tables. `user_data`, `push_tokens`, `place_ratings` exist (001–003
applied). These do not:

- ❌ `purchases` — no purchase ledger, so one receipt can entitle many accounts
- ❌ `places_cache` — every Wander refresh is a fresh paid Google call
- ❌ `api_usage` — no rate limiting on the Google Places or OpenAI endpoints

**The entitlement trigger is also missing**, which means the original security
hole is still open in production: any signed-in client can `upsert` with the
public anon key and set `is_pro = true` on itself.

```bash
supabase db push
```

> Enable `pg_cron` **first** — `003_place_ratings.sql` contains a live
> `select cron.schedule(...)` that executes on migrate and fails without it.

### 3. Secrets are not set

```bash
supabase secrets set \
  GOOGLE_PLACES_KEY='<rotated key>' \
  GOOGLE_PLAY_SERVICE_ACCOUNT_KEY="$(cat play-service-account.json)" \
  CRON_SECRET="$(openssl rand -hex 32)" \
  OPENAI_API_KEY='sk-...'
```

`CRON_SECRET` is mandatory — the push functions fail closed without it.

**Rotate the Google Places key.** It shipped inside earlier release bundles and
must be considered compromised. Then delete
`EXPO_PUBLIC_GOOGLE_PLACES_KEY` from `.env`; the client no longer reads it.

### 4. Legal pages are not live — CONTENT NOW WRITTEN

Checked over the network — all three fail to resolve:

```
https://gati.app/privacy   ❌ unreachable
https://gati.app/terms     ❌ unreachable
https://gati.app           ❌ unreachable
```

A privacy policy that does not return 200 is an automatic Play rejection, and
these URLs are linked from the paywall and Profile.

The text is written and accurate to the code — see `docs/legal/`:

- `privacy-policy.md` — every claim matches what the app actually does
- `terms-of-service.md` — subscription, auto-renew and liability terms
- `play-data-safety.md` — the exact Data Safety answers, with source citations

**Remaining: host them.** GitHub Pages on this repo is the quickest route —
enable Pages, then point the env vars at the published URLs:

```
EXPO_PUBLIC_PRIVACY_URL=https://<user>.github.io/gati/privacy
EXPO_PUBLIC_TERMS_URL=https://<user>.github.io/gati/terms
```

`SUPPORT_EMAIL` is still `support@gati.app` — must be a real inbox.

### 5. ~~Product IDs do not match the console~~ — RESOLVED IN CODE

The app now asks Play about **both** namings (`gati_pro_*` and `pro_*`) and
keeps whichever the store recognises; `verify-purchase` accepts either. Play
ignores unknown SKUs rather than failing, so asking for four costs nothing.

Pin it explicitly once the console naming is settled:

```
EXPO_PUBLIC_SKU_MONTHLY=pro_monthly
EXPO_PUBLIC_SKU_ANNUAL=pro_annual
```

A dev-build warning now prints the SKUs asked for versus returned, so a
mismatch is visible instead of silent.

### 6. Push notifications need Firebase

`google-services.json` is still missing, so **no notification will arrive**.
Wiring is now automatic — `app.config.js` picks the file up when present and
prints a loud warning on every config resolve while it is not.

1. Firebase console → add an Android app with package `com.gati.app`
2. Download `google-services.json` to the **project root** (no config edit needed)
3. `eas credentials` → Android → Push Notifications → upload the FCM V1 key

---

## 🟠 Decisions needed before it can earn

### 7. The paywall is switched off

`LAUNCH_MODE = 'free'`, so every feature is unlocked and the paywall is hidden.
There is **no route to a purchase** in this build regardless of billing state.

That was the deliberate v1 recommendation (no retention data, three weeks of
content, billing never proven against live products). But if the goal is to
charge now, flip `EXPO_PUBLIC_LAUNCH_MODE=paid` — after proving one real
purchase end to end.

### 8. Google Sign-In setup

Separate from Firebase. Needs:

1. An **OAuth 2.0 Android client** in Google Cloud with package `com.gati.app`
   and the **release keystore SHA-1** (`eas credentials` shows it)
2. A **Web client** whose ID and secret go into Supabase → Auth → Providers → Google
3. `https://<project>.supabase.co/auth/v1/callback` added as an authorised
   redirect URI

Miss the SHA-1 and sign-in fails only on the signed release build — never in
development, which makes it a classic launch-day surprise.

---

## 🟡 Store listing

Not checked here; needs doing in the console.

- Feature graphic 1024×500, phone screenshots (≥2, 16:9 or 9:16)
- Short (80 char) + full (4000 char) description
- Content rating questionnaire
- **Data safety form** — declare: approximate location (used, not stored),
  email address (account), app activity. Deletion URL must describe the in-app
  route (Profile → Delete account)
- Target audience and ads declaration (Gati shows no ads)
- Closed or internal testing track with licence testers **before** production —
  billing cannot be tested from a local build alone

---

## ✅ Done and verified

| Item | Evidence |
|---|---|
| Target SDK 36 (Android 16) | `expo-build-properties` in `app.json` |
| R8 + resource shrinking | `enableMinifyInReleaseBuilds`, `enableShrinkResourcesInReleaseBuilds` |
| Predictive back gesture | `predictiveBackGestureEnabled: true` |
| Edge-to-edge | Enforced by SDK 57; StatusBar props removed |
| Version above live release | `1.2.1` / `versionCode 34` (Play live: 33 / 1.2.0) |
| Bitmap memory warning | Both remote-image sites moved to `expo-image` |
| Account deletion in-app | Profile → Delete account, two-step confirm |
| Permission surface minimal | 6 declared, 10 blocked incl. background location |
| No secrets in the bundle | Google key verified absent from the release `.hbc` |
| Typecheck / lint / tests | clean · 0 errors · 292 passing |
| expo-doctor | 21/21 |
| Product IDs resilient to console naming | resolved against the store at runtime |
| Firebase wiring | automatic via `app.config.js` once the file exists |
| Privacy policy / terms / data safety | written in `docs/legal/`, accurate to the code |

---

## Suggested order

1. `supabase db push` → deploy functions → set secrets *(unblocks Wander, deletion, billing)*
2. Host the legal pages *(blocks submission outright)*
3. Firebase + `google-services.json` *(unblocks push)*
4. Confirm product IDs; Google OAuth client with release SHA-1
5. Build → internal testing track → **complete one real purchase end to end**
6. Store listing + data safety
7. Only then decide on `LAUNCH_MODE=paid`

Steps 1–3 are independent and can be done in parallel. Nothing else matters
until step 5 passes, because billing has never completed a live transaction.
