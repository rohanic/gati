/**
 * Gati Design System — Typography
 * Font: Plus Jakarta Sans (geometric sans-serif)
 * Scale: 4pt-based, 11 steps
 */

export const fontFamily = {
  light:     'PlusJakartaSans_300Light',
  regular:   'PlusJakartaSans_400Regular',
  medium:    'PlusJakartaSans_500Medium',
  semiBold:  'PlusJakartaSans_600SemiBold',
  bold:      'PlusJakartaSans_700Bold',
  extraBold: 'PlusJakartaSans_800ExtraBold',
} as const;

export const fontSize = {
  xs:   10.5,
  sm:   12,
  base: 14,
  md:   16,
  lg:   19,
  xl:   22.5,
  '2xl': 26,
  '3xl': 34,
  '4xl': 45,
  '5xl': 60,
  '6xl': 75,
} as const;

// Pre-built, composable text styles — use as StyleSheet spreads
export const textStyles = {
  // ─── Display (stat numbers, hero moments) ────────────
  displayHero: {
    fontFamily: fontFamily.extraBold,
    fontSize: fontSize['6xl'],
    letterSpacing: -3,
    lineHeight: fontSize['6xl'] * 1.0,
  },
  displayLarge: {
    fontFamily: fontFamily.extraBold,
    fontSize: fontSize['5xl'],
    letterSpacing: -2.5,
    lineHeight: fontSize['5xl'] * 1.0,
  },
  displayMedium: {
    fontFamily: fontFamily.extraBold,
    fontSize: fontSize['4xl'],
    letterSpacing: -2,
    lineHeight: fontSize['4xl'] * 1.05,
  },
  displaySmall: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['3xl'],
    letterSpacing: -1.5,
    lineHeight: fontSize['3xl'] * 1.1,
  },

  // ─── Headings ─────────────────────────────────────────
  headingLarge: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
    letterSpacing: -0.8,
    lineHeight: fontSize['2xl'] * 1.2,
  },
  headingMedium: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    letterSpacing: -0.5,
    lineHeight: fontSize.xl * 1.25,
  },
  headingSmall: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    letterSpacing: -0.3,
    lineHeight: fontSize.lg * 1.3,
  },

  // ─── Body ─────────────────────────────────────────────
  bodyLarge: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: fontSize.md * 1.65,
  },
  bodyMedium: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
    lineHeight: fontSize.base * 1.65,
  },
  bodySmall: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.6,
  },
  bodyMediumMedium: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.base,
    lineHeight: fontSize.base * 1.5,
  },

  // ─── Labels & Captions ────────────────────────────────
  labelLarge: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    letterSpacing: 0.3,
    lineHeight: fontSize.sm * 1.4,
  },
  labelSmall: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xs,
    letterSpacing: 1.2,
    lineHeight: fontSize.xs * 1.4,
    textTransform: 'uppercase' as const,
  },
  caption: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    letterSpacing: 0.5,
    lineHeight: fontSize.xs * 1.4,
  },
} as const;
