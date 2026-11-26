import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { PetPicker } from '@/components/pickers';
import {
  Button,
  Card,
  ErrorBox,
  Field,
  FormRow,
  Icon,
  Input,
  Loading,
  Row,
  Screen,
  Segmented,
  Txt,
} from '@/components/ui';
import { fmtDate, fmtTime, inputToDateTime } from '@/lib/dates';
import { notify } from '@/lib/dialogs';
import { pickAndUploadPetFile } from '@/lib/files';
import { fileCategoryOptions } from '@/lib/labels';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/lib/theme';
import type { Consultation, FileCategory, PetWithClient } from '@/lib/types';

const OPTIONAL = [
  { key: 'symptoms', label: 'Síntomas' },
  { key: 'diagnosis', label: 'Diagnóstico' },
  { key: 'treatment', label: 'Tratamiento indicado' },
  { key: 'medications', label: 'Medicamentos recetados' },
  { key: 'observations', label: 'Observaciones del veterinario' },
  { key: 'studies', label: 'Estudios realizados' },
  { key: 'study_results', label: 'Resultados de estudios' },
  { key: 'evolution', label: 'Evolución del paciente' },
] as const;

type OptionalKey = (typeof OPTIONAL)[number]['key'];

export default function ConsultationFormScreen() {
  const { id, petId, appointmentId } = useLocalSearchParams<{
    id?: string;
    petId?: string;
    appointmentId?: string;
  }>();

  const now = new Date();
  const [pet, setPet] = useState<PetWithClient | null>(null);
  const [date, setDate] = useState(fmtDate(now));
  const [time, setTime] = useState(fmtTime(now));
  const [reason, setReason] = useState('');
  const [weight, setWeight] = useState('');
  const [fields, setFields] = useState<Record<OptionalKey, string>>({
    symptoms: '',
    diagnosis: '',
    treatment: '',
    medications: '',
    observations: '',
    studies: '',
    study_results: '',
    evolution: '',
  });
  const [showMore, setShowMore] = useState(true);
  const [linkedAppointment, setLinkedAppointment] = useState<string | null>(appointmentId ?? null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<FileCategory>('laboratorio');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    async function load() {
      let targetPet = petId;
      if (id) {
        const { data, error: err } = await supabase.from('consultations').select('*').eq('id', id).single();
        if (err) setError(err.message);
        else {
          const c = data as Consultation;
          targetPet = c.pet_id;
          setDate(fmtDate(new Date(c.consulted_at)));
          setTime(fmtTime(c.consulted_at));
          setReason(c.reason);
          setWeight(c.weight_kg ? String(c.weight_kg) : '');
          setLinkedAppointment(c.appointment_id);
          setFields((f) => {
            const next = { ...f };
            for (const { key } of OPTIONAL) next[key] = c[key] ?? '';
            return next;
          });
        }
      } else if (appointmentId) {
        const { data } = await supabase.from('appointments').select('pet_id, reason').eq('id', appointmentId).single();
        if (data) {
          targetPet = data.pet_id;
          setReason(data.reason);
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
  }, [id, petId, appointmentId]);

  async function save() {
    setError(null);
    if (!pet) return setError('Elegí la mascota.');
    if (!reason.trim()) return setError('El motivo de consulta es obligatorio.');
    const when = inputToDateTime(date, time);
    if (!when) return setError('Revisá la fecha (DD/MM/AAAA) y la hora (HH:MM).');
    let weightKg: number | null = null;
    if (weight.trim()) {
      weightKg = Number(weight.replace(',', '.'));
      if (!Number.isFinite(weightKg) || weightKg <= 0) return setError('El peso tiene que ser un número, ej: 12,5');
    }

    const payload: Record<string, unknown> = {
      pet_id: pet.id,
      consulted_at: when.toISOString(),
      reason: reason.trim(),
      weight_kg: weightKg,
      appointment_id: linkedAppointment,
    };
    for (const { key } of OPTIONAL) payload[key] = fields[key].trim() || null;

    setSaving(true);
    const res = id
      ? await supabase.from('consultations').update(payload).eq('id', id).select('id').single()
      : await supabase.from('consultations').insert(payload).select('id').single();

    // Si la consulta viene de un turno, el turno queda como atendido.
    if (!res.error && linkedAppointment) {
      await supabase.from('appointments').update({ status: 'atendido' }).eq('id', linkedAppointment);
    }
    setSaving(false);
    if (res.error) return setError(res.error.message);
    router.replace(`/mascotas/${pet.id}`);
  }

  async function upload() {
    if (!id || !pet) return;
    setUploading(true);
    const err = await pickAndUploadPetFile({ petId: pet.id, consultationId: id, category });
    setUploading(false);
    notify(err ? 'No se pudo subir el archivo' : 'Archivo adjuntado a la consulta', err ?? undefined);
  }

  return (
    <Screen title={id ? 'Editar consulta' : 'Nueva consulta'} subtitle={pet ? `Paciente: ${pet.name}` : undefined} back>
      {loading ? (
        <Loading />
      ) : (
        <Card style={{ gap: space.lg }}>
          {!petId && !id && !appointmentId ? (
            <Field label="Mascota" required>
              <PetPicker value={pet} onChange={setPet} />
            </Field>
          ) : null}

          <FormRow>
            <Field label="Fecha" required hint="DD/MM/AAAA">
              <Input value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" />
            </Field>
            <Field label="Hora" required hint="HH:MM">
              <Input value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation" />
            </Field>
            <Field label="Peso (kg)">
              <Input value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="Ej: 12,5" />
            </Field>
          </FormRow>

          <Field label="Motivo de consulta" required>
            <Input value={reason} onChangeText={setReason} placeholder="Ej: control anual, vómitos, vacunación" />
          </Field>

          <Pressable onPress={() => setShowMore(!showMore)}>
            <Row>
              <Icon name={showMore ? 'chevron-up' : 'chevron-down'} color={colors.primary} />
              <Txt variant="bodyStrong" style={{ color: colors.primary }}>
                Detalle clínico (opcional)
              </Txt>
            </Row>
          </Pressable>

          {showMore && (
            <View style={{ gap: space.lg }}>
              {OPTIONAL.map(({ key, label }) => (
                <Field key={key} label={label}>
                  <Input
                    value={fields[key]}
                    onChangeText={(v) => setFields((f) => ({ ...f, [key]: v }))}
                    multiline
                  />
                </Field>
              ))}
            </View>
          )}

          {id ? (
            <View style={{ gap: space.sm }}>
              <Txt variant="bodyStrong">Adjuntar estudios a esta consulta</Txt>
              <Segmented value={category} onChange={setCategory} options={fileCategoryOptions} />
              <Button
                title="Subir archivo"
                icon="paperclip"
                variant="secondary"
                loading={uploading}
                onPress={upload}
                style={{ alignSelf: 'flex-start' }}
              />
            </View>
          ) : (
            <Txt variant="small">Podés adjuntar estudios una vez guardada la consulta (botón Editar).</Txt>
          )}

          {error ? <ErrorBox message={error} /> : null}

          <Row style={{ justifyContent: 'flex-end' }}>
            <Button title="Cancelar" variant="ghost" onPress={() => router.back()} />
            <Button title="Guardar consulta" icon="content-save-outline" onPress={save} loading={saving} />
          </Row>
        </Card>
      )}
    </Screen>
  );
}
