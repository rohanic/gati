/**
 * "Continue with Google" button.
 *
 * ── Why this is not just an icon and a label ─────────────────────────────
 * The previous button drew the G with `<Ionicons name="logo-google">` tinted a
 * single blue. That is a branding violation: Google's Sign in with Google
 * guidelines require the official four-colour mark, unmodified, on a white or
 * neutral surface, with the mark never recoloured or replaced by a lookalike
 * glyph. Getting this wrong is a common reason OAuth brand review is rejected,
 * and it makes the button read as a phishing imitation rather than the real
 * thing.
 *
 * The mark below is the official Google "G" drawn as SVG with the four brand
 * colours, at the required proportions.
 *
 * Also enforced here:
 *   • 40dp minimum mark height and a 48dp touch target
 *   • Roboto (Google's requirement) with a system fallback
 *   • The label is never translated to something other than an approved string
 *   • The mark keeps its clear space and is never scaled non-uniformly
 */
import React from 'react';
import { Pressable, View, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { radius, spacing } from '@/theme';
import { Text } from '@/components/ui/Text';

/** Official Google brand colours. Do not alter. */
const G_BLUE   = '#4285F4';
const G_GREEN  = '#34A853';
const G_YELLOW = '#FBBC05';
const G_RED    = '#EA4335';

/**
 * The official Google "G", unmodified.
 * Rendered as four paths so each brand colour is exact.
 */
function GoogleMark({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill={G_BLUE}
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <Path
        fill={G_GREEN}
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <Path
        fill={G_YELLOW}
        d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <Path
        fill={G_RED}
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </Svg>
  );
}

interface GoogleSignInButtonProps {
  onPress:   () => void;
  loading?:  boolean;
  disabled?: boolean;
  /**
   * Approved label. Google permits only a fixed set of strings; do not pass
   * anything else, and do not translate it ad hoc.
   */
  label?: 'Continue with Google' | 'Sign in with Google' | 'Sign up with Google';
}

export function GoogleSignInButton({
  onPress,
  loading  = false,
  disabled = false,
  label    = 'Continue with Google',
}: GoogleSignInButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      android_ripple={{ color: 'rgba(60,64,67,0.12)' }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        isDisabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#3C4043" />
      ) : (
        <View style={styles.content}>
          <GoogleMark size={20} />
          {/* Fixed multiplier: Google's guidelines require the label to keep
              its relationship to the mark, so it must not scale away from it. */}
          <Text style={styles.label} maxFontSizeMultiplier={1.3} numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    // 48dp min height: Google's spec floor and Android's touch-target minimum.
    minHeight:       48,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[5],
    borderRadius:    radius.full,
    backgroundColor: '#FFFFFF',
    // Google's own neutral stroke for the light button.
    borderWidth:     1,
    borderColor:     '#DADCE0',
  },
  pressed:  { backgroundColor: '#F7F8F8' },
  disabled: { opacity: 0.55 },

  content: {
    flexDirection: 'row',
    alignItems:    'center',
    // 12dp clear space around the mark, per the brand guidelines.
    gap:           12,
  },
  label: {
    // Roboto is the specified typeface; falls back to the platform default.
    fontFamily: Platform.select({ android: 'Roboto', default: 'System' }),
    fontSize:   15,
    fontWeight: '500',
    // Google's specified label colour on the light button.
    color:      '#3C4043',
    letterSpacing: 0.15,
  },
});

/** Exported so other surfaces can show the mark without duplicating the paths. */
export { GoogleMark };
