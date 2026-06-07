/**
 * Hero Stat Card for the Today screen.
 * Features:
 *  - Animated category icon (continuous gentle pulse)
 *  - Animated count-up for the stat number (useAnimatedReaction + runOnJS)
 *  - Spring card entrance
 *  - Embedded WhatIfSection (collapsible)
 *  - Share + bookmark actions with spring-bounce icons
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import { isViewShotAvailable } from '@/utils/viewshot';
import * as Sharing from 'expo-sharing';
import { WhatIfSection } from './WhatIfSection';
import { formatStatNumber } from '@/engine/statsEngine';
import type { StatDef } from '@/data/statDefinitions';
import type { LifeStatsOutput } from '@/engine/statsEngine';
import type { UserProfile } from '@/types';
import { colors, spacing, radius, shadow, fontFamily } from '@/theme';

// ─── Category config ──────────────────────────────────────────
const CATEGORY_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  time:    { label: 'Time',    icon: 'hourglass-outline',  color: '#6B7FD7' },
  body:    { label: 'Body',    icon: 'heart-outline',      color: '#D96B6B' },
  habits:  { label: 'Habits',  icon: 'repeat-outline',     color: colors.green700 },
  social:  { label: 'Social',  icon: 'people-outline',     color: '#E8A020' },
  money:   { label: 'Money',   icon: 'wallet-outline',     color: colors.gold },
};

// ─── Animated category icon ───────────────────────────────────
function CategoryIcon({ icon, color }: { icon: string; color: string }) {
  const scale = useSharedValue(1);

  useEffect(() => {
    // Gentle continuous pulse — slower and subtler than heartbeat
    scale.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 1800, easing: Easing.bezier(0.37, 0, 0.63, 1) }),
        withTiming(1.00, { duration: 1800, easing: Easing.bezier(0.37, 0, 0.63, 1) })
      ),
      -1,
      true
    );
  }, []);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={style}>
      <Ionicons name={icon as any} size={18} color={color} />
    </Animated.View>
  );
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
  shareCardRef: React.RefObject<View>;
}

export function StatCard({
  definition,
  value,
  stats,
  profile,
  isNewUnlock,
  shareCardRef,
}: StatCardProps) {
  const cat     = CATEGORY_CONFIG[definition.category] ?? CATEGORY_CONFIG.habits;
  const [displayValue, setDisplayValue] = useState(0);
  const [saved, setSaved]               = useState(false);
  const [sharing, setSharing]           = useState(false);

  // ── Card entrance ──
  const cardScale   = useSharedValue(0.92);
  const cardOpacity = useSharedValue(0);
  const contentOp   = useSharedValue(0);

  useEffect(() => {
    cardScale.value   = withSpring(1, { stiffness: 200, damping: 20 });
    cardOpacity.value = withTiming(1, { duration: 360 });
    contentOp.value   = withDelay(200, withTiming(1, { duration: 400 }));
  }, [definition.id]);

  const cardStyle    = useAnimatedStyle(() => ({
    opacity:   cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));
  const contentStyle = useAnimatedStyle(() => ({ opacity: contentOp.value }));

  // ── Count-up animation ────────────────────────────────────
  const progress = useSharedValue(0);

  // runOnJS bridge: update React state from the animation thread
  const updateDisplay = useCallback((v: number) => setDisplayValue(v), []);

  useAnimatedReaction(
    () => {
      if (definition.precision > 0) {
        const factor = 10 ** definition.precision;
        return Math.round(progress.value * value * factor) / factor;
      }
      return Math.floor(progress.value * value);
    },
    (current, previous) => {
      if (current !== previous) runOnJS(updateDisplay)(current);
    }
  );

  useEffect(() => {
    // Reset and re-trigger when stat changes
    progress.value = 0;
    setDisplayValue(0);

    const timer = setTimeout(() => {
      progress.value = withTiming(1, {
        duration: 1400,
        easing:   Easing.bezier(0.33, 1, 0.68, 1),
      });
    }, isNewUnlock ? 700 : 400);

    return () => clearTimeout(timer);
  }, [definition.id, value]);

  // ── Share ──
  const handleShare = async () => {
    if (sharing || !shareCardRef.current) return;
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

  const handleSave = () => setSaved((s) => !s);

  // ── Format displayed value ──
  const formatted = formatStatNumber(displayValue, definition.precision);

  return (
    <Animated.View style={[styles.card, cardStyle]}>
      {/* Category row */}
      <Animated.View style={[styles.categoryRow, contentStyle]}>
        <CategoryIcon icon={cat.icon} color={cat.color} />
        <Text style={[styles.categoryLabel, { color: cat.color }]}>{cat.label}</Text>
      </Animated.View>

      {/* Big number */}
      <View style={styles.numberBlock}>
        <Text
          style={styles.bigNumber}
          numberOfLines={1}
          adjustsFontSizeToFit
          maxFontSizeMultiplier={1.0}
          accessibilityLabel={`${formatted} ${definition.unit}`}
        >
          {formatted}
        </Text>
        <Text style={styles.unitLabel} maxFontSizeMultiplier={1.2}>{definition.unit}</Text>
      </View>

      {/* Stat title + description */}
      <Animated.View style={contentStyle}>
        <Text style={styles.statTitle} maxFontSizeMultiplier={1.3}>{definition.title}</Text>
        <Text style={styles.statDesc} maxFontSizeMultiplier={1.3}>{definition.description}</Text>
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
    fontSize:      12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  // Number
  numberBlock: {
    marginBottom: spacing[4],
  },
  bigNumber: {
    fontFamily:    fontFamily.extraBold,
    fontSize:      64,
    color:         colors.textPrimary,
    lineHeight:    72,
    letterSpacing: -2,
  },
  unitLabel: {
    fontFamily:   fontFamily.medium,
    fontSize:     16,
    color:        colors.textMuted,
    marginTop:    -spacing[1],
    marginBottom: spacing[1],
  },

  // Stat copy
  statTitle: {
    fontFamily:   fontFamily.bold,
    fontSize:     20,
    color:        colors.textPrimary,
    marginBottom: spacing[2],
    letterSpacing: -0.3,
  },
  statDesc: {
    fontFamily: fontFamily.regular,
    fontSize:   14,
    color:      colors.textSecondary,
    lineHeight: 21,
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
    fontSize:   14,
    color:      colors.textMuted,
  },
});
