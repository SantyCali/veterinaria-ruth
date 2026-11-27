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
import { confirm, toast } from '@/lib/dialogs';
import { roleLabel } from '@/lib/labels';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/lib/theme';
import type { Profile, UserRole } from '@/lib/types';
import { useQuery } from '@/lib/use-query';
import { saveBackupFile } from '@/lib/backup-file';
import { fmtDateTime } from '@/lib/dates';
import { getLastError, mirrorAsJson, syncNow, useOffline } from '@/lib/offline';
import { usersOffline } from '@/lib/offline-queries';

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
    if (err) {
      toast.error('No se pudieron guardar tus datos', err.message);
      return setError(err.message);
    }
    await refreshProfile();
    toast.success('Datos guardados');
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

      <ChangePassword />

      <BackupCard isAdmin={profile.role === 'admin'} />

      {profile.role === 'admin' ? <UsersAdmin myId={profile.id} /> : null}
    </Screen>
  );
}

/** Solo admin: aprobar usuarios nuevos, cambiar rol y activar/desactivar. */
function UsersAdmin({ myId }: { myId: string }) {
  const { data, error, reload } = useQuery<Profile[]>(
    () => supabase.from('profiles').select('*').order('active').order('created_at'),
    [],
    'usuarios',
    usersOffline,
  );

  async function update(p: Profile, changes: Partial<Pick<Profile, 'role' | 'active'>>) {
    if (changes.active === false) {
      const ok = await confirm('Desactivar usuario', `${p.email} ya no va a poder ingresar.`, {
        okText: 'Desactivar',
        danger: true,
      });
      if (!ok) return;
    }
    const { error: err } = await supabase.from('profiles').update(changes).eq('id', p.id);
    if (err) toast.error('No se pudo actualizar el usuario', err.message);
    else if (changes.active === true) toast.success('Usuario activado', `${p.email} ya puede ingresar`);
    else if (changes.active === false) toast.success('Usuario desactivado', p.email);
    else if (changes.role) toast.success('Rol actualizado', `${p.email} ahora es ${roleLabel[changes.role].toLowerCase()}`);
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

/** Cambiar la contraseña del usuario que inició sesión. */
function ChangePassword() {
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (password.length < 6) return setError('La contraseña tiene que tener al menos 6 caracteres.');
    if (password !== repeat) return setError('Las contraseñas no coinciden.');
    setSaving(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (err) {
      const msg = /different from the old/i.test(err.message) ? 'La nueva tiene que ser distinta de la actual.' : err.message;
      toast.error('No se pudo cambiar la contraseña', msg);
      return setError(msg);
    }
    setPassword('');
    setRepeat('');
    toast.success('Contraseña actualizada', 'La próxima vez ingresá con la nueva.');
  }

  return (
    <Card style={{ gap: space.lg }}>
      <SectionTitle title="Cambiar contraseña" />
      <FormRow>
        <Field label="Nueva contraseña">
          <Input value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
        </Field>
        <Field label="Repetila">
          <Input value={repeat} onChangeText={setRepeat} secureTextEntry autoComplete="new-password" onSubmitEditing={save} />
        </Field>
      </FormRow>
      {error ? <ErrorBox message={error} /> : null}
      <Button title="Cambiar contraseña" icon="lock-reset" onPress={save} loading={saving} style={{ alignSelf: 'flex-end' }} />
    </Card>
  );
}

/** Estado de la copia local automática + descarga del respaldo (solo admin). */
function BackupCard({ isAdmin }: { isAdmin: boolean }) {
  const { online, syncing, mirror, lastError } = useOffline();
  const [downloading, setDownloading] = useState(false);

  const counts = mirror
    ? `${mirror.clients.length} clientes · ${mirror.pets.length} mascotas · ${mirror.consultations.length} consultas · ${mirror.appointments.length} turnos`
    : null;

  async function syncManual() {
    const ok = await syncNow();
    if (ok) toast.success('Copia actualizada');
    else toast.error('No se pudo actualizar la copia', getLastError() ?? undefined);
  }

  async function download() {
    const json = mirrorAsJson();
    if (!json || !mirror) return toast.warning('Todavía no hay una copia para descargar');
    setDownloading(true);
    try {
      const stamp = mirror.syncedAt.slice(0, 16).replace(/[:T]/g, '-');
      await saveBackupFile(`veterinaria-ruth-backup-${stamp}.json`, json);
      toast.success('Copia descargada', 'Guardala en un lugar seguro: tiene datos personales de los clientes.');
    } catch (e) {
      toast.error('No se pudo descargar la copia', e instanceof Error ? e.message : undefined);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Card style={{ gap: space.md }}>
      <SectionTitle title="Copia de seguridad y modo sin internet" />
      <Txt variant="small">
        La app guarda sola una copia completa en este dispositivo cada 5 minutos. Si se corta internet, podés seguir
        viendo clientes, mascotas, historias clínicas, turnos y agenda. Al cerrar sesión, la copia se borra.
      </Txt>
      <Row wrap gap={space.sm}>
        <Chip
          label={online ? 'Con internet' : 'Sin internet'}
          fg={online ? colors.success : colors.warning}
          bg={online ? colors.successSoft : colors.warningSoft}
          icon={online ? 'wifi' : 'wifi-off'}
        />
        <Chip
          label={syncing ? 'Actualizando copia…' : mirror ? `Última copia: ${fmtDateTime(mirror.syncedAt)}` : 'Sin copia todavía'}
          fg={colors.primary}
          bg={colors.primarySoft}
          icon="database-sync-outline"
        />
      </Row>
      {counts ? <Txt variant="small">{counts}</Txt> : null}
      {lastError && online ? <ErrorBox message={`La última actualización falló: ${lastError}`} /> : null}
      <Row wrap style={{ justifyContent: 'flex-end' }}>
        <Button title="Actualizar ahora" icon="sync" variant="secondary" loading={syncing} disabled={!online} onPress={syncManual} />
        {isAdmin ? (
          <Button title="Descargar copia" icon="download" loading={downloading} disabled={!mirror} onPress={download} />
        ) : null}
      </Row>
    </Card>
  );
}
