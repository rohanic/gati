import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
// Lazy-loaded; also skipped entirely in Expo Go — remote + local notifications
// were removed from Expo Go in SDK 53 and calling any API throws there.
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';
const getNotifications = () => require('expo-notifications') as typeof import('expo-notifications');
import { Ionicons } from '@expo/vector-icons';
import { scheduleGatiNotifications } from '@/services/notifications';
import { OnboardingShell } from '@/components/onboarding/OnboardingShell';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useUserStore } from '@/store/userStore';
import { colors, spacing, radius, fontFamily } from '@/theme';
import { Text } from '@/components/ui/Text';

// ─── Notification time options ─────────────────────────────────
const TIME_OPTIONS = [
  {
    value: '08:00',
    label: 'Morning',
    time:  '8:00 AM',
    sub:   'Start the day with insight',
    icon:  'sunny-outline' as const,
    color: '#E8A020',
  },
  {
    value: '13:00',
    label: 'Afternoon',
    time:  '1:00 PM',
    sub:   'A midday moment of wonder',
    icon:  'partly-sunny-outline' as const,
    color: '#52A87A',
  },
  {
    value: '19:00',
    label: 'Evening',
    time:  '7:00 PM',
    sub:   'Wind down with your numbers',
    icon:  'moon-outline' as const,
    color: '#6B7FD7',
  },
  {
    value: '21:00',
    label: 'Night',
    time:  '9:00 PM',
    sub:   'Reflect before you sleep',
    icon:  'star-outline' as const,
    color: '#5B7F9E',
  },
] as const;

type TimeValue = (typeof TIME_OPTIONS)[number]['value'];

// ─── Option card ──────────────────────────────────────────────
function TimeCard({
  option,
  selected,
  onPress,
  delay,
}: {
  option:   (typeof TIME_OPTIONS)[number];
  selected: boolean;
  onPress:  () => void;
  delay:    number;
}) {
  const opacity = useSharedValue(0);
  const transX  = useSharedValue(20);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 280 }));
    transX.value  = withDelay(delay, withSpring(0, { stiffness: 220, damping: 20 }));
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ translateX: transX.value }],
  }));

  return (
    <Animated.View style={style}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.timeCard,
          selected && styles.timeCardSelected,
          pressed && !selected && { opacity: 0.8 },
        ]}
        android_ripple={{ color: colors.green50 }}
      >
        <View style={[styles.timeIcon, { backgroundColor: option.color + '18' }]}>
          <Ionicons name={option.icon} size={22} color={selected ? option.color : colors.textMuted} />
        </View>
        <View style={styles.timeText}>
          <Text style={[styles.timeLabel, selected && styles.timeLabelSelected]}>
            {option.label}
            <Text style={[styles.timeValue, selected && { color: colors.green700 }]}>
              {' · '}{option.time}
            </Text>
          </Text>
          <Text style={styles.timeSub}>{option.sub}</Text>
        </View>
        {selected ? (
          <View style={styles.selectedDot}>
            <Ionicons name="checkmark" size={12} color={colors.white} />
          </View>
        ) : (
          <View style={styles.unselectedDot} />
        )}
      </Pressable>
    </Animated.View>
  );
}

// ─── Screen ───────────────────────────────────────────────────
export default function NotificationsScreen() {
  const { notificationTime, setNotificationTime } = useOnboardingStore();
  const { updateProfile } = useUserStore();
  const [selected, setSelected] = useState<TimeValue>(
    (notificationTime as TimeValue) ?? '08:00'
  );
  const [loading, setLoading] = useState(false);

  const headOp = useSharedValue(0);
  const headY  = useSharedValue(20);
  const btnOp  = useSharedValue(0);

  useEffect(() => {
    headOp.value = withTiming(1, { duration: 350 });
    headY.value  = withSpring(0, { stiffness: 200, damping: 18 });
    btnOp.value  = withDelay(460, withTiming(1, { duration: 300 }));
  }, []);

  const headStyle = useAnimatedStyle(() => ({
    opacity:   headOp.value,
    transform: [{ translateY: headY.value }],
  }));
  const btnStyle = useAnimatedStyle(() => ({ opacity: btnOp.value }));

  const handleSelect = (value: TimeValue) => {
    Haptics.selectionAsync();
    setSelected(value);
  };

  const handleNext = async () => {
    setLoading(true);
    setNotificationTime(selected);
    updateProfile({ notificationTime: selected });

    // Expo Go has no notification support since SDK 53 — skip entirely there.
    if (!IS_EXPO_GO) {
      try {
        await getNotifications().requestPermissionsAsync();
        await scheduleGatiNotifications(selected);
      } catch (_) {
        // Notifications not critical — continue anyway
      }
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setLoading(false);
    router.push('/onboarding/complete');
  };

  return (
    <OnboardingShell step={13}>
      <View style={styles.content}>
        {/* Header */}
        <Animated.View style={[styles.header, headStyle]}>
          <Text style={styles.question}>
            When should we{'\n'}share your daily stat?
          </Text>
          <Text style={styles.hint}>
            One new life number, delivered once a day
          </Text>
        </Animated.View>

        {/* Options */}
        <View style={styles.options}>
          {TIME_OPTIONS.map((opt, i) => (
            <TimeCard
              key={opt.value}
              option={opt}
              selected={selected === opt.value}
              onPress={() => handleSelect(opt.value)}
              delay={i * 70}
            />
          ))}
        </View>

        <View style={{ flex: 1 }} />

        {/* CTA */}
        <Animated.View style={btnStyle}>
          <Pressable
            onPress={handleNext}
            disabled={loading}
            style={({ pressed }) => [styles.nextBtn, pressed && styles.nextBtnPressed]}
          >
            <Text style={styles.nextText}>
              {loading ? 'Setting up…' : 'Continue'}
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
    fontSize:      28,
    color:         colors.textPrimary,
    lineHeight:    35.5,
    marginBottom:  spacing[3],
    letterSpacing: -0.5,
  },
  hint: {
    fontFamily: fontFamily.regular,
    fontSize:   13,
    color:      colors.textMuted,
  },

  options: {
    gap: spacing[2] + 2,
  },
  timeCard: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   colors.white,
    borderRadius:      radius.xl,
    borderWidth:       1.5,
    borderColor:       colors.border,
    paddingVertical:   spacing[4],
    paddingHorizontal: spacing[4],
    gap:               spacing[3],
    overflow:          'hidden',
  },
  timeCardSelected: {
    borderColor:     colors.green700,
    backgroundColor: colors.green50,
  },
  timeIcon: {
    width:          44,
    height:         44,
    borderRadius:   radius.lg,
    alignItems:     'center',
    justifyContent: 'center',
  },
  timeText: { flex: 1 },
  timeLabel: {
    fontFamily:   fontFamily.semiBold,
    fontSize:     14,
    color:        colors.textPrimary,
    marginBottom: 2,
  },
  timeLabelSelected: {
    color: colors.green700,
  },
  timeValue: {
    fontFamily: fontFamily.regular,
    fontSize:   13,
    color:      colors.textSecondary,
  },
  timeSub: {
    fontFamily: fontFamily.regular,
    fontSize:   12,
    color:      colors.textMuted,
  },
  selectedDot: {
    width:           20,
    height:          20,
    borderRadius:    radius.full,
    backgroundColor: colors.green700,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     0,
  },
  unselectedDot: {
    width:        20,
    height:       20,
    borderRadius: radius.full,
    borderWidth:  2,
    borderColor:  colors.border,
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
