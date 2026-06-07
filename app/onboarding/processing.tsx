import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  interpolateColor,
  Extrapolation,
  interpolate,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { differenceInDays } from 'date-fns';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useUserStore } from '@/store/userStore';
import { colors, spacing, radius, fontFamily } from '@/theme';
import { format } from 'date-fns';

// ─── Life stat computation ─────────────────────────────────────
const EXERCISE_FACTOR: Record<string, number> = {
  regular:   1.35,
  sometimes: 1.0,
  rarely:    0.65,
};

function computeStats(
  birthDate:   Date,
  sleepHours:  number,
  coffeeCups:  number,
  phoneHours:  number,
  exercise:    string
) {
  const now       = new Date();
  const days      = Math.max(1, differenceInDays(now, birthDate));
  const exFactor  = EXERCISE_FACTOR[exercise] ?? 1.0;

  return [
    {
      icon:  'calendar-outline',
      label: 'Days alive',
      value: days,
      suffix: 'days',
      color:  colors.green700,
    },
    {
      icon:  'heart-outline',
      label: 'Heartbeats',
      value: Math.floor(days * 100800),   // 70 bpm × 1440 min/day
      suffix: 'beats',
      color:  '#E05A5A',
    },
    {
      icon:  'moon-outline',
      label: 'Hours of sleep',
      value: Math.floor(days * sleepHours),
      suffix: 'hours',
      color:  '#6B7FD7',
    },
    {
      icon:  'walk-outline',
      label: 'Steps walked',
      value: Math.floor(days * 8000 * exFactor),
      suffix: 'steps',
      color:  colors.green500,
    },
    ...(coffeeCups > 0
      ? [{
          icon:  'cafe-outline',
          label: 'Coffee sips',
          value: Math.floor(days * coffeeCups * 8), // ~8 sips per cup
          suffix: 'sips',
          color:  '#9C6B3C',
        }]
      : []),
    {
      icon:  'phone-portrait-outline',
      label: 'Phone hours',
      value: Math.floor(days * phoneHours),
      suffix: 'hours',
      color:  colors.textSecondary,
    },
  ];
}

// ─── Format large numbers ──────────────────────────────────────
function formatNum(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000)     return (n / 1_000_000).toFixed(1) + 'M';
  return n.toLocaleString();
}

// ─── Count-up hook ─────────────────────────────────────────────
function useCountUp(target: number, duration: number, active: boolean): number {
  const [display, setDisplay] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (!active || started.current) return;
    started.current = true;

    const startTime = Date.now();
    const tick = setInterval(() => {
      const elapsed  = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3); // cubic ease-out
      setDisplay(Math.round(target * eased));
      if (progress >= 1) {
        clearInterval(tick);
        setDisplay(target);
      }
    }, 16);

    return () => clearInterval(tick);
  }, [active]);

  return display;
}

// ─── Stat row ─────────────────────────────────────────────────
function StatRow({
  icon,
  label,
  value,
  suffix,
  color,
  active,
  delay,
}: {
  icon:    string;
  label:   string;
  value:   number;
  suffix:  string;
  color:   string;
  active:  boolean;
  delay:   number;
}) {
  const opacity  = useSharedValue(0);
  const translateX = useSharedValue(-16);

  useEffect(() => {
    if (!active) return;
    opacity.value    = withDelay(60, withTiming(1, { duration: 300 }));
    translateX.value = withDelay(60, withSpring(0, { stiffness: 220, damping: 22 }));
  }, [active]);

  const rowStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ translateX: translateX.value }],
  }));

  const displayValue = useCountUp(value, 700, active);

  return (
    <Animated.View style={[styles.statRow, rowStyle]}>
      <View style={[styles.statIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statValueWrap}>
        <Text style={[styles.statValue, { color }]}>{formatNum(displayValue)}</Text>
        <Text style={styles.statSuffix}>{suffix}</Text>
      </View>
    </Animated.View>
  );
}

// ─── Pulsing ring ─────────────────────────────────────────────
function PulsingRing({ size, color, delay }: { size: number; color: string; delay: number }) {
  const scale   = useSharedValue(0.8);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(0.6, { duration: 400 }));
    scale.value   = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1.4, { duration: 2000 }),
          withTiming(0.9, { duration: 2000 })
        ),
        -1,
        true
      )
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.ring,
        style,
        {
          width:        size,
          height:       size,
          borderRadius: size / 2,
          borderColor:  color,
        },
      ]}
    />
  );
}

// ─── Progress bar ─────────────────────────────────────────────
function AnimatedProgress({ value }: { value: number }) {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(value, { duration: 600 });
  }, [value]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
  }));

  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, fillStyle]} />
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────
export default function ProcessingScreen() {
  const store = useOnboardingStore();
  const { setProfile, setOnboardingDone } = useUserStore();

  const birthDate  = store.dateOfBirth ?? new Date(1996, 0, 1);
  const STATS      = computeStats(
    birthDate,
    store.sleepHours,
    store.coffeeCups,
    store.phoneHours,
    store.exercise
  );

  const [activeCount, setActiveCount] = useState(0);
  const [complete,    setComplete]    = useState(false);
  const [progress,    setProgress]    = useState(0);

  // Orbit animation around the logo
  const logoScale   = useSharedValue(0.7);
  const logoOpacity = useSharedValue(0);
  const titleOp     = useSharedValue(0);
  const titleY      = useSharedValue(16);
  const doneOp      = useSharedValue(0);
  const doneScale   = useSharedValue(0.85);

  useEffect(() => {
    // Logo enters
    logoScale.value   = withSpring(1, { stiffness: 200, damping: 18 });
    logoOpacity.value = withTiming(1, { duration: 500 });

    // Title enters
    titleOp.value = withDelay(400, withTiming(1, { duration: 400 }));
    titleY.value  = withDelay(400, withSpring(0, { stiffness: 180, damping: 18 }));

    // Stagger stats
    const STAT_GAP = 860;
    const timers: ReturnType<typeof setTimeout>[] = [];

    STATS.forEach((_, i) => {
      timers.push(
        setTimeout(() => {
          setActiveCount(i + 1);
          setProgress(Math.round(((i + 1) / STATS.length) * 85));
        }, 900 + i * STAT_GAP)
      );
    });

    // Complete state
    const completeAt = 900 + STATS.length * STAT_GAP + 400;
    timers.push(
      setTimeout(() => {
        setProgress(100);
        setComplete(true);
        doneOp.value    = withTiming(1, { duration: 400 });
        doneScale.value = withSpring(1, { stiffness: 220, damping: 20 });
      }, completeAt)
    );

    // Auto-advance — commit profile first
    timers.push(
      setTimeout(() => {
        // Commit all onboarding data to userStore
        const today = format(new Date(), 'yyyy-MM-dd');
        setProfile({
          firstName:          store.firstName,
          dateOfBirth:        format(birthDate, 'yyyy-MM-dd'),
          sleepHoursPerNight: store.sleepHours,
          coffeeCupsPerDay:   store.coffeeCups,
          phoneHoursPerDay:   store.phoneHours,
          exerciseFrequency:  store.exercise,
          interestCategories: store.interests,
          notificationTime:   store.notificationTime,
          isPro:              false,
          appJoinDate:        today,
        });
        router.push('/onboarding/notifications');
      }, completeAt + 1400)
    );

    return () => timers.forEach(clearTimeout);
  }, []);

  const logoStyle  = useAnimatedStyle(() => ({
    opacity:   logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity:   titleOp.value,
    transform: [{ translateY: titleY.value }],
  }));
  const doneStyle  = useAnimatedStyle(() => ({
    opacity:   doneOp.value,
    transform: [{ scale: doneScale.value }],
  }));

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── Logo cluster ── */}
      <View style={styles.logoCluster}>
        <PulsingRing size={180} color={colors.green300} delay={0} />
        <PulsingRing size={130} color={colors.green500} delay={400} />
        <Animated.View style={[styles.logoCircle, logoStyle]}>
          <Text style={styles.logoG}>G</Text>
        </Animated.View>
      </View>

      {/* ── Title ── */}
      <Animated.View style={[styles.titleBlock, titleStyle]}>
        <Text style={styles.title}>
          {complete ? 'Your world is ready' : 'Calculating your world…'}
        </Text>
        <AnimatedProgress value={progress} />
        <Text style={styles.progressPct}>{progress}%</Text>
      </Animated.View>

      {/* ── Stat list ── */}
      <View style={styles.statList}>
        {STATS.map((stat, i) => (
          <StatRow
            key={stat.label}
            {...stat}
            active={i < activeCount}
            delay={i * 80}
          />
        ))}
      </View>

      {/* ── Done badge ── */}
      {complete ? (
        <Animated.View style={[styles.doneBadge, doneStyle]}>
          <Ionicons name="checkmark-circle" size={18} color={colors.green700} />
          <Text style={styles.doneText}>Opening Gati…</Text>
        </Animated.View>
      ) : null}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const LOGO_SIZE = 80;

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.background,
    alignItems:      'center',
    paddingTop:      spacing[8],
    paddingHorizontal: spacing[6],
  },

  // Logo
  logoCluster: {
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   spacing[6],
  },
  ring: {
    position:   'absolute',
    borderWidth: 1,
  },
  logoCircle: {
    width:           LOGO_SIZE,
    height:          LOGO_SIZE,
    borderRadius:    LOGO_SIZE / 2,
    backgroundColor: colors.green700,
    alignItems:      'center',
    justifyContent:  'center',
    elevation:       8,
    shadowColor:     colors.green900,
    shadowOffset:    { width: 0, height: 6 },
    shadowOpacity:   0.2,
    shadowRadius:    14,
  },
  logoG: {
    fontFamily: fontFamily.extraBold,
    fontSize:   38,
    color:      colors.white,
    lineHeight: 44,
  },

  // Title + progress
  titleBlock: {
    width:        '100%',
    alignItems:   'center',
    marginBottom: spacing[6],
    gap:          spacing[2],
  },
  title: {
    fontFamily:    fontFamily.bold,
    fontSize:      20,
    color:         colors.textPrimary,
    textAlign:     'center',
    letterSpacing: -0.3,
    marginBottom:  spacing[2],
  },
  progressTrack: {
    width:           '100%',
    height:          4,
    borderRadius:    radius.full,
    backgroundColor: colors.green100,
    overflow:        'hidden',
  },
  progressFill: {
    height:          4,
    borderRadius:    radius.full,
    backgroundColor: colors.green700,
  },
  progressPct: {
    fontFamily: fontFamily.semiBold,
    fontSize:   12,
    color:      colors.green700,
  },

  // Stat list
  statList: {
    width:        '100%',
    gap:          spacing[2],
  },
  statRow: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   colors.white,
    borderRadius:      radius.xl,
    borderWidth:       1,
    borderColor:       colors.border,
    paddingVertical:   spacing[3],
    paddingHorizontal: spacing[4],
    gap:               spacing[3],
  },
  statIcon: {
    width:          36,
    height:         36,
    borderRadius:   radius.md,
    alignItems:     'center',
    justifyContent: 'center',
  },
  statLabel: {
    flex:       1,
    fontFamily: fontFamily.medium,
    fontSize:   14,
    color:      colors.textSecondary,
  },
  statValueWrap: {
    alignItems: 'flex-end',
  },
  statValue: {
    fontFamily: fontFamily.bold,
    fontSize:   17,
    letterSpacing: -0.3,
  },
  statSuffix: {
    fontFamily: fontFamily.regular,
    fontSize:   11,
    color:      colors.textMuted,
  },

  // Done badge
  doneBadge: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing[2],
    marginTop:       spacing[5],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[5],
    backgroundColor: colors.green50,
    borderRadius:    radius.full,
    borderWidth:     1,
    borderColor:     colors.green100,
  },
  doneText: {
    fontFamily: fontFamily.semiBold,
    fontSize:   14,
    color:      colors.green700,
  },
});
