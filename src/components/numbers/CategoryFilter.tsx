/**
 * Horizontal animated category filter for the Numbers tab.
 * Pills: All | Time | Body | Habits | Social
 * Active pill springs in with scale bounce.
 */
import React, { useEffect } from 'react';
import { ScrollView, Pressable, Text, View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, fontFamily } from '@/theme';

export type CategoryKey = 'all' | 'time' | 'body' | 'habits' | 'social';

interface CategoryMeta {
  key:         CategoryKey;
  label:       string;
  icon:        string;
  activeColor: string;
  activeBg:    string;
}

const CATEGORIES: CategoryMeta[] = [
  { key: 'all',    label: 'All',    icon: 'apps-outline',            activeColor: colors.green700, activeBg: colors.green50      },
  { key: 'time',   label: 'Time',   icon: 'time-outline',            activeColor: '#5B7FE8',       activeBg: '#EEF1FD'            },
  { key: 'body',   label: 'Body',   icon: 'heart-outline',           activeColor: '#D94F4F',       activeBg: '#FFF0F0'            },
  { key: 'habits', label: 'Habits', icon: 'cafe-outline',            activeColor: colors.gold,     activeBg: colors.goldBg        },
  { key: 'social', label: 'Social', icon: 'people-outline',          activeColor: colors.green500, activeBg: colors.green50       },
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
    fontSize:   13,
    color:      colors.textSecondary,
  },
});
