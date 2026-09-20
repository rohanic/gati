/**
 * A single row in the "Your story so far" timeline on the Today screen.
 * Staggered spring entrance: slides in from left with opacity.
 * Left-rail: dot + connecting line.
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { formatStatCompact } from '@/engine/statsEngine';
import type { StatDef } from '@/data/statDefinitions';
import { colors, spacing, radius, fontFamily, getCategoryTheme } from '@/theme';

// ─── Stat icon (static) ───────────────────────────────────────
function RowIcon({ icon, color }: { icon: string; color: string }) {
  return <Ionicons name={icon as any} size={16} color={color} />;
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
  const color   = getCategoryTheme(definition.category).accent;
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
    fontSize:     13,
    color:        colors.textPrimary,
    marginBottom: 2,
  },
  dateLabel: {
    fontFamily: fontFamily.regular,
    fontSize:   11.5,
    color:      colors.textMuted,
  },
  statValue: {
    fontFamily:    fontFamily.bold,
    fontSize:      16,
    letterSpacing: -0.3,
  },
});
