/**
 * Story tab — Your personal timeline.
 * Month-grouped events: stat unlocks (green), places discovered (sage),
 * milestones (gold). Year selector. Stats summary bar.
 *
 * Animation:
 *  - Timeline items slide in from left, staggered 60ms
 *  - Tap item: scale-down → navigate
 *  - Year pills: spring-scale on select
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  format,
  parseISO,
  differenceInDays,
  differenceInCalendarYears,
} from 'date-fns';
import * as Haptics from 'expo-haptics';
import { useUserStore, useStatsStore, useWanderStore } from '@/store/userStore';
import { STAT_DEFINITIONS } from '@/data/statDefinitions';
import { colors, spacing, radius, fontFamily, shadow } from '@/theme';

// ─── Timeline event types ─────────────────────────────────────
type EventType = 'stat' | 'place' | 'milestone';

interface TimelineEvent {
  id:       string;
  type:     EventType;
  date:     string;   // ISO yyyy-MM-dd
  title:    string;
  subtitle: string;
  refId?:   string;   // statId or placeId for navigation
}

// ─── Color per event type ─────────────────────────────────────
const EVENT_DOT: Record<EventType, { dot: string; bg: string; icon: string }> = {
  stat:      { dot: colors.green700,    bg: colors.green50,  icon: 'stats-chart-outline' },
  place:     { dot: '#6B9B7A',          bg: '#EBF4EE',       icon: 'location-outline'    },
  milestone: { dot: colors.gold,        bg: colors.goldBg,   icon: 'trophy-outline'      },
};

// ─── Streak from open history ─────────────────────────────────
function computeBestStreak(openHistory: string[]): number {
  if (openHistory.length === 0) return 0;
  const sorted = [...openHistory].sort();
  let best = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = parseISO(sorted[i - 1]);
    const curr = parseISO(sorted[i]);
    const diff = differenceInDays(curr, prev);
    if (diff === 1)      { current++; best = Math.max(best, current); }
    else if (diff > 1)   { current = 1; }
    // diff === 0 (duplicate date): skip
  }
  return best;
}

// ─── Animated timeline entry ──────────────────────────────────
function TimelineEntry({
  event,
  index,
  isLast,
}: {
  event:  TimelineEvent;
  index:  number;
  isLast: boolean;
}) {
  const meta  = EVENT_DOT[event.type];
  const tx    = useSharedValue(-40);
  const op    = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    const delay = Math.min(index, 10) * 60;
    tx.value = withDelay(delay, withSpring(0,  { stiffness: 220, damping: 22 }));
    op.value = withDelay(delay, withTiming(1,  { duration: 280 }));
  }, [index]);

  const enterStyle = useAnimatedStyle(() => ({
    opacity:   op.value,
    transform: [{ translateX: tx.value }],
  }));
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn  = () => {
    if (!event.refId) return;
    scale.value = withSpring(0.97, { stiffness: 500, damping: 22 });
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, { stiffness: 300, damping: 25 });
  };
  const handlePress    = () => {
    if (!event.refId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSpring(0.97, { stiffness: 500, damping: 22 });
    setTimeout(() => {
      scale.value = withSpring(1, { stiffness: 300, damping: 25 });
      if (event.type === 'stat') {
        router.push({
          pathname: '/(tabs)/numbers/[statId]',
          params:   { statId: event.refId! },
        });
      } else if (event.type === 'place') {
        router.push({
          pathname: '/(tabs)/wander/[placeId]',
          params:   { placeId: event.refId! },
        });
      }
    }, 140);
  };

  return (
    <Animated.View style={[styles.entryRow, enterStyle]}>
      {/* Left rail + dot */}
      <View style={styles.railCol}>
        <View style={[styles.dot, { backgroundColor: meta.dot }]} />
        {!isLast && <View style={styles.rail} />}
      </View>

      {/* Card */}
      <Animated.View style={[styles.entryCardWrap, pressStyle]}>
        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={handlePress}
          android_ripple={event.refId ? { color: colors.green50 } : null}
          style={styles.entryCard}
        >
          {/* Icon pill */}
          <View style={[styles.entryIconPill, { backgroundColor: meta.bg }]}>
            <Ionicons name={meta.icon as any} size={16} color={meta.dot} />
          </View>

          {/* Text */}
          <View style={styles.entryText}>
            <Text style={styles.entryTitle} numberOfLines={1}>{event.title}</Text>
            <Text style={styles.entrySubtitle} numberOfLines={1}>{event.subtitle}</Text>
          </View>

          {/* Date */}
          <Text style={styles.entryDate}>
            {format(parseISO(event.date), 'd MMM')}
          </Text>

          {/* Chevron (if navigable) */}
          {event.refId && (
            <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
          )}
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Month section ────────────────────────────────────────────
function MonthSection({
  monthLabel,
  events,
  baseIndex,
}: {
  monthLabel: string;
  events:     TimelineEvent[];
  baseIndex:  number;
}) {
  const op = useSharedValue(0);
  useEffect(() => {
    op.value = withDelay(baseIndex * 60, withTiming(1, { duration: 360 }));
  }, [baseIndex]);
  const headerStyle = useAnimatedStyle(() => ({ opacity: op.value }));

  return (
    <View style={styles.monthSection}>
      <Animated.Text style={[styles.monthLabel, headerStyle]}>
        {monthLabel}
      </Animated.Text>
      {events.map((ev, i) => (
        <TimelineEntry
          key={ev.id}
          event={ev}
          index={baseIndex + i}
          isLast={i === events.length - 1}
        />
      ))}
    </View>
  );
}

// ─── Year pill ────────────────────────────────────────────────
function YearPill({
  year,
  active,
  onPress,
}: {
  year:    number;
  active:  boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const fill  = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    fill.value  = withSpring(active ? 1 : 0, { stiffness: 260, damping: 20 });
    scale.value = withSpring(active ? 1.04 : 1, { stiffness: 300, damping: 25 });
  }, [active]);

  const pillStyle = useAnimatedStyle(() => ({
    backgroundColor: fill.value === 1 ? colors.green700 : colors.white,
    transform:       [{ scale: scale.value }],
  }));

  return (
    <Pressable onPress={onPress} android_ripple={{ color: colors.green50, borderless: true }}>
      <Animated.View style={[styles.yearPill, pillStyle]}>
        <Text style={[styles.yearPillText, active && styles.yearPillTextActive]}>
          {year}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

// ─── Stats summary bar ────────────────────────────────────────
function StatsSummaryBar({
  daysAlive,
  statsUnlocked,
  placesDiscovered,
  bestStreak,
}: {
  daysAlive:        number;
  statsUnlocked:    number;
  placesDiscovered: number;
  bestStreak:       number;
}) {
  const op = useSharedValue(0);
  const ty = useSharedValue(12);
  useEffect(() => {
    op.value = withDelay(200, withTiming(1, { duration: 400 }));
    ty.value = withDelay(200, withSpring(0, { stiffness: 200, damping: 20 }));
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity:   op.value,
    transform: [{ translateY: ty.value }],
  }));

  const items = [
    { value: daysAlive.toLocaleString(), label: 'days lived'  },
    { value: String(statsUnlocked),      label: 'stats'       },
    { value: String(placesDiscovered),   label: 'places'      },
    { value: String(bestStreak),         label: 'best streak' },
  ];

  return (
    <Animated.View style={[styles.summaryBar, style]}>
      {items.map((item, i) => (
        <React.Fragment key={item.label}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{item.value}</Text>
            <Text style={styles.summaryLabel}>{item.label}</Text>
          </View>
          {i < items.length - 1 && <View style={styles.summaryDivider} />}
        </React.Fragment>
      ))}
    </Animated.View>
  );
}

// ─── Empty state ──────────────────────────────────────────────
function EmptyStory() {
  const op = useSharedValue(0);
  const ty = useSharedValue(20);
  useEffect(() => {
    op.value = withTiming(1, { duration: 450 });
    ty.value = withSpring(0, { stiffness: 180, damping: 18 });
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity:   op.value,
    transform: [{ translateY: ty.value }],
  }));
  return (
    <Animated.View style={[styles.empty, style]}>
      <View style={styles.emptyIcon}>
        <Ionicons name="time-outline" size={30} color={colors.green300} />
      </View>
      <Text style={styles.emptyTitle}>Your story starts today</Text>
      <Text style={styles.emptyBody}>
        As you unlock stats and discover places, they'll appear here as a timeline of your life.
      </Text>
    </Animated.View>
  );
}

// ─── Screen ───────────────────────────────────────────────────
export default function StoryScreen() {
  const profile          = useUserStore((s) => s.profile);
  const unlockedStats    = useStatsStore((s) => s.unlockedStats);
  const openHistory      = useStatsStore((s) => s.openHistory);
  const places           = useWanderStore((s) => s.places);

  // ── Stats summary numbers ──
  const daysAlive = useMemo(() => {
    if (!profile) return 0;
    return Math.max(1, differenceInDays(new Date(), parseISO(profile.dateOfBirth)));
  }, [profile]);

  const placesDiscovered = useMemo(
    () => places.filter((p) => p.discoveredDate !== null).length,
    [places]
  );

  const bestStreak = useMemo(() => computeBestStreak(openHistory), [openHistory]);

  // ── Build unified event list ──
  const allEvents = useMemo<TimelineEvent[]>(() => {
    const events: TimelineEvent[] = [];

    // Stat unlock events
    for (const unlock of unlockedStats) {
      const def = STAT_DEFINITIONS.find((d) => d.id === unlock.statId);
      if (!def || !unlock.unlockedDate) continue;
      events.push({
        id:       `stat-${unlock.statId}`,
        type:     'stat',
        date:     unlock.unlockedDate,
        title:    def.title,
        subtitle: def.description.split('{')[0].trim() || def.category,
        refId:    unlock.statId,
      });
    }

    // Place discovery events
    for (const place of places) {
      if (!place.discoveredDate) continue;
      events.push({
        id:       `place-${place.placeId}`,
        type:     'place',
        date:     place.discoveredDate,
        title:    place.name,
        subtitle: place.address,
        refId:    place.placeId,
      });
    }

    // Sort newest first
    events.sort((a, b) => b.date.localeCompare(a.date));
    return events;
  }, [unlockedStats, places]);

  // ── Available years ──
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    for (const ev of allEvents) {
      years.add(parseISO(ev.date).getFullYear());
    }
    if (profile) years.add(parseISO(profile.appJoinDate ?? new Date().toISOString()).getFullYear());
    return [...years].sort((a, b) => b - a);
  }, [allEvents, profile]);

  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());

  // Keep selectedYear valid when events load
  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears]);

  // ── Filter by year ──
  const filteredEvents = useMemo(
    () => allEvents.filter((ev) => parseISO(ev.date).getFullYear() === selectedYear),
    [allEvents, selectedYear]
  );

  // ── Group by month ──
  const monthGroups = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    for (const ev of filteredEvents) {
      const key = format(parseISO(ev.date), 'MMMM yyyy');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return [...map.entries()]; // [monthLabel, events[]]
  }, [filteredEvents]);

  // ── Header animation ──
  const headerOp = useSharedValue(0);
  const headerY  = useSharedValue(-8);
  useEffect(() => {
    headerOp.value = withTiming(1, { duration: 350 });
    headerY.value  = withSpring(0, { stiffness: 200, damping: 20 });
  }, []);
  const headerStyle = useAnimatedStyle(() => ({
    opacity:   headerOp.value,
    transform: [{ translateY: headerY.value }],
  }));

  // ── Running index for stagger base ──
  let eventIndex = 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Header ── */}
      <Animated.View style={[styles.header, headerStyle]}>
        <View>
          <Text style={styles.screenTitle}>Your Story</Text>
          <Text style={styles.screenSub}>A timeline of your life in Gati</Text>
        </View>
      </Animated.View>

      {/* ── Stats summary ── */}
      {profile && (
        <StatsSummaryBar
          daysAlive={daysAlive}
          statsUnlocked={unlockedStats.length}
          placesDiscovered={placesDiscovered}
          bestStreak={bestStreak}
        />
      )}

      {/* ── Year selector ── */}
      {availableYears.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.yearRow}
          style={styles.yearScroll}
        >
          {availableYears.map((y) => (
            <YearPill
              key={y}
              year={y}
              active={y === selectedYear}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedYear(y);
              }}
            />
          ))}
        </ScrollView>
      )}

      {/* ── Timeline ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {monthGroups.length === 0 ? (
          <EmptyStory />
        ) : (
          monthGroups.map(([monthLabel, events]) => {
            const base = eventIndex;
            eventIndex += events.length;
            return (
              <MonthSection
                key={monthLabel}
                monthLabel={monthLabel}
                events={events}
                baseIndex={base}
              />
            );
          })
        )}

        {/* Legend */}
        {monthGroups.length > 0 && (
          <View style={styles.legend}>
            {(Object.entries(EVENT_DOT) as [EventType, typeof EVENT_DOT[EventType]][]).map(
              ([type, meta]) => (
                <View key={type} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: meta.dot }]} />
                  <Text style={styles.legendLabel}>
                    {type === 'stat' ? 'Stat unlocked' : type === 'place' ? 'Place discovered' : 'Milestone'}
                  </Text>
                </View>
              )
            )}
          </View>
        )}

        <View style={{ height: spacing[10] }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.background,
  },

  header: {
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

  // Stats summary bar
  summaryBar: {
    flexDirection:     'row',
    marginHorizontal:  spacing[5],
    marginBottom:      spacing[3],
    backgroundColor:   colors.white,
    borderRadius:      radius.xl,
    borderWidth:       1,
    borderColor:       colors.border,
    paddingVertical:   spacing[4],
    ...shadow.xs,
  },
  summaryItem: {
    flex:       1,
    alignItems: 'center',
    gap:        2,
  },
  summaryValue: {
    fontFamily:    fontFamily.bold,
    fontSize:      17,
    color:         colors.green700,
    letterSpacing: -0.3,
  },
  summaryLabel: {
    fontFamily: fontFamily.regular,
    fontSize:   11,
    color:      colors.textMuted,
    textAlign:  'center',
  },
  summaryDivider: {
    width:           1,
    height:          32,
    backgroundColor: colors.borderLight,
    alignSelf:       'center',
  },

  // Year selector
  yearScroll: {
    flexGrow:    0,
    marginBottom: spacing[3],
  },
  yearRow: {
    flexDirection: 'row',
    gap:           spacing[2],
    paddingHorizontal: spacing[5],
  },
  yearPill: {
    paddingVertical:   spacing[2],
    paddingHorizontal: spacing[4],
    borderRadius:      radius.full,
    borderWidth:       1,
    borderColor:       colors.border,
    ...shadow.xs,
  },
  yearPillText: {
    fontFamily: fontFamily.semiBold,
    fontSize:   13,
    color:      colors.textSecondary,
  },
  yearPillTextActive: {
    color: colors.white,
  },

  // Scroll
  scroll:  { flex: 1 },
  content: {
    paddingHorizontal: spacing[5],
    paddingTop:        spacing[2],
  },

  // Month section
  monthSection: {
    marginBottom: spacing[5],
  },
  monthLabel: {
    fontFamily:    fontFamily.bold,
    fontSize:      14,
    color:         colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom:  spacing[3],
  },

  // Timeline entry row
  entryRow: {
    flexDirection: 'row',
    gap:           spacing[3],
    minHeight:     64,
  },
  railCol: {
    alignItems: 'center',
    width:      16,
    paddingTop: 18,
  },
  dot: {
    width:        10,
    height:       10,
    borderRadius: radius.full,
    flexShrink:   0,
  },
  rail: {
    flex:            1,
    width:           2,
    backgroundColor: colors.borderLight,
    marginTop:       4,
    marginBottom:    -4,
  },
  entryCardWrap: {
    flex:         1,
    marginBottom: spacing[2] + 2,
  },
  entryCard: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: colors.white,
    borderRadius:    radius.xl,
    borderWidth:     1,
    borderColor:     colors.border,
    padding:         spacing[3],
    gap:             spacing[2] + 2,
    ...shadow.xs,
  },
  entryIconPill: {
    width:           36,
    height:          36,
    borderRadius:    radius.md,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  entryText: {
    flex: 1,
    gap:  2,
  },
  entryTitle: {
    fontFamily:    fontFamily.semiBold,
    fontSize:      13,
    color:         colors.textPrimary,
    letterSpacing: -0.1,
  },
  entrySubtitle: {
    fontFamily: fontFamily.regular,
    fontSize:   11,
    color:      colors.textMuted,
  },
  entryDate: {
    fontFamily:  fontFamily.medium,
    fontSize:    11,
    color:       colors.textMuted,
    flexShrink:  0,
  },

  // Legend
  legend: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    gap:            spacing[3],
    paddingTop:     spacing[5],
    paddingBottom:  spacing[2],
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[1] + 2,
  },
  legendDot: {
    width:        8,
    height:       8,
    borderRadius: radius.full,
  },
  legendLabel: {
    fontFamily: fontFamily.regular,
    fontSize:   12,
    color:      colors.textMuted,
  },

  // Empty state
  empty: {
    alignItems:     'center',
    marginTop:      spacing[12],
    padding:        spacing[8],
    backgroundColor: colors.white,
    borderRadius:   radius.xl,
    borderWidth:    1,
    borderColor:    colors.border,
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
