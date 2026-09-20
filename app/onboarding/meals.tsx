/**
 * Meals screen — step 8 of 13.
 * 2×2 grid of option cards + WowFact lifetime insight strip.
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
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
import { differenceInDays } from 'date-fns';
import { OnboardingShell } from '@/components/onboarding/OnboardingShell';
import { WowFact } from '@/components/onboarding/WowFact';
import { useOnboardingStore } from '@/store/onboardingStore';
import { colors, spacing, radius, fontFamily } from '@/theme';

const OPTIONS = [
  { value: 1, label: '1 meal',   sub: 'One big meal a day',    icon: 'sunny-outline'        },
  { value: 2, label: '2 meals',  sub: 'Breakfast and dinner',  icon: 'partly-sunny-outline' },
  { value: 3, label: '3 meals',  sub: 'Classic three a day',   icon: 'restaurant-outline'   },
  { value: 4, label: '4+ meals', sub: 'Small, frequent meals', icon: 'grid-outline'         },
];

// ─── Option card ──────────────────────────────────────────────
function OptionCard({
  option,
  selected,
  onSelect,
  delay,
  cardHeight,
}: {
  option:     typeof OPTIONS[0];
  selected:   boolean;
  onSelect:   () => void;
  delay:      number;
  cardHeight: number;
}) {
  const scale      = useSharedValue(0.88);
  const opacity    = useSharedValue(0);
  const pressScale = useSharedValue(1);

  useEffect(() => {
    scale.value   = withDelay(delay, withSpring(1, { stiffness: 280, damping: 22 }));
    opacity.value = withDelay(delay, withTiming(1, { duration: 280 }));
  }, []);

  const handlePress = () => {
    Haptics.selectionAsync();
    pressScale.value = withSequence(
      withSpring(0.94, { stiffness: 500, damping: 15 }),
      withSpring(1.0,  { stiffness: 300, damping: 25 }),
    );
    onSelect();
  };

  const cardStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ scale: scale.value * pressScale.value }],
  }));

  return (
    /*
     * cardWrap carries the fixed height — this is the key.
     * flex:1 on the Pressable fills that defined height, so no
     * height collapse (which was causing the pill-shape bug).
     */
    <Animated.View style={[styles.cardWrap, cardStyle, { height: cardHeight }]}>
      <Pressable
        onPress={handlePress}
        style={[styles.card, selected && styles.cardActive]}
        accessibilityRole="button"
        accessibilityLabel={option.label}
        accessibilityState={{ selected }}
      >
        {/* Checkmark badge — absolute, never shifts content */}
        {selected && (
          <View style={styles.checkBadge}>
            <Ionicons name="checkmark" size={11} color={colors.white} />
          </View>
        )}

        {/* Centred icon */}
        <View style={[styles.iconCircle, selected && styles.iconCircleActive]}>
          <Ionicons
            name={option.icon as any}
            size={20}
            color={selected ? colors.green700 : colors.textMuted}
          />
        </View>

        {/* Label */}
        <Text
          style={[styles.cardLabel, selected && styles.cardLabelActive]}
          numberOfLines={1}
        >
          {option.label}
        </Text>

        {/* Sub */}
        <Text
          style={[styles.cardSub, selected && styles.cardSubActive]}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
        >
          {option.sub}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// ─── Screen ───────────────────────────────────────────────────
export default function MealsScreen() {
  const { mealsPerDay, setMealsPerDay, dateOfBirth } = useOnboardingStore();
  const { height: screenHeight } = useWindowDimensions();

  // Adapt card height and spacing to screen size
  const compact    = screenHeight < 720;
  const cardHeight = compact ? 88 : 102;

  const daysAlive     = Math.max(1, differenceInDays(new Date(), dateOfBirth ?? new Date(2000, 0, 1)));
  const lifetimeMeals = Math.floor(daysAlive * mealsPerDay);

  const iconOp  = useSharedValue(0);
  const iconY   = useSharedValue(-10);
  const headOp  = useSharedValue(0);
  const headY   = useSharedValue(14);
  const btnOp   = useSharedValue(0);

  useEffect(() => {
    iconOp.value = withTiming(1, { duration: 340 });
    iconY.value  = withSpring(0, { stiffness: 200, damping: 20 });
    headOp.value = withDelay(160, withTiming(1, { duration: 320 }));
    headY.value  = withDelay(160, withSpring(0, { stiffness: 200, damping: 20 }));
    btnOp.value  = withDelay(560, withTiming(1, { duration: 300 }));
  }, []);

  const iconStyle = useAnimatedStyle(() => ({
    opacity:   iconOp.value,
    transform: [{ translateY: iconY.value }],
  }));
  const headStyle = useAnimatedStyle(() => ({
    opacity:   headOp.value,
    transform: [{ translateY: headY.value }],
  }));
  const btnStyle = useAnimatedStyle(() => ({ opacity: btnOp.value }));

  return (
    <OnboardingShell step={8}>
      <View style={[styles.content, compact && { paddingTop: spacing[2] }]}>

        {/* ── Topic icon badge ── */}
        <Animated.View style={[styles.badgeWrap, iconStyle]}>
          <View style={styles.badge}>
            <Ionicons name="restaurant" size={22} color={colors.green700} />
          </View>
        </Animated.View>

        {/* ── Question ── */}
        <Animated.View style={[styles.questionBlock, headStyle, compact && { marginBottom: spacing[3] }]}>
          <Text style={[styles.question, compact && { fontSize: 22, lineHeight: 28 }]}>
            How many meals do{'\n'}you eat per day?
          </Text>
          <Text style={styles.hint}>Your eating rhythm shapes your energy all day</Text>
        </Animated.View>

        {/* ── 2×2 option grid ── */}
        <View style={styles.grid}>
          <View style={styles.gridRow}>
            <OptionCard option={OPTIONS[0]} selected={mealsPerDay === 1} onSelect={() => setMealsPerDay(1)} delay={260} cardHeight={cardHeight} />
            <OptionCard option={OPTIONS[1]} selected={mealsPerDay === 2} onSelect={() => setMealsPerDay(2)} delay={310} cardHeight={cardHeight} />
          </View>
          <View style={styles.gridRow}>
            <OptionCard option={OPTIONS[2]} selected={mealsPerDay === 3} onSelect={() => setMealsPerDay(3)} delay={360} cardHeight={cardHeight} />
            <OptionCard option={OPTIONS[3]} selected={mealsPerDay === 4} onSelect={() => setMealsPerDay(4)} delay={410} cardHeight={cardHeight} />
          </View>
        </View>

        {/* ── Lifetime insight ── */}
        <View style={[styles.wowWrap, compact && { marginTop: spacing[3] }]}>
          <WowFact
            icon="restaurant-outline"
            figure={lifetimeMeals.toLocaleString('en-US')}
            label="meals eaten in your lifetime"
            punch="Someone cooked a lot of those for you. A few changed your life."
            delay={480}
          />
        </View>

        <View style={{ flex: 1, minHeight: spacing[3] }} />

        {/* ── Continue ── */}
        <Animated.View style={btnStyle}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/onboarding/activity');
            }}
            style={({ pressed }) => [
              styles.nextBtn,
              pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            <Text style={styles.nextText}>Continue</Text>
          </Pressable>
        </Animated.View>

      </View>
    </OnboardingShell>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  content: {
    flex:          1,
    paddingTop:    spacing[3],
    paddingBottom: spacing[4],
  },

  // ── Topic badge
  badgeWrap: {
    alignItems:   'center',
    marginBottom: spacing[4],
  },
  badge: {
    width:           52,
    height:          52,
    borderRadius:    26,
    backgroundColor: colors.green50,
    borderWidth:     1.5,
    borderColor:     colors.green100,
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     colors.green700,
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.10,
    shadowRadius:    6,
    elevation:       2,
  },

  // ── Question
  questionBlock: {
    marginBottom: spacing[4],
  },
  question: {
    fontFamily:    fontFamily.bold,
    fontSize:      25,
    color:         colors.textPrimary,
    lineHeight:    32,
    letterSpacing: -0.4,
    marginBottom:  spacing[2],
  },
  hint: {
    fontFamily: fontFamily.regular,
    fontSize:   13,
    color:      colors.textMuted,
  },

  // ── Grid
  grid: {
    gap: spacing[3],
  },
  gridRow: {
    flexDirection: 'row',
    gap:           spacing[3],
  },

  // ── Card
  //
  // cardWrap carries the EXPLICIT HEIGHT (passed as a prop).
  // This is what makes `flex:1` on the Pressable work — it has
  // a defined parent height to fill. Without this, flex:1 collapses
  // to near-zero (the pill-shape bug seen in the screenshot).
  cardWrap: {
    flex: 1,
    // height injected inline from cardHeight prop
  },
  card: {
    flex:              1,          // fills the cardWrap's defined height ✓
    alignItems:        'center',   // centre icon + text horizontally
    justifyContent:    'center',   // centre content block vertically
    paddingHorizontal: spacing[3],
    paddingVertical:   spacing[2],
    borderRadius:      radius.xl,
    borderWidth:       1.5,
    borderColor:       colors.border,
    backgroundColor:   colors.white,
    position:          'relative',
    gap:               3,          // tight but readable spacing between icon/label/sub
  },
  cardActive: {
    borderColor:     colors.green700,
    backgroundColor: colors.green50,
  },

  // Absolute checkmark badge — never pushes content around
  checkBadge: {
    position:        'absolute',
    top:             spacing[2],
    right:           spacing[2],
    width:           20,
    height:          20,
    borderRadius:    10,
    backgroundColor: colors.green700,
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          1,
  },

  // Icon in tinted circle
  iconCircle: {
    width:           38,
    height:          38,
    borderRadius:    19,
    backgroundColor: colors.green50,
    borderWidth:     1,
    borderColor:     colors.green100,
    alignItems:      'center',
    justifyContent:  'center',
  },
  iconCircleActive: {
    backgroundColor: colors.green100,
    borderColor:     colors.green100,
  },

  cardLabel: {
    fontFamily: fontFamily.bold,
    fontSize:   13.5,
    color:      colors.textSecondary,
    textAlign:  'center',
  },
  cardLabelActive: {
    color: colors.green700,
  },
  cardSub: {
    fontFamily: fontFamily.regular,
    fontSize:   11,
    color:      colors.textMuted,
    textAlign:  'center',
    lineHeight: 15,
  },
  cardSubActive: {
    color: colors.green500,
  },

  // ── WowFact
  wowWrap: {
    marginTop: spacing[4],
  },

  // ── Continue
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
