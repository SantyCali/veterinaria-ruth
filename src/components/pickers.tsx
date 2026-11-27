import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { PetAvatar } from './pet-avatar';
import { Avatar, Icon, initials, ListItem, SearchBar, Txt } from './ui';
import { speciesIcon, speciesLabel } from '@/lib/labels';
import { cleanSearch, supabase } from '@/lib/supabase';
import { colors, radius, space } from '@/lib/theme';
import type { Client, PetWithClient } from '@/lib/types';

type ClientLite = Pick<Client, 'id' | 'first_name' | 'last_name' | 'phone' | 'email'>;

/** Buscador para elegir un cliente (o "sin dueño" si allowNone). */
export function ClientPicker({
  value,
  onChange,
  allowNone,
}: {
  value: ClientLite | null;
  onChange: (c: ClientLite | null) => void;
  allowNone?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<ClientLite[]>([]);

  useEffect(() => {
    if (!open) return;
    const term = cleanSearch(q);
    let query = supabase
      .from('clients')
      .select('id, first_name, last_name, phone, email')
      .eq('active', true)
      .order('last_name')
      .limit(8);
    if (term) {
      query = query.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%`);
    }
    const t = setTimeout(async () => {
      const { data } = await query;
      setResults((data as ClientLite[]) ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [q, open]);

  return (
    <View style={{ gap: space.sm }}>
      <Pressable onPress={() => setOpen(!open)} style={pickerBox}>
        <Icon name="account-outline" />
        <Txt style={{ flex: 1 }}>
          {value ? `${value.first_name} ${value.last_name}` : allowNone ? 'Sin dueño' : 'Elegir cliente…'}
        </Txt>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} />
      </Pressable>
      {open && (
        <View style={dropdown}>
          <SearchBar value={q} onChangeText={setQ} placeholder="Buscar por nombre, apellido o email" />
          {allowNone && (
            <ListItem
              left={<Avatar icon="home-heart" size={32} />}
              title="Sin dueño"
              subtitle="Rescatada, en adopción o de la veterinaria"
              onPress={() => {
                onChange(null);
                setOpen(false);
              }}
            />
          )}
          {results.map((c) => (
            <ListItem
              key={c.id}
              left={<Avatar text={initials(c.first_name, c.last_name)} size={32} />}
              title={`${c.first_name} ${c.last_name}`}
              subtitle={[c.phone, c.email].filter(Boolean).join(' · ')}
              onPress={() => {
                onChange(c);
                setOpen(false);
              }}
            />
          ))}
          {results.length === 0 && <Txt variant="small">No hay clientes que coincidan.</Txt>}
        </View>
      )}
    </View>
  );
}

/** Buscador para elegir una mascota (muestra su dueño). */
export function PetPicker({
  value,
  onChange,
}: {
  value: PetWithClient | null;
  onChange: (p: PetWithClient) => void;
}) {
  const [open, setOpen] = useState(!value);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PetWithClient[]>([]);

  useEffect(() => {
    if (!open) return;
    const term = cleanSearch(q);
    let query = supabase
      .from('pets')
      .select('*, client:clients(id, first_name, last_name, phone)')
      .neq('status', 'fallecida')
      .order('name')
      .limit(8);
    if (term) query = query.or(`name.ilike.%${term}%,breed.ilike.%${term}%`);
    const t = setTimeout(async () => {
      const { data } = await query;
      setResults((data as PetWithClient[]) ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [q, open]);

  return (
    <View style={{ gap: space.sm }}>
      <Pressable onPress={() => setOpen(!open)} style={pickerBox}>
        <Icon name={value ? (speciesIcon[value.species]) : 'paw'} />
        <Txt style={{ flex: 1 }}>
          {value
            ? `${value.name} · ${value.client ? `${value.client.first_name} ${value.client.last_name}` : 'Sin dueño'}`
            : 'Elegir mascota…'}
        </Txt>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} />
      </Pressable>
      {open && (
        <View style={dropdown}>
          <SearchBar value={q} onChangeText={setQ} placeholder="Buscar mascota por nombre o raza" />
          {results.map((p) => (
            <ListItem
              key={p.id}
              left={<PetAvatar path={p.photo_path} species={p.species} size={32} />}
              title={p.name}
              subtitle={`${speciesLabel[p.species]}${p.breed ? ` · ${p.breed}` : ''} · ${
                p.client ? `${p.client.first_name} ${p.client.last_name}` : 'Sin dueño'
              }`}
              onPress={() => {
                onChange(p);
                setOpen(false);
              }}
            />
          ))}
          {results.length === 0 && <Txt variant="small">No hay mascotas que coincidan.</Txt>}
        </View>
      )}
    </View>
  );
}

const pickerBox = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 8,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: radius.md,
  paddingHorizontal: 12,
  paddingVertical: 10,
  backgroundColor: colors.surface,
};

const dropdown = {
  gap: 4,
  padding: space.sm,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: radius.md,
  backgroundColor: colors.surface,
};
