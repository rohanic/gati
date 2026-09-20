# Gati — the user journey

The complete path from install to month two, and what the app is actually for.

---

## What Gati is

A daily reflection habit disguised as a number.

Not a tracker (it asks nothing of you), not a quantified-self dashboard (there
are no charts), not trivia (every figure is yours). One number a day, computed
from your own life, sized to be thought about for thirty seconds and then
carried around for the rest of the day.

**The promise:** *there is something true about your life you have never
counted. Here is one, every day.*

Everything below exists to serve that sentence. If a feature does not make the
daily number land harder, it does not belong.

---

## Day 0 — install

```
Splash → Welcome → Name → Birthday → Sleep → Coffee → Water
      → Screen time → Music → Meals → Activity → Commute
      → Personality → Interests → Processing → Notifications → Complete
```

Fifteen screens is long for onboarding, and it is deliberate. Every question
becomes a number later — the sleep answer becomes "hours asleep", the coffee
answer becomes "cups of coffee". The user is not filling in a form, they are
loading the machine. `Processing` makes that visible by computing figures live
as they scroll past.

**Guards already in place:**

- No birthday → bounced back to `birthday` rather than fabricating a profile
  from a placeholder date (`processing.tsx`).
- Splash holds until fonts **and** persisted stores are hydrated, so a
  returning user is never flashed into onboarding
  (`_layout.tsx` → `useStoresHydrated`).
- Location is requested at `Complete`, in context, with a "Maybe later" that
  genuinely works.

**What happens on finish:** the profile is written, milestones already passed
are seeded as *seen* (so a 30-year-old is not congratulated on 5,000 days
alive as if they earned it today), and the trial anchor is stamped.

Day 0 grants **3 keys** — the first day has to land, and one number is not
enough to show what the app is.

---

## The core loop

> You get one key a day. You choose which number to open. What you open is
> yours forever.

### Why keys, and why you choose

The previous model revealed number N on day N. Three things were wrong with it:

| Problem | Effect |
|---|---|
| No choice | Curious about "times you've blinked" on day 1? Wait nineteen days. |
| Sealed numbers were invisible | A locked thing you cannot see the name of is not a hook, it is an absence. |
| It ran out silently | Day 23 wrapped with `% 25` and re-served numbers you already had. |

Now all 25 are visible from day one as **teasers** — title, category, a
one-line hook, and where relevant *which of your own answers drives it*
("from your 2 cups a day"). You can see the whole collection. You just cannot
have it all at once.

### Why UTC

Keys are granted at **00:00 UTC**, the same instant worldwide.

- **Not farmable.** A local-midnight rule lets someone change their device
  timezone and mint keys on demand.
- **Everyone is on the same clock**, which keeps the daily push and anything
  shared later coherent.

The trade-off: the reset lands mid-afternoon for some people. So the UI always
states the next key in **local** time — "arrives at 5:30 AM your time".

### Banking

Keys **regenerate** up to a ceiling of 3; they do not accumulate behind it. A
day whose key would exceed the cap is forfeited, exactly like a stamina bar.

This distinction matters and got it wrong once. The first implementation capped
the *lifetime unspent pool* (`granted − spent`). A user ten days in who had
opened three numbers had 13 granted and 3 spent — a pool of 10, capped to 3.
Opening another moved the pool to 9 and the screen still read "3 keys". The
counter appeared frozen for anyone whose install was more than a few days old.
`availableKeys` now replays the ledger day by day: grant, cap, spend.

---

## A month, day by day

| Day | What the user sees | Notification |
|---|---|---|
| 0 | 3 keys. Opens "days alive" — the anchor that reframes age. Two more if curious. | Permission asked in context at onboarding |
| 1 | 1 key. Today tab leads with a suggestion; they can pick anything. Streak = 2. | 08:00 local — curiosity-gap copy for tomorrow's category |
| 2–6 | One key each morning. First stat-to-place bridge appears if they open a habit number and have location on. | Daily at their chosen hour; evening streak-saver only if they have **not** opened |
| 7 | **Milestone:** one full week. Earns a streak freeze. | Milestone celebration |
| 8–13 | Collection view starts to feel like a collection — roughly 10 of 25 open. | Daily |
| 14 | **Milestone:** two weeks. Second freeze. | Milestone |
| 15–21 | Bridges get richer as more habit numbers open. Wander starts being a reason to open the app on its own. | Daily + Sunday weekly recap |
| 22 | **Catalogue complete.** Today shows the completed state, not a recycled number. | Milestone: every number opened |
| 23+ | The numbers keep counting. Streak, Wander and the Story timeline carry the habit. | Daily continues; content pressure is now real (see below) |

### The day-22 problem, stated plainly

Twenty-five numbers is about three weeks of core loop. After that the daily key
has nothing to unlock and retention rests entirely on Wander, the streak, and
watching the figures tick.

That is a **content problem, not a bug** — and it is the strongest argument for
launching free. Charging a subscription for a loop that completes in three
weeks invites exactly the review you do not want. The fix is more numbers, and
the unlock engine already supports any catalogue size without code changes.

---

## Notifications

Two mutually exclusive paths, chosen on every app open:

| State | Path | Where it fires |
|---|---|---|
| Signed out | Local scheduled notifications | Device's own scheduler |
| Signed in | Server push (Supabase → EPNS) | `push-daily-stat` etc. |

`refreshNotificationsOnOpen` picks one and cancels the other, so the same
reminder never arrives twice.

**Four Android channels**, so the streak nag can be silenced without losing the
daily number — which is what stops people disabling notifications outright:

- `daily-stat` — your number for today
- `streak` — evening nudge, **only** on days you have not opened
- `milestones` — rare, genuinely worth a buzz
- `weekly-digest` — Sunday recap

Server push fires at the user's **local** chosen hour via their synced IANA
timezone, not UTC.

---

## The Today screen

One screen answering "why open Gati right now", in priority order:

1. **The day's decision** — a key, and a suggested number to spend it on. The
   suggestion is a nudge for the undecided, not an assignment.
2. **What you opened today** — the payoff, with the full figure counting up.
3. **Where that number leads** — the stat-to-place bridge. A coffee number
   leads somewhere you can drink one; a steps number leads somewhere worth
   walking to.
4. **Your collection** — recent opens, streak, week.

Point 3 is what makes Gati more than a trivia app. The bridge engine existed
before but only Wander used it, so the two halves of the product never met.

---

## Sign-in

**Optional, and genuinely so.** The entire app works signed out: numbers,
keys, streak, Wander, Story. Sign-in buys exactly one thing — your data
surviving a lost phone — and the UI says that rather than dressing it up.

Two routes, both Android-appropriate:

- **Email OTP** — six-digit code, works everywhere
- **Google** — one tap via Chrome Custom Tabs

Apple Sign In was removed with the rest of the iOS surface. Apple requires it
only when other social logins are offered *on iOS*, and this app does not ship
there.

The trial anchor is **device-level**, so signing out and registering a fresh
email does not mint another trial while keeping all local data.

---

## Monetisation — v1 ships free

`LAUNCH_MODE = 'free'` in `src/config.ts`. Every capability is granted, the
paywall is hidden, and the billing code stays intact but dormant.

**Why:**

1. **No retention data.** Pricing before you know which day people churn on is
   a guess, and an expensive one to unwind.
2. **Play reviews are close to permanent.** A first cohort that hits a paywall
   on day two leaves one-star reviews that outlive the experiment.
3. **Three weeks of loop.** Not yet enough to defend a subscription to a
   stranger.
4. **Billing has never completed a live transaction.** Shipping
   revenue-critical code unproven against real Play Console products is how you
   get refund threads instead of customers.

**What to watch before flipping it:** D1/D7/D30 retention, how far into the
catalogue people actually get, and whether Wander is used independently of the
daily number. If D7 is healthy and users finish the catalogue, the thing worth
charging for is *more numbers* — which is also the fix for day 22.

Flipping to paid needs no code change: set `EXPO_PUBLIC_LAUNCH_MODE=paid`,
create the Play Console products, and verify one real purchase end to end.

---

## How Wander ranks places

Relevance is **multiplicative**, not additive:

```
relevance = taste × proximity × quality × context × behaviour
```

Each factor is a ratio centred near 1.0, so no single signal runs away.

| Factor | What it reads |
|---|---|
| **proximity** | Hill decay, `1/(1+(d/2.5km)²)` — halves at 2.5 km, ~0.09 at 8 km |
| **quality** | Bayesian rating (40-review prior) × log-scaled review count |
| **context** | Open now, plus time-of-day affinity per category |
| **behaviour** | Loved ×1.9, visited ×0.25, not-for-me ×0.05 |
| **taste** | Learned category score × declared interest × crowd `gatiScore` |

**Why it was showing far places.** The old scorer was additive: proximity could
contribute at most +0.30 while quality contributed well over +1.30, so distance
was decorative. Worse, the candidate pool itself was capped at ten per category
ranked by *quality alone* — so a good café 300 m away was evicted before the
scorer ever saw it. Both stages are fixed; the search radius also came down
from 8 km to 5 km, because Google ranks by popularity *within* the radius and a
wide net returns the most famous places in the whole disc.

**Time of day** is the modern touch: cafés rank up in the morning, bars at
night, museums in the afternoon. Gentle multipliers that re-order a good list
rather than censoring it — suggesting a cocktail bar at 8am is the fastest way
to make a recommendation feel automated.

Each card shows the reason it ranked ("Just around the corner", "Exceptionally
well rated"), derived from whichever factor dominated. A ranked feed the user
cannot interrogate just looks arbitrary.

---

## Preferences feed everything

Profile answers are not decoration. `computeLifeStats` reads them directly, and
`STAT_SOURCES` maps each number back to the answer behind it, so a sealed card
can say "from your 2 cups a day".

Edit a preference in Profile and every derived number changes immediately —
including ones already opened. That is intentional: these are *your* numbers,
and if the input was wrong the figure should correct itself rather than
preserve a stale lie.
