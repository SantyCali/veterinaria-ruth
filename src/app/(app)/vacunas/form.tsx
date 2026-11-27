import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button, Card, DateInput, ErrorBox, Field, FormRow, Input, Row, Screen, Segmented, Txt } from '@/components/ui';
import { addDays, fmtDate, inputToDbDate, parseDbDate } from '@/lib/dates';
import { toast } from '@/lib/dialogs';
import { supabase } from '@/lib/supabase';
import { space } from '@/lib/theme';
import type { Vaccination } from '@/lib/types';

/** Vacunas más comunes, para cargar con un toque. */
const COMMON = [
  'Antirrábica',
  'Séxtuple canina',
  'Óctuple canina',
  'Tos de las perreras',
  'Triple felina',
  'Leucemia felina',
] as const;

/** Atajos para la próxima dosis, contados desde la fecha de aplicación. */
const NEXT_IN = [
  { value: '21', label: '21 días' },
  { value: '30', label: '1 mes' },
  { value: '180', label: '6 meses' },
  { value: '365', label: '1 año' },
] as const;

export default function VaccinationFormScreen() {
  const { id, petId } = useLocalSearchParams<{ id?: string; petId: string }>();
  const [vaccine, setVaccine] = useState('');
  const [appliedOn, setAppliedOn] = useState(fmtDate(new Date()));
  const [nextDue, setNextDue] = useState('');
  const [batch, setBatch] = useState('');
  const [notes, setNotes] = useState('');
  const [petName, setPetName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const [pet, vac] = await Promise.all([
        supabase.from('pets').select('name').eq('id', petId).single(),
        id ? supabase.from('vaccinations').select('*').eq('id', id).single() : Promise.resolve(null),
      ]);
      if (pet.data) setPetName(pet.data.name);
      if (vac?.error) setError(vac.error.message);
      else if (vac?.data) {
        const v = vac.data as Vaccination;
        setVaccine(v.vaccine);
        setAppliedOn(fmtDate(v.applied_on));
        setNextDue(v.next_due ? fmtDate(v.next_due) : '');
        setBatch(v.batch ?? '');
        setNotes(v.notes ?? '');
      }
      setLoading(false);
    }
    load();
  }, [id, petId]);

  function setNextIn(days: string) {
    const base = inputToDbDate(appliedOn);
    if (!base) return toast.warning('Primero poné la fecha de aplicación');
    setNextDue(fmtDate(addDays(parseDbDate(base), Number(days))));
  }

  async function save() {
    setError(null);
    if (!vaccine.trim()) return setError('Escribí o elegí la vacuna.');
    const applied = inputToDbDate(appliedOn);
    if (!applied) return setError('La fecha de aplicación tiene que ser DD/MM/AAAA.');
    let next: string | null = null;
    if (nextDue.trim()) {
      next = inputToDbDate(nextDue);
      if (!next) return setError('La próxima dosis tiene que ser DD/MM/AAAA.');
      if (next < applied) return setError('La próxima dosis no puede ser antes de la aplicación.');
    }

    const payload = {
      pet_id: petId,
      vaccine: vaccine.trim(),
      applied_on: applied,
      next_due: next,
      batch: batch.trim() || null,
      notes: notes.trim() || null,
    };
    setSaving(true);
    const res = id
      ? await supabase.from('vaccinations').update(payload).eq('id', id)
      : await supabase.from('vaccinations').insert(payload);
    setSaving(false);
    if (res.error) {
      toast.error('No se pudo guardar la vacuna', res.error.message);
      return setError(res.error.message);
    }
    toast.success(
      id ? 'Vacuna actualizada' : 'Vacuna registrada',
      next ? `${payload.vaccine} · próxima dosis ${fmtDate(next)}` : payload.vaccine,
    );
    router.back();
  }

  return (
    <Screen
      title={id ? 'Editar vacuna' : 'Registrar vacuna'}
      subtitle={petName ? `Paciente: ${petName}` : undefined}
      back
      loading={loading}
    >
      <Card style={{ gap: space.lg }}>
        <Field label="Vacuna" required>
          <Input value={vaccine} onChangeText={setVaccine} placeholder="Ej: Antirrábica" />
        </Field>
        <View style={{ gap: 6 }}>
          <Txt variant="small">Más usadas:</Txt>
          <Segmented
            value={COMMON.includes(vaccine as (typeof COMMON)[number]) ? vaccine : null}
            onChange={setVaccine}
            options={COMMON.map((c) => ({ value: c, label: c }))}
          />
        </View>

        <FormRow>
          <Field label="Fecha de aplicación" required>
            <DateInput value={appliedOn} onChangeText={setAppliedOn} />
          </Field>
          <Field label="Próxima dosis" hint="Vacío si no lleva refuerzo">
            <DateInput value={nextDue} onChangeText={setNextDue} />
          </Field>
        </FormRow>
        <View style={{ gap: 6 }}>
          <Txt variant="small">Próxima dosis en:</Txt>
          <Segmented<string> value={null} onChange={setNextIn} options={[...NEXT_IN]} />
        </View>

        <FormRow>
          <Field label="Lote">
            <Input value={batch} onChangeText={setBatch} placeholder="Ej: DEF-8821B" />
          </Field>
          <Field label="Notas">
            <Input value={notes} onChangeText={setNotes} />
          </Field>
        </FormRow>

        {error ? <ErrorBox message={error} /> : null}

        <Row style={{ justifyContent: 'flex-end' }}>
          <Button title="Cancelar" variant="ghost" onPress={() => router.back()} />
          <Button title="Guardar" icon="content-save-outline" onPress={save} loading={saving} />
        </Row>
      </Card>
    </Screen>
  );
}
