import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { differenceInDays } from 'date-fns';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useUserStore, useStatsStore } from '@/store/userStore';
import { computeLifeStats } from '@/engine/statsEngine';
import { checkMilestones } from '@/engine/milestoneEngine';
import { colors, spacing, radius, fontFamily } from '@/theme';
import { format } from 'date-fns';

// ─── Constants ────────────────────────────────────────────────
const LOGO_SIZE = 64;

// ─── Life stat computation ────────────────────────────────────
const EXERCISE_FACTOR: Record<string, number> = {
  regular:   1.35,
  sometimes: 1.0,
  rarely:    0.65,
};

function computeStats(
  birthDate:    Date,
  sleepHours:   number,
  coffeeCups:   number,
  phoneHours:   number,
  exercise:     string,
  waterGlasses: number,
  musicHours:   number
) {
  const now       = new Date();
  const days      = Math.max(1, differenceInDays(now, birthDate));
  const exFactor  = EXERCISE_FACTOR[exercise] ?? 1.0;
  const musicDays = Math.max(0, days - 10 * 365.25);

  return [
    { icon: 'calendar-outline',       label: 'Days alive',       value: days,                                suffix: 'days',   color: colors.green700  },
    { icon: 'heart-outline',           label: 'Heartbeats',       value: Math.floor(days * 100800),           suffix: 'beats',  color: '#E05A5A'        },
    { icon: 'moon-outline',            label: 'Hours of sleep',   value: Math.floor(days * sleepHours),       suffix: 'hours',  color: '#6B7FD7'        },
    { icon: 'walk-outline',            label: 'Steps walked',     value: Math.floor(days * 8000 * exFactor),  suffix: 'steps',  color: colors.green500  },
    ...(coffeeCups > 0
      ? [{ icon: 'cafe-outline',       label: 'Coffee sips',      value: Math.floor(days * coffeeCups * 8),   suffix: 'sips',   color: '#9C6B3C' }]
      : []),
    { icon: 'water-outline',           label: 'Glasses of water', value: Math.floor(days * waterGlasses),     suffix: 'glasses', color: '#4A90C2'      },
    ...(musicHours > 0
      ? [{ icon: 'musical-notes-outline', label: 'Songs heard',   value: Math.floor(musicDays * musicHours * 17), suffix: 'songs', color: '#8B5FCB' }]
      : []),
    { icon: 'phone-portrait-outline',  label: 'Phone hours',      value: Math.floor(days * phoneHours),       suffix: 'hours',  color: colors.textSecondary },
  ];
}

// ─── Format large numbers ─────────────────────────────────────
function formatNum(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000)     return (n / 1_000_000).toFixed(1) + 'M';
  return n.toLocaleString();
}

// ─── Count-up hook ────────────────────────────────────────────
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
      const eased    = 1 - Math.pow(1 - progress, 3);
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
  icon, label, value, suffix, color, active,
}: {
  icon:   string;
  label:  string;
  value:  number;
  suffix: string;
  color:  string;
  active: boolean;
  delay:  number;
}) {
  const opacity    = useSharedValue(0);
  const translateY = useSharedValue(10);

  useEffect(() => {
    if (!active) return;
    opacity.value    = withTiming(1, { duration: 280 });
    translateY.value = withSpring(0, { stiffness: 260, damping: 24 });
  }, [active]);

  const rowStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const displayValue = useCountUp(value, 650, active);

  return (
    <Animated.View style={[styles.statRow, rowStyle]}>
      <View style={[styles.statIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as any} size={17} color={color} />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statValueWrap}>
        <Text style={[styles.statValue, { color }]}>{formatNum(displayValue)}</Text>
        <Text style={styles.statSuffix}>{suffix}</Text>
      </View>
    </Animated.View>
  );
}

// ─── Progress bar ─────────────────────────────────────────────
function AnimatedProgress({ value }: { value: number }) {
  const width = useSharedValue(0);
  useEffect(() => { width.value = withTiming(value, { duration: 600 }); }, [value]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${width.value}%` as any }));
  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, fillStyle]} />
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────
export default function ProcessingScreen() {
  const store = useOnboardingStore();
  const { setProfile } = useUserStore();
  const seedMilestonesSeen = useStatsStore((s) => s.seedMilestonesSeen);

  const birthDate = store.dateOfBirth ?? new Date(1996, 0, 1);
  const STATS     = computeStats(
    birthDate,
    store.sleepHours,
    store.coffeeCups,
    store.phoneHours,
    store.exercise,
    store.waterGlasses,
    store.musicHours
  );

  const [activeCount, setActiveCount] = useState(0);
  const [complete,    setComplete]    = useState(false);
  const [progress,    setProgress]    = useState(0);
  const [centerIcon,  setCenterIcon]  = useState<string>('compass-outline');

  const scrollRef = useRef<ScrollView>(null);

  // Animations
  const logoScale   = useSharedValue(0.7);
  const logoOpacity = useSharedValue(0);
  const titleOp     = useSharedValue(0);
  const titleY      = useSharedValue(12);
  const doneOp      = useSharedValue(0);
  const doneScale   = useSharedValue(0.85);
  const iconOp      = useSharedValue(1);

  function swapIcon(nextIcon: string) {
    iconOp.value = withTiming(0, { duration: 100 }, (done) => {
      if (done) {
        runOnJS(setCenterIcon)(nextIcon);
        iconOp.value = withTiming(1, { duration: 220 });
      }
    });
  }

  useEffect(() => {
    // Safety guard: never fabricate a profile from a missing birthday. If the
    // DOB step was somehow skipped, send the user back to it instead of
    // computing every stat against the placeholder 1996 date. Returning here
    // also skips scheduling the timers below (nothing to clean up).
    if (!store.dateOfBirth) {
      router.replace('/onboarding/birthday');
      return;
    }

    logoScale.value   = withSpring(1, { stiffness: 200, damping: 18 });
    logoOpacity.value = withTiming(1, { duration: 500 });
    titleOp.value     = withDelay(400, withTiming(1, { duration: 400 }));
    titleY.value      = withDelay(400, withSpring(0, { stiffness: 180, damping: 18 }));

    const STAT_GAP = 620;
    const timers: ReturnType<typeof setTimeout>[] = [];

    STATS.forEach((stat, i) => {
      timers.push(
        setTimeout(() => {
          setActiveCount(i + 1);
          setProgress(Math.round(((i + 1) / STATS.length) * 85));
          swapIcon(stat.icon);
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
        }, 900 + i * STAT_GAP)
      );
    });

    const completeAt = 900 + STATS.length * STAT_GAP + 400;
    timers.push(
      setTimeout(() => {
        setProgress(100);
        setComplete(true);
        doneOp.value    = withTiming(1, { duration: 400 });
        doneScale.value = withSpring(1, { stiffness: 220, damping: 20 });
        swapIcon('checkmark');
      }, completeAt)
    );

    timers.push(
      setTimeout(() => {
        const today   = format(new Date(), 'yyyy-MM-dd');
        const profile = {
          firstName:            store.firstName,
          dateOfBirth:          format(birthDate, 'yyyy-MM-dd'),
          sleepHoursPerNight:   store.sleepHours,
          coffeeCupsPerDay:     store.coffeeCups,
          phoneHoursPerDay:     store.phoneHours,
          exerciseFrequency:    store.exercise,
          mealsPerDay:          store.mealsPerDay,
          talkLevel:            store.talkLevel,
          waterGlassesPerDay:   store.waterGlasses,
          musicHoursPerDay:     store.musicHours,
          commuteMinutesPerDay: store.commuteMinutes,
          interestCategories:   store.interests,
          notificationTime:     store.notificationTime,
          isPro:                false,
          appJoinDate:          today,
        };
        setProfile(profile);

        const preMet = checkMilestones({
          profile,
          lifeStats:     computeLifeStats(profile),
          streak:        0,
          appDayIndex:   0,
          totalUnlocked: 0,
        }).map((m) => m.id);
        seedMilestonesSeen(preMet);

        router.push('/onboarding/notifications');
      }, completeAt + 1400)
    );

    return () => timers.forEach(clearTimeout);
  }, []);

  const logoStyle     = useAnimatedStyle(() => ({
    opacity:   logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const titleStyle    = useAnimatedStyle(() => ({
    opacity:   titleOp.value,
    transform: [{ translateY: titleY.value }],
  }));
  const doneStyle     = useAnimatedStyle(() => ({
    opacity:   doneOp.value,
    transform: [{ scale: doneScale.value }],
  }));
  const iconAnimStyle = useAnimatedStyle(() => ({ opacity: iconOp.value }));

  return (
    <SafeAreaView style={styles.safe}>
      {/*
       * Single ScrollView containing everything — no fixed/scroll split.
       * This eliminates the clipping of the first stat row that happened
       * when the topSection was a fixed view and took too much height.
       * scrollToEnd() still keeps the latest stat in view as they appear.
       */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >

        {/* ── Logo circle (no orbit dots) ── */}
        <Animated.View style={[styles.logoCircle, logoStyle]}>
          <Animated.View style={iconAnimStyle}>
            <Ionicons name={centerIcon as any} size={30} color={colors.white} />
          </Animated.View>
        </Animated.View>

        {/* ── Title + progress ── */}
        <Animated.View style={[styles.titleBlock, titleStyle]}>
          <Text style={styles.title}>
            {complete ? 'Your world is ready' : 'Calculating your world...'}
          </Text>
          <AnimatedProgress value={progress} />
          <Text style={styles.progressPct}>{progress}%</Text>
        </Animated.View>

        {/* ── Stat rows ── */}
        <View style={styles.statList}>
          {STATS.map((stat, i) => (
            <StatRow
              key={stat.label}
              {...stat}
              active={i < activeCount}
              delay={i * 80}
            />
          ))}

          {/* Done badge — appears after all stats */}
          {complete && (
            <Animated.View style={[styles.doneBadge, doneStyle]}>
              <Ionicons name="checkmark-circle" size={17} color={colors.green700} />
              <Text style={styles.doneText}>Opening Gati...</Text>
            </Animated.View>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    alignItems:        'center',
    paddingHorizontal: spacing[5],
    paddingTop:        spacing[6],
    paddingBottom:     spacing[8],
  },

  // ── Logo — clean circle, no orbit ──────────────────────────
  logoCircle: {
    width:           LOGO_SIZE,
    height:          LOGO_SIZE,
    borderRadius:    LOGO_SIZE / 2,
    backgroundColor: colors.green700,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    spacing[5],
    elevation:       8,
    shadowColor:     colors.green900,
    shadowOffset:    { width: 0, height: 5 },
    shadowOpacity:   0.22,
    shadowRadius:    12,
  },

  // ── Title + progress ────────────────────────────────────────
  titleBlock: {
    width:        '100%',
    alignItems:   'center',
    gap:          spacing[2],
    marginBottom: spacing[4],
  },
  title: {
    fontFamily:    fontFamily.bold,
    fontSize:      20,
    color:         colors.textPrimary,
    textAlign:     'center',
    letterSpacing: -0.4,
    marginBottom:  spacing[1],
  },
  progressTrack: {
    width:           '100%',
    height:          3,
    borderRadius:    radius.full,
    backgroundColor: colors.green100,
    overflow:        'hidden',
  },
  progressFill: {
    height:          3,
    borderRadius:    radius.full,
    backgroundColor: colors.green700,
  },
  progressPct: {
    fontFamily: fontFamily.semiBold,
    fontSize:   11,
    color:      colors.green700,
  },

  // ── Stat list ───────────────────────────────────────────────
  statList: {
    width: '100%',
    gap:   spacing[2],
  },

  statRow: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   colors.white,
    borderRadius:      radius.xl,
    borderWidth:       1,
    borderColor:       colors.border,
    paddingVertical:   spacing[2] + 2,
    paddingHorizontal: spacing[4],
    gap:               spacing[3],
  },
  statIcon: {
    width:          34,
    height:         34,
    borderRadius:   radius.md,
    alignItems:     'center',
    justifyContent: 'center',
  },
  statLabel: {
    flex:       1,
    fontFamily: fontFamily.medium,
    fontSize:   12.5,
    color:      colors.textSecondary,
  },
  statValueWrap: {
    alignItems: 'flex-end',
  },
  statValue: {
    fontFamily:    fontFamily.bold,
    fontSize:      15,
    letterSpacing: -0.3,
  },
  statSuffix: {
    fontFamily: fontFamily.regular,
    fontSize:   10,
    color:      colors.textMuted,
  },

  // ── Done badge ──────────────────────────────────────────────
  doneBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               spacing[2],
    marginTop:         spacing[3],
    paddingVertical:   spacing[3],
    paddingHorizontal: spacing[5],
    backgroundColor:   colors.green50,
    borderRadius:      radius.full,
    borderWidth:       1,
    borderColor:       colors.green100,
    alignSelf:         'center',
  },
  doneText: {
    fontFamily: fontFamily.semiBold,
    fontSize:   13,
    color:      colors.green700,
  },
});
