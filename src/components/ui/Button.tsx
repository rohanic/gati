import React from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, fontFamily, radius, spacing } from '@/theme';

// ─── Types ───────────────────────────────────────────────────
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size    = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label:        string;
  onPress:      () => void;
  variant?:     Variant;
  size?:        Size;
  loading?:     boolean;
  disabled?:    boolean;
  fullWidth?:   boolean;
  style?:       ViewStyle;
  textStyle?:   TextStyle;
  haptic?:      boolean;
  icon?:        React.ReactNode;
}

// ─── Styles by variant ───────────────────────────────────────
const variantStyles: Record<Variant, { container: ViewStyle; label: TextStyle }> = {
  primary: {
    container: {
      backgroundColor: colors.green700,
      borderWidth:     0,
    },
    label: {
      color: colors.white,
    },
  },
  secondary: {
    container: {
      backgroundColor: colors.green50,
      borderWidth:     1.5,
      borderColor:     colors.green300,
    },
    label: {
      color: colors.green700,
    },
  },
  ghost: {
    container: {
      backgroundColor: colors.transparent,
      borderWidth:     1.5,
      borderColor:     colors.border,
    },
    label: {
      color: colors.textSecondary,
    },
  },
  danger: {
    container: {
      backgroundColor: colors.error,
      borderWidth:     0,
    },
    label: {
      color: colors.white,
    },
  },
};

// ─── Sizes ───────────────────────────────────────────────────
const sizeStyles: Record<Size, { container: ViewStyle; label: TextStyle }> = {
  sm: {
    container: { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.sm },
    label:     { fontFamily: fontFamily.semiBold, fontSize: 13 },
  },
  md: {
    container: { paddingHorizontal: spacing[5], paddingVertical: spacing[3] + 2, borderRadius: radius.full },
    label:     { fontFamily: fontFamily.bold, fontSize: 15 },
  },
  lg: {
    container: { paddingHorizontal: spacing[7], paddingVertical: spacing[4], borderRadius: radius.full },
    label:     { fontFamily: fontFamily.bold, fontSize: 17 },
  },
};

// ─── Component ───────────────────────────────────────────────
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({
  label,
  onPress,
  variant   = 'primary',
  size      = 'md',
  loading   = false,
  disabled  = false,
  fullWidth = false,
  style,
  textStyle,
  haptic    = true,
  icon,
}: ButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { stiffness: 400, damping: 20 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { stiffness: 300, damping: 25 });
  };

  const handlePress = () => {
    if (loading || disabled) return;
    if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const vStyle = variantStyles[variant];
  const sStyle = sizeStyles[size];
  const isDisabled = disabled || loading;

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.base,
        vStyle.container,
        sStyle.container,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        animatedStyle,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? colors.white : colors.green700}
        />
      ) : (
        <>
          {icon}
          <Text style={[styles.label, vStyle.label, sStyle.label, textStyle]}>
            {label}
          </Text>
        </>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            8,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    letterSpacing: 0.2,
  },
});
