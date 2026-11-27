import { Pressable, StyleSheet, View } from 'react-native';

import { Chip, Txt } from './ui';
import { fmtDate, fmtTime } from '@/lib/dates';
import { appointmentStatus, speciesLabel } from '@/lib/labels';
import { colors, radius, space } from '@/lib/theme';
import type { AppointmentFull } from '@/lib/types';

/** Turno en formato lista: hora a la izquierda, mascota, dueño y motivo. */
export function AppointmentRow({
  appt,
  onPress,
  showDate,
}: {
  appt: AppointmentFull;
  onPress?: () => void;
  showDate?: boolean;
}) {
  const st = appointmentStatus[appt.status];
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceAlt }]}
    >
      <View style={styles.time}>
        <Txt variant="bodyStrong" style={{ color: colors.primary }}>
          {fmtTime(appt.starts_at)}
        </Txt>
        <Txt variant="small">{showDate ? fmtDate(new Date(appt.starts_at)).slice(0, 5) : 'hs'}</Txt>
      </View>
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Txt variant="bodyStrong">{appt.pet?.name ?? 'Mascota'}</Txt>
          {appt.pet ? (
            <Txt variant="small">
              {speciesLabel[appt.pet.species]}
              {appt.pet.breed ? ` · ${appt.pet.breed}` : ''}
            </Txt>
          ) : null}
          <Chip label={st.label} fg={st.fg} bg={st.bg} />
        </View>
        <Txt variant="small" numberOfLines={1}>
          {appt.client ? `Tutor: ${appt.client.first_name} ${appt.client.last_name} · ` : 'Sin dueño · '}
          Motivo: {appt.reason}
        </Txt>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  time: {
    width: 64,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
});

/** Select de Supabase para turnos con mascota, dueño y veterinario. */
export const APPOINTMENT_SELECT =
  '*, pet:pets(id, name, species, breed), client:clients(id, first_name, last_name, phone), vet:profiles!appointments_vet_id_fkey(id, first_name, last_name)';
