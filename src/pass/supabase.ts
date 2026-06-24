// Supabase client for React Native.
// `react-native-url-polyfill/auto` MUST be imported before @supabase/supabase-js
// — supabase-js relies on the WHATWG URL API which Hermes does not fully provide.
import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/pass/config';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // RN has no URL session callback
    flowType: 'pkce', // deep-link OAuth returns a ?code= to exchange for a session
  },
});

// supabase-js can't detect RN foreground/background on its own — drive token
// refresh by hand so the session stays fresh while the app is in use.
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
