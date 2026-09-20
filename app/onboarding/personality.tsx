/**
 * Personality screen — step 8 of 10.
 * How would you describe yourself? (talk level)
 * 3 full-width option cards.
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { OnboardingShell } from '@/components/onboarding/OnboardingShell';
import { useOnboardingStore } from '@/store/onboardingStore';
import { TalkLevel } from '@/types';
import { colors, spacing, radius, fontFamily } from '@/theme';

const OPTIONS: {
  value:      TalkLevel;
  label:      string;
  sub:        string;
  icon:       string;
  iconActive: string;
  tagline:    string;
}[] = [
  {
    value:      'quiet',
    label:      'Quiet',
    sub:        'I prefer listening over talking',
    icon:       'ear-outline',
    iconActive: 'ear',
    tagline:    'Thinker',
  },
  {
    value:      'balanced',
    label:      'Balanced',
    sub:        'A mix of listening and talking',
    icon:       'chatbubbles-outline',
    iconActive: 'chatbubbles',
    tagline:    'Connector',
  },
  {
    value:      'chatty',
    label:      'Chatty',
    sub:        'I love to talk and be social',
    icon:       'megaphone-outline',
    iconActive: 'megaphone',
    tagline:    'Expressive',
  },
];

// ─── Illustration: 3 vibe icons ──────────────────────────────
/**
 * One icon. Extracted from the `.map()` below so its hooks live in a real
 * component rather than a loop callback — see the matching note in
 * onboarding/activity.tsx.
 */
function PersonalityIcon({
  option,
  active,
}: {
  option: (typeof OPTIONS)[number];
  active: boolean;
}) {
  const iconScale = useSharedValue(active ? 1.2 : 1);

  useEffect(() => {
    iconScale.value = withSpring(active ? 1.2 : 1, { stiffness: 300, damping: 25 });
  }, [active, iconScale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: iconScale.value }] }));

  return (
    <Animated.View style={[styles.iconCircle, active && styles.iconCircleActive, style]}>
      <Ionicons
        name={(active ? option.iconActive : option.icon) as any}
        size={26}
        color={active ? colors.green700 : colors.textMuted}
      />
    </Animated.View>
  );
}

function PersonalityIcons({ selected }: { selected: TalkLevel }) {
  return (
    <View style={styles.iconRow}>
      {OPTIONS.map((opt) => (
        <PersonalityIcon
          key={opt.value}
          option={opt}
          active={opt.value === selected}
        />
      ))}
    </View>
  );
}

// ─── Option card ─────────────────────────────────────────────
function PersonalityCard({
  option, selected, onSelect, delay,
}: {
  option:   typeof OPTIONS[0];
  selected: boolean;
  onSelect: () => void;
  delay:    number;
}) {
  const cardScale  = useSharedValue(0.9);
  const cardOp     = useSharedValue(0);
  const pressScale = useSharedValue(1);

  useEffect(() => {
    cardScale.value = withDelay(delay, withSpring(1, { stiffness: 260, damping: 22 }));
    cardOp.value    = withDelay(delay, withTiming(1, { duration: 280 }));
  }, []);

  const handlePress = () => {
    Haptics.selectionAsync();
    pressScale.value = withSequence(
      withSpring(0.97, { stiffness: 500, damping: 15 }),
      withSpring(1.0,  { stiffness: 300, damping: 25 })
    );
    onSelect();
  };

  const animStyle = useAnimatedStyle(() => ({
    opacity:   cardOp.value,
    transform: [{ scale: cardScale.value * pressScale.value }],
  }));

  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={handlePress}
        style={[styles.card, selected && styles.cardActive]}
        accessibilityRole="button"
        accessibilityLabel={option.label}
        accessibilityState={{ selected }}
      >
        <View style={styles.cardLeft}>
          <Ionicons
            name={(selected ? option.iconActive : option.icon) as any}
            size={26}
            color={selected ? colors.green700 : colors.textMuted}
          />
        </View>
        <View style={styles.cardRight}>
          <View style={styles.cardTitleRow}>
            <Text style={[styles.cardLabel, selected && styles.cardLabelActive]}>
              {option.label}
            </Text>
            {selected && (
              <View style={styles.tagBadge}>
                <Text style={styles.tagText}>{option.tagline}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.cardSub, selected && styles.cardSubActive]}>
            {option.sub}
          </Text>
        </View>
        {selected && (
          <Ionicons name="checkmark-circle" size={22} color={colors.green700} />
        )}
      </Pressable>
    </Animated.View>
  );
}

// ─── Main screen ─────────────────────────────────────────────
export default function PersonalityScreen() {
  const { talkLevel, setTalkLevel } = useOnboardingStore();

  const illustrationOp = useSharedValue(0);
  const illustrationY  = useSharedValue(-15);
  const questionOp     = useSharedValue(0);
  const questionY      = useSharedValue(20);
  const btnOp          = useSharedValue(0);

  useEffect(() => {
    illustrationY.value  = withSpring(0, { stiffness: 180, damping: 18 });
    illustrationOp.value = withTiming(1, { duration: 360 });
    questionY.value  = withDelay(180, withSpring(0, { stiffness: 200, damping: 18 }));
    questionOp.value = withDelay(180, withTiming(1, { duration: 300 }));
    btnOp.value      = withDelay(700, withTiming(1, { duration: 300 }));
  }, []);

  const illustrationStyle = useAnimatedStyle(() => ({
    opacity:   illustrationOp.value,
    transform: [{ translateY: illustrationY.value }],
  }));
  const questionStyle = useAnimatedStyle(() => ({
    opacity:   questionOp.value,
    transform: [{ translateY: questionY.value }],
  }));
  const btnStyle = useAnimatedStyle(() => ({ opacity: btnOp.value }));

  return (
    <OnboardingShell step={11}>
      <View style={styles.content}>

        {/* ── Illustration ── */}
        <Animated.View style={[styles.illustrationWrap, illustrationStyle]}>
          <PersonalityIcons selected={talkLevel} />
        </Animated.View>

        {/* ── Question ── */}
        <Animated.View style={[styles.questionBlock, questionStyle]}>
          <Text style={styles.question}>How would you{'\n'}describe yourself?</Text>
          <Text style={styles.hint}>Shapes words spoken, laughs, social stats</Text>
        </Animated.View>

        {/* ── Options ── */}
        <View style={styles.cards}>
          {OPTIONS.map((opt, i) => (
            <PersonalityCard
              key={opt.value}
              option={opt}
              selected={talkLevel === opt.value}
              onSelect={() => setTalkLevel(opt.value)}
              delay={260 + i * 70}
            />
          ))}
        </View>

        <View style={{ flex: 1 }} />

        {/* ── Continue → interests ── */}
        <Animated.View style={btnStyle}>
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/onboarding/interests'); }}
            style={({ pressed }) => [styles.nextBtn, pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] }]}
          >
            <Text style={styles.nextText}>Continue</Text>
          </Pressable>
        </Animated.View>

      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  content: {
    flex:          1,
    paddingTop:    spacing[4],
    paddingBottom: spacing[4],
  },

  illustrationWrap: {
    alignItems:   'center',
    marginBottom: spacing[6],
  },
  iconRow: {
    flexDirection: 'row',
    gap:           spacing[4],
  },
  iconCircle: {
    width:           64,
    height:          64,
    borderRadius:    32,
    backgroundColor: colors.surface2,
    borderWidth:     1.5,
    borderColor:     colors.border,
    alignItems:      'center',
    justifyContent:  'center',
  },
  iconCircleActive: {
    backgroundColor: colors.green50,
    borderColor:     colors.green700,
  },

  questionBlock: {
    alignItems:   'center',
    marginBottom: spacing[6],
  },
  question: {
    fontFamily:    fontFamily.bold,
    fontSize:      26.5,
    color:         colors.textPrimary,
    lineHeight:    34,
    textAlign:     'center',
    letterSpacing: -0.4,
    marginBottom:  spacing[2],
  },
  hint: {
    fontFamily: fontFamily.regular,
    fontSize:   12,
    color:      colors.textMuted,
    textAlign:  'center',
  },

  cards: {
    gap: spacing[3],
  },
  card: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:   spacing[4],
    paddingHorizontal: spacing[4],
    borderRadius:      radius.xl,
    borderWidth:       1.5,
    borderColor:       colors.border,
    backgroundColor:   colors.white,
    gap:               spacing[4],
  },
  cardActive: {
    borderColor:     colors.green700,
    backgroundColor: colors.green50,
  },
  cardLeft: {
    width:      36,
    alignItems: 'center',
  },
  cardRight: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[2],
    marginBottom:  3,
  },
  cardLabel: {
    fontFamily: fontFamily.bold,
    fontSize:   15,
    color:      colors.textSecondary,
  },
  cardLabelActive: {
    color: colors.green700,
  },
  tagBadge: {
    backgroundColor: colors.green100,
    borderRadius:    radius.full,
    paddingHorizontal: spacing[2],
    paddingVertical:   2,
  },
  tagText: {
    fontFamily: fontFamily.semiBold,
    fontSize:   9.5,
    color:      colors.green700,
    letterSpacing: 0.3,
  },
  cardSub: {
    fontFamily: fontFamily.regular,
    fontSize:   12,
    color:      colors.textMuted,
  },
  cardSubActive: {
    color: colors.green500,
  },

  nextBtn: {
    backgroundColor: colors.green700,
    borderRadius:    radius.xl,
    paddingVertical: spacing[5],
    alignItems:      'center',
    marginBottom:    spacing[2],
    shadowColor:     colors.green900,
    shadowOffset:    { width: 0, height: 3 },
    shadowOpacity:   0.15,
    shadowRadius:    8,
    elevation:       4,
  },
  nextText: {
    fontFamily:    fontFamily.bold,
    fontSize:      16,
    color:         colors.white,
    letterSpacing: 0.2,
  },
});
