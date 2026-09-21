/**
 * Place detail screen — full info card for a Wander place.
 *
 * Hero:
 *   - Real Google photo fills the top banner when thumbnailUrl is set,
 *     with a gradient overlay carrying the name/category.
 *   - Falls back to gradient + centered icon when no photo is available.
 *
 * Actions (responsive):
 *   - Two secondary buttons side-by-side: "View on map" + "Open in Google Maps"
 *   - Full-width primary CTA: "I visited this place"
 *   - All button labels use adjustsFontSizeToFit so they never overflow.
 *
 * NO emoji. NO purple. NO orange. Forest green + off-white palette.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  Linking,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
// See PlaceCard for why remote photos use expo-image.
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { googleMapsUrl } from '@/services/placesService';
import { RatingBottomSheet } from '@/components/wander';
import { useWanderStore, FREE_SAVE_LIMIT } from '@/store/userStore';
import { getCategoryMeta } from '@/components/wander';
import { colors, spacing, radius, fontFamily, shadow } from '@/theme';
import type { WanderPlace } from '@/types';
import { Text } from '@/components/ui/Text';

// ─── Hero banner ─────────────────────────────────────────────────
// Full-width banner at the top of the detail screen.
// Priority: real Google photo → gradient + icon fallback.
function HeroBanner({
  place,
  bannerHeight,
}: {
  place:        WanderPlace;
  bannerHeight: number;
}) {
  const [failed, setFailed] = useState(false);
  const imgOp               = useSharedValue(0);
  const meta                = getCategoryMeta(place.category);
  const hasPhoto            = !!place.thumbnailUrl && !failed;

  const imgStyle = useAnimatedStyle(() => ({ opacity: imgOp.value }));

  return (
    <View style={[styles.heroBanner, { height: bannerHeight }]}>
      {/* ── Layer 1: gradient background (always shown) ── */}
      <LinearGradient
        colors={[meta.bgColor, meta.color + '55']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* ── Centered icon (visible until/if photo loads) ── */}
      {!hasPhoto && (
        <View style={[StyleSheet.absoluteFill, styles.heroIconWrap]}>
          <View style={[styles.heroIconBox, { borderColor: meta.color + '33' }]}>
            <Ionicons name={meta.icon as any} size={52} color={meta.color} />
          </View>
        </View>
      )}

      {/* ── Layer 2: real photo fades in ── */}
      {hasPhoto && (
        <Animated.View style={[StyleSheet.absoluteFill, imgStyle]}>
          <Image
            source={place.thumbnailUrl!}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            recyclingKey={place.placeId}
            cachePolicy="memory-disk"
            transition={0}
            onLoad={() => { imgOp.value = withTiming(1, { duration: 320 }); }}
            onError={() => setFailed(true)}
          />
        </Animated.View>
      )}

      {/* ── Gradient overlay: always covers bottom third for legibility ── */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.55)']}
        start={{ x: 0, y: 0.35 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* ── Name + category overlaid at bottom ── */}
      <View style={styles.heroOverlay}>
        <View style={[styles.categoryPill, { borderColor: meta.color + '66' }]}>
          <Text
            style={[styles.categoryPillText, { color: hasPhoto ? colors.white : meta.color }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {meta.label}
          </Text>
        </View>
        <Text style={styles.heroName} numberOfLines={2} adjustsFontSizeToFit>
          {place.name}
        </Text>
        {place.rating > 0 ? (
          <View style={styles.heroFooter}>
            {Array.from({ length: 5 }, (_, i) => (
              <Ionicons
                key={i}
                name={
                  i < Math.floor(place.rating)
                    ? 'star'
                    : place.rating - Math.floor(place.rating) >= 0.5 && i === Math.floor(place.rating)
                    ? 'star-half'
                    : 'star-outline'
                }
                size={13}
                color={colors.gold}
              />
            ))}
            <Text style={styles.ratingNum}>{place.rating.toFixed(1)}</Text>
            <Text style={styles.ratingCount}>
              ({place.reviewCount.toLocaleString()})
            </Text>
          </View>
        ) : (
          <View style={styles.heroFooter}>
            <Ionicons name="map-outline" size={12} color="rgba(255,255,255,0.75)" />
            <Text style={styles.ratingCount}>Ratings on Google Maps</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Screen ─────────────────────────────────────────────────────
export default function PlaceDetailScreen() {
  const { placeId }  = useLocalSearchParams<{ placeId: string }>();
  const { width }    = useWindowDimensions();
  const insets       = useSafeAreaInsets();
  const places       = useWanderStore((s) => s.places);
  const savePlace    = useWanderStore((s) => s.savePlace);
  const unsavePlace  = useWanderStore((s) => s.unsavePlace);
  const removeVisit  = useWanderStore((s) => s.removeVisit);
  const markVisited  = useWanderStore((s) => s.markVisited);

  const place = places.find((p) => p.placeId === placeId) ?? null;
  const [ratingOpen, setRatingOpen] = useState(false);

  // Banner height: 42 % of screen width (4:2.4 aspect, feels editorial)
  const bannerHeight = Math.round(width * 0.56);

  // ── Entrance animations ──
  const card1Op = useSharedValue(0);
  const card2Op = useSharedValue(0);
  const card3Op = useSharedValue(0);

  useEffect(() => {
    card1Op.value = withDelay(160, withTiming(1, { duration: 300 }));
    card2Op.value = withDelay(280, withTiming(1, { duration: 300 }));
    card3Op.value = withDelay(400, withTiming(1, { duration: 300 }));
  }, []);

  const card1Style = useAnimatedStyle(() => ({ opacity: card1Op.value }));
  const card2Style = useAnimatedStyle(() => ({ opacity: card2Op.value }));
  const card3Style = useAnimatedStyle(() => ({ opacity: card3Op.value }));

  const handleSaveToggle = useCallback(() => {
    if (!place) return;
    Haptics.selectionAsync();
    if (place.isSaved) {
      unsavePlace(place.placeId);
      return;
    }
    // savePlace enforces the free-tier cap; false = limit hit → route to /pro.
    const ok = savePlace(place.placeId);
    if (!ok) {
      Alert.alert(
        'Saved places limit reached',
        `Free accounts can save up to ${FREE_SAVE_LIMIT} places. Upgrade to Pro for unlimited saves.`,
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Upgrade', onPress: () => router.push('/pro') },
        ]
      );
    }
  }, [place, savePlace, unsavePlace]);

  const handleVisited = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Mark as visited immediately — rating is optional feedback.
    // Without this, tapping "Skip for now" left the place unmarked.
    if (!place?.isVisited) markVisited(placeId);
    setRatingOpen(true);
  }, [place?.isVisited, markVisited, placeId]);

  const handleMapPress = useCallback(() => {
    router.push({ pathname: '/(tabs)/wander/map', params: { placeId } });
  }, [placeId]);

  const handleOpenGoogleMaps = useCallback(() => {
    if (!place) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(googleMapsUrl(place)).catch(() => {});
  }, [place]);

  if (!place) {
    return (
      <View style={[styles.safe, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.notFound}>
          <Ionicons name="map-outline" size={40} color={colors.green300} />
          <Text style={styles.notFoundText}>Place not found</Text>
          <Pressable onPress={() => router.back()} style={styles.backLink}>
            <Text style={styles.backLinkText}>Go back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const meta = getCategoryMeta(place.category);
  const distanceLabel = place.distanceKm < 1
    ? `${Math.round(place.distanceKm * 1000)} m away`
    : `${place.distanceKm.toFixed(1)} km away`;

  return (
    <View style={styles.safe}>
      {/* ── Floating top bar — sits precisely below the status bar ── */}
      <View style={[styles.topBar, { top: insets.top + spacing[2] }]}>
        <Pressable onPress={() => router.back()} style={styles.topBtn}>
          <Ionicons name="arrow-back" size={18} color={colors.textPrimary} />
          <Text style={styles.backLabel} numberOfLines={1} adjustsFontSizeToFit>
            Wander
          </Text>
        </Pressable>
        <Pressable
          onPress={handleSaveToggle}
          style={styles.topBtn}
          accessibilityRole="button"
          accessibilityLabel={place.isSaved ? 'Remove from saved' : 'Save place'}
        >
          <Ionicons
            name={place.isSaved ? 'bookmark' : 'bookmark-outline'}
            size={22}
            color={place.isSaved ? colors.green700 : colors.textSecondary}
          />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing[6] }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero banner ── */}
        <HeroBanner place={place} bannerHeight={bannerHeight} />

        {/* ── Info card ── */}
        <Animated.View style={[styles.card, card1Style]}>
          {/* Address + distance */}
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="location-outline" size={16} color={colors.green500} />
            </View>
            <View style={styles.infoText}>
              <Text style={styles.infoMain} numberOfLines={2}>
                {place.address || 'Exact pin in Google Maps'}
              </Text>
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
            <Text
              style={[
                styles.infoMain,
                { color: place.openNow === true ? colors.green700 : colors.textMuted },
              ]}
            >
              {place.openNow === true
                ? 'Open now'
                : place.openNow === false
                ? 'Currently closed'
                : 'Hours unknown'}
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
          {place.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {place.tags.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </Animated.View>

        {/* ── Actions card ── */}
        <Animated.View style={[styles.card, card3Style]}>
          {/* Row: two secondary outline buttons */}
          <View style={styles.secondaryRow}>
            <Pressable
              onPress={handleMapPress}
              style={({ pressed }) => [
                styles.secondaryBtn,
                pressed && { opacity: 0.8 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="View on map"
            >
              <Ionicons name="map-outline" size={17} color={colors.green700} />
              <Text
                style={styles.secondaryBtnText}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                View on map
              </Text>
            </Pressable>

            <Pressable
              onPress={handleOpenGoogleMaps}
              style={({ pressed }) => [
                styles.secondaryBtn,
                pressed && { opacity: 0.8 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Open in Google Maps"
            >
              <Ionicons name="navigate-outline" size={17} color={colors.green700} />
              <Text
                style={styles.secondaryBtnText}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                Google Maps
              </Text>
            </Pressable>
          </View>

          {/* Primary CTA — full width */}
          <Pressable
            onPress={handleVisited}
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && { opacity: 0.9 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={place.isVisited ? 'Rate this place again' : 'Mark as visited'}
          >
            <Ionicons
              name="checkmark-circle-outline"
              size={19}
              color={colors.white}
            />
            <Text
              style={styles.primaryBtnText}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {place.isVisited ? 'Rate again' : 'I visited this place'}
            </Text>
          </Pressable>

          {/* Remove visit — text link below */}
          {place.isVisited && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                removeVisit(place.placeId);
              }}
              style={styles.removeVisitBtn}
              accessibilityRole="button"
              accessibilityLabel="Remove visit mark"
            >
              <Text style={styles.removeVisitText}>Remove visit</Text>
            </Pressable>
          )}
        </Animated.View>

        <View style={{ height: spacing[10] }} />
      </ScrollView>

      {/* ── Rating bottom sheet ── */}
      <RatingBottomSheet
        place={ratingOpen ? place : null}
        onDismiss={() => setRatingOpen(false)}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.background,
  },

  // Top bar floats above hero — `top` is set inline from useSafeAreaInsets
  topBar: {
    position:          'absolute',
    left:              0,
    right:             0,
    zIndex:            10,
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingHorizontal: spacing[4],
  },
  topBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing[1] + 1,
    paddingVertical:   spacing[1] + 2,
    paddingHorizontal: spacing[3],
    borderRadius:      radius.full,
    backgroundColor:   'rgba(255,255,255,0.88)',
    borderWidth:       1,
    borderColor:       'rgba(0,0,0,0.07)',
  },
  backLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize:   13,
    color:      colors.textPrimary,
  },

  scroll:  { flex: 1 },
  content: { paddingTop: 0 },

  // ── Hero banner
  heroBanner: {
    width:        '100%',
    overflow:     'hidden',
    marginBottom: spacing[4],
  },
  heroIconWrap: {
    alignItems:     'center',
    justifyContent: 'center',
  },
  heroIconBox: {
    width:           96,
    height:          96,
    borderRadius:    radius.xl,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1.5,
  },
  heroOverlay: {
    position: 'absolute',
    bottom:   0,
    left:     0,
    right:    0,
    padding:  spacing[4],
    gap:      spacing[1] + 1,
  },
  categoryPill: {
    alignSelf:         'flex-start',
    paddingVertical:   3,
    paddingHorizontal: spacing[3],
    borderRadius:      radius.full,
    borderWidth:       1,
    backgroundColor:   'rgba(255,255,255,0.2)',
    marginBottom:      2,
  },
  categoryPillText: {
    fontFamily: fontFamily.semiBold,
    fontSize:   10,
    color:      colors.white,
    letterSpacing: 0.3,
  },
  heroName: {
    fontFamily:  fontFamily.bold,
    fontSize:    22,
    color:       colors.white,
    lineHeight:  28,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           3,
    marginTop:     2,
  },
  ratingNum: {
    fontFamily: fontFamily.semiBold,
    fontSize:   12,
    color:      'rgba(255,255,255,0.9)',
    marginLeft: 2,
  },
  ratingCount: {
    fontFamily: fontFamily.regular,
    fontSize:   11,
    color:      'rgba(255,255,255,0.75)',
  },

  // ── Cards
  card: {
    backgroundColor:   colors.white,
    borderRadius:      radius.xl,
    borderWidth:       1,
    borderColor:       colors.border,
    padding:           spacing[4],
    marginHorizontal:  spacing[4],
    marginBottom:      spacing[3],
    ...shadow.xs,
  },
  infoRow: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    gap:             spacing[3],
    paddingVertical: spacing[1] + 1,
  },
  infoIcon: {
    width:           32,
    height:          32,
    borderRadius:    radius.md,
    backgroundColor: colors.green50,
    alignItems:      'center',
    justifyContent:  'center',
    marginTop:       1,
  },
  infoText:  { flex: 1 },
  infoMain: {
    fontFamily: fontFamily.medium,
    fontSize:   13,
    color:      colors.textPrimary,
    lineHeight: 19,
  },
  infoSub: {
    fontFamily: fontFamily.regular,
    fontSize:   11.5,
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
    fontFamily:    fontFamily.semiBold,
    fontSize:      11,
    color:         colors.green500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryText: {
    fontFamily:   fontFamily.regular,
    fontSize:     13,
    color:        colors.textSecondary,
    lineHeight:   20.5,
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
    fontSize:   11.5,
    color:      colors.textSecondary,
  },

  // ── Action buttons
  secondaryRow: {
    flexDirection: 'row',
    gap:           spacing[3],
    marginBottom:  spacing[3],
  },
  secondaryBtn: {
    flex:            1,
    flexDirection:   'column',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             spacing[1] + 1,
    paddingVertical: spacing[4],
    borderRadius:    radius.lg,
    backgroundColor: colors.green50,
    borderWidth:     1,
    borderColor:     colors.green100,
    minHeight:       64,
  },
  secondaryBtnText: {
    fontFamily: fontFamily.semiBold,
    fontSize:   12.5,
    color:      colors.green700,
    textAlign:  'center',
  },
  primaryBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             spacing[2] + 1,
    paddingVertical: spacing[4] + 2,
    borderRadius:    radius.lg,
    backgroundColor: colors.green700,
  },
  primaryBtnText: {
    fontFamily: fontFamily.semiBold,
    fontSize:   14,
    color:      colors.white,
  },
  removeVisitBtn: {
    alignItems: 'center',
    paddingTop: spacing[3],
  },
  removeVisitText: {
    fontFamily:         fontFamily.regular,
    fontSize:           12,
    color:              colors.textMuted,
    textDecorationLine: 'underline',
  },

  // ── Not found
  notFound: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            spacing[4],
  },
  notFoundText: {
    fontFamily: fontFamily.bold,
    fontSize:   17,
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
    fontSize:   13,
    color:      colors.green700,
  },
});
