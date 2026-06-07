/**
 * MilestoneModal — full-screen celebration overlay.
 *
 * Shown when the user earns a milestone (streak, days alive, etc.).
 * Features:
 *  - 40 falling confetti-like particles (Reanimated 3 spring + timing)
 *  - Icon scale-in with continuous idle pulse
 *  - Typewriter headline, fade-in subtitle
 *  - Share (native) + Continue buttons
 *  - Heavy haptic on entry
 *
 * NO emojis. NO purple. NO orange.
 * Forest green + gold palette.
 */
import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  Dimensions,
  Share,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius, fontFamily } from '@/theme';
import type { MilestoneDef } from '@/engine/milestoneEngine';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ─── Confetti particle config ─────────────────────────────────
const PARTICLE_COUNT = 40;
const PARTICLE_COLORS = [
  colors.green500, colors.green300, colors.gold, colors.goldLight,
  colors.green700, colors.green100,
];

interface ParticleConfig {
  id:      number;
  x:       number;       // left % (0–100)
  color:   string;
  delay:   number;       // ms
  size:    number;
  isCircle: boolean;
}

function makeParticles(): ParticleConfig[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id:       i,
    x:        Math.random() * 100,
    color:    PARTICLE_COLORS[i % PARTICLE_COLORS.length],
    delay:    Math.floor(Math.random() * 600),
    size:     Math.random() > 0.5 ? 8 : 12,
    isCircle: Math.random() > 0.4,
  }));
}

// ─── Single particle ──────────────────────────────────────────
function Particle({ cfg }: { cfg: ParticleConfig }) {
  const translateY  = useSharedValue(-20);
  const translateX  = useSharedValue(0);
  const rotate      = useSharedValue(0);
  const opacity     = useSharedValue(0);

  useEffect(() => {
    const drift = (Math.random() - 0.5) * 80;
    translateY.value = withDelay(
      cfg.delay,
      withTiming(SCREEN_H + 40, { duration: 2400 + Math.random() * 1200, easing: Easing.bezier(0.11, 0, 0.5, 0) })
    );
    translateX.value = withDelay(
      cfg.delay,
      withTiming(drift, { duration: 2800, easing: Easing.bezier(0.5, 1, 0.89, 1) })
    );
    rotate.value = withDelay(
      cfg.delay,
      withRepeat(withTiming(360, { duration: 900 + Math.random() * 600 }), -1, false)
    );
    opacity.value = withDelay(
      cfg.delay,
      withSequence(
        withTiming(1, { duration: 200 }),
        withDelay(1600 + Math.random() * 600, withTiming(0, { duration: 400 }))
      )
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position:        'absolute',
          left:            `${cfg.x}%` as any,
          top:             0,
          width:           cfg.size,
          height:          cfg.size,
          borderRadius:    cfg.isCircle ? cfg.size / 2 : 2,
          backgroundColor: cfg.color,
        },
        style,
      ]}
    />
  );
}

// ─── Milestone icon ───────────────────────────────────────────
function MilestoneIcon({ def }: { def: MilestoneDef }) {
  const scale    = useSharedValue(0);
  const pulse    = useSharedValue(1);

  useEffect(() => {
    scale.value = withDelay(300, withSpring(1, { stiffness: 180, damping: 15 }));
    pulse.value = withDelay(
      800,
      withRepeat(
        withSequence(
          withTiming(1.06, { duration: 900 }),
          withTiming(1.0,  { duration: 900 })
        ),
        -1,
        true
      )
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * pulse.value }],
  }));

  return (
    <Animated.View style={[styles.iconOuter, { backgroundColor: def.iconBg }, style]}>
      <Ionicons name={def.icon as any} size={48} color={def.iconColor} />
    </Animated.View>
  );
}

// ─── Typewriter text ──────────────────────────────────────────
function TypewriterText({
  text,
  onDone,
  delay = 500,
}: {
  text:    string;
  onDone?: () => void;
  delay?:  number;
}) {
  const [displayed, setDisplayed] = useState('');

  useEffect(() => {
    setDisplayed('');
    let i     = 0;
    let timer = setTimeout(() => {
      const interval = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) {
          clearInterval(interval);
          onDone?.();
        }
      }, 38);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(timer);
  }, [text]);

  return <Text style={styles.headline}>{displayed}</Text>;
}

// ─── Main component ───────────────────────────────────────────
interface MilestoneModalProps {
  milestone:          MilestoneDef | null;
  onDismiss:          () => void;
}

export function MilestoneModal({ milestone, onDismiss }: MilestoneModalProps) {
  const particles  = useMemo(() => makeParticles(), []);
  const [typeDone, setTypeDone] = useState(false);

  // Entrance / exit animation
  const modalY    = useSharedValue(SCREEN_H);
  const overlayOp = useSharedValue(0);
  const contentOp = useSharedValue(0);
  const subtitleOp = useSharedValue(0);

  const visible = milestone !== null;

  useEffect(() => {
    if (visible) {
      setTypeDone(false);
      overlayOp.value = withTiming(1, { duration: 280 });
      modalY.value    = withSpring(0, { stiffness: 200, damping: 22 });
      contentOp.value = withDelay(200, withTiming(1, { duration: 300 }));
      // Fire heavy haptic
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [visible]);

  useEffect(() => {
    if (typeDone) {
      subtitleOp.value = withTiming(1, { duration: 500 });
    }
  }, [typeDone]);

  const animateOut = useCallback((cb: () => void) => {
    overlayOp.value = withTiming(0, { duration: 280 });
    modalY.value    = withTiming(SCREEN_H, { duration: 300, easing: Easing.bezier(0.11, 0, 0.5, 0) });
    setTimeout(cb, 320);
  }, []);

  const handleContinue = useCallback(() => {
    animateOut(onDismiss);
  }, [animateOut, onDismiss]);

  const handleShare = useCallback(async () => {
    if (!milestone) return;
    try {
      await Share.share({ message: milestone.shareText });
    } catch {
      // share cancelled
    }
  }, [milestone]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOp.value,
  }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: modalY.value }],
  }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOp.value,
  }));
  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOp.value,
  }));

  if (!milestone) return null;

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="none"
    >
      {/* ── Dim overlay ── */}
      <Animated.View style={[styles.overlay, overlayStyle]}>
        {/* ── Particles (render behind everything) ── */}
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          {particles.map((p) => (
            <Particle key={p.id} cfg={p} />
          ))}
        </View>

        {/* ── Card ── */}
        <Animated.View style={[styles.sheet, sheetStyle]}>
          <Animated.View style={[styles.innerContent, contentStyle]}>
            {/* Icon */}
            <MilestoneIcon def={milestone} />

            {/* Headline — typewriter */}
            <TypewriterText
              text={milestone.title}
              delay={500}
              onDone={() => setTypeDone(true)}
            />

            {/* Subtitle — fades in after typewriter */}
            <Animated.Text style={[styles.subtitle, subtitleStyle]}>
              {milestone.subtitle}
            </Animated.Text>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Buttons */}
            <View style={styles.buttonRow}>
              <Pressable
                onPress={handleShare}
                style={({ pressed }) => [
                  styles.shareBtn,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Ionicons name="share-social-outline" size={18} color={colors.green700} />
                <Text style={styles.shareBtnText}>Share</Text>
              </Pressable>

              <Pressable
                onPress={handleContinue}
                style={({ pressed }) => [
                  styles.continueBtn,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={styles.continueBtnText}>Continue</Text>
                <Ionicons name="arrow-forward" size={16} color={colors.white} />
              </Pressable>
            </View>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    flex:            1,
    backgroundColor: 'rgba(10, 24, 14, 0.72)',
    justifyContent:  'flex-end',
  },

  sheet: {
    backgroundColor:     colors.surface,
    borderTopLeftRadius:  radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    paddingTop:          spacing[8],
    paddingBottom:       Platform.OS === 'ios' ? spacing[10] : spacing[8],
    paddingHorizontal:   spacing[6],
    // subtle top shadow
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius:  12,
    elevation:     12,
  },

  innerContent: {
    alignItems: 'center',
  },

  iconOuter: {
    width:           104,
    height:          104,
    borderRadius:    52,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    spacing[6],
  },

  headline: {
    fontFamily:    fontFamily.bold,
    fontSize:      28,
    color:         colors.textPrimary,
    letterSpacing: -0.5,
    textAlign:     'center',
    marginBottom:  spacing[3],
    minHeight:     36,
  },

  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize:   15,
    color:      colors.textSecondary,
    textAlign:  'center',
    lineHeight: 22,
    paddingHorizontal: spacing[4],
    marginBottom: spacing[5],
  },

  divider: {
    width:           '100%',
    height:          1,
    backgroundColor: colors.borderLight,
    marginBottom:    spacing[5],
  },

  buttonRow: {
    flexDirection: 'row',
    gap:           spacing[3],
    width:         '100%',
  },

  shareBtn: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             spacing[2],
    paddingVertical: spacing[4],
    borderRadius:    radius.lg,
    backgroundColor: colors.green50,
    borderWidth:     1,
    borderColor:     colors.green100,
  },
  shareBtnText: {
    fontFamily: fontFamily.semiBold,
    fontSize:   15,
    color:      colors.green700,
  },

  continueBtn: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             spacing[2],
    paddingVertical: spacing[4],
    borderRadius:    radius.lg,
    backgroundColor: colors.green700,
  },
  continueBtnText: {
    fontFamily: fontFamily.semiBold,
    fontSize:   15,
    color:      colors.white,
  },
});
