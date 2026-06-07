/**
 * A single row in the "Your story so far" timeline on the Today screen.
 * Staggered spring entrance: slides in from left with opacity.
 * Left-rail: dot + connecting line.
 * Animated row icon (same pulse as CategoryIcon, but smaller).
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { formatStatCompact } from '@/engine/statsEngine';
import type { StatDef } from '@/data/statDefinitions';
import { colors, spacing, radius, fontFamily } from '@/theme';

const CATEGORY_COLORS: Record<string, string> = {
  time:   '#6B7FD7',
  body:   '#D96B6B',
  habits: colors.green500,
  social: '#E8A020',
  money:  colors.gold,
};

// ─── Animated stat icon ───────────────────────────────────────
function RowIcon({ icon, color }: { icon: string; color: string }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 2200, easing: Easing.bezier(0.37, 0, 0.63, 1) }),
        withTiming(1.00, { duration: 2200, easing: Easing.bezier(0.37, 0, 0.63, 1) })
      ),
      -1,
      true
    );
  }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={style}>
      <Ionicons name={icon as any} size={16} color={color} />
    </Animated.View>
  );
}

// ─── Row component ────────────────────────────────────────────
interface TimelineRowProps {
  definition: StatDef;
  value:      number;
  date:       string;      // 'yyyy-MM-dd'
  index:      number;      // for stagger
  isLast:     boolean;
}

export function TimelineRow({
  definition,
  value,
  date,
  index,
  isLast,
}: TimelineRowProps) {
  const color   = CATEGORY_COLORS[definition.category] ?? colors.green500;
  const opacity = useSharedValue(0);
  const transX  = useSharedValue(-20);

  useEffect(() => {
    const delay = Math.min(index, 5) * 110;
    opacity.value = withDelay(delay, withTiming(1, { duration: 320 }));
    transX.value  = withDelay(delay, withSpring(0, { stiffness: 220, damping: 20 }));
  }, [index]);

  const rowStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ translateX: transX.value }],
  }));

  const parsedDate = new Date(date + 'T00:00:00');
  const dateLabel  = format(parsedDate, 'MMM d');

  return (
    <Animated.View style={[styles.row, rowStyle]}>
      {/* Left rail */}
      <View style={styles.rail}>
        <View style={[styles.railDot, { backgroundColor: color }]} />
        {!isLast && <View style={styles.railLine} />}
      </View>

      {/* Card */}
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={[styles.iconWrap, { backgroundColor: color + '18' }]}>
            <RowIcon icon={definition.icon} color={color} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.statTitle} numberOfLines={1}>
              {definition.title}
            </Text>
            <Text style={styles.dateLabel}>{dateLabel}</Text>
          </View>
          <Text style={[styles.statValue, { color }]}>
            {formatStatCompact(value)}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems:    'stretch',
    marginBottom:  spacing[2],
  },

  // Rail
  rail: {
    width:          24,
    alignItems:     'center',
    marginRight:    spacing[3],
  },
  railDot: {
    width:        10,
    height:       10,
    borderRadius: radius.full,
    marginTop:    16,
    zIndex:       1,
  },
  railLine: {
    flex:            1,
    width:           2,
    backgroundColor: colors.green100,
    marginTop:       4,
    borderRadius:    radius.full,
  },

  // Card
  card: {
    flex:            1,
    backgroundColor: colors.white,
    borderRadius:    radius.xl,
    borderWidth:     1,
    borderColor:     colors.border,
    padding:         spacing[3],
    marginBottom:    spacing[1],
  },
  cardTop: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[3],
  },
  iconWrap: {
    width:          36,
    height:         36,
    borderRadius:   radius.md,
    alignItems:     'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1 },
  statTitle: {
    fontFamily:   fontFamily.semiBold,
    fontSize:     14,
    color:        colors.textPrimary,
    marginBottom: 2,
  },
  dateLabel: {
    fontFamily: fontFamily.regular,
    fontSize:   12,
    color:      colors.textMuted,
  },
  statValue: {
    fontFamily:    fontFamily.bold,
    fontSize:      17,
    letterSpacing: -0.3,
  },
});
