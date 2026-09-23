/**
 * Entrance animation whose resting state belongs to React, not the UI thread.
 *
 * ── The failure this exists to prevent ─────────────────────────────────
 * Every screen used the same idiom: a shared value starts at opacity 0 (plus
 * a spring-driven slide or scale), and a mount effect animates it to 1. The
 * end state — visible, in place — then lives ONLY in the native view, set
 * from the UI thread. React's props still say opacity 0 and the start offset,
 * because that is what the first render computed.
 *
 * Anything that rebuilds or re-commits those views from React's props puts
 * them back at the start: invisible, or pushed out of place. On Android that
 * happened on returning from Google sign-in — the Profile header and every
 * settings row came back blank while the stats card, which has no entrance,
 * was fine. Leaving for Maps, the share sheet or Play billing is the same
 * round trip.
 *
 * ── How this avoids it ─────────────────────────────────────────────────
 *   • Timing, not springs. An entrance does not need physics, and a spring's
 *     state is one more thing that can be caught mid-flight.
 *   • Once the entrance has had time to finish, the hook returns undefined.
 *     The component then renders with no animated style at all, so React's
 *     own props describe the final, visible state — and a rebuild from those
 *     props is a no-op instead of a reset.
 *   • Settling runs on a JS timer rather than the animation's completion
 *     callback, so it happens even if the UI-thread animation never got a
 *     frame (a screen mounted while the app was in the background).
 *
 * Use for mount-time entrances only. Press feedback, loops and gestures start
 * from a visible state and are not at risk.
 */
import { useEffect, useState } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';

export interface EntranceOptions {
  /** Wait before starting, ms. */
  delay?:       number;
  /** Length of the entrance, ms. */
  duration?:    number;
  /** Starting opacity. 0 fades in from nothing. */
  fromOpacity?: number;
  /** Starting horizontal offset, dp. Ends at 0. */
  translateX?:  number;
  /** Starting vertical offset, dp. Ends at 0. */
  translateY?:  number;
  /** Starting scale. Ends at 1. */
  scale?:       number;
}

/**
 * Ease-out cubic: fast start, soft landing. Visually close to the damped
 * springs it replaces, with none of their state.
 */
const ENTRANCE_EASING = Easing.out(Easing.cubic);

/** Slack after the expected end before the style is dropped, ms. */
export const SETTLE_MARGIN_MS = 250;

export function useEntrance({
  delay       = 0,
  duration    = 320,
  fromOpacity = 0,
  translateX  = 0,
  translateY  = 0,
  scale       = 1,
}: EntranceOptions = {}) {
  const [settled, setSettled] = useState(false);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration, easing: ENTRANCE_EASING }));
    const timer = setTimeout(() => setSettled(true), delay + duration + SETTLE_MARGIN_MS);
    return () => clearTimeout(timer);
  }, [delay, duration, progress]);

  const animated = useAnimatedStyle(() => {
    const p = progress.value;
    const transform: ({ translateX: number } | { translateY: number } | { scale: number })[] = [];
    if (translateX !== 0) transform.push({ translateX: (1 - p) * translateX });
    if (translateY !== 0) transform.push({ translateY: (1 - p) * translateY });
    if (scale !== 1)      transform.push({ scale: scale + (1 - scale) * p });
    const opacity = fromOpacity + (1 - fromOpacity) * p;
    return transform.length ? { opacity, transform } : { opacity };
  });

  return settled ? undefined : animated;
}
