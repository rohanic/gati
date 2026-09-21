/**
 * WowFact — live personalized insight strip for onboarding questions.
 *
 * The psychology: every answer instantly converts into a lifetime-scale
 * figure ("3 cups a day" → "≈ 28,470 cups so far"). The user feels the app
 * computing THEIR life in real time, not collecting generic survey data.
 * Springs on every value change so the number feels alive.
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, fontFamily } from '@/theme';
import { Text } from '@/components/ui/Text';

interface WowFactProps {
  icon:     string;
  /** The big personalized figure, pre-formatted (e.g. "28,470"). */
  figure:   string;
  /** What the figure means (e.g. "cups of coffee so far in your life"). */
  label:    string;
  /** Optional second line that lands the punch (e.g. "Enough to fill 47 bathtubs."). */
  punch?:   string;
  /** Entrance delay ms. */
  delay?:   number;
}

export function WowFact({ icon, figure, label, punch, delay = 420 }: WowFactProps) {
  const op    = useSharedValue(0);
  const ty    = useSharedValue(10);
  const pop   = useSharedValue(1);
  const prev  = useRef(figure);

  useEffect(() => {
    op.value = withDelay(delay, withTiming(1, { duration: 320 }));
    ty.value = withDelay(delay, withSpring(0, { stiffness: 220, damping: 22, overshootClamping: true }));
  }, []);

  // Pop the figure when it changes
  useEffect(() => {
    if (figure !== prev.current) {
      prev.current = figure;
      pop.value = withSequence(
        withSpring(1.06, { stiffness: 600, damping: 14 }),
        withSpring(1,    { stiffness: 300, damping: 22 })
      );
    }
  }, [figure]);

  const wrapStyle   = useAnimatedStyle(() => ({
    opacity:   op.value,
    transform: [{ translateY: ty.value }],
  }));
  const figureStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
  }));

  return (
    <Animated.View style={[styles.wrap, wrapStyle]}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon as any} size={15} color={colors.green700} />
      </View>
      <View style={styles.textCol}>
        <View style={styles.figureRow}>
          <Animated.Text style={[styles.figure, figureStyle]} maxFontSizeMultiplier={1.3}>{figure}</Animated.Text>
          <Text style={styles.label}> {label}</Text>
        </View>
        {punch ? <Text style={styles.punch}>{punch}</Text> : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing[3],
    backgroundColor: colors.green50,
    borderRadius:    radius.xl,
    borderWidth:     1,
    borderColor:     colors.green100,
    paddingVertical: spacing[3] + 2,
    paddingHorizontal: spacing[4],
  },
  iconWrap: {
    width:           32,
    height:          32,
    borderRadius:    radius.md,
    backgroundColor: colors.white,
    borderWidth:     1,
    borderColor:     colors.green100,
    alignItems:      'center',
    justifyContent:  'center',
  },
  textCol:   { flex: 1 },
  figureRow: {
    flexDirection: 'row',
    alignItems:    'baseline',
    flexWrap:      'wrap',
  },
  figure: {
    fontFamily:    fontFamily.extraBold,
    fontSize:      17,
    color:         colors.green700,
    letterSpacing: -0.4,
  },
  label: {
    fontFamily: fontFamily.medium,
    fontSize:   12,
    color:      colors.textSecondary,
  },
  punch: {
    fontFamily: fontFamily.regular,
    fontSize:   11.5,
    color:      colors.textMuted,
    marginTop:  2,
    lineHeight: 16,
  },
});
