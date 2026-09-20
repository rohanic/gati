/**
 * Today — the hub.
 *
 * One screen that answers "why open Gati right now", in priority order:
 *
 *   1. Do I have a key? → the day's decision, the main reason to return.
 *   2. What did I open today? → the payoff, with the full figure.
 *   3. Where could that number take me? → the number-to-place bridge, which
 *      is the thing that makes Gati more than a trivia app.
 *   4. What have I built? → streak, week, progress.
 *
 * Previously this screen showed whichever stat the schedule dictated, with no
 * decision to make and no connection to Wander. The bridge engine existed but
 * only Wander used it, so the two halves of the product never met.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  RefreshControl, AppState, type AppStateStatus,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, withDelay,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { format, subDays, startOfDay } from 'date-fns';
import { router } from 'expo-router';

import { MilestoneModal } from '@/components/milestone';
import { UnlockSheet } from '@/components/numbers';
import { CountUpText } from '@/components/ui';
import { useNumbers, useSuggestedNumber, type NumberCard } from '@/hooks/useNumbers';
import { useStreak, useMaxStreakEver, useOpenDateSet } from '@/hooks/useStreak';
import { usePendingMilestone } from '@/hooks/useMilestone';
import { useUserStore, useStatsStore, useWanderStore } from '@/store/userStore';
import { useClockStore } from '@/store/clockStore';
import { useAuthStore } from '@/store/authStore';
import {
  refreshNotificationsOnOpen,
  scheduleWeeklyDigest,
  scheduleMilestonePrediction,
  scheduleServerMilestonePush,
} from '@/services/notifications';
import { computeLifeStats } from '@/engine/statsEngine';
import { getUpcomingMilestonePrediction, type MilestoneCheckParams } from '@/engine/milestoneEngine';
import { getBridgeForStat } from '@/engine/statPlaceBridge';
import { formatTimeUntilNextKey } from '@/engine/unlockEngine';
import { scorePlace } from '@/engine/wanderEngine';
import { getCategoryTheme, colors, spacing, radius, fontFamily, shadow } from '@/theme';
import type { WanderPlace } from '@/types';

// ─── Greeting ─────────────────────────────────────────────────
function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 7)   return 'Early start';
  if (h >= 7 && h < 12)  return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ─── Streak badge ─────────────────────────────────────────────
function StreakBadge({ count }: { count: number }) {
  const opacity = useSharedValue(0);
  const scale   = useSharedValue(0.85);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 380 });
    scale.value   = withSpring(1, { stiffness: 300, damping: 25 });
  }, [opacity, scale]);

  const style = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.streakBadge, style]}>
      <Ionicons name="flame" size={15} color={colors.gold} />
      <Text style={styles.streakCount}>{count}</Text>
      <Text style={styles.streakLabel}>{count === 1 ? 'day' : 'day streak'}</Text>
    </Animated.View>
  );
}

// ─── Weekly dots ──────────────────────────────────────────────
function WeeklyDots({ openSet }: { openSet: Set<string> }) {
  const today = startOfDay(new Date());
  const days  = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(today, 6 - i);
    return {
      key:     format(d, 'yyyy-MM-dd'),
      label:   format(d, 'EEEEE'),
      opened:  openSet.has(format(d, 'yyyy-MM-dd')),
      isToday: i === 6,
    };
  });

  if (days.every((d) => !d.opened)) return null;

  return (
    <View style={styles.weeklyRow}>
      {days.map(({ key, label, opened, isToday }) => (
        <View key={key} style={styles.weeklyCol}>
          <View style={[
            styles.weeklyDot,
            opened  && styles.weeklyDotFilled,
            isToday && styles.weeklyDotToday,
          ]} />
          <Text style={[styles.weeklyLabel, isToday && styles.weeklyLabelToday]}>
            {label}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─── The day's decision ───────────────────────────────────────
/**
 * The hero. Either "you have a key, here's one worth opening" or "here's when
 * the next one lands". This is the single most important element on the
 * screen: it is the reason the app is worth opening daily.
 */
function TodaysKey({
  suggestion, keysLeft, onOpen, onBrowse,
}: {
  suggestion: NumberCard | null;
  keysLeft:   number;
  onOpen:     (card: NumberCard) => void;
  onBrowse:   () => void;
}) {
  const op = useSharedValue(0);
  const ty = useSharedValue(14);

  useEffect(() => {
    op.value = withDelay(80, withTiming(1, { duration: 360 }));
    ty.value = withDelay(80, withSpring(0, { stiffness: 200, damping: 20 }));
  }, [op, ty]);

  const style = useAnimatedStyle(() => ({
    opacity:   op.value,
    transform: [{ translateY: ty.value }],
  }));

  if (!suggestion) {
    return (
      <Animated.View style={[styles.keyCard, styles.keyCardWaiting, style]}>
        <View style={styles.keyCardHead}>
          <Ionicons name="hourglass-outline" size={16} color={colors.textMuted} />
          <Text style={styles.keyCardEyebrow}>Next key</Text>
        </View>
        <Text style={styles.keyCardTitle}>
          A new number in {formatTimeUntilNextKey()}
        </Text>
        <Text style={styles.keyCardBody}>
          One a day, so each one gets a moment instead of becoming a list you scroll past.
        </Text>
        <Pressable onPress={onBrowse} style={styles.keyCardGhost} accessibilityRole="button">
          <Text style={styles.keyCardGhostText}>Look back at what you&rsquo;ve opened</Text>
          <Ionicons name="arrow-forward" size={13} color={colors.green700} />
        </Pressable>
      </Animated.View>
    );
  }

  const cat = getCategoryTheme(suggestion.definition.category);

  return (
    <Animated.View style={[styles.keyCard, style]}>
      <View style={styles.keyCardHead}>
        <Ionicons name="key" size={16} color={colors.green700} />
        <Text style={[styles.keyCardEyebrow, styles.keyCardEyebrowReady]}>
          {keysLeft === 1 ? '1 key ready' : `${keysLeft} keys ready`}
        </Text>
      </View>

      <Text style={styles.keyCardTitle}>Open a number today</Text>

      {/* The suggestion is a nudge for the undecided, not an assignment. */}
      <Pressable
        onPress={() => onOpen(suggestion)}
        style={[styles.suggestion, { backgroundColor: cat.bg, borderColor: cat.border }]}
        android_ripple={{ color: cat.bgSoft }}
        accessibilityRole="button"
        accessibilityLabel={`Open ${suggestion.definition.title}. ${suggestion.teaser}`}
      >
        <View style={[styles.suggestionIcon, { backgroundColor: cat.bgSoft }]}>
          <Ionicons name={suggestion.definition.icon as any} size={19} color={cat.deep} />
        </View>
        <View style={styles.suggestionText}>
          <Text style={styles.suggestionTitle} numberOfLines={1}>
            {suggestion.definition.title}
          </Text>
          <Text style={styles.suggestionTeaser} numberOfLines={2}>
            {suggestion.teaser}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={cat.accent} />
      </Pressable>

      <Pressable onPress={onBrowse} style={styles.keyCardGhost} accessibilityRole="button">
        <Text style={styles.keyCardGhostText}>Or choose another</Text>
        <Ionicons name="arrow-forward" size={13} color={colors.green700} />
      </Pressable>
    </Animated.View>
  );
}

// ─── A number opened today ────────────────────────────────────
function OpenedToday({ card, onPress }: { card: NumberCard; onPress: () => void }) {
  const cat = getCategoryTheme(card.definition.category);
  return (
    <Pressable
      onPress={onPress}
      style={[styles.openedCard, { backgroundColor: cat.bg, borderColor: cat.border }]}
      android_ripple={{ color: cat.bgSoft }}
      accessibilityRole="button"
      accessibilityLabel={`${card.definition.title}. Tap for the full story.`}
    >
      <View style={styles.openedHead}>
        <View style={[styles.openedIcon, { backgroundColor: cat.bgSoft }]}>
          <Ionicons name={card.definition.icon as any} size={16} color={cat.deep} />
        </View>
        <Text style={[styles.openedCategory, { color: cat.accent }]}>{cat.label}</Text>
      </View>
      <Text style={styles.openedTitle}>{card.definition.title}</Text>
      <CountUpText
        value={card.value}
        precision={card.definition.precision}
        animateKey={card.definition.id}
        style={[styles.openedValue, { color: cat.deep }]}
      />
      <Text style={styles.openedUnit}>{card.definition.unit}</Text>
    </Pressable>
  );
}

// ─── Number → place bridge ────────────────────────────────────
/**
 * The connective tissue. A number about coffee should lead somewhere you can
 * drink one; a number about steps should lead somewhere worth walking to.
 * Without this, Numbers and Wander are two unrelated apps sharing a tab bar.
 */
function NumberLeadsHere({
  place, contextLine, onPress,
}: {
  place:       WanderPlace;
  contextLine: string;
  onPress:     () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.bridgeCard}
      android_ripple={{ color: colors.green50 }}
      accessibilityRole="button"
      accessibilityLabel={`${place.name}. ${contextLine}`}
    >
      <View style={styles.bridgeIcon}>
        <Ionicons name="navigate" size={17} color={colors.green700} />
      </View>
      <View style={styles.bridgeText}>
        <Text style={styles.bridgeContext} numberOfLines={2}>{contextLine}</Text>
        <Text style={styles.bridgeName} numberOfLines={1}>{place.name}</Text>
        <Text style={styles.bridgeMeta} numberOfLines={1}>
          {place.distanceKm} km away
          {place.rating > 0 ? ` · ${place.rating.toFixed(1)}★` : ''}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

// ─── Section header ───────────────────────────────────────────
function SectionHeader({ title, icon }: { title: string; icon: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon as any} size={15} color={colors.textSecondary} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────
export default function TodayScreen() {
  const profile           = useUserStore((s) => s.profile);
  const markMilestoneSeen = useStatsStore((s) => s.markMilestoneSeen);
  const recordOpen        = useStatsStore((s) => s.recordOpen);
  const redeemKey         = useStatsStore((s) => s.redeemKey);
  const unlockedStats     = useStatsStore((s) => s.unlockedStats);
  const places            = useWanderStore((s) => s.places);
  const categoryScores    = useWanderStore((s) => s.categoryScores);
  const serverPushEnabled = !!useAuthStore((s) => s.userId);

  const { today: openedToday, summary, unlocked } = useNumbers();
  const suggestion   = useSuggestedNumber();
  const openSet      = useOpenDateSet();
  const streak       = useStreak();
  const maxStreak    = useMaxStreakEver();
  const pending      = usePendingMilestone();

  const [sheetCard, setSheet]   = useState<NumberCard | null>(null);
  const [revealed, setRevealed] = useState(false);

  // Record the visit for the streak.
  useEffect(() => { recordOpen(); }, [recordOpen]);

  // ── Milestone modal, after the screen settles ──
  const [shownMilestone, setShown] = useState<typeof pending>(null);
  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => setShown(pending), 1200);
    return () => clearTimeout(t);
  }, [pending]);

  const dismissMilestone = useCallback(() => {
    if (shownMilestone) {
      markMilestoneSeen(shownMilestone.id);
      setShown(null);
    }
  }, [shownMilestone, markMilestoneSeen]);

  // ── Notifications ──
  useEffect(() => {
    if (!profile) return;
    const next = suggestion?.definition;
    refreshNotificationsOnOpen(profile.notificationTime, {
      name:             profile.firstName,
      streak,
      nextStatCategory: next?.category,
      nextStatId:       next?.id,
    }, serverPushEnabled);
  }, [profile, streak, serverPushEnabled, suggestion?.definition]);

  useEffect(() => {
    if (!profile || serverPushEnabled) return;
    const now       = new Date();
    const dayOfWeek = now.getDay();
    const msSinceMon = ((dayOfWeek === 0 ? 6 : dayOfWeek - 1)) * 86_400_000;
    const monday    = format(new Date(Date.now() - msSinceMon), 'yyyy-MM-dd');
    const todayStr  = format(now, 'yyyy-MM-dd');
    const opened    = [...openSet].filter((d) => d >= monday && d <= todayStr).length;

    scheduleWeeklyDigest({
      daysOpenedThisWeek: opened,
      currentStreak:      streak,
      totalPlacesSaved:   places.filter((p) => p.isSaved).length,
    });
  }, [profile, streak, openSet, places, serverPushEnabled]);

  useEffect(() => {
    if (!profile) return;
    const params: MilestoneCheckParams = {
      profile,
      lifeStats:     computeLifeStats(profile),
      streak,
      appDayIndex:   summary.unlocked,
      totalUnlocked: unlockedStats.length,
    };
    const prediction = getUpcomingMilestonePrediction(params);
    if (!prediction) return;
    if (serverPushEnabled) scheduleServerMilestonePush(prediction);
    else                   scheduleMilestonePrediction(prediction);
  }, [profile, streak, unlockedStats.length, serverPushEnabled, summary.unlocked]);

  // ── Pull to refresh: bump the clock so the key count re-derives ──
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    useClockStore.getState().bump();
    recordOpen();
    setTimeout(() => setRefreshing(false), 420);
  }, [recordOpen]);

  const lastActive = useRef(Date.now());
  useEffect(() => {
    const STALE = 30 * 60 * 1000;
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active' && Date.now() - lastActive.current > STALE) {
        useClockStore.getState().bump();
      }
      lastActive.current = Date.now();
    });
    return () => sub.remove();
  }, []);

  // ── Unlock flow ──
  const openSheet = useCallback((card: NumberCard) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRevealed(false);
    setSheet(card);
  }, []);

  const confirmUnlock = useCallback(() => {
    if (!sheetCard) return;
    const ok = redeemKey(sheetCard.definition.id, profile?.appJoinDate ?? null);
    if (ok) setRevealed(true);
    else    setSheet(null);
  }, [sheetCard, redeemKey, profile?.appJoinDate]);

  const liveSheetCard = useMemo(() => {
    if (!sheetCard) return null;
    const all = [...openedToday, ...unlocked];
    return all.find((c) => c.definition.id === sheetCard.definition.id) ?? sheetCard;
  }, [openedToday, unlocked, sheetCard]);

  // ── The bridge: a place suggested by a number opened today ──
  const bridge = useMemo(() => {
    const source = openedToday[0];
    if (!source) return null;

    const link = getBridgeForStat(source.definition.id);
    if (!link) return null;

    const candidates = places.filter(
      (p) => p.category === link.placeCategory && !p.isVisited,
    );
    if (candidates.length === 0) return null;

    const best = [...candidates].sort(
      (a, b) =>
        scorePlace(b, categoryScores, profile?.interestCategories ?? []) -
        scorePlace(a, categoryScores, profile?.interestCategories ?? []),
    )[0];

    const contextLine = link.getContextLine(source.value, profile ?? undefined);
    if (!contextLine) return null;

    return { place: best, contextLine };
  }, [openedToday, places, categoryScores, profile]);

  // ── Header entrance ──
  const headOp = useSharedValue(0);
  const headY  = useSharedValue(-12);
  useEffect(() => {
    headOp.value = withTiming(1, { duration: 400 });
    headY.value  = withSpring(0, { stiffness: 200, damping: 20 });
  }, [headOp, headY]);
  const headStyle = useAnimatedStyle(() => ({
    opacity:   headOp.value,
    transform: [{ translateY: headY.value }],
  }));

  const name = profile?.firstName ?? '';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
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
        {/* ── Header ── */}
        <Animated.View style={[styles.header, headStyle]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>
              {getGreeting()}{name ? `, ${name}` : ''}
            </Text>
            <Text style={styles.date}>{format(new Date(), 'EEEE, MMMM d')}</Text>
            {summary.unlocked > 0 && (
              <Text style={styles.progressLine}>
                {summary.unlocked} of {summary.total} numbers opened
              </Text>
            )}
          </View>
          {streak > 0 && <StreakBadge count={streak} />}
        </Animated.View>

        <WeeklyDots openSet={openSet} />

        {/* Streak recovery beats a milestone nudge when a run has just broken. */}
        {streak === 0 && maxStreak >= 7 && (
          <View style={styles.hintRow}>
            <Ionicons name="flame-outline" size={12} color={colors.gold} />
            <Text style={styles.hintText}>
              Your best was {maxStreak} days. Today starts the next one.
            </Text>
          </View>
        )}

        {/* ── 1. The day's decision ── */}
        <TodaysKey
          suggestion={suggestion}
          keysLeft={summary.available}
          onOpen={openSheet}
          onBrowse={() => router.push('/(tabs)/numbers')}
        />

        {/* ── 2. What you opened today ── */}
        {openedToday.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Opened today" icon="sparkles-outline" />
            <View style={styles.openedRow}>
              {openedToday.map((card) => (
                <OpenedToday
                  key={card.definition.id}
                  card={card}
                  onPress={() => router.push(`/(tabs)/numbers/${card.definition.id}`)}
                />
              ))}
            </View>
          </View>
        )}

        {/* ── 3. Where that number leads ── */}
        {bridge && (
          <View style={styles.section}>
            <SectionHeader title="Your number, nearby" icon="compass-outline" />
            <NumberLeadsHere
              place={bridge.place}
              contextLine={bridge.contextLine}
              onPress={() => router.push({
                pathname: '/(tabs)/wander/[placeId]',
                params:   { placeId: bridge.place.placeId },
              })}
            />
          </View>
        )}

        {/* ── 4. Recently opened ── */}
        {unlocked.length > openedToday.length && (
          <View style={styles.section}>
            <SectionHeader title="Your collection" icon="layers-outline" />
            <View style={styles.recentWrap}>
              {unlocked
                .filter((c) => !c.openedToday)
                .slice(-6)
                .reverse()
                .map((card) => {
                  const cat = getCategoryTheme(card.definition.category);
                  return (
                    <Pressable
                      key={card.definition.id}
                      onPress={() => router.push(`/(tabs)/numbers/${card.definition.id}`)}
                      style={styles.recentRow}
                      android_ripple={{ color: colors.green50 }}
                      accessibilityRole="button"
                      accessibilityLabel={card.definition.title}
                    >
                      <View style={[styles.recentIcon, { backgroundColor: cat.bg }]}>
                        <Ionicons
                          name={card.definition.icon as any}
                          size={15}
                          color={cat.deep}
                        />
                      </View>
                      <Text style={styles.recentTitle} numberOfLines={1}>
                        {card.definition.title}
                      </Text>
                      <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                    </Pressable>
                  );
                })}
            </View>
          </View>
        )}

        <View style={{ height: spacing[10] }} />
      </ScrollView>

      <UnlockSheet
        card={liveSheetCard}
        keysLeft={summary.available}
        revealed={revealed}
        onConfirm={confirmUnlock}
        onDismiss={() => { setSheet(null); setRevealed(false); }}
        onSeeDetail={() => {
          const id = sheetCard?.definition.id;
          setSheet(null);
          setRevealed(false);
          if (id) router.push(`/(tabs)/numbers/${id}`);
        }}
      />

      <MilestoneModal milestone={shownMilestone} onDismiss={dismissMilestone} />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.background },
  scroll:  { flex: 1 },
  content: { paddingTop: spacing[5] },

  header: {
    flexDirection:     'row',
    alignItems:        'flex-start',
    paddingHorizontal: spacing[5],
    marginBottom:      spacing[4],
    gap:               spacing[3],
  },
  greeting: {
    fontFamily:    fontFamily.bold,
    fontSize:      20.5,
    color:         colors.textPrimary,
    letterSpacing: -0.3,
    marginBottom:  3,
  },
  date: {
    fontFamily: fontFamily.regular,
    fontSize:   12,
    color:      colors.textSecondary,
  },
  progressLine: {
    fontFamily: fontFamily.regular,
    fontSize:   11,
    color:      colors.green700,
    marginTop:  2,
    opacity:    0.8,
  },

  streakBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing[1] + 1,
    paddingVertical:   spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius:      radius.full,
    backgroundColor:   colors.goldBg,
    borderWidth:       1,
    borderColor:       colors.goldBorder,
  },
  streakCount: { fontFamily: fontFamily.bold,    fontSize: 13,   color: colors.gold },
  streakLabel: { fontFamily: fontFamily.regular, fontSize: 11.5, color: colors.gold },

  weeklyRow: {
    flexDirection:    'row',
    justifyContent:   'center',
    gap:              spacing[2] + 2,
    marginHorizontal: spacing[5],
    marginBottom:     spacing[4],
  },
  weeklyCol:  { alignItems: 'center', gap: 3 },
  weeklyDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  weeklyDotFilled: { backgroundColor: colors.green500 },
  weeklyDotToday:  { width: 10, height: 10, borderRadius: 5 },
  weeklyLabel: {
    fontFamily: fontFamily.regular,
    fontSize:   9,
    color:      colors.textMuted,
    lineHeight: 11,
  },
  weeklyLabelToday: { color: colors.green700, fontFamily: fontFamily.semiBold },

  hintRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing[2],
    alignSelf:         'center',
    marginHorizontal:  spacing[5],
    marginBottom:      spacing[4],
    paddingVertical:   spacing[2],
    paddingHorizontal: spacing[4],
    borderRadius:      radius.full,
    backgroundColor:   colors.surface2,
    borderWidth:       1,
    borderColor:       colors.borderLight,
  },
  hintText: {
    fontFamily: fontFamily.medium,
    fontSize:   11.5,
    color:      colors.textMuted,
  },

  // ── The day's decision ──
  keyCard: {
    marginHorizontal: spacing[5],
    padding:          spacing[5],
    borderRadius:     radius.xl,
    backgroundColor:  colors.white,
    borderWidth:      1,
    borderColor:      colors.green100,
    gap:              spacing[3],
    ...shadow.sm,
  },
  keyCardWaiting: { borderColor: colors.border },
  keyCardHead: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[2],
  },
  keyCardEyebrow: {
    fontFamily:    fontFamily.semiBold,
    fontSize:      10.5,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color:         colors.textMuted,
  },
  keyCardEyebrowReady: { color: colors.green700 },
  keyCardTitle: {
    fontFamily:    fontFamily.bold,
    fontSize:      18,
    color:         colors.textPrimary,
    letterSpacing: -0.3,
  },
  keyCardBody: {
    fontFamily: fontFamily.regular,
    fontSize:   13,
    lineHeight: 19,
    color:      colors.textSecondary,
  },
  keyCardGhost: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing[1] + 1,
    alignSelf:       'flex-start',
    paddingVertical: spacing[2],
    minHeight:       40,
  },
  keyCardGhostText: {
    fontFamily: fontFamily.semiBold,
    fontSize:   12.5,
    color:      colors.green700,
  },

  suggestion: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[3],
    padding:       spacing[3],
    borderRadius:  radius.lg,
    borderWidth:   1,
  },
  suggestionIcon: {
    width:          40,
    height:         40,
    borderRadius:   radius.md,
    alignItems:     'center',
    justifyContent: 'center',
  },
  suggestionText: { flex: 1 },
  suggestionTitle: {
    fontFamily:   fontFamily.semiBold,
    fontSize:     13.5,
    color:        colors.textPrimary,
    marginBottom: 2,
  },
  suggestionTeaser: {
    fontFamily: fontFamily.regular,
    fontSize:   11.5,
    lineHeight: 16,
    color:      colors.textSecondary,
  },

  // ── Sections ──
  section: {
    marginTop:         spacing[7],
    paddingHorizontal: spacing[5],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[2],
    marginBottom:  spacing[3],
  },
  sectionTitle: {
    fontFamily:    fontFamily.bold,
    fontSize:      16,
    color:         colors.textPrimary,
    letterSpacing: -0.2,
  },

  // ── Opened today ──
  openedRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing[3],
  },
  openedCard: {
    flexGrow:     1,
    minWidth:     '46%',
    padding:      spacing[4],
    borderRadius: radius.xl,
    borderWidth:  1,
    gap:          2,
  },
  openedHead: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[2],
    marginBottom:  spacing[1],
  },
  openedIcon: {
    width:          26,
    height:         26,
    borderRadius:   radius.sm,
    alignItems:     'center',
    justifyContent: 'center',
  },
  openedCategory: {
    fontFamily:    fontFamily.medium,
    fontSize:      10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  openedTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize:   12.5,
    color:      colors.textPrimary,
  },
  openedValue: {
    fontFamily:    fontFamily.bold,
    fontSize:      26,
    letterSpacing: -0.7,
  },
  openedUnit: {
    fontFamily: fontFamily.regular,
    fontSize:   10.5,
    color:      colors.textMuted,
  },

  // ── Bridge ──
  bridgeCard: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing[3],
    padding:         spacing[4],
    borderRadius:    radius.xl,
    backgroundColor: colors.white,
    borderWidth:     1,
    borderColor:     colors.border,
  },
  bridgeIcon: {
    width:           42,
    height:          42,
    borderRadius:    radius.md,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: colors.green50,
    borderWidth:     1,
    borderColor:     colors.green100,
  },
  bridgeText: { flex: 1 },
  bridgeContext: {
    fontFamily:   fontFamily.regular,
    fontSize:     11.5,
    lineHeight:   16,
    color:        colors.textSecondary,
    marginBottom: 3,
  },
  bridgeName: {
    fontFamily: fontFamily.semiBold,
    fontSize:   13.5,
    color:      colors.textPrimary,
  },
  bridgeMeta: {
    fontFamily: fontFamily.regular,
    fontSize:   11,
    color:      colors.textMuted,
    marginTop:  1,
  },

  // ── Collection ──
  recentWrap: {
    backgroundColor: colors.white,
    borderRadius:    radius.xl,
    borderWidth:     1,
    borderColor:     colors.border,
    overflow:        'hidden',
  },
  recentRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing[3],
    paddingVertical:   spacing[3],
    paddingHorizontal: spacing[4],
    minHeight:         52,
  },
  recentIcon: {
    width:          30,
    height:         30,
    borderRadius:   radius.sm,
    alignItems:     'center',
    justifyContent: 'center',
  },
  recentTitle: {
    flex:       1,
    fontFamily: fontFamily.medium,
    fontSize:   13,
    color:      colors.textPrimary,
  },
});
