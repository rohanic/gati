/**
 * Screen time screen — step 5 of 10.
 * Illustration: phone silhouette with animated inner grid.
 * Interaction: spring-bounce counter (1–12 hours).
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
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

const MIN = 1;
const MAX = 12;

// ─── Phone illustration ──────────────────────────────────────
function PhoneIllustration() {
  const glowOp = useSharedValue(0.4);

  useEffect(() => {
    glowOp.value = withRepeat(
      withSequence(
        withTiming(0.9, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.4, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true
    );
  }, []);

  const screenStyle = useAnimatedStyle(() => ({ opacity: glowOp.value }));

  // 2x4 mini app grid inside phone
  const APP_COLORS = [
    colors.green100, colors.green300,
    colors.green100, colors.green100,
    colors.green300, colors.green100,
    colors.green100, colors.green300,
  ];

  return (
    <View style={phoneStyles.phone}>
      {/* Status bar */}
      <View style={phoneStyles.statusBar} />
      {/* Screen area */}
      <Animated.View style={[phoneStyles.screen, screenStyle]}>
        <View style={phoneStyles.appGrid}>
          {APP_COLORS.map((c, i) => (
            <View key={i} style={[phoneStyles.appIcon, { backgroundColor: c }]} />
          ))}
        </View>
      </Animated.View>
      {/* Home indicator */}
      <View style={phoneStyles.homeBar} />
    </View>
  );
}

const phoneStyles = StyleSheet.create({
  phone: {
    width:           68,
    height:          110,
    borderRadius:    14,
    borderWidth:     2.5,
    borderColor:     colors.textSecondary,
    backgroundColor: colors.white,
    overflow:        'hidden',
    alignItems:      'center',
  },
  statusBar: {
    width:           '100%',
    height:          8,
    backgroundColor: colors.green100,
  },
  screen: {
    flex:            1,
    width:           '100%',
    backgroundColor: colors.green50,
    alignItems:      'center',
    justifyContent:  'center',
    padding:         6,
  },
  appGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           4,
    width:         48,
  },
  appIcon: {
    width:        10,
    height:       10,
    borderRadius: 3,
  },
  homeBar: {
    width:           28,
    height:          3,
    borderRadius:    2,
    backgroundColor: colors.textSecondary,
    marginVertical:  5,
    opacity:         0.5,
  },
});

// ─── Number display ──────────────────────────────────────────
function NumberDisplay({ value }: { value: number }) {
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
    <Animated.Text style={[styles.numberText, style]}>{value}</Animated.Text>
  );
}

// ─── Main screen ─────────────────────────────────────────────
export default function ScreenTimeScreen() {
  const { phoneHours, setPhoneHours, dateOfBirth } = useOnboardingStore();
  const value = phoneHours;

  // Live lifetime figure (screens counted from ~age 10)
  const daysAlive    = Math.max(1, differenceInDays(new Date(), dateOfBirth ?? new Date(2000, 0, 1)));
  const screenDays   = Math.max(1, daysAlive - 10 * 365.25);
  const lifetimeDays = Math.floor((screenDays * value) / 24);

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
    if (value <= MIN) return;
    Haptics.selectionAsync();
    minusScale.value = withSequence(
      withSpring(0.8, { stiffness: 500, damping: 12 }),
      withSpring(1.0, { stiffness: 300, damping: 25 })
    );
    setPhoneHours(value - 1);
  };

  const increment = () => {
    if (value >= MAX) return;
    Haptics.selectionAsync();
    plusScale.value = withSequence(
      withSpring(0.8, { stiffness: 500, damping: 12 }),
      withSpring(1.0, { stiffness: 300, damping: 25 })
    );
    setPhoneHours(value + 1);
  };

  return (
    <OnboardingShell step={6}>
      <View style={styles.content}>

        {/* ── Illustration ── */}
        <Animated.View style={[styles.illustrationWrap, illustrationStyle]}>
          <View style={styles.illustrationCircle}>
            <PhoneIllustration />
          </View>
        </Animated.View>

        {/* ── Question ── */}
        <Animated.View style={[styles.questionBlock, questionStyle]}>
          <Text style={styles.question}>How much daily{'\n'}screen time?</Text>
          <Text style={styles.hint}>The average adult uses 7 hrs/day</Text>
        </Animated.View>

        <View style={{ flex: 1 }} />

        {/* ── Counter ── */}
        <Animated.View style={[styles.counterBlock, counterStyle]}>
          <Pressable
            onPress={decrement}
            hitSlop={12}
            style={({ pressed }) => [styles.stepBtn, styles.stepBtnMinus, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
            accessibilityLabel="Decrease screen time"
          >
            <Animated.View style={minusStyle}>
              <Ionicons name="remove" size={26} color={value <= MIN ? colors.green100 : colors.textSecondary} />
            </Animated.View>
          </Pressable>

          <View style={styles.numberWrap}>
            <NumberDisplay value={value} />
            <Text style={styles.unitText}>{value === 1 ? 'hour' : 'hours'}</Text>
          </View>

          <Pressable
            onPress={increment}
            hitSlop={12}
            style={({ pressed }) => [styles.stepBtn, styles.stepBtnPlus, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
            accessibilityLabel="Increase screen time"
          >
            <Animated.View style={plusStyle}>
              <Ionicons name="add" size={26} color={value >= MAX ? colors.green300 : colors.white} />
            </Animated.View>
          </Pressable>
        </Animated.View>

        {/* Live lifetime insight */}
        <Animated.View style={counterStyle}>
          <WowFact
            icon="phone-portrait-outline"
            figure={lifetimeDays.toLocaleString('en-US')}
            label="full days of your life on screen"
            punch={value >= 6 ? 'Seeing it as days changes it, doesn\'t it?' : 'Lighter than most. Your attention is yours.'}
          />
        </Animated.View>

        <View style={{ flex: 1 }} />

        {/* ── Continue ── */}
        <Animated.View style={btnStyle}>
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/onboarding/music'); }}
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
    minWidth:   90,
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
