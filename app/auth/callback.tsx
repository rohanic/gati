/**
 * Landing route for the OAuth redirect — gati://auth/callback.
 *
 * Why a route exists at all: Expo Router turns every incoming deep link into
 * a navigation, including the one Google sends back at the end of sign-in.
 * With no file here that navigation landed on the "Unmatched Route" screen.
 *
 * Two very different situations arrive here:
 *
 *   Warm — the normal case. signInWithGoogle is still running and is
 *   awaiting this same redirect; it will exchange the code and navigate. This
 *   route only needs to get out of the way.
 *
 *   Cold — Android killed the app while the user was in the browser (common
 *   on low-memory phones). The promise that was waiting for the redirect is
 *   gone, so nothing else will finish the job. The PKCE verifier was written
 *   to AsyncStorage before the browser opened, so the exchange can still be
 *   completed here — and without this, the user signed in at Google and then
 *   simply was not signed in.
 */
import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/services/supabase';
import { useAuthStore, isGoogleSignInInFlight } from '@/store/authStore';
import { continueAfterFirstRunAuth } from '@/navigation/firstRun';
import { colors } from '@/theme';

export default function AuthCallback() {
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const code = typeof params.code === 'string' ? params.code : undefined;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (isGoogleSignInInFlight()) {
        if (router.canGoBack()) router.back();
        return;
      }

      if (code) {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          const { data: exchanged } = await supabase.auth
            .exchangeCodeForSession(code)
            .catch(() => ({ data: { user: null } as { user: null } }));
          const user = exchanged?.user;
          if (user) {
            // Awaited, so a returning account's profile is restored — and
            // onboarding marked done — before anything decides where to go.
            // Otherwise a returning user could be routed into onboarding and
            // overwrite the profile that was on its way down.
            await useAuthStore.getState()._onSignIn(user.id, user.email ?? null).catch(() => {});
          }
        }
      }
      if (cancelled) return;

      if (useAuthStore.getState().userId) continueAfterFirstRunAuth();
      else router.replace('/');
    })();

    return () => { cancelled = true; };
  }, [code]);

  return (
    <View style={styles.root}>
      <ActivityIndicator color={colors.green700} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: colors.background,
  },
});
