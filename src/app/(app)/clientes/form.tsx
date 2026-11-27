import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { Button, Card, ErrorBox, Field, FormRow, Input, Row, Screen } from '@/components/ui';
import { toast } from '@/lib/dialogs';
import { supabase } from '@/lib/supabase';
import { space } from '@/lib/theme';
import type { Client } from '@/lib/types';

const EMPTY = { first_name: '', last_name: '', email: '', phone: '', address: '', notes: '' };

export default function ClientFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else {
          const c = data as Client;
          setForm({
            first_name: c.first_name,
            last_name: c.last_name,
            email: c.email ?? '',
            phone: c.phone ?? '',
            address: c.address ?? '',
            notes: c.notes ?? '',
          });
        }
        setLoading(false);
      });
  }, [id]);

  const set = (key: keyof typeof EMPTY) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function save() {
    setError(null);
    if (!form.first_name.trim() || !form.last_name.trim()) return setError('Nombre y apellido son obligatorios.');
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) return setError('El email no es válido.');

    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim().toLowerCase() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
    };

    setSaving(true);
    const res = id
      ? await supabase.from('clients').update(payload).eq('id', id).select('id').single()
      : await supabase.from('clients').insert(payload).select('id').single();
    setSaving(false);

    if (res.error) {
      toast.error('No se pudo guardar el cliente', res.error.message);
      return setError(res.error.message);
    }
    toast.success(id ? 'Cliente actualizado' : 'Cliente creado', `${payload.first_name} ${payload.last_name}`);
    router.replace(`/clientes/${res.data.id}`);
  }

  return (
    <Screen title={id ? 'Editar cliente' : 'Nuevo cliente'} back loading={loading}>
      <Card style={{ gap: space.lg }}>
        <FormRow>
          <Field label="Nombre" required>
            <Input value={form.first_name} onChangeText={set('first_name')} autoComplete="given-name" />
          </Field>
          <Field label="Apellido" required>
            <Input value={form.last_name} onChangeText={set('last_name')} autoComplete="family-name" />
          </Field>
        </FormRow>
        <FormRow>
          <Field label="Email">
            <Input
              value={form.email}
              onChangeText={set('email')}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </Field>
          <Field label="Teléfono" hint="Con código de área, ej: 11 4829-1923">
            <Input value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
          </Field>
        </FormRow>
        <Field label="Dirección">
          <Input value={form.address} onChangeText={set('address')} />
        </Field>
        <Field label="Notas">
          <Input value={form.notes} onChangeText={set('notes')} multiline />
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
