# Google Play submission guide — Gati

Everything Play Console will ask, with the answer for this app and where the
answer comes from in the code. Work top to bottom.

---

## Where the files live

Two folders, and they are not interchangeable.

```
assets/                        IN THE APP — referenced by app.json, shipped in the .aab
  icon.png              1024²  launcher icon
  adaptive-icon.png     1024²  Android adaptive foreground
  monochrome-icon.png   1024²  Android 13+ themed icon
  splash-icon.png        480²  splash, drawn at 120dp
  notification-icon.png   96²  status-bar icon, white-on-transparent
  logo.png              1254²  used by onboarding + share cards

store/                         PLAY CONSOLE ONLY — never bundled, never referenced by code
  listing/
    en-US.txt                  title, short and full description
  graphics/
    PROMPTS.md                 image prompts
    icon-512.png        512²   ✅ generated — upload as-is
    feature-graphic.png 1024×500   ⬜ you generate
    screenshots/
      01-today.png ... 06-unlock.png   ⬜ real captures, 1080×1920
```

Nothing in `store/` is imported by the app, so it adds zero bytes to the
bundle. Do not move store graphics into `assets/` — anything there that gets
`require`d ships to every user.

---

## Store listing

Copy lives in [`store/listing/en-US.txt`](../store/listing/en-US.txt), with
character counts already verified against Play's limits.

| Field | Value |
|---|---|
| App name | `Gati: Life Numbers & Wanders` — 28/30 |
| Short description | 72/80 |
| Full description | 2924/4000 |
| App icon | `store/graphics/icon-512.png` |
| Feature graphic | generate per `PROMPTS.md` |
| Phone screenshots | 6 real captures |
| **Category** | **Lifestyle** |
| Tags (pick 5) | Daily habits · Self-discovery · Local discovery · Journaling · Personalisation |
| Email | `contact@creaeza.com` |
| Website | `https://creaeza.com` |
| Phone | leave blank — optional, and publishing one invites spam |

### Do not choose Health & Fitness

Tempting, since the app counts heartbeats, breaths and steps. Choosing it
puts you under Play's health policies, which ask for clinical
substantiation that arithmetic on self-reported averages cannot provide.
Your own Terms already state the app is not a medical or fitness tool
(`docs/legal/terms-of-service.md` §1). **Lifestyle** matches what the app
actually is and keeps the declaration consistent.

---

## App content — every declaration

Play Console → **Monetise / Policy → App content**. Each one below is
answered from the code, not guessed.

### Advertising ID → **No**

"Does your app use an advertising ID?" → **No**. There is no ads SDK and no
analytics SDK in `package.json`.

> **The trap.** This declaration is checked against your merged manifest,
> not your word. If any dependency declares
> `com.google.android.gms.permission.AD_ID`, Play sees the permission,
> sees your "No", and rejects the release as a mismatched declaration.
> **Firebase Analytics adds it automatically** — and you are about to add
> `google-services.json` for push.
>
> `app.json` now blocks it explicitly, so the permission is stripped from
> the manifest even if a dependency requests it:
>
> ```
> "blockedPermissions": [ …, "com.google.android.gms.permission.AD_ID" ]
> ```
>
> Firebase *Messaging* alone does not add it. Do not install Firebase
> Analytics unless you intend to change this declaration and your Data
> Safety form together.

### Ads → **No, my app does not contain ads**

### App access → **All functionality is available without special access**

The app works fully signed out — sign-in is optional and only syncs to a
second device. Do **not** give Play test credentials; there is nothing
behind a login.

### Content rating (IARC questionnaire)

Answer everything **No**: no violence, no sexual content, no profanity, no
controlled substances, no gambling, no user-to-user communication. Declare
that the app **shares the user's approximate location with the developer**
(the `nearby-places` call) and **allows digital purchases** (the optional
subscription). Expected outcome: **Everyone / PEGI 3**.

### Target audience and content → **13+**

Not designed for children, so the Families policy and its extra
requirements do not apply. Do not tick any age band under 13 — that pulls
in Designed for Families review.

### Data safety

Answers are prepared, derived from the code with sources, in
[`docs/legal/play-data-safety.md`](legal/play-data-safety.md). Two points
that are easy to get wrong:

- Declare **approximate** location, processed ephemerally — never precise,
  even though the app requests `ACCESS_FINE_LOCATION`. It only ever uses a
  coarse result and caches against a coordinate rounded to ~1 km.
- Do **not** declare Health and fitness. The numbers are arithmetic on
  self-reported answers, not sensor readings.

Deletion URL: `https://creaeza.com/gati-account-deletion` ✅ live.

### Other declarations

| Question | Answer |
|---|---|
| Government app | No |
| Financial features | No |
| Health apps | No |
| News app | No |
| Data collected from children | No |

---

## Privacy policy

`https://creaeza.com/gati-privacy` ✅ live and verified rendering.

---

## Release setup

| Item | Status |
|---|---|
| Format | `.aab` — `eas.json` production builds app-bundle ✅ |
| Play App Signing | Required. Accept when Play offers it on first upload. |
| Target API level | 36 ✅ (`app.json`) |
| 64-bit | ✅ handled by RN |
| Package name | `com.gati.numberswanders` — **permanent once published, cannot ever be changed** |
| versionCode | 34, `autoIncrement: true` in `eas.json` ✅ |

```bash
eas build --platform android --profile production
```

### Track order

Internal testing → Closed testing → Production. Do not go straight to
production: a personal Google Play developer account registered after
Nov 2023 must run **closed testing with at least 12 testers for 14
consecutive days** before it can apply for production access. Start that
clock now — it is the longest pole in your launch.

---

## In-app products

Before the paid tier can work, in Play Console → Monetise → Subscriptions:

1. Create the subscription, note its **product ID**
2. Add a **base plan** per billing period (monthly, annual), and activate each
3. Put the real IDs in `.env` as `EXPO_PUBLIC_MONTHLY_SKU` /
   `EXPO_PUBLIC_ANNUAL_SKU`

`src/services/purchaseService.ts` resolves the SKU against the store and
falls back through `gati_pro_monthly` / `pro_monthly`, logging in dev which
IDs it asked for versus what the store returned — check that log if prices
come back empty.

Prices only load for a build **installed from a Play track** by an account
on your licence-testers list. On a local build they will always be blank;
that is not a bug.

### Launch mode

`LAUNCH_MODE` is `'free'`, so everything is unlocked for everyone and no
upgrade prompts show. You can ship the first release exactly like this —
it removes billing from the list of things that can fail review, and you
still need the subscription configured for later. Flip to `'paid'` via
`EXPO_PUBLIC_LAUNCH_MODE` when you are ready; no code change needed.

---

## Still blocking a working build

These are not listing items — the app is broken without them.

1. `supabase db push` — migration 005 is unapplied, so **any signed-in
   client can set `is_pro = true` with the public anon key**
2. `supabase functions deploy` — all 10 functions return 404, so Wander,
   place photos, purchase verification, account deletion and the daily
   push do not work
3. Set the function secrets and rotate the Google Places key
4. Add `google-services.json` — without it Google Sign-In and FCM push
   do not work at all
5. Create the Google OAuth Android client with the **release** SHA-1 from
   Play App Signing, not the debug one
6. Make `contact@creaeza.com` a real monitored inbox — Play verifies it

---

## Pre-submission check

- [ ] Title, short and full description pasted
- [ ] `icon-512.png` uploaded
- [ ] Feature graphic uploaded, nothing important near the edges
- [ ] 6 real screenshots, 1080×1920
- [ ] Category **Lifestyle**, 5 tags
- [ ] Advertising ID → **No**, and `AD_ID` absent from the merged manifest
- [ ] Data safety submitted, approximate location only
- [ ] Content rating → Everyone
- [ ] Target audience 13+
- [ ] Privacy policy URL saved
- [ ] Countries selected
- [ ] Subscription created with an active base plan
- [ ] Closed-testing clock started — 12 testers, 14 days
