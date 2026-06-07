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
  withRepeat,
  withSequence,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useUserStore } from '@/store/userStore';
import { colors, spacing, radius, fontFamily } from '@/theme';

// ─── Confetti particle ─────────────────────────────────────────
function Particle({
  angle,
  distance,
  color,
  size,
  delay,
}: {
  angle:    number;
  distance: number;
  color:    string;
  size:     number;
  delay:    number;
}) {
  const x       = useSharedValue(0);
  const y       = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale   = useSharedValue(0);

  useEffect(() => {
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;

    opacity.value = withDelay(delay, withSequence(
      withTiming(1, { duration: 200 }),
      withDelay(400, withTiming(0, { duration: 500 }))
    ));
    scale.value = withDelay(delay, withSpring(1, { stiffness: 300, damping: 25 }));
    x.value     = withDelay(delay, withSpring(dx, { stiffness: 120, damping: 15 }));
    y.value     = withDelay(delay, withSpring(dy, { stiffness: 120, damping: 15 }));
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { scale:      scale.value },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.particle,
        style,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
      ]}
    />
  );
}

const PARTICLE_COLORS = [
  colors.green700, colors.green500, colors.gold, colors.green300, '#6B7FD7',
];
const PARTICLES = Array.from({ length: 16 }, (_, i) => ({
  angle:    (i / 16) * Math.PI * 2,
  distance: 80 + Math.random() * 60,
  color:    PARTICLE_COLORS[i % PARTICLE_COLORS.length],
  size:     6 + Math.random() * 6,
  delay:    Math.random() * 200,
}));

// ─── Screen ───────────────────────────────────────────────────
export default function CompleteScreen() {
  const { firstName, reset: resetOnboarding } = useOnboardingStore();
  const { setOnboardingDone } = useUserStore();

  // ── Animations ──
  const checkScale   = useSharedValue(0.4);
  const checkOpacity = useSharedValue(0);
  const ringScale    = useSharedValue(0.6);
  const ringOpacity  = useSharedValue(0);
  const titleOp      = useSharedValue(0);
  const titleY       = useSharedValue(20);
  const subOp        = useSharedValue(0);
  const locationOp   = useSharedValue(0);
  const locationY    = useSharedValue(16);
  const btnOp        = useSharedValue(0);
  const btnY         = useSharedValue(20);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    checkScale.value   = withSpring(1, { stiffness: 300, damping: 25 });
    checkOpacity.value = withTiming(1, { duration: 350 });

    ringOpacity.value = withDelay(100, withTiming(1, { duration: 300 }));
    ringScale.value   = withDelay(100, withRepeat(
      withSequence(
        withTiming(1.35, { duration: 1800 }),
        withTiming(0.95, { duration: 1800 })
      ),
      -1,
      true
    ));

    titleOp.value = withDelay(300, withTiming(1, { duration: 380 }));
    titleY.value  = withDelay(300, withSpring(0, { stiffness: 180, damping: 18 }));

    subOp.value = withDelay(480, withTiming(1, { duration: 340 }));

    locationOp.value = withDelay(700, withTiming(1, { duration: 320 }));
    locationY.value  = withDelay(700, withSpring(0, { stiffness: 200, damping: 18 }));

    btnOp.value = withDelay(900, withTiming(1, { duration: 320 }));
    btnY.value  = withDelay(900, withSpring(0, { stiffness: 200, damping: 18 }));
  }, []);

  const checkStyle    = useAnimatedStyle(() => ({
    opacity:   checkOpacity.value,
    transform: [{ scale: checkScale.value }],
  }));
  const ringStyle     = useAnimatedStyle(() => ({
    opacity:   ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));
  const titleStyle    = useAnimatedStyle(() => ({
    opacity:   titleOp.value,
    transform: [{ translateY: titleY.value }],
  }));
  const subStyle      = useAnimatedStyle(() => ({ opacity: subOp.value }));
  const locationStyle = useAnimatedStyle(() => ({
    opacity:   locationOp.value,
    transform: [{ translateY: locationY.value }],
  }));
  const btnStyle      = useAnimatedStyle(() => ({
    opacity:   btnOp.value,
    transform: [{ translateY: btnY.value }],
  }));

  const handleLocationAllow = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Location.requestForegroundPermissionsAsync();
    } catch (_) {}
    launch();
  };

  const launch = () => {
    resetOnboarding();
    setOnboardingDone();
    router.replace('/(tabs)/today');
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── Confetti ── */}
      <View style={styles.particleOrigin} pointerEvents="none">
        {PARTICLES.map((p, i) => (
          <Particle key={i} {...p} />
        ))}
      </View>

      {/* ── Check circle ── */}
      <View style={styles.checkCluster}>
        <Animated.View style={[styles.checkRing, ringStyle]} />
        <Animated.View style={[styles.checkCircle, checkStyle]}>
          <Ionicons name="checkmark" size={38} color={colors.white} />
        </Animated.View>
      </View>

      {/* ── Title ── */}
      <Animated.View style={[styles.titleBlock, titleStyle]}>
        <Text style={styles.welcomeText}>Welcome to Gati,</Text>
        <Text style={styles.nameText}>{firstName || 'explorer'}</Text>
      </Animated.View>

      <Animated.Text style={[styles.subtitle, subStyle]}>
        Your first life stat unlocks today.{'\n'}Check back each day for a new one.
      </Animated.Text>

      {/* ── Location card ── */}
      <Animated.View style={[styles.locationCard, locationStyle]}>
        <View style={styles.locationIcon}>
          <Ionicons name="location-outline" size={22} color={colors.green700} />
        </View>
        <View style={styles.locationText}>
          <Text style={styles.locationTitle}>Enable location</Text>
          <Text style={styles.locationSub}>
            Lets Wander find hidden gems near you
          </Text>
        </View>
      </Animated.View>

      {/* ── CTA buttons ── */}
      <Animated.View style={[styles.buttons, btnStyle]}>
        <Pressable
          onPress={handleLocationAllow}
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
        >
          <Text style={styles.primaryText}>Allow location & explore</Text>
        </Pressable>

        <Pressable
          onPress={launch}
          style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.ghostText}>Maybe later</Text>
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}

const CHECK_SIZE = 88;
const RING_SIZE  = CHECK_SIZE * 2;

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.background,
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: spacing[6],
  },

  // Particles
  particleOrigin: {
    position:       'absolute',
    top:            '35%',
    alignSelf:      'center',
    alignItems:     'center',
    justifyContent: 'center',
  },
  particle: {
    position: 'absolute',
  },

  // Check
  checkCluster: {
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   spacing[8],
  },
  checkRing: {
    position:        'absolute',
    width:           RING_SIZE,
    height:          RING_SIZE,
    borderRadius:    RING_SIZE / 2,
    borderWidth:     1.5,
    borderColor:     colors.green300,
    backgroundColor: colors.green50,
  },
  checkCircle: {
    width:           CHECK_SIZE,
    height:          CHECK_SIZE,
    borderRadius:    CHECK_SIZE / 2,
    backgroundColor: colors.green700,
    alignItems:      'center',
    justifyContent:  'center',
    elevation:       10,
    shadowColor:     colors.green900,
    shadowOffset:    { width: 0, height: 6 },
    shadowOpacity:   0.22,
    shadowRadius:    16,
  },

  // Title
  titleBlock: {
    alignItems:   'center',
    marginBottom: spacing[3],
  },
  welcomeText: {
    fontFamily:    fontFamily.regular,
    fontSize:      22,
    color:         colors.textSecondary,
    textAlign:     'center',
    letterSpacing: -0.2,
  },
  nameText: {
    fontFamily:    fontFamily.extraBold,
    fontSize:      30,
    color:         colors.textPrimary,
    textAlign:     'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily:   fontFamily.regular,
    fontSize:     15,
    color:        colors.textSecondary,
    textAlign:    'center',
    lineHeight:   22,
    marginBottom: spacing[7],
  },

  // Location card
  locationCard: {
    flexDirection:     'row',
    alignItems:        'center',
    width:             '100%',
    backgroundColor:   colors.green50,
    borderRadius:      radius.xl,
    borderWidth:       1,
    borderColor:       colors.green100,
    padding:           spacing[4],
    gap:               spacing[3],
    marginBottom:      spacing[6],
  },
  locationIcon: {
    width:           44,
    height:          44,
    borderRadius:    radius.lg,
    backgroundColor: colors.white,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     colors.green100,
  },
  locationText: { flex: 1 },
  locationTitle: {
    fontFamily:   fontFamily.semiBold,
    fontSize:     15,
    color:        colors.textPrimary,
    marginBottom: 2,
  },
  locationSub: {
    fontFamily: fontFamily.regular,
    fontSize:   13,
    color:      colors.textSecondary,
  },

  // Buttons
  buttons: {
    width: '100%',
    gap:   spacing[3],
  },
  primaryBtn: {
    backgroundColor: colors.green700,
    borderRadius:    radius.xl,
    paddingVertical: spacing[5],
    alignItems:      'center',
    elevation:       4,
    shadowColor:     colors.green900,
    shadowOffset:    { width: 0, height: 3 },
    shadowOpacity:   0.15,
    shadowRadius:    8,
  },
  btnPressed: {
    opacity:   0.88,
    transform: [{ scale: 0.98 }],
  },
  primaryText: {
    fontFamily:    fontFamily.bold,
    fontSize:      17,
    color:         colors.white,
    letterSpacing: 0.2,
  },
  ghostBtn: {
    alignItems:      'center',
    paddingVertical: spacing[3],
  },
  ghostText: {
    fontFamily: fontFamily.medium,
    fontSize:   15,
    color:      colors.textMuted,
  },
});
