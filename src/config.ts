/**
 * App-wide configuration read from environment variables.
 *
 * ── On EXPO_PUBLIC_* and secrets ─────────────────────────────────────────
 * `EXPO_PUBLIC_*` variables are inlined into the JS bundle at build time.
 * They are NOT secret: anyone can unzip the AAB and read them. Only put
 * values here that are safe to publish.
 *
 * The Supabase anon key is safe by design — it is meaningless without Row
 * Level Security passing, and every table has RLS enabled.
 *
 * The Google Places key is NOT safe to publish and is no longer read by the
 * client. Place search runs through the `nearby-places` edge function, which
 * holds the key as a Supabase secret. See `src/services/placesService.ts`.
 */

export const SUPABASE_URL: string =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

export const SUPABASE_ANON_KEY: string =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** True when cloud features (auth, sync, place search, billing) can work. */
export const IS_CLOUD_CONFIGURED: boolean =
  Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// ─── Launch mode ──────────────────────────────────────────────
/**
 * Whether the paywall is live.
 *
 * `'free'`  — every feature is unlocked for everyone. The paywall is hidden,
 *             nothing is gated, and the billing code stays dormant but intact.
 * `'paid'`  — trial + subscription gating is enforced as built.
 *
 * Gati v1 ships as `'free'`. The reasoning, so this is not flipped casually:
 *
 *   • There is no retention data yet. Pricing a product before you know which
 *     day people churn on is guessing, and the guess is expensive to unwind.
 *   • Play Store reviews are close to permanent. A first cohort that hits a
 *     paywall on day two leaves one-star reviews that outlive the pricing
 *     experiment that caused them.
 *   • The catalogue is 25 numbers. That is a few weeks of loop, not yet enough
 *     substance to defend a subscription to a stranger.
 *   • Billing has never run against real Play Console products. Shipping
 *     revenue-critical code that has never completed one live transaction is
 *     how you get refund threads instead of customers.
 *
 * Flipping to `'paid'` requires no code changes — only this constant, live
 * products in Play Console, and a verified end-to-end purchase.
 */
export type LaunchMode = 'free' | 'paid';

export const LAUNCH_MODE: LaunchMode =
  (process.env.EXPO_PUBLIC_LAUNCH_MODE as LaunchMode) === 'paid' ? 'paid' : 'free';

/** True while everything is free for everyone. */
export const IS_FREE_LAUNCH = LAUNCH_MODE === 'free';

// ─── Legal & support ──────────────────────────────────────────
/**
 * Both stores require a reachable privacy policy URL, and Play additionally
 * requires an account-deletion route to be discoverable from the store
 * listing. Override per-build with EXPO_PUBLIC_* if the domain changes.
 *
 * These pages MUST be live before submission — a 404 here is a guaranteed
 * review rejection.
 */
export const PRIVACY_POLICY_URL: string =
  process.env.EXPO_PUBLIC_PRIVACY_URL ?? 'https://creaeza.com/gati-privacy';

export const TERMS_URL: string =
  process.env.EXPO_PUBLIC_TERMS_URL ?? 'https://creaeza.com/gati-terms';

/** Shown in Profile → Help. Use a role address, never a personal inbox. */
export const SUPPORT_EMAIL: string =
  process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? 'contact@creaeza.com';

/** Play Store listing, used by the "Rate Gati" action. */
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.gati.numberswanders';

/** Public summary of the Play Data Safety declaration. */
export const DATA_SAFETY_URL: string =
  process.env.EXPO_PUBLIC_DATA_SAFETY_URL ?? 'https://creaeza.com/gati-data-safety';

/**
 * Account + data deletion instructions.
 * Submitted to Play Console as the Data safety deletion URL, and linked from
 * Profile so the in-app and store routes agree.
 */
export const ACCOUNT_DELETION_URL: string =
  process.env.EXPO_PUBLIC_DELETION_URL ?? 'https://creaeza.com/gati-account-deletion';

/** Play's subscription centre, used as a fallback for managing a subscription. */
export const PLAY_SUBSCRIPTIONS_URL =
  'https://play.google.com/store/account/subscriptions?package=com.gati.numberswanders';

if (__DEV__) {
  if (!IS_CLOUD_CONFIGURED) {
    console.warn(
      '[config] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are not set. ' +
      'Auth, cloud backup, place search and billing will be disabled.',
    );
  }
}
