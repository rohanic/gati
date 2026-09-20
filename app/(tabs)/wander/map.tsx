/**
 * Wander map screen — real interactive map powered by
 * Leaflet.js + OpenStreetMap tiles (completely free, no API key).
 *
 * Layout:
 *  ┌──────────────────────┐
 *  │  ← back   Place name │  ← floating top bar (safe-area aware)
 *  │                      │
 *  │   real OSM map       │  ← WebView fills entire screen
 *  │        📍            │
 *  │                      │
 *  │ ┌──────────────────┐ │
 *  │ │ Place card       │ │  ← floating bottom card
 *  │ │ [Maps] [Directions] │
 *  │ └──────────────────┘ │
 *  └──────────────────────┘
 *
 * NO emoji. NO purple. NO orange.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useWanderStore } from '@/store/userStore';
import { getCategoryMeta } from '@/components/wander';
import { colors, spacing, radius, fontFamily, shadow } from '@/theme';

// ─── Shared HTML head (Leaflet CSS + JS) ────────────────────────
const MAP_HEAD = `
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#f0f4ee; }
  #map { width:100vw; height:100vh; }
  .leaflet-control-attribution { font-size:9px !important; }
  .leaflet-popup-content-wrapper {
    border-radius:12px !important;
    font-family:-apple-system,BlinkMacSystemFont,sans-serif;
    font-size:13px; font-weight:600;
    box-shadow:0 4px 16px rgba(0,0,0,0.15) !important;
  }
  .leaflet-popup-tip { display:none; }
</style>`;

const MAP_INIT = `
  var map = L.map('map', { zoomControl: false, attributionControl: true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© <a href="https://openstreetmap.org">OSM</a>'
  }).addTo(map);
  L.control.zoom({ position: 'bottomright' }).addTo(map);`;

function esc(s: string): string {
  return s.replace(/['"<>&]/g, (c) =>
    ({ "'": '&#39;', '"': '&quot;', '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] ?? c)
  );
}

// ─── Single-place map ────────────────────────────────────────────
function buildMapHTML(
  lat: number,
  lng: number,
  placeName: string,
  pinColor: string,
  userLat?: number,
  userLng?: number,
): string {
  const safeLabel = esc(placeName);

  const userMarker = (userLat !== undefined && userLng !== undefined)
    ? `
      var userIcon = L.divIcon({
        html: '<div style="width:14px;height:14px;background:#3B82F6;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.35)"></div>',
        iconSize:[14,14],iconAnchor:[7,7],className:''
      });
      L.marker([${userLat},${userLng}],{icon:userIcon}).addTo(map).bindPopup('You are here');
      map.fitBounds(
        L.featureGroup([placeMarker, L.marker([${userLat},${userLng}])]).getBounds().pad(0.25)
      );`
    : `map.setView([${lat},${lng}], 15);`;

  return `<!DOCTYPE html><html><head>${MAP_HEAD}</head><body><div id="map"></div><script>
  ${MAP_INIT}
  var pinColor = '${pinColor}';
  var pinIcon = L.divIcon({
    html: '<div style="position:relative;width:36px;height:44px;">' +
          '<div style="width:36px;height:36px;background:' + pinColor +
          ';border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.3);"></div>' +
          '<div style="position:absolute;top:8px;left:8px;width:20px;height:20px;background:white;border-radius:50%;opacity:0.9;"></div>' +
          '</div>',
    iconSize:[36,44],iconAnchor:[18,44],popupAnchor:[0,-46],className:''
  });
  var placeMarker = L.marker([${lat},${lng}],{icon:pinIcon}).addTo(map).bindPopup('<b>${safeLabel}</b>');
  ${userMarker}
  placeMarker.openPopup();
<\/script></body></html>`;
}

// ─── Overview map (all places) ───────────────────────────────────
interface MapPin {
  lat:   number;
  lng:   number;
  name:  string;
  color: string;
}

function buildOverviewMapHTML(
  pins:     MapPin[],
  userLat?: number,
  userLng?: number,
): string {
  const pinsJSON = JSON.stringify(
    pins.map((p) => ({ lat: p.lat, lng: p.lng, name: esc(p.name), color: p.color }))
  );

  const userMarkerJS = (userLat !== undefined && userLng !== undefined)
    ? `
      var uIcon = L.divIcon({
        html:'<div style="width:14px;height:14px;background:#3B82F6;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.35)"></div>',
        iconSize:[14,14],iconAnchor:[7,7],className:''
      });
      L.marker([${userLat},${userLng}],{icon:uIcon}).addTo(map).bindPopup('You are here');
      allLatLngs.push([${userLat},${userLng}]);`
    : '';

  const fitJS = (pins.length > 0 || (userLat !== undefined))
    ? `if (allLatLngs.length > 1) { map.fitBounds(allLatLngs, { padding: [60, 60] }); }
       else if (allLatLngs.length === 1) { map.setView(allLatLngs[0], 15); }
       else { map.setView([0,0], 2); }`
    : `map.setView([0,0], 2);`;

  return `<!DOCTYPE html><html><head>${MAP_HEAD}</head><body><div id="map"></div><script>
  ${MAP_INIT}
  var pins = ${pinsJSON};
  var allLatLngs = [];
  pins.forEach(function(p) {
    var icon = L.divIcon({
      html:'<div style="position:relative;width:30px;height:36px;">' +
           '<div style="width:30px;height:30px;background:'+p.color+
           ';border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.28);"></div>' +
           '<div style="position:absolute;top:6px;left:6px;width:18px;height:18px;background:white;border-radius:50%;opacity:0.88;"></div>' +
           '</div>',
      iconSize:[30,36],iconAnchor:[15,36],popupAnchor:[0,-38],className:''
    });
    L.marker([p.lat,p.lng],{icon:icon}).addTo(map).bindPopup('<b>'+p.name+'</b>');
    allLatLngs.push([p.lat,p.lng]);
  });
  ${userMarkerJS}
  ${fitJS}
<\/script></body></html>`;
}

// ─── Screen ─────────────────────────────────────────────────────
export default function MapScreen() {
  const { placeId }  = useLocalSearchParams<{ placeId?: string }>();
  const insets       = useSafeAreaInsets();
  const allPlaces    = useWanderStore((s) => s.places);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [mapReady,   setMapReady]   = useState(false);

  const place = placeId ? allPlaces.find((p) => p.placeId === placeId) ?? null : null;
  const meta  = place ? getCategoryMeta(place.category) : getCategoryMeta('food');

  // ── Try to get user location ──
  useEffect(() => {
    Location.getForegroundPermissionsAsync().then(async ({ status }) => {
      if (status === 'granted') {
        try {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setUserCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        } catch { /* ignored */ }
      }
    });
  }, []);

  // ── Build map HTML ──
  // Single place: centre on that place, show user dot if available.
  // No place (Maps button from wander list): overview of all nearby places.
  const mapHtml = useMemo(() => {
    if (place) {
      return buildMapHTML(
        place.latitude, place.longitude, place.name,
        meta.color, userCoords?.lat, userCoords?.lng,
      );
    }
    // Overview map — all unvisited places in the store + user dot
    const pins: MapPin[] = allPlaces
      .filter((p) => !p.isVisited)
      .slice(0, 30)
      .map((p) => ({
        lat:   p.latitude,
        lng:   p.longitude,
        name:  p.name,
        color: getCategoryMeta(p.category).color,
      }));
    if (pins.length > 0 || userCoords) {
      return buildOverviewMapHTML(pins, userCoords?.lat, userCoords?.lng);
    }
    return null;
  }, [place, allPlaces, userCoords, meta.color]);

  const openMaps = useCallback(() => {
    if (!place) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { latitude: lat, longitude: lng, name } = place;
    const q   = encodeURIComponent(name);
    const url = Platform.OS === 'ios'
      ? `maps://?q=${q}&ll=${lat},${lng}`
      : `geo:${lat},${lng}?q=${q}`;
    Linking.openURL(url).catch(() =>
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`)
    );
  }, [place]);

  const openDirections = useCallback(() => {
    if (!place) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { latitude: lat, longitude: lng } = place;
    const url = Platform.OS === 'ios'
      ? `maps://?daddr=${lat},${lng}&dirflg=w`
      : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    // Fall back to the universal https maps URL if the native scheme fails
    // (no Apple Maps, unsupported handler) — avoids an unhandled rejection.
    Linking.openURL(url).catch(() =>
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`)
    );
  }, [place]);

  const distanceLabel = place
    ? place.distanceKm < 1
      ? `${Math.round(place.distanceKm * 1000)} m away`
      : `${place.distanceKm.toFixed(1)} km away`
    : null;

  return (
    <View style={styles.root}>

      {/* ── Full-screen map ── */}
      {mapHtml ? (
        <WebView
          source={{ html: mapHtml }}
          style={styles.map}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          onLoad={() => setMapReady(true)}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          // scrollEnabled must stay unset (default true) so Leaflet touch
          // events (pan / zoom gestures) reach the JavaScript layer on Android.
        />
      ) : (
        <View style={[styles.map, styles.mapPlaceholder]}>
          <Ionicons name="map-outline" size={40} color={colors.green300} />
          <Text style={styles.mapPlaceholderText}>
            {userCoords === null ? 'Getting your location…' : 'No places to show'}
          </Text>
        </View>
      )}

      {/* Loading overlay while tiles fetch */}
      {mapHtml && !mapReady && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.green700} />
        </View>
      )}

      {/* ── Floating top bar ── */}
      <View
        style={[
          styles.topBar,
          { top: insets.top + spacing[2] },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.topBtn}>
          <Ionicons name="arrow-back" size={18} color={colors.textPrimary} />
          <Text style={styles.topBtnLabel} numberOfLines={1}>
            {place?.name ?? 'Nearby places'}
          </Text>
        </Pressable>
      </View>

      {/* ── Floating bottom card ── */}
      {place && (
        <View
          style={[
            styles.bottomCard,
            { paddingBottom: Math.max(insets.bottom, spacing[3]) + spacing[2] },
          ]}
        >
          {/* Place summary row */}
          <View style={styles.placeRow}>
            <View style={[styles.placeIconWrap, { backgroundColor: meta.bgColor }]}>
              <Ionicons name={meta.icon as any} size={20} color={meta.color} />
            </View>
            <View style={styles.placeInfo}>
              <Text style={styles.placeName} numberOfLines={1}>
                {place.name}
              </Text>
              {place.address ? (
                <Text style={styles.placeAddress} numberOfLines={1}>
                  {place.address}
                </Text>
              ) : null}
            </View>
            {distanceLabel && (
              <View style={styles.distBadge}>
                <Ionicons name="navigate-outline" size={11} color={colors.green700} />
                <Text style={styles.distText}>{distanceLabel}</Text>
              </View>
            )}
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Action buttons */}
          <View style={styles.btnRow}>
            <Pressable
              onPress={openMaps}
              style={({ pressed }) => [styles.btn, styles.btnOutline, pressed && { opacity: 0.8 }]}
              accessibilityRole="button"
              accessibilityLabel="Open in Maps"
            >
              <Ionicons name="map-outline" size={17} color={colors.green700} />
              <Text style={styles.btnOutlineText}>Open in Maps</Text>
            </Pressable>

            <Pressable
              onPress={openDirections}
              style={({ pressed }) => [styles.btn, styles.btnFill, pressed && { opacity: 0.9 }]}
              accessibilityRole="button"
              accessibilityLabel="Get directions"
            >
              <Ionicons name="navigate" size={17} color={colors.white} />
              <Text style={styles.btnFillText}>Directions</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: colors.background,
  },

  // Map fills the whole screen (cards float above it)
  map: {
    ...StyleSheet.absoluteFill,
  },
  mapPlaceholder: {
    alignItems:     'center',
    justifyContent: 'center',
    backgroundColor: colors.green50,
    gap:            spacing[3],
  },
  mapPlaceholderText: {
    fontFamily: fontFamily.medium,
    fontSize:   14,
    color:      colors.textMuted,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems:     'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },

  // ── Floating top bar
  topBar: {
    position:          'absolute',
    left:              spacing[4],
    right:             spacing[4],
    zIndex:            10,
    flexDirection:     'row',
    alignItems:        'center',
  },
  topBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing[1] + 1,
    paddingVertical:   spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius:      radius.full,
    backgroundColor:   'rgba(255,255,255,0.93)',
    borderWidth:       1,
    borderColor:       'rgba(0,0,0,0.08)',
    maxWidth:          '70%',
    ...shadow.sm,
  },
  topBtnLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize:   13.5,
    color:      colors.textPrimary,
    flexShrink: 1,
  },

  // ── Bottom card
  bottomCard: {
    position:          'absolute',
    bottom:            0,
    left:              0,
    right:             0,
    backgroundColor:   colors.white,
    borderTopLeftRadius:  radius.xl + 4,
    borderTopRightRadius: radius.xl + 4,
    paddingTop:        spacing[4],
    paddingHorizontal: spacing[5],
    borderTopWidth:    1,
    borderTopColor:    colors.border,
    ...shadow.lg,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[3],
    marginBottom:  spacing[3],
  },
  placeIconWrap: {
    width:          44,
    height:         44,
    borderRadius:   radius.lg,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  placeInfo: {
    flex: 1,
    gap:  3,
  },
  placeName: {
    fontFamily: fontFamily.bold,
    fontSize:   14.5,
    color:      colors.textPrimary,
  },
  placeAddress: {
    fontFamily: fontFamily.regular,
    fontSize:   11.5,
    color:      colors.textMuted,
  },
  distBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               3,
    paddingVertical:   spacing[1] + 1,
    paddingHorizontal: spacing[3],
    borderRadius:      radius.full,
    backgroundColor:   colors.green50,
    borderWidth:       1,
    borderColor:       colors.green100,
    flexShrink:        0,
  },
  distText: {
    fontFamily: fontFamily.semiBold,
    fontSize:   11,
    color:      colors.green700,
  },
  divider: {
    height:          1,
    backgroundColor: colors.borderLight,
    marginBottom:    spacing[3],
  },
  btnRow: {
    flexDirection: 'row',
    gap:           spacing[3],
  },
  btn: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             spacing[2],
    paddingVertical: spacing[3] + 2,
    borderRadius:    radius.lg,
  },
  btnOutline: {
    backgroundColor: colors.green50,
    borderWidth:     1,
    borderColor:     colors.green100,
  },
  btnOutlineText: {
    fontFamily: fontFamily.semiBold,
    fontSize:   13,
    color:      colors.green700,
  },
  btnFill: {
    backgroundColor: colors.green700,
  },
  btnFillText: {
    fontFamily: fontFamily.semiBold,
    fontSize:   13,
    color:      colors.white,
  },
});
