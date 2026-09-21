import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Pressable,
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
import { OnboardingShell } from '@/components/onboarding/OnboardingShell';
import { useOnboardingStore } from '@/store/onboardingStore';
import { colors, spacing, radius, fontFamily } from '@/theme';
import { Text } from '@/components/ui/Text';

export default function NameScreen() {
  const { firstName, setFirstName } = useOnboardingStore();
  const [value, setValue] = useState(firstName);
  const inputRef = useRef<TextInput>(null);

  // ── Enter animations ──
  const questionY  = useSharedValue(24);
  const questionOp = useSharedValue(0);
  const inputY     = useSharedValue(20);
  const inputOp    = useSharedValue(0);
  const btnOp      = useSharedValue(0);

  useEffect(() => {
    questionY.value  = withSpring(0, { stiffness: 200, damping: 18 });
    questionOp.value = withTiming(1, { duration: 350 });
    inputY.value     = withDelay(120, withSpring(0, { stiffness: 200, damping: 18 }));
    inputOp.value    = withDelay(120, withTiming(1, { duration: 300 }));
    btnOp.value      = withDelay(280, withTiming(1, { duration: 300 }));

    // Auto-focus
    const t = setTimeout(() => inputRef.current?.focus(), 400);
    return () => clearTimeout(t);
  }, []);

  const questionStyle = useAnimatedStyle(() => ({
    opacity:   questionOp.value,
    transform: [{ translateY: questionY.value }],
  }));
  const inputStyle = useAnimatedStyle(() => ({
    opacity:   inputOp.value,
    transform: [{ translateY: inputY.value }],
  }));
  const btnStyle = useAnimatedStyle(() => ({ opacity: btnOp.value }));

  const canContinue = value.trim().length > 0;

  const handleNext = () => {
    if (!canContinue) return;
    setFirstName(value.trim());
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/onboarding/birthday');
  };

  return (
    <OnboardingShell step={1}>
      <View style={styles.content}>
        {/* Question */}
        <Animated.View style={[styles.questionBlock, questionStyle]}>
          <Text style={styles.question}>What should{'\n'}we call you?</Text>
          <Text style={styles.hint}>This appears on your personal stats</Text>
        </Animated.View>

        {/* Input */}
        <Animated.View style={[styles.inputWrap, inputStyle]}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={value}
            onChangeText={setValue}
            placeholder="Your first name"
            placeholderTextColor={colors.textMuted}
            returnKeyType="next"
            onSubmitEditing={handleNext}
            autoCapitalize="words"
            autoCorrect={false}
            selectionColor={colors.green700}
          />
          <View
            style={[
              styles.inputUnderline,
              { backgroundColor: value.length > 0 ? colors.green700 : colors.border },
            ]}
          />
        </Animated.View>

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Next button */}
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

  questionBlock: {
    marginBottom: spacing[10],
  },
  question: {
    fontFamily:   fontFamily.bold,
    fontSize:     30,
    color:        colors.textPrimary,
    lineHeight:   37.5,
    marginBottom: spacing[3],
    letterSpacing: -0.5,
  },
  hint: {
    fontFamily: fontFamily.regular,
    fontSize:   13,
    color:      colors.textMuted,
  },

  inputWrap: {
    marginBottom: spacing[3],
  },
  input: {
    fontFamily:  fontFamily.semiBold,
    fontSize:    26.5,
    color:       colors.textPrimary,
    paddingVertical: spacing[3],
    paddingHorizontal: 0,
    letterSpacing: -0.3,
  },
  inputUnderline: {
    height:       2,
    borderRadius: radius.full,
    marginTop:    spacing[1],
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
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  nextText: {
    fontFamily:    fontFamily.bold,
    fontSize:      16,
    color:         colors.white,
    letterSpacing: 0.2,
  },
  nextTextDisabled: {
    color: colors.green300,
  },
});
