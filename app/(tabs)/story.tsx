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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Pressable,
  ScrollView,
  StyleSheet,
  RefreshControl,
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
import { useAccess } from '@/hooks/useAccess';
import { useStoryStore } from '@/store/storyStore';
import { computeBestStreakFromRanges } from '@/hooks/useStreak';
import { NoteBottomSheet } from '@/components/story/NoteBottomSheet';
import { STAT_DEFINITIONS } from '@/data/statDefinitions';
import { MILESTONE_DEFINITIONS } from '@/engine/milestoneEngine';
import { colors, spacing, radius, fontFamily, shadow } from '@/theme';
import type { StoryAnnotation } from '@/store/storyStore';
import { Text } from '@/components/ui/Text';

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

// ─── Animated timeline entry ──────────────────────────────────
function TimelineEntry({
  event,
  index,
  isLast,
  annotation,
  onNote,
}: {
  event:       TimelineEvent;
  index:       number;
  isLast:      boolean;
  annotation?: StoryAnnotation;
  onNote:      (eventId: string, eventTitle: string) => void;
}) {
  const meta   = EVENT_DOT[event.type];
  const pinned = annotation?.pinned ?? false;
  // Pinned events use gold dot; otherwise the event-type colour
  const dotColor = pinned ? colors.gold : meta.dot;

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
  // onPressIn/Out already drive the visual press-scale, so navigate immediately
  // here. A ref guard stops a fast double-tap from stacking two screens.
  const navigatingRef = useRef(false);
  const handlePress = () => {
    if (!event.refId || navigatingRef.current) return;
    navigatingRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const refId = event.refId;
    if (event.type === 'stat') {
      router.push({ pathname: '/(tabs)/numbers/[statId]', params: { statId: refId } });
    } else if (event.type === 'place') {
      router.push({ pathname: '/(tabs)/wander/[placeId]', params: { placeId: refId } });
    }
    setTimeout(() => { navigatingRef.current = false; }, 600);
  };

  const handleNotePress = () => {
    Haptics.selectionAsync();
    onNote(event.id, event.title);
  };

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onNote(event.id, event.title);
  };

  return (
    <Animated.View style={[styles.entryRow, enterStyle]}>
      {/* Left rail + dot */}
      <View style={styles.railCol}>
        <View style={[styles.dot, { backgroundColor: dotColor }]}>
          {pinned && (
            <Ionicons name="bookmark" size={7} color={colors.white} />
          )}
        </View>
        {!isLast && <View style={styles.rail} />}
      </View>

      {/* Card + note block */}
      <View style={styles.entryCardWrap}>
        <Animated.View style={pressStyle}>
          <Pressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handlePress}
            onLongPress={handleLongPress}
            delayLongPress={400}
            android_ripple={{ color: colors.green50 }}
            style={[styles.entryCard, pinned && styles.entryCardPinned]}
            accessibilityHint="Long press to add or edit a note"
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

            {/* Chevron (if navigable) or note button */}
            <View style={styles.entryActions}>
              {event.refId && (
                <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
              )}
            </View>
          </Pressable>
        </Animated.View>

        {/* Existing note display */}
        {annotation && annotation.text.length > 0 && (
          <Pressable
            onPress={handleNotePress}
            style={styles.noteBlock}
            accessibilityRole="button"
            accessibilityLabel="Edit your note"
          >
            <View style={styles.noteAccent} />
            <Text style={styles.noteText} numberOfLines={3}>
              {annotation.text}
            </Text>
          </Pressable>
        )}

      </View>
    </Animated.View>
  );
}

// ─── Month section ────────────────────────────────────────────
function MonthSection({
  monthLabel,
  events,
  baseIndex,
  annotations,
  onNote,
}: {
  monthLabel:  string;
  events:      TimelineEvent[];
  baseIndex:   number;
  annotations: Record<string, StoryAnnotation>;
  onNote:      (eventId: string, eventTitle: string) => void;
}) {
  const op = useSharedValue(0);
  useEffect(() => {
    op.value = withDelay(baseIndex * 60, withTiming(1, { duration: 360 }));
  }, [baseIndex]);
  const headerStyle = useAnimatedStyle(() => ({ opacity: op.value }));

  return (
    <View style={styles.monthSection}>
      <Animated.Text style={[styles.monthLabel, headerStyle]} maxFontSizeMultiplier={1.4}>
        {monthLabel}
      </Animated.Text>
      {events.map((ev, i) => (
        <TimelineEntry
          key={ev.id}
          event={ev}
          index={baseIndex + i}
          isLast={i === events.length - 1}
          annotation={annotations[ev.id]}
          onNote={onNote}
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
    backgroundColor: fill.value > 0.5 ? colors.green700 : colors.white,
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
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push('/(tabs)/today');
        }}
        style={styles.emptyCtaBtn}
        accessibilityRole="button"
        accessibilityLabel="Go to Today to unlock your first number"
      >
        <Text style={styles.emptyCtaBtnText}>Unlock your first number</Text>
        <Ionicons name="arrow-forward" size={14} color={colors.white} />
      </Pressable>
    </Animated.View>
  );
}

// ─── Screen ───────────────────────────────────────────────────
export default function StoryScreen() {
  const profile            = useUserStore((s) => s.profile);
  // One capability check rather than a raw entitlement comparison, so a free
  // launch opens the full timeline without touching this screen.
  const access             = useAccess();
  const isFree             = !access.canSeeFullStory;

  const unlockedStats      = useStatsStore((s) => s.unlockedStats);
  const openHistoryRanges  = useStatsStore((s) => s.openHistoryRanges);
  const maxStreakEver       = useStatsStore((s) => s.maxStreakEver);
  const seenMilestoneIds   = useStatsStore((s) => s.seenMilestoneIds);
  const milestoneSeenDates = useStatsStore((s) => s.milestoneSeenDates);
  const places             = useWanderStore((s) => s.places);

  // ── Annotations ──
  const annotations    = useStoryStore((s) => s.annotations);
  const setAnnotation  = useStoryStore((s) => s.setAnnotation);
  const removeAnnotation = useStoryStore((s) => s.removeAnnotation);

  // Pull-to-refresh
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  // Note sheet state: { id, title } of the event being annotated, or null
  const [noteTarget, setNoteTarget] = useState<{ id: string; title: string } | null>(null);

  const handleOpenNote = useCallback((eventId: string, eventTitle: string) => {
    setNoteTarget({ id: eventId, title: eventTitle });
  }, []);

  const handleSaveNote = useCallback(
    (itemId: string, text: string, pinned: boolean) => {
      setAnnotation(itemId, text, pinned);
    },
    [setAnnotation]
  );

  const handleDeleteNote = useCallback(
    (itemId: string) => { removeAnnotation(itemId); },
    [removeAnnotation]
  );

  // ── Stats summary numbers ──
  const daysAlive = useMemo(() => {
    if (!profile) return 0;
    return Math.max(1, differenceInDays(new Date(), parseISO(profile.dateOfBirth)));
  }, [profile]);

  const placesDiscovered = useMemo(
    () => places.filter((p) => p.discoveredDate !== null).length,
    [places]
  );

  const bestStreak = useMemo(
    () => openHistoryRanges.length > 0
      ? Math.max(computeBestStreakFromRanges(openHistoryRanges), maxStreakEver)
      : maxStreakEver,
    [openHistoryRanges, maxStreakEver],
  );

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
        subtitle: def.description.length > 60
          ? def.description.slice(0, 57).trimEnd() + '…'
          : def.description,
        refId:    unlock.statId,
      });
    }

    // Place events — only places the user ACTED on (saved/visited/rated).
    // Otherwise every background fetch would flood the story with
    // dozens of "discovered" entries that mean nothing to the user.
    for (const place of places) {
      const acted = place.isSaved || place.isVisited || place.userRating !== null;
      if (!acted) continue;
      // Date semantics (fixed — see userStore mergeRealPlaces):
      //   visited → visitedDate  (the day the user physically went there)
      //   saved but not visited → discoveredDate  (the day it first appeared in Wander)
      // discoveredDate is stable because mergeRealPlaces now preserves it on
      // re-fetches rather than resetting it to the current date each time.
      const date = place.visitedDate ?? place.discoveredDate;
      if (!date) continue;
      events.push({
        id:       `place-${place.placeId}`,
        type:     'place',
        date,
        title:    place.name,
        subtitle: place.isVisited
          ? 'You were here'
          : place.address || 'Saved for later',
        refId:    place.placeId,
      });
    }

    // Milestone events — only ones EARNED in-app (they have a seen date).
    // Pre-seeded milestones (met before install) stay out of the story.
    for (const id of seenMilestoneIds) {
      const def  = MILESTONE_DEFINITIONS.find((m) => m.id === id);
      const date = milestoneSeenDates[id];
      if (!def || !date) continue;
      events.push({
        id:       `milestone-${id}`,
        type:     'milestone',
        date,
        title:    def.title,
        subtitle: 'Milestone reached',
      });
    }

    // Anchor: the day this story started
    if (profile?.appJoinDate) {
      events.push({
        id:       'joined-gati',
        type:     'milestone',
        date:     profile.appJoinDate,
        title:    'You joined Gati',
        subtitle: 'Day one of counting your life',
      });
    }

    // Sort newest first
    events.sort((a, b) => b.date.localeCompare(a.date));
    return events;
  }, [unlockedStats, places, seenMilestoneIds, milestoneSeenDates, profile?.appJoinDate]);

  // ── Available years ──
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    for (const ev of allEvents) {
      years.add(parseISO(ev.date).getFullYear());
    }
    if (profile) years.add(parseISO(profile.appJoinDate ?? new Date().toISOString()).getFullYear());
    return [...years].sort((a, b) => b - a);
  }, [allEvents, profile]);

  const [pickedYear, setPickedYear] = useState<number | null>(null);

  // Derived, not corrected in an effect: the picked year is only honoured if
  // it still exists once events have loaded, otherwise we fall back to the
  // newest available year. An effect here rendered one frame of an empty
  // timeline first, then cascaded a second render.
  const selectedYear = (pickedYear !== null && availableYears.includes(pickedYear))
    ? pickedYear
    : (availableYears[0] ?? new Date().getFullYear());
  const setSelectedYear = setPickedYear;

  // ── Filter by year ──
  const filteredEvents = useMemo(
    () => allEvents.filter((ev) => parseISO(ev.date).getFullYear() === selectedYear),
    [allEvents, selectedYear]
  );

  // ── Pro gate: free users only see last 30 days ──
  const STORY_FREE_DAYS = 30;
  const gatedEvents = useMemo(() => {
    if (!isFree) return filteredEvents;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - STORY_FREE_DAYS);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return filteredEvents.filter((ev) => ev.date >= cutoffStr);
  }, [filteredEvents, isFree]);

  // How many events are hidden by the gate (for the upgrade banner count)
  const hiddenEventCount = filteredEvents.length - gatedEvents.length;

  // ── Group by month ──
  const monthGroups = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    for (const ev of gatedEvents) {
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.green700}
            colors={[colors.green700]}
          />
        }
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
                annotations={annotations}
                onNote={handleOpenNote}
              />
            );
          })
        )}

        {/* Pro gate banner — free users with older events */}
        {isFree && hiddenEventCount > 0 && (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/pro');
            }}
            style={styles.storyGateBanner}
            android_ripple={{ color: colors.green50 }}
            accessibilityRole="button"
            accessibilityLabel={`${hiddenEventCount} older events hidden. Upgrade to Pro to see your full story.`}
          >
            <View style={styles.storyGateIconWrap}>
              <Ionicons name="time-outline" size={20} color={colors.green700} />
            </View>
            <View style={styles.storyGateText}>
              <Text style={styles.storyGateTitle}>
                {hiddenEventCount} older {hiddenEventCount === 1 ? 'memory' : 'memories'} hidden
              </Text>
              <Text style={styles.storyGateSub}>
                Upgrade to Pro to see your full timeline
              </Text>
            </View>
            <View style={styles.storyGateCta}>
              <Text style={styles.storyGateCtaText}>Upgrade</Text>
              <Ionicons name="chevron-forward" size={12} color={colors.green700} />
            </View>
          </Pressable>
        )}

        {/* Pro gate banner — free users viewing a year with no visible events */}
        {isFree && monthGroups.length === 0 && filteredEvents.length > 0 && (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/pro');
            }}
            style={styles.storyGateBanner}
            android_ripple={{ color: colors.green50 }}
            accessibilityRole="button"
          >
            <View style={styles.storyGateIconWrap}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.green700} />
            </View>
            <View style={styles.storyGateText}>
              <Text style={styles.storyGateTitle}>This year is locked</Text>
              <Text style={styles.storyGateSub}>Upgrade to Pro to unlock older years</Text>
            </View>
            <View style={styles.storyGateCta}>
              <Text style={styles.storyGateCtaText}>Upgrade</Text>
              <Ionicons name="chevron-forward" size={12} color={colors.green700} />
            </View>
          </Pressable>
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

      {/* ── Note bottom sheet ── */}
      <NoteBottomSheet
        itemId={noteTarget?.id ?? null}
        eventTitle={noteTarget?.title ?? ''}
        existing={noteTarget ? annotations[noteTarget.id] : undefined}
        onSave={handleSaveNote}
        onDelete={handleDeleteNote}
        onDismiss={() => setNoteTarget(null)}
      />
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
    fontSize:      24.5,
    color:         colors.textPrimary,
    letterSpacing: -0.4,
    marginBottom:  3,
  },
  screenSub: {
    fontFamily: fontFamily.regular,
    fontSize:   12,
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
    fontSize:      16,
    color:         colors.green700,
    letterSpacing: -0.3,
  },
  summaryLabel: {
    fontFamily: fontFamily.regular,
    fontSize:   10.5,
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
    fontSize:   12,
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
    fontSize:      13,
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
    width:          10,
    height:         10,
    borderRadius:   radius.full,
    flexShrink:     0,
    alignItems:     'center',
    justifyContent: 'center',
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
    fontSize:      12,
    color:         colors.textPrimary,
    letterSpacing: -0.1,
  },
  entrySubtitle: {
    fontFamily: fontFamily.regular,
    fontSize:   10.5,
    color:      colors.textMuted,
  },
  entryDate: {
    fontFamily:  fontFamily.medium,
    fontSize:    10.5,
    color:       colors.textMuted,
    flexShrink:  0,
  },
  entryActions: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[1],
  },
  entryCardPinned: {
    borderColor:  colors.gold + '55',
    borderWidth:  1.5,
  },

  // Note block — appears below the card
  noteBlock: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    gap:            spacing[2],
    marginTop:      spacing[1] + 1,
    marginLeft:     spacing[1],
    paddingVertical:   spacing[2],
    paddingHorizontal: spacing[3],
    backgroundColor:   colors.surface2,
    borderRadius:      radius.lg,
    borderWidth:       1,
    borderColor:       colors.borderLight,
  },
  noteAccent: {
    width:           3,
    alignSelf:       'stretch',
    borderRadius:    2,
    backgroundColor: colors.green300,
    flexShrink:      0,
  },
  noteText: {
    flex:       1,
    fontFamily: fontFamily.regular,
    fontSize:   11.5,
    color:      colors.textSecondary,
    lineHeight: 17,
    fontStyle:  'italic',
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
    fontSize:   11.5,
    color:      colors.textMuted,
  },

  // Story gate banner (free tier — older events locked)
  storyGateBanner: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing[3],
    backgroundColor: colors.green50,
    borderRadius:    radius.xl,
    borderWidth:     1,
    borderColor:     colors.green100,
    padding:         spacing[4],
    marginBottom:    spacing[5],
  },
  storyGateIconWrap: {
    width:           40,
    height:          40,
    borderRadius:    radius.md,
    backgroundColor: colors.white,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     colors.green100,
    flexShrink:      0,
  },
  storyGateText: {
    flex: 1,
    gap:  2,
  },
  storyGateTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize:   13,
    color:      colors.green700,
  },
  storyGateSub: {
    fontFamily: fontFamily.regular,
    fontSize:   11.5,
    color:      colors.textSecondary,
  },
  storyGateCta: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           2,
  },
  storyGateCtaText: {
    fontFamily: fontFamily.semiBold,
    fontSize:   12,
    color:      colors.green700,
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
    fontSize:     17,
    color:        colors.textPrimary,
    marginBottom: spacing[2],
  },
  emptyBody: {
    fontFamily: fontFamily.regular,
    fontSize:   13,
    color:      colors.textMuted,
    textAlign:  'center',
    lineHeight: 19.5,
  },
  emptyCtaBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing[2],
    marginTop:         spacing[5],
    backgroundColor:   colors.green700,
    paddingVertical:   spacing[3],
    paddingHorizontal: spacing[5],
    borderRadius:      radius.full,
  },
  emptyCtaBtnText: {
    fontFamily: fontFamily.semiBold,
    fontSize:   13,
    color:      colors.white,
  },
});
