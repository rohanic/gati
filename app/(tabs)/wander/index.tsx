/**
 * Wander — interest-driven place discovery.
 *
 * Display sections (in order):
 *  1. Saved             — bookmarked places (always visible)
 *  2. Your numbers, nearby — places surfaced because of life stats
 *  3. Picked for you    — top interest-matched unseen places
 *  4. Discover          — remaining unseen places, scored by relevance
 *  5. Been here         — visited places (collapsible, bottom)
 *
 * Numbers bridge: coffee_cups→cafe, steps_walked→nature, meals_eaten→food.
 * Each bridged card shows a personal stat context line ("1,247 cups in your life.").
 *
 * NO emoji. NO purple. NO orange. Forest green + off-white palette.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Linking,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  AppState,
  Alert,
  type AppStateStatus,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { CategoryChips, PlaceCard } from '@/components/wander';
import type { WanderCategory } from '@/components/wander';
import { Collapsible } from '@/components/ui';
import { useWanderStore, useUserStore, FREE_SAVE_LIMIT } from '@/store/userStore';
import { getInitialWanderPlaces } from '@/data/samplePlaces';
import { fetchNearbyPlaces, haversineKm, PlacesRateLimitedError } from '@/services/placesService';
import { getUnifiedPersonalizedFeed, isInterestMatch } from '@/engine/wanderEngine';
import { explainRelevance, relevanceReason } from '@/engine/relevance';
import { computeLifeStats } from '@/engine/statsEngine';
import {
  getActiveBridges,
  getPlaceContextLine,
} from '@/engine/statPlaceBridge';
import { colors, spacing, radius, fontFamily } from '@/theme';
import type { WanderPlace } from '@/types';

// ─── Section header ──────────────────────────────────────────────
function SectionHeader({
  title,
  icon,
  count,
  sub,
}: {
  title: string;
  icon:  string;
  count?: number;
  sub?:  string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        <Ionicons name={icon as any} size={14} color={colors.textSecondary} />
        <Text style={styles.sectionTitle}>{title}</Text>
        {count !== undefined && (
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{count}</Text>
          </View>
        )}
      </View>
      {sub ? <Text style={styles.sectionSub}>{sub}</Text> : null}
    </View>
  );
}

// ─── Location banner ─────────────────────────────────────────────
// Two states: can still ask (request in-app) vs permanently denied
// (deep-link to system settings — the request dialog won't show again).
function LocationBanner({
  onGrant,
  permanentlyDenied,
}: {
  onGrant:           () => void;
  permanentlyDenied: boolean;
}) {
  return (
    <Pressable onPress={onGrant} style={styles.locationBanner}>
      <View style={styles.locationIcon}>
        <Ionicons name="location-outline" size={20} color={colors.green700} />
      </View>
      <View style={styles.locationText}>
        <Text style={styles.locationTitle}>
          {permanentlyDenied ? 'Location is off' : 'Find real places near you'}
        </Text>
        <Text style={styles.locationSub}>
          {permanentlyDenied
            ? 'Open Settings to let Wander search around you'
            : 'Real cafés, parks & museums from the map. Never tracked, never stored.'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

// ─── Loading strip while real places stream in ───────────────────
function FetchingBanner() {
  return (
    <View style={styles.fetchingBanner}>
      <ActivityIndicator size="small" color={colors.green700} />
      <Text style={styles.fetchingText}>Finding real places around you…</Text>
    </View>
  );
}

// ─── Empty state ─────────────────────────────────────────────────
function EmptyCategory({ category }: { category: string }) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name="telescope-outline" size={32} color={colors.green300} />
      <Text style={styles.emptyTitle}>
        {category === '' ? 'Nothing here yet' : `No ${category} spots yet`}
      </Text>
      <Text style={styles.emptySub}>
        More places are added as you explore
      </Text>
    </View>
  );
}

// ─── "For You" highlight strip ───────────────────────────────────
function ForYouHeader({ count }: { count: number }) {
  const opacity = useSharedValue(0);
  const transY  = useSharedValue(6);

  useEffect(() => {
    opacity.value = withDelay(180, withTiming(1, { duration: 300 }));
    transY.value  = withDelay(180, withSpring(0, { stiffness: 240, damping: 22 }));
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ translateY: transY.value }],
  }));

  return (
    <Animated.View style={[styles.forYouBanner, style]}>
      <View style={styles.forYouIconWrap}>
        <Ionicons name="sparkles" size={14} color={colors.green700} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.forYouTitle}>Picked for you</Text>
        <Text style={styles.forYouSub}>
          {count} {count === 1 ? 'place' : 'places'} matched to your taste
        </Text>
      </View>
    </Animated.View>
  );
}

// ─── Collapsible visited section ─────────────────────────────────
function VisitedSection({
  places,
  onPress,
  onSave,
  onUnsave,
}: {
  places:   WanderPlace[];
  onPress:  (id: string) => void;
  onSave:   (id: string) => void;
  onUnsave: (id: string) => void;
}) {
  // Open by default — visited places should be visible, not hidden behind a toggle.
  const [open, setOpen] = useState(true);

  // Entrance animation — matches ForYouHeader / NumbersNearbyHeader
  const enterOp = useSharedValue(0);
  const enterY  = useSharedValue(10);
  useEffect(() => {
    enterOp.value = withDelay(80, withTiming(1, { duration: 300 }));
    enterY.value  = withDelay(80, withSpring(0, { stiffness: 220, damping: 22 }));
  }, []);
  const enterStyle = useAnimatedStyle(() => ({
    opacity:   enterOp.value,
    transform: [{ translateY: enterY.value }],
  }));

  return (
    <Animated.View style={enterStyle}>
      {/* Section header styled like other sections, with a collapse toggle */}
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={styles.visitedHeader}
        android_ripple={{ color: colors.green50 }}
      >
        <View style={styles.sectionTitleRow}>
          <Ionicons name="checkmark-done-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.sectionTitle}>Been here</Text>
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{places.length}</Text>
          </View>
        </View>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={colors.textMuted}
        />
      </Pressable>

      <Collapsible open={open}>
        <View style={styles.visitedList}>
          {places.map((place, i) => (
            <PlaceCard
              key={place.placeId}
              place={place}
              index={i}
              onPress={onPress}
              onSave={onSave}
              onUnsave={onUnsave}
            />
          ))}
        </View>
      </Collapsible>
    </Animated.View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────
export default function WanderScreen() {
  const { category: categoryParam } = useLocalSearchParams<{ category?: string }>();

  const profile            = useUserStore((s) => s.profile);
  const places             = useWanderStore((s) => s.places);
  const categoryScores     = useWanderStore((s) => s.categoryScores);
  const addPlaces          = useWanderStore((s) => s.addPlaces);
  const savePlace          = useWanderStore((s) => s.savePlace);
  const unsavePlace        = useWanderStore((s) => s.unsavePlace);
  const initFromInterests  = useWanderStore((s) => s.initFromInterests);

  const userInterests = useMemo(
    () => profile?.interestCategories ?? [],
    [profile?.interestCategories]
  );

  const mergeRealPlaces = useWanderStore((s) => s.mergeRealPlaces);

  // Pre-select category chip when navigated from Numbers tab
  const [activeCategory, setActiveCategory] = useState<WanderCategory>(
    (categoryParam as WanderCategory) || 'all'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [locationGranted, setLocationGranted]       = useState<boolean | null>(null);
  const [canAskAgain, setCanAskAgain]               = useState(true);
  const [fetchingPlaces, setFetchingPlaces]         = useState(false);
  const [fetchedThisSession, setFetchedThisSession] = useState(false);
  const [usingFallback, setUsingFallback]           = useState(false);
  const [rateLimited,   setRateLimited]             = useState(false);
  const [refreshing, setRefreshing]                 = useState(false);
  const [lastFetchedAt, setLastFetchedAt]           = useState<Date | null>(null);
  // Rotation offset — incremented by FEED_SIZE on each refresh so pull-to-refresh
  // surfaces a fresh batch from the stored pool without a network call.
  const [displayOffset, setDisplayOffset]           = useState(0);
  // Ticks every 60 s so stalenessLabel recomputes without a user action.
  const [stalenessTick, setStalenessTick]           = useState(0);

  // Guard all async setState calls so navigating away mid-fetch
  // never triggers a state update on an unmounted component.
  const mountedRef          = useRef(true);
  const lastActiveMs        = useRef(Date.now());
  /** Last GPS fix used to fetch real places — compare on tab focus. */
  const lastFetchCoordsRef  = useRef<{ lat: number; lon: number } | null>(null);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── Staleness tick: recompute label every 60 s ──
  useEffect(() => {
    const id = setInterval(() => setStalenessTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // ── AppState: invalidate places after 30 min in background ──
  useEffect(() => {
    const STALE_MS = 30 * 60 * 1000;
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        const gap = Date.now() - lastActiveMs.current;
        if (gap > STALE_MS) { fetchedRef.current = false; setFetchedThisSession(false); }
        lastActiveMs.current = Date.now();
      } else {
        lastActiveMs.current = Date.now();
      }
    });
    return () => sub.remove();
  }, []);

  // The route param wins until the user taps a chip, after which their choice
  // wins until a new param arrives. Tracking the last-seen param during render
  // avoids the setState-in-effect that previously showed one frame of the old
  // category when navigating in from the Numbers tab.
  const lastParamRef = useRef<string | undefined>(categoryParam);
  if (categoryParam && categoryParam !== lastParamRef.current) {
    lastParamRef.current = categoryParam;
    if (categoryParam !== activeCategory) {
      setActiveCategory(categoryParam as WanderCategory);
    }
  }

  // ── Initialize interest scores (re-runs if interests change in Profile) ──
  useEffect(() => {
    if (userInterests.length > 0) {
      initFromInterests(userInterests);
    }
  }, [userInterests, initFromInterests]);

  // ── Fetch REAL nearby places once location is available ──
  //
  // Deliberately has an EMPTY dependency list. It previously depended on
  // `places.length` and `fetchedThisSession`, so its identity changed after
  // every merge — which re-fired the focus effect below, which took another
  // GPS fix, which could merge again. Mutable refs hold the state it needs so
  // the callback stays stable for the life of the screen.
  const fetchedRef   = useRef(false);
  const inFlightRef  = useRef(false);

  /**
   * Seed the curated sample pool if the store is empty, and flag the fallback.
   *
   * Every failure path needs this. Previously curated places were only seeded
   * in the "location denied" branch of the bootstrap effect, so whenever
   * location WAS granted and the fetch failed, the banner promised "Showing
   * curated places" while the list stayed completely empty.
   */
  const ensureFallbackPlaces = useCallback(() => {
    if (!mountedRef.current) return;
    if (useWanderStore.getState().places.length === 0) {
      addPlaces(getInitialWanderPlaces());
    }
    setUsingFallback(true);
  }, [addPlaces]);

  const loadRealPlaces = useCallback(async (forceRefresh = false) => {
    if (inFlightRef.current) return;                  // coalesce concurrent calls
    if (fetchedRef.current && !forceRefresh) return;
    inFlightRef.current = true;
    if (mountedRef.current) setFetchingPlaces(true);
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = pos.coords;
      lastFetchCoordsRef.current = { lat: latitude, lon: longitude };

      const real = await fetchNearbyPlaces(latitude, longitude);
      if (real.length > 0) {
        mergeRealPlaces(real);
        fetchedRef.current = true;
        if (mountedRef.current) {
          setFetchedThisSession(true);
          setUsingFallback(false);
          setRateLimited(false);
          setLastFetchedAt(new Date());
        }
      } else {
        // Search worked but returned nothing usable (or the backend is not
        // deployed yet). Fall back to curated places so the tab is never
        // an empty screen.
        ensureFallbackPlaces();
      }
    } catch (e) {
      if (e instanceof PlacesRateLimitedError) {
        // Say so plainly rather than silently showing curated places as if
        // they were nearby results.
        if (mountedRef.current) setRateLimited(true);
      }
      ensureFallbackPlaces();
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) {
        setFetchingPlaces(false);
        setRefreshing(false);
      }
    }
  }, [mergeRealPlaces, ensureFallbackPlaces]);

  // ── Location permission bootstrap ──
  useEffect(() => {
    Location.getForegroundPermissionsAsync().then(({ status, canAskAgain: again }) => {
      if (!mountedRef.current) return;
      const granted = status === 'granted';
      setLocationGranted(granted);
      setCanAskAgain(again);
      if (granted) {
        loadRealPlaces();
      } else {
        // No location → curated sample data so the tab still breathes.
        ensureFallbackPlaces();
      }
    }).catch(() => {
      // Permission check itself failed — still show something.
      ensureFallbackPlaces();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestLocation = useCallback(async () => {
    // Permanently denied → the OS dialog won't appear; open Settings
    if (!canAskAgain) {
      Linking.openSettings();
      return;
    }
    const { status, canAskAgain: again } = await Location.requestForegroundPermissionsAsync();
    setCanAskAgain(again);
    const granted = status === 'granted';
    setLocationGranted(granted);
    if (granted) loadRealPlaces();
  }, [canAskAgain, loadRealPlaces]);

  // ── Auto-refresh when the user has moved 5+ km since the last fetch ──
  //
  // A GPS fix is expensive, so this is throttled to once every 10 minutes and
  // skipped entirely when there is no previous fetch to compare against. The
  // old version took a fresh fix on EVERY tab focus — including when it had
  // nothing to compare it to — and re-fired whenever the place list changed.
  const LOCATION_THRESHOLD_KM  = 5;
  const LOCATION_CHECK_MIN_MS  = 10 * 60 * 1000;
  const lastGeoCheckRef        = useRef(0);

  useFocusEffect(
    useCallback(() => {
      if (!locationGranted) return;
      if (!lastFetchCoordsRef.current) return;   // nothing to compare against
      if (Date.now() - lastGeoCheckRef.current < LOCATION_CHECK_MIN_MS) return;
      lastGeoCheckRef.current = Date.now();

      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest })
        .then((pos) => {
          if (!mountedRef.current) return;
          const last = lastFetchCoordsRef.current;
          if (!last) return;
          const { latitude, longitude } = pos.coords;
          const km = haversineKm(last.lat, last.lon, latitude, longitude);
          if (km >= LOCATION_THRESHOLD_KM) {
            fetchedRef.current = false;
            setFetchedThisSession(false);
            loadRealPlaces(true);
          }
        })
        .catch(() => { /* location unavailable — skip silently */ });
    }, [locationGranted, loadRealPlaces]),
  );

  // ── Life stats for Numbers bridge ──
  const lifeStats = useMemo(
    () => (profile ? computeLifeStats(profile) : null),
    [profile]
  );

  // ── Active bridges (bridges whose stat clears minValue) ──
  const activeBridges = useMemo(
    () => (lifeStats ? getActiveBridges(lifeStats) : []),
    [lifeStats]
  );

  // ── Categories inferred from user behaviour (stat-place bridges) ──
  // E.g. high coffee count → 'cafe', high step count → 'nature'.
  // These expand the feed filter beyond declared interests alone.
  const bridgeCategories = useMemo(
    () => activeBridges.map((b) => b.placeCategory),
    [activeBridges]
  );

  // ── Name search filter ──
  const searchTrimmed = searchQuery.trim().toLowerCase();

  // ── Search results — when active, overrides all feed sections ──
  // Searches ALL places by name regardless of interest categories.
  // Saved places sort first, then prefix matches, then alphabetical.
  const searchResults = useMemo(() => {
    if (!searchTrimmed) return null;
    return places
      .filter((p) => p.name.toLowerCase().includes(searchTrimmed))
      .sort((a, b) => {
        if (a.isSaved !== b.isSaved) return a.isSaved ? -1 : 1;
        const aStarts = a.name.toLowerCase().startsWith(searchTrimmed);
        const bStarts = b.name.toLowerCase().startsWith(searchTrimmed);
        if (aStarts !== bStarts) return aStarts ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [places, searchTrimmed]);

  // Feed size: always exactly 5 places
  const FEED_SIZE = 5;

  // ── Saved & Visited (category-chip aware) ──
  const filteredSaved = useMemo(() => {
    const saved = places.filter((p) => p.isSaved);
    return activeCategory === 'all' ? saved : saved.filter((p) => p.category === activeCategory);
  }, [places, activeCategory]);

  const filteredVisited = useMemo(() => {
    const visited = places.filter((p) => p.isVisited && !p.isSaved);
    return activeCategory === 'all' ? visited : visited.filter((p) => p.category === activeCategory);
  }, [places, activeCategory]);

  // ── Unified personalised feed ──
  // Draws from userInterests ∪ bridgeCategories — never shows random categories.
  // Stat-bridge places get a ranking bonus so behaviour influences surfacing.
  // Pull-to-refresh rotates the display window via displayOffset.
  const personalFeed = useMemo(() => {
    return getUnifiedPersonalizedFeed(
      places,
      categoryScores,
      userInterests,
      bridgeCategories,
      FEED_SIZE,
      displayOffset,
      activeCategory === 'all' ? undefined : activeCategory,
    );
  }, [places, categoryScores, userInterests, bridgeCategories, FEED_SIZE, displayOffset, activeCategory]);

  const hasAnything =
    // When search is active, the search section always renders (has its own empty state)
    searchResults !== null ||
    filteredSaved.length + personalFeed.length + filteredVisited.length > 0;

  const handlePress   = useCallback((placeId: string) => {
    router.push({ pathname: '/(tabs)/wander/[placeId]', params: { placeId } });
  }, []);

  // Free-tier cap is enforced inside the store's savePlace (single source of
  // truth). If it returns false the user hit the limit → route to /pro.
  const handleSave = useCallback((placeId: string) => {
    const ok = savePlace(placeId);
    if (!ok) {
      Alert.alert(
        'Saved places limit reached',
        `Free accounts can save up to ${FREE_SAVE_LIMIT} places. Upgrade to Pro for unlimited saves.`,
        [
          { text: 'Not now',  style: 'cancel' },
          { text: 'Upgrade',  onPress: () => router.push('/pro') },
        ]
      );
    }
  }, [savePlace]);

  const handleRefresh = useCallback(() => {
    // Always rotate the display window immediately — instant variety even
    // when offline. The pool wraps, so users never hit a dead end.
    setDisplayOffset((prev) => prev + FEED_SIZE);

    if (locationGranted) {
      setRefreshing(true);
      fetchedRef.current = false;
      setFetchedThisSession(false);
      // loadRealPlaces handles setRefreshing(false) internally
      loadRealPlaces(true);
    } else {
      setRefreshing(true);
      setTimeout(() => setRefreshing(false), 500);
    }
  }, [locationGranted, loadRealPlaces, FEED_SIZE]);

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

  // ── Subtitle text: reflects interest personalization ──
  const subtitleText = userInterests.length > 0
    ? `Sorted by your taste`
    : 'Hidden gems near you';

  // ── Staleness label (how long since last real-place fetch) ──
  // stalenessTick fires every 60 s so the label stays accurate without user action.
  const stalenessLabel = useMemo(() => {
    if (!lastFetchedAt) return null;
    const mins = Math.floor((Date.now() - lastFetchedAt.getTime()) / 60_000);
    if (mins < 1)  return 'Just updated';
    if (mins < 60) return `Updated ${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return `Updated ${hrs}h ago`;
  }, [lastFetchedAt, stalenessTick]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Header ── */}
      <Animated.View style={[styles.header, headerStyle]}>
        <View style={styles.headerLeft}>
          <Text style={styles.screenTitle}>Wander</Text>
          <Text style={styles.screenSub}>
            {stalenessLabel ?? subtitleText}
          </Text>
        </View>
        <View style={styles.headerRight}>
          {lastFetchedAt !== null && (
            <Pressable
              onPress={() => {
                setDisplayOffset((prev) => prev + FEED_SIZE);
                fetchedRef.current = false;
                setFetchedThisSession(false);
                if (locationGranted) loadRealPlaces(true);
              }}
              style={styles.refreshBtn}
              accessibilityLabel="Refresh nearby places"
            >
              <Ionicons name="refresh-outline" size={14} color={colors.green700} />
              <Text style={styles.refreshBtnLabel}>Refresh</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => router.push('/(tabs)/wander/map')}
            style={styles.mapBtn}
            accessibilityLabel="Open place in Maps app"
            accessibilityHint="Opens Google Maps or Apple Maps"
          >
            <Ionicons name="map-outline" size={15} color={colors.green700} />
            <Text style={styles.mapBtnLabel}>Maps</Text>
          </Pressable>
        </View>
      </Animated.View>

      {/* ── Location banner (only shown before sample data loads) ── */}
      {locationGranted === false && !usingFallback && (
        <LocationBanner
          onGrant={requestLocation}
          permanentlyDenied={!canAskAgain}
        />
      )}

      {/* ── Fetching real places ── */}
      {fetchingPlaces && <FetchingBanner />}

      {/* ── Sample-data / re-grant nudge ── */}
      {usingFallback && !fetchingPlaces && (
        <View style={styles.fallbackCard}>
          <View style={styles.fallbackCardRow}>
            <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
            <View style={styles.fallbackCardBody}>
              <Text style={styles.fallbackCardTitle}>Showing curated places</Text>
              <Text style={styles.fallbackCardSub}>
                {rateLimited
                  ? 'You’ve searched a lot in a short time. Real places come back in a few minutes.'
                  : locationGranted === false
                    ? 'Enable location to discover real places near you.'
                    : 'Could not load nearby places. Pull down to retry.'}
              </Text>
            </View>
          </View>
          {locationGranted === false && (
            <Pressable
              style={styles.fallbackCardBtn}
              onPress={requestLocation}
              accessibilityRole="button"
            >
              <Text style={styles.fallbackCardBtnText}>
                {canAskAgain ? 'Enable location' : 'Open Settings'}
              </Text>
              <Ionicons name="chevron-forward" size={12} color={colors.green700} />
            </Pressable>
          )}
        </View>
      )}

      {/* ── Search bar ── */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={15} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search places…"
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel="Search Wander places"
        />
      </View>

      {/* ── Category chips ── */}
      <CategoryChips active={activeCategory} onChange={setActiveCategory} />

      {/* ── Place list ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.green700}
            colors={[colors.green700]}
          />
        }
      >

        {/* ── Search results — replaces all feed sections while a query is active ── */}
        {searchResults !== null && (
          <View style={styles.section}>
            <SectionHeader
              title={searchResults.length > 0
                ? `${searchResults.length} place${searchResults.length !== 1 ? 's' : ''} found`
                : 'No results'}
              icon="search-outline"
            />
            {searchResults.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={32} color={colors.green300} />
                <Text style={styles.emptyTitle}>No places match</Text>
                <Text style={styles.emptySub}>
                  Try a shorter name — search checks everything in your pool
                </Text>
              </View>
            ) : (
              searchResults.map((place, i) => (
                <PlaceCard
                  key={place.placeId}
                  place={place}
                  index={i}
                  onPress={handlePress}
                  onSave={handleSave}
                  onUnsave={unsavePlace}
                  isInterestMatch={isInterestMatch(place, userInterests)}
                  statContext={lifeStats
                    ? getPlaceContextLine(place.category, lifeStats, profile ?? undefined) ?? undefined
                    : undefined}
                />
              ))
            )}
          </View>
        )}

        {/* ── 1. Saved ── */}
        {searchResults === null && filteredSaved.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="Saved"
              icon="bookmark"
              count={filteredSaved.length}
            />
            {filteredSaved.map((place, i) => (
              <PlaceCard
                key={place.placeId}
                place={place}
                index={i}
                onPress={handlePress}
                onSave={handleSave}
                onUnsave={unsavePlace}
                isInterestMatch={isInterestMatch(place, userInterests)}
              />
            ))}
          </View>
        )}

        {/* ── 2. Picked for you ──
            Unified feed of exactly 5 places from the user's interest
            categories + stat-inferred categories (coffee → café, steps → nature).
            Pull-to-refresh rotates the pool via displayOffset. ── */}
        {searchResults === null && personalFeed.length > 0 && (
          <View style={filteredSaved.length > 0 ? styles.section : undefined}>
            <ForYouHeader count={personalFeed.length} />
            {personalFeed.map((place, i) => (
              <PlaceCard
                key={place.placeId}
                place={place}
                index={filteredSaved.length + i}
                onPress={handlePress}
                onSave={handleSave}
                onUnsave={unsavePlace}
                isInterestMatch={isInterestMatch(place, userInterests)}
                reason={relevanceReason(
                  explainRelevance(place, categoryScores, userInterests),
                  place,
                )}
                enableAiPick   /* only this section triggers the AI fetch */
                statContext={lifeStats
                  ? getPlaceContextLine(place.category, lifeStats, profile ?? undefined) ?? undefined
                  : undefined}
              />
            ))}
            <View style={styles.rotationHint}>
              <Ionicons name="refresh-outline" size={11} color={colors.textMuted} />
              <Text style={styles.rotationHintText}>Pull down for a fresh batch</Text>
            </View>
          </View>
        )}

        {/* ── 5. Been here (collapsible) ── */}
        {searchResults === null && filteredVisited.length > 0 && (
          <View style={styles.section}>
            <VisitedSection
              places={filteredVisited}
              onPress={handlePress}
              onSave={handleSave}
              onUnsave={unsavePlace}
            />
          </View>
        )}

        {/* ── Nothing at all ── */}
        {!hasAnything && (
          <EmptyCategory
            category={activeCategory === 'all' ? '' : activeCategory}
          />
        )}

        <View style={{ height: spacing[10] }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────
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
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[2],
  },
  refreshBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    paddingVertical:   8,
    paddingHorizontal: 12,
    borderRadius:      radius.lg,
    backgroundColor:   colors.surface2,
    borderWidth:       1,
    borderColor:       colors.borderLight,
    marginBottom:      2,
  },
  refreshBtnLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize:   12,
    color:      colors.green700,
  },
  screenTitle: {
    fontFamily:    fontFamily.bold,
    fontSize:      24.5,
    color:         colors.textPrimary,
    letterSpacing: -0.4,
    marginBottom:  3,
  },
  screenSub: {
    fontFamily: fontFamily.regular,
    fontSize:   12,
    color:      colors.textSecondary,
  },
  mapBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    paddingVertical:   8,
    paddingHorizontal: 12,
    borderRadius:      radius.lg,
    backgroundColor:   colors.green50,
    borderWidth:       1,
    borderColor:       colors.green100,
    marginBottom:      2,
  },
  mapBtnLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize:   12,
    color:      colors.green700,
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
    fontSize:     13,
    color:        colors.green700,
    marginBottom: 2,
  },
  locationSub: {
    fontFamily: fontFamily.regular,
    fontSize:   11.5,
    color:      colors.textSecondary,
    lineHeight: 16,
  },

  fetchingBanner: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               spacing[2],
    marginHorizontal:  spacing[5],
    marginBottom:      spacing[3],
    paddingVertical:   spacing[2] + 2,
    paddingHorizontal: spacing[4],
    backgroundColor:   colors.surface2,
    borderRadius:      radius.full,
    borderWidth:       1,
    borderColor:       colors.borderLight,
  },
  fetchingText: {
    fontFamily: fontFamily.medium,
    fontSize:   11.5,
    color:      colors.textSecondary,
  },

  // Sample-data / re-grant card
  fallbackCard: {
    marginHorizontal: spacing[5],
    marginBottom:     spacing[3],
    backgroundColor:  colors.surface2,
    borderRadius:     radius.lg,
    borderWidth:      1,
    borderColor:      colors.borderLight,
    padding:          spacing[4],
    gap:              spacing[3],
  },
  fallbackCardRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           spacing[3],
  },
  fallbackCardBody: {
    flex: 1,
    gap:  spacing[1],
  },
  fallbackCardTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize:   13,
    color:      colors.textPrimary,
  },
  fallbackCardSub: {
    fontFamily: fontFamily.regular,
    fontSize:   12,
    color:      colors.textSecondary,
    lineHeight: 17,
  },
  fallbackCardBtn: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'center',
    gap:              spacing[2],
    backgroundColor:  colors.green50,
    borderRadius:     radius.md,
    paddingVertical:  spacing[2] + 2,
    borderWidth:      1,
    borderColor:      colors.green100,
  },
  fallbackCardBtnText: {
    fontFamily: fontFamily.semiBold,
    fontSize:   13,
    color:      colors.green700,
  },

  // Search bar
  searchRow: {
    flexDirection:     'row',
    alignItems:        'center',
    marginHorizontal:  spacing[5],
    marginBottom:      spacing[3],
    backgroundColor:   colors.surface2,
    borderRadius:      radius.lg,
    borderWidth:       1,
    borderColor:       colors.border,
    paddingHorizontal: spacing[3],
    height:            38,
  },
  searchIcon: {
    marginRight: spacing[2],
  },
  searchInput: {
    flex:       1,
    fontFamily: fontFamily.regular,
    fontSize:   13.5,
    color:      colors.textPrimary,
    paddingVertical: 0, // Android baseline fix
  },

  scroll:  { flex: 1 },
  content: { paddingTop: spacing[2] },

  section: { marginTop: spacing[5] },

  // Section header
  sectionHeader: {
    paddingHorizontal: spacing[5],
    marginBottom:      spacing[3],
    gap:               2,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[2],
  },
  sectionTitle: {
    flex:       1,
    fontFamily: fontFamily.bold,
    fontSize:   15,
    color:      colors.textPrimary,
  },
  sectionSub: {
    fontFamily:  fontFamily.regular,
    fontSize:    11.5,
    color:       colors.textMuted,
    marginLeft:  spacing[5],
    lineHeight:  16,
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
    fontSize:   10.5,
    color:      colors.green700,
  },

  // For You banner
  forYouBanner: {
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
  forYouIconWrap: {
    width:           36,
    height:          36,
    borderRadius:    radius.md,
    backgroundColor: colors.white,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     colors.green100,
  },
  forYouTitle: {
    fontFamily:   fontFamily.semiBold,
    fontSize:     13,
    color:        colors.green700,
    marginBottom: 1,
  },
  forYouSub: {
    fontFamily: fontFamily.regular,
    fontSize:   11.5,
    color:      colors.textSecondary,
  },

  // Visited section — header matches the other SectionHeader rows
  visitedHeader: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: spacing[5],
    paddingVertical:   spacing[1],
    marginBottom:      spacing[3],
  },
  visitedList: {
    marginTop: spacing[1],
  },

  // Rotation hint
  rotationHint: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            spacing[1] + 1,
    marginTop:      spacing[3],
    marginBottom:   spacing[1],
  },
  rotationHintText: {
    fontFamily: fontFamily.regular,
    fontSize:   11,
    color:      colors.textMuted,
  },

  // Empty
  emptyState: {
    alignItems:        'center',
    paddingTop:        spacing[14],
    gap:               spacing[3],
    paddingHorizontal: spacing[8],
  },
  emptyTitle: {
    fontFamily: fontFamily.bold,
    fontSize:   15,
    color:      colors.textPrimary,
    textAlign:  'center',
  },
  emptySub: {
    fontFamily: fontFamily.regular,
    fontSize:   12,
    color:      colors.textMuted,
    textAlign:  'center',
    lineHeight: 18,
  },
});
