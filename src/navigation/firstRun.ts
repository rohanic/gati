/**
 * First-run routing around the one-time sign-in offer.
 *
 * The offer sits between the welcome intro and the first onboarding
 * question. It is shown at most once: skipped, or signed in by any route,
 * it is marked seen and never appears again.
 */
import { router } from 'expo-router';
import { useUserStore } from '@/store/userStore';
import { useAuthStore } from '@/store/authStore';

/** True when the offer should be shown on the way out of the intro. */
export function shouldOfferSignIn(): boolean {
  const { authPromptSeen } = useUserStore.getState();
  const signedIn = useAuthStore.getState().userId !== null;
  return !authPromptSeen && !signedIn;
}

/**
 * Leave the first-run sign-in screen, forwards.
 *
 * Replaces rather than pushes, so the back gesture from the first question
 * does not land on a sign-in screen the user already dealt with.
 *
 * A sign-in that restored an existing account from the cloud has already
 * completed onboarding (see authStore._onSignIn), and that user belongs on
 * Today — sending them to the first question would have them re-enter
 * answers that would then overwrite the profile just restored.
 */
export function continueAfterFirstRunAuth(): void {
  useUserStore.getState().markAuthPromptSeen();
  const onboarded = useUserStore.getState().onboardingComplete;
  router.replace(onboarded ? '/(tabs)/today' : '/onboarding/name');
}
