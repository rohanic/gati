/**
 * Numbers tab — Life in Numbers list screen.
 * Shows today's stat (prominent), unlocked collection, and upcoming locked stats.
 * Category filter chips narrow the list by stat type.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { CategoryFilter, StatListItem } from '@/components/numbers';
import type { CategoryKey } from '@/components/numbers';
import { useAllStats } from '@/hooks/useAllStats';
import { useUserStore } from '@/store/userStore';
import { colors, spacing, radius, fontFamily } from '@/theme';

// ─── Unlock progress bar ────────────────────────────────────
function UnlockProgressBar({ unlocked, total }: { unlocked: number; total: number }) {
  const pct   = total > 0 ? unlocked / total : 0;
  const width = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(300, withTiming(1, { duration: 360 }));
    width.value   = withDelay(400, withSpring(pct * 100, { stiffness: 120, damping: 20 }));
  }, [pct]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${width.value}%` as any,
  }));
  const wrapStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[styles.progressWrap, wrapStyle]}>
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, fillStyle]} />
      </View>
      <Text style={styles.progressLabel}>
        {unlocked} of {total} life stats unlocked
      </Text>
    </Animated.View>
  );
}

// ─── Section header ─────────────────────────────────────────
function SectionHeader({ title, icon, count }: { title: string; icon: string; count?: number }) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon as any} size={14} color={colors.textSecondary} />
      <Text style={styles.sectionTitle}>{title}</Text>
      {count !== undefined && (
        <View style={styles.sectionCount}>
          <Text style={styles.sectionCountText}>{count}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Empty state ────────────────────────────────────────────
function EmptyNumbers() {
  const opacity = useSharedValue(0);
  const transY  = useSharedValue(20);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 450 });
    transY.value  = withSpring(0, { stiffness: 180, damping: 18 });
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ translateY: transY.value }],
  }));

  return (
    <Animated.View style={[styles.empty, style]}>
      <View style={styles.emptyIcon}>
        <Ionicons name="stats-chart-outline" size={30} color={colors.green300} />
      </View>
      <Text style={styles.emptyTitle}>No stats yet</Text>
      <Text style={styles.emptyBody}>
        Complete your profile to start unlocking your personal life numbers.
      </Text>
    </Animated.View>
  );
}

// ─── Screen ─────────────────────────────────────────────────
export default function NumbersScreen() {
  const profile        = useUserStore((s) => s.profile);
  const { todayStat, unlockedStats, upcomingStats, allStats, totalUnlocked } = useAllStats();
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('all');

  // ── Header entrance ──
  const headerOp = useSharedValue(0);
  const headerY  = useSharedValue(-8);

  useEffect(() => {
    headerOp.value = withTiming(1,  { duration: 380 });
    headerY.value  = withSpring(0,  { stiffness: 200, damping: 20 });
  }, []);

  const headerStyle = useAnimatedStyle(() => ({
    opacity:   headerOp.value,
    transform: [{ translateY: headerY.value }],
  }));

  // ── Filtered unlocked + upcoming lists ──
  const filteredUnlocked = useMemo(() => {
    if (activeCategory === 'all') return unlockedStats;
    return unlockedStats.filter((s) => s.definition.category === activeCategory);
  }, [unlockedStats, activeCategory]);

  const filteredUpcoming = useMemo(() => {
    if (activeCategory === 'all') return upcomingStats;
    return upcomingStats.filter((s) => s.definition.category === activeCategory);
  }, [upcomingStats, activeCategory]);

  const showTodayStat = todayStat &&
    (activeCategory === 'all' || todayStat.definition.category === activeCategory);

  if (!profile) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Life in Numbers</Text>
          <Text style={styles.screenSub}>One new insight, every day</Text>
        </View>
        <EmptyNumbers />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Header ── */}
      <Animated.View style={[styles.header, headerStyle]}>
        <View>
          <Text style={styles.screenTitle}>Life in Numbers</Text>
          <Text style={styles.screenSub}>One new insight, every day</Text>
        </View>
        {/* Unlock count badge */}
        <View style={styles.countBadge}>
          <Ionicons name="trophy-outline" size={13} color={colors.gold} />
          <Text style={styles.countBadgeText}>
            {totalUnlocked}/{allStats.length}
          </Text>
        </View>
      </Animated.View>

      {/* ── Unlock progress bar ── */}
      <UnlockProgressBar unlocked={totalUnlocked} total={allStats.length} />

      {/* ── Category filter ── */}
      <CategoryFilter active={activeCategory} onChange={setActiveCategory} />

      {/* ── Scrollable list ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Today's stat ── */}
        {showTodayStat && (
          <View>
            <SectionHeader title="Today's stat" icon="sparkles-outline" />
            <StatListItem item={todayStat} index={0} />
          </View>
        )}

        {/* ── Unlocked collection ── */}
        {filteredUnlocked.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="Your collection"
              icon="layers-outline"
              count={filteredUnlocked.length}
            />
            {filteredUnlocked.map((item, i) => (
              <StatListItem
                key={item.definition.id}
                item={item}
                index={i + (showTodayStat ? 1 : 0)}
              />
            ))}
          </View>
        )}

        {/* ── Coming soon ── */}
        {filteredUpcoming.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Coming soon" icon="lock-closed-outline" />
            {filteredUpcoming.map((item, i) => (
              <StatListItem
                key={item.definition.id}
                item={item}
                index={(filteredUnlocked.length + (showTodayStat ? 1 : 0)) + i}
              />
            ))}
          </View>
        )}

        {/* ── Nothing in this category ── */}
        {!showTodayStat && filteredUnlocked.length === 0 && filteredUpcoming.length === 0 && (
          <View style={styles.noCategory}>
            <Ionicons name="telescope-outline" size={28} color={colors.green300} />
            <Text style={styles.noCategoryText}>
              No {activeCategory} stats unlocked yet
            </Text>
          </View>
        )}

        <View style={{ height: spacing[10] }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'flex-end',
    paddingHorizontal: spacing[5],
    paddingTop:        spacing[5],
    paddingBottom:     spacing[3],
  },
  screenTitle: {
    fontFamily:    fontFamily.bold,
    fontSize:      26,
    color:         colors.textPrimary,
    letterSpacing: -0.4,
    marginBottom:  3,
  },
  screenSub: {
    fontFamily: fontFamily.regular,
    fontSize:   13,
    color:      colors.textSecondary,
  },
  countBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing[1] + 1,
    paddingVertical:   spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius:      radius.full,
    backgroundColor:   colors.goldBg,
    borderWidth:       1,
    borderColor:       colors.goldBorder,
    marginBottom:      2,
  },
  countBadgeText: {
    fontFamily: fontFamily.bold,
    fontSize:   13,
    color:      colors.gold,
  },

  // Progress bar
  progressWrap: {
    paddingHorizontal: spacing[5],
    paddingBottom:     spacing[3],
    gap:               spacing[2],
  },
  progressTrack: {
    height:          6,
    borderRadius:    radius.full,
    backgroundColor: colors.green100,
    overflow:        'hidden',
  },
  progressFill: {
    height:          6,
    borderRadius:    radius.full,
    backgroundColor: colors.green700,
  },
  progressLabel: {
    fontFamily: fontFamily.medium,
    fontSize:   12,
    color:      colors.textMuted,
  },

  scroll:  { flex: 1 },
  content: {
    paddingHorizontal: spacing[5],
    paddingTop:        spacing[4],
  },

  section: {
    marginTop: spacing[5],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[2],
    marginBottom:  spacing[3],
  },
  sectionTitle: {
    flex:       1,
    fontFamily: fontFamily.bold,
    fontSize:   16,
    color:      colors.textPrimary,
  },
  sectionCount: {
    paddingVertical:   2,
    paddingHorizontal: spacing[2] + 2,
    borderRadius:      radius.full,
    backgroundColor:   colors.green50,
    borderWidth:       1,
    borderColor:       colors.green100,
  },
  sectionCountText: {
    fontFamily: fontFamily.bold,
    fontSize:   11,
    color:      colors.green700,
  },

  noCategory: {
    alignItems:  'center',
    paddingTop:  spacing[14],
    gap:         spacing[3],
  },
  noCategoryText: {
    fontFamily: fontFamily.regular,
    fontSize:   14,
    color:      colors.textMuted,
    textAlign:  'center',
  },

  empty: {
    alignItems:       'center',
    marginHorizontal: spacing[5],
    marginTop:        spacing[8],
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
    marginBottom: spacing[2],
  },
  emptyBody: {
    fontFamily: fontFamily.regular,
    fontSize:   14,
    color:      colors.textMuted,
    textAlign:  'center',
    lineHeight: 21,
  },
});
