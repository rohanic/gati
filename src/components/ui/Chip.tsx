import React from 'react';
import { StyleSheet, Pressable, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, fontFamily, radius, spacing } from '@/theme';
import { Text } from '@/components/ui/Text';

interface ChipProps {
  label:       string;
  icon?:       string;
  selected?:   boolean;
  onPress?:    () => void;
  style?:      ViewStyle;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Chip({ label, icon, selected = false, onPress, style }: ChipProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: selected ? colors.green700 : colors.surface,
    borderColor:     selected ? colors.green700 : colors.border,
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.94, { stiffness: 400, damping: 20 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { stiffness: 300, damping: 25 });
  };

  const handlePress = () => {
    if (!onPress) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.base, animatedStyle, style]}
    >
      {icon ? (
        <Text style={styles.icon}>{icon}</Text>
      ) : null}
      <Text style={[styles.label, selected && styles.labelSelected]}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            6,
    paddingHorizontal: spacing[4],
    paddingVertical:   spacing[2] + 2,
    borderRadius:   radius.full,
    borderWidth:    1.5,
  },
  icon: {
    fontSize: 15,
  },
  label: {
    fontFamily: fontFamily.semiBold,
    fontSize:   13,
    color:      colors.textSecondary,
  },
  labelSelected: {
    color: colors.white,
  },
});
