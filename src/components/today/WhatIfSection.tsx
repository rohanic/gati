/**
 * WhatIfSection — rebuilt v2.
 *
 * What changed vs v1:
 *
 *  ANIMATION
 *  • Content swap now driven by the withTiming completion callback + runOnJS
 *    instead of setTimeout. The new content appears the exact frame opacity
 *    hits zero — never a flash, never out-of-sync.
 *  • Cycling guard released only after the entrance spring settles, so rapid
 *    taps during the slide-in are swallowed rather than queued.
 *  • If the fade-out is interrupted the guard is still released via the
 *    `!finished` branch — component can never get stuck.
 *  • Spring configs split into SNAP (no overshoot, lands exactly) and SETTLE
 *    (gentle overshoot, feels alive). Used deliberately throughout.
 *
 *  DESIGN
 *  • Result number enlarged to 22 px bold — the "wow" figure reads at a
 *    glance instead of blending with body copy.
 *  • Unit text sits on its own indented line, aligned with the number.
 *  • Pressed states live entirely on the UI thread (opacity style, not JS
 *    onPressIn/Out), so they respond instantly.
 */
import React, { useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Collapsible } from '@/components/ui';
import { useAccess } from '@/hooks/useAccess';
import { WHAT_IF_SCENARIOS } from '@/data/statDefinitions';
import type { LifeStatsOutput } from '@/engine/statsEngine';
import type { UserProfile } from '@/types';
import { colors, spacing, radius, fontFamily } from '@/theme';

// ─── Types ────────────────────────────────────────────────────────────────────
interface WhatIfSectionProps {
  stats:      LifeStatsOutput;
  profile:    UserProfile;
  whatIfKeys: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Spring presets ───────────────────────────────────────────────────────────
// SNAP  : no overshoot → lands exactly at target (chevron, slide-in position)
// SETTLE: gentle overshoot → feels alive (bulb, opacity spring-in)
const SNAP   = { stiffness: 300, damping: 28, overshootClamping: true  } as const;
const SETTLE = { stiffness: 260, damping: 20, overshootClamping: false } as const;

// Horizontal slide distance for scenario transitions (px)
const SLIDE = 26;

// ─── Component ────────────────────────────────────────────────────────────────
export function WhatIfSection({ stats, profile, whatIfKeys }: WhatIfSectionProps) {
  const validKeys = useMemo(
    () => whatIfKeys.filter((k) => WHAT_IF_SCENARIOS[k]),
    [whatIfKeys],
  );
  const deckRef   = useRef<string[]>(shuffle(validKeys));
  const [idx, setIdx]   = useState(0);
  const [open, setOpen] = useState(false);
  const cyclingRef      = useRef(false);
  const access          = useAccess();
  const isLocked        = !access.canUseWhatIf;

  // ── Hooks first, always ──────────────────────────────────────────────────
  // These used to sit BELOW the early returns further down, so a render where
  // `validKeys` was empty called four hooks and a normal render called seven.
  // React tracks hooks positionally, so any re-render that crossed that
  // boundary without remounting threw "Rendered more hooks than during the
  // previous render". Every hook now runs unconditionally.
  const scenarioOp = useSharedValue(1);
  const scenarioX  = useSharedValue(0);
  const bulbScale  = useSharedValue(1);
  const chevronRot = useSharedValue(0);

  const scenarioStyle = useAnimatedStyle(() => ({
    opacity:   scenarioOp.value,
    transform: [{ translateX: scenarioX.value }],
  }));
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRot.value * 0.5 * Math.PI}rad` }],
  }));
  const bulbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bulbScale.value }],
  }));

  const currentKey  = deckRef.current[idx] ?? validKeys[0];
  const scenarioDef = currentKey ? WHAT_IF_SCENARIOS[currentKey] : undefined;

  // Guard fn() — a bad formula must never crash the card.
  let result: { delta: number; unit: string } = { delta: 0, unit: '' };
  if (scenarioDef) {
    try {
      result = scenarioDef.fn(stats, profile);
    } catch {
      result = { delta: 0, unit: '' };
    }
  }

  const total = deckRef.current.length;

  // ── Toggle ──────────────────────────────────────────────────────────────────
  const handleToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const willOpen = !open;
    setOpen(willOpen);

    // Chevron: SNAP — lands exactly at 90°, no bounce on close
    chevronRot.value = withSpring(willOpen ? 1 : 0, SNAP);

    if (willOpen) {
      // Bulb pop to signal activation
      bulbScale.value = withSequence(
        withTiming(1.28, { duration: 75 }),
        withTiming(0.90, { duration: 58 }),
        withSpring(1, { stiffness: 340, damping: 18 }),
      );
      // Restore scenario to fully visible (handles mid-cycle interruption)
      scenarioOp.value = 1;
      scenarioX.value  = 0;
    }
  };

  // ── Cycling (frame-perfect via animation callback + runOnJS) ────────────────
  //
  // Sequence:
  //   Phase 1  slide left + fade out   withTiming 100 ms (simultaneously)
  //   Phase 2  callback fires on UI thread when animation finishes:
  //              runOnJS(doSwapIdx)()   → setIdx on JS thread (async re-render)
  //              scenarioX.value = SLIDE  → instant reposition (UI thread)
  //   Phase 3  spring in:  opacity SETTLE, X SNAP
  //   Phase 4  unlock:     runOnJS(doUnlock) once X spring fully settles
  //
  // Opacity is 0 during the React re-render, so no stale content ever flashes.
  //
  const doSwapIdx = () => {
    setIdx((prev) => {
      const next = (prev + 1) % deckRef.current.length;
      if (next === 0) deckRef.current = shuffle(validKeys);
      return next;
    });
  };
  const doUnlock = () => { cyclingRef.current = false; };

  const handleNext = () => {
    if (!open || cyclingRef.current || total <= 1) return;
    cyclingRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Phase 1 — slide left + fade out
    scenarioOp.value = withTiming(0, { duration: 100 }, (finished) => {
      // Runs on the UI thread (worklet).
      if (!finished) {
        // Animation interrupted — release guard so UI doesn't get stuck
        runOnJS(doUnlock)();
        return;
      }

      // Phase 2 — swap content on JS thread while invisible
      runOnJS(doSwapIdx)();

      // Phase 2 (cont.) — snap position off-screen right on UI thread
      scenarioX.value = SLIDE;

      // Phase 3 — spring in
      scenarioOp.value = withSpring(1, SETTLE);
      scenarioX.value  = withSpring(0, SNAP, (done) => {
        // Phase 4 — unlock only after slide fully settles
        if (done) runOnJS(doUnlock)();
      });
    });
    scenarioX.value = withTiming(-SLIDE, { duration: 100 });
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  // Safe to return early now — every hook above has already run.
  if (validKeys.length === 0 || !scenarioDef) return null;

  // Pro gate. Both paywalls list "What-if projections" as a Pro feature, so it
  // has to actually be one. Free users see the teaser and a route to /pro;
  // trial and Pro users get the full interaction.
  if (isLocked) {
    return (
      <View style={styles.container}>
        <View style={styles.divider} />
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/pro');
          }}
          style={({ pressed }) => [styles.header, pressed && styles.headerPressed]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="What-if projections are a Pro feature. Tap to see Gati Pro."
        >
          <Ionicons name="bulb-outline" size={15} color={colors.textMuted} />
          <Text style={styles.headerText}>What if…</Text>
          <View style={styles.proPill}>
            <Text style={styles.proPillText}>PRO</Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
        </Pressable>
        <Text style={styles.lockedHint}>
          See how one small change compounds across the rest of your life.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.divider} />

      {/* ── Header ── */}
      <Pressable
        onPress={handleToggle}
        style={({ pressed }) => [styles.header, pressed && styles.headerPressed]}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={open ? 'Collapse what-if scenarios' : 'Explore what-if scenarios'}
      >
        <Animated.View style={bulbStyle}>
          <Ionicons
            name={open ? 'bulb' : 'bulb-outline'}
            size={15}
            color={open ? colors.gold : colors.textMuted}
          />
        </Animated.View>

        <Text style={[styles.headerText, open && styles.headerTextActive]}>
          What if…
        </Text>

        {open && (
          <Text style={styles.counter}>{idx + 1} / {total}</Text>
        )}

        <Animated.View style={chevronStyle}>
          <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
        </Animated.View>
      </Pressable>

      {/* ── Body — height managed by Collapsible ── */}
      <Collapsible open={open}>
        <View style={styles.body}>

          {/* Scenario content: slides + fades on each cycle */}
          <Animated.View style={[styles.scenarioWrap, scenarioStyle]}>

            {/* Question */}
            <Text style={styles.question}>{scenarioDef.question}</Text>

            {/* Result: large number + indented unit line */}
            <View style={styles.resultBlock}>
              <View style={styles.resultRow}>
                <Ionicons name="arrow-up-circle" size={16} color={colors.green700} />
                <Text style={styles.deltaNum}>
                  {result.delta.toLocaleString('en-US')}
                </Text>
              </View>
              {!!result.unit && (
                <Text style={styles.deltaUnit}>{result.unit}</Text>
              )}
            </View>

          </Animated.View>

          {/* Next pill — hidden when only one scenario exists */}
          {total > 1 && (
            <Pressable
              onPress={handleNext}
              style={({ pressed }) => [styles.nextBtn, pressed && styles.nextBtnPressed]}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Next what-if scenario"
            >
              <Text style={styles.nextText}>Next</Text>
              <Ionicons name="arrow-forward" size={13} color={colors.green700} />
            </Pressable>
          )}

        </View>
      </Collapsible>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { marginTop: spacing[2] },

  divider: {
    height:          1,
    backgroundColor: colors.borderLight,
    marginBottom:    spacing[3],
  },

  // ── Header
  header: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[2],
  },
  headerPressed: { opacity: 0.68 },
  headerText: {
    flex:       1,
    fontFamily: fontFamily.medium,
    fontSize:   12,
    color:      colors.textMuted,
  },
  headerTextActive: { color: colors.gold },

  // ── Pro gate
  proPill: {
    paddingHorizontal: spacing[2],
    paddingVertical:   2,
    borderRadius:      radius.full,
    backgroundColor:   colors.goldBg,
    borderWidth:       1,
    borderColor:       colors.goldBorder,
  },
  proPillText: {
    fontFamily:    fontFamily.bold,
    fontSize:      9,
    letterSpacing: 0.6,
    color:         colors.gold,
  },
  lockedHint: {
    fontFamily: fontFamily.regular,
    fontSize:   11.5,
    color:      colors.textMuted,
    lineHeight: 17,
    marginTop:  spacing[2],
  },

  counter: {
    fontFamily:  fontFamily.medium,
    fontSize:    10.5,
    color:       colors.textMuted,
    marginRight: spacing[1],
  },

  // ── Body
  body: {
    paddingTop: spacing[3],
    gap:        spacing[3],
  },
  scenarioWrap: {
    gap: spacing[3],
  },

  // Question
  question: {
    fontFamily: fontFamily.medium,
    fontSize:   13,
    color:      colors.textPrimary,
    lineHeight: 20,
  },

  // Result block
  resultBlock: {
    gap: spacing[1] + 1,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[2],   // 8 px
  },
  deltaNum: {
    fontFamily:    fontFamily.bold,
    fontSize:      22,
    color:         colors.green700,
    letterSpacing: -0.5,
    lineHeight:    26,
  },
  // paddingLeft = icon (16) + gap (8) = 24 px — aligns unit with the number
  deltaUnit: {
    fontFamily:  fontFamily.regular,
    fontSize:    12,
    color:       colors.textSecondary,
    lineHeight:  17,
    paddingLeft: 24,
  },

  // ── Next button
  nextBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    alignSelf:         'flex-end',
    gap:               spacing[1],
    minHeight:         34,
    paddingVertical:   spacing[1] + 2,
    paddingHorizontal: spacing[3],
    borderRadius:      radius.full,
    backgroundColor:   colors.green50,
    borderWidth:       1,
    borderColor:       colors.green100,
    marginTop:         spacing[1],
  },
  nextBtnPressed: { opacity: 0.58 },
  nextText: {
    fontFamily: fontFamily.semiBold,
    fontSize:   10.5,
    color:      colors.green700,
  },
});
