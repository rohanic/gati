/**
 * MilestoneModal — full-screen celebration overlay.
 *
 * Shown when the user earns a milestone (streak, days alive, etc.).
 * FULL-SCREEN takeover celebration:
 *  - Deep forest gradient backdrop, edge to edge
 *  - 40 falling confetti particles tuned for the dark background
 *  - Glowing icon ring, typewriter headline, fade-in subtitle
 *  - Share (native) + Continue
 *  - Success haptic on entry
 *
 * Only fires for milestones earned WHILE using the app — pre-existing
 * ones (e.g. "5,000 days alive" met before install) are seeded as seen
 * during onboarding and never celebrated retroactively.
 *
 * NO emojis. NO purple. NO orange. Forest green + gold palette.
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
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius, fontFamily } from '@/theme';
import type { MilestoneDef } from '@/engine/milestoneEngine';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ─── Confetti particle config ─────────────────────────────────
const PARTICLE_COUNT = 40;
const PARTICLE_COLORS = [
  colors.gold, colors.goldLight, colors.green300, colors.green100,
  colors.white, colors.green500,
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
    <Animated.View style={[styles.iconHalo, style]}>
      <View style={[styles.iconOuter, { backgroundColor: def.iconBg }]}>
        <Ionicons name={def.icon as any} size={48} color={def.iconColor} />
      </View>
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
    // No `setDisplayed('')` reset here: the parent gives this component a
    // `key` per milestone, so a new milestone remounts it with empty state.
    // Resetting inside the effect cascaded an extra render on every open.
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

  // Entrance / exit animation — full-screen pop, not a bottom sheet
  const sheetScale = useSharedValue(0.94);
  const overlayOp  = useSharedValue(0);
  const contentOp  = useSharedValue(0);
  const subtitleOp = useSharedValue(0);

  const visible = milestone !== null;

  // Reset the typewriter flag during render when the milestone changes. This
  // is React's documented "adjusting state when a prop changes" pattern and
  // avoids the extra render pass that a setState-in-effect causes.
  const milestoneId = milestone?.id ?? null;
  const [lastMilestoneId, setLastMilestoneId] = useState(milestoneId);
  if (milestoneId !== lastMilestoneId) {
    setLastMilestoneId(milestoneId);
    setTypeDone(false);
  }

  useEffect(() => {
    if (visible) {
      overlayOp.value  = withTiming(1, { duration: 300 });
      sheetScale.value = withSpring(1, { stiffness: 220, damping: 22, overshootClamping: true });
      contentOp.value  = withDelay(180, withTiming(1, { duration: 320 }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      // Reset to the pre-entrance state when hidden so the next milestone always
      // pops in fresh — even if the parent cleared it without animateOut.
      overlayOp.value  = 0;
      sheetScale.value = 0.94;
      contentOp.value  = 0;
      subtitleOp.value = 0;
    }
  }, [visible]);

  useEffect(() => {
    if (typeDone) {
      subtitleOp.value = withTiming(1, { duration: 500 });
    }
  }, [typeDone]);

  const animateOut = useCallback((cb: () => void) => {
    overlayOp.value  = withTiming(0, { duration: 260 });
    sheetScale.value = withTiming(0.96, { duration: 260, easing: Easing.bezier(0.11, 0, 0.5, 0) });
    setTimeout(cb, 290);
  }, []);

  const handleContinue = useCallback(() => {
    animateOut(onDismiss);
  }, [animateOut, onDismiss]);

  const handleShare = useCallback(async () => {
    if (!milestone) return;
    try {
      // Append a consistent CTA so recipients have a path to the app.
      // The shareText is written as a standalone line — the CTA is a
      // second paragraph so it works in iMessage, Twitter, WhatsApp, etc.
      const message = `${milestone.shareText}\n\nMy life, in numbers — https://gati.app`;
      await Share.share({ message, title: milestone.title });
    } catch {
      // share cancelled or not supported
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [milestone]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOp.value,
  }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sheetScale.value }],
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
      onRequestClose={handleContinue}
    >
      {/* ── Full-screen gradient stage ── */}
      <Animated.View style={[styles.overlay, overlayStyle]}>
        <LinearGradient
          colors={['#0F2A1A', colors.green900, '#2A5C3D']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.4, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* ── Particles ── */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {particles.map((p) => (
            <Particle key={p.id} cfg={p} />
          ))}
        </View>

        {/* ── Celebration content, centered full-screen ── */}
        <Animated.View style={[styles.sheet, sheetStyle]}>
          <Animated.View style={[styles.innerContent, contentStyle]}>
            {/* Eyebrow */}
            <View style={styles.eyebrow}>
              <Ionicons name="trophy" size={12} color={colors.gold} />
              <Text style={styles.eyebrowText}>MILESTONE REACHED</Text>
            </View>

            {/* Icon */}
            <MilestoneIcon def={milestone} />

            {/* Headline — typewriter */}
            <TypewriterText
              // Remount per milestone so the typewriter starts from empty
              // without needing to reset its own state in an effect.
              key={milestone.id}
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
                <Ionicons name="share-social-outline" size={18} color={colors.white} />
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
                <Ionicons name="arrow-forward" size={16} color={colors.green900} />
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
    flex:           1,
    justifyContent: 'center',
  },

  // Full-screen stage — content centered, buttons pinned by spacing
  sheet: {
    flex:              1,
    justifyContent:    'center',
    paddingTop:        Platform.OS === 'ios' ? spacing[12] : spacing[10],
    paddingBottom:     Platform.OS === 'ios' ? spacing[10] : spacing[8],
    paddingHorizontal: spacing[6],
  },

  innerContent: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },

  eyebrow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing[2],
    paddingVertical:   spacing[1] + 2,
    paddingHorizontal: spacing[3],
    borderRadius:      radius.full,
    borderWidth:       1,
    borderColor:       'rgba(201,168,76,0.45)',
    backgroundColor:   'rgba(201,168,76,0.12)',
    marginBottom:      spacing[7],
  },
  eyebrowText: {
    fontFamily:    fontFamily.bold,
    fontSize:      10.5,
    color:         colors.gold,
    letterSpacing: 1.6,
  },

  iconHalo: {
    width:           136,
    height:          136,
    borderRadius:    68,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.18)',
    marginBottom:    spacing[7],
  },
  iconOuter: {
    width:          104,
    height:         104,
    borderRadius:   52,
    alignItems:     'center',
    justifyContent: 'center',
  },

  headline: {
    fontFamily:    fontFamily.extraBold,
    fontSize:      28,
    color:         colors.white,
    letterSpacing: -0.5,
    textAlign:     'center',
    marginBottom:  spacing[3],
    minHeight:     38,
  },

  subtitle: {
    fontFamily:        fontFamily.regular,
    fontSize:          14,
    color:             colors.green100,
    textAlign:         'center',
    lineHeight:        21.5,
    paddingHorizontal: spacing[4],
    marginBottom:      spacing[5],
  },

  divider: {
    width:           56,
    height:          2,
    borderRadius:    radius.full,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom:    spacing[6],
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
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.28)',
  },
  shareBtnText: {
    fontFamily: fontFamily.semiBold,
    fontSize:   14,
    color:      colors.white,
  },

  continueBtn: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             spacing[2],
    paddingVertical: spacing[4],
    borderRadius:    radius.lg,
    backgroundColor: colors.white,
  },
  continueBtnText: {
    fontFamily: fontFamily.semiBold,
    fontSize:   14,
    color:      colors.green900,
  },
});
