import * as Network from 'expo-network';
import { useEffect, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';

import { localStore } from './local-store';
import { supabase } from './supabase';
import type {
  Appointment,
  Client,
  Consultation,
  DailyNote,
  Pet,
  PetFile,
  PetOwnerHistory,
  Profile,
  Task,
  Treatment,
  Vaccination,
} from './types';

// =====================================================================
// Copia local automática (backup) + modo sin internet (solo lectura).
//
// - Cada SYNC_EVERY_MS (y al abrir la app o al volver internet) se descarga
//   la base completa y se guarda en el dispositivo.
// - Sin conexión, las pantallas leen de esa copia (ver offline-queries.ts).
// - Para cargar o editar hace falta internet.
// - La copia se borra al cerrar sesión (tiene datos personales de clientes).
// =====================================================================

export const SYNC_EVERY_MS = 5 * 60 * 1000;
const STORE_KEY = 'mirror-v1';
const PAGE = 1000;

export type Mirror = {
  syncedAt: string;
  profiles: Profile[];
  clients: Client[];
  pets: Pet[];
  pet_owner_history: Omit<PetOwnerHistory, 'client'>[];
  appointments: Appointment[];
  consultations: Consultation[];
  treatments: Treatment[];
  vaccinations: Vaccination[];
  pet_files: PetFile[];
  tasks: Task[];
  daily_notes: DailyNote[];
};

const TABLES = [
  'profiles',
  'clients',
  'pets',
  'pet_owner_history',
  'appointments',
  'consultations',
  'treatments',
  'vaccinations',
  'pet_files',
  'tasks',
  'daily_notes',
] as const;

// ---------------------------------------------------------------- Estado observable

type OfflineState = { online: boolean; syncing: boolean; mirror: Mirror | null; lastError: string | null };

let state: OfflineState = { online: true, syncing: false, mirror: null, lastError: null };
const listeners = new Set<() => void>();

function setState(patch: Partial<OfflineState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

const store = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get: () => state,
};

/** Estado de conexión y de la copia local, para mostrar en pantalla. */
export function useOffline() {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

export const isOnline = () => state.online;
export const getMirror = () => state.mirror;
export const getLastError = () => state.lastError;

/** ¿El error es por falta de conexión (y no un error de la base)? */
export function isNetworkError(message: string | null | undefined) {
  return !!message && /failed to fetch|network request failed|networkerror|load failed|fetch failed|timeout/i.test(message);
}

// ---------------------------------------------------------------- Descarga

async function fetchAll(table: (typeof TABLES)[number]) {
  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

let syncPromise: Promise<boolean> | null = null;

/** Descarga toda la base y la guarda en el dispositivo. Devuelve true si salió bien. */
export function syncNow(): Promise<boolean> {
  if (syncPromise) return syncPromise;
  syncPromise = (async () => {
    setState({ syncing: true });
    try {
      const results = await Promise.all(TABLES.map((t) => fetchAll(t)));
      const mirror = { syncedAt: new Date().toISOString() } as Mirror;
      TABLES.forEach((t, i) => {
        (mirror as Record<string, unknown>)[t] = results[i];
      });
      await localStore.set(STORE_KEY, JSON.stringify(mirror));
      setState({ mirror, syncing: false, lastError: null, online: true });
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setState({ syncing: false, lastError: msg, online: isNetworkError(msg) ? false : state.online });
      return false;
    } finally {
      syncPromise = null;
    }
  })();
  return syncPromise;
}

/** Carga la última copia guardada en el dispositivo (al abrir la app). */
export async function loadMirror() {
  if (state.mirror) return state.mirror;
  const raw = await localStore.get(STORE_KEY);
  if (!raw) return null;
  try {
    const mirror = JSON.parse(raw) as Mirror;
    setState({ mirror });
    return mirror;
  } catch {
    return null;
  }
}

/** Borra la copia local (al cerrar sesión). */
export async function clearMirror() {
  setState({ mirror: null, lastError: null });
  await localStore.remove(STORE_KEY);
}

/** Texto JSON de la copia, para descargarla como archivo de respaldo. */
export function mirrorAsJson() {
  return state.mirror ? JSON.stringify(state.mirror, null, 2) : null;
}

// ---------------------------------------------------------------- Conexión

function subscribeNetwork(onChange: (online: boolean) => void) {
  if (Platform.OS === 'web') {
    const on = () => onChange(true);
    const off = () => onChange(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    onChange(navigator.onLine);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }
  Network.getNetworkStateAsync().then((s) => onChange(s.isConnected !== false && s.isInternetReachable !== false));
  const sub = Network.addNetworkStateListener((s) =>
    onChange(s.isConnected !== false && s.isInternetReachable !== false),
  );
  return () => sub.remove();
}

/**
 * Mantiene la copia local al día mientras haya sesión: al abrir, cada 5 minutos,
 * al volver internet y al volver a la app. Se monta una sola vez en (app)/_layout.
 */
export function useOfflineSync() {
  useEffect(() => {
    let lastSync = 0;
    const trySync = (force = false) => {
      if (!state.online) return;
      if (!force && Date.now() - lastSync < SYNC_EVERY_MS) return;
      lastSync = Date.now();
      syncNow();
    };

    loadMirror().then(() => trySync(true));

    const unsubNet = subscribeNetwork((online) => {
      const wasOffline = !state.online;
      setState({ online });
      if (online && wasOffline) trySync(true);
    });
    const timer = setInterval(() => trySync(true), SYNC_EVERY_MS);
    const appSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') trySync();
    });

    return () => {
      unsubNet();
      clearInterval(timer);
      appSub.remove();
    };
  }, []);
}
