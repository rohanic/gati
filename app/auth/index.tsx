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
  Text,
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
import { router } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { colors, spacing, radius, fontFamily } from '@/theme';

export default function AuthScreen() {
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
      router.push({ pathname: '/auth/verify', params: { email: trimmed } });
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
  }, [email, signInWithEmail]);

  // ── Google OAuth ────────────────────────────────────────────
  const handleGoogle = useCallback(async () => {
    setLoadingGoogle(true);
    try {
      const isFirst = await signInWithGoogle();
      // signInWithGoogle returns false for BOTH "returning user" and "cancelled".
      // Disambiguate via the session: userId is only set when sign-in completed.
      // Without this, cancelling the browser dismissed the screen as if signed in.
      if (useAuthStore.getState().userId === null) return; // cancelled → stay on screen
      isFirst ? router.replace('/auth/welcome') : router.back();
    } catch (e) {
      Alert.alert('Google Sign In failed', (e as Error).message ?? 'Try again.');
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
          {/* ── Close button ── */}
          <Pressable
            style={styles.closeBtn}
            hitSlop={12}
            onPress={() => router.back()}
          >
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </Pressable>

          {/* ── Header ── */}
          <View style={styles.header}>
            <View style={styles.logoMark}>
              <Ionicons name="leaf" size={26} color={colors.green700} />
            </View>
            <Text style={styles.headline}>Keep your memories safe</Text>
            <Text style={styles.subhead}>
              Sign in to back up your stats, notes, and place history across devices.
              Your data stays private — only you can see it.
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

          {/* ── Google Sign In ── */}
          <Pressable
            style={[styles.socialBtn, anyLoading && styles.btnDisabled]}
            onPress={handleGoogle}
            disabled={anyLoading}
          >
            {loadingGoogle
              ? <ActivityIndicator size="small" color={colors.textPrimary} />
              : <>
                  <Ionicons name="logo-google" size={18} color="#4285F4" />
                  <Text style={styles.socialBtnText}>Continue with Google</Text>
                </>
            }
          </Pressable>

          {/* ── Skip ── */}
          <Pressable style={styles.skipBtn} onPress={() => router.back()}>
            <Text style={styles.skipText}>Skip for now</Text>
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
  skipText: {
    fontFamily: fontFamily.medium,
    fontSize:   14,
    color:      colors.textSecondary,
  },

  legalNote: {
    fontFamily: fontFamily.regular,
    fontSize:   11,
    color:      colors.textMuted,
    textAlign:  'center',
    lineHeight: 16,
  },
});
