/**
 * Stat detail screen — /numbers/[statId]
 * Full-screen view of a single life stat with:
 *   – Animated count-up big number (same pattern as StatCard)
 *   – Category icon (continuous pulse)
 *   – Description + optional context fact
 *   – Collapsible What-If section
 *   – Share button (captures StatShareCard)
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  runOnJS,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { captureRef } from 'react-native-view-shot';
import { isViewShotAvailable } from '@/utils/viewshot';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { computeLifeStats, formatStatNumber } from '@/engine/statsEngine';
import { STAT_DEFINITIONS } from '@/data/statDefinitions';
import { WhatIfSection } from '@/components/today/WhatIfSection';
import { StatShareCard } from '@/components/today/StatShareCard';
import { useUserStore } from '@/store/userStore';
import { useAllStats } from '@/hooks/useAllStats';
import { colors, spacing, radius, fontFamily, shadow } from '@/theme';
import type { LifeStatsOutput } from '@/engine/statsEngine';

// ─── Category visual config ───────────────────────────────────
const CATEGORY_META: Record<string, { color: string; bg: string; label: string }> = {
  time:   { color: '#5B7FE8', bg: '#EEF1FD', label: 'Time'   },
  body:   { color: '#D94F4F', bg: '#FFF0F0', label: 'Body'   },
  habits: { color: colors.gold,     bg: colors.goldBg,   label: 'Habits' },
  social: { color: colors.green500, bg: colors.green50,  label: 'Social' },
};

// ─── Animated big number ──────────────────────────────────────
function AnimatedBigNumber({
  value,
  precision,
}: {
  value:     number;
  precision: number;
}) {
  const [display, setDisplay] = useState('0');
  const progress = useSharedValue(0);

  const updateDisplay = (v: number) => {
    setDisplay(formatStatNumber(v, precision));
  };

  useAnimatedReaction(
    () => {
      if (precision > 0) {
        const factor = 10 ** precision;
        return Math.round(progress.value * value * factor) / factor;
      }
      return Math.floor(progress.value * value);
    },
    (current, previous) => {
      if (current !== previous) runOnJS(updateDisplay)(current);
    }
  );

  useEffect(() => {
    progress.value = withDelay(
      300,
      withTiming(1, { duration: 1600, easing: Easing.bezier(0.33, 1, 0.68, 1) })
    );
  }, [value]);

  return <Text style={styles.bigNumber}>{display}</Text>;
}

// ─── Animated category icon ───────────────────────────────────
function CategoryIconBig({ icon, category }: { icon: string; category: string }) {
  const meta  = CATEGORY_META[category] ?? { color: colors.green700, bg: colors.green50, label: category };
  const scale = useSharedValue(0.6);
  const pulse = useSharedValue(1);

  useEffect(() => {
    // Entrance
    scale.value = withSpring(1, { stiffness: 220, damping: 20 });
    // Idle pulse
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 1800, easing: Easing.bezier(0.37, 0, 0.63, 1) }),
        withTiming(1.00, { duration: 1800, easing: Easing.bezier(0.37, 0, 0.63, 1) })
      ),
      -1,
      true
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * pulse.value }],
  }));

  return (
    <Animated.View style={[styles.categoryIconBig, { backgroundColor: meta.bg }, style]}>
      <Ionicons name={icon as any} size={26} color={meta.color} />
    </Animated.View>
  );
}

// ─── Screen ───────────────────────────────────────────────────
export default function StatDetailScreen() {
  const { statId }  = useLocalSearchParams<{ statId: string }>();
  const profile      = useUserStore((s) => s.profile);
  const { allStats } = useAllStats();
  const shareCardRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  const definition = STAT_DEFINITIONS.find((d) => d.id === statId);
  const lifeStats  = profile ? computeLifeStats(profile) : null;
  const value      = lifeStats && definition
    ? ((lifeStats[definition.formulaKey as keyof LifeStatsOutput] as number) ?? 0)
    : 0;

  const statWithStatus = allStats.find((s) => s.definition.id === statId);
  const unlockedDate   = statWithStatus?.unlockedDate ?? null;
  const catMeta        = definition ? (CATEGORY_META[definition.category] ?? { color: colors.green700, bg: colors.green50, label: definition.category }) : null;

  // Related stats — same category, unlocked, not this one
  const relatedStats = allStats
    .filter((s) =>
      s.definition.id !== statId &&
      s.definition.category === definition?.category &&
      s.status !== 'locked'
    )
    .slice(0, 3);

  // ── Entrance animations ──
  const heroOp  = useSharedValue(0);
  const heroY   = useSharedValue(20);
  const card1Op = useSharedValue(0);
  const card2Op = useSharedValue(0);
  const card3Op = useSharedValue(0);

  useEffect(() => {
    heroOp.value  = withTiming(1,   { duration: 360 });
    heroY.value   = withSpring(0,   { stiffness: 200, damping: 18 });
    card1Op.value = withDelay(280,  withTiming(1, { duration: 320 }));
    card2Op.value = withDelay(420,  withTiming(1, { duration: 320 }));
    card3Op.value = withDelay(560,  withTiming(1, { duration: 320 }));
  }, []);

  const heroStyle  = useAnimatedStyle(() => ({
    opacity:   heroOp.value,
    transform: [{ translateY: heroY.value }],
  }));
  const card1Style = useAnimatedStyle(() => ({ opacity: card1Op.value }));
  const card2Style = useAnimatedStyle(() => ({ opacity: card2Op.value }));
  const card3Style = useAnimatedStyle(() => ({ opacity: card3Op.value }));

  // ── Share ──────────────────────────────────────────────────
  const handleShare = async () => {
    if (!shareCardRef.current || sharing) return;
    if (!isViewShotAvailable) {
      Alert.alert(
        'Not available in Expo Go',
        'Share cards require a development build. Run `npx expo run:android` or `npx expo run:ios` to enable.'
      );
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      setSharing(true);
      const uri = await captureRef(shareCardRef, { format: 'png', quality: 1 });
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: `${definition?.title ?? 'Stat'} — Gati`,
      });
    } catch (_) {
      // User dismissed share sheet — no error
    } finally {
      setSharing(false);
    }
  };

  // ── Back press ────────────────────────────────────────────
  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  if (!definition || !profile) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <Pressable onPress={handleBack} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </Pressable>
        </View>
        <View style={styles.notFound}>
          <Ionicons name="help-circle-outline" size={36} color={colors.green300} />
          <Text style={styles.notFoundText}>Stat not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <Pressable
          onPress={handleBack}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          <Text style={styles.backLabel}>Numbers</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero section ── */}
        <Animated.View style={[styles.heroCard, heroStyle]}>
          {/* Category badge row */}
          <View style={styles.categoryBadgeRow}>
            <View style={[styles.categoryBadge, { backgroundColor: catMeta?.bg }]}>
              <Ionicons
                name={definition.icon as any}
                size={12}
                color={catMeta?.color}
              />
              <Text style={[styles.categoryBadgeText, { color: catMeta?.color }]}>
                {catMeta?.label}
              </Text>
            </View>
            {unlockedDate && (
              <Text style={styles.unlockDate}>
                Unlocked {format(parseISO(unlockedDate), 'MMM d, yyyy')}
              </Text>
            )}
          </View>

          {/* Icon + number */}
          <View style={styles.heroCenter}>
            <CategoryIconBig icon={definition.icon} category={definition.category} />
            <AnimatedBigNumber value={value} precision={definition.precision} />
            <Text style={styles.unitLabel}>{definition.unit}</Text>
          </View>

          {/* Stat title */}
          <Text style={styles.statTitle}>{definition.title}</Text>
        </Animated.View>

        {/* ── Description card ── */}
        <Animated.View style={[styles.card, card1Style]}>
          <View style={styles.cardHeader}>
            <Ionicons name="book-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.cardHeaderText}>About this stat</Text>
          </View>
          <Text style={styles.descriptionText}>{definition.description}</Text>

          {/* Context fact */}
          {definition.contextFact && (
            <View style={styles.factBlock}>
              <View style={styles.factIconRow}>
                <Ionicons name="information-circle-outline" size={14} color={colors.green700} />
                <Text style={styles.factLabel}>Did you know?</Text>
              </View>
              <Text style={styles.factText}>{definition.contextFact}</Text>
            </View>
          )}
        </Animated.View>

        {/* ── What-If section ── */}
        {definition.whatIfKeys && definition.whatIfKeys.length > 0 && lifeStats && (
          <Animated.View style={[styles.card, card2Style]}>
            <WhatIfSection
              stats={lifeStats}
              profile={profile}
              whatIfKeys={definition.whatIfKeys}
            />
          </Animated.View>
        )}

        {/* ── Share button ── */}
        <Animated.View style={card2Style}>
          <Pressable
            onPress={handleShare}
            disabled={sharing}
            style={({ pressed }) => [
              styles.shareBtn,
              pressed && styles.shareBtnPressed,
            ]}
          >
            <Ionicons
              name={sharing ? 'hourglass-outline' : 'share-outline'}
              size={18}
              color={colors.white}
            />
            <Text style={styles.shareBtnText}>
              {sharing ? 'Preparing…' : 'Share this stat'}
            </Text>
          </Pressable>
        </Animated.View>

        {/* ── Related stats ── */}
        {relatedStats.length > 0 && (
          <Animated.View style={[styles.relatedSection, card3Style]}>
            <View style={styles.cardHeader}>
              <Ionicons name="grid-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.cardHeaderText}>
                More {catMeta?.label?.toLowerCase()} stats
              </Text>
            </View>
            {relatedStats.map((s) => (
              <Pressable
                key={s.definition.id}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.replace({
                    pathname: '/(tabs)/numbers/[statId]',
                    params: { statId: s.definition.id },
                  });
                }}
                style={({ pressed }) => [
                  styles.relatedRow,
                  pressed && { opacity: 0.75 },
                ]}
              >
                <View style={[styles.relatedIcon, { backgroundColor: catMeta?.bg }]}>
                  <Ionicons
                    name={s.definition.icon as any}
                    size={16}
                    color={catMeta?.color}
                  />
                </View>
                <Text style={styles.relatedTitle} numberOfLines={1}>
                  {s.definition.title}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
              </Pressable>
            ))}
          </Animated.View>
        )}

        <View style={{ height: spacing[12] }} />
      </ScrollView>

      {/* ── Off-screen share card ── */}
      <StatShareCard ref={shareCardRef} definition={definition} value={value} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.background,
  },

  // ── Top bar ──
  topBar: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing[4],
    paddingVertical:   spacing[3],
  },
  backBtn: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[2],
  },
  backBtnPressed: {
    opacity: 0.65,
  },
  backLabel: {
    fontFamily: fontFamily.medium,
    fontSize:   15,
    color:      colors.textPrimary,
  },

  scroll:  { flex: 1 },
  content: {
    paddingHorizontal: spacing[5],
    paddingBottom:     spacing[8],
  },

  // ── Hero card ──
  heroCard: {
    backgroundColor: colors.white,
    borderRadius:    radius.xl,
    borderWidth:     1,
    borderColor:     colors.border,
    padding:         spacing[5],
    marginBottom:    spacing[4],
    alignItems:      'center',
    ...shadow.md,
  },
  categoryBadgeRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    width:          '100%',
    marginBottom:   spacing[4],
  },
  categoryBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing[1] + 1,
    paddingVertical:   spacing[1] + 2,
    paddingHorizontal: spacing[3],
    borderRadius:      radius.full,
  },
  categoryBadgeText: {
    fontFamily:    fontFamily.semiBold,
    fontSize:      11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  unlockDate: {
    fontFamily: fontFamily.regular,
    fontSize:   12,
    color:      colors.textMuted,
  },
  heroCenter: {
    alignItems:   'center',
    marginBottom: spacing[4],
    gap:          spacing[2],
  },
  categoryIconBig: {
    width:           72,
    height:          72,
    borderRadius:    radius.xl,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    spacing[2],
  },
  bigNumber: {
    fontFamily:    fontFamily.extraBold,
    fontSize:      52,
    color:         colors.textPrimary,
    letterSpacing: -2,
    lineHeight:    56,
    textAlign:     'center',
  },
  unitLabel: {
    fontFamily: fontFamily.medium,
    fontSize:   15,
    color:      colors.textSecondary,
  },
  statTitle: {
    fontFamily:    fontFamily.bold,
    fontSize:      20,
    color:         colors.textPrimary,
    letterSpacing: -0.3,
    textAlign:     'center',
  },

  // ── Info cards ──
  card: {
    backgroundColor: colors.white,
    borderRadius:    radius.xl,
    borderWidth:     1,
    borderColor:     colors.border,
    padding:         spacing[4],
    marginBottom:    spacing[4],
    ...shadow.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[2],
    marginBottom:  spacing[3],
  },
  cardHeaderText: {
    fontFamily:    fontFamily.semiBold,
    fontSize:      12,
    color:         colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  descriptionText: {
    fontFamily: fontFamily.regular,
    fontSize:   15,
    color:      colors.textPrimary,
    lineHeight: 23,
  },

  // ── Fact block ──
  factBlock: {
    marginTop:       spacing[4],
    paddingTop:      spacing[4],
    borderTopWidth:  1,
    borderTopColor:  colors.borderLight,
  },
  factIconRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[1] + 1,
    marginBottom:  spacing[2],
  },
  factLabel: {
    fontFamily:    fontFamily.semiBold,
    fontSize:      12,
    color:         colors.green700,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  factText: {
    fontFamily: fontFamily.regular,
    fontSize:   13,
    color:      colors.textSecondary,
    lineHeight: 20,
  },

  // ── Share button ──
  shareBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             spacing[2],
    backgroundColor: colors.green700,
    borderRadius:    radius.xl,
    paddingVertical: spacing[5],
    marginBottom:    spacing[4],
    elevation:       4,
    shadowColor:     colors.green900,
    shadowOffset:    { width: 0, height: 3 },
    shadowOpacity:   0.14,
    shadowRadius:    8,
  },
  shareBtnPressed: {
    opacity:   0.88,
    transform: [{ scale: 0.98 }],
  },
  shareBtnText: {
    fontFamily:    fontFamily.bold,
    fontSize:      16,
    color:         colors.white,
    letterSpacing: 0.2,
  },

  // ── Related stats ──
  relatedSection: {
    backgroundColor: colors.white,
    borderRadius:    radius.xl,
    borderWidth:     1,
    borderColor:     colors.border,
    padding:         spacing[4],
    marginBottom:    spacing[4],
    ...shadow.xs,
  },
  relatedRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[3],
    paddingVertical: spacing[2] + 2,
  },
  relatedIcon: {
    width:           36,
    height:          36,
    borderRadius:    radius.sm,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  relatedTitle: {
    flex:       1,
    fontFamily: fontFamily.semiBold,
    fontSize:   14,
    color:      colors.textPrimary,
  },

  // ── Not found ──
  notFound: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            spacing[3],
  },
  notFoundText: {
    fontFamily: fontFamily.medium,
    fontSize:   16,
    color:      colors.textMuted,
  },
});
