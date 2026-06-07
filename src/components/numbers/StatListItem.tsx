/**
 * A single row in the Numbers stat list.
 * Three visual states: today | unlocked | locked
 *
 * today    — pulsing green border, tap → navigate to detail
 * unlocked — white card, compact value, tap → navigate to detail
 * locked   — dimmed, lock icon, countdown badge, not tappable
 */
import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { formatStatCompact } from '@/engine/statsEngine';
import type { StatWithStatus } from '@/hooks/useAllStats';
import { colors, spacing, radius, fontFamily, shadow } from '@/theme';

// ─── Category visual config ───────────────────────────────────
const CATEGORY_META: Record<string, { color: string; bg: string; icon: string }> = {
  time:   { color: '#5B7FE8', bg: '#EEF1FD', icon: 'time-outline'             },
  body:   { color: '#D94F4F', bg: '#FFF0F0', icon: 'heart-outline'            },
  habits: { color: colors.gold, bg: colors.goldBg, icon: 'cafe-outline'       },
  social: { color: colors.green500, bg: colors.green50, icon: 'people-outline' },
};

// ─── Animated category icon pill ─────────────────────────────
function CategoryIconPill({ category, icon }: { category: string; icon: string }) {
  const meta  = CATEGORY_META[category] ?? { color: colors.green700, bg: colors.green50, icon };
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.10, { duration: 1600, easing: Easing.bezier(0.37, 0, 0.63, 1) }),
        withTiming(1.00, { duration: 1600, easing: Easing.bezier(0.37, 0, 0.63, 1) })
      ),
      -1,
      true
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={[styles.iconPill, { backgroundColor: meta.bg }]}>
      <Animated.View style={style}>
        <Ionicons name={icon as any} size={18} color={meta.color} />
      </Animated.View>
    </View>
  );
}

// ─── Today badge ──────────────────────────────────────────────
function TodayBadge() {
  const scale   = useSharedValue(0.85);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value   = withSpring(1, { stiffness: 300, damping: 25 });
    opacity.value = withTiming(1, { duration: 280 });
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.todayBadge, style]}>
      <Text style={styles.todayBadgeText}>TODAY</Text>
    </Animated.View>
  );
}

// ─── Main component ───────────────────────────────────────────
interface StatListItemProps {
  item:    StatWithStatus;
  index:   number;
}

export function StatListItem({ item, index }: StatListItemProps) {
  const { definition, status, value, daysUntil, unlockedDate } = item;

  // ── Entrance animation (staggered) ────────────────────────
  const enterOp = useSharedValue(0);
  const enterY  = useSharedValue(16);

  useEffect(() => {
    const delay = Math.min(index, 10) * 55;
    enterOp.value = withDelay(delay, withTiming(1, { duration: 300 }));
    enterY.value  = withDelay(delay, withSpring(0, { stiffness: 220, damping: 20 }));
  }, [index]);

  const enterStyle = useAnimatedStyle(() => ({
    opacity:   enterOp.value,
    transform: [{ translateY: enterY.value }],
  }));

  // ── Press scale ────────────────────────────────────────────
  const pressScale = useSharedValue(1);

  // ── Lock icon pulse (top-level — hooks must not be conditional) ──
  const lockScale = useSharedValue(1);
  useEffect(() => {
    if (status !== 'locked') return;
    lockScale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 2000, easing: Easing.bezier(0.37, 0, 0.63, 1) }),
        withTiming(0.96, { duration: 2000, easing: Easing.bezier(0.37, 0, 0.63, 1) })
      ),
      -1,
      true
    );
  }, [status]);
  const lockIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: lockScale.value }],
  }));

  const handlePressIn  = () => {
    if (status === 'locked') return;
    pressScale.value = withSpring(0.97, { stiffness: 500, damping: 22 });
  };
  const handlePressOut = () => {
    pressScale.value = withSpring(1, { stiffness: 300, damping: 25 });
  };
  const handlePress = () => {
    if (status === 'locked') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Bounce → then navigate
    pressScale.value = withSequence(
      withSpring(0.96, { stiffness: 500, damping: 20 }),
      withSpring(1.02, { stiffness: 340, damping: 14 }),
      withSpring(1.00, { stiffness: 260, damping: 18 })
    );
    setTimeout(() => {
      router.push({ pathname: '/(tabs)/numbers/[statId]', params: { statId: definition.id } });
    }, 120);
  };

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  // ── Pulsing border for today's stat ───────────────────────
  const borderOpacity = useSharedValue(0.5);
  useEffect(() => {
    if (status !== 'today') return;
    borderOpacity.value = withRepeat(
      withSequence(
        withTiming(1,   { duration: 900,  easing: Easing.bezier(0.37, 0, 0.63, 1) }),
        withTiming(0.3, { duration: 900,  easing: Easing.bezier(0.37, 0, 0.63, 1) })
      ),
      -1,
      true
    );
  }, [status]);

  const borderStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(42,125,79,${borderOpacity.value})`,
  }));

  // ─────────────────────────────────────────────────────────────
  // TODAY STATE
  // ─────────────────────────────────────────────────────────────
  if (status === 'today') {
    return (
      <Animated.View style={[enterStyle, pressStyle]}>
        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={handlePress}
          android_ripple={{ color: colors.green50 }}
          accessibilityRole="button"
          accessibilityLabel={`${definition.title} — today's stat`}
          accessibilityHint="Tap to view your stat"
        >
          <Animated.View style={[styles.cardToday, borderStyle]}>
            {/* Top row */}
            <View style={styles.todayTopRow}>
              <View style={styles.todayCategoryRow}>
                <CategoryIconPill category={definition.category} icon={definition.icon} />
                <Text style={styles.todayCategoryLabel}>
                  {definition.category.charAt(0).toUpperCase() + definition.category.slice(1)}
                </Text>
              </View>
              <TodayBadge />
            </View>

            {/* Title */}
            <Text style={styles.todayTitle}>{definition.title}</Text>
            <Text style={styles.todayDesc} numberOfLines={2}>
              {definition.description}
            </Text>

            {/* CTA */}
            <View style={styles.todayCta}>
              <View style={styles.todayCtaInner}>
                <Ionicons name="eye-outline" size={14} color={colors.green700} />
                <Text style={styles.todayCtaText}>Tap to view your stat</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.green700} />
            </View>
          </Animated.View>
        </Pressable>
      </Animated.View>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // LOCKED STATE
  // ─────────────────────────────────────────────────────────────
  if (status === 'locked') {
    return (
      <Animated.View style={[enterStyle, styles.cardLockedOuter]}>
        {/* Underlying content (blurred/dimmed) */}
        <View style={styles.cardLockedContent}>
          <View style={styles.lockedIconPill}>
            <Ionicons name="apps-outline" size={17} color={colors.textMuted} />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.lockedTitle} numberOfLines={1}>{definition.title}</Text>
            <Text style={styles.lockedDesc} numberOfLines={1}>{definition.description}</Text>
          </View>
        </View>

        {/* Frosted overlay */}
        <View style={styles.frostedOverlay}>
          <Animated.View style={[styles.lockBadge, lockIconStyle]}>
            <Ionicons name="lock-closed" size={13} color={colors.textMuted} />
          </Animated.View>
          <Text style={styles.countdownText}>
            {daysUntil === 1 ? 'Unlocks tomorrow' : `Unlocks in ${daysUntil} days`}
          </Text>
        </View>
      </Animated.View>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // UNLOCKED STATE
  // ─────────────────────────────────────────────────────────────
  const compact       = formatStatCompact(value);
  const unlockDateStr = unlockedDate
    ? format(parseISO(unlockedDate), 'MMM d')
    : '';

  return (
    <Animated.View style={[enterStyle, pressStyle]}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        android_ripple={{ color: colors.green50 }}
        style={styles.cardUnlocked}
        accessibilityRole="button"
        accessibilityLabel={`${definition.title}, ${compact} ${definition.unit}`}
        accessibilityHint="Tap to see full details"
      >
        {/* Icon */}
        <CategoryIconPill category={definition.category} icon={definition.icon} />

        {/* Text */}
        <View style={styles.rowText}>
          <Text style={styles.unlockedTitle} numberOfLines={1}>{definition.title}</Text>
          <Text style={styles.unlockedDate}>{unlockDateStr}</Text>
        </View>

        {/* Value */}
        <View style={styles.valueBlock}>
          <Text style={styles.valueFigure} numberOfLines={1} adjustsFontSizeToFit>
            {compact}
          </Text>
          <Text style={styles.valueUnit} numberOfLines={1}>{definition.unit}</Text>
        </View>

        {/* Chevron */}
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </Pressable>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  // ── Today ──
  cardToday: {
    backgroundColor: colors.white,
    borderRadius:    radius.xl,
    borderWidth:     2,
    borderColor:     colors.green700,
    padding:         spacing[4],
    marginBottom:    spacing[3],
    ...shadow.sm,
  },
  todayTopRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   spacing[3],
  },
  todayCategoryRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[2],
  },
  todayCategoryLabel: {
    fontFamily:    fontFamily.semiBold,
    fontSize:      12,
    color:         colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  todayBadge: {
    paddingVertical:   spacing[1],
    paddingHorizontal: spacing[3],
    borderRadius:      radius.full,
    backgroundColor:   colors.green700,
  },
  todayBadgeText: {
    fontFamily:    fontFamily.bold,
    fontSize:      10,
    color:         colors.white,
    letterSpacing: 0.8,
  },
  todayTitle: {
    fontFamily:   fontFamily.bold,
    fontSize:     18,
    color:        colors.textPrimary,
    letterSpacing: -0.3,
    marginBottom: spacing[1],
  },
  todayDesc: {
    fontFamily:   fontFamily.regular,
    fontSize:     13,
    color:        colors.textSecondary,
    lineHeight:   19,
    marginBottom: spacing[4],
  },
  todayCta: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingTop:     spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.green100,
  },
  todayCtaInner: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[2],
  },
  todayCtaText: {
    fontFamily: fontFamily.semiBold,
    fontSize:   13,
    color:      colors.green700,
  },

  // ── Icon pill (shared) ──
  iconPill: {
    width:           44,
    height:          44,
    borderRadius:    radius.md,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },

  // ── Unlocked ──
  cardUnlocked: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: colors.white,
    borderRadius:    radius.xl,
    borderWidth:     1,
    borderColor:     colors.border,
    padding:         spacing[3] + 2,
    gap:             spacing[3],
    marginBottom:    spacing[2] + 2,
    ...shadow.xs,
  },
  rowText: {
    flex:    1,
    gap:     2,
  },
  unlockedTitle: {
    fontFamily:    fontFamily.semiBold,
    fontSize:      14,
    color:         colors.textPrimary,
    letterSpacing: -0.1,
  },
  unlockedDate: {
    fontFamily: fontFamily.regular,
    fontSize:   12,
    color:      colors.textMuted,
  },
  valueBlock: {
    alignItems: 'flex-end',
    flexShrink: 0,
    maxWidth:   80,
  },
  valueFigure: {
    fontFamily:    fontFamily.bold,
    fontSize:      15,
    color:         colors.green700,
    letterSpacing: -0.3,
  },
  valueUnit: {
    fontFamily: fontFamily.regular,
    fontSize:   11,
    color:      colors.textMuted,
  },

  // ── Locked ──
  cardLockedOuter: {
    borderRadius:  radius.xl,
    borderWidth:   1,
    borderColor:   colors.borderLight,
    marginBottom:  spacing[2] + 2,
    overflow:      'hidden',
    position:      'relative',
  },
  cardLockedContent: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: colors.white,
    padding:         spacing[3] + 2,
    gap:             spacing[3],
    opacity:         0.28,
  },
  lockedIconPill: {
    width:           44,
    height:          44,
    borderRadius:    radius.md,
    backgroundColor: colors.borderLight,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  lockedTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize:   14,
    color:      colors.textSecondary,
  },
  lockedDesc: {
    fontFamily: fontFamily.regular,
    fontSize:   12,
    color:      colors.textSecondary,
  },
  // Frosted overlay — semi-transparent white layer over content
  frostedOverlay: {
    position:          'absolute',
    top:               0,
    left:              0,
    right:             0,
    bottom:            0,
    backgroundColor:   'rgba(245,245,238,0.82)',
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing[3] + 2,
    gap:               spacing[2],
  },
  lockBadge: {
    width:           28,
    height:          28,
    borderRadius:    radius.md,
    backgroundColor: colors.borderLight,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  countdownText: {
    fontFamily: fontFamily.medium,
    fontSize:   13,
    color:      colors.textMuted,
    flex:       1,
  },
});
