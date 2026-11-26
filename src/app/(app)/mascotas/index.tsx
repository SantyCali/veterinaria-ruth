import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  Avatar,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorBox,
  Loading,
  Row,
  Screen,
  SearchBar,
  Segmented,
  Txt,
} from '@/components/ui';
import { fmtAge } from '@/lib/dates';
import { petStatus, speciesIcon, speciesLabel, speciesOptions } from '@/lib/labels';
import { cleanSearch, supabase } from '@/lib/supabase';
import { colors, radius, space } from '@/lib/theme';
import type { PetSpecies, PetWithClient } from '@/lib/types';
import { useQuery } from '@/lib/use-query';

type Filter = 'activas' | 'sin_dueno' | 'inactivas' | 'fallecidas' | 'todas';

export default function PetsScreen() {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('activas');
  const [species, setSpecies] = useState<PetSpecies | 'todas'>('todas');

  const { data, loading, error } = useQuery<PetWithClient[]>(() => {
    let query = supabase
      .from('pets')
      .select('*, client:clients(id, first_name, last_name, phone)')
      .order('name')
      .limit(200);
    if (filter === 'activas') query = query.eq('status', 'activa');
    if (filter === 'inactivas') query = query.eq('status', 'inactiva');
    if (filter === 'fallecidas') query = query.eq('status', 'fallecida');
    if (filter === 'sin_dueno') query = query.is('client_id', null).neq('status', 'fallecida');
    if (species !== 'todas') query = query.eq('species', species);
    const term = cleanSearch(q);
    if (term) query = query.or(`name.ilike.%${term}%,breed.ilike.%${term}%,microchip.ilike.%${term}%`);
    return query;
  }, [q, filter, species]);

  return (
    <Screen
      title="Mascotas"
      subtitle="Pacientes de la veterinaria"
      actions={<Button title="Nueva mascota" icon="plus" variant="accent" onPress={() => router.push('/mascotas/form')} />}
    >
      <Card style={{ gap: space.md }}>
        <SearchBar value={q} onChangeText={setQ} placeholder="Buscar por nombre, raza o chip" />
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'activas', label: 'Activas' },
            { value: 'sin_dueno', label: 'Sin dueño' },
            { value: 'inactivas', label: 'Inactivas' },
            { value: 'fallecidas', label: 'Fallecidas' },
            { value: 'todas', label: 'Todas' },
          ]}
        />
        <Segmented<PetSpecies | 'todas'>
          value={species}
          onChange={setSpecies}
          options={[{ value: 'todas', label: 'Todas las especies' }, ...speciesOptions]}
        />
      </Card>

      {error ? <ErrorBox message={error} /> : null}
      {loading && !data ? <Loading /> : null}
      {data?.length === 0 ? <EmptyState text="No se encontraron mascotas." /> : null}

      <View style={styles.grid}>
        {data?.map((p) => {
          const st = petStatus[p.status];
          return (
            <Pressable
              key={p.id}
              onPress={() => router.push(`/mascotas/${p.id}`)}
              style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.surfaceAlt }]}
            >
              <Row gap={space.md}>
                <Avatar icon={speciesIcon[p.species]} size={48} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt variant="h3" numberOfLines={1}>
                    {p.name}
                  </Txt>
                  <Txt variant="small" numberOfLines={1}>
                    {[speciesLabel[p.species], p.breed, fmtAge(p.birth_date)].filter(Boolean).join(' · ')}
                  </Txt>
                </View>
              </Row>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt variant="small" numberOfLines={1} style={{ flex: 1 }}>
                  {p.client ? `Tutor: ${p.client.first_name} ${p.client.last_name}` : 'Sin dueño'}
                </Txt>
                <Chip label={st.label} fg={st.fg} bg={st.bg} />
              </Row>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  card: {
    flexGrow: 1,
    flexBasis: 280,
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
});
