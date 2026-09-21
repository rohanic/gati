/**
 * Sleep screen — step 3 of 10.
 * Illustration: moon + scattered star dots.
 * Interaction: spring-bounce number stepper (4–11 hours).
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  withSequence,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { differenceInDays } from 'date-fns';
import { OnboardingShell } from '@/components/onboarding/OnboardingShell';
import { WowFact } from '@/components/onboarding/WowFact';
import { useOnboardingStore } from '@/store/onboardingStore';
import { colors, spacing, radius, fontFamily } from '@/theme';
import { Text } from '@/components/ui/Text';

const MIN = 4;
const MAX = 11;

// ─── Star dot (tiny animated) ────────────────────────────────
function Star({ x, y, size, delay }: { x: number; y: number; size: number; delay: number }) {
  const scale   = useSharedValue(0);
  const opacity = useSharedValue(0);
  const twinkle = useSharedValue(1);

  useEffect(() => {
    scale.value   = withDelay(delay, withSpring(1, { stiffness: 400, damping: 20 }));
    opacity.value = withDelay(delay, withTiming(0.8, { duration: 300 }));
    twinkle.value = withDelay(delay + 800,
      withRepeat(
        withSequence(
          withTiming(0.3, { duration: 1200 + delay % 600, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.9, { duration: 1200 + delay % 600, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true
      )
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity:   opacity.value * twinkle.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[{
        position:     'absolute',
        left:         x,
        top:          y,
        width:        size,
        height:       size,
        borderRadius: size / 2,
        backgroundColor: colors.green300,
      }, style]}
    />
  );
}

// ─── Number display with spring ──────────────────────────────
function NumberDisplay({ value }: { value: number }) {
  const scaleVal = useSharedValue(1);
  const prevRef  = useRef(value);

  useEffect(() => {
    if (value !== prevRef.current) {
      const dir = value > prevRef.current ? 1 : -1;
      scaleVal.value = withSequence(
        withSpring(0.72, { stiffness: 600, damping: 12 }),
        withSpring(1.08, { stiffness: 300, damping: 18 }),
        withSpring(1.0,  { stiffness: 300, damping: 25 }),
      );
      prevRef.current = value;
    }
  }, [value]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scaleVal.value }] }));

  return (
    <Animated.Text style={[styles.numberText, style]} maxFontSizeMultiplier={1.3}>
      {value}
    </Animated.Text>
  );
}

// ─── Main screen ─────────────────────────────────────────────
export default function SleepScreen() {
  const { sleepHours, setSleepHours, dateOfBirth } = useOnboardingStore();
  const value = sleepHours;

  // Live lifetime figure
  const daysAlive     = Math.max(1, differenceInDays(new Date(), dateOfBirth ?? new Date(2000, 0, 1)));
  const lifetimeYears = ((daysAlive * value) / 24 / 365.25);

  // Entrance animations
  const illustrationY  = useSharedValue(-20);
  const illustrationOp = useSharedValue(0);
  const questionY      = useSharedValue(24);
  const questionOp     = useSharedValue(0);
  const counterOp      = useSharedValue(0);
  const counterY       = useSharedValue(20);
  const btnOp          = useSharedValue(0);

  // Minus/plus button scale refs
  const minusScale = useSharedValue(1);
  const plusScale  = useSharedValue(1);

  useEffect(() => {
    illustrationY.value  = withSpring(0, { stiffness: 180, damping: 18 });
    illustrationOp.value = withTiming(1, { duration: 400 });
    questionY.value  = withDelay(180, withSpring(0, { stiffness: 200, damping: 18 }));
    questionOp.value = withDelay(180, withTiming(1, { duration: 340 }));
    counterY.value   = withDelay(320, withSpring(0, { stiffness: 200, damping: 18 }));
    counterOp.value  = withDelay(320, withTiming(1, { duration: 300 }));
    btnOp.value      = withDelay(460, withTiming(1, { duration: 300 }));
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
  const btnStyle = useAnimatedStyle(() => ({ opacity: btnOp.value }));
  const minusStyle = useAnimatedStyle(() => ({ transform: [{ scale: minusScale.value }] }));
  const plusStyle  = useAnimatedStyle(() => ({ transform: [{ scale: plusScale.value }] }));

  const decrement = () => {
    if (value <= MIN) return;
    Haptics.selectionAsync();
    minusScale.value = withSequence(
      withSpring(0.8, { stiffness: 500, damping: 12 }),
      withSpring(1.0, { stiffness: 300, damping: 25 })
    );
    setSleepHours(value - 1);
  };

  const increment = () => {
    if (value >= MAX) return;
    Haptics.selectionAsync();
    plusScale.value = withSequence(
      withSpring(0.8, { stiffness: 500, damping: 12 }),
      withSpring(1.0, { stiffness: 300, damping: 25 })
    );
    setSleepHours(value + 1);
  };

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/onboarding/coffee');
  };

  return (
    <OnboardingShell step={3}>
      <View style={styles.content}>

        {/* ── Illustration ── */}
        <Animated.View style={[styles.illustrationWrap, illustrationStyle]}>
          <View style={styles.illustrationCircle}>
            {/* Moon icon */}
            <Ionicons name="moon" size={52} color={colors.textSecondary} />
            {/* Stars */}
            <Star x={18}  y={14}  size={5}  delay={300} />
            <Star x={108} y={22}  size={6}  delay={450} />
            <Star x={90}  y={10}  size={4}  delay={550} />
            <Star x={30}  y={100} size={5}  delay={650} />
            <Star x={105} y={96}  size={4}  delay={400} />
          </View>
        </Animated.View>

        {/* ── Question ── */}
        <Animated.View style={[styles.questionBlock, questionStyle]}>
          <Text style={styles.question}>How many hours do{'\n'}you sleep per night?</Text>
          <Text style={styles.hint}>Most adults need 7–9 hours</Text>
        </Animated.View>

        <View style={{ flex: 1 }} />

        {/* ── Counter ── */}
        <Animated.View style={[styles.counterBlock, counterStyle]}>
          {/* Minus */}
          <Pressable
            onPress={decrement}
            hitSlop={12}
            style={({ pressed }) => [styles.stepBtn, styles.stepBtnMinus, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
            accessibilityLabel="Decrease sleep hours"
          >
            <Animated.View style={minusStyle}>
              <Ionicons name="remove" size={26} color={value <= MIN ? colors.green100 : colors.textSecondary} />
            </Animated.View>
          </Pressable>

          {/* Number */}
          <View style={styles.numberWrap}>
            <NumberDisplay value={value} />
            <Text style={styles.unitText}>hours</Text>
          </View>

          {/* Plus */}
          <Pressable
            onPress={increment}
            hitSlop={12}
            style={({ pressed }) => [styles.stepBtn, styles.stepBtnPlus, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
            accessibilityLabel="Increase sleep hours"
          >
            <Animated.View style={plusStyle}>
              <Ionicons name="add" size={26} color={value >= MAX ? colors.green300 : colors.white} />
            </Animated.View>
          </Pressable>
        </Animated.View>

        {/* Live lifetime insight */}
        <Animated.View style={counterStyle}>
          <WowFact
            icon="moon-outline"
            figure={lifetimeYears.toFixed(1)}
            label="years of your life asleep"
            punch={`At ${value} hours a night, dreams have had ${Math.floor(daysAlive * value).toLocaleString('en-US')} hours of you.`}
          />
        </Animated.View>

        <View style={{ flex: 1 }} />

        {/* ── Continue ── */}
        <Animated.View style={btnStyle}>
          <Pressable
            onPress={handleNext}
            style={({ pressed }) => [styles.nextBtn, pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] }]}
            accessibilityRole="button"
            accessibilityLabel="Continue"
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

  // Illustration
  illustrationWrap: {
    alignItems:    'center',
    marginBottom:  spacing[7],
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
    position:        'relative',
    overflow:        'visible',
  },

  // Question
  questionBlock: {
    alignItems: 'center',
  },
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

  // Counter
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
    alignItems:   'center',
    minWidth:     90,
  },
  numberText: {
    fontFamily:    fontFamily.extraBold,
    fontSize:      75,
    color:         colors.green700,
    letterSpacing: -3,
    lineHeight:    82.5,
  },
  unitText: {
    fontFamily: fontFamily.medium,
    fontSize:   13,
    color:      colors.textMuted,
    marginTop:  -spacing[2],
  },

  // Button
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
