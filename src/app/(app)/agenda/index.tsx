import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  Button,
  Card,
  Chip,
  ErrorBox,
  Field,
  FormRow,
  Icon,
  IconButton,
  Input,
  Loading,
  Row,
  Screen,
  SectionTitle,
  Segmented,
  TimeInput,
  Txt,
} from '@/components/ui';
import { addDays, fmtDateTime, fmtLongDate, fmtTime, inputToDateTime, fmtDate, sameDay, startOfDay, toDbDate } from '@/lib/dates';
import { confirm } from '@/lib/dialogs';
import { taskKind } from '@/lib/labels';
import { supabase } from '@/lib/supabase';
import { colors, radius, space } from '@/lib/theme';
import type { DailyNote, Task, TaskKind } from '@/lib/types';
import { useQuery } from '@/lib/use-query';

type AgendaData = { tasks: Task[]; notes: DailyNote[] };

export default function AgendaScreen() {
  const [day, setDay] = useState(() => startOfDay(new Date()));
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<TaskKind>('tarea');
  const [time, setTime] = useState('');
  const [description, setDescription] = useState('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data, loading, error, reload } = useQuery<AgendaData>(async () => {
    const from = day.toISOString();
    const to = addDays(day, 1).toISOString();
    const [tasks, notes] = await Promise.all([
      supabase
        .from('tasks')
        .select('*')
        .eq('active', true)
        // Las del día + todas las pendientes (para ver vencidas y sin fecha).
        .or(`and(due_at.gte.${from},due_at.lt.${to}),completed_at.is.null`)
        .order('due_at', { ascending: true, nullsFirst: false }),
      supabase.from('daily_notes').select('*').eq('note_date', toDbDate(day)).order('created_at'),
    ]);
    const err = tasks.error ?? notes.error;
    return { error: err, data: err ? null : { tasks: tasks.data as Task[], notes: notes.data as DailyNote[] } };
  }, [day.getTime()]);

  const tasks = data?.tasks ?? [];
  const now = new Date();
  const dayEnd = addDays(day, 1);
  const ofDay = tasks.filter((t) => t.due_at && new Date(t.due_at) >= day && new Date(t.due_at) < dayEnd);
  const overdue = tasks.filter((t) => !t.completed_at && t.due_at && new Date(t.due_at) < now && new Date(t.due_at) < day);
  const noDate = tasks.filter((t) => !t.completed_at && !t.due_at);

  async function addTask() {
    setFormError(null);
    if (!title.trim()) return setFormError('Escribí la tarea.');
    let due: string | null = null;
    if (time.trim()) {
      const d = inputToDateTime(fmtDate(day), time);
      if (!d) return setFormError('La hora tiene que ser HH:MM.');
      due = d.toISOString();
    } else if (kind !== 'tarea') {
      // Recordatorios y actividades quedan en el día elegido aunque no tengan hora.
      const d = new Date(day);
      d.setHours(9, 0, 0, 0);
      due = d.toISOString();
    }
    setSaving(true);
    const { error: err } = await supabase
      .from('tasks')
      .insert({ title: title.trim(), kind, due_at: due, description: description.trim() || null });
    setSaving(false);
    if (err) return setFormError(err.message);
    setTitle('');
    setTime('');
    setDescription('');
    reload();
  }

  async function toggle(t: Task) {
    await supabase
      .from('tasks')
      .update({ completed_at: t.completed_at ? null : new Date().toISOString() })
      .eq('id', t.id);
    reload();
  }

  async function archive(t: Task) {
    const ok = await confirm('Quitar de la agenda', `"${t.title}" deja de mostrarse (no se borra).`, 'Quitar');
    if (!ok) return;
    await supabase.from('tasks').update({ active: false }).eq('id', t.id);
    reload();
  }

  async function addNote() {
    if (!note.trim()) return;
    await supabase.from('daily_notes').insert({ note_date: toDbDate(day), content: note.trim() });
    setNote('');
    reload();
  }

  const isToday = sameDay(day, new Date());

  return (
    <Screen
      title="Agenda del día"
      subtitle="Tareas, recordatorios, actividades y notas (independiente de los turnos)"
      actions={<Button title="Mi perfil" icon="account-cog-outline" variant="secondary" small onPress={() => router.navigate('/perfil')} />}
    >
      <Card>
        <Row style={{ justifyContent: 'center' }}>
          <IconButton icon="chevron-left" label="Día anterior" onPress={() => setDay(addDays(day, -1))} />
          <Txt variant="h3" style={{ minWidth: 220, textAlign: 'center' }}>
            {isToday ? 'Hoy, ' : ''}
            {fmtLongDate(day)}
          </Txt>
          <IconButton icon="chevron-right" label="Día siguiente" onPress={() => setDay(addDays(day, 1))} />
          {!isToday && <Button title="Hoy" variant="secondary" small onPress={() => setDay(startOfDay(new Date()))} />}
        </Row>
      </Card>

      {error ? <ErrorBox message={error} /> : null}

      <Row wrap gap={space.lg} style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 2, minWidth: 300, gap: space.lg }}>
          <Card style={{ gap: space.md }}>
            <SectionTitle title="Agregar" />
            <Segmented<TaskKind>
              value={kind}
              onChange={setKind}
              options={[
                { value: 'tarea', label: 'Tarea' },
                { value: 'recordatorio', label: 'Recordatorio' },
                { value: 'actividad', label: 'Actividad' },
              ]}
            />
            <FormRow>
              <Field label="Qué hay que hacer" required>
                <Input value={title} onChangeText={setTitle} placeholder="Ej: llamar al dueño de Toby" onSubmitEditing={addTask} />
              </Field>
              <Field label="Hora" width={120}>
                <TimeInput value={time} onChangeText={setTime} placeholder="16:00" />
              </Field>
            </FormRow>
            <Field label="Detalle">
              <Input value={description} onChangeText={setDescription} />
            </Field>
            {formError ? <ErrorBox message={formError} /> : null}
            <Button title="Agregar a la agenda" icon="plus" onPress={addTask} loading={saving} style={{ alignSelf: 'flex-start' }} />
          </Card>

          {loading && !data ? <Loading /> : null}

          {overdue.length > 0 && (
            <Card style={{ gap: space.sm, borderLeftWidth: 4, borderLeftColor: colors.danger }}>
              <SectionTitle title={`Vencidas (${overdue.length})`} />
              {overdue.map((t) => (
                <TaskItem key={t.id} t={t} onToggle={toggle} onArchive={archive} showDate />
              ))}
            </Card>
          )}

          <Card style={{ gap: space.sm }}>
            <SectionTitle title={`Del día (${ofDay.length})`} />
            {ofDay.length === 0 ? <Txt variant="muted">Nada programado para este día.</Txt> : null}
            {ofDay.map((t) => (
              <TaskItem key={t.id} t={t} onToggle={toggle} onArchive={archive} />
            ))}
          </Card>

          <Card style={{ gap: space.sm }}>
            <SectionTitle title={`Pendientes sin fecha (${noDate.length})`} />
            {noDate.length === 0 ? <Txt variant="muted">No hay pendientes sin fecha.</Txt> : null}
            {noDate.map((t) => (
              <TaskItem key={t.id} t={t} onToggle={toggle} onArchive={archive} />
            ))}
          </Card>
        </View>

        <Card style={{ flex: 1, minWidth: 260, gap: space.md, backgroundColor: '#fffbeb' }}>
          <SectionTitle title="Notas del día" />
          {(data?.notes ?? []).map((n) => (
            <View key={n.id} style={styles.note}>
              <Txt>{n.content}</Txt>
              <Txt variant="small">{fmtTime(n.created_at)}</Txt>
            </View>
          ))}
          {data?.notes.length === 0 ? <Txt variant="muted">Sin notas.</Txt> : null}
          <Input value={note} onChangeText={setNote} placeholder="Escribí una nota importante…" multiline />
          <Button title="Guardar nota" icon="note-plus-outline" variant="secondary" onPress={addNote} />
        </Card>
      </Row>
    </Screen>
  );
}

function TaskItem({
  t,
  onToggle,
  onArchive,
  showDate,
}: {
  t: Task;
  onToggle: (t: Task) => void;
  onArchive: (t: Task) => void;
  showDate?: boolean;
}) {
  const k = taskKind[t.kind];
  const done = !!t.completed_at;
  return (
    <View style={styles.task}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: done }} onPress={() => onToggle(t)}>
        <Icon name={done ? 'checkbox-marked' : 'checkbox-blank-outline'} size={24} color={done ? colors.success : colors.textSubtle} />
      </Pressable>
      <View style={{ flex: 1, gap: 2 }}>
        <Row wrap gap={6}>
          <Txt variant="bodyStrong" style={done ? { textDecorationLine: 'line-through', color: colors.textSubtle } : undefined}>
            {t.title}
          </Txt>
          <Chip label={k.label} fg={k.fg} bg={k.bg} />
        </Row>
        {t.due_at ? <Txt variant="small">{showDate ? fmtDateTime(t.due_at) : fmtTime(t.due_at)}</Txt> : null}
        {t.description ? <Txt variant="small">{t.description}</Txt> : null}
      </View>
      <IconButton icon="archive-outline" label="Quitar de la agenda" onPress={() => onArchive(t)} />
    </View>
  );
}

const styles = StyleSheet.create({
  task: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    padding: space.sm,
    borderRadius: radius.md,
  },
  note: { gap: 2, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surface },
});
