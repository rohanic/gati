import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { StatCard, StatShareCard, TimelineRow } from '@/components/today';
import { MilestoneModal } from '@/components/milestone';
import { useTodayStat, usePreviousStats } from '@/hooks/useTodayStat';
import { useStreak } from '@/hooks/useStreak';
import { usePendingMilestone } from '@/hooks/useMilestone';
import { useUserStore, useStatsStore } from '@/store/userStore';
import { colors, spacing, radius, fontFamily } from '@/theme';

// ─── Greeting ──────────────────────────────────────────────────
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ─── Animated flame icon for streak ───────────────────────────
function FlameIcon({ active }: { active: boolean }) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!active) return;
    scale.value = withRepeat(
      withSequence(
        withTiming(1.22, { duration: 700, easing: Easing.bezier(0.37, 0, 0.63, 1) }),
        withTiming(0.92, { duration: 500, easing: Easing.bezier(0.37, 0, 0.63, 1) }),
        withTiming(1.10, { duration: 400, easing: Easing.bezier(0.37, 0, 0.63, 1) }),
        withTiming(1.00, { duration: 600, easing: Easing.bezier(0.37, 0, 0.63, 1) })
      ),
      -1,
      false
    );
  }, [active]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={style}>
      <Ionicons
        name={active ? 'flame' : 'flame-outline'}
        size={15}
        color={active ? colors.gold : colors.textMuted}
      />
    </Animated.View>
  );
}

// ─── Streak badge ──────────────────────────────────────────────
function StreakBadge({ count }: { count: number }) {
  const opacity = useSharedValue(0);
  const scale   = useSharedValue(0.8);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 380 });
    scale.value   = withSpring(1, { stiffness: 300, damping: 25 });
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const isActive = count > 0;

  return (
    <Animated.View style={[styles.streakBadge, isActive && styles.streakBadgeActive, style]}>
      <FlameIcon active={isActive} />
      <Text style={[styles.streakCount, isActive && styles.streakCountActive]}>
        {count}
      </Text>
      <Text style={[styles.streakLabel, isActive && styles.streakLabelActive]}>
        {count === 1 ? 'day' : 'day streak'}
      </Text>
    </Animated.View>
  );
}

// ─── Empty state (day 0 / no profile) ─────────────────────────
function EmptyToday() {
  const opacity = useSharedValue(0);
  const transY  = useSharedValue(16);

  useEffect(() => {
    opacity.value = withTiming(1,  { duration: 450 });
    transY.value  = withSpring(0, { stiffness: 180, damping: 18 });
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ translateY: transY.value }],
  }));

  return (
    <Animated.View style={[styles.empty, style]}>
      <View style={styles.emptyIcon}>
        <Ionicons name="hourglass-outline" size={32} color={colors.green300} />
      </View>
      <Text style={styles.emptyTitle}>Your first stat is on its way</Text>
      <Text style={styles.emptyBody}>
        Complete your profile setup and come back tomorrow for your first life number.
      </Text>
    </Animated.View>
  );
}

// ─── Section header ────────────────────────────────────────────
function SectionHeader({ title, icon }: { title: string; icon: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon as any} size={16} color={colors.textSecondary} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────
export default function TodayScreen() {
  const profile          = useUserStore((s) => s.profile);
  const markMilestoneSeen = useStatsStore((s) => s.markMilestoneSeen);
  const todayStat        = useTodayStat();
  const previousStats    = usePreviousStats();
  const streak           = useStreak();
  const pendingMilestone = usePendingMilestone();
  const shareCardRef     = useRef<View>(null);

  // Show milestone modal a beat after screen mounts (lets Today screen render first)
  const [shownMilestone, setShownMilestone] = useState(pendingMilestone);
  useEffect(() => {
    if (pendingMilestone) {
      const t = setTimeout(() => setShownMilestone(pendingMilestone), 1200);
      return () => clearTimeout(t);
    }
  }, [pendingMilestone?.id]);

  const handleMilestoneDismiss = useCallback(() => {
    if (shownMilestone) {
      markMilestoneSeen(shownMilestone.id);
      setShownMilestone(null);
    }
  }, [shownMilestone, markMilestoneSeen]);

  const dateStr  = format(new Date(), 'EEEE, MMMM d');
  const greeting = getGreeting();
  const name     = profile?.firstName ?? '';
  const dayNumber = todayStat?.stats?.daysAlive ?? undefined;

  // ── Header entrance ──
  const headerOp = useSharedValue(0);
  const headerY  = useSharedValue(-12);

  useEffect(() => {
    headerOp.value = withTiming(1, { duration: 400 });
    headerY.value  = withSpring(0, { stiffness: 200, damping: 20 });
  }, []);

  const headerStyle = useAnimatedStyle(() => ({
    opacity:   headerOp.value,
    transform: [{ translateY: headerY.value }],
  }));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <Animated.View style={[styles.header, headerStyle]}>
          <View>
            <Text style={styles.greeting}>
              {greeting}{name ? `, ${name}` : ''}
            </Text>
            <Text style={styles.date}>{dateStr}</Text>
          </View>
          <StreakBadge count={streak} />
        </Animated.View>

        {/* ── Today's stat label ── */}
        <View style={styles.sectionLabelRow}>
          <Ionicons name="sparkles-outline" size={14} color={colors.textMuted} />
          <Text style={styles.sectionSuperLabel}>Your stat for today</Text>
        </View>

        {/* ── Stat card / empty state ── */}
        {todayStat ? (
          <StatCard
            definition={todayStat.definition}
            value={todayStat.value}
            stats={todayStat.stats}
            profile={profile!}
            isNewUnlock={todayStat.isNewUnlock}
            shareCardRef={shareCardRef}
          />
        ) : (
          <EmptyToday />
        )}

        {/* ── Timeline section ── */}
        {previousStats.length > 0 && (
          <View style={styles.timelineSection}>
            <SectionHeader title="Your story so far" icon="time-outline" />
            {previousStats.map((item, i) => (
              <TimelineRow
                key={`${item.definition.id}-${item.date}`}
                definition={item.definition}
                value={item.value}
                date={item.date}
                index={i}
                isLast={i === previousStats.length - 1}
              />
            ))}
          </View>
        )}

        {/* ── First-day nudge (no previous stats yet) ── */}
        {previousStats.length === 0 && todayStat && (
          <View style={styles.nudge}>
            <View style={styles.nudgeIcon}>
              <Ionicons name="calendar-outline" size={18} color={colors.green500} />
            </View>
            <View style={styles.nudgeText}>
              <Text style={styles.nudgeTitle}>A new stat every day</Text>
              <Text style={styles.nudgeBody}>
                Come back tomorrow for another number from your life.
              </Text>
            </View>
          </View>
        )}

        <View style={{ height: spacing[8] }} />
      </ScrollView>

      {/* ── Hidden share card (captured by view-shot) ── */}
      {todayStat && (
        <StatShareCard
          ref={shareCardRef}
          definition={todayStat.definition}
          value={todayStat.value}
          dayNumber={dayNumber}
        />
      )}

      {/* ── Milestone modal ── */}
      <MilestoneModal
        milestone={shownMilestone}
        onDismiss={handleMilestoneDismiss}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.background,
  },
  scroll:  { flex: 1 },
  content: { paddingTop: spacing[5] },

  // Header
  header: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'flex-start',
    paddingHorizontal: spacing[5],
    marginBottom:      spacing[4],
  },
  greeting: {
    fontFamily:    fontFamily.bold,
    fontSize:      22,
    color:         colors.textPrimary,
    marginBottom:  3,
    letterSpacing: -0.3,
  },
  date: {
    fontFamily: fontFamily.regular,
    fontSize:   13,
    color:      colors.textSecondary,
  },

  // Streak badge
  streakBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing[1] + 1,
    paddingVertical:   spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius:      radius.full,
    backgroundColor:   colors.surface2,
    borderWidth:       1,
    borderColor:       colors.border,
  },
  streakBadgeActive: {
    backgroundColor: colors.goldBg,
    borderColor:     colors.goldBorder,
  },
  streakCount: {
    fontFamily: fontFamily.bold,
    fontSize:   14,
    color:      colors.textMuted,
  },
  streakCountActive: {
    color: colors.gold,
  },
  streakLabel: {
    fontFamily: fontFamily.regular,
    fontSize:   12,
    color:      colors.textMuted,
  },
  streakLabelActive: {
    color: colors.gold,
  },

  // Stat label above card
  sectionLabelRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing[2],
    paddingHorizontal: spacing[5],
    marginBottom:      spacing[3],
  },
  sectionSuperLabel: {
    fontFamily:    fontFamily.medium,
    fontSize:      12,
    color:         colors.textMuted,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },

  // Empty state
  empty: {
    alignItems:       'center',
    marginHorizontal: spacing[5],
    padding:          spacing[8],
    backgroundColor:  colors.white,
    borderRadius:     radius.xl,
    borderWidth:      1,
    borderColor:      colors.border,
  },
  emptyIcon: {
    width:           72,
    height:          72,
    borderRadius:    radius.full,
    backgroundColor: colors.green50,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    spacing[4],
  },
  emptyTitle: {
    fontFamily:   fontFamily.bold,
    fontSize:     18,
    color:        colors.textPrimary,
    textAlign:    'center',
    marginBottom: spacing[2],
  },
  emptyBody: {
    fontFamily: fontFamily.regular,
    fontSize:   14,
    color:      colors.textMuted,
    textAlign:  'center',
    lineHeight: 21,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[2],
    marginBottom:  spacing[4],
  },
  sectionTitle: {
    fontFamily:    fontFamily.bold,
    fontSize:      18,
    color:         colors.textPrimary,
    letterSpacing: -0.2,
  },

  // Timeline section
  timelineSection: {
    marginTop:         spacing[7],
    paddingHorizontal: spacing[5],
  },

  // Nudge card
  nudge: {
    flexDirection:    'row',
    alignItems:       'center',
    marginHorizontal: spacing[5],
    marginTop:        spacing[7],
    gap:              spacing[3],
    backgroundColor:  colors.green50,
    borderRadius:     radius.xl,
    borderWidth:      1,
    borderColor:      colors.green100,
    padding:          spacing[4],
  },
  nudgeIcon: {
    width:           44,
    height:          44,
    borderRadius:    radius.md,
    backgroundColor: colors.white,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     colors.green100,
  },
  nudgeText: { flex: 1 },
  nudgeTitle: {
    fontFamily:   fontFamily.semiBold,
    fontSize:     14,
    color:        colors.green700,
    marginBottom: 2,
  },
  nudgeBody: {
    fontFamily: fontFamily.regular,
    fontSize:   13,
    color:      colors.textSecondary,
    lineHeight: 18,
  },
});
