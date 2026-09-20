/**
 * Deep-link landing screen.
 *
 * Handles incoming gati://stat/{statId} URLs.
 * Expo Router maps the path automatically once this file exists.
 *
 * Shows:
 *  - The stat definition (title, description)
 *  - The user's own computed value — if a profile exists
 *  - A "Calculate yours" CTA — if no profile (new user via share)
 *  - A "See all your numbers" CTA — if profile exists
 *
 * Design: forest green hero strip + off-white body, spring entrance.
 * No emojis. No purple. No orange. Light mode only.
 */
import React, { useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius, fontFamily, shadow } from '@/theme';
import { useUserStore } from '@/store/userStore';
import { STAT_DEFINITIONS } from '@/data/statDefinitions';
import { computeLifeStats, formatStatNumber } from '@/engine/statsEngine';
import type { LifeStatsOutput } from '@/engine/statsEngine';

// ─── Hero strip ─────────────────────────────────────────────────────
function HeroStrip({
  icon,
  categoryLabel,
  value,
  unit,
  hasValue,
}: {
  icon:          string;
  categoryLabel: string;
  value:         string | null;
  unit:          string;
  hasValue:      boolean;
}) {
  const stripScale   = useSharedValue(0.94);
  const stripOpacity = useSharedValue(0);

  useEffect(() => {
    stripOpacity.value = withTiming(1, { duration: 320 });
    stripScale.value   = withSpring(1, { stiffness: 220, damping: 20 });
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity:   stripOpacity.value,
    transform: [{ scale: stripScale.value }],
  }));

  return (
    <Animated.View style={[styles.heroStrip, style]}>
      {/* Category pill */}
      <View style={styles.heroPill}>
        <Ionicons name={icon as any} size={14} color="rgba(255,255,255,0.70)" />
        <Text style={styles.heroPillText}>{categoryLabel}</Text>
      </View>

      {/* Value */}
      {hasValue && value !== null ? (
        <View style={styles.heroValueBlock}>
          <Text style={styles.heroValue} adjustsFontSizeToFit numberOfLines={1}>
            {value}
          </Text>
          <Text style={styles.heroUnit}>{unit}</Text>
        </View>
      ) : (
        <View style={styles.heroUnknownBlock}>
          <View style={styles.heroLockPill}>
            <Ionicons name="lock-closed-outline" size={16} color="rgba(255,255,255,0.50)" />
            <Text style={styles.heroLockText}>Your number is waiting</Text>
          </View>
        </View>
      )}
    </Animated.View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────
export default function StatDeepLink() {
  const { statId } = useLocalSearchParams<{ statId: string }>();
  const router     = useRouter();
  const profile    = useUserStore((s) => s.profile);

  // Find definition
  const definition = STAT_DEFINITIONS.find((d) => d.id === statId) ?? null;

  // Compute value when profile exists
  let stats: LifeStatsOutput | null = null;
  let formattedValue: string | null = null;

  if (profile && definition) {
    stats = computeLifeStats(profile);
    const raw = stats[definition.formulaKey as keyof LifeStatsOutput];
    if (typeof raw === 'number') {
      formattedValue = formatStatNumber(raw, definition.precision);
    }
  }

  const hasProfile = profile !== null;

  // Content entrance
  const contentOpacity = useSharedValue(0);
  const contentTransY  = useSharedValue(16);

  useEffect(() => {
    contentOpacity.value = withDelay(120, withTiming(1, { duration: 300 }));
    contentTransY.value  = withDelay(120, withSpring(0, { stiffness: 260, damping: 24 }));
  }, []);

  const contentStyle = useAnimatedStyle(() => ({
    opacity:   contentOpacity.value,
    transform: [{ translateY: contentTransY.value }],
  }));

  // ── Error state ──────────────────────────────────────────────
  if (!definition) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.errorState}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.textMuted} />
          <Text style={styles.errorTitle}>Stat not found</Text>
          <Text style={styles.errorSub}>
            This link may be outdated. Open Gati to see your numbers.
          </Text>
          <Pressable
            onPress={() => router.replace('/(tabs)/today')}
            style={styles.errorBtn}
          >
            <Text style={styles.errorBtnText}>Open Gati</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Category label ───────────────────────────────────────────
  const catLabel =
    definition.category.charAt(0).toUpperCase() + definition.category.slice(1);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Close button */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)/today');
          }}
          style={styles.closeBtn}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Ionicons name="close" size={22} color={colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={Platform.OS === 'ios'}
      >
        {/* Hero strip — green card with big number */}
        <HeroStrip
          icon={definition.icon}
          categoryLabel={catLabel}
          value={formattedValue}
          unit={definition.unit}
          hasValue={hasProfile}
        />

        {/* Body */}
        <Animated.View style={[styles.body, contentStyle]}>
          {/* Stat title + description */}
          <Text style={styles.statTitle}>{definition.title}</Text>
          <Text style={styles.statDesc}>{definition.description}</Text>

          {/* Divider */}
          <View style={styles.divider} />

          {/* CTA section */}
          {!hasProfile ? (
            /* New user — guide them to set up a profile */
            <View style={styles.ctaSection}>
              <Text style={styles.ctaTitle}>What's your number?</Text>
              <Text style={styles.ctaSub}>
                Gati calculates your personal life numbers from your birthday
                and a few lifestyle details. Takes less than a minute.
              </Text>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.replace('/onboarding/welcome');
                }}
                style={styles.primaryBtn}
                accessibilityRole="button"
                accessibilityLabel="Calculate your own number"
              >
                <Text style={styles.primaryBtnText}>Calculate mine</Text>
                <Ionicons name="arrow-forward" size={16} color={colors.white} />
              </Pressable>
            </View>
          ) : (
            /* Existing user — send them to Today */
            <View style={styles.ctaSection}>
              <Text style={styles.ctaSub}>
                Your other 22 life stats are waiting on the Today screen.
              </Text>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.replace('/(tabs)/today');
                }}
                style={styles.secondaryBtn}
                accessibilityRole="button"
                accessibilityLabel="See all your numbers"
              >
                <Text style={styles.secondaryBtnText}>See all my numbers</Text>
                <Ionicons name="arrow-forward" size={16} color={colors.green700} />
              </Pressable>
            </View>
          )}

          {/* Gati branding footer */}
          <View style={styles.brandRow}>
            <View style={styles.brandDot}>
              <Text style={styles.brandG}>G</Text>
            </View>
            <Text style={styles.brandName}>Gati</Text>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.background,
  },

  // Top bar
  topBar: {
    flexDirection:  'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing[5],
    paddingTop:     spacing[3],
    paddingBottom:  spacing[2],
  },
  closeBtn: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: colors.surface2,
    borderWidth:     1,
    borderColor:     colors.border,
    alignItems:      'center',
    justifyContent:  'center',
  },

  // Scroll
  scroll: {
    paddingBottom: spacing[10],
  },

  // Hero strip
  heroStrip: {
    marginHorizontal: spacing[5],
    marginBottom:     spacing[5],
    backgroundColor:  colors.green700,
    borderRadius:     radius['2xl'],
    padding:          spacing[6],
    minHeight:        200,
    justifyContent:   'space-between',
    ...shadow.lg,
  },
  heroPill: {
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
  heroPillText: {
    fontFamily: fontFamily.medium,
    fontSize:   11.5,
    color:      'rgba(255,255,255,0.75)',
  },
  heroValueBlock: {
    gap: spacing[1],
  },
  heroValue: {
    fontFamily:    fontFamily.extraBold,
    fontSize:      60,
    color:         colors.white,
    letterSpacing: -2.5,
    lineHeight:    66,
  },
  heroUnit: {
    fontFamily: fontFamily.medium,
    fontSize:   14,
    color:      'rgba(255,255,255,0.60)',
  },
  heroUnknownBlock: {
    flex:           1,
    justifyContent: 'center',
    marginTop:      spacing[6],
  },
  heroLockPill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing[2],
    alignSelf:         'flex-start',
    paddingVertical:   spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius:      radius.lg,
    backgroundColor:   'rgba(255,255,255,0.10)',
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.16)',
  },
  heroLockText: {
    fontFamily: fontFamily.semiBold,
    fontSize:   13,
    color:      'rgba(255,255,255,0.55)',
  },

  // Body
  body: {
    paddingHorizontal: spacing[5],
    gap:               spacing[4],
  },
  statTitle: {
    fontFamily:    fontFamily.bold,
    fontSize:      22.5,
    color:         colors.textPrimary,
    letterSpacing: -0.4,
    lineHeight:    29,
  },
  statDesc: {
    fontFamily: fontFamily.regular,
    fontSize:   14,
    color:      colors.textSecondary,
    lineHeight: 21.5,
  },
  divider: {
    height:          1,
    backgroundColor: colors.borderLight,
    marginVertical:  spacing[1],
  },

  // CTA section
  ctaSection: {
    gap: spacing[4],
  },
  ctaTitle: {
    fontFamily:    fontFamily.bold,
    fontSize:      19,
    color:         colors.textPrimary,
    letterSpacing: -0.3,
  },
  ctaSub: {
    fontFamily: fontFamily.regular,
    fontSize:   13,
    color:      colors.textSecondary,
    lineHeight: 20.5,
  },
  primaryBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               spacing[2],
    backgroundColor:   colors.green700,
    borderRadius:      radius.xl,
    paddingVertical:   spacing[4],
    paddingHorizontal: spacing[6],
    ...shadow.xs,
  },
  primaryBtnText: {
    fontFamily: fontFamily.bold,
    fontSize:   15,
    color:      colors.white,
  },
  secondaryBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               spacing[2],
    backgroundColor:   colors.green50,
    borderRadius:      radius.xl,
    paddingVertical:   spacing[4],
    paddingHorizontal: spacing[6],
    borderWidth:       1,
    borderColor:       colors.green100,
  },
  secondaryBtnText: {
    fontFamily: fontFamily.bold,
    fontSize:   15,
    color:      colors.green700,
  },

  // Branding footer
  brandRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[2],
    justifyContent:'center',
    marginTop:     spacing[4],
  },
  brandDot: {
    width:           24,
    height:          24,
    borderRadius:    12,
    backgroundColor: colors.green700,
    alignItems:      'center',
    justifyContent:  'center',
  },
  brandG: {
    fontFamily: fontFamily.extraBold,
    fontSize:   11.5,
    color:      colors.white,
    lineHeight: 13,
  },
  brandName: {
    fontFamily: fontFamily.semiBold,
    fontSize:   13,
    color:      colors.textMuted,
  },

  // Error state
  errorState: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    padding:        spacing[8],
    gap:            spacing[4],
  },
  errorTitle: {
    fontFamily:  fontFamily.bold,
    fontSize:    19,
    color:       colors.textPrimary,
  },
  errorSub: {
    fontFamily: fontFamily.regular,
    fontSize:   13,
    color:      colors.textSecondary,
    textAlign:  'center',
    lineHeight: 20.5,
  },
  errorBtn: {
    backgroundColor:   colors.green700,
    borderRadius:      radius.xl,
    paddingVertical:   spacing[3],
    paddingHorizontal: spacing[6],
  },
  errorBtnText: {
    fontFamily: fontFamily.bold,
    fontSize:   13,
    color:      colors.white,
  },
});
