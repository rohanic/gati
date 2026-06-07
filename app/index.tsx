import { Redirect } from 'expo-router';
import { useUserStore } from '@/store/userStore';

/**
 * Root entry point.
 * Checks onboarding state and redirects accordingly.
 * Week 2 adds the full onboarding flow at /onboarding/welcome.
 */
export default function Index() {
  const onboardingComplete = useUserStore((s) => s.onboardingComplete);

  if (onboardingComplete) {
    return <Redirect href="/(tabs)/today" />;
  }

  // Week 2: full onboarding flow enabled.
  return <Redirect href="/onboarding/welcome" />;
}
