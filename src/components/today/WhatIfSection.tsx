/**
 * Collapsible What-If section embedded inside the Stat Card.
 * Shows 1–2 scenarios with their computed deltas.
 * Animated category icon (bulb) + spring-driven height expansion.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { formatStatNumber } from '@/engine/statsEngine';
import { WHAT_IF_SCENARIOS, WhatIfResult } from '@/data/statDefinitions';
import type { LifeStatsOutput } from '@/engine/statsEngine';
import type { UserProfile } from '@/types';
import { colors, spacing, radius, fontFamily } from '@/theme';

interface WhatIfSectionProps {
  stats:       LifeStatsOutput;
  profile:     UserProfile;
  whatIfKeys:  string[];
}

// ─── Animated bulb icon ───────────────────────────────────────
function BulbIcon({ active }: { active: boolean }) {
  const rotate = useSharedValue(0);
  const scale  = useSharedValue(1);

  useEffect(() => {
    if (active) {
      // Flicker on when opened
      scale.value = withSequence(
        withTiming(1.25, { duration: 100 }),
        withTiming(0.95, { duration: 80 }),
        withSpring(1, { stiffness: 300, damping: 25 })
      );
    }
  }, [active]);

  // Idle subtle pulse
  useEffect(() => {
    rotate.value = withRepeat(
      withSequence(
        withTiming(0.05, { duration: 2000 }),
        withTiming(-0.05, { duration: 2000 })
      ),
      -1,
      true
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${rotate.value}rad` },
      { scale:  scale.value },
    ],
  }));

  return (
    <Animated.View style={style}>
      <Ionicons
        name={active ? 'bulb' : 'bulb-outline'}
        size={15}
        color={active ? colors.gold : colors.textMuted}
      />
    </Animated.View>
  );
}

// ─── Animated chevron ─────────────────────────────────────────
function ChevronIcon({ open }: { open: boolean }) {
  const rot = useSharedValue(0);
  useEffect(() => {
    rot.value = withSpring(open ? 0.5 : 0, { stiffness: 300, damping: 20 });
  }, [open]);
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value * Math.PI}rad` }],
  }));
  return (
    <Animated.View style={style}>
      <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
    </Animated.View>
  );
}

// ─── Individual scenario row ──────────────────────────────────
function ScenarioRow({
  questionText,
  result,
  visible,
}: {
  questionText: string;
  result:       WhatIfResult;
  visible:      boolean;
}) {
  const opacity = useSharedValue(0);
  const transX  = useSharedValue(-8);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 260 });
      transX.value  = withSpring(0, { stiffness: 220, damping: 22 });
    } else {
      opacity.value = withTiming(0, { duration: 140 });
      transX.value  = withTiming(-8, { duration: 140 });
    }
  }, [visible]);

  const style = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ translateX: transX.value }],
  }));

  return (
    <Animated.View style={[styles.scenario, style]}>
      <View style={styles.scenarioDot} />
      <View style={styles.scenarioText}>
        <Text style={styles.scenarioQ}>{questionText}</Text>
        <View style={styles.deltaRow}>
          <Ionicons name="arrow-up-circle" size={14} color={colors.green700} />
          <Text style={styles.deltaValue}>
            {result.delta.toLocaleString('en-US')}
          </Text>
          <Text style={styles.deltaUnit}>{result.unit}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Main component ───────────────────────────────────────────
export function WhatIfSection({ stats, profile, whatIfKeys }: WhatIfSectionProps) {
  const [open, setOpen] = useState(false);

  // Resolve scenarios
  const scenarios = whatIfKeys
    .filter((k) => WHAT_IF_SCENARIOS[k])
    .map((k) => ({
      key:      k,
      question: WHAT_IF_SCENARIOS[k].question,
      result:   WHAT_IF_SCENARIOS[k].fn(stats, profile),
    }));

  if (scenarios.length === 0) return null;

  // ── Height animation ──
  const bodyHeight = useSharedValue(0);
  const contentH   = scenarios.length * 68;

  useEffect(() => {
    bodyHeight.value = withSpring(open ? contentH : 0, {
      stiffness: 220,
      damping:   22,
    });
  }, [open, contentH]);

  const bodyStyle = useAnimatedStyle(() => ({
    height:   bodyHeight.value,
    overflow: 'hidden',
  }));

  const handleToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOpen((prev) => !prev);
  };

  return (
    <View style={styles.container}>
      {/* Divider */}
      <View style={styles.divider} />

      {/* Header toggle */}
      <Pressable
        onPress={handleToggle}
        style={({ pressed }) => [styles.header, pressed && { opacity: 0.75 }]}
        hitSlop={8}
      >
        <BulbIcon active={open} />
        <Text style={[styles.headerText, open && styles.headerTextActive]}>
          What if…
        </Text>
        <ChevronIcon open={open} />
      </Pressable>

      {/* Expandable body */}
      <Animated.View style={bodyStyle}>
        <View style={styles.body}>
          {scenarios.map((s) => (
            <ScenarioRow
              key={s.key}
              questionText={s.question}
              result={s.result}
              visible={open}
            />
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing[2],
  },
  divider: {
    height:          1,
    backgroundColor: colors.borderLight,
    marginBottom:    spacing[3],
  },
  header: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[2],
  },
  headerText: {
    flex:       1,
    fontFamily: fontFamily.medium,
    fontSize:   13,
    color:      colors.textMuted,
  },
  headerTextActive: {
    color: colors.gold,
  },

  body: {
    paddingTop: spacing[3],
    gap:        spacing[1],
  },
  scenario: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           spacing[3],
    paddingBottom: spacing[3],
  },
  scenarioDot: {
    width:           6,
    height:          6,
    borderRadius:    radius.full,
    backgroundColor: colors.green300,
    marginTop:       5,
    flexShrink:      0,
  },
  scenarioText: { flex: 1 },
  scenarioQ: {
    fontFamily:   fontFamily.regular,
    fontSize:     13,
    color:        colors.textSecondary,
    marginBottom: spacing[1],
    lineHeight:   19,
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[1] + 1,
  },
  deltaValue: {
    fontFamily: fontFamily.bold,
    fontSize:   14,
    color:      colors.green700,
  },
  deltaUnit: {
    fontFamily: fontFamily.regular,
    fontSize:   13,
    color:      colors.textSecondary,
  },
});
