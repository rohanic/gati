/**
 * Supabase client — shared singleton.
 *
 * Uses AsyncStorage as the session store so the user stays signed in
 * across app restarts. `detectSessionInUrl` is disabled because Expo
 * Router handles deep links separately (see app/_layout.tsx).
 *
 * Cloud backup is opt-in: if SUPABASE_URL is not set the client still
 * initialises (pointing at a placeholder URL) but all network calls will
 * fail gracefully — callers should gate writes behind `userId !== null`.
 *
 * A PRODUCTION build must never reach that branch. EXPO_PUBLIC_* values are
 * inlined when the bundle is built, and EAS builds on its own machines,
 * where the gitignored .env does not exist — so the values have to be EAS
 * environment variables. Version 1.2.1 (36) shipped without them and every
 * sign-in opened https://placeholder.supabase.co. Sign-in now refuses up
 * front when IS_CLOUD_CONFIGURED is false, and `npm run verify:backend`
 * checks EAS holds both values.
 */
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/config';

export const supabase = createClient(
  SUPABASE_URL  || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder-anon-key',
  {
    auth: {
      storage:            AsyncStorage as any,
      autoRefreshToken:   true,
      persistSession:     true,
      detectSessionInUrl: false,
      /**
       * PKCE, explicitly. The library default is 'implicit', in which Supabase
       * redirects back with the tokens in the URL fragment
       * (#access_token=…) and there is no authorisation code at all.
       * signInWithGoogle reads a `?code=` parameter and trades it via
       * exchangeCodeForSession — which only exists in the PKCE flow — so
       * under the default, every Google sign-in came back "without a
       * sign-in code" and failed.
       *
       * PKCE is also the right choice on its own merits for a mobile app:
       * tokens never appear in a URL that other apps or logs could see, and
       * the verifier is stored in AsyncStorage before the browser opens, so
       * the exchange still works if Android kills the app while the user is
       * in the browser (see app/auth/callback.tsx).
       *
       * Email OTP is unaffected: verifyOtp with a 6-digit code does not use
       * the redirect flow.
       */
      flowType:           'pkce',
    },
  },
);
