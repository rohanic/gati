/**
 * Unlock engine — the app's core loop.
 *
 * ── The model ────────────────────────────────────────────────────────────
 * Every number in the catalogue is always VISIBLE as a teaser: title,
 * category, and a one-line hook. What is hidden is the value — your value.
 *
 * You earn **keys**. One per day, granted at 00:00 UTC. The first day grants
 * three so the app lands properly on install. You choose which number to spend
 * a key on; once opened it is yours permanently.
 *
 * ── Why this replaced the fixed schedule ─────────────────────────────────
 * The old model revealed stat N on day N with no choice involved, and hid the
 * rest entirely. Three problems:
 *
 *   1. No agency. The user could be curious about "times you've blinked" on
 *      day one and have to wait nineteen days for it.
 *   2. Nothing to anticipate. A locked stat you cannot even see the name of is
 *      not a hook, it is an absence.
 *   3. It silently ran out. The index wrapped with `% total`, so from day 23
 *      the app re-served numbers the user already had.
 *
 * Showing all 25 as teasers turns the catalogue into a visible collection, and
 * letting the user choose turns a passive drip into a daily decision.
 *
 * ── Why UTC ──────────────────────────────────────────────────────────────
 * Keys are granted on a UTC day boundary, so "a new day" happens at the same
 * instant for everyone on Earth. This is deliberate:
 *
 *   • It cannot be farmed by changing the device timezone. A local-midnight
 *     rule lets someone hop forward through timezones and mint keys.
 *   • Every user is on the same schedule, which makes the daily push and any
 *     future shared/social feature coherent.
 *
 * The trade-off is that the reset lands mid-day for some people rather than at
 * their own midnight. `nextKeyAt` is exported so the UI can always state
 * plainly when the next key arrives in the user's own local time.
 *
 * Pure functions only — no clock reads except via an injected `now`, no store
 * access. Everything here is unit-tested.
 */

/** Keys granted on the day the user joins. Three makes day one land. */
export const DAY_ZERO_KEYS = 3;

/** Keys granted at each subsequent UTC midnight. */
export const KEYS_PER_DAY = 1;

/**
 * Maximum keys that can be held at once.
 *
 * Keys REGENERATE up to this ceiling; they do not accumulate behind it.
 * A day whose key would exceed the cap is forfeited, exactly like a stamina
 * bar in a game.
 *
 * The previous implementation capped the *lifetime unspent pool*
 * (`granted - spent`), which is a different thing and was wrong: a user ten
 * days in who had opened three numbers had 13 granted and 3 spent, so the pool
 * was 10 and the cap pinned the display at 3 permanently. Opening another
 * number moved the pool 10 → 9 and the screen still read "3 keys". The bank
 * only ever drained for someone who had opened almost everything.
 */
export const MAX_BANKED_KEYS = 3;

const MS_PER_DAY = 86_400_000;

/** Midnight UTC on the day containing `d`, as epoch ms. */
export function utcMidnight(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Parse a stored `yyyy-MM-dd` date as a UTC day.
 *
 * Join and unlock dates are plain calendar strings, so reading them as UTC
 * keeps the day count stable wherever the user travels afterwards.
 */
export function parseUtcDay(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const year  = Number(m[1]);
  const month = Number(m[2]);
  const day   = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const ms = Date.UTC(year, month - 1, day);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Whole UTC days elapsed since the join date. Never negative — a device clock
 * behind the recorded join date is treated as day 0 rather than producing a
 * negative balance.
 */
export function utcDaysSinceJoin(joinDate: string | null | undefined, now: Date = new Date()): number {
  const join = parseUtcDay(joinDate);
  if (join === null) return 0;
  return Math.max(0, Math.floor((utcMidnight(now) - join) / MS_PER_DAY));
}

/** Total keys ever granted since joining, ignoring the cap. Diagnostic only. */
export function keysGranted(joinDate: string | null | undefined, now: Date = new Date()): number {
  return DAY_ZERO_KEYS + utcDaysSinceJoin(joinDate, now) * KEYS_PER_DAY;
}

/**
 * The day the ledger starts from, in epoch ms.
 *
 * Falls back to the EARLIEST unlock when the profile has no usable join date.
 *
 * Without this fallback a missing `appJoinDate` was catastrophic and silent:
 * `unlockDayIndices` returned [] because it had nothing to measure against,
 * so every spend vanished from the ledger and `availableKeys` reported a
 * full bank of 3 no matter how many numbers had been opened — 3 after three
 * unlocks, still 3 after nine. The balance check inside `redeemKey` is the
 * authoritative one, so it also meant the entire catalogue could be opened in
 * a single sitting. Anyone whose profile predates the field, or whose profile
 * came back from a cloud restore without it, hit exactly this.
 *
 * Someone who has opened numbers has demonstrably been here since at least
 * the first of them, so that date is a sound anchor. With no join date AND no
 * unlocks there is nothing to reconstruct and nothing to get wrong: a full
 * bank is the right answer for a genuinely new user.
 */
function resolveJoinDay(
  joinDate:    string | null | undefined,
  unlockDates: readonly string[],
): number | null {
  const explicit = parseUtcDay(joinDate);
  if (explicit !== null) return explicit;

  let earliest: number | null = null;
  for (const iso of unlockDates) {
    const day = parseUtcDay(iso);
    if (day !== null && (earliest === null || day < earliest)) earliest = day;
  }
  return earliest;
}

/** Day index (0-based, UTC) of each unlock, relative to the join date. */
function unlockDayIndices(
  joinDate:    string | null | undefined,
  unlockDates: readonly string[],
): number[] {
  const join = resolveJoinDay(joinDate, unlockDates);
  if (join === null) return [];
  const out: number[] = [];
  for (const iso of unlockDates) {
    const day = parseUtcDay(iso);
    if (day === null) continue;
    // Clamp: an unlock stamped before the join date (clock skew, restored
    // backup) still counts as a spend, on day 0.
    out.push(Math.max(0, Math.floor((day - join) / MS_PER_DAY)));
  }
  return out.sort((a, b) => a - b);
}

/**
 * Keys accrued over the days in `(from, to]`, added to `balance` and capped.
 *
 * Capping the sum is equivalent to capping each day individually, because
 * `min(C, x + 1)` applied repeatedly to a growing value equals `min(C, x + n)`.
 */
function accrue(balance: number, from: number, to: number): number {
  if (to <= from) return balance;
  const includesDayZero = from < 0;
  const plainDays = includesDayZero ? to : to - from;
  const granted   = includesDayZero
    ? DAY_ZERO_KEYS + Math.max(0, plainDays) * KEYS_PER_DAY
    : plainDays * KEYS_PER_DAY;
  return Math.min(MAX_BANKED_KEYS, balance + granted);
}

/**
 * Keys available to spend right now.
 *
 * Replays the ledger day by day: grant, cap, spend. That is what makes the cap
 * behave like a regenerating bank rather than a ceiling on a lifetime total.
 *
 * O(unlocks), and the catalogue is 25 — no iteration over elapsed days, so a
 * user three years in costs the same as one on their first morning.
 */
export function availableKeys(
  joinDate:    string | null | undefined,
  unlockDates: readonly string[],
  now:         Date = new Date(),
): number {
  // Resolve once and measure BOTH the elapsed days and the spend indices
  // from the same anchor — mixing an explicit join date with a fallback
  // anchor would count days from one origin and spends from another.
  const join  = resolveJoinDay(joinDate, unlockDates);
  const today = join === null
    ? 0
    : Math.max(0, Math.floor((utcMidnight(now) - join) / MS_PER_DAY));
  const spent = unlockDayIndices(joinDate, unlockDates);

  let balance = 0;
  let cursor  = -1;              // before day 0, so day 0's batch is granted

  for (const day of spent) {
    const spendDay = Math.min(day, today);   // a future-dated unlock spends today
    balance = accrue(balance, cursor, spendDay);
    balance = Math.max(0, balance - 1);
    cursor  = spendDay;
  }

  return accrue(balance, cursor, today);
}

/** The instant the next key is granted: the next UTC midnight after `now`. */
export function nextKeyAt(now: Date = new Date()): Date {
  return new Date(utcMidnight(now) + MS_PER_DAY);
}

/** Milliseconds until the next key. Always positive. */
export function msUntilNextKey(now: Date = new Date()): number {
  return Math.max(0, nextKeyAt(now).getTime() - now.getTime());
}

/**
 * "6h 12m" — how long until the next key.
 * Deliberately coarse: a live-ticking seconds counter would be a battery cost
 * and an anxiety machine for something that happens once a day.
 */
export function formatTimeUntilNextKey(now: Date = new Date()): string {
  const ms = msUntilNextKey(now);
  const totalMinutes = Math.ceil(ms / 60_000);
  const hours   = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 1) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  if (totalMinutes >= 1) return `${totalMinutes}m`;
  return 'any moment';
}

// ─── Unlock state for the whole catalogue ─────────────────────

export interface UnlockSummary {
  /** Keys the user can spend right now. */
  available:   number;
  /** Numbers opened so far. */
  unlocked:    number;
  /** Numbers in the catalogue. */
  total:       number;
  /** Numbers still sealed. */
  remaining:   number;
  /** True once every number has been opened. */
  allComplete: boolean;
  /** True when the user has a key and something to spend it on. */
  canUnlock:   boolean;
  /** When the next key arrives. */
  nextKeyAt:   Date;
}

export function summarizeUnlocks(
  joinDate:    string | null | undefined,
  unlockDates: readonly string[],
  total:       number,
  now:         Date = new Date(),
): UnlockSummary {
  const unlocked  = Math.min(unlockDates.length, total);
  const remaining = Math.max(0, total - unlocked);
  const available = Math.min(availableKeys(joinDate, unlockDates, now), remaining);

  return {
    available,
    unlocked,
    total,
    remaining,
    allComplete: remaining === 0,
    canUnlock:   available > 0 && remaining > 0,
    nextKeyAt:   nextKeyAt(now),
  };
}
