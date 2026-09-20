import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { colors, fontFamily, radius, spacing } from '@/theme';

type BadgeVariant = 'streak' | 'green' | 'gold' | 'muted';

interface BadgeProps {
  label:      string;
  variant?:   BadgeVariant;
  icon?:      string;
  pulse?:     boolean;         // Glow pulse — for streak badge
  style?:     ViewStyle;
}

const variantConfig: Record<
  BadgeVariant,
  { bg: string; text: string; border: string }
> = {
  streak: { bg: colors.goldBg,  text: colors.gold,        border: colors.goldBorder },
  gold:   { bg: colors.goldBg,  text: colors.gold,        border: colors.goldBorder },
  green:  { bg: colors.green50, text: colors.green700,    border: colors.green100 },
  muted:  { bg: colors.surface2, text: colors.textMuted,  border: colors.border },
};

export function Badge({ label, variant = 'green', icon, pulse = false, style }: BadgeProps) {
  const cfg = variantConfig[variant];

  const pulseScale = useSharedValue(1);

  React.useEffect(() => {
    if (!pulse) return;
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 900 }),
        withTiming(1.0,  { duration: 900 }),
      ),
      -1,
      true
    );
  }, [pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.base,
        { backgroundColor: cfg.bg, borderColor: cfg.border },
        pulse && pulseStyle,
        style,
      ]}
    >
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      <Text style={[styles.label, { color: cfg.text }]}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            4,
    paddingHorizontal: spacing[3],
    paddingVertical:   spacing[1] + 2,
    borderRadius:   radius.full,
    borderWidth:    1,
    alignSelf:      'flex-start',
  },
  icon: {
    fontSize: 11.5,
  },
  label: {
    fontFamily:    fontFamily.bold,
    fontSize:      11.5,
    letterSpacing: 0.3,
  },
});
