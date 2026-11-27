import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button, ErrorBox, Field, FormRow, Icon, Input, Txt } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { notify } from '@/lib/dialogs';
import { supabase } from '@/lib/supabase';
import { colors, radius, space } from '@/lib/theme';

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError(null);
    if (!email.trim() || !password) return setError('Completá email y contraseña.');
    if (mode === 'signup' && (!firstName.trim() || !lastName.trim()))
      return setError('Completá nombre y apellido.');

    setLoading(true);
    const err =
      mode === 'login'
        ? await signIn(email, password)
        : await signUp({ email, password, firstName, lastName });
    setLoading(false);

    if (err) return setError(err);
    if (mode === 'signup') {
      notify(
        'Cuenta creada',
        'Si te llega un email de confirmación, abrilo y después ingresá. Un administrador tiene que aprobar tu cuenta.',
      );
      setMode('login');
    }
  }

  async function forgotPassword() {
    if (!email.trim()) return setError('Escribí tu email y tocá de nuevo "Olvidé mi contraseña".');
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (err) return setError(err.message);
    notify('Listo', 'Te enviamos un email para restablecer la contraseña.');
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.logo}>
            <Icon name="paw" size={34} color={colors.primaryText} />
          </View>
          <View style={{ alignItems: 'center', gap: 2 }}>
            <Txt variant="h1">Veterinaria Ruth</Txt>
            <Txt variant="label">Gestión clínica</Txt>
          </View>

          <Txt variant="muted" style={{ textAlign: 'center' }}>
            {mode === 'login' ? 'Ingresá con tu email y contraseña' : 'Creá tu cuenta de usuario'}
          </Txt>

          {mode === 'signup' && (
            <FormRow>
              <Field label="Nombre" required minWidth={130}>
                <Input value={firstName} onChangeText={setFirstName} autoComplete="given-name" />
              </Field>
              <Field label="Apellido" required minWidth={130}>
                <Input value={lastName} onChangeText={setLastName} autoComplete="family-name" />
              </Field>
            </FormRow>
          )}

          <Field label="Email" required>
            <Input
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="nombre@gmail.com"
            />
          </Field>
          <Field label="Contraseña" required>
            <Input
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              onSubmitEditing={submit}
            />
          </Field>

          {error ? <ErrorBox message={error} /> : null}

          <Button
            title={mode === 'login' ? 'Ingresar' : 'Crear cuenta'}
            onPress={submit}
            loading={loading}
            variant="accent"
          />

          {mode === 'login' && (
            <Pressable onPress={forgotPassword} style={{ alignSelf: 'center' }}>
              <Txt variant="small" style={{ color: colors.primary }}>
                Olvidé mi contraseña
              </Txt>
            </Pressable>
          )}

          <View style={styles.divider} />

          <Pressable
            onPress={() => {
              setError(null);
              setMode(mode === 'login' ? 'signup' : 'login');
            }}
            style={{ alignSelf: 'center' }}
          >
            <Txt variant="small">
              {mode === 'login' ? '¿No tenés cuenta? ' : '¿Ya tenés cuenta? '}
              <Txt variant="small" style={{ color: colors.primary }}>
                {mode === 'login' ? 'Crear cuenta' : 'Ingresar'}
              </Txt>
            </Txt>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: space.lg,
    backgroundColor: colors.background,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    gap: space.lg,
    padding: space.xl,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logo: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: { height: 1, backgroundColor: colors.border },
});
