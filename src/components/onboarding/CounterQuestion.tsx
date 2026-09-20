/**
 * CounterQuestion — reusable +/- counter onboarding screen body.
 * Mirrors the coffee/sleep screen pattern (illustration circle, question,
 * spring counter, continue) so new questions ship without 370-line clones.
 * Renders a live WowFact strip that recomputes as the value changes.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router, type Href } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { OnboardingShell } from '@/components/onboarding/OnboardingShell';
import { WowFact } from '@/components/onboarding/WowFact';
import { colors, spacing, radius, fontFamily } from '@/theme';

// ─── Animated number ─────────────────────────────────────────
function NumberDisplay({ value, format }: { value: number; format?: (v: number) => string }) {
  const scale   = useSharedValue(1);
  const prevRef = useRef(value);

  useEffect(() => {
    if (value !== prevRef.current) {
      scale.value = withSequence(
        withSpring(0.72, { stiffness: 600, damping: 12 }),
        withSpring(1.08, { stiffness: 300, damping: 18 }),
        withSpring(1.0,  { stiffness: 300, damping: 25 }),
      );
      prevRef.current = value;
    }
  }, [value]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.Text style={[styles.numberText, style]}>
      {format ? format(value) : String(value)}
    </Animated.Text>
  );
}

// ─── Props ───────────────────────────────────────────────────
export interface CounterQuestionProps {
  step:       number;
  icon:       string;
  question:   string;
  hint:       string;
  value:      number;
  onChange:   (v: number) => void;
  min:        number;
  max:        number;
  stepSize?:  number;
  unitFor:    (v: number) => string;
  formatValue?: (v: number) => string;
  nextRoute:  Href;
  /** Live wow strip below the counter. */
  wow: {
    icon:   string;
    figure: string;
    label:  string;
    punch?: string;
  };
  decreaseLabel: string;
  increaseLabel: string;
}

// ─── Screen body ─────────────────────────────────────────────
export function CounterQuestion({
  step,
  icon,
  question,
  hint,
  value,
  onChange,
  min,
  max,
  stepSize = 1,
  unitFor,
  formatValue,
  nextRoute,
  wow,
  decreaseLabel,
  increaseLabel,
}: CounterQuestionProps) {
  const illustrationOp = useSharedValue(0);
  const illustrationY  = useSharedValue(-18);
  const questionOp     = useSharedValue(0);
  const questionY      = useSharedValue(22);
  const counterOp      = useSharedValue(0);
  const counterY       = useSharedValue(18);
  const btnOp          = useSharedValue(0);
  const minusScale     = useSharedValue(1);
  const plusScale      = useSharedValue(1);

  useEffect(() => {
    illustrationY.value  = withSpring(0, { stiffness: 180, damping: 18 });
    illustrationOp.value = withTiming(1, { duration: 380 });
    questionY.value  = withDelay(200, withSpring(0, { stiffness: 200, damping: 18 }));
    questionOp.value = withDelay(200, withTiming(1, { duration: 320 }));
    counterY.value   = withDelay(340, withSpring(0, { stiffness: 200, damping: 18 }));
    counterOp.value  = withDelay(340, withTiming(1, { duration: 300 }));
    btnOp.value      = withDelay(480, withTiming(1, { duration: 300 }));
  }, []);

  const illustrationStyle = useAnimatedStyle(() => ({
    opacity:   illustrationOp.value,
    transform: [{ translateY: illustrationY.value }],
  }));
  const questionStyle = useAnimatedStyle(() => ({
    opacity:   questionOp.value,
    transform: [{ translateY: questionY.value }],
  }));
  const counterStyle = useAnimatedStyle(() => ({
    opacity:   counterOp.value,
    transform: [{ translateY: counterY.value }],
  }));
  const btnStyle   = useAnimatedStyle(() => ({ opacity: btnOp.value }));
  const minusStyle = useAnimatedStyle(() => ({ transform: [{ scale: minusScale.value }] }));
  const plusStyle  = useAnimatedStyle(() => ({ transform: [{ scale: plusScale.value }] }));

  const decrement = () => {
    if (value <= min) return;
    Haptics.selectionAsync();
    minusScale.value = withSequence(
      withSpring(0.8, { stiffness: 500, damping: 12 }),
      withSpring(1.0, { stiffness: 300, damping: 25 })
    );
    onChange(Math.max(min, value - stepSize));
  };

  const increment = () => {
    if (value >= max) return;
    Haptics.selectionAsync();
    plusScale.value = withSequence(
      withSpring(0.8, { stiffness: 500, damping: 12 }),
      withSpring(1.0, { stiffness: 300, damping: 25 })
    );
    onChange(Math.min(max, value + stepSize));
  };

  return (
    <OnboardingShell step={step}>
      <View style={styles.content}>

        {/* ── Illustration ── */}
        <Animated.View style={[styles.illustrationWrap, illustrationStyle]}>
          <View style={styles.illustrationCircle}>
            <Ionicons name={icon as any} size={52} color={colors.green700} />
          </View>
        </Animated.View>

        {/* ── Question ── */}
        <Animated.View style={[styles.questionBlock, questionStyle]}>
          <Text style={styles.question}>{question}</Text>
          <Text style={styles.hint}>{hint}</Text>
        </Animated.View>

        <View style={{ flex: 1 }} />

        {/* ── Counter ── */}
        <Animated.View style={[styles.counterSection, counterStyle]}>
          <View style={styles.counterBlock}>
            <Pressable
              onPress={decrement}
              hitSlop={12}
              style={({ pressed }) => [styles.stepBtn, styles.stepBtnMinus, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel={decreaseLabel}
            >
              <Animated.View style={minusStyle}>
                <Ionicons name="remove" size={26} color={value <= min ? colors.green100 : colors.textSecondary} />
              </Animated.View>
            </Pressable>

            <View style={styles.numberWrap}>
              <NumberDisplay value={value} format={formatValue} />
              <Text style={styles.unitText}>{unitFor(value)}</Text>
            </View>

            <Pressable
              onPress={increment}
              hitSlop={12}
              style={({ pressed }) => [styles.stepBtn, styles.stepBtnPlus, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
              accessibilityLabel={increaseLabel}
            >
              <Animated.View style={plusStyle}>
                <Ionicons name="add" size={26} color={value >= max ? colors.green300 : colors.white} />
              </Animated.View>
            </Pressable>
          </View>

          {/* Live personalized insight */}
          <WowFact icon={wow.icon} figure={wow.figure} label={wow.label} punch={wow.punch} />
        </Animated.View>

        <View style={{ flex: 1 }} />

        {/* ── Continue ── */}
        <Animated.View style={btnStyle}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push(nextRoute);
            }}
            style={({ pressed }) => [styles.nextBtn, pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] }]}
          >
            <Text style={styles.nextText}>Continue</Text>
          </Pressable>
        </Animated.View>

      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  content: {
    flex:          1,
    paddingTop:    spacing[5],
    paddingBottom: spacing[4],
  },

  illustrationWrap: {
    alignItems:   'center',
    marginBottom: spacing[7],
  },
  illustrationCircle: {
    width:           148,
    height:          148,
    borderRadius:    74,
    backgroundColor: colors.green50,
    borderWidth:     1,
    borderColor:     colors.green100,
    alignItems:      'center',
    justifyContent:  'center',
  },

  questionBlock: { alignItems: 'center' },
  question: {
    fontFamily:    fontFamily.bold,
    fontSize:      26.5,
    color:         colors.textPrimary,
    lineHeight:    34,
    textAlign:     'center',
    letterSpacing: -0.4,
    marginBottom:  spacing[2],
  },
  hint: {
    fontFamily: fontFamily.regular,
    fontSize:   13,
    color:      colors.textMuted,
  },

  counterSection: {
    alignSelf: 'stretch',
    gap:       spacing[5],
  },
  counterBlock: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            spacing[6],
  },
  stepBtn: {
    width:          56,
    height:         56,
    borderRadius:   28,
    alignItems:     'center',
    justifyContent: 'center',
  },
  stepBtnMinus: {
    borderWidth:     1.5,
    borderColor:     colors.border,
    backgroundColor: colors.white,
  },
  stepBtnPlus: {
    backgroundColor: colors.green700,
    shadowColor:     colors.green900,
    shadowOffset:    { width: 0, height: 3 },
    shadowOpacity:   0.2,
    shadowRadius:    8,
    elevation:       4,
  },
  numberWrap: {
    alignItems: 'center',
    minWidth:   100,
  },
  numberText: {
    fontFamily:    fontFamily.extraBold,
    fontSize:      67.5,
    color:         colors.green700,
    letterSpacing: -3,
    lineHeight:    75,
  },
  unitText: {
    fontFamily: fontFamily.medium,
    fontSize:   13,
    color:      colors.textMuted,
    marginTop:  -spacing[2],
  },

  nextBtn: {
    backgroundColor: colors.green700,
    borderRadius:    radius.xl,
    paddingVertical: spacing[5],
    alignItems:      'center',
    marginBottom:    spacing[2],
    shadowColor:     colors.green900,
    shadowOffset:    { width: 0, height: 3 },
    shadowOpacity:   0.15,
    shadowRadius:    8,
    elevation:       4,
  },
  nextText: {
    fontFamily:    fontFamily.bold,
    fontSize:      16,
    color:         colors.white,
    letterSpacing: 0.2,
  },
});
