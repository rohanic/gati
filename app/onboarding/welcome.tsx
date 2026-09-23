/**
 * Welcome screen — first screen ever seen.
 * Responsive layout via useWindowDimensions.
 * Logo: overflow:hidden wrapper fixes G clipping on Android.
 * Layout: flex distribution (no absolute positioning) so it works
 * on every device height from iPhone SE to iPad.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Image,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { shouldOfferSignIn } from '@/navigation/firstRun';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius, fontFamily } from '@/theme';
import { Text } from '@/components/ui/Text';

export default function WelcomeScreen() {
  const { width, height } = useWindowDimensions();

  // Responsive scale: SE-class (≤667) → small, tall phones → normal, tablets → large
  const isSmall  = height < 700;
  const isLarge  = height > 900;

  const LOGO_SIZE    = isSmall ? 88  : isLarge ? 128 : 108;
  const LOGO_RADIUS  = isSmall ? 20  : isLarge ? 28  : 24;
  const WORD_SIZE    = isSmall ? 52  : isLarge ? 72  : 62;
  const WORD_LS      = isSmall ? -2  : -2.5;
  const TAG_SIZE     = isSmall ? 14  : 16;
  const LOGO_GAP     = isSmall ? spacing[2] : spacing[3];   // logo → wordmark
  const TAG_GAP      = isSmall ? spacing[2] : spacing[3];   // wordmark → tagline

  // ── Animations ──
  const logoScale  = useSharedValue(0.82);
  const logoOp     = useSharedValue(0);
  const wordmarkY  = useSharedValue(24);
  const wordmarkOp = useSharedValue(0);
  const taglineY   = useSharedValue(16);
  const taglineOp  = useSharedValue(0);
  const btnY       = useSharedValue(20);
  const btnOp      = useSharedValue(0);
  const btnScale   = useSharedValue(1);

  useEffect(() => {
    logoScale.value  = withSpring(1, { stiffness: 200, damping: 18 });
    logoOp.value     = withTiming(1, { duration: 380 });

    wordmarkY.value  = withDelay(340, withSpring(0, { stiffness: 200, damping: 18 }));
    wordmarkOp.value = withDelay(340, withTiming(1, { duration: 340 }));

    taglineY.value   = withDelay(500, withSpring(0, { stiffness: 200, damping: 18 }));
    taglineOp.value  = withDelay(500, withTiming(1, { duration: 300 }));

    btnY.value       = withDelay(660, withSpring(0, { stiffness: 200, damping: 18 }));
    btnOp.value      = withDelay(660, withTiming(1, { duration: 300 }));
  }, []);

  const logoStyle     = useAnimatedStyle(() => ({
    opacity:   logoOp.value,
    transform: [{ scale: logoScale.value }],
  }));
  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity:   wordmarkOp.value,
    transform: [{ translateY: wordmarkY.value }],
  }));
  const taglineStyle  = useAnimatedStyle(() => ({
    opacity:   taglineOp.value,
    transform: [{ translateY: taglineY.value }],
  }));
  const btnStyle      = useAnimatedStyle(() => ({
    opacity:   btnOp.value,
    transform: [{ translateY: btnY.value }, { scale: btnScale.value }],
  }));

  // Guard so a fast double-tap can't push /onboarding/name twice. The button
  // bounce runs in parallel; navigation fires immediately.
  const beganRef = useRef(false);
  const handleBegin = () => {
    if (beganRef.current) return;
    beganRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    btnScale.value = withSequence(
      withSpring(0.95, { stiffness: 400, damping: 20 }),
      withSpring(1.0,  { stiffness: 300, damping: 25 })
    );
    // The sign-in offer comes AFTER the intro, and only once: skipped or
    // signed in, it is never shown again.
    router.push(shouldOfferSignIn() ? '/auth?first=1' : '/onboarding/name');
  };

  // The guard above stops a double tap from pushing two screens, but it has
  // to reopen when this screen regains focus — otherwise someone who backs
  // out of the sign-in offer returns to a Begin button that does nothing.
  useFocusEffect(
    useCallback(() => {
      beganRef.current = false;
    }, []),
  );

  return (
    <SafeAreaView style={styles.safe}>

      {/* ── Top spacer — pushes brand block into upper-centre ── */}
      <View style={{ flex: 1 }} />

      {/* ── Brand block ── */}
      <View style={styles.brand}>

        {/* Logo — overflow:hidden ensures borderRadius clips the image
            on Android as well as iOS (plain borderRadius on <Image>
            doesn't clip on Android without this wrapper). */}
        <Animated.View
          style={[
            styles.logoWrap,
            logoStyle,
            {
              width:        LOGO_SIZE,
              height:       LOGO_SIZE,
              borderRadius: LOGO_RADIUS,
              marginBottom: LOGO_GAP,
            },
          ]}
        >
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logoImage}
            resizeMode="cover"
          />
        </Animated.View>

        {/* Wordmark
            lineHeight: 1.3× gives the "g" descender room to breathe.
            paddingBottom: extra safety so the descender loop never clips
            against the text box boundary on any font renderer. */}
        <Animated.Text
          style={[
            styles.wordmark,
            wordmarkStyle,
            {
              fontSize:      WORD_SIZE,
              letterSpacing: WORD_LS,
              lineHeight:    WORD_SIZE * 1.3,
              paddingBottom: WORD_SIZE * 0.08,
              marginBottom:  TAG_GAP,
            },
          ]} maxFontSizeMultiplier={1.4}>
          gati
        </Animated.Text>

        {/* Tagline */}
        <Animated.Text
          style={[styles.tagline, taglineStyle, { fontSize: TAG_SIZE }]} maxFontSizeMultiplier={1.4}>
          Your life, in numbers.
        </Animated.Text>

      </View>

      {/* ── Bottom spacer — twice the top so brand sits above centre ── */}
      <View style={{ flex: 2 }} />

      {/* ── CTA — always at bottom, no absolute positioning ── */}
      <Animated.View
        style={[
          styles.ctaWrap,
          btnStyle,
          { paddingHorizontal: spacing[6], paddingBottom: spacing[4] },
        ]}
      >
        <Pressable
          onPress={handleBegin}
          style={({ pressed }) => [styles.beginBtn, pressed && { opacity: 0.9 }]}
          accessibilityRole="button"
          accessibilityLabel="Begin"
        >
          <Text style={styles.beginText}>Begin</Text>
        </Pressable>
        <Text style={styles.legalNote}>
          No account needed · Your data stays on your device
        </Text>
      </Animated.View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.background,
    alignItems:      'center',
  },

  // ── Brand
  brand: {
    alignItems: 'center',
  },

  // Logo wrapper — overflow:hidden is the fix for G clipping
  logoWrap: {
    overflow: 'hidden',
    // width / height / borderRadius / marginBottom injected inline (responsive)
  },
  logoImage: {
    width:  '100%',
    height: '100%',
  },

  // Wordmark — fontSize / letterSpacing / lineHeight / marginBottom inline
  wordmark: {
    fontFamily: fontFamily.extraBold,
    color:      colors.textPrimary,
  },

  tagline: {
    fontFamily:    fontFamily.regular,
    color:         colors.textSecondary,
    letterSpacing: 0.15,
  },

  // CTA
  ctaWrap: {
    width:      '100%',
    alignItems: 'center',
    gap:        spacing[3],
  },
  beginBtn: {
    width:           '100%',
    paddingVertical: spacing[5],
    backgroundColor: colors.green700,
    borderRadius:    radius.xl,
    alignItems:      'center',
    shadowColor:     colors.green900,
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.18,
    shadowRadius:    12,
    elevation:       6,
  },
  beginText: {
    fontFamily:    fontFamily.bold,
    fontSize:      16,
    color:         colors.white,
    letterSpacing: 0.2,
  },
  legalNote: {
    fontFamily: fontFamily.regular,
    fontSize:   11.5,
    color:      colors.textMuted,
    textAlign:  'center',
  },
});
