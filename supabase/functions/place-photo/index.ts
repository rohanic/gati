/**
 * place-photo — Supabase Edge Function
 *
 * Redirects to a Google Places photo, adding the API key server-side.
 *
 * The client used to build photo URLs with the key embedded directly:
 *   https://places.googleapis.com/v1/{name}/media?key=<KEY>
 * which published the key to anyone who inspected network traffic or the
 * bundle. Now the app requests this endpoint and we 302 to Google, so the key
 * stays a server secret while photo loading remains lazy — only the cards a
 * user actually scrolls past cost a Place Photo request.
 *
 * GET /place-photo?name=places/ChIJ.../photos/AUjq9jk...&w=480
 *
 * Secrets: GOOGLE_PLACES_KEY
 */

const MAX_WIDTH     = 1200;
const DEFAULT_WIDTH = 480;

/**
 * Google photo resource names look like:
 *   places/<PLACE_ID>/photos/<PHOTO_REF>
 * Validated strictly so this cannot be turned into an open redirect or used to
 * proxy arbitrary Google API paths with our key attached.
 */
const NAME_PATTERN = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/;

Deno.serve(async (req: Request) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405 });
  }

  const apiKey = Deno.env.get('GOOGLE_PLACES_KEY');
  if (!apiKey) return new Response('Not configured', { status: 500 });

  const url  = new URL(req.url);
  const name = url.searchParams.get('name') ?? '';
  if (!NAME_PATTERN.test(name)) {
    return new Response('Invalid photo reference', { status: 400 });
  }

  const requested = Number(url.searchParams.get('w') ?? DEFAULT_WIDTH);
  const width = Number.isFinite(requested)
    ? Math.min(MAX_WIDTH, Math.max(64, Math.round(requested)))
    : DEFAULT_WIDTH;

  const target =
    `https://places.googleapis.com/v1/${name}/media` +
    `?maxWidthPx=${width}&key=${encodeURIComponent(apiKey)}`;

  try {
    // skipHttpRedirect returns JSON containing a long-lived googleusercontent
    // URL that needs no key, so the redirect we hand the client never carries
    // the secret.
    const resp = await fetch(`${target}&skipHttpRedirect=true`, {
      signal: AbortSignal.timeout(8_000),
    });

    if (!resp.ok) return new Response('Photo unavailable', { status: 404 });

    const data = await resp.json();
    const photoUri: string | undefined = data?.photoUri;
    if (!photoUri) return new Response('Photo unavailable', { status: 404 });

    return new Response(null, {
      status: 302,
      headers: {
        Location: photoUri,
        // Let the CDN and the device cache the redirect so scrolling back up
        // a list does not re-bill a Place Photo request.
        'Cache-Control': 'public, max-age=86400, s-maxage=604800',
      },
    });
  } catch {
    return new Response('Photo unavailable', { status: 504 });
  }
});
