import type { Session } from '@supabase/supabase-js';
import { createContext, use, useCallback, useEffect, useState, type PropsWithChildren } from 'react';

import { isSupabaseConfigured, supabase } from './supabase';
import type { Profile } from './types';

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) => Promise<string | null>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const value = use(AuthContext);
  if (!value) throw new Error('useAuth tiene que usarse dentro de <AuthProvider>');
  return value;
}

/** Traduce los errores más comunes de Supabase Auth. */
function authError(message: string) {
  if (/invalid login credentials/i.test(message)) return 'Email o contraseña incorrectos.';
  if (/email not confirmed/i.test(message)) return 'Tenés que confirmar tu email antes de ingresar.';
  if (/already registered/i.test(message)) return 'Ya existe una cuenta con ese email.';
  if (/password should be at least/i.test(message)) return 'La contraseña es muy corta (mínimo 6 caracteres).';
  return message;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessionLoading, setSessionLoading] = useState(isSupabaseConfigured);
  // Para qué usuario ya se cargó el perfil (evita "parpadeos" al iniciar sesión).
  const [profileLoadedFor, setProfileLoadedFor] = useState<string | null>(null);

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null);
      setProfileLoadedFor(null);
      return;
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    setProfile((data as Profile | null) ?? null);
    setProfileLoadedFor(userId);
  }, []);

  const isLoading = sessionLoading || (!!session && profileLoadedFor !== session.user.id);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadProfile(data.session?.user.id);
      setSessionLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      // No se puede llamar a Supabase dentro del callback: se difiere.
      setTimeout(() => loadProfile(newSession?.user.id), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const value: AuthState = {
    session,
    profile,
    isLoading,
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      return error ? authError(error.message) : null;
    },
    async signUp({ email, password, firstName, lastName }) {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { first_name: firstName.trim(), last_name: lastName.trim() } },
      });
      return error ? authError(error.message) : null;
    },
    async signOut() {
      await supabase.auth.signOut();
      setProfile(null);
    },
    refreshProfile: () => loadProfile(session?.user.id),
  };

  return <AuthContext value={value}>{children}</AuthContext>;
}
