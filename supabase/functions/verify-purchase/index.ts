/**
 * verify-purchase — Supabase Edge Function
 *
 * The single source of truth for Pro entitlement. Nothing else may write
 * `user_data.is_pro` (a database trigger enforces that — see migration 005).
 *
 * Modes
 * ─────
 *   { purchaseToken, productId, platform }  verify a new or restored purchase
 *   { revalidate: true }                    re-check the stored receipt
 *
 * Both return: { isPro, expiresAt, productId }
 *
 * What this fixes versus the previous version
 * ───────────────────────────────────────────
 *   • It only handled Google Play, while the app shipped an iOS bundle.
 *   • It set is_pro = true and threw away the expiry, so Pro was permanent —
 *     a cancelled or refunded subscription kept working forever.
 *   • It never recorded the purchase token, so ONE valid receipt could be
 *     replayed to entitle unlimited accounts.
 *
 * Secrets
 * ───────
 *   GOOGLE_PLAY_SERVICE_ACCOUNT_KEY  service-account JSON (Play)
 *   APPLE_SHARED_SECRET              App Store shared secret (iOS, optional
 *                                    until the iOS build ships)
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PACKAGE_NAME = 'com.gati.app';
/**
 * Accepted subscription SKUs.
 *
 * Both namings are allowed because the client resolves the real ID against
 * Play at runtime — rejecting the one the console actually uses would turn a
 * successful payment into a failed verification, which is the worst possible
 * outcome (charged, then errored).
 *
 * Narrow this to the single confirmed ID once the console naming is settled.
 */
const PRODUCT_IDS = [
  'gati_pro_monthly', 'gati_pro_annual',
  'pro_monthly',      'pro_annual',
];

const JSON_HEADERS = { 'Content-Type': 'application/json' };

interface Entitlement {
  isPro:     boolean;
  expiresAt: string | null;
  productId: string | null;
  raw:       Record<string, unknown>;
}

// ─── Google Play ──────────────────────────────────────────────

/** Mint an OAuth access token from the service-account key. */
async function getGoogleAccessToken(key: Record<string, string>): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const b64url = (input: string) =>
    btoa(input).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const header  = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    iss:   key.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud:   'https://oauth2.googleapis.com/token',
    exp:   now + 3600,
    iat:   now,
  }));
  const signingInput = `${header}.${payload}`;

  const pem = key.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');

  const binaryKey = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );

  // Chunked conversion: String.fromCharCode(...bytes) blows the argument
  // limit on large signatures.
  let binary = '';
  const bytes = new Uint8Array(signature);
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  const sig = btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  `${signingInput}.${sig}`,
    }).toString(),
  });

  const data = await resp.json();
  if (!data.access_token) {
    throw new Error(`Google token exchange failed: ${JSON.stringify(data)}`);
  }
  return data.access_token as string;
}

/**
 * Validate against the Play Developer API.
 *
 * Uses subscriptionsv2, which is the supported endpoint for subscriptions with
 * base plans and offers; the v1 `purchases.subscriptions` endpoint the previous
 * version called is deprecated.
 */
async function verifyGoogle(purchaseToken: string, productId: string): Promise<Entitlement> {
  const keyJson = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT_KEY');
  if (!keyJson) throw new Error('Google Play service account is not configured');

  const accessToken = await getGoogleAccessToken(JSON.parse(keyJson));
  const url =
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
    `${PACKAGE_NAME}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;

  const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!resp.ok) {
    const body = await resp.text();
    // 404/410 means Google does not recognise this token at all.
    if (resp.status === 404 || resp.status === 410) {
      return { isPro: false, expiresAt: null, productId, raw: { status: resp.status } };
    }
    throw new Error(`Play API ${resp.status}: ${body}`);
  }

  const data = await resp.json();

  // subscriptionState: SUBSCRIPTION_STATE_ACTIVE | _IN_GRACE_PERIOD |
  // _CANCELED (still paid through the period) | _ON_HOLD | _PAUSED | _EXPIRED
  const state: string = data.subscriptionState ?? '';
  const line = Array.isArray(data.lineItems) ? data.lineItems[0] : undefined;
  const expiryRaw: string | undefined = line?.expiryTime;
  const expiresAt = expiryRaw ? new Date(expiryRaw).toISOString() : null;
  const resolvedProduct: string = line?.productId ?? productId;

  // Grace period still counts as entitled — the user is mid-payment-retry and
  // cutting them off immediately is a support ticket. CANCELED means they
  // turned off renewal but are paid through expiryTime.
  const activeState =
    state === 'SUBSCRIPTION_STATE_ACTIVE' ||
    state === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD' ||
    state === 'SUBSCRIPTION_STATE_CANCELED';

  const notExpired = expiresAt ? new Date(expiresAt).getTime() > Date.now() : false;

  // An acknowledged test purchase can be active without an expiry; require one
  // of the two signals rather than both.
  const isPro = activeState && notExpired;

  return { isPro, expiresAt, productId: resolvedProduct, raw: data };
}

// ─── Apple App Store ──────────────────────────────────────────

/**
 * Validate against Apple's verifyReceipt endpoint.
 *
 * Kept deliberately simple: Gati's iOS build is not shipping yet, but the
 * previous code had NO iOS path at all while the project shipped an iOS bundle
 * identifier and Apple Sign In — meaning an iOS purchase could never be
 * verified. Swap to the App Store Server API when iOS goes live.
 */
async function verifyApple(receipt: string, productId: string): Promise<Entitlement> {
  const sharedSecret = Deno.env.get('APPLE_SHARED_SECRET');
  if (!sharedSecret) throw new Error('Apple shared secret is not configured');

  const body = JSON.stringify({
    'receipt-data': receipt,
    password: sharedSecret,
    'exclude-old-transactions': true,
  });

  const post = (url: string) =>
    fetch(url, { method: 'POST', headers: JSON_HEADERS, body }).then((r) => r.json());

  let data = await post('https://buy.itunes.apple.com/verifyReceipt');
  // 21007: a sandbox receipt sent to production. Retry against sandbox so
  // TestFlight builds verify correctly.
  if (data.status === 21007) {
    data = await post('https://sandbox.itunes.apple.com/verifyReceipt');
  }

  if (data.status !== 0) {
    return { isPro: false, expiresAt: null, productId, raw: { status: data.status } };
  }

  const infos: Record<string, string>[] = data.latest_receipt_info ?? [];
  const relevant = infos.filter((i) => PRODUCT_IDS.includes(i.product_id));
  if (relevant.length === 0) {
    return { isPro: false, expiresAt: null, productId, raw: { reason: 'no matching product' } };
  }

  // Newest expiry wins.
  relevant.sort((a, b) => Number(b.expires_date_ms ?? 0) - Number(a.expires_date_ms ?? 0));
  const latest  = relevant[0];
  const expMs   = Number(latest.expires_date_ms ?? 0);
  const isPro   = expMs > Date.now();

  return {
    isPro,
    expiresAt: expMs ? new Date(expMs).toISOString() : null,
    productId: latest.product_id ?? productId,
    raw: { status: data.status, product_id: latest.product_id },
  };
}

// ─── Handler ──────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // ── Auth ──
  const authHeader = req.headers.get('Authorization') ?? '';
  const userJwt    = authHeader.replace(/^Bearer\s+/i, '');
  if (!userJwt) return json({ error: 'Unauthorized' }, 401);

  const { data: { user }, error: userErr } = await supabase.auth.getUser(userJwt);
  if (userErr || !user) return json({ error: 'Invalid auth token' }, 401);

  // ── Body ──
  let body: {
    purchaseToken?: string;
    productId?:     string;
    platform?:      string;
    revalidate?:    boolean;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  try {
    // ── Revalidation: re-check what we already have on file ──
    if (body.revalidate) {
      const { data: rows } = await supabase
        .from('purchases')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(5);

      if (!rows || rows.length === 0) {
        // Nothing was ever verified for this account — it is not entitled.
        await writeEntitlement(supabase, user.id, {
          isPro: false, expiresAt: null, productId: null, raw: {},
        });
        return json({ isPro: false, expiresAt: null, productId: null });
      }

      for (const row of rows) {
        const result = row.platform === 'ios'
          ? await verifyApple(row.purchase_token, row.product_id)
          : await verifyGoogle(row.purchase_token, row.product_id);

        await recordPurchase(supabase, user.id, row.purchase_token, row.platform, result);

        if (result.isPro) {
          await writeEntitlement(supabase, user.id, result);
          return json({
            isPro: true,
            expiresAt: result.expiresAt,
            productId: result.productId,
          });
        }
      }

      // Every known receipt has lapsed — revoke.
      await writeEntitlement(supabase, user.id, {
        isPro: false, expiresAt: null, productId: null, raw: {},
      });
      return json({ isPro: false, expiresAt: null, productId: null });
    }

    // ── New / restored purchase ──
    const { purchaseToken, productId } = body;
    const platform = body.platform === 'ios' ? 'ios' : 'android';

    if (!purchaseToken || !productId) {
      return json({ error: 'Missing purchaseToken or productId' }, 400);
    }
    if (!PRODUCT_IDS.includes(productId)) {
      return json({ error: 'Unknown product' }, 400);
    }

    // Replay guard: a purchase token belongs to exactly one account. Without
    // this, one valid receipt could be shared to entitle unlimited accounts.
    const { data: existing } = await supabase
      .from('purchases')
      .select('user_id')
      .eq('purchase_token', purchaseToken)
      .maybeSingle();

    if (existing && existing.user_id !== user.id) {
      return json(
        { error: 'This purchase is already linked to a different Gati account.' },
        409,
      );
    }

    const result = platform === 'ios'
      ? await verifyApple(purchaseToken, productId)
      : await verifyGoogle(purchaseToken, productId);

    await recordPurchase(supabase, user.id, purchaseToken, platform, result);

    if (!result.isPro) {
      return json(
        {
          isPro: false,
          expiresAt: result.expiresAt,
          productId: result.productId,
          error: 'This purchase is not active or has expired.',
        },
        402,
      );
    }

    await writeEntitlement(supabase, user.id, result);

    return json({
      isPro:     true,
      expiresAt: result.expiresAt,
      productId: result.productId,
    });
  } catch (e) {
    console.error('[verify-purchase]', e);
    // Never leak provider internals to the client.
    return json({ error: 'Could not verify the purchase. Please try again.' }, 500);
  }
});

// ─── Helpers ──────────────────────────────────────────────────

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });
}

/** Service-role write of the protected entitlement columns. */
async function writeEntitlement(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId:   string,
  result:   Entitlement,
): Promise<void> {
  const { error } = await supabase
    .from('user_data')
    .update({
      is_pro:         result.isPro,
      pro_expires_at: result.expiresAt,
      pro_product_id: result.productId,
      updated_at:     new Date().toISOString(),
    })
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

/** Upsert the purchase ledger row that binds a token to one account. */
async function recordPurchase(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId:   string,
  token:    string,
  platform: string,
  result:   Entitlement,
): Promise<void> {
  await supabase.from('purchases').upsert(
    {
      purchase_token: token,
      user_id:        userId,
      platform,
      product_id:     result.productId ?? 'unknown',
      expires_at:     result.expiresAt,
      is_active:      result.isPro,
      raw:            result.raw,
      updated_at:     new Date().toISOString(),
    },
    { onConflict: 'purchase_token' },
  );
}
