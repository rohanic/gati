import { Redirect } from 'expo-router';
import { useUserStore } from '@/store/userStore';

/**
 * Root entry point — decides where a launch lands.
 *
 *   Onboarding done → Today. A returning user never sees the intro or the
 *   sign-in offer again.
 *   Otherwise       → the welcome intro.
 *
 * The one-time sign-in offer is NOT made here. It used to be, which put a
 * sign-in screen in front of people before they had seen anything of the
 * app. It now follows the welcome intro — see onboarding/welcome.tsx and
 * src/navigation/firstRun.ts.
 *
 * Safe to read the store synchronously: app/_layout.tsx holds the splash
 * until it has hydrated, so this is never the default value.
 */
export default function Index() {
  const onboardingComplete = useUserStore((s) => s.onboardingComplete);
  return <Redirect href={onboardingComplete ? '/(tabs)/today' : '/onboarding/welcome'} />;
}
