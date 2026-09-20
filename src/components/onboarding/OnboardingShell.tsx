/**
 * Shared wrapper for onboarding screens.
 * Renders: spring-animated progress bar + back arrow, then children.
 */
import React from 'react';
import {
  View,
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
import { colors, spacing, radius } from '@/theme';

const TOTAL_STEPS = 13; // name, birthday, sleep, coffee, water, screentime, music, meals, activity, commute, personality, interests, notifications

interface OnboardingShellProps {
  step:          number;
  showBack?:     boolean;
  children:      React.ReactNode;
  scrollable?:   boolean;
  contentStyle?: ViewStyle;
}

function ProgressBar({ step }: { step: number }) {
  const progress = useSharedValue((step - 1) / TOTAL_STEPS);

  React.useEffect(() => {
    progress.value = withSpring(step / TOTAL_STEPS, { stiffness: 160, damping: 22 });
  }, [step]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.min(progress.value * 100, 100)}%` as any,
  }));

  return (
    <View style={pbStyles.track}>
      <Animated.View style={[pbStyles.fill, fillStyle]} />
    </View>
  );
}

const pbStyles = StyleSheet.create({
  track: {
    flex:            1,
    height:          3,
    backgroundColor: colors.green100,
    borderRadius:    radius.full,
    overflow:        'hidden',
  },
  fill: {
    height:          3,
    backgroundColor: colors.green700,
    borderRadius:    radius.full,
  },
});

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
        <View style={styles.topBar}>
          {showBack && step > 0 ? (
            <Pressable
              onPress={handleBack}
              style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.55 }]}
              hitSlop={12}
            >
              <Ionicons name="arrow-back" size={22} color={colors.textSecondary} />
            </Pressable>
          ) : (
            <View style={styles.backBtn} />
          )}

          {step > 0 && <ProgressBar step={step} />}

          <View style={styles.backBtn} />
        </View>

        {inner}
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    gap:               spacing[3],
    paddingHorizontal: spacing[5],
    paddingVertical:   spacing[3],
  },
  backBtn: {
    width:          36,
    height:         36,
    alignItems:     'center',
    justifyContent: 'center',
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
