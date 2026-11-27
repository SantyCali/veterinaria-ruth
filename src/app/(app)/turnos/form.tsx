import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { PetPicker } from '@/components/pickers';
import {
  Button,
  Card,
  DateInput,
  ErrorBox,
  Field,
  FormRow,
  Input,
  Row,
  Screen,
  Segmented,
  TimeInput,
} from '@/components/ui';
import { fmtDate, fmtTime, inputToDateTime } from '@/lib/dates';
import { confirm, toast } from '@/lib/dialogs';
import { supabase } from '@/lib/supabase';
import { space } from '@/lib/theme';
import type { Appointment, PetWithClient, Profile } from '@/lib/types';

const DURATIONS = ['15', '30', '45', '60', '90'] as const;

export default function AppointmentFormScreen() {
  const { id, petId, date: dateParam } = useLocalSearchParams<{ id?: string; petId?: string; date?: string }>();

  const [pet, setPet] = useState<PetWithClient | null>(null);
  const [date, setDate] = useState(dateParam ?? fmtDate(new Date()));
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState<string>('30');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [vetId, setVetId] = useState<string>('none');
  const [vets, setVets] = useState<Pick<Profile, 'id' | 'first_name' | 'last_name'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: v } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .eq('active', true)
        .order('first_name');
      setVets(v ?? []);

      let targetPet = petId;
      if (id) {
        const { data, error: err } = await supabase.from('appointments').select('*').eq('id', id).single();
        if (err) setError(err.message);
        else {
          const a = data as Appointment;
          targetPet = a.pet_id;
          setDate(fmtDate(new Date(a.starts_at)));
          setTime(fmtTime(a.starts_at));
          setDuration(String(a.duration_min));
          setReason(a.reason);
          setNotes(a.notes ?? '');
          setVetId(a.vet_id ?? 'none');
        }
      }
      if (targetPet) {
        const { data } = await supabase
          .from('pets')
          .select('*, client:clients(id, first_name, last_name, phone)')
          .eq('id', targetPet)
          .single();
        setPet((data as PetWithClient) ?? null);
      }
      setLoading(false);
    }
    load();
  }, [id, petId]);

  async function save() {
    setError(null);
    if (!pet) return setError('Elegí la mascota.');
    if (!reason.trim()) return setError('El motivo es obligatorio.');
    const when = inputToDateTime(date, time);
    if (!when) return setError('Revisá la fecha (DD/MM/AAAA) y la hora (HH:MM).');
    const minutes = Number(duration);

    // Aviso si se superpone con otro turno pendiente (no bloquea).
    const end = new Date(when.getTime() + minutes * 60000);
    const { data: overlap } = await supabase
      .from('appointments')
      .select('id, starts_at, duration_min')
      .eq('status', 'pendiente')
      .gte('starts_at', new Date(when.getTime() - 4 * 3600000).toISOString())
      .lt('starts_at', end.toISOString());
    const clash = (overlap ?? []).some(
      (o) => o.id !== id && new Date(o.starts_at).getTime() + o.duration_min * 60000 > when.getTime(),
    );
    if (clash) {
      const ok = await confirm(
        'Horario ocupado',
        'Ya hay otro turno pendiente en ese horario. ¿Querés guardarlo igual?',
        { okText: 'Guardar igual' },
      );
      if (!ok) return;
    }

    const payload = {
      pet_id: pet.id,
      client_id: pet.client_id,
      vet_id: vetId === 'none' ? null : vetId,
      starts_at: when.toISOString(),
      duration_min: minutes,
      reason: reason.trim(),
      notes: notes.trim() || null,
    };

    setSaving(true);
    const res = id
      ? await supabase.from('appointments').update(payload).eq('id', id).select('id').single()
      : await supabase.from('appointments').insert(payload).select('id').single();
    setSaving(false);
    if (res.error) {
      toast.error('No se pudo guardar el turno', res.error.message);
      return setError(res.error.message);
    }
    toast.success(id ? 'Turno modificado' : 'Turno agendado', `${pet.name} · ${fmtDate(when)} ${fmtTime(when)}`);
    router.replace({ pathname: '/turnos', params: { turno: res.data.id } });
  }

  return (
    <Screen title={id ? 'Modificar turno' : 'Nuevo turno'} back loading={loading}>
      <Card style={{ gap: space.lg }}>
        <Field label="Mascota" required hint="El turno queda asignado también a su dueño actual">
          <PetPicker value={pet} onChange={setPet} />
        </Field>
        <FormRow>
          <Field label="Fecha" required>
            <DateInput value={date} onChangeText={setDate} />
          </Field>
          <Field label="Hora" required>
            <TimeInput value={time} onChangeText={setTime} />
          </Field>
        </FormRow>
        <Field label="Duración (minutos)">
          <Segmented value={duration} onChange={setDuration} options={DURATIONS.map((d) => ({ value: d, label: d }))} />
        </Field>
        <Field label="Motivo de la consulta" required>
          <Input value={reason} onChangeText={setReason} placeholder="Ej: vacunación, control, cirugía" />
        </Field>
        <Field label="Veterinario">
          <Segmented
            value={vetId}
            onChange={setVetId}
            options={[
              { value: 'none', label: 'Sin asignar' },
              ...vets.map((v) => ({ value: v.id, label: `${v.first_name} ${v.last_name}`.trim() || 'Usuario' })),
            ]}
          />
        </Field>
        <Field label="Notas">
          <Input value={notes} onChangeText={setNotes} multiline />
        </Field>

        {error ? <ErrorBox message={error} /> : null}

        <Row style={{ justifyContent: 'flex-end' }}>
          <Button title="Cancelar" variant="ghost" onPress={() => router.back()} />
          <Button title="Guardar turno" icon="content-save-outline" onPress={save} loading={saving} />
        </Row>
      </Card>
    </Screen>
  );
}
