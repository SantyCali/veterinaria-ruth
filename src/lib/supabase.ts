import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** true si el archivo .env tiene la URL y la clave pública de Supabase. */
export const isSupabaseConfigured = Boolean(url && key);

export const supabase: SupabaseClient = createClient(
  url ?? 'https://falta-configurar.supabase.co',
  key ?? 'falta-configurar',
  {
    auth: {
      ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

// En el celu, refrescar la sesión solo mientras la app está abierta.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export const PET_FILES_BUCKET = 'pet-files';

/** Saca caracteres que rompen los filtros .or() de Supabase. */
export function cleanSearch(text: string) {
  return text.replace(/[,()%*\\]/g, ' ').trim();
}
