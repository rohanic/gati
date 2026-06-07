/**
 * Animated place card for the Wander home list.
 * Staggered spring entrance, spring press-scale, save toggle.
 * Category-coloured thumbnail placeholder (no real images).
 * NO emoji. NO purple. NO orange.
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius, fontFamily, shadow } from '@/theme';
import type { WanderPlace } from '@/types';
import { getCategoryMeta } from './CategoryChips';

// ─── Rating row ─────────────────────────────────────────────────
function RatingRow({ rating, reviewCount }: { rating: number; reviewCount: number }) {
  const fullStars = Math.floor(rating);
  const hasHalf   = rating - fullStars >= 0.5;

  return (
    <View style={styles.ratingRow}>
      {Array.from({ length: 5 }, (_, i) => (
        <Ionicons
          key={i}
          name={i < fullStars ? 'star' : hasHalf && i === fullStars ? 'star-half' : 'star-outline'}
          size={11}
          color={colors.gold}
        />
      ))}
      <Text style={styles.ratingNum}>{rating.toFixed(1)}</Text>
      <Text style={styles.ratingCount}>({reviewCount.toLocaleString()})</Text>
    </View>
  );
}

// ─── Thumbnail placeholder ──────────────────────────────────────
function CategoryThumb({ category }: { category: WanderPlace['category'] }) {
  const meta = getCategoryMeta(category);
  return (
    <View style={[styles.thumb, { backgroundColor: meta.bgColor }]}>
      <Ionicons name={meta.icon as any} size={26} color={meta.color} />
    </View>
  );
}

// ─── Card ───────────────────────────────────────────────────────
interface PlaceCardProps {
  place:    WanderPlace;
  index:    number;
  onPress:  (placeId: string) => void;
  onSave:   (placeId: string) => void;
  onUnsave: (placeId: string) => void;
}

export function PlaceCard({ place, index, onPress, onSave, onUnsave }: PlaceCardProps) {
  const meta    = getCategoryMeta(place.category);
  const opacity = useSharedValue(0);
  const transY  = useSharedValue(14);
  const scale   = useSharedValue(1);

  useEffect(() => {
    const delay   = Math.min(index, 8) * 60;
    opacity.value = withDelay(delay, withTiming(1, { duration: 280 }));
    transY.value  = withDelay(delay, withSpring(0, { stiffness: 220, damping: 20 }));
  }, []);

  const cardStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ translateY: transY.value }, { scale: scale.value }],
  }));

  const handlePress = () => {
    scale.value = withSpring(0.97, { stiffness: 400, damping: 20 }, () => {
      scale.value = withSpring(1, { stiffness: 300, damping: 25 });
    });
    setTimeout(() => onPress(place.placeId), 80);
  };

  const handleSave = () => {
    Haptics.selectionAsync();
    if (place.isSaved) onUnsave(place.placeId);
    else onSave(place.placeId);
  };

  const distanceLabel = place.distanceKm < 1
    ? `${Math.round(place.distanceKm * 1000)} m`
    : `${place.distanceKm.toFixed(1)} km`;

  return (
    <Animated.View style={[styles.container, cardStyle]}>
      <Pressable
        onPress={handlePress}
        style={styles.card}
        android_ripple={{ color: colors.green50 }}
        accessibilityRole="button"
        accessibilityLabel={`${place.name}, ${meta.label}, ${distanceLabel} away`}
        accessibilityHint="Tap to see place details"
      >
        {/* Thumbnail */}
        <CategoryThumb category={place.category} />

        {/* Info */}
        <View style={styles.info}>
          {/* Top row: name + open badge */}
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{place.name}</Text>
            {place.openNow === true && (
              <View style={styles.openBadge}>
                <Text style={styles.openText}>Open</Text>
              </View>
            )}
          </View>

          {/* Category label */}
          <Text style={[styles.category, { color: meta.color }]}>
            {meta.label}
          </Text>

          {/* Summary preview */}
          <Text style={styles.summary} numberOfLines={2}>
            {place.aiSummary}
          </Text>

          {/* Footer: rating + distance */}
          <View style={styles.footer}>
            <RatingRow rating={place.rating} reviewCount={place.reviewCount} />
            <View style={styles.distanceBadge}>
              <Ionicons name="navigate-outline" size={10} color={colors.textMuted} />
              <Text style={styles.distanceText}>{distanceLabel}</Text>
            </View>
          </View>
        </View>

        {/* Save button */}
        <Pressable
          onPress={handleSave}
          style={styles.saveBtn}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={place.isSaved ? 'Remove from saved places' : 'Save place'}
        >
          <Ionicons
            name={place.isSaved ? 'bookmark' : 'bookmark-outline'}
            size={20}
            color={place.isSaved ? colors.green700 : colors.textMuted}
          />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing[5],
    marginBottom:     spacing[3],
  },
  card: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: colors.white,
    borderRadius:    radius.xl,
    borderWidth:     1,
    borderColor:     colors.border,
    overflow:        'hidden',
    ...shadow.xs,
  },

  thumb: {
    width:          88,
    height:         88,
    alignItems:     'center',
    justifyContent: 'center',
  },

  info: {
    flex:    1,
    padding: spacing[3],
    gap:     2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[2],
  },
  name: {
    flex:       1,
    fontFamily: fontFamily.bold,
    fontSize:   14,
    color:      colors.textPrimary,
  },
  openBadge: {
    paddingVertical:   2,
    paddingHorizontal: spacing[2],
    borderRadius:      radius.full,
    backgroundColor:   colors.green50,
    borderWidth:       1,
    borderColor:       colors.green100,
  },
  openText: {
    fontFamily: fontFamily.semiBold,
    fontSize:   10,
    color:      colors.green700,
  },
  category: {
    fontFamily: fontFamily.medium,
    fontSize:   11,
    marginTop:  1,
  },
  summary: {
    fontFamily: fontFamily.regular,
    fontSize:   12,
    color:      colors.textMuted,
    lineHeight: 17,
    marginTop:  3,
  },
  footer: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[3],
    marginTop:     spacing[1] + 1,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           2,
  },
  ratingNum: {
    fontFamily:  fontFamily.semiBold,
    fontSize:    11,
    color:       colors.textSecondary,
    marginLeft:  3,
  },
  ratingCount: {
    fontFamily: fontFamily.regular,
    fontSize:   10,
    color:      colors.textMuted,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           2,
  },
  distanceText: {
    fontFamily: fontFamily.regular,
    fontSize:   11,
    color:      colors.textMuted,
  },

  saveBtn: {
    padding: spacing[4],
  },
});
