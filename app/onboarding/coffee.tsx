/**
 * Coffee screen — step 4 of 10.
 * Illustration: animated coffee cup with rising steam.
 * Interaction: spring-bounce counter (0–8 cups) + cup row visualizer.
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

const MIN = 0;
const MAX = 8;

// ─── Steam wisp ──────────────────────────────────────────────
function SteamWisp({ delay, offsetX }: { delay: number; offsetX: number }) {
  const y       = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    y.value = withDelay(delay,
      withRepeat(
        withSequence(
          withTiming(-22, { duration: 1000, easing: Easing.out(Easing.quad) }),
          withTiming(0,   { duration: 0 }),
        ),
        -1,
        false
      )
    );
    opacity.value = withDelay(delay,
      withRepeat(
        withSequence(
          withTiming(0.7, { duration: 300 }),
          withTiming(0.4, { duration: 500 }),
          withTiming(0,   { duration: 200 }),
          withTiming(0,   { duration: 0 }),
        ),
        -1,
        false
      )
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ translateY: y.value }, { translateX: offsetX }],
  }));

  return (
    <Animated.View style={[styles.steamWisp, style]} />
  );
}

// ─── Cup visualizer ──────────────────────────────────────────
function CupRow({ count }: { count: number }) {
  const SHOW = Math.min(count, 5);
  return (
    <View style={styles.cupRow}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Animated.View key={i}>
          <Ionicons
            name={i < SHOW ? 'cafe' : 'cafe-outline'}
            size={22}
            color={i < SHOW ? colors.green700 : colors.green100}
          />
        </Animated.View>
      ))}
    </View>
  );
}

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
    <Animated.Text style={[styles.numberText, style]} maxFontSizeMultiplier={1.3}>{value}</Animated.Text>
  );
}

// ─── Main screen ─────────────────────────────────────────────
export default function CoffeeScreen() {
  const { coffeeCups, setCoffeeCups, dateOfBirth } = useOnboardingStore();
  const value = coffeeCups;

  // Live lifetime figure — the app visibly computing YOUR life
  const daysAlive     = Math.max(1, differenceInDays(new Date(), dateOfBirth ?? new Date(2000, 0, 1)));
  const lifetimeCups  = Math.floor(daysAlive * value);
  const lifetimeLitres = Math.floor(lifetimeCups * 0.24);

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
  const btnStyle     = useAnimatedStyle(() => ({ opacity: btnOp.value }));
  const minusStyle   = useAnimatedStyle(() => ({ transform: [{ scale: minusScale.value }] }));
  const plusStyle    = useAnimatedStyle(() => ({ transform: [{ scale: plusScale.value }] }));

  const decrement = () => {
    if (value <= MIN) return;
    Haptics.selectionAsync();
    minusScale.value = withSequence(
      withSpring(0.8, { stiffness: 500, damping: 12 }),
      withSpring(1.0, { stiffness: 300, damping: 25 })
    );
    setCoffeeCups(value - 1);
  };

  const increment = () => {
    if (value >= MAX) return;
    Haptics.selectionAsync();
    plusScale.value = withSequence(
      withSpring(0.8, { stiffness: 500, damping: 12 }),
      withSpring(1.0, { stiffness: 300, damping: 25 })
    );
    setCoffeeCups(value + 1);
  };

  return (
    <OnboardingShell step={4}>
      <View style={styles.content}>

        {/* ── Illustration ── */}
        <Animated.View style={[styles.illustrationWrap, illustrationStyle]}>
          <View style={styles.illustrationCircle}>
            {/* Steam wisps above cup */}
            <View style={styles.steamContainer}>
              <SteamWisp delay={0}   offsetX={-10} />
              <SteamWisp delay={320} offsetX={0}   />
              <SteamWisp delay={160} offsetX={10}  />
            </View>
            <Ionicons name="cafe" size={52} color={colors.green700} />
          </View>
        </Animated.View>

        {/* ── Question ── */}
        <Animated.View style={[styles.questionBlock, questionStyle]}>
          <Text style={styles.question}>How many cups of{'\n'}coffee a day?</Text>
          <Text style={styles.hint}>Including tea and energy drinks</Text>
        </Animated.View>

        <View style={{ flex: 1 }} />

        {/* ── Counter + cup row ── */}
        <Animated.View style={[styles.counterSection, counterStyle]}>
          <View style={styles.counterBlock}>
            <Pressable
              onPress={decrement}
              hitSlop={12}
              style={({ pressed }) => [styles.stepBtn, styles.stepBtnMinus, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel="Decrease cups"
            >
              <Animated.View style={minusStyle}>
                <Ionicons name="remove" size={26} color={value <= MIN ? colors.green100 : colors.textSecondary} />
              </Animated.View>
            </Pressable>

            <View style={styles.numberWrap}>
              <NumberDisplay value={value} />
              <Text style={styles.unitText}>{value === 1 ? 'cup' : 'cups'}</Text>
            </View>

            <Pressable
              onPress={increment}
              hitSlop={12}
              style={({ pressed }) => [styles.stepBtn, styles.stepBtnPlus, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
              accessibilityLabel="Increase cups"
            >
              <Animated.View style={plusStyle}>
                <Ionicons name="add" size={26} color={value >= MAX ? colors.green300 : colors.white} />
              </Animated.View>
            </Pressable>
          </View>

          {/* Cup visualizer */}
          <CupRow count={value} />

          {/* Live lifetime insight */}
          <WowFact
            icon="cafe-outline"
            figure={lifetimeCups.toLocaleString('en-US')}
            label="cups so far in your life"
            punch={
              value === 0
                ? 'A rare caffeine-free life. Your sleep thanks you.'
                : `Roughly ${lifetimeLitres.toLocaleString('en-US')} litres of coffee through your hands.`
            }
          />
        </Animated.View>

        <View style={{ flex: 1 }} />

        {/* ── Continue ── */}
        <Animated.View style={btnStyle}>
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/onboarding/water'); }}
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
  steamContainer: {
    flexDirection:  'row',
    gap:            spacing[3],
    position:       'absolute',
    top:            20,
  },
  steamWisp: {
    width:        3,
    height:       14,
    borderRadius: 2,
    backgroundColor: colors.green300,
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

  counterSection: {
    alignItems: 'center',
    gap:        spacing[5],
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
  cupRow: {
    flexDirection: 'row',
    gap:           spacing[2],
    alignItems:    'center',
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
