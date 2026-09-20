/**
 * Pro upgrade modal — /pro
 *
 * Presented as a slide-from-bottom modal (see app/_layout.tsx).
 * Can be pushed from anywhere: profile, locked features, share cards.
 *
 * Matches profile.tsx upgrade card design but full-screen with a
 * proper close button and expanded feature comparison table.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
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
import { useProStatus, useTrialDaysLeft, FREE_SAVE_LIMIT } from '@/store/userStore';
import { useAuthStore } from '@/store/authStore';
import { PRIVACY_POLICY_URL, TERMS_URL, PLAY_SUBSCRIPTIONS_URL } from '@/config';
import {
  initIAP,
  getSubscriptions,
  getDisplayPrice,
  purchaseSubscription,
  restorePurchases,
  openSubscriptionManagement,
  PurchaseCancelledError,
  BillingUnavailableError,
  PRODUCT_IDS,
} from '@/services/purchaseService';
import type { ProductSubscription } from 'expo-iap';

// ─── Feature comparison rows ─────────────────────────────────
// Every `free: false` row below must correspond to real gating in the app.
// Advertising a paid feature that is actually free (or vice versa) is both a
// trust problem and a store-review problem.
const FEATURES: { label: string; free: boolean; pro: boolean }[] = [
  { label: 'Daily life stat',                  free: true,  pro: true  },
  { label: 'All 25 stats, always open',        free: false, pro: true  },
  { label: 'What-if projections',              free: false, pro: true  },
  { label: 'Wander place discovery',           free: true,  pro: true  },
  { label: 'Full story timeline',              free: false, pro: true  },
  { label: `Unlimited saved places`,           free: false, pro: true  },
  { label: 'Stat share cards',                 free: true,  pro: true  },
  { label: 'Milestone celebrations',           free: true,  pro: true  },
  { label: 'Streak tracking',                  free: true,  pro: true  },
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
  const [isMonthly,   setIsMonthly]   = useState(true);
  const [purchasing,  setPurchasing]  = useState(false);
  const [restoring,   setRestoring]   = useState(false);
  const [products,    setProducts]    = useState<ProductSubscription[]>([]);
  const [iapReady,    setIapReady]    = useState<boolean | null>(null);

  const userId        = useAuthStore((s) => s.userId);
  const proStatus     = useProStatus();
  const trialDaysLeft = useTrialDaysLeft();

  // Open the store connection and fetch real, localised prices.
  useEffect(() => {
    let cancelled = false;
    initIAP().then(async (ok) => {
      if (cancelled) return;
      setIapReady(ok);
      if (!ok) return;
      const subs = await getSubscriptions();
      if (!cancelled) setProducts(subs);
    });
    return () => { cancelled = true; };
  }, []);

  const monthlyProduct = products.find((p) => p.id === PRODUCT_IDS.monthly);
  const annualProduct  = products.find((p) => p.id === PRODUCT_IDS.annual);

  // Never invent a price. If the store has not answered yet we show a
  // placeholder rather than a hard-coded USD figure, which would be wrong for
  // every user outside the US and breaches both stores' pricing rules.
  // Checked per plan, not just "did anything load": the store can return one
  // product and not the other, and a bare em dash at 40px reads as a glitch.
  const monthlyPrice = monthlyProduct ? getDisplayPrice(monthlyProduct, '') : '';
  const annualPrice  = annualProduct  ? getDisplayPrice(annualProduct,  '') : '';
  const activePrice  = isMonthly ? monthlyPrice : annualPrice;
  const priceReady   = activePrice.length > 0;

  const handlePurchase = useCallback(async () => {
    if (iapReady === false) {
      Alert.alert(
        'Purchases unavailable',
        'Could not reach Google Play. Check your connection, make sure the Play Store app is up to date, and try again.',
      );
      return;
    }
    if (!userId) {
      Alert.alert(
        'Sign in first',
        'Subscribing links Pro to your account so it follows you to a new phone. It only takes a moment.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Sign in', onPress: () => router.push('/auth') },
        ],
      );
      return;
    }

    setPurchasing(true);
    try {
      const result = await purchaseSubscription(
        isMonthly ? PRODUCT_IDS.monthly : PRODUCT_IDS.annual,
      );
      if (result.isPro) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('You’re on Pro', 'Every number, every memory, no limits.');
        router.back();
      } else {
        Alert.alert(
          'Purchase not active yet',
          'Google Play has not confirmed the payment. If it completes, Pro unlocks automatically — no need to pay again.',
        );
      }
    } catch (e) {
      if (e instanceof PurchaseCancelledError) return;   // user backed out
      const msg = e instanceof BillingUnavailableError
        ? e.message
        : (e as Error)?.message ?? 'Purchase failed';
      Alert.alert('Purchase failed', msg);
    } finally {
      setPurchasing(false);
    }
  }, [isMonthly, userId, iapReady]);

  /**
   * Restore an existing subscription.
   *
   * Required by App Store Review Guideline 3.1.1 and the correct recovery
   * path on Play after a reinstall or device change.
   */
  const handleRestore = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!userId) {
      Alert.alert('Sign in first', 'Sign in with the account you subscribed on, then restore.');
      return;
    }
    setRestoring(true);
    try {
      const restored = await restorePurchases();
      if (restored) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Pro restored', 'Welcome back. Everything is unlocked again.');
        router.back();
      } else {
        Alert.alert(
          'Nothing to restore',
          'No active Gati subscription was found on this store account. If you subscribed with a different account, switch to it and try again.',
        );
      }
    } catch (e) {
      const msg = e instanceof BillingUnavailableError
        ? e.message
        : (e as Error)?.message ?? 'Could not restore purchases.';
      Alert.alert('Restore failed', msg);
    } finally {
      setRestoring(false);
    }
  }, [userId]);

  const handleManage = useCallback(async () => {
    await openSubscriptionManagement(
      isMonthly ? PRODUCT_IDS.monthly : PRODUCT_IDS.annual,
    );
    // Fall back to the web subscription centre if the deep link is unsupported.
    Linking.canOpenURL(PLAY_SUBSCRIPTIONS_URL).then((can) => {
      if (can) Linking.openURL(PLAY_SUBSCRIPTIONS_URL).catch(() => {});
    });
  }, [isMonthly]);

  const openLink = useCallback((url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert('Could not open link', url);
    });
  }, []);

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
        {/*
          `styles.stack` carries the vertical rhythm. It used to sit on the
          ScrollView's contentContainerStyle, whose only child is this wrapper —
          so the gap applied to nothing and every section rendered flush against
          the next. Combined with the negative margins that were compensating
          for it, text ended up drawn underneath the CTA button.
        */}
        <Animated.View style={[styles.stack, contentStyle]}>
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

          {/* Price — never invented locally; always the store's own figure. */}
          <View style={styles.priceRow}>
            {priceReady ? (
              <>
                <Text style={styles.priceMain} maxFontSizeMultiplier={1.0}>
                  {activePrice}
                </Text>
                <View>
                  <Text style={styles.priceUnit}>{isMonthly ? 'per month' : 'per year'}</Text>
                  {!isMonthly && <Text style={styles.priceSaving}>Save vs monthly</Text>}
                </View>
              </>
            ) : (
              // A bare em dash at 40px read as a stray line. Show an honest
              // placeholder sized like the real price so the layout does not
              // jump when it arrives.
              <View style={styles.priceSkeletonRow}>
                <View style={styles.priceSkeleton} />
                <Text style={styles.priceUnit}>
                  {iapReady === false ? 'Price unavailable' : 'Loading price\u2026'}
                </Text>
              </View>
            )}
          </View>

          {/* CTA block — button, its supporting copy, and the secondary
              action are one visual unit with their own tighter rhythm. */}
          <View style={styles.ctaBlock}>
            {proStatus === 'pro' ? (
              <>
                <View style={[styles.ctaBtn, styles.ctaBtnOwned]}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.green700} />
                  <Text style={[styles.ctaText, { color: colors.green700 }]}>
                    You&rsquo;re on Pro
                  </Text>
                </View>
                <Pressable
                  onPress={handleManage}
                  style={styles.secondaryBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Manage or cancel your subscription"
                >
                  <Text style={styles.secondaryBtnText}>Manage subscription</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable
                  style={[styles.ctaBtn, purchasing && styles.ctaBtnBusy]}
                  onPress={handlePurchase}
                  disabled={purchasing || restoring}
                  android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: purchasing || restoring, busy: purchasing }}
                >
                  {purchasing
                    ? <ActivityIndicator size="small" color={colors.white} />
                    : <Text style={styles.ctaText}>
                        {proStatus === 'trial' ? 'Subscribe now' : 'Go Pro'}
                      </Text>
                  }
                </Pressable>

                {/* Where the user stands, then how billing works. At most two
                    short lines — they sit BELOW the button, never behind it. */}
                {proStatus === 'trial' && (
                  <Text style={styles.ctaHint}>
                    {trialDaysLeft === 1
                      ? 'Last day of your free trial'
                      : `${trialDaysLeft} days left in your free trial`}
                  </Text>
                )}

                <Text style={[styles.ctaHint, iapReady === false && styles.ctaHintWarn]}>
                  {iapReady === false
                    ? 'Could not reach Google Play \u2014 check your connection and try again.'
                    : 'Cancel anytime in Google Play'}
                </Text>

                {/* Restore — required by App Store guideline 3.1.1, and the
                    right recovery path on Play after a reinstall. */}
                <Pressable
                  onPress={handleRestore}
                  disabled={restoring || purchasing}
                  style={styles.secondaryBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Restore a previous purchase"
                  accessibilityState={{ disabled: restoring || purchasing, busy: restoring }}
                >
                  {restoring
                    ? <ActivityIndicator size="small" color={colors.green700} />
                    : <Text style={styles.secondaryBtnText}>Restore purchase</Text>
                  }
                </Pressable>
              </>
            )}
          </View>

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

          {/* Legal block — the renewal disclosure and the links it refers to
              are one unit. They previously overlapped: `legalRow` carried a
              negative top margin to compensate for a container gap that was
              never actually applied. */}
          <View style={styles.legalBlock}>
            {/* Fine print — both stores require the renewal terms to be
                disclosed on the purchase screen itself, next to the price. */}
            <Text style={styles.finePrint}>
            Gati Pro is an auto-renewing subscription
            {priceReady
              ? ` billed at ${activePrice} ${isMonthly ? 'per month' : 'per year'}`
              : ''}
            . Payment is charged to your {Platform.OS === 'android' ? 'Google Play' : 'Apple'} account
            at confirmation of purchase. It renews automatically at the same price unless cancelled
            at least 24 hours before the end of the current period. Manage or cancel any time from
              your {Platform.OS === 'android' ? 'Google Play' : 'App Store'} account settings.
            </Text>

            {/* Legal links — a reachable privacy policy is mandatory for both
                stores; the subscription terms must also be linked from here. */}
            <View style={styles.legalRow}>
              <Pressable
                onPress={() => openLink(TERMS_URL)}
                hitSlop={8}
                accessibilityRole="link"
                accessibilityLabel="Read the terms of service"
              >
                <Text style={styles.legalLink}>Terms of Service</Text>
              </Pressable>
              <Text style={styles.legalDot}>·</Text>
              <Pressable
                onPress={() => openLink(PRIVACY_POLICY_URL)}
                hitSlop={8}
                accessibilityRole="link"
                accessibilityLabel="Read the privacy policy"
              >
              <Text style={styles.legalLink}>Privacy Policy</Text>
              </Pressable>
            </View>
          </View>
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
    // Generous: this is the last thing on a long scroll and the legal copy
    // was being clipped by the safe-area inset.
    paddingBottom: spacing[16],
  },
  /**
   * The actual vertical rhythm. This lives on the Animated.View that holds the
   * sections — putting it on `content` did nothing, because the ScrollView's
   * content container has exactly one child.
   */
  stack: {
    gap: spacing[5],
  },

  // Header
  header: {
    alignItems: 'center',
    gap:        spacing[3],
  },
  title: {
    fontFamily:    fontFamily.bold,
    fontSize:      24.5,
    color:         colors.textPrimary,
    letterSpacing: -0.5,
    textAlign:     'center',
  },
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize:   14,
    color:      colors.textSecondary,
    textAlign:  'center',
    lineHeight: 20.5,
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
    fontSize:      11.5,
    color:         colors.white,
    letterSpacing: 1.4,
  },
  proBadgeTextLarge: {
    fontSize:      17,
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
    fontSize:        12,
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
    fontSize:      39.5,
    color:         colors.textPrimary,
    letterSpacing: -1,
  },
  priceUnit: {
    fontFamily: fontFamily.regular,
    fontSize:   13,
    color:      colors.textMuted,
  },
  priceSkeletonRow: {
    alignItems: 'center',
    gap:        spacing[2],
  },
  /** Sized like the real price so the layout does not jump when it arrives. */
  priceSkeleton: {
    width:           132,
    height:          34,
    borderRadius:    radius.sm,
    backgroundColor: colors.surface2,
  },
  priceSaving: {
    fontFamily:      fontFamily.semiBold,
    fontSize:        11.5,
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
    fontSize:      16,
    color:         colors.white,
    letterSpacing: -0.2,
  },
  ctaBtnOwned: {
    backgroundColor: colors.green50,
    borderWidth:     1,
    borderColor:     colors.green700,
    flexDirection:   'row',
    justifyContent:  'center',
    gap:             spacing[2],
  },
  ctaBlock: {
    gap: spacing[3],
  },
  ctaBtnBusy: {
    opacity: 0.7,
  },
  ctaHint: {
    fontFamily: fontFamily.regular,
    fontSize:   12,
    lineHeight: 17,
    color:      colors.textMuted,
    textAlign:  'center',
  },
  ctaHintWarn: {
    color: colors.error,
  },
  secondaryBtn: {
    alignSelf:       'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[5],
    minHeight:       44,          // accessible touch target
    justifyContent:  'center',
  },
  secondaryBtnText: {
    fontFamily:     fontFamily.semiBold,
    fontSize:       13,
    color:          colors.green700,
    textAlign:      'center',
  },
  legalBlock: {
    gap: spacing[3],
  },
  legalRow: {
    flexDirection:  'row',
    justifyContent: 'center',
    alignItems:     'center',
    gap:            spacing[2],
  },
  legalLink: {
    fontFamily:          fontFamily.medium,
    fontSize:            11.5,
    color:               colors.textSecondary,
    textDecorationLine:  'underline',
  },
  legalDot: {
    fontFamily: fontFamily.regular,
    fontSize:   11.5,
    color:      colors.textMuted,
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
    fontSize:      11.5,
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
    fontSize:   13,
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
    // 10.5px was below the ~11px floor where this much dense legal copy stays
    // comfortably readable, and both stores expect the renewal terms to be
    // legible rather than technically present.
    fontSize:   11.5,
    color:      colors.textSecondary,
    textAlign:  'center',
    lineHeight: 17,
  },
});
