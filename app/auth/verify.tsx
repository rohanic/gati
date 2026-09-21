/**
 * OTP verify screen.
 *
 * Shows after the user requests an email code. They enter the 6-digit
 * code here and we exchange it for a Supabase session.
 */
import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { colors, spacing, radius, fontFamily } from '@/theme';
import { Text } from '@/components/ui/Text';

// Supabase email OTP is 6 digits by default (Auth → Email → OTP length).
// This MUST match the project setting or auto-verify never fires and the
// submit button stays disabled, blocking email sign-in entirely.
const CODE_LENGTH = 6;

export default function VerifyScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code,       setCode]       = useState('');
  const [loading,    setLoading]    = useState(false);
  const [resending,  setResending]  = useState(false);
  const inputRef = useRef<TextInput>(null);

  const { verifyOtp, signInWithEmail } = useAuthStore();

  // ── Verify ──────────────────────────────────────────────────
  const handleVerify = useCallback(async () => {
    if (code.length < CODE_LENGTH) return;
    setLoading(true);
    try {
      const isFirst = await verifyOtp(email ?? '', code.trim());
      // First login → show welcome; returning user → dismiss modal
      isFirst ? router.replace('/auth/welcome') : router.dismissAll();
    } catch (e) {
      setCode('');
      // Refocus on dismiss so the keyboard returns and the user can retype
      // immediately (focusing while the Alert is up wouldn't reopen the keyboard).
      Alert.alert(
        'Incorrect code',
        'Double-check the code and try again. Codes expire after 10 minutes.',
        [{ text: 'Try again', onPress: () => inputRef.current?.focus() }],
      );
    } finally {
      setLoading(false);
    }
  }, [code, email, verifyOtp]);

  // Auto-verify when all 6 digits are entered
  const handleCodeChange = useCallback((text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    if (digits.length === CODE_LENGTH) {
      // Slight delay so the last digit renders before we kick off the request
      setTimeout(() => handleVerify(), 80);
    }
  }, [handleVerify]);

  // ── Resend ──────────────────────────────────────────────────
  const handleResend = useCallback(async () => {
    setResending(true);
    try {
      await signInWithEmail(email ?? '');
      Alert.alert('Code sent', 'A new code has been sent to your email.');
      setCode('');
    } catch (e) {
      Alert.alert('Error', (e as Error).message ?? 'Could not resend. Try again.');
    } finally {
      setResending(false);
    }
  }, [email, signInWithEmail]);

  // ── Render digit cells ───────────────────────────────────────
  const cells = Array.from({ length: CODE_LENGTH }, (_, i) => ({
    digit:  code[i] ?? '',
    filled: i < code.length,
    active: i === code.length,
  }));

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          {/* ── Back ── */}
          <Pressable style={styles.backBtn} hitSlop={12} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={colors.textSecondary} />
          </Pressable>

          {/* ── Header ── */}
          <View style={styles.header}>
            <View style={styles.icon}>
              <Ionicons name="mail-open-outline" size={28} color={colors.green700} />
            </View>
            <Text style={styles.headline}>Check your email</Text>
            <Text style={styles.subhead}>
              We sent a 6-digit code to{'\n'}
              <Text style={styles.emailHighlight}>{email}</Text>
            </Text>
          </View>

          {/* ── OTP cells (tappable → focuses hidden input) ── */}
          <Pressable style={styles.cells} onPress={() => inputRef.current?.focus()}>
            {cells.map(({ digit, active }, i) => (
              <View
                key={i}
                style={[
                  styles.cell,
                  active  && styles.cellActive,
                  digit   && styles.cellFilled,
                ]}
              >
                <Text style={styles.cellText}>{digit}</Text>
              </View>
            ))}
          </Pressable>

          {/* Hidden text input captures keyboard input */}
          <TextInput
            ref={inputRef}
            style={styles.hiddenInput}
            value={code}
            onChangeText={handleCodeChange}
            keyboardType="number-pad"
            maxLength={CODE_LENGTH}
            autoFocus
            caretHidden
          />

          {/* ── Verify button ── */}
          <Pressable
            style={[
              styles.verifyBtn,
              (code.length < CODE_LENGTH || loading) && styles.btnDisabled,
            ]}
            onPress={handleVerify}
            disabled={code.length < CODE_LENGTH || loading}
          >
            {loading
              ? <ActivityIndicator size="small" color={colors.white} />
              : <Text style={styles.verifyBtnText}>Verify</Text>
            }
          </Pressable>

          {/* ── Resend ── */}
          <Pressable
            style={[styles.resendBtn, resending && styles.btnDisabled]}
            onPress={handleResend}
            disabled={resending}
          >
            {resending
              ? <ActivityIndicator size="small" color={colors.textSecondary} />
              : <Text style={styles.resendText}>Didn't receive it? Resend code</Text>
            }
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: colors.background },
  kav:       { flex: 1 },
  container: {
    flex:              1,
    paddingHorizontal: spacing[5],
    paddingBottom:     spacing[8],
  },

  backBtn: {
    marginTop: spacing[4],
    padding:   spacing[1],
    alignSelf: 'flex-start',
  },

  header: {
    alignItems:   'center',
    marginTop:    spacing[8],
    marginBottom: spacing[8],
    gap:          spacing[3],
  },
  icon: {
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
    letterSpacing: -0.3,
  },
  subhead: {
    fontFamily: fontFamily.regular,
    fontSize:   14,
    color:      colors.textSecondary,
    textAlign:  'center',
    lineHeight: 22,
  },
  emailHighlight: {
    fontFamily: fontFamily.semiBold,
    color:      colors.textPrimary,
  },

  cells: {
    flexDirection:  'row',
    gap:            spacing[2],
    justifyContent: 'center',
    marginBottom:   spacing[7],
  },
  cell: {
    width:           38,
    height:          52,
    borderRadius:    radius.md,
    borderWidth:     1.5,
    borderColor:     colors.border,
    backgroundColor: colors.white,
    alignItems:      'center',
    justifyContent:  'center',
  },
  cellActive: {
    borderColor: colors.green700,
    shadowColor: colors.green700,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius:  4,
    elevation:     2,
  },
  cellFilled: {
    backgroundColor: colors.green50,
    borderColor:     colors.green700,
  },
  cellText: {
    fontFamily: fontFamily.bold,
    fontSize:   18,
    color:      colors.textPrimary,
  },
  hiddenInput: {
    position: 'absolute',
    opacity:  0,
    width:    1,
    height:   1,
  },

  verifyBtn: {
    backgroundColor: colors.green700,
    borderRadius:    radius.md,
    paddingVertical: spacing[3] + 4,
    alignItems:      'center',
    marginBottom:    spacing[4],
  },
  verifyBtnText: {
    fontFamily: fontFamily.semiBold,
    fontSize:   15,
    color:      colors.white,
  },
  btnDisabled: { opacity: 0.45 },

  resendBtn: {
    alignItems:     'center',
    paddingVertical: spacing[2],
  },
  resendText: {
    fontFamily: fontFamily.medium,
    fontSize:   14,
    color:      colors.textSecondary,
  },
});
