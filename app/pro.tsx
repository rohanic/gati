/**
 * Pro upgrade modal — /pro
 *
 * Presented as a slide-from-bottom modal (see app/_layout.tsx).
 * Can be pushed from anywhere: profile, locked features, share cards.
 *
 * Matches profile.tsx upgrade card design but full-screen with a
 * proper close button and expanded feature comparison table.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius, fontFamily, shadow } from '@/theme';

// ─── Feature comparison rows ─────────────────────────────────
const FEATURES: { label: string; free: boolean; pro: boolean }[] = [
  { label: 'Daily life stat',             free: true,  pro: true  },
  { label: 'All 22+ stats unlocked',      free: false, pro: true  },
  { label: 'What-if projections',         free: false, pro: true  },
  { label: 'Wander place discovery',      free: true,  pro: true  },
  { label: 'Full story timeline',         free: false, pro: true  },
  { label: 'Stat share cards',            free: true,  pro: true  },
  { label: 'Milestone celebrations',      free: true,  pro: true  },
  { label: 'Streak tracking',             free: true,  pro: true  },
  { label: 'Priority new features',       free: false, pro: true  },
];

// ─── Pro badge with shimmer ───────────────────────────────────
function ProBadge({ large }: { large?: boolean }) {
  const shimX = useSharedValue(-80);
  useEffect(() => {
    shimX.value = withRepeat(
      withSequence(
        withTiming(160, { duration: 1600, easing: Easing.bezier(0.42, 0, 0.58, 1) }),
        withTiming(-80, { duration: 0 })
      ),
      -1,
      false
    );
  }, []);
  const shimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimX.value }],
  }));

  return (
    <View style={[styles.proBadge, large && styles.proBadgeLarge]}>
      <Text style={[styles.proBadgeText, large && styles.proBadgeTextLarge]}>PRO</Text>
      <Animated.View style={[styles.shimmerWrap, shimStyle]} pointerEvents="none">
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.45)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.shimmerGradient}
        />
      </Animated.View>
    </View>
  );
}

// ─── Billing toggle ───────────────────────────────────────────
function BillingToggle({
  monthly,
  onToggle,
}: {
  monthly:  boolean;
  onToggle: () => void;
}) {
  const pillX = useSharedValue(monthly ? 0 : 1);
  useEffect(() => {
    pillX.value = withSpring(monthly ? 0 : 1, { stiffness: 300, damping: 22 });
  }, [monthly]);
  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value * 104 }],
  }));

  return (
    <Pressable onPress={onToggle} android_ripple={{ color: colors.green50, borderless: true }}>
      <View style={styles.billingTrack}>
        <Animated.View style={[styles.billingPill, pillStyle]} />
        <Text style={[styles.billingLabel, monthly && styles.billingLabelActive]}>Monthly</Text>
        <Text style={[styles.billingLabel, !monthly && styles.billingLabelActive]}>Yearly · -33%</Text>
      </View>
    </Pressable>
  );
}

// ─── Screen ──────────────────────────────────────────────────
export default function ProScreen() {
  const [isMonthly, setIsMonthly] = useState(true);

  // Entrance animation
  const contentOp = useSharedValue(0);
  const contentY  = useSharedValue(30);
  useEffect(() => {
    contentOp.value = withDelay(120, withTiming(1, { duration: 380 }));
    contentY.value  = withDelay(120, withSpring(0, { stiffness: 200, damping: 20 }));
  }, []);
  const contentStyle = useAnimatedStyle(() => ({
    opacity:   contentOp.value,
    transform: [{ translateY: contentY.value }],
  }));

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Close button */}
      <Pressable
        style={styles.closeBtn}
        onPress={() => router.back()}
        android_ripple={{ color: colors.green50, borderless: true }}
      >
        <Ionicons name="close" size={22} color={colors.textSecondary} />
      </Pressable>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={contentStyle}>
          {/* Header */}
          <View style={styles.header}>
            <ProBadge large />
            <Text style={styles.title} maxFontSizeMultiplier={1.2}>Upgrade to Gati Pro</Text>
            <Text style={styles.subtitle}>
              Your entire life, fully quantified.{'\n'}No stat locked. No limit.
            </Text>
          </View>

          {/* Billing toggle */}
          <BillingToggle
            monthly={isMonthly}
            onToggle={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setIsMonthly((p) => !p);
            }}
          />

          {/* Price */}
          <View style={styles.priceRow}>
            <Text style={styles.priceMain} maxFontSizeMultiplier={1.0}>
              {isMonthly ? '$4.99' : '$39.99'}
            </Text>
            <View>
              <Text style={styles.priceUnit}>{isMonthly ? 'per month' : 'per year'}</Text>
              {!isMonthly && (
                <Text style={styles.priceSaving}>Save $19.89 vs monthly</Text>
              )}
            </View>
          </View>

          {/* CTA */}
          <Pressable
            style={({ pressed }) => [styles.ctaBtn, pressed && { opacity: 0.88 }]}
            android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
            onPress={() => Alert.alert('Gati Pro', 'Purchase flow coming soon.')}
          >
            <Text style={styles.ctaText}>Start 7-day free trial</Text>
          </Pressable>
          <Text style={styles.ctaHint}>No charge until trial ends · Cancel anytime</Text>

          {/* Feature comparison */}
          <View style={styles.compareCard}>
            {/* Header row */}
            <View style={styles.compareHeaderRow}>
              <Text style={[styles.compareHeaderLabel, { flex: 1 }]}>Feature</Text>
              <Text style={styles.compareHeaderLabel}>Free</Text>
              <Text style={[styles.compareHeaderLabel, styles.compareHeaderPro]}>Pro</Text>
            </View>

            {FEATURES.map((feat, i) => (
              <View
                key={feat.label}
                style={[
                  styles.compareRow,
                  i < FEATURES.length - 1 && styles.compareRowDivider,
                ]}
              >
                <Text style={styles.compareLabel}>{feat.label}</Text>
                <View style={styles.compareCheck}>
                  {feat.free
                    ? <Ionicons name="checkmark" size={16} color={colors.textMuted} />
                    : <Ionicons name="remove"    size={16} color={colors.borderLight} />
                  }
                </View>
                <View style={[styles.compareCheck, styles.compareCheckPro]}>
                  <Ionicons name="checkmark" size={16} color={colors.green700} />
                </View>
              </View>
            ))}
          </View>

          {/* Fine print */}
          <Text style={styles.finePrint}>
            Gati Pro is a subscription. Payment is charged to your account at confirmation of purchase.
            Your subscription renews automatically unless cancelled at least 24 hours before the
            end of the current period. You can manage and cancel your subscription in your account settings.
          </Text>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.background,
  },
  closeBtn: {
    position:        'absolute',
    top:             spacing[5],
    right:           spacing[5],
    width:           36,
    height:          36,
    borderRadius:    radius.full,
    backgroundColor: colors.surface2,
    borderWidth:     1,
    borderColor:     colors.border,
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          10,
  },
  scroll: { flex: 1 },
  content: {
    padding:       spacing[5],
    paddingTop:    spacing[14],
    paddingBottom: spacing[12],
    gap:           spacing[5],
  },

  // Header
  header: {
    alignItems: 'center',
    gap:        spacing[3],
  },
  title: {
    fontFamily:    fontFamily.bold,
    fontSize:      26,
    color:         colors.textPrimary,
    letterSpacing: -0.5,
    textAlign:     'center',
  },
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize:   15,
    color:      colors.textSecondary,
    textAlign:  'center',
    lineHeight: 22,
  },

  // Pro badge
  proBadge: {
    overflow:          'hidden',
    borderRadius:      radius.sm,
    backgroundColor:   colors.gold,
    paddingVertical:   spacing[1],
    paddingHorizontal: spacing[3],
  },
  proBadgeLarge: {
    paddingVertical:   spacing[2],
    paddingHorizontal: spacing[5],
    borderRadius:      radius.md,
  },
  proBadgeText: {
    fontFamily:    fontFamily.bold,
    fontSize:      12,
    color:         colors.white,
    letterSpacing: 1.4,
  },
  proBadgeTextLarge: {
    fontSize:      18,
    letterSpacing: 2,
  },
  shimmerWrap: {
    position: 'absolute',
    top:      0,
    bottom:   0,
    width:    60,
  },
  shimmerGradient: {
    flex: 1,
  },

  // Billing toggle
  billingTrack: {
    flexDirection:  'row',
    alignSelf:      'center',
    borderRadius:   radius.full,
    backgroundColor: colors.surface2,
    borderWidth:    1,
    borderColor:    colors.border,
    padding:        3,
    position:       'relative',
    overflow:       'hidden',
  },
  billingPill: {
    position:        'absolute',
    top:             3,
    left:            3,
    width:           104,
    bottom:          3,
    borderRadius:    radius.full,
    backgroundColor: colors.green700,
  },
  billingLabel: {
    width:           104,
    textAlign:       'center',
    paddingVertical: spacing[2] + 2,
    fontFamily:      fontFamily.semiBold,
    fontSize:        13,
    color:           colors.textMuted,
    zIndex:          1,
  },
  billingLabelActive: {
    color: colors.white,
  },

  // Price
  priceRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            spacing[3],
  },
  priceMain: {
    fontFamily:    fontFamily.bold,
    fontSize:      42,
    color:         colors.textPrimary,
    letterSpacing: -1,
  },
  priceUnit: {
    fontFamily: fontFamily.regular,
    fontSize:   14,
    color:      colors.textMuted,
  },
  priceSaving: {
    fontFamily:      fontFamily.semiBold,
    fontSize:        12,
    color:           colors.green700,
    backgroundColor: colors.green50,
    paddingVertical: 2,
    paddingHorizontal: spacing[2],
    borderRadius:    radius.xs,
    marginTop:       2,
    overflow:        'hidden',
  },

  // CTA
  ctaBtn: {
    backgroundColor: colors.green700,
    borderRadius:    radius.xl,
    paddingVertical: spacing[4] + 2,
    alignItems:      'center',
    ...shadow.md,
  },
  ctaText: {
    fontFamily:    fontFamily.bold,
    fontSize:      17,
    color:         colors.white,
    letterSpacing: -0.2,
  },
  ctaHint: {
    fontFamily: fontFamily.regular,
    fontSize:   12,
    color:      colors.textMuted,
    textAlign:  'center',
    marginTop:  -spacing[2],
  },

  // Feature comparison
  compareCard: {
    backgroundColor: colors.white,
    borderRadius:    radius.xl,
    borderWidth:     1,
    borderColor:     colors.border,
    overflow:        'hidden',
    ...shadow.xs,
  },
  compareHeaderRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:   spacing[3],
    paddingHorizontal: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor:   colors.surface2,
  },
  compareHeaderLabel: {
    fontFamily:    fontFamily.bold,
    fontSize:      12,
    color:         colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    width:         48,
    textAlign:     'center',
  },
  compareHeaderPro: {
    color: colors.green700,
  },
  compareRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:   spacing[3],
    paddingHorizontal: spacing[4],
  },
  compareRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  compareLabel: {
    flex:       1,
    fontFamily: fontFamily.regular,
    fontSize:   14,
    color:      colors.textSecondary,
  },
  compareCheck: {
    width:          48,
    alignItems:     'center',
    justifyContent: 'center',
  },
  compareCheckPro: {
    // nothing extra — icon color handles it
  },

  // Fine print
  finePrint: {
    fontFamily: fontFamily.regular,
    fontSize:   11,
    color:      colors.textMuted,
    textAlign:  'center',
    lineHeight: 17,
  },
});
