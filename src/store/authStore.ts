/**
 * Auth store — Supabase session state + cloud sync coordination.
 *
 * Not persisted by Zustand: Supabase's own AsyncStorage adapter owns session
 * persistence. This store is a reactive layer on top of that session.
 *
 * Sign-in flows:
 *   signInWithEmail → verifyOtp   (6-digit code)
 *   signInWithGoogle              (system browser → PKCE code exchange)
 *
 * All of them converge on `_onSignIn`, which restores cloud data and then
 * pushes local state back up.
 *
 * IMPORTANT: `_onSignIn` performs real network work and must NOT be called
 * from inside `supabase.auth.onAuthStateChange`. That callback runs while
 * supabase-js holds its internal auth lock; awaiting another Supabase call
 * inside it can deadlock. `app/_layout.tsx` therefore only records the
 * session synchronously there and schedules `_onSignIn` on a later tick, and
 * only for events that represent a genuine new sign-in.
 */
import { create } from 'zustand';
import { Platform, Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase }         from '@/services/supabase';
import { IS_CLOUD_CONFIGURED } from '@/config';
import {
  pushUserData, pullUserData, pushAnnotations, pullAnnotations, deleteAccount,
} from '@/services/cloudSync';
import { useUserStore, useStatsStore, useWanderStore } from '@/store/userStore';
import { useStoryStore }    from '@/store/storyStore';
import { registerPushToken, unregisterPushToken } from '@/services/notifications';

// Required for expo-web-browser OAuth redirect handling.
WebBrowser.maybeCompleteAuthSession();

/**
 * Raised when Google OAuth fails for a reason the user cannot fix.
 *
 * Kept separate from a normal Error so the UI can show the plain sentence
 * and keep the configuration detail out of the user's way while still
 * logging it — every one of these used to surface as the button doing
 * nothing at all.
 */
/**
 * The build has no backend configured — EXPO_PUBLIC_SUPABASE_URL was empty
 * when the bundle was produced. Never the user's fault, and nothing on the
 * device can fix it, so the UI says so plainly rather than retrying.
 */
export class CloudNotConfiguredError extends Error {
  constructor() {
    super('Sign-in is unavailable in this version of Gati. Everything else works without an account.');
    this.name = 'CloudNotConfiguredError';
  }
}

export class GoogleSignInConfigError extends Error {
  readonly detail: string;
  constructor(message: string, detail: string) {
    super(message);
    this.name   = 'GoogleSignInConfigError';
    this.detail = detail;
  }
}

// ─── State shape ──────────────────────────────────────────────

export interface AuthState {
  userId:       string | null;
  userEmail:    string | null;
  isSyncing:    boolean;
  lastSyncedAt: string | null;
  syncError:    string | null;

  /** Restore the Supabase session from AsyncStorage. Call once on app mount. */
  restoreSession:   () => Promise<void>;
  /** Step 1: send a 6-digit OTP to the email address. */
  signInWithEmail:  (email: string) => Promise<void>;
  /** Step 2: verify the OTP. Resolves true on a first-ever login. */
  verifyOtp:        (email: string, token: string) => Promise<boolean>;
  /** Google OAuth via the system browser. Resolves true on a first-ever login. */
  signInWithGoogle: () => Promise<boolean>;
  signOut:          () => Promise<void>;
  /** Permanently delete the account and all server data, then sign out. */
  deleteAccountAndSignOut: () => Promise<void>;
  /** Push all local store data to the cloud. */
  syncNow:          () => Promise<void>;
  /** Record a session without any network work. Safe inside auth callbacks. */
  setSession:       (userId: string, email: string | null) => void;
  /** Full sign-in: cloud restore + push. Never call from an auth callback. */
  _onSignIn:        (userId: string, email: string | null) => Promise<boolean>;
}

// ─── Store ────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>()((set, get) => ({
  userId:       null,
  userEmail:    null,
  isSyncing:    false,
  lastSyncedAt: null,
  syncError:    null,

  // ── Session ────────────────────────────────────────────────

  setSession: (userId, email) => {
    if (get().userId === userId) return;   // no-op: avoids a pointless render
    set({ userId, userEmail: email });
    useUserStore.getState().setUserId(userId);
  },

  restoreSession: async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        const { id, email } = data.session.user;
        get().setSession(id, email ?? null);
      }
    } catch {
      // Network error or unconfigured URL — fail silently.
    }
  },

  // ── Email OTP ──────────────────────────────────────────────

  signInWithEmail: async (email) => {
    if (!IS_CLOUD_CONFIGURED) throw new CloudNotConfiguredError();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    if (error) throw new Error(error.message);
  },

  verifyOtp: async (email, token) => {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });
    if (error) throw new Error(error.message);
    if (data.user) {
      return get()._onSignIn(data.user.id, data.user.email ?? null);
    }
    return false;
  },

  // ── Google OAuth ───────────────────────────────────────────

  signInWithGoogle: async () => {
    // Refuse outright when the build has no backend. Without this, a build
    // compiled without EXPO_PUBLIC_SUPABASE_URL opened
    // https://placeholder.supabase.co/auth/v1/authorize in the browser — a
    // dead page, with no hint that the cause was the build, not the user.
    if (!IS_CLOUD_CONFIGURED) throw new CloudNotConfiguredError();

    googleInFlight = true;
    try {
      return await runGoogleSignIn(get);
    } finally {
      googleInFlight = false;
    }
  },

  // ── Sign out ───────────────────────────────────────────────
  // (Google flow body lives in runGoogleSignIn, below the store.)

  signOut: async () => {
    const { userId } = get();
    // Drop the push token first, while the session is still valid, so the
    // server stops pushing to a device that is no longer signed in.
    if (userId) await unregisterPushToken(userId).catch(() => {});

    await supabase.auth.signOut();
    set({ userId: null, userEmail: null, lastSyncedAt: null, syncError: null });
    useUserStore.getState().setUserId(null);
    // Clear ACCOUNT-bound entitlement so a paid account never leaks to the
    // next account on this device. The device-level trial anchor survives, so
    // signing out is not a way to farm fresh trials.
    useUserStore.getState().resetProStatus();
  },

  deleteAccountAndSignOut: async () => {
    await deleteAccount();
    // The server row is gone; clear the local session and entitlement.
    try { await supabase.auth.signOut(); } catch { /* session already void */ }
    set({ userId: null, userEmail: null, lastSyncedAt: null, syncError: null });
    useUserStore.getState().setUserId(null);
    useUserStore.getState().resetProStatus();
  },

  // ── Sync ───────────────────────────────────────────────────

  syncNow: async () => {
    const { userId, isSyncing } = get();
    if (!userId || isSyncing) return;
    set({ isSyncing: true, syncError: null });
    try {
      const userState   = useUserStore.getState();
      const statsState  = useStatsStore.getState();
      const wanderState = useWanderStore.getState();
      const storyState  = useStoryStore.getState();

      if (!userState.profile) throw new Error('No profile to sync');

      await Promise.all([
        pushUserData(userId, {
          profile:            userState.profile,
          categoryScores:     wanderState.categoryScores,
          unlockedStats:      statsState.unlockedStats,
          openHistoryRanges:  statsState.openHistoryRanges,
          maxStreakEver:      statsState.maxStreakEver,
          streakFreezeCount:  statsState.streakFreezeCount,
          frozenDates:        statsState.frozenDates,
          milestoneSeenDates: statsState.milestoneSeenDates,
          seenMilestoneIds:   statsState.seenMilestoneIds,
          savedStatIds:       statsState.savedStatIds,
          // Entitlement columns are deliberately absent — server-owned.
        }),
        pushAnnotations(userId, storyState.annotations),
      ]);

      set({ lastSyncedAt: new Date().toISOString() });
    } catch (e) {
      set({ syncError: (e as Error).message });
      throw e;
    } finally {
      set({ isSyncing: false });
    }
  },

  // ── Internal: full sign-in ─────────────────────────────────

  _onSignIn: async (userId, email) => {
    get().setSession(userId, email);
    // Signed in by any route is "done" — the offer is never shown again.
    // Marked here rather than in each screen's success handler, because one of
    // those handlers (the Google returning-user path) forgot to, and anyone who
    // took that path and closed the app before finishing onboarding was asked
    // to sign in a second time.
    useUserStore.getState().markAuthPromptSeen();

    let isFirstLogin = false;

    // Best-effort cloud restore — never blocks the UI or loses local data.
    try {
      const [cloudData, cloudAnnotations] = await Promise.all([
        pullUserData(userId),
        pullAnnotations(userId),
      ]);

      if (cloudData) {
        // Restore the profile only on a fresh install (no local profile).
        if (!useUserStore.getState().profile && cloudData.profile) {
          useUserStore.getState().setProfile(cloudData.profile);
          // A restored profile IS a completed onboarding. setProfile alone left
          // onboardingComplete false, so a returning user on a new phone was
          // walked through the questions again — and processing.tsx then
          // called setProfile with the fresh answers, overwriting the profile
          // this block had just restored from the cloud.
          useUserStore.getState().setOnboardingDone();
        }
        useStatsStore.getState().importStatsData({
          unlockedStats:      cloudData.unlockedStats,
          openHistoryRanges:  cloudData.openHistoryRanges,
          maxStreakEver:      cloudData.maxStreakEver,
          streakFreezeCount:  cloudData.streakFreezeCount,
          frozenDates:        cloudData.frozenDates,
          milestoneSeenDates: cloudData.milestoneSeenDates,
          seenMilestoneIds:   cloudData.seenMilestoneIds,
          savedStatIds:       cloudData.savedStatIds,
        });
        useWanderStore.getState().importCategoryScores(cloudData.categoryScores);
        // Entitlement comes straight from the server-owned columns. Unlike the
        // previous "merge, never downgrade" logic, this accepts downgrades —
        // that is how a cancelled or refunded subscription actually loses Pro.
        useUserStore.getState().importEntitlement(
          cloudData.trialStartedAt,
          cloudData.isPro,
          cloudData.proExpiresAt,
          cloudData.proProductId,
        );
        isFirstLogin = !cloudData.trialStartedAt && !cloudData.isPro;
      } else {
        isFirstLogin = true;
      }

      if (Object.keys(cloudAnnotations).length > 0) {
        useStoryStore.getState().importAnnotations(cloudAnnotations);
      }
    } catch (e) {
      // Non-critical: local data is intact.
      if (__DEV__) console.warn('[authStore] Cloud restore failed:', e);
    }

    // The trial is started at onboarding (see onboarding/complete.tsx) so it
    // is available to users who never sign in. This call is only a safety net
    // for accounts created before that, and is a no-op once a device anchor
    // exists — which is what stops sign-out/sign-up trial farming.
    useUserStore.getState().startTrial();

    // Push local state up. The first push also creates the cloud row, whose
    // trial_started_at the database stamps server-side.
    try {
      await get().syncNow();
    } catch {
      // syncNow already recorded syncError; never throw out of sign-in.
    }

    // Register this device for server-side push.
    registerPushToken(userId).catch(() => {});

    return isFirstLogin;
  },
}));

/** URL parsing that never throws on a malformed callback. */
function safeParseUrl(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

// ─── Google OAuth flow ────────────────────────────────────────

/**
 * True while signInWithGoogle is running.
 *
 * Read by app/auth/callback.tsx. Expo Router turns the OAuth redirect into a
 * navigation to /auth/callback even while this function is still awaiting
 * that same redirect; the route uses this to tell the two cases apart — a
 * live sign-in (step aside, this function finishes the job) versus a cold
 * start after Android killed the app in the browser (nothing is waiting, so
 * the route has to finish the exchange itself).
 */
let googleInFlight = false;
export function isGoogleSignInInFlight(): boolean {
  return googleInFlight;
}

async function runGoogleSignIn(getState: () => AuthState): Promise<boolean> {
  const redirectUri = makeRedirectUri({ scheme: 'gati', path: 'auth/callback' });
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options:  { redirectTo: redirectUri, skipBrowserRedirect: true },
  });
  if (error) throw new Error(error.message);
  if (!data.url) throw new Error('No OAuth URL returned from Supabase');

  // On Android, Chrome Custom Tabs deliver the callback through Linking
  // rather than the browser result — register the listener BEFORE opening
  // the browser so the event cannot be missed.
  //
  // Match against the redirect URI we actually asked for rather than a
  // hard-coded "gati://": in a dev client that URI is an exp:// address, so
  // a hard-coded scheme silently drops every callback outside a release
  // build and makes sign-in look broken only in development.
  let resolveLink: ((url: string) => void) | null = null;
  const linkingPromise = new Promise<string>((resolve) => { resolveLink = resolve; });
  const sub = Linking.addEventListener('url', ({ url }) => {
    if (url.startsWith(redirectUri) || url.startsWith('gati://auth/callback')) {
      resolveLink?.(url);
    }
  });

  let callbackUrl:  string | null = null;
  let userCancelled = false;
  try {
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
    if (result.type === 'success') {
      callbackUrl = result.url;
    } else if (result.type === 'cancel') {
      // Explicit back-out. Distinct from 'dismiss', which on Android is
      // also what happens when the redirect closes the Custom Tab.
      userCancelled = true;
    } else if (Platform.OS === 'android') {
      // 'dismiss' usually means the redirect already fired and the tab
      // closed itself. Wait for the deep link rather than assuming.
      //
      // 1.5s was too tight: when the OS has to cold-resume the app the
      // event can arrive later than that, and the old timeout turned a
      // successful sign-in into a silent no-op. This only ever waits when
      // no link has arrived, so a real cancel still returns promptly.
      callbackUrl = await Promise.race([
        linkingPromise,
        new Promise<null>((r) => setTimeout(() => r(null), 4_000)),
      ]);
    }
  } finally {
    sub.remove();
  }

  if (userCancelled) return false;

  if (!callbackUrl) {
    // The browser closed without ever handing back a URL. This is NOT the
    // same as cancelling, and reporting it as one is why a misconfigured
    // redirect looks like "tapping the button does nothing".
    throw new GoogleSignInConfigError(
      'Google did not send you back to Gati.',
      `No redirect to ${redirectUri} was received.\n` +
      'Add it under Supabase → Authentication → URL Configuration → ' +
      'Redirect URLs, then try again.',
    );
  }

  const parsed = safeParseUrl(callbackUrl);
  const code   = parsed?.searchParams.get('code');
  if (!code) {
    const errDesc = parsed?.searchParams.get('error_description');
    if (errDesc) throw new Error(errDesc);
    // Came back, but with no authorisation code — the redirect resolved to
    // something that is not the OAuth callback. Always a configuration
    // problem, never a user action.
    throw new GoogleSignInConfigError(
      'Google sent Gati back without a sign-in code.',
      `Returned to: ${parsed?.origin ?? callbackUrl}\n` +
      'Check that the Google provider\'s redirect URI in Google Cloud is ' +
      'the Supabase callback, and that gati://auth/callback is allow-listed ' +
      'in Supabase.',
    );
  }

  const { data: sessionData, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw new Error(exchangeError.message);
  if (sessionData.user) {
    return getState()._onSignIn(sessionData.user.id, sessionData.user.email ?? null);
  }
  return false;
}
