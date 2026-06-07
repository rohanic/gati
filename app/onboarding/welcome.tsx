import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  withSequence,
  withRepeat,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius, fontFamily } from '@/theme';

export default function WelcomeScreen() {
  // ── Animation shared values ──
  const logoScale   = useSharedValue(0.55);
  const logoOpacity = useSharedValue(0);
  const ringScale   = useSharedValue(0.8);
  const ringOpacity = useSharedValue(0);
  const titleY      = useSharedValue(32);
  const titleOp     = useSharedValue(0);
  const taglineY    = useSharedValue(24);
  const taglineOp   = useSharedValue(0);
  const btnY        = useSharedValue(28);
  const btnOp       = useSharedValue(0);

  useEffect(() => {
    // Logo entrance
    logoScale.value   = withSpring(1, { stiffness: 180, damping: 18 });
    logoOpacity.value = withTiming(1, { duration: 400 });

    // Pulsing ring (continuous)
    ringOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));
    ringScale.value   = withDelay(
      200,
      withRepeat(
        withSequence(
          withTiming(1.35, { duration: 1600 }),
          withTiming(1.0,  { duration: 1600 })
        ),
        -1,
        true
      )
    );

    // Title
    titleY.value  = withDelay(250, withSpring(0, { stiffness: 200, damping: 18 }));
    titleOp.value = withDelay(250, withTiming(1, { duration: 380 }));

    // Tagline
    taglineY.value  = withDelay(420, withSpring(0, { stiffness: 200, damping: 18 }));
    taglineOp.value = withDelay(420, withTiming(1, { duration: 340 }));

    // Button
    btnY.value  = withDelay(600, withSpring(0, { stiffness: 200, damping: 18 }));
    btnOp.value = withDelay(600, withTiming(1, { duration: 340 }));
  }, []);

  const logoStyle    = useAnimatedStyle(() => ({
    opacity:   logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const ringStyle    = useAnimatedStyle(() => ({
    opacity:   ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));
  const titleStyle   = useAnimatedStyle(() => ({
    opacity:   titleOp.value,
    transform: [{ translateY: titleY.value }],
  }));
  const taglineStyle = useAnimatedStyle(() => ({
    opacity:   taglineOp.value,
    transform: [{ translateY: taglineY.value }],
  }));
  const btnStyle     = useAnimatedStyle(() => ({
    opacity:   btnOp.value,
    transform: [{ translateY: btnY.value }],
  }));

  const handleBegin = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/onboarding/name');
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* ─── Hero ─── */}
      <View style={styles.hero}>
        {/* Pulsing outer ring */}
        <Animated.View style={[styles.ring, ringStyle]} />

        {/* Logo circle */}
        <Animated.View style={[styles.logoCircle, logoStyle]}>
          <Text style={styles.logoLetter}>G</Text>
        </Animated.View>
      </View>

      {/* ─── Copy ─── */}
      <View style={styles.copy}>
        <Animated.Text style={[styles.appName, titleStyle]}>Gati</Animated.Text>
        <Animated.Text style={[styles.tagline, taglineStyle]}>
          Your life,{'\n'}in numbers and places.
        </Animated.Text>
      </View>

      {/* ─── CTA ─── */}
      <Animated.View style={[styles.ctaWrap, btnStyle]}>
        <Pressable
          onPress={handleBegin}
          style={({ pressed }) => [styles.beginBtn, pressed && styles.beginBtnPressed]}
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

const LOGO_SIZE = 96;
const RING_SIZE = LOGO_SIZE * 1.9;

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.background,
    alignItems:      'center',
    justifyContent:  'center',
  },

  // Hero
  hero: {
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   spacing[10],
  },
  ring: {
    position:        'absolute',
    width:           RING_SIZE,
    height:          RING_SIZE,
    borderRadius:    RING_SIZE / 2,
    borderWidth:     1.5,
    borderColor:     colors.green300,
    backgroundColor: colors.green50,
  },
  logoCircle: {
    width:           LOGO_SIZE,
    height:          LOGO_SIZE,
    borderRadius:    LOGO_SIZE / 2,
    backgroundColor: colors.green700,
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     colors.green900,
    shadowOffset:    { width: 0, height: 8 },
    shadowOpacity:   0.22,
    shadowRadius:    18,
    elevation:       12,
  },
  logoLetter: {
    fontFamily: fontFamily.extraBold,
    fontSize:   48,
    color:      colors.white,
    lineHeight: 56,
  },

  // Copy
  copy: {
    alignItems:    'center',
    marginBottom:  spacing[14],
    paddingHorizontal: spacing[8],
  },
  appName: {
    fontFamily:   fontFamily.extraBold,
    fontSize:     48,
    color:        colors.textPrimary,
    letterSpacing: -1,
    marginBottom: spacing[3],
  },
  tagline: {
    fontFamily: fontFamily.regular,
    fontSize:   18,
    color:      colors.textSecondary,
    textAlign:  'center',
    lineHeight: 27,
  },

  // CTA
  ctaWrap: {
    position:          'absolute',
    bottom:            spacing[10],
    left:              spacing[6],
    right:             spacing[6],
    alignItems:        'center',
    gap:               spacing[3],
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
  beginBtnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  beginText: {
    fontFamily: fontFamily.bold,
    fontSize:   17,
    color:      colors.white,
    letterSpacing: 0.2,
  },
  legalNote: {
    fontFamily: fontFamily.regular,
    fontSize:   12,
    color:      colors.textMuted,
    textAlign:  'center',
  },
});
