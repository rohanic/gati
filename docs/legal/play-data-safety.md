# Play Console — Data Safety answers

Derived from the code, not guessed. A Data Safety declaration that does not
match actual app behaviour is a policy violation and a common cause of takedown,
so each answer below cites where it comes from.

---

## Does your app collect or share any of the required user data types?

**Yes.**

## Is all of the user data collected by your app encrypted in transit?

**Yes** — every network call is HTTPS (Supabase, Google Places via our server,
Expo push, Google Play Billing). Verified by scanning `src`, `app` and
`supabase/functions` for `http://` endpoints: none exist outside localhost.

## Which methods of account creation does your app support?

Tick exactly these two:

- ☑ **Username and other authentication** — email plus a 6-digit one-time
  code (`supabase.auth.signInWithOtp` → `verifyOtp`)
- ☑ **OAuth** — Sign in with Google through the system browser
  (`signInWithGoogle`, PKCE code exchange)

Do **not** tick anything containing "password". There is no password in this
app: `authStore.ts` implements only `signInWithOtp`, `verifyOtp` and
`signInWithGoogle`, and no screen ever collects or stores one. Ticking a
password option would describe an attack surface the app does not have.

Do not tick "My app does not allow users to create an account" either —
signing in for the first time creates one, even though it is optional.

## Additional badges

- **Independent security review** — No. This is for an audit against a
  recognised standard (MASA). Claiming it without one is a policy violation.
- **UPI Payments verified** — No. Not a finance app, no UPI.

## Do you provide a way for users to request that their data be deleted?

**Yes** — in-app at Profile → Delete account (`delete-account` edge function),
plus `contact@creaeza.com`.

Deletion URL for the listing: your privacy-policy page, which documents the
in-app route.

---

## Data types

### Personal info → Name

| Field | Answer |
|---|---|
| Collected | **Yes** |
| Shared | No |
| Processed ephemerally | No |
| Required or optional | **Optional** — you can skip it at onboarding |
| Purpose | App functionality (personalising greetings and share cards) |

*Source: `UserProfile.firstName`.*

### Personal info → Email address

| Field | Answer |
|---|---|
| Collected | **Yes** |
| Shared | No |
| Processed ephemerally | No |
| Required or optional | **Optional** — the app works fully signed out |
| Purpose | Account management, App functionality |

*Source: Supabase Auth, only on sign-in.*

### Personal info → Other info

| Field | Answer |
|---|---|
| Collected | **Yes** |
| Shared | No |
| Required or optional | **Required** |
| Purpose | App functionality |

Date of birth and lifestyle answers (sleep, coffee, screen time, meals, water,
music, commute, activity, talkativeness). These *are* the app — every number is
computed from them.

*Source: `UserProfile`, `computeLifeStats`.*

### Location → **Precise location**

| Field | Answer |
|---|---|
| Collected | **Yes** |
| Shared | No |
| **Processed ephemerally** | **Yes** |
| Required or optional | **Optional** — Wander shows examples without it |
| Purpose | App functionality |

**Changed from Approximate on 24 Sep 2026 — update the Play Console form to
match before releasing build 37.**

Wander offers radii down to 500 m. Finding the right places within 500 m
needs the user's actual position: rounding it to ~1.1 km first, as an earlier
version did, put the search centre up to 800 m off, and Google's top 20 for
that shifted circle contained almost nothing inside the real 500 m. Play
defines precise location as anything narrower than 3 km² — roughly a 1 km
circle — so this is precise, and the form must say so.

What keeps it minimal:

- **Processed ephemerally.** The position is used for the one search the
  user asked for and then discarded. It is never written against a user, and
  there is no location history.
- The server's result cache is keyed by a ~110 m cell (1.1 km for searches
  wider than 2 km) with no user attached, so a cached result cannot be traced
  to anyone.
- Foreground only. `ACCESS_BACKGROUND_LOCATION` is blocked in `app.json`.
- Asked for only in Wander, behind a button — never at launch or during
  onboarding.

*Source: `fetchNearbyPlaces` sends `latitude`/`longitude` unmodified; cache
key in `supabase/functions/nearby-places`.*

### App activity → Other actions

| Field | Answer |
|---|---|
| Collected | **Yes** |
| Shared | No |
| Required or optional | Required |
| Purpose | App functionality |

Which numbers you opened and when, your streak dates, saved and visited places,
place ratings, and Story notes.

*Source: `user_data`, `place_ratings`, `story_annotations`.*

### Financial info → Purchase history

| Field | Answer |
|---|---|
| Collected | **Yes** |
| Shared | No |
| Required or optional | Optional |
| Purpose | App functionality, Account management |

A purchase token and subscription expiry, used to confirm entitlement. **No
payment details ever reach the app** — Google Play handles all of it.

*Source: `purchases` table, `verify-purchase`.*

---

## Declare NOTHING for these

Verified absent from the codebase:

- Background location, location history
- Contacts, calendar, photos, videos, audio, files
- Health or fitness data *(the numbers are arithmetic on self-reported answers,
  not sensor readings — do not declare Health and fitness)*
- Messages, web browsing history
- Device or advertising IDs
- Crash logs, diagnostics, analytics — **no analytics SDK is installed**

---

## Data sharing

**Nothing is "shared"** in Play's sense (transferred to a third party for their
own use).

Third-party *processors* acting on our instructions — Supabase, Google Places,
Expo/Firebase push, OpenAI — are service providers, which Play does not count
as sharing. OpenAI receives only a place name and category, never anything about
the user.

---

## Other declarations

| Question | Answer |
|---|---|
| Ads | **No ads** |
| Target audience | 13+ (not designed for children) |
| Government app | No |
| Financial features | No |
| News app | No |
| Data safety — independent security review | No |

---

## Permissions to justify

| Permission | Why |
|---|---|
| `ACCESS_COARSE_LOCATION` / `ACCESS_FINE_LOCATION` | Foreground only, one fix when Wander opens. Never background, never stored. |
| `POST_NOTIFICATIONS` | The daily number reminder — the core loop. |
| `RECEIVE_BOOT_COMPLETED` | Re-registers scheduled notifications after a restart. |
| `VIBRATE` | Notification haptics. |
| `com.android.vending.BILLING` | Optional subscription. |

Explicitly **blocked** in `app.json`, so they never appear in the manifest:
background location, foreground service, exact alarms, external storage, camera,
microphone, system alert window.

Exact-alarm permissions in particular trigger extra Play review; Gati does not
need them and blocks them.
