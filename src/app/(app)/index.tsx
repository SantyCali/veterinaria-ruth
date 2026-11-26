import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { APPOINTMENT_SELECT, AppointmentRow } from '@/components/rows';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorBox,
  Icon,
  ListItem,
  Avatar,
  Loading,
  Row,
  Screen,
  SectionTitle,
  StatCard,
  Txt,
} from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { addDays, fmtDateTime, fmtLongDate, greeting, startOfDay } from '@/lib/dates';
import { speciesIcon, taskKind } from '@/lib/labels';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/lib/theme';
import type { AppointmentFull, ConsultationFull, Task } from '@/lib/types';
import { useQuery } from '@/lib/use-query';

type DashboardData = {
  today: AppointmentFull[];
  tasks: Task[];
  consultations: ConsultationFull[];
};

export default function DashboardScreen() {
  const { profile } = useAuth();
  const [now] = useState(() => Date.now());

  const { data, loading, error } = useQuery<DashboardData>(async () => {
    const from = startOfDay(new Date());
    const to = addDays(from, 1);
    const [appts, tasks, cons] = await Promise.all([
      supabase
        .from('appointments')
        .select(APPOINTMENT_SELECT)
        .gte('starts_at', from.toISOString())
        .lt('starts_at', to.toISOString())
        .order('starts_at'),
      supabase
        .from('tasks')
        .select('*')
        .eq('active', true)
        .is('completed_at', null)
        .order('due_at', { ascending: true, nullsFirst: false })
        .limit(20),
      supabase
        .from('consultations')
        .select('*, vet:profiles!consultations_vet_id_fkey(id, first_name, last_name), pet:pets(id, name, species)')
        .order('consulted_at', { ascending: false })
        .limit(5),
    ]);
    const err = appts.error ?? tasks.error ?? cons.error;
    return {
      error: err,
      data: err
        ? null
        : {
            today: appts.data as AppointmentFull[],
            tasks: tasks.data as Task[],
            consultations: cons.data as ConsultationFull[],
          },
    };
  }, []);

  const today = data?.today ?? [];
  const pending = today.filter((a) => a.status === 'pendiente');
  const attended = today.filter((a) => a.status === 'atendido').length;
  const cancelled = today.filter((a) => a.status === 'cancelado').length;
  const tasks = (data?.tasks ?? []).filter((t) => t.kind !== 'recordatorio');
  const reminders = (data?.tasks ?? []).filter((t) => t.kind === 'recordatorio');
  const overdue = (data?.tasks ?? []).filter((t) => t.due_at && new Date(t.due_at).getTime() < now).length;

  const name = profile?.first_name ? `, ${profile.first_name}` : '';

  return (
    <Screen
      title={`¡${greeting()}${name}!`}
      subtitle={`${capitalize(fmtLongDate(new Date()))} · ${pending.length} turnos pendientes y ${tasks.length} tareas por hacer`}
      actions={
        <>
          <Button title="Cliente" icon="account-plus-outline" variant="secondary" small onPress={() => router.push('/clientes/form')} />
          <Button title="Mascota" icon="paw" variant="secondary" small onPress={() => router.push('/mascotas/form')} />
          <Button title="Turno" icon="calendar-plus" variant="accent" small onPress={() => router.push('/turnos/form')} />
        </>
      }
    >
      {error ? <ErrorBox message={error} /> : null}
      {loading && !data ? <Loading /> : null}

      <Row wrap gap={space.lg} style={{ alignItems: 'stretch' }}>
        <StatCard
          icon="calendar-today"
          label="Turnos de hoy"
          value={today.length}
          detail={`${attended} atendidos · ${pending.length} pend. · ${cancelled} canc.`}
        />
        <StatCard icon="clipboard-list-outline" label="Tareas pendientes" value={tasks.length} detail={overdue ? `${overdue} vencidas` : 'Ninguna vencida'} tone={colors.info} />
        <StatCard icon="bell-ring-outline" label="Recordatorios" value={reminders.length} detail="Sin completar" tone={colors.accent} />
        <StatCard icon="stethoscope" label="Últimas consultas" value={data?.consultations.length ?? 0} detail="Registradas recientemente" tone={colors.success} />
      </Row>

      <Row wrap gap={space.lg} style={{ alignItems: 'flex-start' }}>
        <Card style={{ flex: 2, minWidth: 300, gap: space.sm }}>
          <SectionTitle
            title="Próximos turnos de hoy"
            action={<Button title="Ver calendario" variant="ghost" small onPress={() => router.navigate('/turnos')} />}
          />
          {today.length === 0 && !loading ? <EmptyState icon="calendar-blank" text="No hay turnos para hoy." /> : null}
          {today.map((a) => (
            <AppointmentRow key={a.id} appt={a} onPress={() => router.push({ pathname: '/turnos', params: { turno: a.id } })} />
          ))}
        </Card>

        <View style={{ flex: 1, minWidth: 280, gap: space.lg }}>
          <Card style={{ gap: space.sm }}>
            <SectionTitle
              title="Tareas del día"
              action={<Button title="Agenda" variant="ghost" small onPress={() => router.navigate('/agenda')} />}
            />
            {tasks.length === 0 ? <Txt variant="muted">No hay tareas pendientes.</Txt> : null}
            {tasks.slice(0, 5).map((t) => (
              <TaskLine key={t.id} task={t} now={now} />
            ))}
          </Card>

          <Card style={{ gap: space.sm, borderLeftWidth: 4, borderLeftColor: colors.accent }}>
            <SectionTitle title="Recordatorios" />
            {reminders.length === 0 ? <Txt variant="muted">Sin recordatorios pendientes.</Txt> : null}
            {reminders.slice(0, 5).map((t) => (
              <TaskLine key={t.id} task={t} now={now} />
            ))}
          </Card>
        </View>
      </Row>

      <Card style={{ gap: space.sm }}>
        <SectionTitle title="Últimas consultas registradas" />
        {data?.consultations.length === 0 ? <EmptyState icon="stethoscope" text="Todavía no hay consultas." /> : null}
        {data?.consultations.map((c) => (
          <ListItem
            key={c.id}
            left={<Avatar icon={c.pet ? speciesIcon[c.pet.species] : 'paw'} size={36} />}
            title={`${c.pet?.name ?? 'Mascota'} · ${c.reason}`}
            subtitle={`${fmtDateTime(c.consulted_at)}${c.diagnosis ? ` · Dx: ${c.diagnosis}` : ''}${
              c.vet ? ` · ${c.vet.first_name} ${c.vet.last_name}` : ''
            }`}
            right={<Icon name="chevron-right" />}
            onPress={() => router.push(`/mascotas/${c.pet_id}`)}
          />
        ))}
      </Card>
    </Screen>
  );
}

function TaskLine({ task, now }: { task: Task; now: number }) {
  const k = taskKind[task.kind];
  const overdue = task.due_at && new Date(task.due_at).getTime() < now;
  return (
    <Pressable onPress={() => router.navigate('/agenda')} style={{ gap: 2, paddingVertical: 6 }}>
      <Row gap={6} wrap>
        <Txt variant="bodyStrong" style={{ flexShrink: 1 }}>
          {task.title}
        </Txt>
        <Chip label={k.label} fg={k.fg} bg={k.bg} />
      </Row>
      {task.due_at ? (
        <Txt variant="small" style={overdue ? { color: colors.danger } : undefined}>
          {overdue ? 'Vencida · ' : ''}
          {fmtDateTime(task.due_at)}
        </Txt>
      ) : null}
    </Pressable>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
