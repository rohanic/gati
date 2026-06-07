/**
 * Place detail screen — full info card for a Wander place.
 * Week 7. Navigated to from the Wander home list.
 *
 * Features:
 *  - Animated hero (category color + icon)
 *  - AI summary, tags, rating, distance
 *  - Save/unsave in top bar
 *  - "I visited" CTA → opens RatingBottomSheet
 *  - "View on map" → navigates to map screen
 *  - Spring entrance per section
 *
 * NO emoji. NO purple. NO orange.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { RatingBottomSheet } from '@/components/wander';
import { useWanderStore } from '@/store/userStore';
import { getCategoryMeta } from '@/components/wander';
import { colors, spacing, radius, fontFamily, shadow } from '@/theme';
import type { WanderPlace } from '@/types';

// ─── Helpers ────────────────────────────────────────────────────
function RatingStars({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <Ionicons
          key={i}
          name={i < full ? 'star' : half && i === full ? 'star-half' : 'star-outline'}
          size={14}
          color={colors.gold}
        />
      ))}
    </View>
  );
}

// ─── Screen ─────────────────────────────────────────────────────
export default function PlaceDetailScreen() {
  const { placeId }  = useLocalSearchParams<{ placeId: string }>();
  const places       = useWanderStore((s) => s.places);
  const savePlace    = useWanderStore((s) => s.savePlace);
  const unsavePlace  = useWanderStore((s) => s.unsavePlace);

  const place = places.find((p) => p.placeId === placeId) ?? null;
  const [ratingOpen, setRatingOpen] = useState(false);

  // ── Entrance animations ──
  const heroOp    = useSharedValue(0);
  const heroScale = useSharedValue(0.96);
  const card1Op   = useSharedValue(0);
  const card2Op   = useSharedValue(0);
  const card3Op   = useSharedValue(0);

  useEffect(() => {
    heroOp.value    = withTiming(1, { duration: 340 });
    heroScale.value = withSpring(1, { stiffness: 200, damping: 20 });
    card1Op.value   = withDelay(220, withTiming(1, { duration: 300 }));
    card2Op.value   = withDelay(360, withTiming(1, { duration: 300 }));
    card3Op.value   = withDelay(480, withTiming(1, { duration: 300 }));
  }, []);

  const heroStyle  = useAnimatedStyle(() => ({ opacity: heroOp.value, transform: [{ scale: heroScale.value }] }));
  const card1Style = useAnimatedStyle(() => ({ opacity: card1Op.value }));
  const card2Style = useAnimatedStyle(() => ({ opacity: card2Op.value }));
  const card3Style = useAnimatedStyle(() => ({ opacity: card3Op.value }));

  const handleSaveToggle = useCallback(() => {
    if (!place) return;
    Haptics.selectionAsync();
    if (place.isSaved) unsavePlace(place.placeId);
    else savePlace(place.placeId);
  }, [place, savePlace, unsavePlace]);

  const handleVisited = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRatingOpen(true);
  }, []);

  const handleMapPress = useCallback(() => {
    router.push({ pathname: '/(tabs)/wander/map', params: { placeId } });
  }, [placeId]);

  if (!place) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.notFound}>
          <Ionicons name="map-outline" size={40} color={colors.green300} />
          <Text style={styles.notFoundText}>Place not found</Text>
          <Pressable onPress={() => router.back()} style={styles.backLink}>
            <Text style={styles.backLinkText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const meta = getCategoryMeta(place.category);
  const distanceLabel = place.distanceKm < 1
    ? `${Math.round(place.distanceKm * 1000)} m away`
    : `${place.distanceKm.toFixed(1)} km away`;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Custom top bar ── */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          <Text style={styles.backLabel}>Wander</Text>
        </Pressable>
        <Pressable onPress={handleSaveToggle} style={styles.saveBtn}>
          <Ionicons
            name={place.isSaved ? 'bookmark' : 'bookmark-outline'}
            size={22}
            color={place.isSaved ? colors.green700 : colors.textSecondary}
          />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── */}
        <Animated.View style={[styles.hero, { backgroundColor: meta.bgColor }, heroStyle]}>
          <View style={[styles.heroIcon, { backgroundColor: meta.color + '22' }]}>
            <Ionicons name={meta.icon as any} size={44} color={meta.color} />
          </View>
          <View style={styles.heroMeta}>
            <View style={[styles.categoryPill, { borderColor: meta.color + '44' }]}>
              <Text style={[styles.categoryPillText, { color: meta.color }]}>{meta.label}</Text>
            </View>
            <Text style={styles.heroName}>{place.name}</Text>
            <View style={styles.heroFooter}>
              <RatingStars rating={place.rating} />
              <Text style={styles.ratingNum}>{place.rating.toFixed(1)}</Text>
              <Text style={styles.ratingCount}>({place.reviewCount.toLocaleString()})</Text>
            </View>
          </View>
        </Animated.View>

        {/* ── Info card ── */}
        <Animated.View style={[styles.card, card1Style]}>
          {/* Address + distance */}
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="location-outline" size={16} color={colors.green500} />
            </View>
            <View style={styles.infoText}>
              <Text style={styles.infoMain}>{place.address}</Text>
              <Text style={styles.infoSub}>{distanceLabel}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Open now */}
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons
                name="time-outline"
                size={16}
                color={place.openNow === true ? colors.green500 : colors.textMuted}
              />
            </View>
            <Text style={[
              styles.infoMain,
              { color: place.openNow === true ? colors.green700 : colors.textMuted }
            ]}>
              {place.openNow === true ? 'Open now' : place.openNow === false ? 'Currently closed' : 'Hours unknown'}
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Reddit mentions */}
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="chatbubble-outline" size={16} color={colors.textMuted} />
            </View>
            <Text style={styles.infoMain}>
              Mentioned {place.redditMentions}x in local communities
            </Text>
          </View>
        </Animated.View>

        {/* ── AI summary card ── */}
        <Animated.View style={[styles.card, card2Style]}>
          <View style={styles.summaryLabel}>
            <Ionicons name="sparkles-outline" size={14} color={colors.green500} />
            <Text style={styles.summaryLabelText}>What the internet says</Text>
          </View>
          <Text style={styles.summaryText}>{place.aiSummary}</Text>

          {/* Tags */}
          <View style={styles.tagsRow}>
            {place.tags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* ── Actions card ── */}
        <Animated.View style={[styles.card, styles.actionsCard, card3Style]}>
          {/* Map button */}
          <Pressable
            onPress={handleMapPress}
            style={({ pressed }) => [styles.actionBtn, styles.actionBtnOutline, pressed && { opacity: 0.8 }]}
          >
            <Ionicons name="map-outline" size={18} color={colors.green700} />
            <Text style={styles.actionBtnOutlineText}>View on map</Text>
          </Pressable>

          {/* Visited CTA */}
          <Pressable
            onPress={handleVisited}
            style={({ pressed }) => [styles.actionBtn, styles.actionBtnFill, pressed && { opacity: 0.9 }]}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color={colors.white} />
            <Text style={styles.actionBtnFillText}>
              {place.isVisited ? 'Rate again' : 'I visited this place'}
            </Text>
          </Pressable>
        </Animated.View>

        <View style={{ height: spacing[10] }} />
      </ScrollView>

      {/* ── Rating bottom sheet ── */}
      <RatingBottomSheet
        place={ratingOpen ? place : null}
        onDismiss={() => setRatingOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.background,
  },

  topBar: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingHorizontal: spacing[4],
    paddingVertical:   spacing[3],
  },
  backBtn: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[1] + 1,
    paddingVertical:   spacing[1],
    paddingHorizontal: spacing[2],
  },
  backLabel: {
    fontFamily: fontFamily.medium,
    fontSize:   15,
    color:      colors.textPrimary,
  },
  saveBtn: {
    padding: spacing[2],
  },

  scroll:  { flex: 1 },
  content: {
    paddingHorizontal: spacing[5],
    paddingTop:        spacing[2],
  },

  // Hero
  hero: {
    borderRadius:  radius.xl,
    padding:       spacing[5],
    marginBottom:  spacing[4],
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[4],
    borderWidth:   1,
    borderColor:   colors.borderLight,
  },
  heroIcon: {
    width:          88,
    height:         88,
    borderRadius:   radius.xl,
    alignItems:     'center',
    justifyContent: 'center',
  },
  heroMeta:  { flex: 1, gap: spacing[2] },
  categoryPill: {
    alignSelf:         'flex-start',
    paddingVertical:   3,
    paddingHorizontal: spacing[2] + 2,
    borderRadius:      radius.full,
    borderWidth:       1,
    backgroundColor:   'rgba(255,255,255,0.6)',
  },
  categoryPillText: {
    fontFamily: fontFamily.semiBold,
    fontSize:   11,
  },
  heroName: {
    fontFamily:  fontFamily.bold,
    fontSize:    20,
    color:       colors.textPrimary,
    lineHeight:  26,
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[1] + 1,
  },
  ratingNum: {
    fontFamily:  fontFamily.semiBold,
    fontSize:    13,
    color:       colors.textSecondary,
    marginLeft:  2,
  },
  ratingCount: {
    fontFamily: fontFamily.regular,
    fontSize:   12,
    color:      colors.textMuted,
  },

  // Cards
  card: {
    backgroundColor: colors.white,
    borderRadius:    radius.xl,
    borderWidth:     1,
    borderColor:     colors.border,
    padding:         spacing[4],
    marginBottom:    spacing[3],
    ...shadow.xs,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           spacing[3],
    paddingVertical: spacing[1] + 1,
  },
  infoIcon: {
    width:          32,
    height:         32,
    borderRadius:   radius.md,
    backgroundColor: colors.green50,
    alignItems:     'center',
    justifyContent: 'center',
    marginTop:      1,
  },
  infoText:    { flex: 1 },
  infoMain: {
    fontFamily: fontFamily.medium,
    fontSize:   14,
    color:      colors.textPrimary,
    lineHeight: 20,
  },
  infoSub: {
    fontFamily: fontFamily.regular,
    fontSize:   12,
    color:      colors.textMuted,
    marginTop:  2,
  },
  divider: {
    height:          1,
    backgroundColor: colors.borderLight,
    marginVertical:  spacing[1],
  },

  summaryLabel: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[1] + 1,
    marginBottom:  spacing[3],
  },
  summaryLabelText: {
    fontFamily: fontFamily.semiBold,
    fontSize:   12,
    color:      colors.green500,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  summaryText: {
    fontFamily:   fontFamily.regular,
    fontSize:     14,
    color:        colors.textSecondary,
    lineHeight:   22,
    marginBottom: spacing[4],
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing[2],
  },
  tag: {
    paddingVertical:   3,
    paddingHorizontal: spacing[3],
    borderRadius:      radius.full,
    backgroundColor:   colors.surface2,
    borderWidth:       1,
    borderColor:       colors.borderLight,
  },
  tagText: {
    fontFamily: fontFamily.regular,
    fontSize:   12,
    color:      colors.textSecondary,
  },

  actionsCard: {
    flexDirection: 'row',
    gap:           spacing[3],
    alignItems:    'center',
  },
  actionBtn: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             spacing[2],
    paddingVertical: spacing[4],
    borderRadius:    radius.lg,
  },
  actionBtnOutline: {
    backgroundColor: colors.green50,
    borderWidth:     1,
    borderColor:     colors.green100,
  },
  actionBtnOutlineText: {
    fontFamily: fontFamily.semiBold,
    fontSize:   14,
    color:      colors.green700,
  },
  actionBtnFill: {
    backgroundColor: colors.green700,
  },
  actionBtnFillText: {
    fontFamily: fontFamily.semiBold,
    fontSize:   14,
    color:      colors.white,
  },

  notFound: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            spacing[4],
  },
  notFoundText: {
    fontFamily: fontFamily.bold,
    fontSize:   18,
    color:      colors.textPrimary,
  },
  backLink: {
    paddingVertical:   spacing[3],
    paddingHorizontal: spacing[5],
    borderRadius:      radius.lg,
    backgroundColor:   colors.green50,
  },
  backLinkText: {
    fontFamily: fontFamily.medium,
    fontSize:   14,
    color:      colors.green700,
  },
});
