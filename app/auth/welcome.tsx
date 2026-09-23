/**
 * Post-login welcome screen — shown once after a user's first sign-in.
 *
 * Confirms data is synced, announces the 7-day Pro trial, lists what's
 * unlocked, and sends the user into the main app.
 *
 * Navigation: replaces verify/index in the auth modal stack.
 * "Let's go" → dismissAll() to return to the main tabs.
 */
import React, { useEffect } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { continueAfterFirstRunAuth } from '@/navigation/firstRun';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius, fontFamily, shadow } from '@/theme';
import { useUserStore, trialDaysLeft } from '@/store/userStore';
import { format, addDays, parseISO } from 'date-fns';
import { Text } from '@/components/ui/Text';

// ─── Trial features list ─────────────────────────────────────
const TRIAL_FEATURES: { icon: string; label: string; desc: string }[] = [
  { icon: 'stats-chart',    label: 'All 25 life stats',       desc: 'Heartbeats, breaths, steps and more' },
  { icon: 'map',            label: 'Unlimited saved places',  desc: 'No cap on your wander collection'    },
  { icon: 'time',           label: 'Full story timeline',     desc: 'Every milestone, every memory'       },
  { icon: 'trending-up',    label: 'What-if projections',     desc: 'See where your stats are headed'    },
  { icon: 'cloud-done',     label: 'Cloud backup',            desc: 'Your data safe across devices'       },
];

export default function WelcomeScreen() {
  const trialStartedAt = useUserStore((s) => s.trialStartedAt);
  const { first } = useLocalSearchParams<{ first?: string }>();
  const daysLeft       = trialDaysLeft(trialStartedAt);
  const trialEndDate   = trialStartedAt
    ? format(addDays(parseISO(trialStartedAt), 7), 'MMM d')
    : '';

  // ── Entrance animations ──────────────────────────────────
  const headerOp = useSharedValue(0);
  const headerY  = useSharedValue(24);
  const cardOp   = useSharedValue(0);
  const cardY    = useSharedValue(20);
  const btnOp    = useSharedValue(0);

  useEffect(() => {
    headerOp.value = withTiming(1, { duration: 380 });
    headerY.value  = withSpring(0, { stiffness: 220, damping: 22 });
    cardOp.value   = withDelay(200, withTiming(1, { duration: 380 }));
    cardY.value    = withDelay(200, withSpring(0, { stiffness: 200, damping: 20 }));
    btnOp.value    = withDelay(420, withTiming(1, { duration: 300, easing: Easing.out(Easing.quad) }));
  }, []);

  const headerStyle  = useAnimatedStyle(() => ({ opacity: headerOp.value, transform: [{ translateY: headerY.value }] }));
  const cardStyle    = useAnimatedStyle(() => ({ opacity: cardOp.value,   transform: [{ translateY: cardY.value }]   }));
  const btnStyle     = useAnimatedStyle(() => ({ opacity: btnOp.value }));

  const handleGo = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // On first run this screen was reached by redirect, not by pushing a
    // modal, so there is no stack to dismiss — dismissAll() would leave the
    // user sitting here. Routing back through the root lets it re-decide
    // from the state the sign-in just restored: a returning account may now
    // have onboardingComplete set and should land on Today, not onboarding.
    if (first === '1') {
      continueAfterFirstRunAuth();
      return;
    }
    if (router.canDismiss()) router.dismissAll();
    else router.replace('/');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <Animated.View style={[styles.header, headerStyle]}>
          {/* Sync confirmation badge */}
          <View style={styles.syncBadge}>
            <Ionicons name="cloud-done" size={18} color={colors.green700} />
            <Text style={styles.syncBadgeText}>Data secured</Text>
          </View>

          <Text style={styles.headline}>Welcome to Gati</Text>
          <Text style={styles.subhead}>
            Your stats, streak, and places are now{'\n'}backed up and safe.
          </Text>
        </Animated.View>

        {/* ── Trial card ── */}
        <Animated.View style={[styles.trialCard, cardStyle]}>
          <View style={styles.trialHeader}>
            <View style={styles.proBadge}>
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
            <View style={styles.trialHeaderText}>
              <Text style={styles.trialTitle}>7-day free trial included</Text>
              <Text style={styles.trialSub}>
                All Pro features unlocked · Ends {trialEndDate}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Feature rows */}
          {TRIAL_FEATURES.map((f) => (
            <View key={f.label} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Ionicons name={f.icon as any} size={15} color={colors.green700} />
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureLabel}>{f.label}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
              <Ionicons name="checkmark-circle" size={18} color={colors.green700} />
            </View>
          ))}

          {/* Trial end notice */}
          <View style={styles.trialNote}>
            <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
            <Text style={styles.trialNoteText}>
              Trial ends {trialEndDate} · $4.99/mo after · Cancel anytime
            </Text>
          </View>
        </Animated.View>

        {/* ── CTA ── */}
        <Animated.View style={[btnStyle, styles.btnWrap]}>
          <Pressable
            style={styles.ctaBtn}
            onPress={handleGo}
            android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
          >
            <Text style={styles.ctaBtnText}>Let's go</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.white} />
          </Pressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.background },
  scroll: {
    flexGrow:          1,
    paddingHorizontal: spacing[5],
    paddingTop:        spacing[10],
    paddingBottom:     spacing[8],
    gap:               spacing[6],
  },

  // Header
  header: {
    alignItems: 'center',
    gap:        spacing[3],
  },
  syncBadge: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing[2],
    backgroundColor: colors.green50,
    borderRadius:    radius.full,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
    borderWidth:     1,
    borderColor:     colors.green100,
  },
  syncBadgeText: {
    fontFamily: fontFamily.semiBold,
    fontSize:   13,
    color:      colors.green700,
  },
  headline: {
    fontFamily:    fontFamily.bold,
    fontSize:      28,
    color:         colors.textPrimary,
    letterSpacing: -0.5,
    textAlign:     'center',
  },
  subhead: {
    fontFamily: fontFamily.regular,
    fontSize:   14,
    color:      colors.textSecondary,
    textAlign:  'center',
    lineHeight: 21,
  },

  // Trial card
  trialCard: {
    backgroundColor: colors.white,
    borderRadius:    radius.xl,
    borderWidth:     1,
    borderColor:     colors.border,
    overflow:        'hidden',
    ...shadow.sm,
  },
  trialHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[3],
    padding:       spacing[4],
    backgroundColor: colors.green50,
  },
  proBadge: {
    backgroundColor:   colors.gold,
    borderRadius:      radius.sm,
    paddingVertical:   spacing[1] + 1,
    paddingHorizontal: spacing[3],
  },
  proBadgeText: {
    fontFamily:    fontFamily.bold,
    fontSize:      11,
    color:         colors.white,
    letterSpacing: 1.2,
  },
  trialHeaderText: { flex: 1 },
  trialTitle: {
    fontFamily: fontFamily.bold,
    fontSize:   14,
    color:      colors.green700,
  },
  trialSub: {
    fontFamily: fontFamily.regular,
    fontSize:   12,
    color:      colors.green700,
    marginTop:  2,
  },
  divider: {
    height:          1,
    backgroundColor: colors.border,
  },

  // Feature rows
  featureRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            spacing[3],
    paddingVertical:   spacing[3],
    paddingHorizontal: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  featureIcon: {
    width:           30,
    height:          30,
    borderRadius:    radius.sm,
    backgroundColor: colors.green50,
    alignItems:      'center',
    justifyContent:  'center',
  },
  featureText: { flex: 1 },
  featureLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize:   13,
    color:      colors.textPrimary,
  },
  featureDesc: {
    fontFamily: fontFamily.regular,
    fontSize:   11.5,
    color:      colors.textMuted,
    marginTop:  1,
  },

  // Trial note
  trialNote: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing[2],
    padding:           spacing[4],
    backgroundColor:   colors.surface2,
  },
  trialNoteText: {
    flex:       1,
    fontFamily: fontFamily.regular,
    fontSize:   11,
    color:      colors.textMuted,
    lineHeight: 15,
  },

  // CTA
  btnWrap: { paddingTop: spacing[2] },
  ctaBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             spacing[2],
    backgroundColor: colors.green700,
    borderRadius:    radius.xl,
    paddingVertical: spacing[4] + 2,
    ...shadow.md,
  },
  ctaBtnText: {
    fontFamily:    fontFamily.bold,
    fontSize:      16,
    color:         colors.white,
    letterSpacing: -0.2,
  },
});
