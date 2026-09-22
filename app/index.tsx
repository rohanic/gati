import { Redirect } from 'expo-router';
import { useUserStore } from '@/store/userStore';
import { useAuthStore } from '@/store/authStore';

/**
 * Root entry point — decides where a launch lands.
 *
 * Order matters:
 *
 *   1. Onboarding done → straight to Today. A returning user must never be
 *      shown a sign-in screen by an update.
 *   2. Never offered an account, and not signed in → the sign-in screen,
 *      once. Offering it here rather than burying it in Profile is the
 *      difference between most people knowing sync exists and almost nobody
 *      knowing.
 *   3. Otherwise → onboarding.
 *
 * The sign-in screen is genuinely skippable: an account is optional, the app
 * works fully without one, and the privacy policy says so. Anything that made
 * it mandatory here would make that claim false.
 *
 * Safe to read the stores synchronously — `app/_layout.tsx` holds the splash
 * until they have hydrated, so these values are never the defaults.
 */
export default function Index() {
  const onboardingComplete = useUserStore((s) => s.onboardingComplete);
  const authPromptSeen     = useUserStore((s) => s.authPromptSeen);
  const signedIn           = useAuthStore((s) => s.userId !== null);

  if (onboardingComplete) return <Redirect href="/(tabs)/today" />;
  if (!authPromptSeen && !signedIn) {
    return <Redirect href="/auth?first=1" />;
  }
  return <Redirect href="/onboarding/welcome" />;
}
