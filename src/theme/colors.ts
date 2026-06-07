/**
 * Gati Design System — Color Palette
 * Forest green + warm off-white, light mode only.
 * Gold reserved strictly for streak & milestone moments.
 */

export const colors = {
  // ─── Primary Green ──────────────────────────────────
  green900: '#1B3D2A', // Darkest — wordmark, high-contrast headlines
  green700: '#2A7D4F', // Primary — buttons, active icons, key actions
  green500: '#52B788', // Mid — accents, active borders
  green300: '#95D5B2', // Light — decorative borders, inactive fills
  green100: '#D8F3DC', // Pale — card surface tints, chips
  green50:  '#EEF7F0', // Softest — hover states, subtle backgrounds

  // ─── App Backgrounds ────────────────────────────────
  background:  '#F5F5EE', // Warm off-white — main app background
  surface:     '#FFFFFF', // Pure white — cards, sheets, modals
  surface2:    '#FAFAF5', // Slightly warm — nested card surfaces
  border:      '#E4E4D8', // Default border
  borderLight: '#EEEEE6', // Subtle separator

  // ─── Text ───────────────────────────────────────────
  textPrimary:   '#1A2E22', // Main — dark green-tinted near-black
  textSecondary: '#5C7268', // Secondary — body, descriptions
  textMuted:     '#9BB5A6', // Muted — placeholders, hints, inactive tabs

  // ─── Gold — Streak & Milestone ONLY ─────────────────
  gold:         '#C9A84C',
  goldLight:    '#E8CC7A',
  goldBg:       '#FEF9EC',
  goldBorder:   '#F0DFA0',

  // ─── Semantic ───────────────────────────────────────
  error:   '#D94F4F',
  errorBg: '#FFF0F0',

  // ─── Absolute ───────────────────────────────────────
  white:       '#FFFFFF',
  black:       '#000000',
  transparent: 'transparent',
} as const;

export type ColorKey = keyof typeof colors;
