import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { router } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { differenceInDays, format } from 'date-fns';
import { OnboardingShell } from '@/components/onboarding/OnboardingShell';
import { useOnboardingStore } from '@/store/onboardingStore';
import { colors, spacing, radius, fontFamily } from '@/theme';
import { Text } from '@/components/ui/Text';

// ─── Picker data ──────────────────────────────────────────────
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const DAYS   = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
const YEARS  = (() => {
  const now  = new Date().getFullYear();
  const arr  = [];
  for (let y = now - 13; y >= now - 100; y--) arr.push(String(y));
  return arr;
})();

// ─── Wheel constants ──────────────────────────────────────────
const ITEM_H     = 52;
const VISIBLE    = 5;
const WHEEL_H    = ITEM_H * VISIBLE;
const PAD_ITEMS  = 2;  // invisible items above/below for centering

// ─── Wheel column ─────────────────────────────────────────────
function PickerWheel({
  items,
  selectedIndex,
  onSelect,
  flex,
}: {
  items:         string[];
  selectedIndex: number;
  onSelect:      (i: number) => void;
  flex:          number;
}) {
  const scrollRef    = useRef<ScrollView>(null);
  const isDragging   = useRef(false);

  // Scroll to initial position on mount
  useEffect(() => {
    const y = selectedIndex * ITEM_H;
    scrollRef.current?.scrollTo({ y, animated: false });
  }, []);

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const raw   = e.nativeEvent.contentOffset.y;
    const index = Math.round(raw / ITEM_H);
    const clamped = Math.max(0, Math.min(items.length - 1, index));
    if (clamped !== selectedIndex) {
      Haptics.selectionAsync();
      onSelect(clamped);
    }
  };

  // Build padded list so first/last items can center
  const padded: (string | null)[] = [
    ...Array(PAD_ITEMS).fill(null),
    ...items,
    ...Array(PAD_ITEMS).fill(null),
  ];

  return (
    <View style={[styles.wheelCol, { flex }]}>
      {/* Highlight strip at center */}
      <View pointerEvents="none" style={styles.highlightStrip} />

      <ScrollView
        ref={scrollRef}
        style={{ height: WHEEL_H }}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollBeginDrag={() => { isDragging.current = true; }}
        scrollEventThrottle={16}
      >
        {padded.map((item, i) => {
          const realIdx   = i - PAD_ITEMS;
          const isSelected = realIdx === selectedIndex;
          return (
            <View key={i} style={styles.wheelItem}>
              {item !== null ? (
                <Text
                  style={[
                    styles.wheelText,
                    isSelected && styles.wheelTextSelected,
                    Math.abs(realIdx - selectedIndex) === 1 && styles.wheelTextNear,
                    Math.abs(realIdx - selectedIndex) >= 2 && styles.wheelTextFar,
                  ]}
                  numberOfLines={1}
                >
                  {item}
                </Text>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────
export default function BirthdayScreen() {
  const { dateOfBirth, setDateOfBirth, firstName } = useOnboardingStore();

  const [monthIdx, setMonthIdx] = useState(() =>
    dateOfBirth ? dateOfBirth.getMonth() : 5
  );
  const [dayIdx, setDayIdx] = useState(() =>
    dateOfBirth ? dateOfBirth.getDate() - 1 : 14
  );
  const [yearIdx, setYearIdx] = useState(() => {
    if (dateOfBirth) {
      const y = String(dateOfBirth.getFullYear());
      const i = YEARS.indexOf(y);
      return i >= 0 ? i : 20;
    }
    return 20; // default ~26 years ago
  });

  // ── Derived date display ──
  const selectedYear  = Number(YEARS[yearIdx]);
  const selectedMonth = monthIdx; // 0-based
  const selectedDay   = dayIdx + 1;
  const date = new Date(selectedYear, selectedMonth, selectedDay);
  const daysAlive = Math.max(0, differenceInDays(new Date(), date));

  // ── Enter animations ──
  const headerOp = useSharedValue(0);
  const headerY  = useSharedValue(20);
  const wheelOp  = useSharedValue(0);
  const wheelY   = useSharedValue(24);
  const previewOp = useSharedValue(0);
  const btnOp    = useSharedValue(0);

  useEffect(() => {
    headerOp.value = withTiming(1, { duration: 350 });
    headerY.value  = withSpring(0, { stiffness: 200, damping: 18 });
    wheelOp.value  = withDelay(140, withTiming(1, { duration: 320 }));
    wheelY.value   = withDelay(140, withSpring(0, { stiffness: 180, damping: 18 }));
    previewOp.value = withDelay(280, withTiming(1, { duration: 320 }));
    btnOp.value    = withDelay(350, withTiming(1, { duration: 300 }));
  }, []);

  const headerStyle  = useAnimatedStyle(() => ({
    opacity:   headerOp.value,
    transform: [{ translateY: headerY.value }],
  }));
  const wheelStyle   = useAnimatedStyle(() => ({
    opacity:   wheelOp.value,
    transform: [{ translateY: wheelY.value }],
  }));
  const previewStyle = useAnimatedStyle(() => ({ opacity: previewOp.value }));
  const btnStyle     = useAnimatedStyle(() => ({ opacity: btnOp.value }));

  const handleNext = () => {
    const d = new Date(selectedYear, selectedMonth, selectedDay);
    setDateOfBirth(d);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/onboarding/sleep');
  };

  return (
    <OnboardingShell step={2}>
      <View style={styles.content}>
        {/* Header */}
        <Animated.View style={[styles.header, headerStyle]}>
          <Text style={styles.question}>
            When were{'\n'}you born, {firstName || 'you'}?
          </Text>
          <Text style={styles.hint}>We'll calculate your life's hidden numbers</Text>
        </Animated.View>

        {/* Wheel picker */}
        <Animated.View style={[styles.wheelCard, wheelStyle]}>
          <PickerWheel
            items={MONTHS}
            selectedIndex={monthIdx}
            onSelect={setMonthIdx}
            flex={5}
          />
          <View style={styles.wheelDivider} />
          <PickerWheel
            items={DAYS}
            selectedIndex={dayIdx}
            onSelect={setDayIdx}
            flex={3}
          />
          <View style={styles.wheelDivider} />
          <PickerWheel
            items={YEARS}
            selectedIndex={yearIdx}
            onSelect={setYearIdx}
            flex={4}
          />
        </Animated.View>

        {/* Live preview */}
        <Animated.View style={[styles.preview, previewStyle]}>
          <Text style={styles.previewNumber}>{daysAlive.toLocaleString()}</Text>
          <Text style={styles.previewLabel}>days of life lived so far</Text>
        </Animated.View>

        <View style={{ flex: 1 }} />

        {/* CTA */}
        <Animated.View style={btnStyle}>
          <Pressable
            onPress={handleNext}
            style={({ pressed }) => [styles.nextBtn, pressed && styles.nextBtnPressed]}
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
    paddingTop:    spacing[8],
    paddingBottom: spacing[4],
  },
  header: {
    marginBottom: spacing[8],
  },
  question: {
    fontFamily:    fontFamily.bold,
    fontSize:      30,
    color:         colors.textPrimary,
    lineHeight:    37.5,
    marginBottom:  spacing[3],
    letterSpacing: -0.5,
  },
  hint: {
    fontFamily: fontFamily.regular,
    fontSize:   13,
    color:      colors.textMuted,
  },

  // Wheel card
  wheelCard: {
    flexDirection:   'row',
    backgroundColor: colors.white,
    borderRadius:    radius.xl,
    borderWidth:     1,
    borderColor:     colors.border,
    overflow:        'hidden',
    marginBottom:    spacing[5],
  },
  wheelDivider: {
    width:           1,
    backgroundColor: colors.borderLight,
    marginVertical:  spacing[3],
  },
  wheelCol: {
    alignItems:  'center',
    overflow:    'hidden',
    position:    'relative',
  },
  highlightStrip: {
    position:        'absolute',
    top:             ITEM_H * PAD_ITEMS,
    left:            0,
    right:           0,
    height:          ITEM_H,
    backgroundColor: colors.green50,
    borderTopWidth:  1,
    borderBottomWidth: 1,
    borderColor:     colors.green100,
    zIndex:          0,
  },
  wheelItem: {
    height:         ITEM_H,
    justifyContent: 'center',
    alignItems:     'center',
    paddingHorizontal: spacing[2],
  },
  wheelText: {
    fontFamily: fontFamily.medium,
    fontSize:   15,
    color:      colors.textPrimary,
  },
  wheelTextSelected: {
    fontFamily: fontFamily.bold,
    fontSize:   16,
    color:      colors.green700,
  },
  wheelTextNear: {
    color:   colors.textSecondary,
    opacity: 0.65,
  },
  wheelTextFar: {
    color:   colors.textMuted,
    opacity: 0.3,
    fontSize: 13,
  },

  // Preview stat
  preview: {
    alignItems:      'center',
    backgroundColor: colors.green50,
    borderRadius:    radius.xl,
    borderWidth:     1,
    borderColor:     colors.green100,
    paddingVertical: spacing[5],
    marginBottom:    spacing[4],
  },
  previewNumber: {
    fontFamily:   fontFamily.extraBold,
    fontSize:     34,
    color:        colors.green700,
    letterSpacing: -0.5,
    marginBottom: spacing[1],
  },
  previewLabel: {
    fontFamily: fontFamily.regular,
    fontSize:   12,
    color:      colors.textSecondary,
  },

  nextBtn: {
    backgroundColor: colors.green700,
    borderRadius:    radius.xl,
    paddingVertical: spacing[5],
    alignItems:      'center',
    marginBottom:    spacing[2],
  },
  nextBtnPressed: {
    opacity:   0.88,
    transform: [{ scale: 0.98 }],
  },
  nextText: {
    fontFamily:    fontFamily.bold,
    fontSize:      16,
    color:         colors.white,
    letterSpacing: 0.2,
  },
});
