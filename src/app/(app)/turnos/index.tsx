import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { APPOINTMENT_SELECT, AppointmentRow } from '@/components/rows';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorBox,
  Field,
  Icon,
  IconButton,
  Input,
  Loading,
  Row,
  Screen,
  Segmented,
  Txt,
} from '@/components/ui';
import {
  addDays,
  dayNameShort,
  fmtDate,
  fmtLongDate,
  fmtTime,
  monthName,
  sameDay,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from '@/lib/dates';
import { notify } from '@/lib/dialogs';
import { appointmentStatus, speciesLabel } from '@/lib/labels';
import { supabase } from '@/lib/supabase';
import { colors, radius, space, WIDE_BREAKPOINT } from '@/lib/theme';
import type { AppointmentFull, AppointmentStatus } from '@/lib/types';
import { useQuery } from '@/lib/use-query';

type View_ = 'dia' | 'semana' | 'mes';
type StatusFilter = AppointmentStatus | 'todos';

function rangeFor(view: View_, anchor: Date): [Date, Date] {
  if (view === 'dia') {
    const s = startOfDay(anchor);
    return [s, addDays(s, 1)];
  }
  if (view === 'semana') {
    const s = startOfWeek(anchor);
    return [s, addDays(s, 7)];
  }
  const s = startOfWeek(startOfMonth(anchor));
  return [s, addDays(s, 42)];
}

export default function AppointmentsScreen() {
  const { turno } = useLocalSearchParams<{ turno?: string }>();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT + 250;

  const [view, setView] = useState<View_>('semana');
  const [anchor, setAnchor] = useState(() => new Date());
  const [status, setStatus] = useState<StatusFilter>('todos');
  const [selectedId, setSelectedId] = useState<string | null>(turno ?? null);

  // Si cambia el parámetro ?turno=..., seleccionar ese turno (ajuste de estado en render).
  const [prevTurno, setPrevTurno] = useState(turno);
  if (turno !== prevTurno) {
    setPrevTurno(turno);
    setSelectedId(turno ?? null);
  }

  // ...y mover el calendario al día de ese turno.
  useEffect(() => {
    if (!turno) return;
    supabase
      .from('appointments')
      .select('starts_at')
      .eq('id', turno)
      .single()
      .then(({ data }) => {
        if (data) {
          setAnchor(new Date(data.starts_at));
          setView('dia');
        }
      });
  }, [turno]);

  const [from, to] = rangeFor(view, anchor);

  const { data, loading, error, reload } = useQuery<AppointmentFull[]>(() => {
    let q = supabase
      .from('appointments')
      .select(APPOINTMENT_SELECT)
      .gte('starts_at', from.toISOString())
      .lt('starts_at', to.toISOString())
      .order('starts_at');
    if (status !== 'todos') q = q.eq('status', status);
    return q;
  }, [from.getTime(), to.getTime(), status]);

  const appts = useMemo(() => data ?? [], [data]);
  const selected = appts.find((a) => a.id === selectedId) ?? null;

  const counts = useMemo(() => {
    const c = { pendiente: 0, atendido: 0, cancelado: 0 };
    for (const a of appts) c[a.status] += 1;
    return c;
  }, [appts]);

  function move(dir: 1 | -1) {
    if (view === 'dia') setAnchor(addDays(anchor, dir));
    else if (view === 'semana') setAnchor(addDays(anchor, 7 * dir));
    else setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1));
  }

  const title =
    view === 'dia'
      ? cap(fmtLongDate(anchor))
      : view === 'semana'
        ? `Semana del ${fmtDate(from).slice(0, 5)} al ${fmtDate(addDays(to, -1)).slice(0, 5)}`
        : `${cap(monthName(anchor))} ${anchor.getFullYear()}`;

  const calendar = (
    <Card style={{ gap: space.md, flex: 1 }}>
      {loading && !data ? <Loading /> : null}
      {view === 'dia' && <DayList appts={appts} onSelect={setSelectedId} />}
      {view === 'semana' &&
        (width >= WIDE_BREAKPOINT ? (
          <WeekGrid start={from} appts={appts} selectedId={selectedId} onSelect={setSelectedId} />
        ) : (
          <WeekList start={from} appts={appts} onSelect={setSelectedId} />
        ))}
      {view === 'mes' && (
        <MonthGrid
          start={from}
          month={anchor.getMonth()}
          appts={appts}
          compact={width < WIDE_BREAKPOINT}
          onPickDay={(d) => {
            setAnchor(d);
            setView('dia');
          }}
        />
      )}
    </Card>
  );

  const detail = selected ? (
    <AppointmentDetail
      appt={selected}
      onClose={() => setSelectedId(null)}
      onChanged={reload}
    />
  ) : null;

  return (
    <Screen
      title="Turnos y calendario"
      actions={<Button title="Nuevo turno" icon="calendar-plus" variant="accent" onPress={() => router.push({ pathname: '/turnos/form', params: { date: fmtDate(anchor) } })} />}
    >
      <Card style={{ gap: space.md }}>
        <Row wrap gap={space.md} style={{ justifyContent: 'space-between' }}>
          <Segmented<View_>
            value={view}
            onChange={setView}
            options={[
              { value: 'dia', label: 'Día' },
              { value: 'semana', label: 'Semana' },
              { value: 'mes', label: 'Mes' },
            ]}
          />
          <Row>
            <IconButton icon="chevron-left" label="Anterior" onPress={() => move(-1)} />
            <Txt variant="h3" style={{ minWidth: 180, textAlign: 'center' }}>
              {title}
            </Txt>
            <IconButton icon="chevron-right" label="Siguiente" onPress={() => move(1)} />
            <Button title="Hoy" variant="secondary" small onPress={() => setAnchor(new Date())} />
          </Row>
        </Row>
        <Row wrap gap={space.md}>
          <Segmented<StatusFilter>
            value={status}
            onChange={setStatus}
            options={[
              { value: 'todos', label: 'Todos' },
              { value: 'pendiente', label: `Pendientes (${counts.pendiente})` },
              { value: 'atendido', label: `Atendidos (${counts.atendido})` },
              { value: 'cancelado', label: `Cancelados (${counts.cancelado})` },
            ]}
          />
        </Row>
      </Card>

      {error ? <ErrorBox message={error} /> : null}

      {wide ? (
        <Row gap={space.lg} style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>{calendar}</View>
          {detail ? <View style={{ width: 340 }}>{detail}</View> : null}
        </Row>
      ) : (
        <>
          {detail}
          {calendar}
        </>
      )}
    </Screen>
  );
}

// ------------------------------------------------------------------ Vistas

function DayList({ appts, onSelect }: { appts: AppointmentFull[]; onSelect: (id: string) => void }) {
  if (appts.length === 0) return <EmptyState icon="calendar-blank" text="No hay turnos este día." />;
  return (
    <View style={{ gap: space.sm }}>
      {appts.map((a) => (
        <AppointmentRow key={a.id} appt={a} onPress={() => onSelect(a.id)} />
      ))}
    </View>
  );
}

function WeekList({ start, appts, onSelect }: { start: Date; appts: AppointmentFull[]; onSelect: (id: string) => void }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <View style={{ gap: space.lg }}>
      {days.map((d) => {
        const list = appts.filter((a) => sameDay(new Date(a.starts_at), d));
        return (
          <View key={d.toISOString()} style={{ gap: space.sm }}>
            <Txt variant="label" style={sameDay(d, new Date()) ? { color: colors.primary } : undefined}>
              {fmtLongDate(d)}
            </Txt>
            {list.length === 0 ? <Txt variant="small">Sin turnos</Txt> : null}
            {list.map((a) => (
              <AppointmentRow key={a.id} appt={a} onPress={() => onSelect(a.id)} />
            ))}
          </View>
        );
      })}
    </View>
  );
}

function WeekGrid({
  start,
  appts,
  selectedId,
  onSelect,
}: {
  start: Date;
  appts: AppointmentFull[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {days.map((d) => {
        const isToday = sameDay(d, new Date());
        const list = appts.filter((a) => sameDay(new Date(a.starts_at), d));
        return (
          <View key={d.toISOString()} style={{ flex: 1, gap: 6, minWidth: 0 }}>
            <View style={[styles.dayHead, isToday && { backgroundColor: colors.primarySoft }]}>
              <Txt variant="label">{dayNameShort(d)}</Txt>
              <Txt variant="h2" style={isToday ? { color: colors.primary } : undefined}>
                {d.getDate()}
              </Txt>
            </View>
            {list.map((a) => {
              const st = appointmentStatus[a.status];
              return (
                <Pressable
                  key={a.id}
                  onPress={() => onSelect(a.id)}
                  style={[
                    styles.block,
                    { backgroundColor: st.bg, borderLeftColor: st.fg },
                    selectedId === a.id && { borderWidth: 2, borderColor: st.fg },
                  ]}
                >
                  <Txt variant="small" style={{ color: st.fg, fontWeight: '700' }} numberOfLines={1}>
                    {fmtTime(a.starts_at)}
                  </Txt>
                  <Txt variant="small" style={{ color: colors.text }} numberOfLines={1}>
                    {a.pet?.name ?? '—'}
                  </Txt>
                  <Txt variant="small" numberOfLines={1}>
                    {a.reason}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

function MonthGrid({
  start,
  month,
  appts,
  compact,
  onPickDay,
}: {
  start: Date;
  month: number;
  appts: AppointmentFull[];
  compact: boolean;
  onPickDay: (d: Date) => void;
}) {
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row' }}>
        {days.slice(0, 7).map((d) => (
          <Txt key={d.getDay()} variant="label" style={{ flex: 1, textAlign: 'center' }}>
            {dayNameShort(d)}
          </Txt>
        ))}
      </View>
      {Array.from({ length: 6 }, (_, w) => (
        <View key={w} style={{ flexDirection: 'row', gap: 4 }}>
          {days.slice(w * 7, w * 7 + 7).map((d) => {
            const list = appts.filter((a) => sameDay(new Date(a.starts_at), d) && a.status !== 'cancelado');
            const outside = d.getMonth() !== month;
            const isToday = sameDay(d, new Date());
            return (
              <Pressable
                key={d.toISOString()}
                onPress={() => onPickDay(d)}
                style={[styles.monthCell, outside && { opacity: 0.4 }, isToday && { borderColor: colors.primary }]}
              >
                <Txt variant="bodyStrong" style={isToday ? { color: colors.primary } : undefined}>
                  {d.getDate()}
                </Txt>
                {compact ? (
                  list.length ? (
                    <View style={styles.countDot}>
                      <Txt variant="small" style={{ color: colors.primaryText, fontSize: 11 }}>
                        {list.length}
                      </Txt>
                    </View>
                  ) : null
                ) : (
                  <>
                    {list.slice(0, 3).map((a) => (
                      <Txt key={a.id} variant="small" numberOfLines={1} style={{ fontSize: 11 }}>
                        {fmtTime(a.starts_at)} {a.pet?.name}
                      </Txt>
                    ))}
                    {list.length > 3 ? (
                      <Txt variant="small" style={{ fontSize: 11, color: colors.primary }}>
                        +{list.length - 3} más
                      </Txt>
                    ) : null}
                  </>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ------------------------------------------------------------------ Detalle

function AppointmentDetail({
  appt,
  onClose,
  onChanged,
}: {
  appt: AppointmentFull;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [busy, setBusy] = useState(false);
  const st = appointmentStatus[appt.status];
  const end = new Date(new Date(appt.starts_at).getTime() + appt.duration_min * 60000);

  async function setStatus(status: AppointmentStatus, extra: Record<string, unknown> = {}) {
    setBusy(true);
    const { error } = await supabase.from('appointments').update({ status, ...extra }).eq('id', appt.id);
    setBusy(false);
    if (error) notify('No se pudo actualizar el turno', error.message);
    setCancelling(false);
    onChanged();
  }

  return (
    <Card style={{ gap: space.md }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt variant="h3">Detalle del turno</Txt>
        <IconButton icon="close" label="Cerrar detalle" onPress={onClose} />
      </Row>
      <Chip label={st.label} fg={st.fg} bg={st.bg} />

      <Pressable onPress={() => router.push(`/mascotas/${appt.pet_id}`)} style={styles.detailBox}>
        <Txt variant="label">Paciente</Txt>
        <Row>
          <Txt variant="bodyStrong" style={{ flex: 1 }}>
            {appt.pet?.name}
            {appt.pet ? ` · ${speciesLabel[appt.pet.species]}${appt.pet.breed ? ` · ${appt.pet.breed}` : ''}` : ''}
          </Txt>
          <Icon name="chevron-right" />
        </Row>
        <Txt variant="small" style={{ color: colors.primary }}>
          Ver historia clínica completa
        </Txt>
      </Pressable>

      <View style={styles.detailBox}>
        <Txt variant="label">Tutor responsable</Txt>
        <Txt variant="bodyStrong">{appt.client ? `${appt.client.first_name} ${appt.client.last_name}` : 'Sin dueño'}</Txt>
        {appt.client?.phone ? <Txt variant="small">{appt.client.phone}</Txt> : null}
      </View>

      <Row gap={space.sm}>
        <View style={[styles.detailBox, { flex: 1 }]}>
          <Txt variant="label">Horario</Txt>
          <Txt variant="bodyStrong">
            {fmtTime(appt.starts_at)} – {fmtTime(end)}
          </Txt>
          <Txt variant="small">{fmtDate(new Date(appt.starts_at))}</Txt>
        </View>
        <View style={[styles.detailBox, { flex: 1 }]}>
          <Txt variant="label">Profesional</Txt>
          <Txt variant="bodyStrong">{appt.vet ? `${appt.vet.first_name} ${appt.vet.last_name}` : 'Sin asignar'}</Txt>
        </View>
      </Row>

      <View style={styles.detailBox}>
        <Txt variant="label">Motivo de consulta</Txt>
        <Txt>{appt.reason}</Txt>
        {appt.notes ? <Txt variant="small">Notas: {appt.notes}</Txt> : null}
        {appt.cancel_reason ? <Txt variant="small">Motivo de cancelación: {appt.cancel_reason}</Txt> : null}
      </View>

      {appt.status === 'pendiente' && !cancelling && (
        <View style={{ gap: space.sm }}>
          <Button
            title="Iniciar consulta ahora"
            icon="stethoscope"
            variant="accent"
            onPress={() => router.push({ pathname: '/consultas/form', params: { appointmentId: appt.id } })}
          />
          <Row>
            <Button title="Marcar atendido" icon="check-all" style={{ flex: 1 }} loading={busy} onPress={() => setStatus('atendido')} />
            <Button
              title="Modificar"
              icon="calendar-edit"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => router.push({ pathname: '/turnos/form', params: { id: appt.id } })}
            />
          </Row>
          <Button title="Cancelar turno" icon="calendar-remove" variant="danger" onPress={() => setCancelling(true)} />
        </View>
      )}

      {cancelling && (
        <View style={{ gap: space.sm }}>
          <Field label="Motivo de cancelación (opcional)">
            <Input value={cancelReason} onChangeText={setCancelReason} />
          </Field>
          <Row>
            <Button title="Volver" variant="ghost" onPress={() => setCancelling(false)} />
            <Button
              title="Confirmar cancelación"
              variant="danger"
              loading={busy}
              onPress={() => setStatus('cancelado', { cancel_reason: cancelReason.trim() || null })}
            />
          </Row>
          <Txt variant="small">El turno cancelado no se borra: queda en el historial.</Txt>
        </View>
      )}

      {appt.status !== 'pendiente' && (
        <Button title="Volver a pendiente" icon="undo" variant="ghost" loading={busy} onPress={() => setStatus('pendiente', { cancel_reason: null })} />
      )}
    </Card>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const styles = StyleSheet.create({
  dayHead: { alignItems: 'center', paddingVertical: 6, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  block: {
    padding: 6,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    gap: 1,
  },
  monthCell: {
    flex: 1,
    minHeight: 76,
    padding: 6,
    gap: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  countDot: {
    alignSelf: 'flex-start',
    minWidth: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  detailBox: { gap: 2, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
});
