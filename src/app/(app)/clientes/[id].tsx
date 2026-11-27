import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { PetAvatar } from '@/components/pet-avatar';
import { APPOINTMENT_SELECT, AppointmentRow } from '@/components/rows';
import {
  Avatar,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorBox,
  Icon,
  initials,
  ListItem,
  Row,
  Screen,
  SectionTitle,
  Txt,
  type IconName,
} from '@/components/ui';
import { fmtAge } from '@/lib/dates';
import { confirm, toast } from '@/lib/dialogs';
import { clientStatus, petStatus, speciesLabel } from '@/lib/labels';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/lib/theme';
import type { AppointmentFull, Client, Pet } from '@/lib/types';
import { useQuery } from '@/lib/use-query';
import { clientDetailOffline } from '@/lib/offline-queries';
import { openWhatsApp } from '@/lib/whatsapp';

type Detail = { client: Client; pets: Pet[]; appointments: AppointmentFull[] };

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useQuery<Detail>(async () => {
    const [c, p, a] = await Promise.all([
      supabase.from('clients').select('*').eq('id', id).single(),
      supabase.from('pets').select('*').eq('client_id', id).order('name'),
      supabase
        .from('appointments')
        .select(APPOINTMENT_SELECT)
        .eq('client_id', id)
        .order('starts_at', { ascending: false })
        .limit(20),
    ]);
    const err = c.error ?? p.error ?? a.error;
    return {
      error: err,
      data: err ? null : { client: c.data as Client, pets: p.data as Pet[], appointments: a.data as AppointmentFull[] },
    };
  }, [id], 'cliente', (m) => clientDetailOffline(m, id));

  async function toggleActive() {
    if (!data) return;
    const deactivate = data.client.active;
    const ok = await confirm(
      deactivate ? 'Desactivar cliente' : 'Reactivar cliente',
      deactivate
        ? 'El cliente queda inactivo. No se borra nada: sus mascotas, historias clínicas y turnos se conservan.'
        : 'El cliente vuelve a estar activo.',
      { okText: deactivate ? 'Desactivar' : 'Reactivar', danger: deactivate },
    );
    if (!ok) return;
    setBusy(true);
    const { error: err } = await supabase.from('clients').update({ active: !deactivate }).eq('id', id);
    setBusy(false);
    if (err) toast.error('No se pudo actualizar el cliente', err.message);
    else toast.success(deactivate ? 'Cliente desactivado' : 'Cliente reactivado');
    reload();
  }

  if (loading && !data) return <Screen title="Cliente" back loading />;
  if (error || !data) return <Screen title="Cliente" back><ErrorBox message={error ?? 'No encontrado'} /></Screen>;

  const { client, pets, appointments } = data;
  const st = clientStatus(client.active);

  return (
    <Screen
      title={`${client.first_name} ${client.last_name}`}
      subtitle="Ficha de cliente"
      back
      actions={
        <>
          {client.phone ? (
            <Button
              title="WhatsApp"
              icon="whatsapp"
              variant="secondary"
              small
              onPress={() => openWhatsApp(client.phone, `¡Hola ${client.first_name}! Te escribimos de Veterinaria Ruth. `)}
            />
          ) : null}
          <Button title="Editar" icon="pencil-outline" variant="secondary" small onPress={() => router.push({ pathname: '/clientes/form', params: { id } })} />
          <Button
            title={client.active ? 'Desactivar' : 'Reactivar'}
            icon={client.active ? 'account-off-outline' : 'account-check-outline'}
            variant={client.active ? 'danger' : 'primary'}
            small
            loading={busy}
            onPress={toggleActive}
          />
        </>
      }
    >
      <Card style={{ gap: space.md }}>
        <Row gap={space.lg} wrap>
          <Avatar text={initials(client.first_name, client.last_name)} size={56} />
          <View style={{ flex: 1, minWidth: 200, gap: 4 }}>
            <Chip label={st.label} fg={st.fg} bg={st.bg} />
            <InfoLine icon="phone-outline" text={client.phone} onPress={client.phone ? () => Linking.openURL(`tel:${client.phone}`) : undefined} />
            <InfoLine icon="email-outline" text={client.email} onPress={client.email ? () => Linking.openURL(`mailto:${client.email}`) : undefined} />
            <InfoLine icon="map-marker-outline" text={client.address} />
          </View>
        </Row>
        {client.notes ? <Txt variant="muted">{client.notes}</Txt> : null}
      </Card>

      <Card style={{ gap: 2 }}>
        <SectionTitle
          title={`Mascotas (${pets.length})`}
          action={
            <Button
              title="Agregar mascota"
              icon="plus"
              variant="ghost"
              small
              onPress={() => router.push({ pathname: '/mascotas/form', params: { clientId: id } })}
            />
          }
        />
        {pets.length === 0 ? <EmptyState text="Este cliente no tiene mascotas registradas." /> : null}
        {pets.map((p) => {
          const ps = petStatus[p.status];
          return (
            <ListItem
              key={p.id}
              left={<PetAvatar path={p.photo_path} species={p.species} />}
              title={p.name}
              subtitle={[speciesLabel[p.species], p.breed, fmtAge(p.birth_date)].filter(Boolean).join(' · ')}
              right={
                <Row>
                  <Chip label={ps.label} fg={ps.fg} bg={ps.bg} />
                  <Icon name="chevron-right" />
                </Row>
              }
              onPress={() => router.push(`/mascotas/${p.id}`)}
            />
          );
        })}
      </Card>

      <Card style={{ gap: space.sm }}>
        <SectionTitle title="Historial de turnos" />
        {appointments.length === 0 ? <Txt variant="muted">Sin turnos registrados.</Txt> : null}
        {appointments.map((a) => (
          <AppointmentRow key={a.id} appt={a} showDate onPress={() => router.push({ pathname: '/turnos', params: { turno: a.id } })} />
        ))}
      </Card>
    </Screen>
  );
}

function InfoLine({
  icon,
  text,
  onPress,
}: {
  icon: IconName;
  text: string | null;
  onPress?: () => void;
}) {
  if (!text) return null;
  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <Row gap={6}>
        <Icon name={icon} size={16} />
        <Txt style={onPress ? { color: colors.primary } : undefined}>{text}</Txt>
      </Row>
    </Pressable>
  );
}
