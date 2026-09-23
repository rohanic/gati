/**
 * Sign-in screen — Phase 1 Cloud Backup auth entry point.
 *
 * Three paths:
 *   1. Email OTP  — universally available; sends a 6-digit code
 *   3. Google     — opens system browser via expo-web-browser
 *
 * Auth is opt-in (not a gate). A "Skip for now" link always dismisses
 * this screen without signing in.
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { GoogleSignInButton } from '@/components/ui';
import { useAuthStore, GoogleSignInConfigError, CloudNotConfiguredError } from '@/store/authStore';
import { continueAfterFirstRunAuth } from '@/navigation/firstRun';
import { colors, spacing, radius, fontFamily } from '@/theme';
import { Text } from '@/components/ui/Text';

export default function AuthScreen() {
  /**
   * `first=1` means this is the one-time offer shown after the splash, before
   * onboarding. In that mode there is nothing behind this screen to go back
   * to, so every exit has to move FORWARD into onboarding rather than call
   * router.back() on an empty stack.
   */
  const { first } = useLocalSearchParams<{ first?: string }>();
  const firstRun  = first === '1';

  /** The only way out of the first-run screen: remember it, then continue. */
  const leaveFirstRun = useCallback(() => {
    continueAfterFirstRunAuth();
  }, []);

  const [email,            setEmail]           = useState('');
  const [loadingEmail,     setLoadingEmail]     = useState(false);
  const [loadingGoogle,    setLoadingGoogle]    = useState(false);

  // Android-only build: Google and email OTP are the two routes in. Apple Sign
  // In is required by Apple only when other social logins are offered on iOS,
  // and this app does not ship to iOS.
  const signInWithEmail  = useAuthStore((s) => s.signInWithEmail);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);

  // ── Email OTP ───────────────────────────────────────────────
  const handleContinue = useCallback(async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes('@')) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }
    setLoadingEmail(true);
    try {
      await signInWithEmail(trimmed);
      router.push({
        pathname: '/auth/verify',
        params:   { email: trimmed, ...(firstRun ? { first: '1' } : {}) },
      });
    } catch (e) {
      const raw = (e as Error).message ?? '';
      // Supabase can throw raw HTTP response strings on 5xx errors — show a clean message
      const friendly =
        raw.includes('rate limit') || raw.includes('429')
          ? 'Too many attempts. Please wait a few minutes and try again.'
          : raw.includes('500') || raw.includes('sending')
          ? 'Could not send the code right now. Check your email setup in Supabase or try again shortly.'
          : raw.includes('@') || raw.length < 120
          ? raw
          : 'Could not send code. Please try again.';
      Alert.alert('Sign-in failed', friendly);
    } finally {
      setLoadingEmail(false);
    }
  }, [email, signInWithEmail, firstRun]);

  // ── Google OAuth ────────────────────────────────────────────
  const handleGoogle = useCallback(async () => {
    setLoadingGoogle(true);
    try {
      const isFirst = await signInWithGoogle();
      // signInWithGoogle returns false for BOTH "returning user" and "cancelled".
      // Disambiguate via the session: userId is only set when sign-in completed.
      // Without this, cancelling the browser dismissed the screen as if signed in.
      if (useAuthStore.getState().userId === null) return; // cancelled → stay on screen
      if (isFirst) {
        router.replace({ pathname: '/auth/welcome', params: firstRun ? { first: '1' } : {} });
      } else if (firstRun) {
        continueAfterFirstRunAuth();
      } else {
        router.back();
      }
    } catch (e) {
      if (e instanceof CloudNotConfiguredError) {
        Alert.alert('Sign-in unavailable', e.message);
        return;
      }
      if (e instanceof GoogleSignInConfigError) {
        // The setup is wrong, not the user. Say so plainly and log the fix,
        // rather than leaving the button looking inert.
        console.warn(`[auth] Google sign-in misconfigured.\n${e.detail}`);
        Alert.alert(
          'Could not finish signing in',
          `${e.message}\n\nYou can use email instead, or continue without an account.`,
        );
      } else {
        Alert.alert('Google Sign In failed', (e as Error).message ?? 'Try again.');
      }
    } finally {
      setLoadingGoogle(false);
    }
  }, [signInWithGoogle]);

  const anyLoading = loadingEmail || loadingGoogle;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Close button ──
              Hidden on first run: there is nothing behind this screen, and an
              X that leads nowhere is worse than no X. The skip at the bottom
              is the exit there. */}
          {!firstRun && (
            <Pressable
              style={styles.closeBtn}
              hitSlop={12}
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          )}

          {/* ── Header ── */}
          <View style={styles.header}>
            <View style={styles.logoMark}>
              <Ionicons name="leaf" size={26} color={colors.green700} />
            </View>
            {/* First run has no history to protect yet, so "keep your
                memories safe" means nothing there. Say what an account is
                actually for — and that it is optional — before asking. */}
            <Text style={styles.headline}>
              {firstRun ? 'Welcome to Gati' : 'Keep your memories safe'}
            </Text>
            <Text style={styles.subhead}>
              {firstRun
                ? 'An account is optional. Gati works completely without one, and everything stays on your phone. Sign in only if you want your numbers and places to survive a new phone.'
                : 'Sign in to back up your stats, notes, and place history across devices. Your data stays private — only you can see it.'}
            </Text>
          </View>

          {/* ── Email input ── */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email address</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              returnKeyType="done"
              onSubmitEditing={handleContinue}
              editable={!anyLoading}
            />
          </View>

          <Pressable
            style={[styles.primaryBtn, anyLoading && styles.btnDisabled]}
            onPress={handleContinue}
            disabled={anyLoading}
          >
            {loadingEmail
              ? <ActivityIndicator size="small" color={colors.white} />
              : <Text style={styles.primaryBtnText}>Continue with email</Text>
            }
          </Pressable>

          {/* ── Divider ── */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* ── Google Sign In ──
              Uses the shared compliant button: official four-colour mark,
              approved label, 48dp target. Do not inline a tinted glyph here. */}
          <GoogleSignInButton
            onPress={handleGoogle}
            loading={loadingGoogle}
            disabled={anyLoading}
          />

          {/* ── Skip ──
              Prominent and plainly worded on first run: the app genuinely
              works without an account, and a skip that reads like a dead end
              would misrepresent that. */}
          <Pressable
            style={[styles.skipBtn, firstRun && styles.skipBtnFirstRun]}
            onPress={firstRun ? leaveFirstRun : () => router.back()}
            accessibilityRole="button"
            android_ripple={firstRun ? { color: colors.green50 } : undefined}
          >
            <Text style={[styles.skipText, firstRun && styles.skipTextFirstRun]}>
              {firstRun ? 'Continue without an account' : 'Skip for now'}
            </Text>
          </Pressable>

          <Text style={styles.legalNote}>
            By continuing you agree to Gati's Terms of Service and Privacy Policy.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: colors.background },
  kav:   { flex: 1 },
  scroll: {
    flexGrow:          1,
    paddingHorizontal: spacing[5],
    paddingBottom:     spacing[8],
  },

  closeBtn: {
    alignSelf:  'flex-end',
    marginTop:  spacing[4],
    padding:    spacing[1],
  },

  header: {
    alignItems: 'center',
    marginTop:  spacing[6],
    marginBottom: spacing[7],
    gap:        spacing[3],
  },
  logoMark: {
    width:           52,
    height:          52,
    borderRadius:    radius.full,
    backgroundColor: colors.green50,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    spacing[1],
  },
  headline: {
    fontFamily:    fontFamily.bold,
    fontSize:      22,
    color:         colors.textPrimary,
    textAlign:     'center',
    letterSpacing: -0.3,
  },
  subhead: {
    fontFamily: fontFamily.regular,
    fontSize:   14,
    color:      colors.textSecondary,
    textAlign:  'center',
    lineHeight: 21,
  },

  inputGroup: { gap: spacing[2], marginBottom: spacing[3] },
  inputLabel: {
    fontFamily: fontFamily.medium,
    fontSize:   13,
    color:      colors.textSecondary,
  },
  input: {
    fontFamily:      fontFamily.regular,
    fontSize:        15,
    color:           colors.textPrimary,
    backgroundColor: colors.white,
    borderRadius:    radius.md,
    borderWidth:     1,
    borderColor:     colors.border,
    paddingVertical: spacing[3] + 2,
    paddingHorizontal: spacing[4],
  },

  primaryBtn: {
    backgroundColor: colors.green700,
    borderRadius:    radius.md,
    paddingVertical: spacing[3] + 4,
    alignItems:      'center',
    marginBottom:    spacing[5],
  },
  primaryBtnText: {
    fontFamily: fontFamily.semiBold,
    fontSize:   15,
    color:      colors.white,
  },
  btnDisabled: { opacity: 0.55 },

  divider: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            spacing[3],
    marginBottom:   spacing[5],
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: {
    fontFamily: fontFamily.regular,
    fontSize:   13,
    color:      colors.textMuted,
  },

  socialBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             spacing[3],
    backgroundColor: colors.white,
    borderRadius:    radius.md,
    borderWidth:     1,
    borderColor:     colors.border,
    paddingVertical: spacing[3] + 2,
    marginBottom:    spacing[3],
  },
  socialBtnText: {
    fontFamily: fontFamily.medium,
    fontSize:   15,
    color:      colors.textPrimary,
  },

  skipBtn: {
    alignItems:  'center',
    marginTop:   spacing[4],
    marginBottom: spacing[3],
    paddingVertical: spacing[2],
  },
  /**
   * On first run this is not a footnote — it is the route into the app for
   * anyone who does not want an account, which is the majority and is what
   * the privacy policy and the Play listing both promise.
   *
   * It also has to survive a Play reviewer. The App Access declaration says
   * nothing here is restricted; if the first screen reads as a login wall
   * and the way past it is 14px of grey text below the fold, that
   * declaration looks false and the review fails. A real button, above the
   * legal line, at a 48dp target, is what makes the claim self-evident.
   */
  skipBtnFirstRun: {
    minHeight:       48,
    justifyContent:  'center',
    borderRadius:    radius.full,
    borderWidth:     1.5,
    borderColor:     colors.green700,
    backgroundColor: colors.surface,
    marginTop:       spacing[5],
  },
  skipText: {
    fontFamily: fontFamily.medium,
    fontSize:   14,
    color:      colors.textSecondary,
  },
  skipTextFirstRun: {
    fontFamily: fontFamily.semiBold,
    fontSize:   15,
    color:      colors.green700,
  },

  legalNote: {
    fontFamily: fontFamily.regular,
    fontSize:   11,
    color:      colors.textMuted,
    textAlign:  'center',
    lineHeight: 16,
  },
});
