/**
 * CountUpText — UI-thread animated number.
 *
 * The previous pattern (useAnimatedReaction → runOnJS → setState) re-rendered
 * the whole owning component ~60×/sec for the full count-up duration, causing
 * dropped frames on mid-range Android. This component uses the ReText pattern:
 * an Animated TextInput whose `text` prop is driven entirely on the UI thread
 * via useAnimatedProps. Zero React re-renders during the animation.
 */
import React, { useEffect, useRef } from 'react';
import { TextInput, StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/** Worklet-safe number formatter (toLocaleString is not worklet-safe). */
function formatNumberWorklet(value: number, precision: number): string {
  'worklet';
  if (precision > 0) {
    const fixed = value.toFixed(precision);
    const [int, dec] = fixed.split('.');
    let out = '';
    for (let i = 0; i < int.length; i++) {
      if (i > 0 && (int.length - i) % 3 === 0) out += ',';
      out += int[i];
    }
    return dec !== undefined ? `${out}.${dec}` : out;
  }
  const s = Math.floor(value).toString();
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ',';
    out += s[i];
  }
  return out;
}

interface CountUpTextProps {
  value:      number;
  precision?: number;
  duration?:  number;
  delay?:     number;
  style?:     StyleProp<TextStyle>;
  /** Re-runs the count-up whenever this key changes (e.g. stat id). */
  animateKey?: string | number;
}

export function CountUpText({
  value,
  precision = 0,
  duration  = 1100,
  delay     = 150,
  style,
  animateKey,
}: CountUpTextProps) {
  // displayValue animates directly to the target (not via a 0–1 progress proxy).
  // This lets us do quick delta-tweens on live updates without resetting to 0.
  const displayValue = useSharedValue(0);
  // When the animateKey just changed, the value effect must not override the
  // full count-up with a quick tween — this flag suppresses it for one cycle.
  const skipLiveUpdate = useRef(true);

  // ── Full count-up: fires on initial mount and whenever animateKey changes ──
  useEffect(() => {
    skipLiveUpdate.current = true;
    displayValue.value     = 0;
    displayValue.value     = withDelay(
      delay,
      withTiming(value, { duration, easing: Easing.bezier(0.23, 1, 0.32, 1) })
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animateKey ?? value]);

  // ── Live update: fires when value changes but animateKey hasn't ──
  // Only active when animateKey is explicitly set (live-ticking stats).
  // Quick 700 ms tween from wherever the animation currently is → new value.
  useEffect(() => {
    if (animateKey === undefined) return; // handled by full count-up above
    if (skipLiveUpdate.current) { skipLiveUpdate.current = false; return; }
    displayValue.value = withTiming(value, { duration: 700 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const animatedProps = useAnimatedProps(() => ({
    text:         formatNumberWorklet(displayValue.value, precision),
    defaultValue: formatNumberWorklet(displayValue.value, precision),
  } as any));

  return (
    <AnimatedTextInput
      editable={false}
      underlineColorAndroid="transparent"
      animatedProps={animatedProps}
      style={[styles.base, style]}
      allowFontScaling={false}
      accessible={false}
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  base: {
    padding: 0,
    margin:  0,
    includeFontPadding: false,
  } as TextStyle,
});
