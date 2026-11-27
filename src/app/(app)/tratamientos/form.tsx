import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { Button, Card, DateInput, ErrorBox, Field, FormRow, Input, Row, Screen } from '@/components/ui';
import { fmtDate, inputToDbDate } from '@/lib/dates';
import { toast } from '@/lib/dialogs';
import { supabase } from '@/lib/supabase';
import { space } from '@/lib/theme';
import type { Treatment } from '@/lib/types';

const EMPTY = {
  name: '',
  dose: '',
  frequency: '',
  duration: '',
  start_date: '',
  end_date: '',
  instructions: '',
};

export default function TreatmentFormScreen() {
  const { id, petId, consultationId } = useLocalSearchParams<{
    id?: string;
    petId: string;
    consultationId?: string;
  }>();
  const [form, setForm] = useState({ ...EMPTY, start_date: fmtDate(new Date()) });
  const [linkedConsultation, setLinkedConsultation] = useState<string | null>(consultationId ?? null);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('treatments')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else {
          const t = data as Treatment;
          setLinkedConsultation(t.consultation_id);
          setForm({
            name: t.name,
            dose: t.dose ?? '',
            frequency: t.frequency ?? '',
            duration: t.duration ?? '',
            start_date: t.start_date ? fmtDate(t.start_date) : '',
            end_date: t.end_date ? fmtDate(t.end_date) : '',
            instructions: t.instructions ?? '',
          });
        }
        setLoading(false);
      });
  }, [id]);

  const set = (key: keyof typeof EMPTY) => (v: string) => setForm((f) => ({ ...f, [key]: v }));

  async function save() {
    setError(null);
    if (!form.name.trim()) return setError('El nombre del medicamento o tratamiento es obligatorio.');
    const start = form.start_date.trim() ? inputToDbDate(form.start_date) : null;
    const end = form.end_date.trim() ? inputToDbDate(form.end_date) : null;
    if (form.start_date.trim() && !start) return setError('Fecha de inicio inválida (DD/MM/AAAA).');
    if (form.end_date.trim() && !end) return setError('Fecha de finalización inválida (DD/MM/AAAA).');
    if (start && end && end < start) return setError('La fecha de fin no puede ser anterior al inicio.');

    const payload = {
      pet_id: petId,
      consultation_id: linkedConsultation,
      name: form.name.trim(),
      dose: form.dose.trim() || null,
      frequency: form.frequency.trim() || null,
      duration: form.duration.trim() || null,
      start_date: start,
      end_date: end,
      instructions: form.instructions.trim() || null,
    };

    setSaving(true);
    const res = id
      ? await supabase.from('treatments').update(payload).eq('id', id)
      : await supabase.from('treatments').insert(payload);
    setSaving(false);
    if (res.error) {
      toast.error('No se pudo guardar el tratamiento', res.error.message);
      return setError(res.error.message);
    }
    toast.success(id ? 'Tratamiento actualizado' : 'Tratamiento registrado', payload.name);
    router.back();
  }

  return (
    <Screen
      title={id ? 'Editar tratamiento' : 'Nuevo tratamiento'}
      subtitle={linkedConsultation ? 'Asociado a una consulta' : undefined}
      back
      loading={loading}
    >
      <Card style={{ gap: space.lg }}>
        <Field label="Medicamento o tratamiento" required>
          <Input value={form.name} onChangeText={set('name')} placeholder="Ej: Amoxicilina 250 mg" />
        </Field>
        <FormRow>
          <Field label="Dosis">
            <Input value={form.dose} onChangeText={set('dose')} placeholder="Ej: 1 comprimido" />
          </Field>
          <Field label="Frecuencia">
            <Input value={form.frequency} onChangeText={set('frequency')} placeholder="Ej: cada 12 hs" />
          </Field>
          <Field label="Duración">
            <Input value={form.duration} onChangeText={set('duration')} placeholder="Ej: 7 días" />
          </Field>
        </FormRow>
        <FormRow>
          <Field label="Fecha de inicio">
            <DateInput value={form.start_date} onChangeText={set('start_date')} />
          </Field>
          <Field label="Fecha de finalización">
            <DateInput value={form.end_date} onChangeText={set('end_date')} />
          </Field>
        </FormRow>
        <Field label="Indicaciones adicionales">
          <Input value={form.instructions} onChangeText={set('instructions')} multiline />
        </Field>

        {error ? <ErrorBox message={error} /> : null}

        <Row style={{ justifyContent: 'flex-end' }}>
          <Button title="Cancelar" variant="ghost" onPress={() => router.back()} />
          <Button title="Guardar" icon="content-save-outline" onPress={save} loading={saving} />
        </Row>
      </Card>
    </Screen>
  );
}
