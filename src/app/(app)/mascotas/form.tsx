import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { ClientPicker } from '@/components/pickers';
import {
  Button,
  Card,
  DateInput,
  ErrorBox,
  Field,
  FormRow,
  Input,
  Loading,
  Row,
  Screen,
  Segmented,
  Txt,
} from '@/components/ui';
import { fmtDate, inputToDbDate } from '@/lib/dates';
import { speciesOptions } from '@/lib/labels';
import { supabase } from '@/lib/supabase';
import { space } from '@/lib/theme';
import type { Client, PetSex, PetSpecies, PetWithClient } from '@/lib/types';

type ClientLite = Pick<Client, 'id' | 'first_name' | 'last_name' | 'phone' | 'email'>;

export default function PetFormScreen() {
  const { id, clientId } = useLocalSearchParams<{ id?: string; clientId?: string }>();
  const [loading, setLoading] = useState(!!id || !!clientId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [species, setSpecies] = useState<PetSpecies | null>(null);
  const [breed, setBreed] = useState('');
  const [birth, setBirth] = useState('');
  const [sex, setSex] = useState<PetSex | null>(null);
  const [sterilized, setSterilized] = useState<'si' | 'no'>('no');
  const [microchip, setMicrochip] = useState('');
  const [allergies, setAllergies] = useState('');
  const [notes, setNotes] = useState('');
  const [client, setClient] = useState<ClientLite | null>(null);
  const [originalClientId, setOriginalClientId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (id) {
        const { data, error: err } = await supabase
          .from('pets')
          .select('*, client:clients(id, first_name, last_name, phone, email)')
          .eq('id', id)
          .single();
        if (err) setError(err.message);
        else {
          const p = data as PetWithClient & { client: ClientLite | null };
          setName(p.name);
          setSpecies(p.species);
          setBreed(p.breed ?? '');
          setBirth(p.birth_date ? fmtDate(p.birth_date) : '');
          setSex(p.sex);
          setSterilized(p.sterilized ? 'si' : 'no');
          setMicrochip(p.microchip ?? '');
          setAllergies(p.allergies ?? '');
          setNotes(p.notes ?? '');
          setClient(p.client);
          setOriginalClientId(p.client_id);
        }
      } else if (clientId) {
        const { data } = await supabase
          .from('clients')
          .select('id, first_name, last_name, phone, email')
          .eq('id', clientId)
          .single();
        setClient((data as ClientLite) ?? null);
      }
      setLoading(false);
    }
    load();
  }, [id, clientId]);

  async function save() {
    setError(null);
    if (!name.trim()) return setError('El nombre es obligatorio.');
    if (!species) return setError('Elegí la especie.');
    let birthDb: string | null = null;
    if (birth.trim()) {
      birthDb = inputToDbDate(birth);
      if (!birthDb) return setError('La fecha de nacimiento tiene que ser DD/MM/AAAA.');
    }

    const payload = {
      name: name.trim(),
      species,
      breed: breed.trim() || null,
      birth_date: birthDb,
      sex,
      sterilized: sterilized === 'si',
      microchip: microchip.trim() || null,
      allergies: allergies.trim() || null,
      notes: notes.trim() || null,
      client_id: client?.id ?? null,
    };

    setSaving(true);
    const res = id
      ? await supabase.from('pets').update(payload).eq('id', id).select('id').single()
      : await supabase.from('pets').insert(payload).select('id').single();
    setSaving(false);
    if (res.error) return setError(res.error.message);
    router.replace(`/mascotas/${res.data.id}`);
  }

  const ownerChanged = !!id && (client?.id ?? null) !== originalClientId;

  return (
    <Screen title={id ? 'Editar mascota' : 'Nueva mascota'} back>
      {loading ? (
        <Loading />
      ) : (
        <Card style={{ gap: space.lg }}>
          <FormRow>
            <Field label="Nombre" required>
              <Input value={name} onChangeText={setName} />
            </Field>
            <Field label="Raza">
              <Input value={breed} onChangeText={setBreed} placeholder="Ej: Golden Retriever, mestizo" />
            </Field>
          </FormRow>

          <Field label="Especie" required>
            <Segmented value={species} onChange={setSpecies} options={speciesOptions} />
          </Field>

          <FormRow>
            <Field label="Fecha de nacimiento" hint="Aproximada si no se sabe">
              <DateInput value={birth} onChangeText={setBirth} />
            </Field>
            <Field label="Sexo">
              <Segmented<PetSex>
                value={sex}
                onChange={setSex}
                options={[
                  { value: 'macho', label: 'Macho' },
                  { value: 'hembra', label: 'Hembra' },
                ]}
              />
            </Field>
            <Field label="Esterilizado">
              <Segmented<'si' | 'no'>
                value={sterilized}
                onChange={setSterilized}
                options={[
                  { value: 'si', label: 'Sí' },
                  { value: 'no', label: 'No' },
                ]}
              />
            </Field>
          </FormRow>

          <Field label="Dueño / tutor" hint="Puede quedar sin dueño (rescatada, en adopción o de la veterinaria)">
            <ClientPicker value={client} onChange={setClient} allowNone />
          </Field>
          {ownerChanged ? (
            <Txt variant="small">
              Al guardar se cambia el dueño. El historial clínico se conserva y el dueño anterior queda
              registrado en el historial de dueños.
            </Txt>
          ) : null}

          <FormRow>
            <Field label="Microchip">
              <Input value={microchip} onChangeText={setMicrochip} />
            </Field>
            <Field label="Alergias / alertas médicas">
              <Input value={allergies} onChangeText={setAllergies} placeholder="Ej: penicilina" />
            </Field>
          </FormRow>

          <Field label="Notas">
            <Input value={notes} onChangeText={setNotes} multiline />
          </Field>

          {error ? <ErrorBox message={error} /> : null}

          <Row style={{ justifyContent: 'flex-end' }}>
            <Button title="Cancelar" variant="ghost" onPress={() => router.back()} />
            <Button title="Guardar" icon="content-save-outline" onPress={save} loading={saving} />
          </Row>
        </Card>
      )}
    </Screen>
  );
}
