import { router } from 'expo-router';
import { useState } from 'react';

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
  SearchBar,
  Segmented,
} from '@/components/ui';
import { clientStatus } from '@/lib/labels';
import { cleanSearch, supabase } from '@/lib/supabase';
import { space } from '@/lib/theme';
import type { Client } from '@/lib/types';
import { useQuery } from '@/lib/use-query';
import { clientsOffline } from '@/lib/offline-queries';

type Filter = 'activos' | 'inactivos' | 'todos';
type ClientRow = Client & { pets: { count: number }[] };

export default function ClientsScreen() {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('activos');

  const { data, loading, error } = useQuery<ClientRow[]>(() => {
    let query = supabase.from('clients').select('*, pets(count)').order('last_name').order('first_name').limit(200);
    if (filter !== 'todos') query = query.eq('active', filter === 'activos');
    const term = cleanSearch(q);
    if (term) query = query.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%`);
    return query;
  }, [q, filter], 'clientes', (m) => clientsOffline(m, q, filter));

  return (
    <Screen
      loading={loading && !data}
      title="Clientes"
      subtitle="Dueños y tutores de las mascotas"
      actions={<Button title="Nuevo cliente" icon="account-plus-outline" variant="accent" onPress={() => router.push('/clientes/form')} />}
    >
      <Card style={{ gap: space.md }}>
        <SearchBar value={q} onChangeText={setQ} placeholder="Buscar por nombre, apellido o email" />
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'activos', label: 'Activos' },
            { value: 'inactivos', label: 'Inactivos' },
            { value: 'todos', label: 'Todos' },
          ]}
        />
      </Card>

      {error ? <ErrorBox message={error} /> : null}

      <Card style={{ gap: 2 }}>
        {data?.length === 0 ? <EmptyState icon="account-search-outline" text="No se encontraron clientes." /> : null}
        {data?.map((c) => {
          const st = clientStatus(c.active);
          const petCount = c.pets?.[0]?.count ?? 0;
          return (
            <ListItem
              key={c.id}
              left={<Avatar text={initials(c.first_name, c.last_name)} />}
              title={`${c.last_name}, ${c.first_name}`}
              subtitle={[c.phone, c.email, `${petCount} ${petCount === 1 ? 'mascota' : 'mascotas'}`]
                .filter(Boolean)
                .join(' · ')}
              right={
                <Row>
                  {!c.active && <Chip label={st.label} fg={st.fg} bg={st.bg} />}
                  <Icon name="chevron-right" />
                </Row>
              }
              onPress={() => router.push(`/clientes/${c.id}`)}
            />
          );
        })}
      </Card>
    </Screen>
  );
}
