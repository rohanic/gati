# Gati App — Full Product Audit

**Scope:** Technical bugs, design flaws, usability issues, psychological retention gaps, live data issues  
**Codebase reviewed:** Expo/React Native, Zustand stores, Stats Engine, Wander Engine, Milestone Engine, all tab screens, onboarding flow, notification service

---

## 1. Technical Flaws & Bugs

### 1.1 `isFirstDay` is named and used backwards

**File:** `app/(tabs)/today.tsx`

```ts
const isFirstDay = todayStats.length > 1;
```

This is `true` on Day 0 (which returns 3 stats) and `false` on every subsequent day. The variable is named `isFirstDay` but the correct semantic is `isDay0` or `isMultiStatDay`. The label copy then uses it as `'Your first 3 numbers'`, which is correct in intent but confusing to reason about in code. Any future developer touching this logic will likely invert it.

---

### 1.2 `computeBestStreak` is copy-pasted across two screens

**Files:** `app/(tabs)/story.tsx` and `app/(tabs)/profile.tsx`

Identical function body with no shared utility. Any bug fix or logic change must be applied in two places. Move to `src/utils/streak.ts` or `src/hooks/useStreak.ts`.

---

### 1.3 `StatCard` bookmark state is not persisted

**File:** `src/components/today/StatCard.tsx`

```ts
const [saved, setSaved] = useState(false);
```

The bookmark (Save) action is purely local React state. Navigating away from the Today tab and returning resets the saved state to `false`. There is no call to any store to persist the action. Users who bookmark a stat lose that state immediately on navigation, which will feel broken.

---

### 1.4 `openHistory` array grows unbounded forever

**File:** `src/store/userStore.ts`

Every app open appends a unique ISO date string to `openHistory`. After two years of daily use, this array holds 730+ entries — all serialized to AsyncStorage on every state write. There is no TTL, no pruning, and no migration path. The `useStreak` hook then calls `openHistory.includes(dateStr)` on this array (O(n) per day checked), which degrades as the list grows.

**Fix:** Keep only the last 400 entries (> 1 year), or convert to a `Set`-backed structure and trim on write.

---

### 1.5 Side effect (`recordOpen`) mixed into a data hook

**File:** `src/hooks/useTodayStat.ts`

```ts
useEffect(() => { recordOpen(); }, []);
```

`recordOpen` is a store write called inside a data-fetching hook. This violates single responsibility and makes the hook non-idempotent — calling `useTodayStats` as a standalone utility would silently mutate streak state. Move `recordOpen()` to the Today screen itself.

---

### 1.6 `profile.appJoinDate` can produce `Invalid Date`

**Files:** `src/hooks/useTodayStat.ts`, `app/(tabs)/story.tsx`

```ts
const joinDate = new Date(profile.appJoinDate + 'T00:00:00');
```

`appJoinDate` is typed as `string` in `UserProfile` but the `setProfile` action in `userStore.ts` does not enforce its presence. If onboarding stores a profile without setting `appJoinDate` (possible via `updateProfile` partial patching), this produces `Invalid Date`, causing `differenceInCalendarDays` to return `NaN`, and `dayIndex` to become `NaN`. The entire Today screen would silently render empty.

---

### 1.7 OSM real places score identically in `wanderEngine` — quality signals are dead weight

**File:** `src/engine/wanderEngine.ts`

All places fetched from OpenStreetMap have `rating: 0` and `redditMentions: 0` (explicitly set in `placesService.ts`). The quality signal lines in `scorePlace` therefore always add zero:

```ts
score += (place.rating / 5) * 0.4;          // 0 for every real place
score += Math.log10(1 + place.redditMentions) * 0.25;  // 0 for every real place
```

In practice, the algorithm sorts real places by taste score alone. The quality signal architecture exists but produces no effect on real data. Either remove the dead code or populate proxy quality signals (e.g., from OSM tags: `review_count`, `opening_hours` presence = more established place).

---

### 1.8 Wander places store is never pruned — memory leak over time

**File:** `src/store/userStore.ts` — `WanderStore`

`mergeRealPlaces` keeps every place the user has acted on (saved/visited/rated) indefinitely. For unsaved, unvisited places from old sessions that are no longer nearby, no cleanup runs. A user who travels frequently will accumulate hundreds of stale OSM places in AsyncStorage. Add a cleanup that removes unflagged places older than 30 days on each merge.

---

### 1.9 Wander screen can call `setFetchingPlaces` on an unmounted component

**File:** `app/(tabs)/wander/index.tsx`

`loadRealPlaces` is an async function that calls `setFetchingPlaces(false)` in its `finally` block. If the user navigates away from Wander during the fetch, the component unmounts and the state update fires on an unmounted component. In React Native with Expo Router this produces a warning in development and can cause subtle state bugs in production (e.g., the spinner re-appearing on re-mount because state was set after unmount).

---

### 1.10 No error boundary at the root level

**File:** `app/_layout.tsx`

No `ErrorBoundary` wraps the `Stack`. Any unhandled render error (e.g., `Invalid Date` from issue 1.6, or a missing `definition` in `useTodayStats`) will crash the entire app with a white screen. A root-level error boundary with a "Something went wrong — restart" recovery screen would prevent full-app crashes from isolated bugs.

---

### 1.11 Wander "map" button is misleading about what it opens

**File:** `app/(tabs)/wander/map.tsx`

The map button in the Wander header opens `/(tabs)/wander/map`, which is not an embedded map — it is a screen that deep-links out to Google Maps or Apple Maps. There is no in-app map rendering at all. The button uses a `map-outline` icon and an `accessibilityLabel="Open map view"`, leading users to expect an embedded map experience. The reality is a navigation hand-off to a different app. This should be communicated clearly in the UI ("Open in Maps" label instead of a map icon alone).

---

## 2. Design Flaws

### 2.1 Custom tab bar has no text labels

**File:** `app/(tabs)/_layout.tsx`

The custom `TabIcon` component renders only an icon and an active dot indicator. There are no visible text labels. Five icons — `sunny`, `stats-chart`, `compass`, `time`, `person` — are not universally self-explanatory. "Compass = Wander" and "Time = Story" are non-obvious metaphors for new users. Standard mobile HIG (both Apple and Google) recommends labels on tab bars for discoverability.

---

### 2.2 "Tap to reveal this number" is unnecessary friction copy

**File:** `app/(tabs)/today.tsx` — `CompactStatRow`

The subtitle on every collapsed stat row reads "Tap to reveal this number." The row already communicates interactivity via card styling, a chevron, and `accessibilityRole="button"`. The "reveal" framing implies secrecy but the number is simply not expanded yet. This copy adds noise without adding value. A cleaner sub-label would be the stat's category or a one-word teaser.

---

### 2.3 "Start today" streak badge is vague about what action triggers the streak

**File:** `app/(tabs)/today.tsx` — `StreakBadge`

When `streak === 0`, the badge shows "Start today." The streak is incremented automatically by `recordOpen()` on every app launch — the user doesn't need to do anything. "Start today" implies a required action. A user who just opened the app and sees "Start today" will be confused, since they already started. Change to "Day 1" or remove the zero-state entirely (the design comment already notes "Never shows '0 day streak'", but the "Start today" copy contradicts that intent).

---

### 2.4 No progress indicator for the stat unlock journey

**File:** multiple

There are 25 stat definitions (`statDefinitions.ts` has 25 entries). Users unlock 3 on Day 0, then 1 per day. There is no visible indicator of how many stats exist in total, how many have been unlocked, or how many remain. Users have no sense of progress toward completion, which reduces the motivation to return. A subtle "5 of 25 discovered" line in the Today header or Numbers tab would provide a progress loop.

---

### 2.5 Story tab: "Add a note" button on every single entry creates extreme clutter

**File:** `app/(tabs)/story.tsx` — `TimelineEntry`

Every timeline entry renders a visible "Add a note" / "Edit note" pressable below the card. On a story with 10+ events, this creates a wall of small interactive links that dilute focus and make the timeline harder to scan. A long-press gesture or a contextual action sheet would achieve the same function without polluting every row.

---

### 2.6 Dark mode is not supported

**File:** `src/theme/colors.ts`, `app/_layout.tsx`

The `StatusBar` is hard-coded to `style="dark"` with `backgroundColor="#F5F5EE"`. The entire color palette uses fixed hex values with no dynamic theming. On iOS, if the user has enabled Dark Mode system-wide, the app renders as a bright light-on-cream app inside a dark OS — which is jarring and creates an accessibility concern for users who rely on dark mode.

---

## 3. Usability Flaws

### 3.1 No pull-to-refresh anywhere

All main tab screens (`today.tsx`, `story.tsx`, `wander/index.tsx`) use `ScrollView` without a `RefreshControl`. Users have no gesture affordance to manually reload data. This is a standard expectation in mobile apps and its absence makes the app feel unpolished.

---

### 3.2 No offline or fallback indicator in Wander

**File:** `app/(tabs)/wander/index.tsx`

When `fetchNearbyPlaces` fails (no internet, GPS unavailable, Overpass API down), the app silently loads sample curated places from `samplePlaces.ts`. There is no indicator that what the user is seeing is sample data rather than real nearby places. Users may interact with these cards assuming they are real local venues, tap through to Google Maps, and find no match — a trust-destroying experience.

---

### 3.3 No undo for "Mark as visited"

**File:** `app/(tabs)/wander/[placeId].tsx` (and wander store)

Once a place is marked visited, it moves to the collapsible "Been here" section. There is no "undo" or "remove visit" affordance in the visible UI. The rating bottom sheet (`RatingBottomSheet.tsx`) marks it visited, but there is no reverse path exposed to the user.

---

### 3.4 No search in Wander

The only discovery filter is the category chip row (food, café, history, etc.). There is no search bar. A user looking for a specific place by name they remember from a previous session has no way to find it without scrolling through the full list.

---

### 3.5 Story empty state has no CTA to act

**File:** `app/(tabs)/story.tsx` — `EmptyStory`

The empty state reads "Your story starts today" with a body explaining that stats and places will appear here. There is no button to navigate to Today to unlock the first stat. New users who navigate to Story see a dead end with no path forward within the screen.

---

### 3.6 Today's "Your story so far" section silently drops history after Day 8

**File:** `src/hooks/useTodayStat.ts`

```ts
const MAX_PREVIOUS = 7; // cap timeline to last 7 entries
```

After 8 days of use, the Today screen shows only the most recent 8 entries. Older history is silently dropped with no "See full story" link to the Story tab. Users who have been using the app for 2+ weeks will see an incomplete and confusing timeline in Today.

---

### 3.7 WhatIf section is buried and not discoverable

**File:** `src/components/today/StatCard.tsx` — `WhatIfSection`

The "What if" scenarios (e.g., "What if you slept 30 more minutes?") are one of the app's most engaging features, but they are collapsed inside the stat card expansion and shown only after the count-up animation completes. There is no indication they exist on first launch, no tutorial hint, and no surface-level teaser. Most users will not discover them organically.

---

## 4. Psychological Retention Flaws

### 4.1 Streak is the only explicit retention mechanism

The app relies entirely on the daily streak to create a reason to return. There are no weekly goals, no collections, no "X of 25 stats unlocked" progress arc, no challenges, and no social anchors. Research on habit-forming apps consistently shows that single-loop retention (streaks only) plateaus at ~2–3 weeks. Users who break their streak once have no remaining reason to return.

---

### 4.2 Stats lose their surprise factor after ~2 weeks

All stats are deterministic functions of birth date + profile data. After a few days, users understand the pattern: every number is a different formula applied to the same inputs. The novelty of "Your heart has beaten 1,234,567,890 times" fades once users realize nothing unexpected will ever appear. The `isNewUnlock` animation suggests freshness, but the underlying revelation is predictable. Occasional genuinely surprising or external data points (e.g., "You've been alive longer than X famous structure") would restore the discovery feeling.

---

### 4.3 Push notification copy doesn't use a curiosity hook

**File:** `src/services/notifications.ts`

The daily notification title is "Your number for today" and the body rotates through generic phrases like "One more piece of you, counted." None of these preview the category or create a specific curiosity gap (e.g., "Did you know you've slept through 1/3 of your life?"). Pre-hinting at the category — even vaguely — would dramatically increase open rates by creating an unresolved curiosity loop before the user taps.

---

### 4.4 Upcoming milestones are invisible to users

**File:** `src/engine/milestoneEngine.ts`

The milestone system fires a celebration at thresholds (7-day streak, 14-day streak, etc.), but users have no visibility into what the next milestone is or how close they are to it. "Invisible progress" is motivating only when the user already has intrinsic drive. Showing a subtle "3 days until your next milestone" indicator would convert passive users into active ones chasing a specific goal.

---

### 4.5 No sharing or social loop is surfaced at the moment of delight

**File:** `src/components/today/StatCard.tsx`

The share button exists in the stat card but is one of four equal-weight action buttons with no prominence hierarchy. The peak psychological moment to trigger sharing is immediately after the count-up animation ends — when the number is most surprising. There is no automatic share prompt or "Show a friend" nudge at that moment. A first-share prompt ("This one surprised you — did it?") shown once per week would create organic viral loops.

---

### 4.6 Wander degrades to stale content without location permission

Users who deny location permission see curated sample data from `samplePlaces.ts`. This data is static and never changes. After 2–3 visits, users have seen every sample place. With no new content and no way to get real nearby places without re-granting permission, the Wander tab becomes a dead tab. There is no reminder or incentive to revisit the permission after the initial denial.

---

### 4.7 Numbers → Wander bridge covers only 3 of 8 interest categories

**File:** `src/engine/statPlaceBridge.ts`

The stat-to-place bridge connects `coffee_cups → cafe`, `steps_walked → nature`, and `meals_eaten → food`. Users whose interests are `history`, `art`, `market`, `nightlife`, or `books` will never see the personalized "Your numbers, nearby" section. This removes a key emotional hook (your life data surfacing places that matter to you) for the majority of interest categories.

---

## 5. Live Data Issues

### 5.1 Stats are computed once per render — numbers go stale

**File:** `src/engine/statsEngine.ts`, `src/hooks/useTodayStat.ts`

`computeLifeStats` is called inside a `useMemo` that depends on `profile` and `unlockedStats`. It does not depend on time. This means that if a user leaves the Today screen open for 6 hours, the displayed heartbeat count (70 bpm × 6 hours = ~25,000 beats) never updates. For an app whose core identity is "your life measured in real time," this is a significant credibility gap. Stats like `heartbeats`, `breaths`, and `blinks` change every second and should either refresh on a timer or display a live animated counter rather than a frozen snapshot.

---

### 5.2 Wander places are fetched once per session with no refresh

**File:** `app/(tabs)/wander/index.tsx`

```ts
const [fetchedThisSession, setFetchedThisSession] = useState(false);
if (fetchedThisSession) return;
```

Once places are fetched, no subsequent fetch occurs for the rest of the session. If the user moves to a different neighborhood, city, or country, they continue to see results from their original location. There is no "Refresh for current location" button and no staleness signal to the user.

---

### 5.3 Streak data is device-local only — resets on reinstall

The `openHistory` array in `useStatsStore` is persisted via `AsyncStorage` only. There is no server-side backup. If a user reinstalls the app, switches devices, or clears app data, a long streak (e.g., 100 days) is permanently lost. This is a high-churn event — users who lose a significant streak are unlikely to rebuild motivation.

---

### 5.4 No background data refresh

The app has no background fetch, no periodic refresh, and no real-time data binding for any data source. Stats, milestones, and Wander places update only when the user actively opens the relevant screen in a session. If the app is launched from a push notification tap, only the Today screen is navigated to — Wander and Story show whatever was last computed in the previous session.

---

## Summary Table

| Category | Severity | Count |
|---|---|---|
| Technical bugs | High | 5 |
| Technical improvements | Medium | 6 |
| Design flaws | High | 3 |
| Design improvements | Medium | 3 |
| Usability issues | High | 3 |
| Usability improvements | Medium | 4 |
| Retention gaps | Critical | 3 |
| Retention improvements | High | 4 |
| Live data issues | High | 2 |
| Live data improvements | Medium | 2 |

---

*Audit conducted June 2026 against the full Gati source tree.*
