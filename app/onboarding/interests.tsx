import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { OnboardingShell } from '@/components/onboarding/OnboardingShell';
import { useOnboardingStore } from '@/store/onboardingStore';
import { InterestCategory } from '@/types';
import { colors, spacing, radius, fontFamily } from '@/theme';

// ─── Interest definitions ──────────────────────────────────────
const INTERESTS: { key: InterestCategory; label: string; icon: string }[] = [
  { key: 'food',      label: 'Food',      icon: 'restaurant-outline'    },
  { key: 'cafe',      label: 'Café',      icon: 'cafe-outline'          },
  { key: 'history',   label: 'History',   icon: 'business-outline'      },
  { key: 'nature',    label: 'Nature',    icon: 'leaf-outline'          },
  { key: 'art',       label: 'Art',       icon: 'color-palette-outline' },
  { key: 'market',    label: 'Market',    icon: 'bag-handle-outline'    },
  { key: 'nightlife', label: 'Nightlife', icon: 'moon-outline'          },
  { key: 'books',     label: 'Books',     icon: 'book-outline'          },
];

// ─── Individual chip ──────────────────────────────────────────
function InterestChip({
  item,
  selected,
  onPress,
  delay,
}: {
  item:     (typeof INTERESTS)[number];
  selected: boolean;
  onPress:  () => void;
  delay:    number;
}) {
  const scale   = useSharedValue(0.85);
  const opacity = useSharedValue(0);

  // Entrance
  useEffect(() => {
    scale.value   = withDelay(delay, withSpring(1, { stiffness: 300, damping: 25 }));
    opacity.value = withDelay(delay, withTiming(1, { duration: 260 }));
  }, []);

  const chipStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const pressScale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const handlePressIn  = () => { pressScale.value = withSpring(0.93, { stiffness: 400, damping: 18 }); };
  const handlePressOut = () => { pressScale.value = withSpring(1, { stiffness: 300, damping: 25 }); };

  return (
    <Animated.View style={[styles.chipWrap, chipStyle]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.chip, selected && styles.chipSelected]}
      >
        <Ionicons
          name={item.icon as any}
          size={20}
          color={selected ? colors.green700 : colors.textMuted}
        />
        <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
          {item.label}
        </Text>
        {selected ? (
          <View style={styles.checkmark}>
            <Ionicons name="checkmark" size={12} color={colors.white} />
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

// ─── Screen ───────────────────────────────────────────────────
export default function InterestsScreen() {
  const { interests, toggleInterest } = useOnboardingStore();
  const canContinue = interests.length >= 1;

  const headOp = useSharedValue(0);
  const headY  = useSharedValue(20);
  const btnOp  = useSharedValue(0);

  useEffect(() => {
    headOp.value = withTiming(1, { duration: 350 });
    headY.value  = withSpring(0, { stiffness: 200, damping: 18 });
    btnOp.value  = withDelay(500, withTiming(1, { duration: 300 }));
  }, []);

  const headStyle = useAnimatedStyle(() => ({
    opacity:   headOp.value,
    transform: [{ translateY: headY.value }],
  }));
  const btnStyle = useAnimatedStyle(() => ({ opacity: btnOp.value }));

  const handleNext = () => {
    if (!canContinue) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/onboarding/processing');
  };

  const handleToggle = (key: InterestCategory) => {
    Haptics.selectionAsync();
    toggleInterest(key);
  };

  return (
    <OnboardingShell step={4}>
      <View style={styles.content}>
        {/* Header */}
        <Animated.View style={[styles.header, headStyle]}>
          <Text style={styles.question}>What do you{'\n'}love exploring?</Text>
          <Text style={styles.hint}>Choose at least one — shapes your Wander picks</Text>
        </Animated.View>

        {/* Grid */}
        <View style={styles.grid}>
          {INTERESTS.map((item, i) => (
            <InterestChip
              key={item.key}
              item={item}
              selected={interests.includes(item.key)}
              onPress={() => handleToggle(item.key)}
              delay={i * 45}
            />
          ))}
        </View>

        {/* Counter */}
        <Text style={styles.counter}>
          {interests.length === 0
            ? 'Select what calls to you'
            : `${interests.length} selected`}
        </Text>

        <View style={{ flex: 1 }} />

        {/* CTA */}
        <Animated.View style={btnStyle}>
          <Pressable
            onPress={handleNext}
            disabled={!canContinue}
            style={({ pressed }) => [
              styles.nextBtn,
              !canContinue && styles.nextBtnDisabled,
              pressed && canContinue && styles.nextBtnPressed,
            ]}
          >
            <Text style={[styles.nextText, !canContinue && styles.nextTextDisabled]}>
              Continue
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  content: {
    flex:          1,
    paddingTop:    spacing[8],
    paddingBottom: spacing[4],
  },
  header: {
    marginBottom: spacing[7],
  },
  question: {
    fontFamily:    fontFamily.bold,
    fontSize:      30,
    color:         colors.textPrimary,
    lineHeight:    38,
    marginBottom:  spacing[3],
    letterSpacing: -0.5,
  },
  hint: {
    fontFamily: fontFamily.regular,
    fontSize:   14,
    color:      colors.textMuted,
  },

  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing[2] + 2,
    marginBottom:  spacing[4],
  },
  chipWrap: {
    width: '47%',
  },
  chip: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:   spacing[4],
    paddingHorizontal: spacing[4],
    borderRadius:      radius.xl,
    borderWidth:       1.5,
    borderColor:       colors.border,
    backgroundColor:   colors.white,
    gap:               spacing[2],
    position:          'relative',
  },
  chipSelected: {
    borderColor:     colors.green700,
    backgroundColor: colors.green50,
  },
  chipLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize:   15,
    color:      colors.textSecondary,
    flex:       1,
  },
  chipLabelSelected: {
    color: colors.green700,
  },
  checkmark: {
    width:           20,
    height:          20,
    borderRadius:    radius.full,
    backgroundColor: colors.green700,
    alignItems:      'center',
    justifyContent:  'center',
  },

  counter: {
    fontFamily: fontFamily.regular,
    fontSize:   13,
    color:      colors.textMuted,
    textAlign:  'center',
    marginBottom: spacing[4],
  },

  nextBtn: {
    backgroundColor: colors.green700,
    borderRadius:    radius.xl,
    paddingVertical: spacing[5],
    alignItems:      'center',
    marginBottom:    spacing[2],
  },
  nextBtnDisabled: {
    backgroundColor: colors.green100,
  },
  nextBtnPressed: {
    opacity:   0.88,
    transform: [{ scale: 0.98 }],
  },
  nextText: {
    fontFamily:    fontFamily.bold,
    fontSize:      17,
    color:         colors.white,
    letterSpacing: 0.2,
  },
  nextTextDisabled: {
    color: colors.green300,
  },
});
