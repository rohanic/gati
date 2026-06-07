import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { OnboardingShell } from '@/components/onboarding/OnboardingShell';
import { useOnboardingStore } from '@/store/onboardingStore';
import { ExerciseFrequency } from '@/types';
import { colors, spacing, radius, fontFamily } from '@/theme';

// ─── Sleep options ────────────────────────────────────────────
const SLEEP_OPTIONS = [5, 6, 7, 8, 9, 10];

// ─── Coffee options ───────────────────────────────────────────
const COFFEE_OPTIONS = [
  { label: '0', value: 0 },
  { label: '1', value: 1 },
  { label: '2', value: 2 },
  { label: '3', value: 3 },
  { label: '4+', value: 4 },
];

// ─── Exercise options ─────────────────────────────────────────
const EXERCISE_OPTIONS: { label: string; sub: string; value: ExerciseFrequency; icon: string }[] = [
  { label: 'Active',     sub: '4+ times a week',   value: 'regular',   icon: 'bicycle-outline' },
  { label: 'Moderate',   sub: '1–3 times a week',   value: 'sometimes', icon: 'walk-outline' },
  { label: 'Sedentary',  sub: 'Rarely exercise',    value: 'rarely',    icon: 'cafe-outline' },
];

// ─── Section header (Ionicon + label, no emoji) ───────────────
function SectionLabel({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.sectionLabelRow}>
      <Ionicons name={icon as any} size={15} color={colors.textSecondary} />
      <Text style={styles.sectionLabel}>{label}</Text>
    </View>
  );
}

// ─── Stepper chip row ─────────────────────────────────────────
function ChipRow<T>({
  options,
  selected,
  onSelect,
  renderLabel,
}: {
  options:     T[];
  selected:    T;
  onSelect:    (v: T) => void;
  renderLabel: (v: T) => string;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((opt, i) => {
        const active = opt === selected;
        return (
          <Pressable
            key={i}
            onPress={() => {
              Haptics.selectionAsync();
              onSelect(opt);
            }}
            style={({ pressed }) => [
              styles.chip,
              active && styles.chipActive,
              pressed && !active && styles.chipPressed,
            ]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {renderLabel(opt)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────
export default function LifestyleScreen() {
  const { sleepHours, coffeeCups, exercise, setLifestyle, phoneHours } = useOnboardingStore();

  const [sleep,  setSleep]  = useState(sleepHours);
  const [coffee, setCoffee] = useState(coffeeCups);
  const [phone,  setPhone]  = useState(phoneHours);
  const [ex,     setEx]     = useState<ExerciseFrequency>(exercise);

  // ── Enter animations ──
  const headOp = useSharedValue(0);
  const headY  = useSharedValue(20);
  const bodyOp = useSharedValue(0);
  const bodyY  = useSharedValue(24);
  const btnOp  = useSharedValue(0);

  useEffect(() => {
    headOp.value = withTiming(1, { duration: 350 });
    headY.value  = withSpring(0, { stiffness: 200, damping: 18 });
    bodyOp.value = withDelay(140, withTiming(1, { duration: 300 }));
    bodyY.value  = withDelay(140, withSpring(0, { stiffness: 180, damping: 18 }));
    btnOp.value  = withDelay(320, withTiming(1, { duration: 300 }));
  }, []);

  const headStyle = useAnimatedStyle(() => ({
    opacity:   headOp.value,
    transform: [{ translateY: headY.value }],
  }));
  const bodyStyle = useAnimatedStyle(() => ({
    opacity:   bodyOp.value,
    transform: [{ translateY: bodyY.value }],
  }));
  const btnStyle = useAnimatedStyle(() => ({ opacity: btnOp.value }));

  const handleNext = () => {
    setLifestyle(sleep, coffee, phone, ex);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/onboarding/interests');
  };

  return (
    <OnboardingShell step={3} scrollable>
      {/* Header */}
      <Animated.View style={[styles.header, headStyle]}>
        <Text style={styles.question}>A little about{'\n'}your daily life</Text>
        <Text style={styles.hint}>Helps us compute your personal numbers</Text>
      </Animated.View>

      {/* Body */}
      <Animated.View style={bodyStyle}>
        {/* Sleep */}
        <View style={styles.section}>
          <SectionLabel icon="moon-outline" label="Hours of sleep per night" />
          <ChipRow
            options={SLEEP_OPTIONS}
            selected={sleep}
            onSelect={setSleep}
            renderLabel={(v) => `${v}h`}
          />
        </View>

        {/* Coffee */}
        <View style={styles.section}>
          <SectionLabel icon="cafe-outline" label="Coffee cups per day" />
          <ChipRow
            options={COFFEE_OPTIONS.map((o) => o.value)}
            selected={coffee}
            onSelect={setCoffee}
            renderLabel={(v) => COFFEE_OPTIONS.find((o) => o.value === v)?.label ?? String(v)}
          />
        </View>

        {/* Phone */}
        <View style={styles.section}>
          <SectionLabel icon="phone-portrait-outline" label="Screen time per day" />
          <ChipRow
            options={[2, 3, 4, 5, 6, 8, 10]}
            selected={phone}
            onSelect={setPhone}
            renderLabel={(v) => `${v}h`}
          />
        </View>

        {/* Exercise */}
        <View style={styles.section}>
          <SectionLabel icon="bicycle-outline" label="How active are you?" />
          <View style={styles.exerciseRow}>
            {EXERCISE_OPTIONS.map((opt) => {
              const active = opt.value === ex;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setEx(opt.value);
                  }}
                  style={({ pressed }) => [
                    styles.exerciseCard,
                    active && styles.exerciseCardActive,
                    pressed && !active && { opacity: 0.8 },
                  ]}
                >
                  <Ionicons
                    name={opt.icon as any}
                    size={22}
                    color={active ? colors.green700 : colors.textMuted}
                    style={styles.exerciseIcon}
                  />
                  <Text style={[styles.exerciseLabel, active && styles.exerciseLabelActive]}>
                    {opt.label}
                  </Text>
                  <Text style={[styles.exerciseSub, active && styles.exerciseSubActive]}>
                    {opt.sub}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Continue */}
        <Animated.View style={btnStyle}>
          <Pressable
            onPress={handleNext}
            style={({ pressed }) => [styles.nextBtn, pressed && styles.nextBtnPressed]}
          >
            <Text style={styles.nextText}>Continue</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop:    spacing[8],
    marginBottom: spacing[7],
  },
  question: {
    fontFamily:    fontFamily.bold,
    fontSize:      30,
    color:         colors.textPrimary,
    lineHeight:    38,
    marginBottom:  spacing[3],
    letterSpacing: -0.5,
  },
  hint: {
    fontFamily: fontFamily.regular,
    fontSize:   14,
    color:      colors.textMuted,
  },

  section: {
    marginBottom: spacing[6],
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[2],
    marginBottom:  spacing[3],
  },
  sectionLabel: {
    fontFamily:    fontFamily.semiBold,
    fontSize:      14,
    color:         colors.textSecondary,
    letterSpacing: 0.1,
  },

  // Chips
  chipRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing[2],
  },
  chip: {
    paddingVertical:   spacing[2] + 2,
    paddingHorizontal: spacing[4],
    borderRadius:      radius.lg,
    borderWidth:       1.5,
    borderColor:       colors.border,
    backgroundColor:   colors.white,
  },
  chipActive: {
    borderColor:     colors.green700,
    backgroundColor: colors.green50,
  },
  chipPressed: { opacity: 0.7 },
  chipText: {
    fontFamily: fontFamily.semiBold,
    fontSize:   15,
    color:      colors.textSecondary,
  },
  chipTextActive: {
    color: colors.green700,
  },

  // Exercise
  exerciseRow: {
    flexDirection: 'row',
    gap:           spacing[2],
  },
  exerciseCard: {
    flex:            1,
    alignItems:      'center',
    paddingVertical: spacing[4],
    borderRadius:    radius.xl,
    borderWidth:     1.5,
    borderColor:     colors.border,
    backgroundColor: colors.white,
  },
  exerciseCardActive: {
    borderColor:     colors.green700,
    backgroundColor: colors.green50,
  },
  exerciseIcon: {
    marginBottom: spacing[2],
  },
  exerciseLabel: {
    fontFamily:   fontFamily.bold,
    fontSize:     13,
    color:        colors.textSecondary,
    marginBottom: 2,
  },
  exerciseLabelActive: {
    color: colors.green700,
  },
  exerciseSub: {
    fontFamily: fontFamily.regular,
    fontSize:   11,
    color:      colors.textMuted,
    textAlign:  'center',
  },
  exerciseSubActive: {
    color: colors.green500,
  },

  nextBtn: {
    backgroundColor: colors.green700,
    borderRadius:    radius.xl,
    paddingVertical: spacing[5],
    alignItems:      'center',
    marginTop:       spacing[2],
    marginBottom:    spacing[4],
  },
  nextBtnPressed: {
    opacity:   0.88,
    transform: [{ scale: 0.98 }],
  },
  nextText: {
    fontFamily:    fontFamily.bold,
    fontSize:      17,
    color:         colors.white,
    letterSpacing: 0.2,
  },
});
