/**
 * Shared wrapper for onboarding screens.
 * Renders: top progress dots + optional back arrow, then children.
 */
import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ViewStyle,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius, fontFamily } from '@/theme';

const TOTAL_STEPS = 5; // name, birthday, lifestyle, interests, notifications

interface OnboardingShellProps {
  step:          number;       // 1-based, 0 = welcome (no dots)
  showBack?:     boolean;
  children:      React.ReactNode;
  scrollable?:   boolean;
  contentStyle?: ViewStyle;
}

export function OnboardingShell({
  step,
  showBack = true,
  children,
  scrollable = false,
  contentStyle,
}: OnboardingShellProps) {
  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const inner = scrollable ? (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, contentStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.inner, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          {showBack && step > 0 ? (
            <Pressable
              onPress={handleBack}
              style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
              hitSlop={12}
            >
              <Ionicons name="arrow-back" size={22} color={colors.textSecondary} />
            </Pressable>
          ) : (
            <View style={styles.backBtn} />
          )}

          {/* Step dots */}
          {step > 0 ? (
            <View style={styles.dots}>
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <StepDot key={i} active={i < step} current={i === step - 1} />
              ))}
            </View>
          ) : (
            <View />
          )}

          {/* Spacer to balance back button */}
          <View style={styles.backBtn} />
        </View>

        {inner}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function StepDot({ active, current }: { active: boolean; current: boolean }) {
  const width = useSharedValue(current ? 20 : active ? 8 : 6);

  React.useEffect(() => {
    width.value = withSpring(current ? 20 : active ? 8 : 6, {
      stiffness: 300,
      damping: 25,
    });
  }, [active, current]);

  const style = useAnimatedStyle(() => ({ width: width.value }));

  return (
    <Animated.View
      style={[
        styles.dot,
        style,
        {
          backgroundColor: active
            ? colors.green700
            : colors.green100,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.background,
  },
  kav: { flex: 1 },
  topBar: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: spacing[5],
    paddingVertical:   spacing[3],
  },
  backBtn: {
    width:  36,
    height: 36,
    alignItems:     'center',
    justifyContent: 'center',
  },
  dots: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[1],
  },
  dot: {
    height:       6,
    borderRadius: radius.full,
  },
  inner: {
    flex:              1,
    paddingHorizontal: spacing[6],
  },
  scrollContent: {
    paddingHorizontal: spacing[6],
    paddingBottom:     spacing[8],
  },
});
