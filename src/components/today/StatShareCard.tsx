/**
 * Off-screen share card captured by react-native-view-shot.
 * Portrait 360×380. Forest green background, white text.
 * Positioned absolutely off-screen — rendered but invisible to user.
 *
 * Props:
 *  definition — stat to display
 *  value      — computed numeric value
 *  dayNumber  — profile.daysAlive (optional) shown as "Day X,XXX"
 */
import React, { forwardRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatStatCompact } from '@/engine/statsEngine';
import type { StatDef } from '@/data/statDefinitions';
import { colors, fontFamily, radius, spacing } from '@/theme';

interface StatShareCardProps {
  definition: StatDef | null;
  value:      number;
  dayNumber?: number;        // days alive — shown as "Day X,XXX"
}

export const StatShareCard = forwardRef<View, StatShareCardProps>(
  ({ definition, value, dayNumber }, ref) => {
    if (!definition) return null;

    const displayValue   = formatStatCompact(value);
    const dayLabel       = dayNumber
      ? `Day ${dayNumber.toLocaleString()}`
      : null;

    return (
      /* Invisible wrapper — positioned off-screen for capture */
      <View style={styles.offscreen}>
        <View ref={ref} style={styles.card} collapsable={false}>

          {/* ── Background dot texture ── */}
          <View style={styles.dotGrid} pointerEvents="none">
            {Array.from({ length: 48 }).map((_, i) => (
              <View key={i} style={styles.dot} />
            ))}
          </View>

          {/* ── Top row: G logo + app name ── */}
          <View style={styles.topRow}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoG}>G</Text>
            </View>
            <Text style={styles.appName}>Gati</Text>
          </View>

          {/* ── Category icon pill ── */}
          <View style={styles.categoryPill}>
            <Ionicons
              name={definition.icon as any}
              size={16}
              color="rgba(255,255,255,0.75)"
            />
            <Text style={styles.categoryLabel}>
              {definition.category.charAt(0).toUpperCase() + definition.category.slice(1)}
            </Text>
          </View>

          {/* ── Big value ── */}
          <Text style={styles.bigValue} numberOfLines={1} adjustsFontSizeToFit>
            {displayValue}
          </Text>
          <Text style={styles.unit}>{definition.unit}</Text>

          {/* ── Stat name ── */}
          <Text style={styles.statName} numberOfLines={2}>
            {definition.title}
          </Text>

          {/* ── Spacer ── */}
          <View style={{ flex: 1 }} />

          {/* ── Bottom: Day counter + tagline ── */}
          <View style={styles.bottomSection}>
            {dayLabel && (
              <View style={styles.dayBadge}>
                <Ionicons name="calendar-outline" size={12} color="rgba(255,255,255,0.60)" />
                <Text style={styles.dayBadgeText}>{dayLabel}</Text>
              </View>
            )}
            <View style={styles.taglineRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.tagline}>My life, in numbers</Text>
            </View>
          </View>

        </View>
      </View>
    );
  }
);

const CARD_W = 360;
const CARD_H = 380;

const styles = StyleSheet.create({
  offscreen: {
    position: 'absolute',
    top:      -10_000,
    left:     0,
  },
  card: {
    width:           CARD_W,
    height:          CARD_H,
    backgroundColor: colors.green700,
    borderRadius:    radius.xl,
    padding:         spacing[6],
    overflow:        'hidden',
  },

  // Dot texture
  dotGrid: {
    position:      'absolute',
    top:           0,
    right:         0,
    width:         200,
    height:        CARD_H,
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           16,
    padding:       spacing[5],
    opacity:       0.10,
  },
  dot: {
    width:           4,
    height:          4,
    borderRadius:    2,
    backgroundColor: colors.white,
  },

  // Top row
  topRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[2],
    marginBottom:  spacing[5],
  },
  logoCircle: {
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  logoG: {
    fontFamily: fontFamily.extraBold,
    fontSize:   14,
    color:      colors.white,
    lineHeight: 16,
  },
  appName: {
    fontFamily: fontFamily.bold,
    fontSize:   14,
    color:      'rgba(255,255,255,0.70)',
  },

  // Category pill
  categoryPill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing[1] + 1,
    alignSelf:         'flex-start',
    paddingVertical:   spacing[1],
    paddingHorizontal: spacing[3],
    borderRadius:      radius.full,
    backgroundColor:   'rgba(255,255,255,0.14)',
    marginBottom:      spacing[5],
  },
  categoryLabel: {
    fontFamily: fontFamily.medium,
    fontSize:   12,
    color:      'rgba(255,255,255,0.75)',
  },

  // Value
  bigValue: {
    fontFamily:    fontFamily.extraBold,
    fontSize:      64,
    color:         colors.white,
    letterSpacing: -2.5,
    lineHeight:    70,
  },
  unit: {
    fontFamily:   fontFamily.medium,
    fontSize:     15,
    color:        'rgba(255,255,255,0.60)',
    marginTop:    spacing[1],
    marginBottom: spacing[3],
  },
  statName: {
    fontFamily:  fontFamily.semiBold,
    fontSize:    20,
    color:       'rgba(255,255,255,0.92)',
    lineHeight:  27,
  },

  // Bottom
  bottomSection: {
    gap: spacing[3],
  },
  dayBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing[1] + 1,
    alignSelf:         'flex-start',
    paddingVertical:   spacing[1] + 1,
    paddingHorizontal: spacing[3],
    borderRadius:      radius.full,
    backgroundColor:   'rgba(255,255,255,0.12)',
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.18)',
  },
  dayBadgeText: {
    fontFamily: fontFamily.semiBold,
    fontSize:   12,
    color:      'rgba(255,255,255,0.70)',
  },
  taglineRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[3],
  },
  dividerLine: {
    flex:            1,
    height:          1,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  tagline: {
    fontFamily: fontFamily.regular,
    fontSize:   12,
    color:      'rgba(255,255,255,0.45)',
  },
});
