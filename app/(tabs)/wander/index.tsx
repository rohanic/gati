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
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { CategoryChips, PlaceCard } from '@/components/wander';
import type { WanderCategory } from '@/components/wander';
import { Collapsible } from '@/components/ui';
import * as Haptics from 'expo-haptics';
import { useWanderStore, useUserStore, FREE_SAVE_LIMIT, RADIUS_OPTIONS_KM } from '@/store/userStore';
import { getInitialWanderPlaces } from '@/data/samplePlaces';
import { fetchNearbyPlaces, haversineKm, PlacesRateLimitedError } from '@/services/placesService';
import { buildNearbyFeed, isInterestMatch } from '@/engine/wanderEngine';
import { explainRelevance, relevanceReason } from '@/engine/relevance';
import { computeLifeStats } from '@/engine/statsEngine';
import {
  getActiveBridges,
  getPlaceContextLine,
} from '@/engine/statPlaceBridge';
import { colors, spacing, radius, fontFamily } from '@/theme';
import type { WanderPlace } from '@/types';
import { Text } from '@/components/ui/Text';
import { useEntrance } from '@/hooks/useEntrance';

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
/**
 * Re-search once the user has moved this far. Half the smallest radius: with
 * 500 m on offer, the old 5 km threshold meant the list could describe
 * somewhere the user had long since walked away from.
 */
const LOCATION_THRESHOLD_KM = 0.25;
/** A GPS fix costs battery; re-check position on focus at most this often. */
const LOCATION_CHECK_MIN_MS = 10 * 60 * 1000;

type LocationCardState = 'ask' | 'denied' | 'servicesOff' | 'rateLimited' | 'failed';

/** "500 m", "1 km", "2.5 km". */
export function formatRadius(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${Number.isInteger(km) ? km : km.toFixed(1)} km`;
}

/**
 * The single location message. It replaces two banners that could show at
 * once, both asking for location in different words.
 *
 * Every state has one plain sentence about what is wrong and at most one
 * button that fixes it. Nothing here requests anything by itself — each
 * system dialog appears only behind the button the user pressed.
 */
const LOCATION_COPY: Record<LocationCardState, { icon: string; title: string; body: string; action?: string }> = {
  ask: {
    icon:   'location-outline',
    title:  'Find good places near you',
    body:   'Wander uses your location only while it searches. It is never stored or shared.',
    action: 'Show places near me',
  },
  denied: {
    icon:   'location-outline',
    title:  'Location permission is off',
    body:   'Allow location for Gati in Settings to see places near you.',
    action: 'Open Settings',
  },
  servicesOff: {
    icon:   'navigate-circle-outline',
    title:  'Your phone’s location is off',
    body:   'Turn it on and Wander will search around you.',
    action: 'Turn on location',
  },
  rateLimited: {
    icon:   'time-outline',
    title:  'Too many searches for now',
    body:   'Places will load again in a few minutes.',
  },
  failed: {
    icon:   'cloud-offline-outline',
    title:  'Couldn’t load places near you',
    body:   'Check your connection and try again.',
    action: 'Try again',
  },
};

function LocationCard({ state, onAction }: { state: LocationCardState; onAction: () => void }) {
  const copy = LOCATION_COPY[state];
  return (
    <View style={styles.locationBanner}>
      <View style={styles.locationIcon}>
        <Ionicons name={copy.icon as any} size={20} color={colors.green700} />
      </View>
      <View style={styles.locationText}>
        <Text style={styles.locationTitle}>{copy.title}</Text>
        <Text style={styles.locationSub}>{copy.body}</Text>
        {copy.action && (
          <Pressable
            onPress={onAction}
            style={styles.locationAction}
            android_ripple={{ color: colors.green50 }}
            accessibilityRole="button"
          >
            <Text style={styles.locationActionText}>{copy.action}</Text>
          </Pressable>
        )}
      </View>
    </View>
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
  const style = useEntrance({ delay: 180, duration: 300, translateY: 6 });

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
  const enterStyle = useEntrance({ delay: 80, duration: 300, translateY: 10 });

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
  const searchRadiusKm    = useWanderStore((st) => st.searchRadiusKm);
  const setSearchRadiusKm = useWanderStore((st) => st.setSearchRadiusKm);
  const [rateLimited,   setRateLimited]             = useState(false);
  const [refreshing, setRefreshing]                 = useState(false);
  const [lastFetchedAt, setLastFetchedAt]           = useState<Date | null>(null);
  /**
   * The phone's location switch is off (distinct from permission). Detected
   * with hasServicesEnabledAsync, which shows nothing, so the screen can say
   * so and offer one button — instead of every position request opening
   * Android's "turn on location" dialog uninvited.
   */
  const [servicesOff, setServicesOff]               = useState(false);
  // Ticks every 60 s so stalenessLabel recomputes without a user action.
  const [stalenessTick, setStalenessTick]           = useState(0);

  // Guard all async setState calls so navigating away mid-fetch
  // never triggers a state update on an unmounted component.
  const mountedRef          = useRef(true);
  const lastActiveMs        = useRef(Date.now());
  /** Last GPS fix used to fetch real places — compare on tab focus. */
  const lastFetchCoordsRef  = useRef<{ lat: number; lon: number } | null>(null);
  /**
   * Radii already searched from the current spot. Switching back to one of
   * them only re-filters what is stored — no request, nothing counted against
   * the hourly search limit. Cleared as soon as the user moves.
   */
  const fetchedRadiiRef     = useRef<Set<number>>(new Set());
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
      // Location switch off → say so. Checked first because the position call
      // below would otherwise fail slowly, or — with Android's default
      // mayShowUserSettingsDialog: true — open the "turn on location" dialog
      // every time Wander was opened, refreshed or refocused.
      const servicesOn = await Location.hasServicesEnabledAsync().catch(() => true);
      if (!servicesOn) {
        if (mountedRef.current) setServicesOff(true);
        ensureFallbackPlaces();
        return;
      }
      if (mountedRef.current) setServicesOff(false);

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        // Only an explicit tap on "Turn on location" may raise that dialog.
        mayShowUserSettingsDialog: false,
      });
      const { latitude, longitude } = pos.coords;
      // Moved since the last search? Then no stored radius describes here.
      const prev = lastFetchCoordsRef.current;
      if (!prev || haversineKm(prev.lat, prev.lon, latitude, longitude) >= LOCATION_THRESHOLD_KM) {
        fetchedRadiiRef.current.clear();
      }
      lastFetchCoordsRef.current = { lat: latitude, lon: longitude };
      const radiusKm = useWanderStore.getState().searchRadiusKm;

      const real = await fetchNearbyPlaces(latitude, longitude, radiusKm * 1000);
      if (real.length > 0) {
        fetchedRadiiRef.current.add(radiusKm);
        // Pass the origin so places kept from earlier searches are re-measured
        // from here, not left with the distance from wherever they were found.
        mergeRealPlaces(real, { lat: latitude, lon: longitude });
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

  /**
   * The only place Android's "turn on location" dialog may appear: behind a
   * button the user pressed.
   */
  const turnOnLocation = useCallback(async () => {
    try {
      await Location.enableNetworkProviderAsync();
    } catch {
      // Declined. The card stays and says why; nothing else to do.
    }
    fetchedRef.current = false;
    loadRealPlaces(true);
  }, [loadRealPlaces]);

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

  const lastGeoCheckRef        = useRef(0);

  useFocusEffect(
    useCallback(() => {
      if (!locationGranted) return;
      if (!lastFetchCoordsRef.current) return;   // nothing to compare against
      if (Date.now() - lastGeoCheckRef.current < LOCATION_CHECK_MIN_MS) return;
      lastGeoCheckRef.current = Date.now();

      if (servicesOff) return;
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Lowest,
        mayShowUserSettingsDialog: false,
      })
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
    }, [locationGranted, loadRealPlaces, servicesOff]),
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
    const hasReal = places.some((p) => !p.isSample);
    return places
      .filter((p) => (!hasReal || !p.isSample) && p.name.toLowerCase().includes(searchTrimmed))
      .sort((a, b) => {
        if (a.isSaved !== b.isSaved) return a.isSaved ? -1 : 1;
        const aStarts = a.name.toLowerCase().startsWith(searchTrimmed);
        const bStarts = b.name.toLowerCase().startsWith(searchTrimmed);
        if (aStarts !== bStarts) return aStarts ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [places, searchTrimmed]);


  // ── Saved & Visited (category-chip aware) ──
  const filteredSaved = useMemo(() => {
    const saved = places.filter((p) => p.isSaved);
    return activeCategory === 'all' ? saved : saved.filter((p) => p.category === activeCategory);
  }, [places, activeCategory]);

  const filteredVisited = useMemo(() => {
    const visited = places.filter((p) => p.isVisited && !p.isSaved);
    return activeCategory === 'all' ? visited : visited.filter((p) => p.category === activeCategory);
  }, [places, activeCategory]);

  // ── The feed: everything within the chosen radius, best first ──
  // Deterministic — same place, same order, every time. See buildNearbyFeed
  // for why the old rotating five-place window read as random.
  const feed = useMemo(
    () => buildNearbyFeed(
      places, categoryScores, userInterests, bridgeCategories,
      searchRadiusKm, activeCategory,
    ),
    [places, categoryScores, userInterests, bridgeCategories, searchRadiusKm, activeCategory],
  );

  /**
   * Which location card, if any. Exactly one message at a time — the old
   * screen could show a permission banner and a "curated places" card
   * together, both asking for location.
   */
  const locationCardState: LocationCardState | null =
    locationGranted === false ? (canAskAgain ? 'ask' : 'denied')
    : servicesOff             ? 'servicesOff'
    : rateLimited             ? 'rateLimited'
    : usingFallback && locationGranted ? 'failed'
    : null;

  const hasAnything =
    // When search is active, the search section always renders (has its own empty state)
    searchResults !== null ||
    filteredSaved.length + feed.forYou.length + feed.nearby.length + filteredVisited.length > 0;

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
    // A refresh searches again from where the user is now. It no longer
    // rotates the list, which pushed the best places out on every pull.
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
  }, [locationGranted, loadRealPlaces]);

  // ── Header entrance ──
  const headerStyle = useEntrance({ duration: 360, translateY: -8 });

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

      {/* ── One location card: what is wrong, and one thing to do about it ── */}
      {!fetchingPlaces && locationCardState && (
        <LocationCard
          state={locationCardState}
          onAction={
            locationCardState === 'servicesOff' ? turnOnLocation
            : locationCardState === 'failed'    ? () => { fetchedRef.current = false; loadRealPlaces(true); }
            : requestLocation
          }
        />
      )}

      {/* ── Fetching real places ── */}
      {fetchingPlaces && <FetchingBanner />}

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

      {/* ── Search radius ──
          Wander's most common complaint is a result that is technically
          nearby and practically useless. Rather than pick one radius for
          everyone, let the user say how far they are willing to go: a dense
          city wants 2 km, a small town needs 25. Changing it refetches. */}
      {/* Scrolls rather than wraps: five chips and a label are ~380 dp, wider
          than a 360 dp phone once "500 m" is on the list. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.radiusRow}
        style={styles.radiusScroll}
      >
        <Ionicons name="resize-outline" size={13} color={colors.textMuted} />
        <Text style={styles.radiusLabel}>Within</Text>
        {RADIUS_OPTIONS_KM.map((km) => {
          const active = km === searchRadiusKm;
          return (
            <Pressable
              key={km}
              onPress={() => {
                if (km === searchRadiusKm) return;
                Haptics.selectionAsync();
                setSearchRadiusKm(km);
                // The feed re-filters to the new radius immediately. Search
                // again only if this radius has not been searched from here —
                // narrowing to 500 m still needs its own search, because a
                // wider search returns the most popular places across the
                // whole circle, not the best ones within 500 m.
                if (locationGranted && !fetchedRadiiRef.current.has(km)) {
                  fetchedRef.current = false;
                  loadRealPlaces(true);
                }
              }}
              style={[styles.radiusChip, active && styles.radiusChipActive]}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Search within ${formatRadius(km)}`}
            >
              <Text
                style={[styles.radiusChipText, active && styles.radiusChipTextActive]}
                maxFontSizeMultiplier={1.3}
              >
                {formatRadius(km)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

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
            The best places in range for the user's interests and for what
            their numbers suggest (coffee → café, steps → nature). Ranked, not
            rotated: the same list until the user moves or the places change. */}
        {searchResults === null && feed.forYou.length > 0 && (
          <View style={filteredSaved.length > 0 ? styles.section : undefined}>
            <ForYouHeader count={feed.forYou.length} />
            {feed.forYou.map((place, i) => (
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
          </View>
        )}

        {/* ── 3. Near you — everything else in range, best first ── */}
        {searchResults === null && feed.nearby.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title={feed.examplesOnly
                ? 'Examples'
                : fetchedThisSession
                  ? `Near you · within ${formatRadius(searchRadiusKm)}`
                  : `Near your last search · within ${formatRadius(searchRadiusKm)}`}
              icon={feed.examplesOnly ? 'sparkles-outline' : 'navigate-outline'}
              count={feed.nearby.length}
            />
            {feed.nearby.map((place, i) => (
              <PlaceCard
                key={place.placeId}
                place={place}
                index={filteredSaved.length + feed.forYou.length + i}
                onPress={handlePress}
                onSave={handleSave}
                onUnsave={unsavePlace}
                isInterestMatch={isInterestMatch(place, userInterests)}
                reason={feed.examplesOnly ? undefined : relevanceReason(
                  explainRelevance(place, categoryScores, userInterests),
                  place,
                )}
                statContext={lifeStats
                  ? getPlaceContextLine(place.category, lifeStats, profile ?? undefined) ?? undefined
                  : undefined}
              />
            ))}
          </View>
        )}

        {/* ── Nothing in range, but real places exist further out ── */}
        {searchResults === null && !feed.examplesOnly && feed.forYou.length + feed.nearby.length === 0
          && places.some((p) => !p.isSample) && searchRadiusKm < 10 && (
          <View style={styles.emptyState}>
            <Ionicons name="resize-outline" size={30} color={colors.green300} />
            <Text style={styles.emptyTitle}>Nothing within {formatRadius(searchRadiusKm)}</Text>
            <Text style={styles.emptySub}>Try a wider radius above.</Text>
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

  locationAction: {
    alignSelf:         'flex-start',
    marginTop:         spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical:   spacing[2],
    borderRadius:      radius.full,
    backgroundColor:   colors.green700,
    minHeight:         40,
    justifyContent:    'center',
  },
  locationActionText: {
    fontFamily: fontFamily.semiBold,
    fontSize:   13,
    color:      colors.white,
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

  radiusScroll: { flexGrow: 0 },
  radiusRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing[2],
    paddingHorizontal: spacing[5],
    paddingBottom:     spacing[3],
  },
  radiusLabel: {
    fontFamily: fontFamily.medium,
    fontSize:   12,
    color:      colors.textMuted,
    marginRight: spacing[1],
  },
  radiusChip: {
    paddingHorizontal: spacing[3],
    paddingVertical:   spacing[1] + 2,
    borderRadius:      radius.full,
    borderWidth:       1,
    borderColor:       colors.border,
    backgroundColor:   colors.surface,
  },
  radiusChipActive: {
    backgroundColor: colors.green700,
    borderColor:     colors.green700,
  },
  radiusChipText: {
    fontFamily: fontFamily.semiBold,
    fontSize:   11,
    color:      colors.textSecondary,
  },
  radiusChipTextActive: { color: colors.white },

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
