/**
 * Sign-in.
 *
 * Version 1.2.1 (36) shipped with Google sign-in dead in two independent
 * ways, either of which alone was enough:
 *
 *   1. The build had no backend URL, so the browser opened
 *      https://placeholder.supabase.co/auth/v1/authorize.
 *   2. The client used the library's default 'implicit' OAuth flow, which
 *      returns tokens in the URL fragment — while our code waited for a
 *      `?code=` that implicit flow never sends.
 *
 * And two routing faults sat around it: a returning user on a new phone was
 * put through onboarding again (overwriting the profile just restored), and
 * one sign-in path forgot to record that the offer had been dealt with.
 */

// ── Mocks ────────────────────────────────────────────────────────────────
let mockCloud = true;
jest.mock('@/config', () => ({
  get IS_CLOUD_CONFIGURED() { return mockCloud; },
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
  IS_FREE_LAUNCH: true,
  LAUNCH_MODE: 'free',
  PRIVACY_POLICY_URL: '', TERMS_URL: '', SUPPORT_EMAIL: '',
  PLAY_STORE_URL: '', PLAY_SUBSCRIPTIONS_URL: '',
}));

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(),
}));
jest.mock('expo-auth-session', () => ({
  makeRedirectUri: () => 'gati://auth/callback',
}));

const mockPull = jest.fn();
jest.mock('@/services/cloudSync', () => ({
  pullUserData:    (...a: unknown[]) => mockPull(...a),
  pullAnnotations: jest.fn().mockResolvedValue({}),
  pushUserData:    jest.fn().mockResolvedValue(undefined),
  pushAnnotations: jest.fn().mockResolvedValue(undefined),
  deleteAccount:   jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/services/notifications', () => ({
  registerPushToken:   jest.fn().mockResolvedValue(undefined),
  unregisterPushToken: jest.fn().mockResolvedValue(undefined),
}));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: { replace: (...a: unknown[]) => mockReplace(...a), back: jest.fn(), push: jest.fn() },
}));

import { useAuthStore, CloudNotConfiguredError, isGoogleSignInInFlight } from '@/store/authStore';
import { useUserStore } from '@/store/userStore';
import { shouldOfferSignIn, continueAfterFirstRunAuth } from '@/navigation/firstRun';

const PROFILE = {
  firstName: 'Rohan', dateOfBirth: '1995-03-02', sleepHoursPerNight: 7,
  coffeeCupsPerDay: 2, phoneHoursPerDay: 5, exerciseFrequency: 'sometimes',
  mealsPerDay: 3, talkLevel: 'balanced', interestCategories: [],
  notificationTime: '09:00', isPro: false, appJoinDate: '2026-09-01',
};

function reset() {
  mockCloud = true;
  mockPull.mockReset();
  mockReplace.mockReset();
  useAuthStore.setState({ userId: null, userEmail: null });
  useUserStore.setState({ profile: null, onboardingComplete: false, authPromptSeen: false });
}
beforeEach(reset);

// ── 1. The OAuth flow ────────────────────────────────────────────────────
describe('Supabase client', () => {
  it('uses the PKCE flow, not the library default', () => {
    // Implicit flow returns #access_token=… and no code at all; our Google
    // flow reads ?code= and calls exchangeCodeForSession. Under the default,
    // every Google sign-in failed with "no sign-in code".
    //
    // Asserts on the options handed to createClient rather than building a
    // real client, which in Node 20 demands a WebSocket for realtime that
    // React Native supplies and the test runner does not.
    const createClient = jest.fn(() => ({ auth: {} }));
    jest.isolateModules(() => {
      jest.doMock('@supabase/supabase-js', () => ({ createClient }));
      jest.requireActual('@/services/supabase');
    });
    const options = (createClient.mock.calls[0] as unknown[])[2] as { auth: Record<string, unknown> };
    expect(options.auth.flowType).toBe('pkce');
    // And the session must still persist across launches.
    expect(options.auth.persistSession).toBe(true);
  });
});

// ── 2. No backend, no browser ────────────────────────────────────────────
describe('sign-in without a configured backend', () => {
  it('refuses Google instead of opening placeholder.supabase.co', async () => {
    mockCloud = false;
    const WebBrowser = require('expo-web-browser');
    await expect(useAuthStore.getState().signInWithGoogle())
      .rejects.toBeInstanceOf(CloudNotConfiguredError);
    expect(WebBrowser.openAuthSessionAsync).not.toHaveBeenCalled();
  });

  it('refuses email for the same reason', async () => {
    mockCloud = false;
    await expect(useAuthStore.getState().signInWithEmail('a@b.co'))
      .rejects.toBeInstanceOf(CloudNotConfiguredError);
  });

  it('tells the user something true and useful', () => {
    // It is the build's fault, and the rest of the app still works.
    expect(new CloudNotConfiguredError().message).toMatch(/without an account/i);
  });

  it('never leaves the in-flight flag stuck after a refusal', async () => {
    mockCloud = false;
    await useAuthStore.getState().signInWithGoogle().catch(() => {});
    expect(isGoogleSignInInFlight()).toBe(false);
  });
});

// ── 3. Restoring a returning account ─────────────────────────────────────
describe('_onSignIn', () => {
  it('marks the sign-in offer as dealt with, by every route', async () => {
    // One path (Google, returning account) used to skip this, so closing the
    // app mid-onboarding meant being asked to sign in a second time.
    mockPull.mockResolvedValue(null);
    await useAuthStore.getState()._onSignIn('u1', 'a@b.co');
    expect(useUserStore.getState().authPromptSeen).toBe(true);
  });

  it('treats a restored profile as a completed onboarding', async () => {
    // Without this a returning user on a new phone was walked through the
    // questions again, and processing.tsx then overwrote the restored profile
    // with the fresh answers.
    mockPull.mockResolvedValue({
      profile: PROFILE, unlockedStats: [], openHistoryRanges: [],
      maxStreakEver: 0, streakFreezeCount: 0, frozenDates: [],
      milestoneSeenDates: {}, seenMilestoneIds: [], savedStatIds: [],
      categoryScores: {}, trialStartedAt: '2026-09-01T00:00:00Z',
      isPro: false, proExpiresAt: null, proProductId: null,
    });
    await useAuthStore.getState()._onSignIn('u1', 'a@b.co');
    expect(useUserStore.getState().profile?.firstName).toBe('Rohan');
    expect(useUserStore.getState().onboardingComplete).toBe(true);
  });

  it('leaves onboarding alone for a brand-new account', async () => {
    mockPull.mockResolvedValue(null);
    await useAuthStore.getState()._onSignIn('u2', 'new@b.co');
    expect(useUserStore.getState().onboardingComplete).toBe(false);
  });

  it('never replaces a profile already on the device', async () => {
    useUserStore.setState({ profile: { ...PROFILE, firstName: 'Local' } as never });
    mockPull.mockResolvedValue({ profile: PROFILE, unlockedStats: [], openHistoryRanges: [],
      maxStreakEver: 0, streakFreezeCount: 0, frozenDates: [], milestoneSeenDates: {},
      seenMilestoneIds: [], savedStatIds: [], categoryScores: {},
      trialStartedAt: null, isPro: false, proExpiresAt: null, proProductId: null });
    await useAuthStore.getState()._onSignIn('u1', 'a@b.co');
    expect(useUserStore.getState().profile?.firstName).toBe('Local');
  });
});

// ── 4. Where the offer appears, and where it leads ───────────────────────
describe('first-run sign-in offer', () => {
  it('is offered to someone who has never seen it', () => {
    expect(shouldOfferSignIn()).toBe(true);
  });

  it('is never offered again once dealt with', () => {
    useUserStore.getState().markAuthPromptSeen();
    expect(shouldOfferSignIn()).toBe(false);
  });

  it('is not offered to someone already signed in', () => {
    useAuthStore.setState({ userId: 'u1' });
    expect(shouldOfferSignIn()).toBe(false);
  });

  it('continues to the first question for a new user', () => {
    continueAfterFirstRunAuth();
    expect(mockReplace).toHaveBeenCalledWith('/onboarding/name');
    expect(useUserStore.getState().authPromptSeen).toBe(true);
  });

  it('sends a restored account straight to Today', () => {
    // Their onboarding came down from the cloud; re-asking the questions
    // would overwrite it.
    useUserStore.setState({ onboardingComplete: true });
    continueAfterFirstRunAuth();
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/today');
  });
});
