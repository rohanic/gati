import React from 'react';
import { ViewStyle, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, radius, shadow, spacing } from '@/theme';

type Variant = 'default' | 'elevated' | 'flat' | 'tinted';

interface CardProps {
  children:   React.ReactNode;
  variant?:   Variant;
  onPress?:   () => void;
  style?:     ViewStyle;
  haptic?:    boolean;
  padded?:    boolean;
}

const variantStyles: Record<Variant, ViewStyle> = {
  default: {
    backgroundColor: colors.surface,
    borderWidth:     1,
    borderColor:     colors.border,
    ...shadow.sm,
  },
  elevated: {
    backgroundColor: colors.surface,
    borderWidth:     0,
    ...shadow.md,
  },
  flat: {
    backgroundColor: colors.surface,
    borderWidth:     1,
    borderColor:     colors.border,
  },
  tinted: {
    backgroundColor: colors.green50,
    borderWidth:     1.5,
    borderColor:     colors.green100,
  },
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Card({
  children,
  variant  = 'default',
  onPress,
  style,
  haptic   = true,
  padded   = true,
}: CardProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (!onPress) return;
    scale.value = withSpring(0.975, { stiffness: 350, damping: 20 });
  };

  const handlePressOut = () => {
    if (!onPress) return;
    scale.value = withSpring(1, { stiffness: 300, damping: 25 });
  };

  const handlePress = () => {
    if (!onPress) return;
    if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={!onPress}
      style={[
        styles.base,
        variantStyles[variant],
        padded && styles.padded,
        animatedStyle,
        style,
      ]}
    >
      {children}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.xl,
    overflow:     'hidden',
  },
  padded: {
    padding: spacing[5],
  },
});
