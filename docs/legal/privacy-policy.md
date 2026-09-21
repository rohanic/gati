# Privacy Policy — Gati

**Last updated: 21 September 2026**

Gati is made by Rohan Ahmad. This policy explains exactly what the app collects,
why, and what it never does. It was written against the source code, not from a
template — every claim below corresponds to something you can verify in the app.

Contact: **contact@creaeza.com**

---

## The short version

- Gati works **fully without an account**. Everything stays on your phone.
- We collect data only when you **choose to sign in** for backup.
- Your **location is never stored** and never linked to you.
- We **do not** sell, share or monetise your data. There is no advertising and
  no third-party analytics or tracking SDK.
- You can **delete your account and all server data from inside the app**.

---

## What Gati stores on your device

Whether or not you sign in, the app keeps the following locally:

- **Your profile** — first name, date of birth, and the lifestyle answers you
  gave during setup (hours of sleep, cups of coffee, screen time, meals, water,
  music, commute, activity level, how talkative you are)
- **Which numbers you have opened** and on what date
- **Your streak history** — the dates you opened the app
- **Places** you saved, visited or rated, and your learned category preferences
- **Notes** you attach to items in your Story timeline

Uninstalling the app removes all of it.

## What leaves your device

### Only if you create an account

Signing in is optional and exists for one reason: so your data survives a lost
or replaced phone. If you sign in, the items listed above are copied to our
Supabase database, along with:

- **Your email address**, used solely to identify your account and send the
  sign-in code
- **A push notification token and your time zone**, so reminders arrive at the
  hour you chose in your own local time

### Whether or not you have an account

- **Approximate location**, when you use the Wander tab and grant permission.
  This is sent to our server to search for nearby places, and is **not stored
  against you**. Results are cached by a coordinate rounded to roughly one
  kilometre, so a cached area cannot be traced back to an individual. Your
  precise position is never written to a database.
- **Place ratings**, if you rate a place while signed in. Stored as a place
  identifier, your account id, and the rating, and used to compute an aggregate
  quality score shown to other users. Only the aggregate is ever displayed —
  never your individual rating.

### Never

- Contacts, photos, files, microphone, camera, calendar
- Precise location history, background location, or any location trail
- Advertising identifiers
- Behavioural analytics or crash-reporting SDKs that profile you

---

## Third parties

| Service | What it receives | Why |
|---|---|---|
| **Supabase** | Your account data (only if you sign in) | Database, authentication, backup |
| **Google Play Services** | Your Google account, if you choose Google sign-in | Authentication |
| **Google Places** | An approximate coordinate, via our server | Finding real places near you |
| **Google Play Billing** | Handled entirely by Google | Subscriptions, if you buy one |
| **Expo Push / Firebase** | A device push token | Delivering notifications |
| **OpenAI** | A place name and category — never anything about you | One-line "why this place" blurbs |

We never send your name, date of birth, lifestyle answers or email to Google
Places or OpenAI.

**Payments:** Gati never sees your card details. All payment information is
handled by Google Play. We receive only a purchase receipt used to confirm your
subscription is active.

---

## How long we keep it

- **Local data** — until you uninstall or clear app storage
- **Account data** — until you delete your account
- **Cached place results** — 24 hours, not linked to any user
- **Rate-limiting counters** — a few days, then discarded

---

## Deleting your account

**Profile → Delete account**, then confirm twice.

This permanently erases your profile, streak history, saved places, ratings,
notes and push token from our servers. It cannot be undone.

It does **not** cancel an active subscription — cancel that in the Google Play
Store first, or you will continue to be billed.

Anything still held on your phone is removed by uninstalling the app.

If you cannot access the app, email **contact@creaeza.com** from the address on
your account and we will delete it for you.

---

## Children

Gati is not directed at children under 13, and we do not knowingly collect
their data. If you believe a child has created an account, contact us and we
will delete it.

---

## Security

All traffic uses HTTPS. Account data is protected by row-level security, so one
account cannot read another's rows. Subscription status is writable only by our
server after verifying a receipt with Google — it can never be granted by a
modified app.

No system is perfectly secure, and we do not claim otherwise.

---

## Your rights

Depending on where you live, you may have the right to access, correct, export
or delete your data, and to withdraw consent.

- **Access and correct** — everything is visible and editable in the app
- **Export** — Profile → Export your data
- **Delete** — Profile → Delete account

For anything else, email **contact@creaeza.com**.

---

## Changes

If this policy changes materially we will update the date above and notify you
in the app before the change takes effect.
