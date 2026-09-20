/**
 * Animated place card for the Wander home list.
 * Staggered spring entrance, spring press-scale, save toggle.
 *
 * Thumbnail priority:
 *   1. Real Google photo — fades in over the gradient as it loads
 *   2. Gradient + centred category icon — fallback / loading state
 *
 * Stars render ONLY when a real rating exists (rating > 0).
 * NO emoji. NO purple. NO orange.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius, fontFamily, shadow } from '@/theme';
import type { WanderPlace } from '@/types';
import { getCategoryMeta } from './CategoryChips';
import { useWanderStore } from '@/store/userStore';
import { useAccess } from '@/hooks/useAccess';
import { supabase } from '@/services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── AI blurb cache — in-memory Map backed by AsyncStorage ──────────────────
// Blurbs are expensive (one GPT-4o-mini call each), so they must survive cold
// starts. We keep an in-memory Map for synchronous reads and persist the whole
// map (trimmed) to AsyncStorage on each new entry. Key: placeId.
const AI_BLURB_STORAGE_KEY = 'gati-ai-blurbs';
const AI_BLURB_MAX_ENTRIES = 200;   // cap so storage can't grow unbounded

const aiBlurbCache = new Map<string, string>();

// Hydrate once from AsyncStorage. Concurrent callers await the same promise.
let hydratePromise: Promise<void> | null = null;
function hydrateBlurbCache(): Promise<void> {
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(AI_BLURB_STORAGE_KEY);
      if (!raw) return;
      const obj = JSON.parse(raw) as Record<string, string>;
      for (const [id, blurb] of Object.entries(obj)) {
        if (typeof blurb === 'string' && blurb) aiBlurbCache.set(id, blurb);
      }
    } catch {
      // Corrupt/missing cache — start empty.
    }
  })();
  return hydratePromise;
}
// Kick off hydration at module load so the first cards can read synchronously.
hydrateBlurbCache();

// Debounced write-through of the whole map (trimmed to the newest N entries).
let persistTimer: ReturnType<typeof setTimeout> | null = null;
function persistBlurbCache(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(async () => {
    try {
      // Map preserves insertion order → keep the most-recently-added entries.
      const entries = [...aiBlurbCache.entries()].slice(-AI_BLURB_MAX_ENTRIES);
      await AsyncStorage.setItem(AI_BLURB_STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch {
      // Best-effort — a failed persist just means a re-fetch next session.
    }
  }, 400);
}

async function fetchAiPickBlurb(
  placeName:      string,
  placeId:        string,
  category:       string,
  categoryScores: Record<string, number>,
): Promise<string | null> {
  // Make sure the persisted cache is loaded before deciding to hit the network.
  await hydrateBlurbCache();
  if (aiBlurbCache.has(placeId)) return aiBlurbCache.get(placeId)!;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
    const resp = await fetch(`${supabaseUrl}/functions/v1/ai-place-pick`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ placeId, placeName, category, categoryScores }),
    });

    if (!resp.ok) return null;

    const data = await resp.json();
    const blurb = (data.blurb ?? '').trim();
    if (blurb) {
      aiBlurbCache.set(placeId, blurb);
      persistBlurbCache();
    }
    return blurb || null;
  } catch {
    return null;
  }
}

// ─── Rating row ──────────────────────────────────────────────────
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

// ─── Thumbnail ───────────────────────────────────────────────────
// Renders a gradient + icon always (instant, no flicker).
// When a real photo URL is available, the image fades in on top
// once loaded. If the image fails, the gradient remains visible.
function PlaceThumbnail({ place }: { place: WanderPlace }) {
  const [failed, setFailed] = useState(false);
  const imgOp               = useSharedValue(0);
  const meta                = getCategoryMeta(place.category);
  const hasPhoto            = !!place.thumbnailUrl && !failed;

  const imgStyle = useAnimatedStyle(() => ({ opacity: imgOp.value }));

  return (
    <View style={styles.thumb}>
      {/* ── Layer 1: gradient + icon (always visible) ── */}
      <LinearGradient
        colors={[meta.bgColor, meta.color + '33']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, styles.thumbCenter]}>
        <View style={styles.thumbIconBox}>
          <Ionicons name={meta.icon as any} size={26} color={meta.color} />
        </View>
      </View>

      {/* ── Layer 2: real photo fades in over gradient ── */}
      {hasPhoto && (
        <Animated.View style={[StyleSheet.absoluteFill, imgStyle]}>
          <Image
            source={{ uri: place.thumbnailUrl! }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            onLoad={() => {
              imgOp.value = withTiming(1, { duration: 300 });
            }}
            onError={() => setFailed(true)}
          />
        </Animated.View>
      )}

      {/* ── Layer 3: category chip in corner when photo visible ── */}
      {hasPhoto && (
        <View style={styles.thumbChip}>
          <Ionicons name={meta.icon as any} size={9} color={meta.color} />
        </View>
      )}
    </View>
  );
}

// ─── Card ────────────────────────────────────────────────────────
interface PlaceCardProps {
  place:            WanderPlace;
  index:            number;
  onPress:          (placeId: string) => void;
  onSave:           (placeId: string) => void;
  onUnsave:         (placeId: string) => void;
  isInterestMatch?: boolean;
  statContext?:     string;
  /**
   * Short, honest explanation of why this place ranked where it did
   * ("Just around the corner"). Derived from the dominant relevance factor —
   * a ranked feed the user cannot interrogate just looks arbitrary.
   */
  reason?:          string | null;
  /**
   * When true, this card may fetch an AI "why we picked this" blurb (Pro/trial
   * only). Pass true ONLY for the small "Picked for you" section so we don't
   * fire an OpenAI call for every card in every section. A cached blurb still
   * displays anywhere it exists — this flag gates the network fetch, not the UI.
   */
  enableAiPick?:    boolean;
}

export function PlaceCard({
  place, index, onPress, onSave, onUnsave,
  isInterestMatch = false, statContext, reason, enableAiPick = false,
}: PlaceCardProps) {
  const meta    = getCategoryMeta(place.category);
  const opacity = useSharedValue(0);
  const transY  = useSharedValue(14);
  const scale   = useSharedValue(1);

  // ── Pro/trial gate for AI blurb ──
  const categoryScores = useWanderStore((s) => s.categoryScores);
  const isProOrTrial   = useAccess().canUseAiPicks;

  const [aiBlurb, setAiBlurb]   = useState<string | null>(
    aiBlurbCache.get(place.placeId) ?? null,
  );
  const fetchedRef = useRef(false);

  useEffect(() => {
    const delay   = Math.min(index, 8) * 60;
    opacity.value = withDelay(delay, withTiming(1, { duration: 280 }));
    transY.value  = withDelay(delay, withSpring(0, { stiffness: 220, damping: 20 }));
  }, []);

  // Fetch AI blurb — Pro/trial only, and ONLY for cards that opted in via
  // enableAiPick (the "Picked for you" section). Other sections still DISPLAY a
  // cached blurb (initial state reads the cache) but never trigger a fetch.
  // Also hydrate from the persisted cache on mount so cold starts show blurbs
  // without any network call.
  useEffect(() => {
    let cancelled = false;

    // Try the persisted cache first (covers cold starts for every card).
    if (!aiBlurb) {
      hydrateBlurbCache().then(() => {
        if (cancelled) return;
        const cached = aiBlurbCache.get(place.placeId);
        if (cached) setAiBlurb(cached);
      });
    }

    // Network fetch is gated behind enableAiPick to cap OpenAI calls.
    if (enableAiPick && isProOrTrial && !fetchedRef.current && !aiBlurb) {
      fetchedRef.current = true;
      const timer = setTimeout(async () => {
        const blurb = await fetchAiPickBlurb(
          place.name,
          place.placeId,
          place.category,
          categoryScores,
        );
        if (!cancelled && blurb) setAiBlurb(blurb);
      }, Math.min(index, 6) * 350 + 800); // 800 ms base + 350 ms per card
      return () => { cancelled = true; clearTimeout(timer); };
    }

    return () => { cancelled = true; };
  }, [enableAiPick, isProOrTrial]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ translateY: transY.value }, { scale: scale.value }],
  }));

  // Guard so a fast double-tap can't push two detail screens. The press-scale
  // bounce runs in parallel — navigation fires immediately, not after a delay.
  const navigatingRef = useRef(false);
  const handlePress = () => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    scale.value = withSpring(0.97, { stiffness: 400, damping: 20 }, () => {
      scale.value = withSpring(1, { stiffness: 300, damping: 25 });
    });
    onPress(place.placeId);
    // Re-allow taps once navigation has settled.
    setTimeout(() => { navigatingRef.current = false; }, 600);
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
        {/* Thumbnail — stretches to full card height */}
        <PlaceThumbnail place={place} />

        {/* Info column */}
        <View style={styles.info}>
          {/* Name + open badge */}
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{place.name}</Text>
            {place.openNow === true && (
              <View style={styles.openBadge}>
                <Text style={styles.openText}>Open</Text>
              </View>
            )}
          </View>

          {/* Category + interest match */}
          <View style={styles.categoryRow}>
            <Text style={[styles.category, { color: meta.color }]}>
              {meta.label}
            </Text>
            {/* The ranking reason is more specific than a generic match badge,
                so it wins when both would apply. */}
            {reason ? (
              <View style={styles.matchBadge}>
                <Ionicons name="sparkles" size={9} color={colors.green700} />
                <Text style={styles.matchText} numberOfLines={1}>{reason}</Text>
              </View>
            ) : isInterestMatch ? (
              <View style={styles.matchBadge}>
                <Ionicons name="checkmark-circle" size={9} color={colors.green700} />
                <Text style={styles.matchText}>Matched to you</Text>
              </View>
            ) : null}
          </View>

          {/* AI summary */}
          <Text style={styles.summary} numberOfLines={2}>
            {place.aiSummary}
          </Text>

          {/* AI pick blurb — Pro/trial only, lazy-fetched */}
          {isProOrTrial && aiBlurb ? (
            <View style={styles.aiPickRow}>
              <Ionicons name="sparkles" size={9} color={colors.green700} />
              <Text style={styles.aiPickText} numberOfLines={2}>{aiBlurb}</Text>
            </View>
          ) : null}

          {/* Stat context line */}
          {statContext && (
            <View style={styles.statContextRow}>
              <Ionicons name="stats-chart-outline" size={9} color={colors.green700} />
              <Text style={styles.statContextText} numberOfLines={1}>{statContext}</Text>
            </View>
          )}

          {/* Footer: rating + distance */}
          <View style={styles.footer}>
            {place.rating > 0 ? (
              <RatingRow rating={place.rating} reviewCount={place.reviewCount} />
            ) : (
              <View style={styles.mapBadge}>
                <Ionicons name="map-outline" size={10} color={colors.textMuted} />
                <Text style={styles.mapBadgeText}>On the map</Text>
              </View>
            )}
            <View style={styles.distanceBadge}>
              <Ionicons name="navigate-outline" size={10} color={colors.textMuted} />
              <Text style={styles.distanceText}>{distanceLabel}</Text>
            </View>
          </View>
        </View>

        {/* Save button — centred vertically */}
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

// ─── Styles ──────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing[5],
    marginBottom:     spacing[3],
  },

  card: {
    flexDirection:   'row',
    alignItems:      'stretch',   // thumb stretches to card height
    backgroundColor: colors.white,
    borderRadius:    radius.xl,
    borderWidth:     1,
    borderColor:     colors.border,
    overflow:        'hidden',
    ...shadow.xs,
  },

  // ── Thumbnail
  thumb: {
    width:     90,
    minHeight: 88,               // never collapses on short content
  },
  thumbCenter: {
    alignItems:     'center',
    justifyContent: 'center',
  },
  thumbIconBox: {
    width:           50,
    height:          50,
    borderRadius:    radius.lg,
    backgroundColor: colors.white,
    alignItems:      'center',
    justifyContent:  'center',
    ...shadow.xs,
  },
  // Small category chip shown in corner when photo is visible
  thumbChip: {
    position:        'absolute',
    bottom:          6,
    right:           5,
    width:           20,
    height:          20,
    borderRadius:    10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     0.5,
    borderColor:     'rgba(0,0,0,0.07)',
  },

  // ── Info column
  info: {
    flex:              1,
    paddingVertical:   spacing[3],
    paddingHorizontal: spacing[3],
    gap:               2,
    justifyContent:    'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[2],
  },
  name: {
    flex:       1,
    fontFamily: fontFamily.bold,
    fontSize:   13,
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
    fontSize:   9.5,
    color:      colors.green700,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[2],
    marginTop:     1,
  },
  category: {
    fontFamily: fontFamily.medium,
    fontSize:   10.5,
  },
  matchBadge: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           2,
  },
  matchText: {
    fontFamily: fontFamily.medium,
    fontSize:   9.5,
    color:      colors.green700,
  },
  summary: {
    fontFamily: fontFamily.regular,
    fontSize:   11.5,
    color:      colors.textMuted,
    lineHeight: 16,
    marginTop:  3,
  },
  aiPickRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           3,
    marginTop:     4,
    paddingVertical:   3,
    paddingHorizontal: spacing[2],
    backgroundColor:   colors.green50,
    borderRadius:      radius.sm,
    borderWidth:       1,
    borderColor:       colors.green100,
  },
  aiPickText: {
    flex:       1,
    fontFamily: fontFamily.medium,
    fontSize:   9.5,
    color:      colors.green700,
    lineHeight: 14,
  },

  statContextRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           3,
    marginTop:     4,
  },
  statContextText: {
    fontFamily: fontFamily.medium,
    fontSize:   9.5,
    color:      colors.green700,
    flex:       1,
  },

  // ── Footer
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
    fontFamily: fontFamily.semiBold,
    fontSize:   10.5,
    color:      colors.textSecondary,
    marginLeft: 3,
  },
  ratingCount: {
    fontFamily: fontFamily.regular,
    fontSize:   9.5,
    color:      colors.textMuted,
  },
  mapBadge: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           3,
  },
  mapBadgeText: {
    fontFamily: fontFamily.medium,
    fontSize:   9.5,
    color:      colors.textMuted,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           2,
  },
  distanceText: {
    fontFamily: fontFamily.regular,
    fontSize:   10.5,
    color:      colors.textMuted,
  },

  // ── Save button — centred vertically (card is stretch, btn is not)
  saveBtn: {
    padding:        spacing[4],
    alignSelf:      'center',
  },
});
