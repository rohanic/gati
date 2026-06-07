/**
 * Gati Design System — Spacing, Radius & Shadows
 * Base unit: 4pt grid
 */

// ─── Spacing ────────────────────────────────────────────────
export const spacing = {
  0:   0,
  1:   4,
  2:   8,
  3:   12,
  4:   16,
  5:   20,
  6:   24,
  7:   28,
  8:   32,
  10:  40,
  12:  48,
  14:  56,
  16:  64,
  20:  80,
} as const;

// ─── Border Radius ──────────────────────────────────────────
export const radius = {
  xs:   6,
  sm:   10,
  md:   14,
  lg:   18,
  xl:   22,
  '2xl': 28,
  '3xl': 36,
  full: 9999,
} as const;

// ─── Shadows (Android elevation + iOS shadow) ───────────────
export const shadow = {
  none: {
    elevation: 0,
    shadowOpacity: 0,
  },
  xs: {
    shadowColor: '#1A2E22',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  sm: {
    shadowColor: '#1A2E22',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  md: {
    shadowColor: '#1A2E22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  lg: {
    shadowColor: '#1A2E22',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 24,
    elevation: 8,
  },
  xl: {
    shadowColor: '#1A2E22',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12,
    shadowRadius: 40,
    elevation: 16,
  },
} as const;

// ─── Z-Index ─────────────────────────────────────────────────
export const zIndex = {
  base:    0,
  card:    10,
  overlay: 50,
  modal:   100,
  toast:   200,
} as const;

export type SpacingKey = keyof typeof spacing;
export type RadiusKey  = keyof typeof radius;
export type ShadowKey  = keyof typeof shadow;
