import { useState } from 'react';
import { View } from 'react-native';

import {
  Avatar,
  Button,
  Card,
  Chip,
  ErrorBox,
  Field,
  FormRow,
  initials,
  Input,
  ListItem,
  Row,
  Screen,
  SectionTitle,
  Segmented,
  Txt,
} from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { confirm, notify } from '@/lib/dialogs';
import { roleLabel } from '@/lib/labels';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/lib/theme';
import type { Profile, UserRole } from '@/lib/types';
import { useQuery } from '@/lib/use-query';

export default function ProfileScreen() {
  const { profile, refreshProfile, signOut } = useAuth();
  // Dentro de (app) siempre hay perfil cargado, así que se usa como valor inicial.
  const [firstName, setFirstName] = useState(profile?.first_name ?? '');
  const [lastName, setLastName] = useState(profile?.last_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!profile) return;
    setError(null);
    setSaving(true);
    const { error: err } = await supabase
      .from('profiles')
      .update({ first_name: firstName.trim(), last_name: lastName.trim(), phone: phone.trim() || null })
      .eq('id', profile.id);
    setSaving(false);
    if (err) return setError(err.message);
    await refreshProfile();
    notify('Datos guardados');
  }

  if (!profile) return null;

  return (
    <Screen title="Mi perfil" subtitle="Datos personales y usuarios">
      <Card style={{ gap: space.lg }}>
        <Row gap={space.lg}>
          <Avatar text={initials(profile.first_name, profile.last_name)} size={56} />
          <View>
            <Txt variant="h3">{profile.email}</Txt>
            <Chip label={roleLabel[profile.role]} fg={colors.primary} bg={colors.primarySoft} />
          </View>
        </Row>
        <FormRow>
          <Field label="Nombre">
            <Input value={firstName} onChangeText={setFirstName} />
          </Field>
          <Field label="Apellido">
            <Input value={lastName} onChangeText={setLastName} />
          </Field>
          <Field label="Teléfono">
            <Input value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          </Field>
        </FormRow>
        {error ? <ErrorBox message={error} /> : null}
        <Row style={{ justifyContent: 'space-between' }}>
          <Button title="Cerrar sesión" icon="logout" variant="ghost" onPress={signOut} />
          <Button title="Guardar" icon="content-save-outline" onPress={save} loading={saving} />
        </Row>
      </Card>

      {profile.role === 'admin' ? <UsersAdmin myId={profile.id} /> : null}
    </Screen>
  );
}

/** Solo admin: aprobar usuarios nuevos, cambiar rol y activar/desactivar. */
function UsersAdmin({ myId }: { myId: string }) {
  const { data, error, reload } = useQuery<Profile[]>(
    () => supabase.from('profiles').select('*').order('active').order('created_at'),
    [],
  );

  async function update(p: Profile, changes: Partial<Pick<Profile, 'role' | 'active'>>) {
    if (changes.active === false) {
      const ok = await confirm('Desactivar usuario', `${p.email} ya no va a poder ingresar.`, 'Desactivar');
      if (!ok) return;
    }
    const { error: err } = await supabase.from('profiles').update(changes).eq('id', p.id);
    if (err) notify('No se pudo actualizar', err.message);
    reload();
  }

  return (
    <Card style={{ gap: space.sm }}>
      <SectionTitle title="Usuarios del sistema" />
      <Txt variant="small">
        Los usuarios nuevos se registran desde la pantalla de ingreso y quedan pendientes hasta que los actives acá.
      </Txt>
      {error ? <ErrorBox message={error} /> : null}
      {data?.map((p) => (
        <View key={p.id} style={{ gap: space.sm, paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <ListItem
            left={<Avatar text={initials(p.first_name, p.last_name)} size={36} />}
            title={`${p.first_name} ${p.last_name}`.trim() || p.email}
            subtitle={p.email}
            right={
              p.active ? (
                <Chip label="Activo" fg={colors.success} bg={colors.successSoft} />
              ) : (
                <Chip label="Pendiente / inactivo" fg={colors.warning} bg={colors.warningSoft} />
              )
            }
          />
          {p.id !== myId && (
            <Row wrap>
              <Segmented<UserRole>
                value={p.role}
                onChange={(role) => update(p, { role })}
                options={[
                  { value: 'veterinario', label: 'Veterinario' },
                  { value: 'admin', label: 'Administrador' },
                ]}
              />
              <Button
                title={p.active ? 'Desactivar' : 'Activar'}
                small
                variant={p.active ? 'danger' : 'primary'}
                onPress={() => update(p, { active: !p.active })}
              />
            </Row>
          )}
        </View>
      ))}
    </Card>
  );
}
