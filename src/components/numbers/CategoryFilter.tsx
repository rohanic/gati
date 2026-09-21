/**
 * Horizontal animated category filter for the Numbers tab.
 * Pills: All | Time | Body | Habits | Social
 * Active pill springs in with scale bounce.
 */
import React, { useEffect } from 'react';
import { ScrollView, Pressable, View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, fontFamily, categoryTheme } from '@/theme';
import { Text } from '@/components/ui/Text';

export type CategoryKey = 'all' | 'time' | 'body' | 'habits' | 'social';

interface CategoryMeta {
  key:         CategoryKey;
  label:       string;
  icon:        string;
  activeColor: string;
  activeBg:    string;
}

// Colors come from the central category theme — single source of truth.
const CATEGORIES: CategoryMeta[] = [
  { key: 'all',    label: 'All',    icon: 'apps-outline', activeColor: colors.green700, activeBg: colors.green50 },
  { key: 'time',   label: categoryTheme.time.label,   icon: categoryTheme.time.iconOutline,   activeColor: categoryTheme.time.accent,   activeBg: categoryTheme.time.bg   },
  { key: 'body',   label: categoryTheme.body.label,   icon: categoryTheme.body.iconOutline,   activeColor: categoryTheme.body.accent,   activeBg: categoryTheme.body.bg   },
  { key: 'habits', label: categoryTheme.habits.label, icon: categoryTheme.habits.iconOutline, activeColor: categoryTheme.habits.accent, activeBg: categoryTheme.habits.bg },
  { key: 'social', label: categoryTheme.social.label, icon: categoryTheme.social.iconOutline, activeColor: categoryTheme.social.accent, activeBg: categoryTheme.social.bg },
];

// ─── Single animated pill ────────────────────────────────────
function Pill({
  meta,
  isActive,
  onPress,
  delay,
}: {
  meta:     CategoryMeta;
  isActive: boolean;
  onPress:  () => void;
  delay:    number;
}) {
  const entryScale = useSharedValue(0.8);
  const entryOp    = useSharedValue(0);
  const pressScale = useSharedValue(1);

  // Entrance stagger
  useEffect(() => {
    entryOp.value    = withSpring(1, { stiffness: 200, damping: 20 });
    entryScale.value = withDelay(delay, withSpring(1, { stiffness: 300, damping: 25 }));
  }, []);

  const entryStyle = useAnimatedStyle(() => ({
    opacity:   entryOp.value,
    transform: [{ scale: entryScale.value * pressScale.value }],
  }));

  const handlePressIn  = () => {
    pressScale.value = withSpring(0.91, { stiffness: 500, damping: 20 });
  };
  const handlePressOut = () => {
    pressScale.value = withSpring(1, { stiffness: 300, damping: 25 });
  };

  return (
    <Animated.View style={entryStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.pill,
          isActive && {
            backgroundColor: meta.activeBg,
            borderColor:     meta.activeColor,
          },
        ]}
        android_ripple={{ color: meta.activeBg, borderless: false }}
      >
        <Ionicons
          name={meta.icon as any}
          size={13}
          color={isActive ? meta.activeColor : colors.textMuted}
        />
        <Text
          style={[
            styles.pillLabel,
            isActive && { color: meta.activeColor, fontFamily: fontFamily.semiBold },
          ]}
        >
          {meta.label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// ─── Exported filter bar ─────────────────────────────────────
interface CategoryFilterProps {
  active:   CategoryKey;
  onChange: (key: CategoryKey) => void;
}

export function CategoryFilter({ active, onChange }: CategoryFilterProps) {
  const handlePress = (key: CategoryKey) => {
    Haptics.selectionAsync();
    onChange(key);
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.scroll}
    >
      {CATEGORIES.map((meta, i) => (
        <Pill
          key={meta.key}
          meta={meta}
          isActive={meta.key === active}
          onPress={() => handlePress(meta.key)}
          delay={i * 40}
        />
      ))}
    </ScrollView>
  );
}

export { CATEGORIES };

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
  },
  row: {
    flexDirection:     'row',
    gap:               spacing[2],
    paddingHorizontal: spacing[5],
    paddingVertical:   spacing[2],
  },
  pill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing[1] + 2,
    paddingVertical:   spacing[2] + 2,
    paddingHorizontal: spacing[4],
    borderRadius:      radius.full,
    borderWidth:       1.5,
    borderColor:       colors.border,
    backgroundColor:   colors.white,
  },
  pillLabel: {
    fontFamily: fontFamily.medium,
    fontSize:   12,
    color:      colors.textSecondary,
  },
});
