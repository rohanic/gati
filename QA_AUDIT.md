# Gati — QA Audit Report

**Date:** June 2026  
**Scope:** Full app audit — bugs, missing features, automation, sync, social hooks, Supabase roadmap  
**Auditor:** Claude (acting as QA)

---

## 🔴 Critical Bugs

### 1. YearPill animation broken — strict equality on animated float
**File:** `app/(tabs)/story.tsx` — line 268  
**Code:**
```tsx
backgroundColor: fill.value === 1 ? colors.green700 : colors.white,
```
`fill.value` is a Reanimated shared value that animates from `0 → 1` via a spring. Strict `=== 1` only triggers at the exact integer endpoint — an animated float almost never lands exactly on `1.0`. The pill background therefore stays white (unselected) even on the active year.  
**Fix:** Change to `fill.value > 0.5` or pass `active` directly as a prop and derive the style from it without reading `fill.value` in a conditional:
```tsx
backgroundColor: fill.value > 0.5 ? colors.green700 : colors.white,
```

---

### 2. Story subtitle always shows the full description
**File:** `app/(tabs)/story.tsx` — line 431  
**Code:**
```tsx
subtitle: def.description.split('{')[0].trim() || def.category,
```
The intent appears to be: split at a template placeholder like `{value}` and take the preamble. But none of the `STAT_DEFINITIONS` descriptions contain `{` — the split returns the entire string unchanged, so every story subtitle is the full multi-sentence description, overflowing the card.  
**Fix:** Either truncate to a fixed character limit, or redesign to use a dedicated `shortDescription` field on `StatDefinition`.

---

### 3. Pro copy says "22+" — should be "25"
**File:** `app/(tabs)/profile.tsx` — line 737  
**Code:**
```tsx
'All 22+ life stats, always unlocked',
```
There are 25 stats in `STAT_DEFINITIONS`. The copy is stale from an earlier build.  
**Fix:** Change to `'All 25 life stats, always unlocked'`.

---

### 4. Profile Habits section only exposes 4 of 8 input fields
**File:** `app/(tabs)/profile.tsx`  
The editable habits UI renders pickers for: sleep hours, coffee cups, phone hours, exercise frequency. The following four are declared in `UserProfile` but have no UI in Habits:

| Field | Type | Affects stat |
|---|---|---|
| `waterGlassesPerDay` | optional number | `water_glasses` |
| `musicHoursPerDay` | optional number | `music_hours` |
| `commuteMinutesPerDay` | optional number | `commute_hours` |
| `mealsPerDay` | required number | `meals_eaten` |

Users cannot calibrate these stats. `mealsPerDay` is required on the type but has no picker, so it takes whatever the onboarding default was and never updates.  
**Fix:** Add four more `SettingRow` pickers in the Habits section matching the existing pattern.

---

### 5. Pro purchase flow is a stub
**File:** `app/(tabs)/profile.tsx` — line 768  
```tsx
onPress={() => Alert.alert('Gati Pro', 'Purchase flow coming soon.')}
```
The Pro CTA is live and shown to every non-Pro user, but pressing it does nothing. `isPro` on `UserProfile` is never set to `true` anywhere in the codebase.  
**Fix:** Integrate `expo-in-app-purchases` or RevenueCat, wire the result to `updateProfile({ isPro: true })`. Until then, hide the button or replace it with a "notify me" email collection.

---

### 6. Share and Feedback are stubs
**File:** `app/(tabs)/profile.tsx` — lines 782–790  
Both "Share Gati with a friend" and "Feedback" show `Alert.alert(...)`. No `expo-sharing`, no `Share.share()`, no external link.

---

## 🔴 Data Safety

### 7. All data lives only in AsyncStorage — one reinstall destroys everything
Every Zustand store (`gati-user`, `gati-stats`, `gati-wander`, `gati-story`) persists exclusively to `AsyncStorage`. Consequences:

- **Reinstall** = complete loss of all streak history, stat unlocks, story notes, wander saves
- **New device** = blank slate; no transfer path
- **OS storage pressure** = AsyncStorage can be silently evicted on Android

There is no account system, no Supabase auth, no iCloud/Drive backup, no export.

---

### 8. `openHistory` silently drops oldest streak data after 400 days
**File:** `src/store/userStore.ts` — line 112  
```ts
const pruned = [...openHistory, today].slice(-400);
```
At 400 days the oldest entries are dropped. `maxStreakEver` is computed from the live array, so an early long streak survives in `maxStreakEver`, but the raw date evidence is gone. Any future streak visualization or audit will be incomplete after 400 days of use.  
**Fix:** Store `maxStreakEver` separately (already done) and consider a compressed streak representation (run-length encoded ranges) instead of the raw date list.

---

## 🟡 Missing Features

### 9. No streak grace period or freeze mechanic
Missing one day resets the streak to 0. Competing apps (Duolingo, Streaks) offer a "streak freeze" consumable. Without it, users who miss a day by timezone drift or a late night are permanently demoralized.

### 10. No Health API integration
All habit inputs (sleep, coffee, phone, exercise, steps, water) are manual self-reports. Apple Health and Google Fit expose ground-truth data for sleep duration, step count, and active energy. Even a one-way read at app open would make the stats meaningfully accurate rather than aspirational guesses.

### 11. Push notification deep-link does not navigate to the stat
**File:** `src/services/notifications.ts` (inferred)  
Notifications are scheduled per stat category, but tapping a notification lands on the Today tab root rather than the specific unlocked stat card. The `stat/[statId].tsx` deep-link screen exists precisely for this — it is never wired to the notification payload.

### 12. `pro.tsx` screen exists but is unreachable
**File:** `app/pro.tsx`  
No tab, no button, no `router.push('/pro')` anywhere in the codebase routes to this screen. It is dead code.

### 13. Data export not implemented
Profile mentions export as a feature intent. No CSV/JSON export exists. For a "life in numbers" app, this is a meaningful user expectation.

### 14. Interests change after onboarding does not reset category scores
**File:** `src/store/userStore.ts` — `initFromInterests`  
The `interestsInitialized` guard means category scores are boosted once at onboarding and never re-derived if the user updates their interests in Profile. A user who adds "art" to their interests post-onboarding will not see the art category score boosted.  
**Fix:** On `updateProfile({ userInterests: [...] })`, call a new `resetInterestScores(interests)` that bypasses the guard and re-applies the boost to the new selection.

---

## ⚙️ Automation Opportunities

### 15. Weekly digest notification (Sunday)
A Sunday push — "This week: 4 days opened, 2 places saved, 1 milestone hit" — keeps dormant users engaged without daily pressure. Implementable via `expo-notifications` scheduled weekly.

### 16. Milestone prediction notification
"You're 3 days from 10,000 days alive" is more compelling than the milestone itself. The `milestoneEngine` already knows the threshold and the user's computed value — add a scheduler that fires 3 days before any upcoming milestone.

### 17. Auto-refresh Wander on significant location change
Wander fetches once on mount and caches for the session. If the user travels 5+ km from the last fetch point, the pool is stale. Use `expo-location`'s background location or a foreground distance check on tab focus to trigger `fetchNearbyPlaces` automatically.

### 18. Visual feedback when profile habit changes recalculate stats
When the user changes "coffee cups per day" from 2 to 4, the `coffee_cups` stat on Today silently updates. There is no animation or feedback — the user has no way to see the effect of their edit. A brief number-flash or a "stats recalculated" toast would close this loop.

---

## 🔄 Synchronization Issues

### 19. Story timeline places events under the wrong month
**File:** `app/(tabs)/story.tsx` — `place` event date logic  
Places use `place.visitedDate ?? place.discoveredDate` to determine which month bucket they appear in. A place the user saved months ago and visited today will appear under the discovery month, not today. The Story entry should always use `visitedDate` when available, falling back to `discoveredDate` only for never-visited saves.

### 20. Story annotations (NoteBottomSheet) not backed up ✅ Partially fixed
`useStoryStore` is AsyncStorage-only. Personal notes attached to story events are the most emotionally significant data in the app and the most irreplaceable. They have no sync path whatsoever.

**Fix applied:** `importAnnotations` action added to `useStoryStore` (merge-wins on `createdAt`). Annotations are now included in the data export JSON, and a "Restore from backup" flow in Profile allows paste-in restoration. This covers manual backup/restore.

**Roadmap (Phase 1 backend):** Real-time cloud sync requires Supabase or equivalent. Suggested schema: `story_annotations(user_id, item_id, text, pinned, created_at, updated_at)`. Sync should be bidirectional with last-write-wins per `updated_at`, triggered on `setAnnotation` / `removeAnnotation` / `togglePin`. Until then, users should be prompted to export data before reinstalling.

### 21. Category score divergence when interests reset ✅ Fixed
Related to issue #14. The `categoryScores` record in `useWanderStore` drifts over time from taste learning. If a user resets or reinstalls, scores start at `1.0` but unlocked stats reflect a different preference history. There is no export/import for scores.

**Fix applied:** `importCategoryScores` action added to `useWanderStore` with safe clamping `[0.5, 5.0]` and unknown-category filtering. `categoryScores` is now included in the data export JSON and restored via the same "Restore from backup" modal.

---

## 🟣 Social & People Hooks

### 22. Share card is not implemented
"Share Gati with a friend" (Profile) fires an `Alert`. A real share card should use `Share.share()` with a pre-populated message like:  
> "I've been alive 10,847 days. Gati showed me that. What's your number? [app store link]"

### 23. No milestone share button
The milestone celebration modal (Today screen) has a close button but no share button. This is the peak emotional moment in the app — the most natural place for organic sharing — and it is wasted.

### 24. No community / global percentiles
"You've taken more steps than 73% of Gati users" is a social comparison hook that requires aggregate data from a backend. Without auth and cloud sync this is impossible, but it should be in the roadmap.

### 25. No referral system
The referral entry point (Profile → Share) is stubbed. A working referral with a unique link and a reward (streak freeze? Pro trial day?) would be a low-cost growth mechanic.

---

## 🔵 Supabase Integration Roadmap

The following work is required to make the app production-safe and socially capable. None of it exists yet.

### Phase 1 — Auth + Cloud Backup (critical path)

**Supabase Auth** (email/phone magic link or Apple/Google OAuth):
- `supabase.auth.signInWithOtp()` or OAuth provider
- Store `userId` in `useUserStore`; gate all cloud writes behind it

**Cloud sync tables:**

```sql
-- Core profile + settings
create table profiles (
  id           uuid primary key references auth.users,
  name         text,
  date_of_birth date,
  habits       jsonb,           -- sleep, coffee, phone, etc.
  interests    text[],
  is_pro       boolean default false,
  updated_at   timestamptz default now()
);

-- Daily stat unlocks
create table stat_unlocks (
  user_id      uuid references profiles,
  stat_id      text,
  unlocked_date date,
  has_been_shared boolean default false,
  primary key (user_id, stat_id)
);

-- App-open history (streak source of truth)
create table open_history (
  user_id  uuid references profiles,
  opened_date date,
  primary key (user_id, opened_date)
);

-- Wander interactions (saved / visited / rated)
create table wander_places (
  user_id      uuid references profiles,
  place_id     text,
  is_saved     boolean default false,
  is_visited   boolean default false,
  user_rating  text,            -- 'loved' | 'good' | 'not_for_me'
  visited_date date,
  primary key (user_id, place_id)
);

-- Story personal annotations
create table story_annotations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references profiles,
  ref_id     text,             -- statId or placeId
  note       text,
  created_at timestamptz default now()
);

-- Milestones seen (for Story timeline)
create table milestones_seen (
  user_id      uuid references profiles,
  milestone_id text,
  seen_date    date,
  primary key (user_id, milestone_id)
);
```

**Sync strategy:** Write-through on every store mutation. On app open, merge server state into local AsyncStorage. Zustand middleware intercepts `set()` and fires a Supabase upsert in the background (optimistic local-first).

---

### Phase 2 — Server-Side Push

Replace the current `expo-notifications` local scheduling with Supabase Edge Functions + Expo Push Notification Service (EPNS):

```
Edge Function: send_daily_stat_notification
  - Runs daily via pg_cron
  - Queries users whose local time ≈ their preferred notification hour
  - Looks up their next-unlock stat, builds the notification body
  - Calls EPNS /push endpoint with their ExpoToken

Edge Function: send_milestone_prediction  
  - Runs daily
  - For each user, computes days-to-next-milestone
  - Fires when distance ≤ 3 days
```

This means notifications fire even if the app has never been opened on the current day — solving the streak bootstrap problem.

---

### Phase 3 — Aggregate Place Ratings

When users rate a Wander place (`loved` / `good` / `not_for_me`), that signal currently lives only in their local store and updates only their own `categoryScores`. At scale, aggregate ratings give Gati a proprietary quality layer on top of Google's:

```sql
create table place_ratings (
  place_id   text,             -- gp_{googleId}
  rating     text,             -- 'loved' | 'good' | 'not_for_me'
  user_id    uuid references profiles,
  created_at timestamptz default now(),
  primary key (place_id, user_id)
);

-- Materialized view updated nightly
create materialized view place_quality_scores as
select
  place_id,
  count(*) filter (where rating = 'loved') as loved_count,
  count(*) filter (where rating = 'good')  as good_count,
  count(*) filter (where rating = 'not_for_me') as skip_count,
  round(
    (count(*) filter (where rating = 'loved') * 1.0 +
     count(*) filter (where rating = 'good')  * 0.5) /
    nullif(count(*), 0), 2
  ) as gati_score
from place_ratings
group by place_id;
```

`fetchNearbyPlaces` queries this view and folds `gati_score` into the `quality` sort formula.

---

### Phase 4 — Social Features (requires Phase 1)

- **Friend comparison:** Share a link → recipient sees your `days_alive`, `percent_of_80`, `heartbeats` — anonymous until they sign up
- **Global percentiles:** "You've slept X hours, more than Y% of Gati users" computed server-side nightly
- **Streak leaderboard:** Opt-in weekly rank among friends
- **Supabase Realtime:** Friend milestone events broadcast in near-real-time to followers

---

## 🟢 Redundancies & Dead Code

### Dead route: `pro.tsx`
No navigation path reaches `app/pro.tsx`. Either wire it up (Profile → Pro card → `/pro`) or delete it.

### Potential route conflict: `stat/[statId].tsx` vs `numbers/[statId].tsx`
Verify whether both dynamic routes coexist and whether the deep-link handler resolves to the correct one. If `stat/[statId].tsx` is the deep-link target, `numbers/[statId].tsx` may be a duplicate.

### Converted stat pairs feel redundant in the feed
`phone_hours` and `phone_days` are 12 positions apart — good. But `sleep_hours` and `sleep_days` are only 7 apart, and `coffee_cups` and `coffee_volume` are 12 apart. Consider whether `sleep_days` and `coffee_volume` add enough surprise to justify their slot, or whether they could be replaced with more novel stats.

---

## Priority Order

| Priority | Item | Effort |
|---|---|---|
| P0 | Fix YearPill animation (bug #1) | 5 min |
| P0 | Fix story subtitle overflow (bug #2) | 30 min |
| P0 | Add missing 4 habit pickers (bug #4) | 2 hr |
| P0 | Fix Pro copy "22+" → "25" (bug #3) | 1 min |
| P1 | Supabase auth + cloud backup (Phase 1) | 1–2 weeks |
| P1 | Streak grace period / freeze | 1 day |
| P1 | Wire Pro purchase via RevenueCat | 2–3 days |
| P1 | Real share sheet on milestone modal | 2 hr |
| P2 | Health API read (sleep + steps) | 2–3 days |
| P2 | Fix interests-change → score reset (#14) | 1 hr |
| P2 | Fix story place → correct month (#19) | 30 min |
| P2 | Notification deep-link to stat (#11) | 1 hr |
| P2 | Server-side push via Edge Functions (Phase 2) | 3–5 days |
| P3 | Weekly digest notification | 1 day |
| P3 | Milestone prediction notification | 1 day |
| P3 | Auto-refresh Wander on location change | 1 day |
| P3 | Aggregate place ratings (Phase 3) | 1 week |
| P4 | Social / friend features (Phase 4) | 2–4 weeks |
| P4 | Community percentiles (#24) | Requires backend — see below |

---

## Issue #22 — Share Gati: generic message (fixed)

**Original state:** "Share Gati with a friend" fired a static message with no personal data.  
**Fix:** Message now includes the user's actual `daysAlive` count — e.g. *"I've been alive 12,847 days. Gati showed me that. Your number is waiting — what's yours? https://gati.app"*. Falls back to a generic message if DOB is not set.

---

## Issue #23 — Milestone modal share button (already implemented)

The `MilestoneModal` component has had a Share + Continue button row since initial build. The share handler was improved to append a consistent CTA: `"\n\nMy life, in numbers — https://gati.app"`. Duplicate "Gati." brand tags removed from `milestoneEngine.ts` shareText strings so the CTA only appears once.

---

## Issue #24 — Community / global percentiles (roadmap)

**Summary:** "You've taken more steps than 73% of Gati users" is a high-value social comparison hook. Requires:

1. **Backend auth + user records** — each user needs a persistent server-side identity (Phase 1 Supabase auth).
2. **Aggregate stat collection** — on each app open, push anonymised stat snapshot to a Supabase Edge Function that updates per-stat percentile buckets.
3. **Percentile read API** — a `GET /percentile?stat=steps_walked&value=1234567` endpoint returning `{ pct: 73 }`.
4. **UI integration** — add a percentile line to `StatCard` (e.g. *"More than 73% of people your age"*) and to share cards.

**Blockers:** Phase 1 (Supabase auth) is a prerequisite. No local approximation is meaningful without real user data. Do not ship a fake/hardcoded percentile.

**Estimated effort:** 1–2 weeks after auth is live (Phase 2–3).
