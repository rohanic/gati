/**
 * Mini map screen — shows place location context + link to native maps.
 * Uses expo-location for user coordinates.
 * Deep-links to Google Maps / Apple Maps for full navigation.
 * Spring entrance animations. NO emoji. NO purple. NO orange.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Linking,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useWanderStore } from '@/store/userStore';
import { getCategoryMeta } from '@/components/wander';
import { colors, spacing, radius, fontFamily, shadow } from '@/theme';

// ─── Animated map pin ───────────────────────────────────────────
function MapPin({ color }: { color: string }) {
  const bounce = useSharedValue(0);

  useEffect(() => {
    bounce.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 500 }),
        withTiming(0,  { duration: 400 })
      ),
      -1,
      true
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: bounce.value }],
  }));

  return (
    <Animated.View style={style}>
      <View style={[styles.pin, { backgroundColor: color }]}>
        <Ionicons name="location" size={20} color={colors.white} />
      </View>
      <View style={[styles.pinShadow, { backgroundColor: color + '33' }]} />
    </Animated.View>
  );
}

// ─── Decorative map grid ────────────────────────────────────────
function MapGrid({ placeColor }: { placeColor: string }) {
  return (
    <View style={styles.mapGrid}>
      {/* Grid lines */}
      {Array.from({ length: 6 }, (_, i) => (
        <View
          key={`h${i}`}
          style={[styles.gridLineH, { top: `${(i + 1) * 14}%` as any }]}
        />
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <View
          key={`v${i}`}
          style={[styles.gridLineV, { left: `${(i + 1) * 14}%` as any }]}
        />
      ))}

      {/* "Road" lines */}
      <View style={[styles.road, styles.roadH, { top: '40%' as any }]} />
      <View style={[styles.road, styles.roadH, { top: '65%' as any }]} />
      <View style={[styles.road, styles.roadV, { left: '35%' as any }]} />

      {/* "Block" fills */}
      <View style={[styles.block, { top: '18%' as any, left: '8%' as any, width: 60, height: 38 }]} />
      <View style={[styles.block, { top: '18%' as any, left: '50%' as any, width: 80, height: 38 }]} />
      <View style={[styles.block, { top: '68%' as any, left: '8%' as any, width: 50, height: 46 }]} />
      <View style={[styles.block, { top: '68%' as any, left: '48%' as any, width: 90, height: 46 }]} />

      {/* Center pin */}
      <View style={styles.pinContainer}>
        <MapPin color={placeColor} />
      </View>
    </View>
  );
}

// ─── Screen ─────────────────────────────────────────────────────
export default function MapScreen() {
  const { placeId }  = useLocalSearchParams<{ placeId?: string }>();
  const places       = useWanderStore((s) => s.places);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

  const place = placeId ? places.find((p) => p.placeId === placeId) ?? null : null;
  const meta  = place ? getCategoryMeta(place.category) : getCategoryMeta('all');

  // ── Try to get user location ──
  useEffect(() => {
    Location.getForegroundPermissionsAsync().then(async ({ status }) => {
      if (status === 'granted') {
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setUserCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        } catch { /* ignore */ }
      }
    });
  }, []);

  // ── Entrance ──
  const mapOp    = useSharedValue(0);
  const mapScale = useSharedValue(0.95);
  const card1Op  = useSharedValue(0);
  const card2Op  = useSharedValue(0);

  useEffect(() => {
    mapOp.value    = withTiming(1, { duration: 340 });
    mapScale.value = withSpring(1, { stiffness: 200, damping: 20 });
    card1Op.value  = withDelay(220, withTiming(1, { duration: 280 }));
    card2Op.value  = withDelay(380, withTiming(1, { duration: 280 }));
  }, []);

  const mapStyle   = useAnimatedStyle(() => ({ opacity: mapOp.value, transform: [{ scale: mapScale.value }] }));
  const card1Style = useAnimatedStyle(() => ({ opacity: card1Op.value }));
  const card2Style = useAnimatedStyle(() => ({ opacity: card2Op.value }));

  const openMaps = useCallback(() => {
    if (!place) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { latitude: lat, longitude: lng, name } = place;
    const encodedName = encodeURIComponent(name);
    const url = Platform.OS === 'ios'
      ? `maps://?q=${encodedName}&ll=${lat},${lng}`
      : `geo:${lat},${lng}?q=${encodedName}`;
    Linking.openURL(url).catch(() => {
      // fallback to Google Maps web
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
    });
  }, [place]);

  const openDirections = useCallback(() => {
    if (!place) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { latitude: lat, longitude: lng, name } = place;
    const encodedName = encodeURIComponent(name);
    const url = Platform.OS === 'ios'
      ? `maps://?daddr=${lat},${lng}&dirflg=w`
      : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${encodedName}`;
    Linking.openURL(url);
  }, [place]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          <Text style={styles.backLabel}>{place?.name ?? 'Map'}</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Map visual ── */}
        <Animated.View style={[styles.mapContainer, mapStyle]}>
          <MapGrid placeColor={meta.color} />

          {/* Corner compass */}
          <View style={styles.compass}>
            <Ionicons name="navigate-outline" size={14} color={colors.textMuted} />
            <Text style={styles.compassText}>N</Text>
          </View>
        </Animated.View>

        {/* ── Place info card ── */}
        {place && (
          <Animated.View style={[styles.card, card1Style]}>
            <View style={[styles.placeIconWrap, { backgroundColor: meta.bgColor }]}>
              <Ionicons name={meta.icon as any} size={22} color={meta.color} />
            </View>
            <View style={styles.placeInfo}>
              <Text style={styles.placeName}>{place.name}</Text>
              <Text style={styles.placeAddress} numberOfLines={2}>{place.address}</Text>
            </View>
            <View style={[styles.distBadge]}>
              <Text style={styles.distText}>
                {place.distanceKm < 1
                  ? `${Math.round(place.distanceKm * 1000)} m`
                  : `${place.distanceKm.toFixed(1)} km`}
              </Text>
            </View>
          </Animated.View>
        )}

        {/* ── Coordinate info ── */}
        {place && (
          <Animated.View style={[styles.coordCard, card1Style]}>
            <View style={styles.coordRow}>
              <Text style={styles.coordLabel}>Lat</Text>
              <Text style={styles.coordVal}>{place.latitude.toFixed(4)}</Text>
            </View>
            <View style={styles.coordDivider} />
            <View style={styles.coordRow}>
              <Text style={styles.coordLabel}>Long</Text>
              <Text style={styles.coordVal}>{place.longitude.toFixed(4)}</Text>
            </View>
            {userCoords && (
              <>
                <View style={styles.coordDivider} />
                <View style={styles.coordRow}>
                  <Text style={styles.coordLabel}>Your location</Text>
                  <Text style={styles.coordVal}>
                    {userCoords.lat.toFixed(4)}, {userCoords.lng.toFixed(4)}
                  </Text>
                </View>
              </>
            )}
          </Animated.View>
        )}

        {/* ── Action buttons ── */}
        <Animated.View style={[styles.buttonGroup, card2Style]}>
          <Pressable
            onPress={openMaps}
            style={({ pressed }) => [styles.btn, styles.btnOutline, pressed && { opacity: 0.8 }]}
          >
            <Ionicons name="map-outline" size={18} color={colors.green700} />
            <Text style={styles.btnOutlineText}>Open in Maps</Text>
          </Pressable>
          {place && (
            <Pressable
              onPress={openDirections}
              style={({ pressed }) => [styles.btn, styles.btnFill, pressed && { opacity: 0.9 }]}
            >
              <Ionicons name="navigate" size={18} color={colors.white} />
              <Text style={styles.btnFillText}>Get directions</Text>
            </Pressable>
          )}
        </Animated.View>

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
  topBar: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing[4],
    paddingVertical:   spacing[3],
  },
  backBtn: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[1] + 1,
    padding:       spacing[1],
  },
  backLabel: {
    fontFamily:  fontFamily.medium,
    fontSize:    15,
    color:       colors.textPrimary,
    flex:        1,
  },

  scroll:  { flex: 1 },
  content: { paddingHorizontal: spacing[5], paddingTop: spacing[2] },

  // Map
  mapContainer: {
    height:          240,
    borderRadius:    radius.xl,
    backgroundColor: colors.green50,
    borderWidth:     1,
    borderColor:     colors.green100,
    marginBottom:    spacing[4],
    overflow:        'hidden',
    position:        'relative',
  },
  mapGrid: {
    flex: 1,
    position: 'relative',
  },
  gridLineH: {
    position:        'absolute',
    left:            0,
    right:           0,
    height:          1,
    backgroundColor: colors.green100,
  },
  gridLineV: {
    position:        'absolute',
    top:             0,
    bottom:          0,
    width:           1,
    backgroundColor: colors.green100,
  },
  road: {
    position:        'absolute',
    backgroundColor: colors.green100,
    opacity:         0.45,
  },
  roadH: {
    left:   0,
    right:  0,
    height: 8,
  },
  roadV: {
    top:    0,
    bottom: 0,
    width:  8,
  },
  block: {
    position:        'absolute',
    backgroundColor: colors.green100,
    borderRadius:    3,
  },
  pinContainer: {
    position:       'absolute',
    top:            0,
    left:           0,
    right:          0,
    bottom:         0,
    alignItems:     'center',
    justifyContent: 'center',
  },
  pin: {
    width:           40,
    height:          40,
    borderRadius:    20,
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 3 },
    shadowOpacity:   0.2,
    shadowRadius:    5,
    elevation:       5,
  },
  pinShadow: {
    width:       24,
    height:      8,
    borderRadius: 12,
    alignSelf:   'center',
    marginTop:   2,
  },
  compass: {
    position:  'absolute',
    top:       spacing[3],
    right:     spacing[3],
    alignItems: 'center',
    gap:       2,
  },
  compassText: {
    fontFamily: fontFamily.bold,
    fontSize:   10,
    color:      colors.textMuted,
  },

  // Place info card
  card: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: colors.white,
    borderRadius:    radius.xl,
    borderWidth:     1,
    borderColor:     colors.border,
    padding:         spacing[4],
    gap:             spacing[3],
    marginBottom:    spacing[3],
    ...shadow.xs,
  },
  placeIconWrap: {
    width:          48,
    height:         48,
    borderRadius:   radius.lg,
    alignItems:     'center',
    justifyContent: 'center',
  },
  placeInfo:    { flex: 1 },
  placeName: {
    fontFamily:   fontFamily.bold,
    fontSize:     15,
    color:        colors.textPrimary,
    marginBottom: 3,
  },
  placeAddress: {
    fontFamily: fontFamily.regular,
    fontSize:   12,
    color:      colors.textMuted,
    lineHeight: 17,
  },
  distBadge: {
    paddingVertical:   spacing[1] + 1,
    paddingHorizontal: spacing[3],
    borderRadius:      radius.full,
    backgroundColor:   colors.green50,
    borderWidth:       1,
    borderColor:       colors.green100,
  },
  distText: {
    fontFamily: fontFamily.semiBold,
    fontSize:   12,
    color:      colors.green700,
  },

  // Coordinates
  coordCard: {
    backgroundColor: colors.white,
    borderRadius:    radius.xl,
    borderWidth:     1,
    borderColor:     colors.border,
    padding:         spacing[4],
    marginBottom:    spacing[3],
    gap:             spacing[1],
  },
  coordRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    paddingVertical: spacing[1] + 1,
  },
  coordDivider: {
    height:          1,
    backgroundColor: colors.borderLight,
  },
  coordLabel: {
    fontFamily: fontFamily.medium,
    fontSize:   13,
    color:      colors.textSecondary,
  },
  coordVal: {
    fontFamily: fontFamily.regular,
    fontSize:   13,
    color:      colors.textMuted,
  },

  buttonGroup: {
    flexDirection: 'row',
    gap:           spacing[3],
  },
  btn: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             spacing[2],
    paddingVertical: spacing[4],
    borderRadius:    radius.lg,
  },
  btnOutline: {
    backgroundColor: colors.green50,
    borderWidth:     1,
    borderColor:     colors.green100,
  },
  btnOutlineText: {
    fontFamily: fontFamily.semiBold,
    fontSize:   14,
    color:      colors.green700,
  },
  btnFill: {
    backgroundColor: colors.green700,
  },
  btnFillText: {
    fontFamily: fontFamily.semiBold,
    fontSize:   14,
    color:      colors.white,
  },
});
