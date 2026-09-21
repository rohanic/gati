/**
 * Drop-in replacement for React Native's <Text> with a sane font-scale cap.
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 * Android lets the user scale text up to 2× (and higher with the
 * accessibility "bold/large" settings). Gati's layout is dense — stat cards,
 * the tab bar, the billing toggle, onboarding chips — and at 2× the text
 * simply clips or shoves neighbouring elements off screen.
 *
 * The usual fix is a global default, but there is no longer a way to set one:
 * React 19 ignores `defaultProps` on function components, and RN 0.86 exports
 * `Text` as a plain function component (no `.render` to patch). So the only
 * honest global is a wrapper that every screen imports instead.
 *
 * This still RESPECTS the user's setting — it just stops honouring it past the
 * point where the UI breaks. Anything passing its own `maxFontSizeMultiplier`
 * (StatCard, the Google button) keeps its own tighter value, because an
 * explicit prop in `rest` overrides the default below.
 */
import React from 'react';
import { Text as RNText, type TextProps } from 'react-native';

/**
 * 1.5× is the largest step at which every screen still lays out correctly —
 * verified against the densest surfaces (Today stat cards, the tab bar).
 */
export const DEFAULT_MAX_FONT_SCALE = 1.5;

export function Text({ maxFontSizeMultiplier, ...rest }: TextProps) {
  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? DEFAULT_MAX_FONT_SCALE}
      {...rest}
    />
  );
}

export type { TextProps };
