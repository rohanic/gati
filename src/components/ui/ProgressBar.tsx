import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors, fontFamily, radius, spacing } from '@/theme';

interface ProgressBarProps {
  value:        number;          // 0–1
  label?:       string;
  rightLabel?:  string;
  height?:      number;
  color?:       string;
  trackColor?:  string;
  showLabel?:   boolean;
  style?:       ViewStyle;
  animated?:    boolean;
}

export function ProgressBar({
  value,
  label,
  rightLabel,
  height     = 6,
  color      = colors.green700,
  trackColor = colors.green100,
  showLabel  = true,
  style,
  animated   = true,
}: ProgressBarProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    const clamped = Math.min(1, Math.max(0, value));
    if (animated) {
      progress.value = withSpring(clamped, { stiffness: 120, damping: 15 });
    } else {
      progress.value = withTiming(clamped, { duration: 0 });
    }
  }, [value]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View style={[styles.container, style]}>
      {showLabel && (label || rightLabel) ? (
        <View style={styles.labelRow}>
          {label     ? <Text style={styles.label}>{label}</Text>     : null}
          {rightLabel ? <Text style={styles.rightLabel}>{rightLabel}</Text> : null}
        </View>
      ) : null}
      <View style={[styles.track, { height, backgroundColor: trackColor, borderRadius: height }]}>
        <Animated.View
          style={[
            styles.fill,
            { height, backgroundColor: color, borderRadius: height },
            fillStyle,
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  labelRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   spacing[1] + 2,
  },
  label: {
    fontFamily: fontFamily.medium,
    fontSize:   11.5,
    color:      colors.textSecondary,
  },
  rightLabel: {
    fontFamily: fontFamily.bold,
    fontSize:   11.5,
    color:      colors.green700,
  },
  track: {
    width:    '100%',
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left:     0,
    top:      0,
  },
});
