/**
 * Clock store — a single reactive "tick" that bumps when the app returns to
 * the foreground (and once per minute while foregrounded).
 *
 * Why: several derived values depend on the wall clock — the 7-day trial
 * boundary (computeProStatus) and daily stat unlocks (useAllStats). Those are
 * computed with `new Date()` at render time, so nothing re-renders them when
 * real time crosses midnight or the trial boundary while the component stays
 * mounted. Subscribing to `tick` gives them a cheap, centralised recompute
 * trigger without per-component AppState listeners.
 *
 * Setup: call startClock() once at app root (_layout.tsx). Idempotent.
 */
import { create } from 'zustand';
import { AppState, type AppStateStatus } from 'react-native';

interface ClockState {
  /** Monotonically increasing counter. Include in memo deps to recompute. */
  tick: number;
  bump: () => void;
}

export const useClockStore = create<ClockState>((set) => ({
  tick: 0,
  bump: () => set((s) => ({ tick: s.tick + 1 })),
}));

let started = false;
let interval: ReturnType<typeof setInterval> | null = null;

/**
 * Begin driving the clock tick. Safe to call multiple times — no-ops after the
 * first. Registers ONE AppState listener (bump on → 'active') plus a coarse
 * 60 s interval so long-open sessions still cross midnight / trial boundaries.
 */
export function startClock(): void {
  if (started) return;
  started = true;

  AppState.addEventListener('change', (next: AppStateStatus) => {
    if (next === 'active') useClockStore.getState().bump();
  });

  // Low-frequency safety net for sessions left open across a day boundary.
  // 60 s is coarse enough to be negligible for battery/render cost.
  interval = setInterval(() => {
    if (AppState.currentState === 'active') {
      useClockStore.getState().bump();
    }
  }, 60_000);
}

/** Tear down the interval. Rarely needed (app-lifetime singleton). */
export function stopClock(): void {
  if (interval) { clearInterval(interval); interval = null; }
  started = false;
}
