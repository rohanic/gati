/**
 * Wander tab — place discovery home screen.
 * Week 7 full implementation.
 *
 * Flow:
 *  - On first mount: load sample places into store if empty
 *  - Request foreground location permission → used for distance display
 *  - Category filter chips narrow the place list
 *  - Saved places section appears when saves exist
 *  - PlaceCard taps navigate to [placeId] detail
 *
 * NO emoji. NO purple. NO orange. Forest green + off-white palette.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { CategoryChips, PlaceCard } from '@/components/wander';
import type { WanderCategory } from '@/components/wander';
import { useWanderStore } from '@/store/userStore';
import { getInitialWanderPlaces } from '@/data/samplePlaces';
import { colors, spacing, radius, fontFamily } from '@/theme';

// ─── Section header ─────────────────────────────────────────────
function SectionHeader({ title, icon, count }: { title: string; icon: string; count?: number }) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon as any} size={14} color={colors.textSecondary} />
      <Text style={styles.sectionTitle}>{title}</Text>
      {count !== undefined && (
        <View style={styles.countPill}>
          <Text style={styles.countPillText}>{count}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Location permission banner ─────────────────────────────────
function LocationBanner({ onGrant }: { onGrant: () => void }) {
  return (
    <Pressable onPress={onGrant} style={styles.locationBanner}>
      <View style={styles.locationIcon}>
        <Ionicons name="location-outline" size={20} color={colors.green700} />
      </View>
      <View style={styles.locationText}>
        <Text style={styles.locationTitle}>Enable location</Text>
        <Text style={styles.locationSub}>Show accurate distances to each place</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

// ─── Empty discovery state ──────────────────────────────────────
function EmptyCategory({ category }: { category: string }) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name="telescope-outline" size={32} color={colors.green300} />
      <Text style={styles.emptyTitle}>No {category} spots yet</Text>
      <Text style={styles.emptySub}>Check back as more places are discovered near you</Text>
    </View>
  );
}

// ─── Screen ─────────────────────────────────────────────────────
export default function WanderScreen() {
  const places        = useWanderStore((s) => s.places);
  const addPlace      = useWanderStore((s) => s.addPlace);
  const savePlace     = useWanderStore((s) => s.savePlace);
  const unsavePlace   = useWanderStore((s) => s.unsavePlace);

  const [activeCategory, setActiveCategory] = useState<WanderCategory>('all');
  const [locationGranted, setLocationGranted] = useState<boolean | null>(null);

  // ── Seed sample places once ──
  useEffect(() => {
    if (places.length === 0) {
      getInitialWanderPlaces().forEach(addPlace);
    }
  }, []);

  // ── Check location permission status ──
  useEffect(() => {
    Location.getForegroundPermissionsAsync().then(({ status }) => {
      setLocationGranted(status === 'granted');
    });
  }, []);

  const requestLocation = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setLocationGranted(status === 'granted');
  }, []);

  // ── Filtered lists ──
  const allFiltered = useMemo(() => {
    if (activeCategory === 'all') return places;
    return places.filter((p) => p.category === activeCategory);
  }, [places, activeCategory]);

  const savedPlaces = useMemo(
    () => allFiltered.filter((p) => p.isSaved),
    [allFiltered]
  );
  const unsavedPlaces = useMemo(
    () => allFiltered.filter((p) => !p.isSaved),
    [allFiltered]
  );

  const handlePress = useCallback((placeId: string) => {
    router.push({ pathname: '/(tabs)/wander/[placeId]', params: { placeId } });
  }, []);

  // ── Header entrance ──
  const headerOp = useSharedValue(0);
  const headerY  = useSharedValue(-8);
  useEffect(() => {
    headerOp.value = withTiming(1, { duration: 360 });
    headerY.value  = withSpring(0, { stiffness: 200, damping: 20 });
  }, []);
  const headerStyle = useAnimatedStyle(() => ({
    opacity:   headerOp.value,
    transform: [{ translateY: headerY.value }],
  }));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Header ── */}
      <Animated.View style={[styles.header, headerStyle]}>
        <View>
          <Text style={styles.screenTitle}>Wander</Text>
          <Text style={styles.screenSub}>Hidden gems near you</Text>
        </View>
        <Pressable
          onPress={() => router.push('/(tabs)/wander/map')}
          style={styles.mapBtn}
        >
          <Ionicons name="map-outline" size={18} color={colors.green700} />
        </Pressable>
      </Animated.View>

      {/* ── Location banner ── */}
      {locationGranted === false && (
        <LocationBanner onGrant={requestLocation} />
      )}

      {/* ── Category chips ── */}
      <CategoryChips active={activeCategory} onChange={setActiveCategory} />

      {/* ── Place list ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Saved section */}
        {savedPlaces.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="Saved"
              icon="bookmark"
              count={savedPlaces.length}
            />
            {savedPlaces.map((place, i) => (
              <PlaceCard
                key={place.placeId}
                place={place}
                index={i}
                onPress={handlePress}
                onSave={savePlace}
                onUnsave={unsavePlace}
              />
            ))}
          </View>
        )}

        {/* Discover section */}
        <View style={savedPlaces.length > 0 ? styles.section : undefined}>
          {savedPlaces.length > 0 && (
            <SectionHeader
              title="Discover"
              icon="compass-outline"
              count={unsavedPlaces.length}
            />
          )}

          {unsavedPlaces.length > 0 ? (
            unsavedPlaces.map((place, i) => (
              <PlaceCard
                key={place.placeId}
                place={place}
                index={savedPlaces.length + i}
                onPress={handlePress}
                onSave={savePlace}
                onUnsave={unsavePlace}
              />
            ))
          ) : (
            <EmptyCategory
              category={activeCategory === 'all' ? '' : activeCategory}
            />
          )}
        </View>

        <View style={{ height: spacing[10] }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.background,
  },

  header: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'flex-end',
    paddingHorizontal: spacing[5],
    paddingTop:        spacing[5],
    paddingBottom:     spacing[3],
  },
  screenTitle: {
    fontFamily:    fontFamily.bold,
    fontSize:      26,
    color:         colors.textPrimary,
    letterSpacing: -0.4,
    marginBottom:  3,
  },
  screenSub: {
    fontFamily: fontFamily.regular,
    fontSize:   13,
    color:      colors.textSecondary,
  },
  mapBtn: {
    width:           40,
    height:          40,
    borderRadius:    radius.lg,
    backgroundColor: colors.green50,
    borderWidth:     1,
    borderColor:     colors.green100,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    2,
  },

  locationBanner: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing[3],
    marginHorizontal:  spacing[5],
    marginBottom:      spacing[3],
    padding:           spacing[4],
    backgroundColor:   colors.green50,
    borderRadius:      radius.xl,
    borderWidth:       1,
    borderColor:       colors.green100,
  },
  locationIcon: {
    width:           40,
    height:          40,
    borderRadius:    radius.md,
    backgroundColor: colors.white,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     colors.green100,
  },
  locationText: { flex: 1 },
  locationTitle: {
    fontFamily:   fontFamily.semiBold,
    fontSize:     14,
    color:        colors.green700,
    marginBottom: 2,
  },
  locationSub: {
    fontFamily: fontFamily.regular,
    fontSize:   12,
    color:      colors.textSecondary,
  },

  scroll:  { flex: 1 },
  content: { paddingTop: spacing[2] },

  section: {
    marginTop: spacing[5],
  },
  sectionHeader: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing[2],
    paddingHorizontal: spacing[5],
    marginBottom:      spacing[3],
  },
  sectionTitle: {
    flex:       1,
    fontFamily: fontFamily.bold,
    fontSize:   16,
    color:      colors.textPrimary,
  },
  countPill: {
    paddingVertical:   2,
    paddingHorizontal: spacing[2] + 2,
    borderRadius:      radius.full,
    backgroundColor:   colors.green50,
    borderWidth:       1,
    borderColor:       colors.green100,
  },
  countPillText: {
    fontFamily: fontFamily.bold,
    fontSize:   11,
    color:      colors.green700,
  },

  emptyState: {
    alignItems:  'center',
    paddingTop:  spacing[14],
    gap:         spacing[3],
    paddingHorizontal: spacing[8],
  },
  emptyTitle: {
    fontFamily: fontFamily.bold,
    fontSize:   16,
    color:      colors.textPrimary,
    textAlign:  'center',
  },
  emptySub: {
    fontFamily: fontFamily.regular,
    fontSize:   13,
    color:      colors.textMuted,
    textAlign:  'center',
    lineHeight: 19,
  },
});
