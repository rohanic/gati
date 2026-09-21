/**
 * Rating bottom sheet — shown after visiting a place.
 * Three options: Loved it / Good / Not for me.
 * Updates taste-learning scores in WanderStore.
 * Spring entrance from bottom, spring press per option.
 * NO emoji. NO purple. NO orange.
 */
import React, { useEffect, useRef, useCallback } from 'react';
import { View, Modal, StyleSheet, Pressable, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius, fontFamily } from '@/theme';
import type { WanderPlace, UserRating } from '@/types';
import { useWanderStore, useUserStore } from '@/store/userStore';
import { pushPlaceRating } from '@/services/cloudSync';
import { Text } from '@/components/ui/Text';

// ─── Option config ──────────────────────────────────────────────
interface RatingOption {
  value:    UserRating;
  label:    string;
  sub:      string;
  icon:     string;
  color:    string;
  bgColor:  string;
}

const RATING_OPTIONS: RatingOption[] = [
  {
    value:   'loved',
    label:   'Loved it',
    sub:     'A favourite. Show me more like this',
    icon:    'heart',
    color:   colors.green700,
    bgColor: colors.green50,
  },
  {
    value:   'good',
    label:   'Pretty good',
    sub:     'Worth a visit',
    icon:    'thumbs-up-outline',
    color:   colors.gold,
    bgColor: colors.goldBg,
  },
  {
    value:   'not_for_me',
    label:   'Not for me',
    sub:     'Show me different things',
    icon:    'thumbs-down-outline',
    color:   colors.textMuted,
    bgColor: colors.surface2,
  },
];

// ─── Option button ──────────────────────────────────────────────
function RatingOptionBtn({
  option,
  onSelect,
}: {
  option:   RatingOption;
  onSelect: (v: UserRating) => void;
}) {
  const scale = useSharedValue(1);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Bounce runs in parallel — select fires immediately (double-tap is guarded
    // at the sheet level in handleSelect).
    scale.value = withSpring(0.95, { stiffness: 400, damping: 18 }, () => {
      scale.value = withSpring(1, { stiffness: 300, damping: 25 });
    });
    onSelect(option.value);
  };

  return (
    <Animated.View style={style}>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.optionBtn,
          { backgroundColor: option.bgColor, borderColor: option.color + '33' },
          pressed && { opacity: 0.85 },
        ]}
      >
        <View style={[styles.optionIcon, { backgroundColor: option.color + '18' }]}>
          <Ionicons name={option.icon as any} size={24} color={option.color} />
        </View>
        <View style={styles.optionText}>
          <Text style={[styles.optionLabel, { color: option.color }]}>{option.label}</Text>
          <Text style={styles.optionSub}>{option.sub}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={option.color + '88'} />
      </Pressable>
    </Animated.View>
  );
}

// ─── Bottom sheet ───────────────────────────────────────────────
interface RatingBottomSheetProps {
  place:      WanderPlace | null;
  onDismiss:  () => void;
}

export function RatingBottomSheet({ place, onDismiss }: RatingBottomSheetProps) {
  const ratePlace   = useWanderStore((s) => s.ratePlace);
  const markVisited = useWanderStore((s) => s.markVisited);
  const updateScore = useWanderStore((s) => s.updateScore);
  const userId      = useUserStore((s) => s.userId);

  const sheetY    = useSharedValue(400);
  const overlayOp = useSharedValue(0);
  const visible   = place !== null;

  // Guards against tapping two rating options in quick succession (which would
  // apply the taste-score adjustment twice). Reset each time the sheet opens.
  const selectingRef = useRef(false);

  useEffect(() => {
    if (visible) {
      selectingRef.current = false;
      overlayOp.value = withTiming(1, { duration: 240 });
      sheetY.value    = withSpring(0, { stiffness: 220, damping: 22 });
    } else {
      // Reset off-screen when hidden so the next open always slides in — even
      // if the parent cleared `place` without going through animateOut.
      overlayOp.value = 0;
      sheetY.value    = 400;
    }
  }, [visible]);

  const animateOut = useCallback((cb: () => void) => {
    overlayOp.value = withTiming(0, { duration: 220 });
    sheetY.value    = withTiming(400, { duration: 260, easing: Easing.bezier(0.11, 0, 0.5, 0) });
    setTimeout(cb, 280);
  }, []);

  const handleSelect = useCallback((rating: UserRating) => {
    if (!place || selectingRef.current) return;
    selectingRef.current = true;
    ratePlace(place.placeId, rating);
    markVisited(place.placeId);
    updateScore(place.category, rating);
    // Push crowd signal to Supabase — fire-and-forget, never blocks UX
    if (userId) {
      pushPlaceRating(userId, place.placeId, rating).catch(() => {});
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    animateOut(onDismiss);
  }, [place, ratePlace, markVisited, updateScore, userId, animateOut, onDismiss]);

  const handleDismiss = useCallback(() => {
    animateOut(onDismiss);
  }, [animateOut, onDismiss]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOp.value }));
  const sheetStyle   = useAnimatedStyle(() => ({ transform: [{ translateY: sheetY.value }] }));

  if (!place) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <Animated.View style={[styles.overlay, overlayStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss} />
        <Animated.View style={[styles.sheet, sheetStyle]}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.placeName} numberOfLines={1}>{place.name}</Text>
            <Text style={styles.headerSub}>How was it?</Text>
          </View>

          {/* Options */}
          <View style={styles.options}>
            {RATING_OPTIONS.map((opt) => (
              <RatingOptionBtn key={opt.value} option={opt} onSelect={handleSelect} />
            ))}
          </View>

          {/* Skip */}
          <Pressable onPress={handleDismiss} style={styles.skip}>
            <Text style={styles.skipText}>Skip for now</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex:            1,
    backgroundColor: 'rgba(10, 24, 14, 0.55)',
    justifyContent:  'flex-end',
  },
  sheet: {
    backgroundColor:      colors.surface,
    borderTopLeftRadius:  radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    paddingTop:           spacing[3],
    paddingBottom:        Platform.OS === 'ios' ? spacing[10] : spacing[7],
    paddingHorizontal:    spacing[5],
    shadowColor:          '#000',
    shadowOffset:         { width: 0, height: -2 },
    shadowOpacity:        0.07,
    shadowRadius:         10,
    elevation:            10,
  },
  handle: {
    width:           36,
    height:          4,
    borderRadius:    2,
    backgroundColor: colors.borderLight,
    alignSelf:       'center',
    marginBottom:    spacing[5],
  },
  header: {
    marginBottom: spacing[5],
  },
  placeName: {
    fontFamily:   fontFamily.bold,
    fontSize:     19,
    color:        colors.textPrimary,
    marginBottom: 3,
  },
  headerSub: {
    fontFamily: fontFamily.regular,
    fontSize:   13,
    color:      colors.textSecondary,
  },
  options: {
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  optionBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing[3],
    paddingVertical:   spacing[4],
    paddingHorizontal: spacing[4],
    borderRadius:      radius.xl,
    borderWidth:       1,
  },
  optionIcon: {
    width:          44,
    height:         44,
    borderRadius:   radius.md,
    alignItems:     'center',
    justifyContent: 'center',
  },
  optionText: { flex: 1 },
  optionLabel: {
    fontFamily:   fontFamily.semiBold,
    fontSize:     14,
    marginBottom: 2,
  },
  optionSub: {
    fontFamily: fontFamily.regular,
    fontSize:   11.5,
    color:      colors.textMuted,
  },
  skip: {
    alignItems: 'center',
    paddingVertical: spacing[3],
  },
  skipText: {
    fontFamily: fontFamily.regular,
    fontSize:   13,
    color:      colors.textMuted,
  },
});
