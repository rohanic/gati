/**
 * Collapsible — the ONE way to expand/collapse content in Gati.
 *
 * Design notes (each solves a shipped bug):
 *
 * 1. Height animates with `overshootClamping` → springy feel but lands
 *    EXACTLY at target. (Underdamped springs caused the up-down bounce.)
 *
 * 2. Content is measured IN normal flow — not absolutely positioned.
 *    On Android, touches are only delivered inside a clipped parent's
 *    bounds; with absolute content, a scenario change that grew the
 *    content pushed buttons (e.g. What-If "Next") outside the stale
 *    container height where taps silently died. In-flow content makes
 *    onLayout re-measure reliably and the height track it, so buttons
 *    always sit inside touchable bounds.
 *
 * 3. `pointerEvents` disabled while closed so clipped content can
 *    never swallow taps meant for elements above it.
 *
 * Content stays mounted, so inner state (e.g. What-If deck index)
 * survives toggling.
 */
import React, { useState } from 'react';
import { View, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
  withTiming,
  withDelay,
} from 'react-native-reanimated';

const SPRING = {
  stiffness:          260,
  damping:            30,
  overshootClamping:  true,   // ← lands exactly at target, no bounce
} as const;

interface CollapsibleProps {
  open:     boolean;
  children: React.ReactNode;
}

export function Collapsible({ open, children }: CollapsibleProps) {
  const [measuredH, setMeasuredH] = useState(0);
  const progress = useSharedValue(open ? 1 : 0);
  const fade     = useSharedValue(open ? 1 : 0);

  React.useEffect(() => {
    if (open) {
      progress.value = withSpring(1, SPRING);
      fade.value     = withDelay(90, withTiming(1, { duration: 200 }));
    } else {
      // Content fades first, then height settles shut — clean, no jump
      fade.value     = withTiming(0, { duration: 110 });
      progress.value = withDelay(70, withSpring(0, SPRING));
    }
  }, [open]);

  const height = useDerivedValue(() => progress.value * measuredH);

  const containerStyle = useAnimatedStyle(() => ({
    // Until first measurement, let content size itself naturally
    height: measuredH === 0 ? undefined : height.value,
  }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    const h = Math.ceil(e.nativeEvent.layout.height);
    if (h > 0 && h !== measuredH) setMeasuredH(h);
  };

  return (
    <Animated.View
      style={[styles.container, containerStyle]}
      pointerEvents={open ? 'auto' : 'none'}
    >
      {/* IN-FLOW content: lays out at natural height inside the clipped
          container (flexShrink 0), so onLayout always reports the true
          height and open-state touch targets stay inside bounds. */}
      <Animated.View style={[styles.inner, contentStyle]} onLayout={onLayout}>
        {children}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  inner: {
    flexShrink: 0,
  },
});
