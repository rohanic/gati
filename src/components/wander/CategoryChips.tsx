/**
 * Horizontal scrollable category filter chips for the Wander tab.
 * Spring press animation, no emoji, no purple/orange.
 */
import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Pressable, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius, fontFamily } from '@/theme';
import type { InterestCategory } from '@/types';

// ─── Category meta ─────────────────────────────────────────────
export type WanderCategory = InterestCategory | 'all';

interface CategoryMeta {
  key:    WanderCategory;
  label:  string;
  icon:   string;
  color:  string;
  bgColor: string;
}

export const WANDER_CATEGORIES: CategoryMeta[] = [
  { key: 'all',       label: 'All',       icon: 'grid-outline',       color: colors.green700, bgColor: colors.green50   },
  { key: 'food',      label: 'Food',      icon: 'restaurant-outline',  color: '#E8A020',       bgColor: '#FFF8E7'        },
  { key: 'cafe',      label: 'Café',      icon: 'cafe-outline',        color: '#7C5C3E',       bgColor: '#F7F0E8'        },
  { key: 'history',   label: 'History',   icon: 'business-outline',    color: '#5B7F9E',       bgColor: '#EEF3F8'        },
  { key: 'nature',    label: 'Nature',    icon: 'leaf-outline',        color: colors.green500, bgColor: colors.green50   },
  { key: 'art',       label: 'Art',       icon: 'color-palette-outline', color: '#D94F4F',     bgColor: '#FFF0F0'        },
  { key: 'market',    label: 'Market',    icon: 'bag-handle-outline',  color: colors.gold,     bgColor: colors.goldBg    },
  { key: 'nightlife', label: 'Nightlife', icon: 'moon-outline',        color: '#4A6080',       bgColor: '#EEF2F6'        },
  { key: 'books',     label: 'Books',     icon: 'book-outline',        color: '#6B5B45',       bgColor: '#F5F0EA'        },
];

export function getCategoryMeta(key: WanderCategory): CategoryMeta {
  return WANDER_CATEGORIES.find((c) => c.key === key) ?? WANDER_CATEGORIES[0];
}

// ─── Individual chip ────────────────────────────────────────────
function Chip({
  meta,
  active,
  onPress,
  delay,
}: {
  meta:    CategoryMeta;
  active:  boolean;
  onPress: () => void;
  delay:   number;
}) {
  const opacity = useSharedValue(0);
  const transX  = useSharedValue(12);
  const scale   = useSharedValue(1);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 240 }));
    transX.value  = withDelay(delay, withSpring(0, { stiffness: 300, damping: 25 }));
  }, []);

  const outerStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ translateX: transX.value }],
  }));
  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    Haptics.selectionAsync();
    scale.value = withSpring(0.92, { stiffness: 400, damping: 18 }, () => {
      scale.value = withSpring(1, { stiffness: 300, damping: 25 });
    });
    onPress();
  };

  return (
    <Animated.View style={outerStyle}>
      <Animated.View style={innerStyle}>
        <Pressable
          onPress={handlePress}
          style={[
            styles.chip,
            active && { borderColor: meta.color, backgroundColor: meta.bgColor },
          ]}
        >
          <Ionicons
            name={meta.icon as any}
            size={14}
            color={active ? meta.color : colors.textMuted}
          />
          <Text style={[styles.chipLabel, active && { color: meta.color }]}>
            {meta.label}
          </Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Chip row ───────────────────────────────────────────────────
interface CategoryChipsProps {
  active:   WanderCategory;
  onChange: (key: WanderCategory) => void;
}

export function CategoryChips({ active, onChange }: CategoryChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.scroll}
    >
      {WANDER_CATEGORIES.map((meta, i) => (
        <Chip
          key={meta.key}
          meta={meta}
          active={active === meta.key}
          onPress={() => onChange(meta.key)}
          delay={i * 40}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow:     0,
    marginBottom: spacing[4],
  },
  row: {
    flexDirection:    'row',
    gap:              spacing[2],
    paddingHorizontal: spacing[5],
  },
  chip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing[1] + 1,
    paddingVertical:   spacing[2] + 1,
    paddingHorizontal: spacing[3],
    borderRadius:      radius.full,
    borderWidth:       1.5,
    borderColor:       colors.border,
    backgroundColor:   colors.white,
  },
  chipLabel: {
    fontFamily: fontFamily.medium,
    fontSize:   12,
    color:      colors.textSecondary,
  },
});
