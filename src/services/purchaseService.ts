/**
 * Purchase service — cross-platform subscriptions via `expo-iap`.
 *
 * Replaces the previous `react-native-iap` v15 integration, which was
 * Android-only, required NitroModules (and therefore a pile of Expo Go
 * guards), and had no restore path.
 *
 * Flow:
 *   1. `initIAP()`              — opens the store connection (idempotent).
 *   2. `getSubscriptions()`     — fetches localised price/offer data.
 *   3. `purchaseSubscription()` — opens the native sheet, waits for the
 *                                 purchase event, verifies it server-side,
 *                                 then finalises the transaction.
 *   4. `restorePurchases()`     — re-verifies any purchase the store still
 *                                 holds. REQUIRED by App Store guideline
 *                                 3.1.1 and good practice on Play.
 *   5. `syncEntitlement()`      — called on launch/foreground; re-verifies
 *                                 the live subscription so a lapsed or
 *                                 refunded subscription actually loses Pro.
 *
 * Entitlement is NEVER granted from client state alone. Every path funnels
 * through `verify-purchase`, which validates the receipt with Apple/Google
 * and is the only writer of `user_data.is_pro`.
 *
 * Product IDs must match the store listings exactly:
 *   gati_pro_monthly   gati_pro_annual
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import {
  initConnection,
  endConnection,
  fetchProducts,
  requestPurchase,
  finishTransaction,
  getAvailablePurchases,
  purchaseUpdatedListener,
  purchaseErrorListener,
  deepLinkToSubscriptions,
  type Purchase,
  type ProductSubscription,
} from 'expo-iap';
import { supabase } from '@/services/supabase';
import { useUserStore } from '@/store/userStore';

// ─── Environment ──────────────────────────────────────────────
// Store kits are unavailable in Expo Go; every entry point no-ops there
// rather than throwing through the native error reporter.
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

// ─── Product IDs ──────────────────────────────────────────────
/**
 * Subscription SKUs, resolved against the store at runtime.
 *
 * A mismatch between the ID in code and the ID in Play Console is silent and
 * fatal: `fetchProducts` simply returns an empty array, so the paywall shows no
 * price and the button does nothing. There is no error to read.
 *
 * Rather than hard-coding one guess, we ask the store about every plausible ID
 * and keep whichever it actually recognises. Play ignores unknown SKUs instead
 * of failing the request, so asking for four costs nothing.
 *
 * Override explicitly once the console naming is settled:
 *   EXPO_PUBLIC_SKU_MONTHLY=pro_monthly
 *   EXPO_PUBLIC_SKU_ANNUAL=pro_annual
 */
const ENV_MONTHLY = process.env.EXPO_PUBLIC_SKU_MONTHLY;
const ENV_ANNUAL  = process.env.EXPO_PUBLIC_SKU_ANNUAL;

/** Every SKU worth asking about, most-likely first. */
export const CANDIDATE_SKUS = {
  monthly: [ENV_MONTHLY, 'gati_pro_monthly', 'pro_monthly'].filter(Boolean) as string[],
  annual:  [ENV_ANNUAL,  'gati_pro_annual',  'pro_annual' ].filter(Boolean) as string[],
} as const;

export const ALL_CANDIDATE_SKUS: string[] = [
  ...new Set([...CANDIDATE_SKUS.monthly, ...CANDIDATE_SKUS.annual]),
];

export type Plan = 'monthly' | 'annual';

/** Whatever the store confirmed, filled in by `getSubscriptions()`. */
const resolvedSku: Record<Plan, string | null> = { monthly: null, annual: null };

/** The confirmed SKU for a plan, or null until the store has answered. */
export function getResolvedSku(plan: Plan): string | null {
  return resolvedSku[plan];
}

/**
 * Back-compat shim. Prefer `getResolvedSku`, which reflects what the store
 * actually has rather than what we hoped it had.
 */
export const PRODUCT_IDS = {
  get monthly() { return resolvedSku.monthly ?? CANDIDATE_SKUS.monthly[0]; },
  get annual()  { return resolvedSku.annual  ?? CANDIDATE_SKUS.annual[0];  },
};

export type ProductId = string;

/** Thrown when the user dismissed the store sheet. Callers treat it as a no-op. */
export class PurchaseCancelledError extends Error {
  constructor() {
    super('Purchase cancelled');
    this.name = 'PurchaseCancelledError';
  }
}

/** Thrown when billing is unavailable (Expo Go, no Play Services, etc.). */
export class BillingUnavailableError extends Error {
  constructor(message = 'In-app purchases are not available on this device.') {
    super(message);
    this.name = 'BillingUnavailableError';
  }
}

// ─── Connection ───────────────────────────────────────────────

let connected = false;
let connecting: Promise<boolean> | null = null;

/**
 * Open a connection to the platform store.
 * Concurrent callers share one in-flight attempt. Returns false when billing
 * is unavailable, so callers can degrade instead of throwing.
 */
export async function initIAP(): Promise<boolean> {
  if (IS_EXPO_GO) return false;
  if (connected) return true;
  if (connecting) return connecting;

  connecting = (async () => {
    try {
      await initConnection();
      connected = true;
      return true;
    } catch {
      connected = false;
      return false;
    } finally {
      connecting = null;
    }
  })();

  return connecting;
}

/** Close the store connection. Safe to call when never opened. */
export async function destroyIAP(): Promise<void> {
  if (!connected) return;
  try {
    await endConnection();
  } catch {
    // Store already torn down — nothing to do.
  } finally {
    connected = false;
  }
}

// ─── Products ─────────────────────────────────────────────────

/**
 * Fetch subscription products with localised pricing.
 * Returns [] when billing is unavailable or the store rejects the request.
 */
export async function getSubscriptions(): Promise<ProductSubscription[]> {
  if (!(await initIAP())) return [];
  try {
    const result = (await fetchProducts({
      skus: ALL_CANDIDATE_SKUS,
      type: 'subs',
    })) as ProductSubscription[] | null;

    const products = result ?? [];

    // Record which naming the console actually uses, so purchase and restore
    // ask for the same thing the price came from.
    for (const plan of ['monthly', 'annual'] as Plan[]) {
      const match = CANDIDATE_SKUS[plan].find((sku) => products.some((p) => p.id === sku));
      if (match) resolvedSku[plan] = match;
    }

    if (__DEV__) {
      const missing = (['monthly', 'annual'] as Plan[]).filter((p) => !resolvedSku[p]);
      if (missing.length > 0) {
        console.warn(
          `[purchase] Play returned no product for: ${missing.join(', ')}.\n` +
          `  Asked for: ${ALL_CANDIDATE_SKUS.join(', ')}\n` +
          `  Got back:  ${products.map((p) => p.id).join(', ') || '(nothing)'}\n` +
          '  Check the product IDs in Play Console, that the subscription is ' +
          'ACTIVE, that the app is published to a test track, and that this ' +
          'account is a licence tester.',
        );
      }
    }

    return products;
  } catch {
    return [];
  }
}

/**
 * Localised display price for a subscription, e.g. "₹399.00" or "$4.99".
 *
 * Prefers the price of the offer the user would actually be charged (the first
 * base-plan offer) and falls back to the product-level `displayPrice`. Never
 * returns a hard-coded currency: showing a price that differs from what the
 * store charges violates both stores' pricing rules.
 *
 * `fallback` is used only when the store returned nothing at all.
 */
export function getDisplayPrice(
  sub: ProductSubscription | undefined,
  fallback: string,
): string {
  if (!sub) return fallback;
  const offers = sub.subscriptionOffers;
  if (Array.isArray(offers) && offers.length > 0) {
    const offerPrice = offers[0]?.displayPrice;
    if (offerPrice) return offerPrice;
  }
  return sub.displayPrice || fallback;
}

/** Android requires an `offerToken` to start a subscription purchase. */
function androidOfferToken(sub: ProductSubscription | undefined): string | null {
  if (!sub || Platform.OS !== 'android') return null;
  const offers = sub.subscriptionOffers;
  if (!Array.isArray(offers) || offers.length === 0) return null;
  return offers[0]?.offerTokenAndroid ?? null;
}

// ─── Server-side verification ─────────────────────────────────

export interface VerifyResult {
  /** True when the store reports an active, paid, unexpired subscription. */
  isPro:     boolean;
  /** ISO timestamp the entitlement expires, when the store reports one. */
  expiresAt: string | null;
  /** Product the entitlement came from. */
  productId: string | null;
}

/**
 * Send a purchase token to the `verify-purchase` edge function.
 *
 * The function validates the receipt with Apple/Google and is the ONLY writer
 * of `user_data.is_pro` — the client cannot grant itself Pro. The response is
 * mirrored into the local store so the UI updates immediately, but the cloud
 * row remains the source of truth on the next sync.
 */
export async function verifyPurchaseWithServer(
  purchaseToken: string,
  productId:     string,
): Promise<VerifyResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not signed in');

  const { data, error } = await supabase.functions.invoke('verify-purchase', {
    body: {
      purchaseToken,
      productId,
      platform: 'android',   // Android-only build; see app.json
    },
  });

  if (error) {
    // supabase-js surfaces non-2xx as FunctionsHttpError; pull out the body
    // so the user sees the real reason rather than "Edge Function returned
    // a non-2xx status code".
    const detail = await readFunctionError(error);
    throw new Error(detail);
  }

  const result: VerifyResult = {
    isPro:     Boolean(data?.isPro),
    expiresAt: data?.expiresAt ?? null,
    productId: data?.productId ?? productId,
  };

  useUserStore.getState().setEntitlement({
    isPro:     result.isPro,
    expiresAt: result.expiresAt,
    productId: result.productId,
  });

  return result;
}

/** Best-effort extraction of an edge-function error body. */
async function readFunctionError(error: unknown): Promise<string> {
  const ctx = (error as { context?: unknown })?.context;
  if (ctx && typeof (ctx as Response).text === 'function') {
    try {
      const body = await (ctx as Response).text();
      const parsed = JSON.parse(body) as { error?: string };
      if (parsed?.error) return parsed.error;
      if (body) return body;
    } catch {
      // Not JSON, or body already consumed — fall through.
    }
  }
  return (error as Error)?.message ?? 'Purchase verification failed';
}

// ─── Purchase ─────────────────────────────────────────────────

/** Ensures only one purchase flow is in flight at a time. */
let purchaseInFlight = false;

/**
 * Run the native purchase flow for a subscription and resolve once the
 * purchase has been verified server-side AND finalised with the store.
 *
 * Finalising matters: an Android purchase not acknowledged within three days
 * is automatically refunded, and an unfinished iOS transaction replays on
 * every launch.
 *
 * @throws {BillingUnavailableError} billing is not available here
 * @throws {PurchaseCancelledError}  the user dismissed the sheet
 */
export async function purchaseSubscription(productId: ProductId): Promise<VerifyResult> {
  if (IS_EXPO_GO) {
    throw new BillingUnavailableError(
      'In-app purchases require a development or release build — they do not run in Expo Go.',
    );
  }
  if (!(await initIAP())) {
    throw new BillingUnavailableError(
      'Could not reach the store. Check your connection and that Google Play is up to date.',
    );
  }
  if (purchaseInFlight) throw new Error('A purchase is already in progress.');
  purchaseInFlight = true;

  // Android needs the offer token that belongs to the SKU being bought.
  // Resolve against the store first — `productId` may be the placeholder
  // default if nothing has queried the store yet in this session.
  const subs   = await getSubscriptions();
  const target = subs.find((s) => s.id === productId)
              ?? subs.find((s) => CANDIDATE_SKUS.monthly.includes(s.id) && CANDIDATE_SKUS.monthly.includes(productId))
              ?? subs.find((s) => CANDIDATE_SKUS.annual.includes(s.id)  && CANDIDATE_SKUS.annual.includes(productId));

  if (!target) {
    throw new BillingUnavailableError(
      'This plan is not available from the store right now. Please try again later.',
    );
  }
  const sku        = target.id;
  const offerToken = androidOfferToken(target);

  return new Promise<VerifyResult>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      if (settled) return;
      settled = true;
      purchaseInFlight = false;
      updateSub.remove();
      errorSub.remove();
    };

    const updateSub = purchaseUpdatedListener(async (purchase: Purchase) => {
      // Ignore events for other SKUs (e.g. a queued transaction replaying).
      if (purchase.productId !== sku) return;
      try {
        const result = await completePurchase(purchase);
        cleanup();
        resolve(result);
      } catch (e) {
        cleanup();
        reject(e);
      }
    });

    const errorSub = purchaseErrorListener((error) => {
      cleanup();
      if (isUserCancelled(error)) reject(new PurchaseCancelledError());
      else reject(new Error(error?.message ?? 'Purchase failed'));
    });

    requestPurchase({
      type: 'subs',
      request: {
        apple:  { sku },
        google: {
          skus: [sku],
          ...(offerToken
            ? { subscriptionOffers: [{ sku, offerToken }] }
            : {}),
        },
      },
    }).catch((e: unknown) => {
      cleanup();
      if (isUserCancelled(e)) reject(new PurchaseCancelledError());
      else reject(e instanceof Error ? e : new Error(String(e)));
    });
  });
}

/**
 * Verify a purchase server-side, then finalise it with the store.
 * Shared by the purchase flow, restore, and the launch-time entitlement sync.
 */
async function completePurchase(purchase: Purchase): Promise<VerifyResult> {
  const token = purchase.purchaseToken;
  if (!token) throw new Error('The store did not return a purchase token.');

  const result = await verifyPurchaseWithServer(token, purchase.productId);

  // Only finalise once the server accepted the receipt. Finalising a receipt
  // the server rejected would leave the user charged with no entitlement and
  // no transaction left to retry against.
  if (result.isPro) {
    try {
      await finishTransaction({ purchase, isConsumable: false });
    } catch {
      // Already finished, or the store is briefly unavailable. The purchase
      // is verified and will replay on next launch if it truly did not stick.
    }
  }

  return result;
}

function isUserCancelled(error: unknown): boolean {
  const code = (error as { code?: string })?.code ?? '';
  const message = (error as { message?: string })?.message ?? '';
  return /cancel/i.test(code) || /cancel/i.test(message);
}

// ─── Restore ──────────────────────────────────────────────────

/**
 * Re-verify every subscription the store still holds for this account.
 *
 * Required by App Store Review Guideline 3.1.1 (a restore affordance must
 * exist for any non-consumable / auto-renewing purchase) and the correct way
 * to recover Pro after a reinstall or device change on Play.
 *
 * @returns true when an active entitlement was restored.
 */
export async function restorePurchases(): Promise<boolean> {
  if (IS_EXPO_GO) throw new BillingUnavailableError();
  if (!(await initIAP())) throw new BillingUnavailableError();

  const purchases = await getAvailablePurchases();
  const subscriptions = (purchases ?? []).filter((p) =>
    ALL_CANDIDATE_SKUS.includes(p.productId),
  );

  if (subscriptions.length === 0) {
    // Nothing held by the store. Do NOT downgrade here — the user may simply
    // be signed into a different store account than the one that paid.
    return false;
  }

  let restored = false;
  for (const purchase of subscriptions) {
    try {
      const result = await completePurchase(purchase);
      if (result.isPro) restored = true;
    } catch {
      // Try the remaining purchases before giving up.
    }
  }
  return restored;
}

// ─── Entitlement sync ─────────────────────────────────────────

/**
 * Re-check the live subscription against the store and the server.
 *
 * This is what makes Pro revocable. Called on launch and when the app returns
 * to the foreground (see `useEntitlementSync`). If the store no longer holds
 * an active subscription for a user who is currently marked Pro, we ask the
 * server to re-validate, which clears `is_pro` when the receipt has lapsed.
 *
 * Silent and best-effort — never blocks or interrupts the user.
 */
export async function syncEntitlement(): Promise<void> {
  if (IS_EXPO_GO) return;

  const { isPro, userId } = useUserStore.getState();
  // Nothing to verify or revoke for a signed-out free user.
  if (!userId) return;

  if (!(await initIAP())) return;

  try {
    const purchases = await getAvailablePurchases();
    const active = (purchases ?? []).filter((p) =>
      ALL_CANDIDATE_SKUS.includes(p.productId),
    );

    if (active.length > 0) {
      for (const purchase of active) {
        try {
          await completePurchase(purchase);
          return;
        } catch {
          // Fall through to the next purchase.
        }
      }
      return;
    }

    // Store holds nothing. If we think the user is Pro, ask the server to
    // confirm — it knows the last verified receipt and its expiry.
    if (isPro) await revalidateEntitlementWithServer();
  } catch {
    // Offline or store unavailable — keep the current entitlement. It will be
    // re-checked on the next foreground.
  }
}

/**
 * Ask the server to re-evaluate the stored receipt with no new token.
 * Used when the local device holds no purchase but is marked Pro — e.g. the
 * subscription was cancelled, refunded, or expired.
 */
export async function revalidateEntitlementWithServer(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const { data, error } = await supabase.functions.invoke('verify-purchase', {
    body: { revalidate: true },
  });
  if (error) return; // Network hiccup — do not revoke on an inconclusive answer.

  useUserStore.getState().setEntitlement({
    isPro:     Boolean(data?.isPro),
    expiresAt: data?.expiresAt ?? null,
    productId: data?.productId ?? null,
  });
}

// ─── Subscription management ──────────────────────────────────

/**
 * Open the platform's subscription management screen so the user can cancel
 * or change plan. Play policy requires an in-app route to manage or cancel.
 */
export async function openSubscriptionManagement(productId?: string): Promise<void> {
  if (IS_EXPO_GO) return;
  try {
    await deepLinkToSubscriptions({
      skuAndroid:         productId ?? PRODUCT_IDS.monthly,
      packageNameAndroid: 'com.gati.numberswanders',
    });
  } catch {
    // Deep link unsupported on this device — caller falls back to a URL.
  }
}
