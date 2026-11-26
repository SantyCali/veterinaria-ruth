import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { APPOINTMENT_SELECT, AppointmentRow } from '@/components/rows';
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
  Loading,
  Row,
  Screen,
  SectionTitle,
  Segmented,
  Txt,
} from '@/components/ui';
import { fmtAge, fmtDate, fmtDateTime, toDbDate } from '@/lib/dates';
import { confirm, notify } from '@/lib/dialogs';
import { fmtSize, openPetFile, pickAndUploadPetFile } from '@/lib/files';
import {
  fileCategoryLabel,
  fileCategoryOptions,
  petStatus,
  sexLabel,
  speciesIcon,
  speciesLabel,
} from '@/lib/labels';
import { supabase } from '@/lib/supabase';
import { colors, fonts, radius, space } from '@/lib/theme';
import type {
  AppointmentFull,
  ConsultationFull,
  FileCategory,
  PetFile,
  PetOwnerHistory,
  PetStatus,
  PetWithClient,
  Treatment,
} from '@/lib/types';
import { useQuery } from '@/lib/use-query';

type Tab = 'historia' | 'tratamientos' | 'estudios' | 'turnos' | 'duenos';

type Detail = {
  pet: PetWithClient;
  consultations: ConsultationFull[];
  treatments: Treatment[];
  files: PetFile[];
  appointments: AppointmentFull[];
  owners: PetOwnerHistory[];
};

export default function PetProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('historia');
  const [category, setCategory] = useState<FileCategory>('radiografia');
  const [uploading, setUploading] = useState(false);

  const { data, loading, error, reload } = useQuery<Detail>(async () => {
    const [pet, cons, trt, files, appts, owners] = await Promise.all([
      supabase.from('pets').select('*, client:clients(id, first_name, last_name, phone)').eq('id', id).single(),
      supabase
        .from('consultations')
        .select('*, vet:profiles!consultations_vet_id_fkey(id, first_name, last_name)')
        .eq('pet_id', id)
        .order('consulted_at', { ascending: false }),
      supabase.from('treatments').select('*').eq('pet_id', id).order('start_date', { ascending: false, nullsFirst: false }),
      supabase.from('pet_files').select('*').eq('pet_id', id).eq('active', true).order('created_at', { ascending: false }),
      supabase.from('appointments').select(APPOINTMENT_SELECT).eq('pet_id', id).order('starts_at', { ascending: false }),
      supabase
        .from('pet_owner_history')
        .select('*, client:clients(id, first_name, last_name)')
        .eq('pet_id', id)
        .order('started_at', { ascending: false }),
    ]);
    const err = pet.error ?? cons.error ?? trt.error ?? files.error ?? appts.error ?? owners.error;
    return {
      error: err,
      data: err
        ? null
        : {
            pet: pet.data as PetWithClient,
            consultations: cons.data as ConsultationFull[],
            treatments: trt.data as Treatment[],
            files: files.data as PetFile[],
            appointments: appts.data as AppointmentFull[],
            owners: owners.data as PetOwnerHistory[],
          },
    };
  }, [id]);

  async function changeStatus(status: PetStatus) {
    if (!data || status === data.pet.status) return;
    const messages: Record<PetStatus, string> = {
      activa: 'La mascota vuelve a estar activa.',
      inactiva: 'La mascota queda inactiva. Su historia clínica se conserva.',
      fallecida:
        'Se registra el fallecimiento con fecha de hoy. Su ficha, consultas, tratamientos y estudios se conservan para futuras consultas.',
    };
    const ok = await confirm('Cambiar estado', messages[status], 'Confirmar');
    if (!ok) return;
    const { error: err } = await supabase
      .from('pets')
      .update({ status, deceased_at: status === 'fallecida' ? toDbDate(new Date()) : null })
      .eq('id', id);
    if (err) notify('No se pudo cambiar el estado', err.message);
    reload();
  }

  async function upload() {
    setUploading(true);
    const err = await pickAndUploadPetFile({ petId: id, category });
    setUploading(false);
    if (err) notify('No se pudo subir el archivo', err);
    reload();
  }

  async function open(file: PetFile) {
    const err = await openPetFile(file.storage_path);
    if (err) notify('No se pudo abrir el archivo', err);
  }

  if (loading && !data) return <Screen title="Mascota" back><Loading /></Screen>;
  if (error || !data) return <Screen title="Mascota" back><ErrorBox message={error ?? 'No encontrada'} /></Screen>;

  const { pet, consultations, treatments, files, appointments, owners } = data;
  const st = petStatus[pet.status];
  const deceased = pet.status === 'fallecida';
  const nextAppt = [...appointments]
    .filter((a) => a.status === 'pendiente' && new Date(a.starts_at) > new Date())
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  const lastWeight = consultations.find((c) => c.weight_kg)?.weight_kg;

  const tabs: { value: Tab; label: string }[] = [
    { value: 'historia', label: `Historia clínica (${consultations.length})` },
    { value: 'tratamientos', label: `Tratamientos (${treatments.length})` },
    { value: 'estudios', label: `Estudios (${files.length})` },
    { value: 'turnos', label: `Turnos (${appointments.length})` },
    { value: 'duenos', label: 'Dueños' },
  ];

  return (
    <Screen title={pet.name} subtitle="Perfil de mascota" back>
      {/* Encabezado */}
      <Card style={{ gap: space.lg }}>
        <Row wrap gap={space.lg} style={{ alignItems: 'flex-start' }}>
          <Avatar icon={speciesIcon[pet.species]} size={88} />
          <View style={{ flex: 1, minWidth: 240, gap: space.sm }}>
            <Row wrap gap={space.sm}>
              <Txt variant="h2">{pet.name}</Txt>
              <Chip label={st.label} fg={st.fg} bg={st.bg} icon={deceased ? 'flower-outline' : undefined} />
            </Row>
            <Txt>
              {[speciesLabel[pet.species], pet.breed, fmtAge(pet.birth_date)].filter(Boolean).join(' · ')}
            </Txt>
            <Txt variant="small">
              {[
                pet.sex ? sexLabel[pet.sex] : null,
                pet.sterilized ? 'Esterilizado/a' : 'No esterilizado/a',
                pet.birth_date ? `Nac. ${fmtDate(pet.birth_date)}` : null,
                pet.microchip ? `Chip ${pet.microchip}` : null,
                deceased && pet.deceased_at ? `Falleció el ${fmtDate(pet.deceased_at)}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Txt>
            <Row wrap gap={space.sm}>
              <MiniStat label="Último peso" value={lastWeight ? `${lastWeight} kg` : '—'} />
              <MiniStat label="Próximo turno" value={nextAppt ? fmtDateTime(nextAppt.starts_at) : '—'} />
              <MiniStat label="Consultas" value={String(consultations.length)} />
            </Row>
          </View>

          <View style={{ gap: space.sm, minWidth: 220, flex: 1, maxWidth: 340 }}>
            {!deceased && (
              <Row wrap>
                <Button
                  title="Nueva consulta"
                  icon="stethoscope"
                  variant="accent"
                  onPress={() => router.push({ pathname: '/consultas/form', params: { petId: id } })}
                />
                <Button
                  title="Agendar turno"
                  icon="calendar-plus"
                  variant="secondary"
                  onPress={() => router.push({ pathname: '/turnos/form', params: { petId: id } })}
                />
              </Row>
            )}
            <Pressable
              onPress={() => pet.client && router.push(`/clientes/${pet.client.id}`)}
              disabled={!pet.client}
              style={styles.owner}
            >
              <Txt variant="label">Tutor a cargo</Txt>
              {pet.client ? (
                <Row>
                  <Avatar text={initials(pet.client.first_name, pet.client.last_name)} size={36} />
                  <View style={{ flex: 1 }}>
                    <Txt variant="bodyStrong">{`${pet.client.first_name} ${pet.client.last_name}`}</Txt>
                    {pet.client.phone ? <Txt variant="small">{pet.client.phone}</Txt> : null}
                  </View>
                  <Icon name="chevron-right" />
                </Row>
              ) : (
                <Txt variant="muted">Sin dueño</Txt>
              )}
            </Pressable>
            <Button
              title="Editar / cambiar dueño"
              icon="pencil-outline"
              variant="ghost"
              small
              onPress={() => router.push({ pathname: '/mascotas/form', params: { id } })}
            />
          </View>
        </Row>

        {pet.allergies ? (
          <View style={styles.alert}>
            <Icon name="alert-outline" color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Txt variant="label" style={{ color: colors.accent }}>
                Alerta médica
              </Txt>
              <Txt>{pet.allergies}</Txt>
            </View>
          </View>
        ) : null}
        {pet.notes ? <Txt variant="muted">{pet.notes}</Txt> : null}

        <View style={{ gap: 6 }}>
          <Txt variant="label">Estado</Txt>
          <Segmented<PetStatus>
            value={pet.status}
            onChange={changeStatus}
            options={[
              { value: 'activa', label: 'Activa' },
              { value: 'inactiva', label: 'Inactiva' },
              { value: 'fallecida', label: 'Fallecida' },
            ]}
          />
        </View>
      </Card>

      <Segmented value={tab} onChange={setTab} options={tabs} />

      {/* Historia clínica */}
      {tab === 'historia' && (
        <View style={{ gap: space.md }}>
          {consultations.length === 0 ? (
            <Card>
              <EmptyState icon="stethoscope" text="Todavía no hay consultas registradas." />
            </Card>
          ) : null}
          {consultations.map((c) => (
            <ConsultationCard key={c.id} c={c} petId={id} treatments={treatments.filter((t) => t.consultation_id === c.id)} files={files.filter((f) => f.consultation_id === c.id)} onOpenFile={open} />
          ))}
        </View>
      )}

      {/* Tratamientos */}
      {tab === 'tratamientos' && (
        <Card style={{ gap: space.sm }}>
          <SectionTitle
            title="Tratamientos y medicamentos"
            action={
              <Button
                title="Nuevo tratamiento"
                icon="plus"
                variant="ghost"
                small
                onPress={() => router.push({ pathname: '/tratamientos/form', params: { petId: id } })}
              />
            }
          />
          {treatments.length === 0 ? <EmptyState icon="pill" text="Sin tratamientos registrados." /> : null}
          {treatments.map((t) => (
            <TreatmentLine key={t.id} t={t} />
          ))}
        </Card>
      )}

      {/* Estudios */}
      {tab === 'estudios' && (
        <Card style={{ gap: space.md }}>
          <SectionTitle title="Estudios y archivos" />
          <View style={{ gap: space.sm }}>
            <Txt variant="small">Tipo de estudio a subir:</Txt>
            <Segmented value={category} onChange={setCategory} options={fileCategoryOptions} />
            <Button
              title="Subir archivo (PDF, Excel o imagen)"
              icon="upload"
              variant="secondary"
              loading={uploading}
              onPress={upload}
              style={{ alignSelf: 'flex-start' }}
            />
          </View>
          {files.length === 0 ? <EmptyState icon="file-document-outline" text="Sin estudios cargados." /> : null}
          {files.map((f) => (
            <FileLine key={f.id} f={f} onPress={() => open(f)} />
          ))}
        </Card>
      )}

      {/* Turnos */}
      {tab === 'turnos' && (
        <Card style={{ gap: space.sm }}>
          <SectionTitle title="Turnos" />
          {appointments.length === 0 ? <EmptyState icon="calendar-blank" text="Sin turnos." /> : null}
          {appointments.map((a) => (
            <AppointmentRow key={a.id} appt={a} showDate onPress={() => router.push({ pathname: '/turnos', params: { turno: a.id } })} />
          ))}
        </Card>
      )}

      {/* Dueños */}
      {tab === 'duenos' && (
        <Card style={{ gap: 2 }}>
          <SectionTitle title="Historial de dueños" />
          {owners.map((o) => (
            <ListItem
              key={o.id}
              left={<Avatar icon={o.client ? 'account' : 'home-heart'} size={36} />}
              title={o.client ? `${o.client.first_name} ${o.client.last_name}` : 'Sin dueño'}
              subtitle={`Desde ${fmtDate(new Date(o.started_at))}${o.ended_at ? ` hasta ${fmtDate(new Date(o.ended_at))}` : ' · actual'}`}
              onPress={o.client ? () => router.push(`/clientes/${o.client!.id}`) : undefined}
            />
          ))}
        </Card>
      )}
    </Screen>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.mini}>
      <Txt variant="label">{label}</Txt>
      <Txt variant="bodyStrong">{value}</Txt>
    </View>
  );
}

const CONSULT_FIELDS: { key: keyof ConsultationFull; label: string }[] = [
  { key: 'symptoms', label: 'Síntomas' },
  { key: 'diagnosis', label: 'Diagnóstico' },
  { key: 'treatment', label: 'Tratamiento indicado' },
  { key: 'medications', label: 'Medicamentos recetados' },
  { key: 'observations', label: 'Observaciones' },
  { key: 'studies', label: 'Estudios realizados' },
  { key: 'study_results', label: 'Resultados de estudios' },
  { key: 'evolution', label: 'Evolución' },
];

function ConsultationCard({
  c,
  petId,
  treatments,
  files,
  onOpenFile,
}: {
  c: ConsultationFull;
  petId: string;
  treatments: Treatment[];
  files: PetFile[];
  onOpenFile: (f: PetFile) => void;
}) {
  return (
    <Card style={{ gap: space.sm, borderLeftWidth: 4, borderLeftColor: colors.primary }}>
      <Row wrap style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1, minWidth: 200 }}>
          <Txt variant="h3">{c.reason}</Txt>
          <Txt variant="small">
            {fmtDateTime(c.consulted_at)}
            {c.vet ? ` · Atendió: ${c.vet.first_name} ${c.vet.last_name}` : ''}
            {c.weight_kg ? ` · Peso: ${c.weight_kg} kg` : ''}
          </Txt>
        </View>
        <Row>
          <Button
            title="Tratamiento"
            icon="pill"
            variant="ghost"
            small
            onPress={() => router.push({ pathname: '/tratamientos/form', params: { petId, consultationId: c.id } })}
          />
          <Button
            title="Editar"
            icon="pencil-outline"
            variant="ghost"
            small
            onPress={() => router.push({ pathname: '/consultas/form', params: { id: c.id, petId } })}
          />
        </Row>
      </Row>
      <View style={styles.consultBody}>
        {CONSULT_FIELDS.map(({ key, label }) =>
          c[key] ? (
            <Txt key={key}>
              <Txt style={{ fontFamily: fonts.semibold }}>{label}: </Txt>
              {String(c[key])}
            </Txt>
          ) : null,
        )}
        {CONSULT_FIELDS.every(({ key }) => !c[key]) ? <Txt variant="muted">Sin detalles cargados.</Txt> : null}
      </View>
      {treatments.map((t) => (
        <TreatmentLine key={t.id} t={t} />
      ))}
      {files.map((f) => (
        <FileLine key={f.id} f={f} onPress={() => onOpenFile(f)} />
      ))}
    </Card>
  );
}

function TreatmentLine({ t }: { t: Treatment }) {
  const today = toDbDate(new Date());
  const ongoing = (!t.end_date || t.end_date >= today) && (!t.start_date || t.start_date <= today);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/tratamientos/form', params: { id: t.id, petId: t.pet_id } })}
      style={styles.treatment}
    >
      <Icon name="pill" color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Row wrap gap={6}>
          <Txt variant="bodyStrong">{t.name}</Txt>
          {ongoing ? <Chip label="En curso" fg={colors.success} bg={colors.successSoft} /> : null}
        </Row>
        <Txt variant="small">
          {[t.dose, t.frequency, t.duration].filter(Boolean).join(' · ')}
          {t.start_date ? ` · Desde ${fmtDate(t.start_date)}` : ''}
          {t.end_date ? ` hasta ${fmtDate(t.end_date)}` : ''}
        </Txt>
        {t.instructions ? <Txt variant="small">{t.instructions}</Txt> : null}
      </View>
    </Pressable>
  );
}

function FileLine({ f, onPress }: { f: PetFile; onPress: () => void }) {
  const isImage = f.mime_type?.startsWith('image/');
  const isPdf = f.mime_type === 'application/pdf';
  return (
    <ListItem
      left={
        <Avatar
          icon={isImage ? 'file-image-outline' : isPdf ? 'file-pdf-box' : 'file-excel-outline'}
          size={36}
        />
      }
      title={f.file_name}
      subtitle={[fileCategoryLabel[f.category], fmtDate(new Date(f.created_at)), fmtSize(f.size_bytes), f.description]
        .filter(Boolean)
        .join(' · ')}
      right={<Icon name="open-in-new" />}
      onPress={onPress}
    />
  );
}

const styles = StyleSheet.create({
  owner: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  alert: {
    flexDirection: 'row',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
  },
  mini: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    gap: 2,
  },
  consultBody: { gap: 6, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  treatment: {
    flexDirection: 'row',
    gap: space.md,
    alignItems: 'flex-start',
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
