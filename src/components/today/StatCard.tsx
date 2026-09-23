/**
 * Hero Stat Card for the Today screen.
 * Features:
 *  - Static category icon (no idle pulse)
 *  - UI-thread count-up (CountUpText — zero JS re-renders during animation)
 *  - Spring card entrance
 *  - Embedded WhatIfSection (collapsible, shuffled what-ifs)
 *  - Share + bookmark actions with spring-bounce icons
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Pressable, StyleSheet, Alert } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import { isViewShotAvailable } from '@/utils/viewshot';
import * as Sharing from 'expo-sharing';
import { WhatIfSection } from './WhatIfSection';
import { CountUpText } from '@/components/ui';
import { useStatsStore } from '@/store/userStore';
import type { StatDef } from '@/data/statDefinitions';
import type { LifeStatsOutput } from '@/engine/statsEngine';
import type { UserProfile } from '@/types';
import { colors, spacing, radius, shadow, fontFamily, getCategoryTheme } from '@/theme';
import { Text } from '@/components/ui/Text';
import { useEntrance } from '@/hooks/useEntrance';

// ─── Category icon (static — no idle pulse) ───────────────────
function CategoryIcon({ icon, color }: { icon: string; color: string }) {
  return <Ionicons name={icon as any} size={18} color={color} />;
}

/** Shrink the hero number as digits grow so it never clips. */
function heroFontSize(value: number, precision: number): number {
  const len = (precision > 0
    ? value.toFixed(precision)
    : Math.floor(value).toLocaleString('en-US')
  ).length;
  if (len <= 6)  return 60;
  if (len <= 9)  return 49;
  if (len <= 12) return 41;
  return 34;
}

// ─── Spring-bounce action button ─────────────────────────────
function ActionButton({
  icon,
  label,
  onPress,
  active,
  color,
}: {
  icon:    string;
  label:   string;
  onPress: () => void;
  active?: boolean;
  color?:  string;
}) {
  const scale = useSharedValue(1);

  const iconColor = active ? (color ?? colors.green700) : colors.textMuted;

  const handlePress = () => {
    scale.value = withSequence(
      withTiming(0.78, { duration: 80 }),
      withSpring(1,    { stiffness: 300, damping: 25 })
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPress={handlePress}
      style={styles.actionBtn}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Animated.View style={style}>
        <Ionicons name={(active ? icon.replace('-outline', '') : icon) as any} size={22} color={iconColor} />
      </Animated.View>
      <Text style={[styles.actionLabel, active && { color: iconColor }]} maxFontSizeMultiplier={1.2}>{label}</Text>
    </Pressable>
  );
}

// ─── Main StatCard ────────────────────────────────────────────
interface StatCardProps {
  definition:   StatDef;
  value:        number;
  stats:        LifeStatsOutput;
  profile:      UserProfile;
  isNewUnlock:  boolean;
  shareCardRef?: React.RefObject<View>;
}

export function StatCard({
  definition,
  value,
  stats,
  profile,
  isNewUnlock,
  shareCardRef,
}: StatCardProps) {
  const cat            = getCategoryTheme(definition.category);
  const savedStatIds   = useStatsStore((s) => s.savedStatIds);
  const toggleSavedStat = useStatsStore((s) => s.toggleSavedStat);
  const saved          = savedStatIds.includes(definition.id);
  const [sharing, setSharing]       = React.useState(false);
  // Show the share nudge once per stat, ~1.8 s after the count-up settles
  const [showNudge, setShowNudge]   = React.useState(false);
  const nudgeOpacity                = useSharedValue(0);

  // Pick a comparison seeded by definition.id so it's stable per session
  // but rotates across different stats (not truly random — same on re-render)
  const comparison = useMemo(() => {
    const pool = definition.comparisons;
    if (!pool || pool.length === 0) return null;
    const seed = definition.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return pool[seed % pool.length];
  }, [definition.id]);

  // ── Card entrance ──
  const cardStyle    = useEntrance({ duration: 360, scale: 0.92 });
  const contentStyle = useEntrance({ delay: 200, duration: 400 });

  // Reset the nudge during render when the card switches to another stat.
  // React's "adjusting state when a prop changes" pattern — the previous
  // synchronous `setShowNudge(false)` inside the effect cascaded an extra
  // render every time the expanded stat changed.
  const [lastDefId, setLastDefId] = useState(definition.id);
  if (definition.id !== lastDefId) {
    setLastDefId(definition.id);
    setShowNudge(false);
  }

  useEffect(() => {
    nudgeOpacity.value = 0;
    const timer = setTimeout(() => setShowNudge(true), 1_800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definition.id]);

  // Start fade-in AFTER showNudge flips true so the Animated.View is
  // mounted before the animation begins (avoids mid-animation mount race).
  // Auto-dismiss after 6 s so the nudge never coexists with the Share action button.
  useEffect(() => {
    if (!showNudge) return;
    nudgeOpacity.value = withTiming(1, { duration: 500 });
    const dismissTimer = setTimeout(() => {
      nudgeOpacity.value = withTiming(0, { duration: 400 });
      // Unmount after fade completes so the View is gone before Share is used
      setTimeout(() => setShowNudge(false), 420);
    }, 6_000);
    return () => clearTimeout(dismissTimer);
  }, [showNudge]);

  const nudgeStyle   = useAnimatedStyle(() => ({
    opacity:   nudgeOpacity.value,
    transform: [{ translateY: (1 - nudgeOpacity.value) * 6 }],
  }));

  // ── Share ──
  const handleShare = async () => {
    if (sharing || !shareCardRef?.current) return;
    if (!isViewShotAvailable) {
      Alert.alert(
        'Not available in Expo Go',
        'Share cards require a development build. Run `npx expo run:android` or `npx expo run:ios` to enable.'
      );
      return;
    }
    setSharing(true);
    try {
      const uri = await captureRef(shareCardRef, { format: 'png', quality: 1 });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your Gati stat' });
    } catch (_) { /* sharing cancelled or failed */ }
    setSharing(false);
  };

  const handleSave = () => toggleSavedStat(definition.id);

  return (
    <Animated.View style={[styles.card, cardStyle]}>
      {/* Category row */}
      <Animated.View style={[styles.categoryRow, contentStyle]}>
        <CategoryIcon icon={cat.iconOutline} color={cat.accent} />
        <Text style={[styles.categoryLabel, { color: cat.accent }]}>{cat.label}</Text>
      </Animated.View>

      {/* Big number — animated on the UI thread, no re-renders */}
      <View
        style={styles.numberBlock}
        accessible
        accessibilityLabel={`${value.toLocaleString('en-US')} ${definition.unit}`}
      >
        <CountUpText
          value={value}
          precision={definition.precision}
          duration={1400}
          delay={isNewUnlock ? 700 : 400}
          animateKey={definition.id}
          style={[
            styles.bigNumber,
            { fontSize: heroFontSize(value, definition.precision) },
          ]}
        />
        <Text style={styles.unitLabel} maxFontSizeMultiplier={1.2}>{definition.unit}</Text>
      </View>

      {/* Share nudge — fades in after count-up settles */}
      {showNudge && (
        <Animated.View style={[styles.shareNudge, nudgeStyle]}>
          <Pressable
            style={styles.shareNudgeInner}
            onPress={handleShare}
            accessibilityRole="button"
            accessibilityLabel="Surprised? Show someone"
          >
            <Ionicons name="share-social-outline" size={13} color={colors.green700} />
            <Text style={styles.shareNudgeText}>Surprised? Show someone</Text>
            <Ionicons name="chevron-forward" size={12} color={colors.green700} />
          </Pressable>
        </Animated.View>
      )}

      {/* Stat title + description */}
      <Animated.View style={contentStyle}>
        <Text style={styles.statTitle} maxFontSizeMultiplier={1.3}>{definition.title}</Text>
        <Text style={styles.statDesc} maxFontSizeMultiplier={1.3}>{definition.description}</Text>
        {comparison && (
          <View style={styles.comparisonRow}>
            <Ionicons name="sparkles-outline" size={11} color={colors.green500} />
            <Text style={styles.comparisonText} maxFontSizeMultiplier={1.2}>{comparison}</Text>
          </View>
        )}
      </Animated.View>

      {/* What-If section */}
      {definition.whatIfKeys && definition.whatIfKeys.length > 0 ? (
        <Animated.View style={contentStyle}>
          <WhatIfSection
            stats={stats}
            profile={profile}
            whatIfKeys={definition.whatIfKeys}
          />
        </Animated.View>
      ) : (
        <View style={styles.dividerOnly}>
          <View style={styles.divider} />
        </View>
      )}

      {/* Action row */}
      <View style={styles.actionRow}>
        <ActionButton
          icon="share-social-outline"
          label={sharing ? 'Sharing…' : 'Share'}
          onPress={handleShare}
        />
        <ActionButton
          icon="bookmark-outline"
          label={saved ? 'Saved' : 'Save'}
          onPress={handleSave}
          active={saved}
          color={colors.green700}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius:    radius.xl,
    borderWidth:     1,
    borderColor:     colors.border,
    marginHorizontal: spacing[5],
    padding:         spacing[5],
    ...shadow.lg,
  },

  // Category
  categoryRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            spacing[2],
    marginBottom:   spacing[5],
  },
  categoryLabel: {
    fontFamily:    fontFamily.semiBold,
    fontSize:      11.5,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  // Number
  numberBlock: {
    marginBottom: spacing[4],
  },
  bigNumber: {
    fontFamily:    fontFamily.extraBold,
    color:         colors.textPrimary,
    letterSpacing: -2,
  },
  unitLabel: {
    fontFamily:   fontFamily.medium,
    fontSize:     15,
    color:        colors.textMuted,
    marginTop:    -spacing[1],
    marginBottom: spacing[1],
  },

  // Stat copy
  statTitle: {
    fontFamily:   fontFamily.bold,
    fontSize:     19,
    color:        colors.textPrimary,
    marginBottom: spacing[2],
    letterSpacing: -0.3,
  },
  statDesc: {
    fontFamily: fontFamily.regular,
    fontSize:   13,
    color:      colors.textSecondary,
    lineHeight: 19.5,
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           spacing[2],
    marginTop:     spacing[3],
    paddingTop:    spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  comparisonText: {
    flex:       1,
    fontFamily: fontFamily.regular,
    fontSize:   12,
    color:      colors.textMuted,
    lineHeight: 17,
    fontStyle:  'italic',
  },

  // Share nudge
  shareNudge: {
    marginBottom: spacing[3],
  },
  shareNudgeInner: {
    flexDirection:   'row',
    alignItems:      'center',
    alignSelf:       'flex-start',
    gap:             spacing[2],
    backgroundColor: colors.green50,
    borderRadius:    radius.full,
    paddingVertical:  spacing[2],
    paddingHorizontal: spacing[3] + 2,
    borderWidth:     1,
    borderColor:     colors.green100,
  },
  shareNudgeText: {
    fontFamily: fontFamily.semiBold,
    fontSize:   12,
    color:      colors.green700,
  },

  dividerOnly: { marginTop: spacing[4] },
  divider: {
    height:          1,
    backgroundColor: colors.borderLight,
  },

  // Actions
  actionRow: {
    flexDirection: 'row',
    marginTop:     spacing[4],
    gap:           spacing[2],
  },
  actionBtn: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             spacing[2],
    paddingVertical: spacing[3],
    borderRadius:    radius.lg,
    backgroundColor: colors.surface2,
    borderWidth:     1,
    borderColor:     colors.borderLight,
  },
  actionLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize:   13,
    color:      colors.textMuted,
  },
});
