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
    },
  },
);
