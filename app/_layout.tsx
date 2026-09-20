import { useEffect, useRef } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, LogBox, AppState, type AppStateStatus } from 'react-native';
import Constants from 'expo-constants';
import { ErrorBoundary } from '@/components/ui';
import type * as NotificationsType from 'expo-notifications';
import { supabase }      from '@/services/supabase';
import { useAuthStore }  from '@/store/authStore';
import { startClock }    from '@/store/clockStore';
import { useUserStore, useStatsStore, useStoresHydrated } from '@/store/userStore';
import { configureNotificationHandler, ensureAndroidChannels } from '@/services/notifications';
import { syncEntitlement } from '@/services/purchaseService';
import {
  useFonts,
  PlusJakartaSans_300Light,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';

// Hold the splash until fonts AND persisted stores are ready.
SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden (fast refresh) — harmless.
});

LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications',
  '`expo-notifications` functionality is not fully supported in Expo Go',
]);

const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

function getNotifications(): typeof NotificationsType {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-notifications');
}

// Foreground presentation must be configured before the first notification
// can arrive, so do it at module scope rather than inside an effect.
configureNotificationHandler();

export default function RootLayout() {
  const router         = useRouter();
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const storesHydrated = useStoresHydrated();

  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_300Light,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  const fontsSettled = fontsLoaded || Boolean(fontError);
  // Gating on hydration matters: Zustand's persist middleware reads
  // AsyncStorage asynchronously, so the first render sees default state.
  // Routing on `onboardingComplete` before that resolves would bounce a
  // returning user straight back into onboarding.
  const appReady = fontsSettled && storesHydrated;

  // ── Hide the splash once the app can render truthfully ────────────────
  useEffect(() => {
    if (appReady) SplashScreen.hideAsync().catch(() => {});
  }, [appReady]);

  // ── Clock ─────────────────────────────────────────────────────────────
  useEffect(() => {
    // Drives the reactive tick that recomputes trial boundaries and daily
    // stat unlocks without needing a remount.
    startClock();
    ensureAndroidChannels().catch(() => {});
  }, []);

  // ── Supabase session ──────────────────────────────────────────────────
  useEffect(() => {
    restoreSession().catch(() => {});

    // supabase-js holds an internal auth lock while this callback runs, so we
    // do NOT await any Supabase call inside it — the previous version invoked
    // a full cloud pull + push here, on every event including hourly
    // TOKEN_REFRESHED, which both hammered the network and risked a deadlock.
    //
    // Record the session synchronously and defer the heavy work to a later
    // tick, only for events that represent a genuine new sign-in.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const auth = useAuthStore.getState();

      if (!session?.user) {
        if (event === 'SIGNED_OUT') {
          useUserStore.getState().setUserId(null);
        }
        return;
      }

      const { id, email } = session.user;
      const isNewUser = auth.userId !== id;
      auth.setSession(id, email ?? null);

      // Only a genuinely new user id needs the cloud restore + push. Token
      // refreshes for the already-active user are a no-op.
      if (event === 'SIGNED_IN' && isNewUser) {
        setTimeout(() => {
          useAuthStore.getState()._onSignIn(id, email ?? null).catch(() => {});
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, [restoreSession]);

  // ── Streak: record the open, app-wide ─────────────────────────────────
  // Runs once the stores have hydrated (so `onboardingComplete` is truthful)
  // and again whenever the app returns to the foreground, so a user who
  // crosses midnight on any tab still gets the day counted. `recordOpen` is
  // idempotent per calendar day.
  useEffect(() => {
    if (!storesHydrated) return;

    const record = () => {
      if (useUserStore.getState().onboardingComplete) {
        useStatsStore.getState().recordOpen();
      }
    };
    record();

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') record();
    });
    return () => sub.remove();
  }, [storesHydrated]);

  // ── Entitlement: re-verify against the store ──────────────────────────
  // This is what makes Pro revocable. Without it a cancelled or refunded
  // subscription kept working forever, because nothing ever re-checked the
  // receipt after the initial purchase.
  useEffect(() => {
    if (!storesHydrated) return;

    let lastCheck = 0;
    const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // at most every 6 hours

    const check = () => {
      if (Date.now() - lastCheck < CHECK_INTERVAL_MS) return;
      lastCheck = Date.now();
      syncEntitlement().catch(() => {});
    };
    check();

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') check();
    });
    return () => sub.remove();
  }, [storesHydrated]);

  // ── Notification taps ─────────────────────────────────────────────────
  const coldLaunchHandled = useRef(false);

  useEffect(() => {
    if (IS_EXPO_GO) return;
    // Wait for the navigation tree to exist before routing anywhere.
    if (!appReady) return;

    const N = getNotifications();

    function routeNotification(data: Record<string, unknown> | undefined) {
      const type   = data?.type   as string | undefined;
      const statId = data?.statId as string | undefined;

      if (type === 'daily_stat' && statId) {
        router.push(`/stat/${statId}`);
        return;
      }
      if (
        type === 'daily_stat' ||
        type === 'streak_saver' ||
        type === 'weekly_digest' ||
        type === 'milestone_prediction'
      ) {
        router.push('/(tabs)/today');
      }
    }

    // Cold launch: the app was not running when the notification was tapped.
    if (!coldLaunchHandled.current) {
      coldLaunchHandled.current = true;
      N.getLastNotificationResponseAsync()
        .then((response) => {
          if (!response) return;
          routeNotification(
            response.notification.request.content.data as Record<string, unknown>,
          );
        })
        .catch(() => {});
    }

    // Warm tap.
    const sub = N.addNotificationResponseReceivedListener((response) => {
      routeNotification(
        response.notification.request.content.data as Record<string, unknown>,
      );
    });

    return () => sub.remove();
  }, [appReady, router]);

  // Splash stays visible until fonts and persisted state are both ready.
  if (!appReady) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <ErrorBoundary>
        {/* Android 15+ enforces edge-to-edge: `backgroundColor` and
            `translucent` are no longer honoured and were removed from
            StatusBarProps in RN 0.86. The window background comes from
            expo-system-ui (see app.json). */}
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Screen name="index" />

          <Stack.Screen
            name="onboarding"
            options={{ animation: 'slide_from_right' }}
          />

          <Stack.Screen name="(tabs)" />

          <Stack.Screen
            name="milestone"
            options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
          />
          <Stack.Screen
            name="pro"
            options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
          />
          <Stack.Screen
            name="stat/[statId]"
            options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
          />
          <Stack.Screen
            name="auth"
            options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
          />
        </Stack>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
