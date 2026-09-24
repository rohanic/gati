/**
 * What the place search actually sends.
 *
 * The request used to round the position to ~1.1 km and widen the radius by
 * 1.6 km to compensate. At 500 m that cannot work: Google returns its top 20
 * across the widened circle, and almost none of them fall inside the user's
 * real 500 m. These pin the request to the true position and the true radius.
 */
jest.mock('@/config', () => ({
  IS_CLOUD_CONFIGURED: true,
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
}));
jest.mock('@/services/cloudSync', () => ({ fetchGatiScores: jest.fn().mockResolvedValue({}) }));

import { fetchNearbyPlaces } from '@/services/placesService';

let lastBody: { latitude: number; longitude: number; radius: number } | null = null;
beforeEach(() => {
  lastBody = null;
  global.fetch = jest.fn(async (_url: unknown, init?: { body?: string }) => {
    lastBody = JSON.parse(String(init?.body ?? '{}'));
    return { ok: true, status: 200, json: async () => ({ places: [] }), text: async () => '' };
  }) as unknown as typeof fetch;
});

describe('nearby search request', () => {
  it('searches from the exact position, not a rounded one', async () => {
    await fetchNearbyPlaces(12.971598, 77.594562, 500);
    expect(lastBody?.latitude).toBe(12.971598);
    expect(lastBody?.longitude).toBe(77.594562);
  });

  it('asks for exactly the radius the user chose', async () => {
    for (const m of [500, 1000, 2000, 5000, 10000]) {
      await fetchNearbyPlaces(12.97, 77.59, m);
      expect(lastBody?.radius).toBe(m);
    }
  });
});
