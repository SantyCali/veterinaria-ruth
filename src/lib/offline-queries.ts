// Versiones "sin internet" de las consultas de cada pantalla.
// Leen la copia local (Mirror) y devuelven exactamente la misma forma de datos
// que la consulta a Supabase, así las pantallas no cambian.

import { addDays, startOfDay, toDbDate } from './dates';
import type { Mirror } from './offline';
import type {
  AppointmentFull,
  AppointmentStatus,
  Client,
  ConsultationFull,
  DailyNote,
  Pet,
  PetFile,
  PetOwnerHistory,
  PetSpecies,
  PetWithClient,
  Profile,
  Task,
  Treatment,
  Vaccination,
  VaccinationWithPet,
} from './types';
import { DUE_SOON_DAYS, latestPerVaccine } from './vaccines';

// ---------------------------------------------------------------- Ayudas

const norm = (s: string | null | undefined) =>
  (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

const matches = (term: string, ...fields: (string | null | undefined)[]) => {
  const t = norm(term.trim());
  return !t || fields.some((f) => norm(f).includes(t));
};

function index<T extends { id: string }>(rows: T[]) {
  return new Map(rows.map((r) => [r.id, r]));
}

function joins(m: Mirror) {
  const clients = index(m.clients);
  const pets = index(m.pets);
  const profiles = index(m.profiles);
  const clientLite = (id: string | null) => {
    const c = id ? clients.get(id) : undefined;
    return c ? { id: c.id, first_name: c.first_name, last_name: c.last_name, phone: c.phone, email: c.email } : null;
  };
  const vetLite = (id: string | null) => {
    const p = id ? profiles.get(id) : undefined;
    return p ? { id: p.id, first_name: p.first_name, last_name: p.last_name } : null;
  };
  const petWithClient = (p: Pet): PetWithClient => ({ ...p, client: clientLite(p.client_id) });
  const appointmentFull = (a: Mirror['appointments'][number]): AppointmentFull => {
    const p = pets.get(a.pet_id);
    return {
      ...a,
      pet: p ? { id: p.id, name: p.name, species: p.species, breed: p.breed } : null,
      client: clientLite(a.client_id),
      vet: vetLite(a.vet_id),
    };
  };
  return { clients, pets, profiles, clientLite, vetLite, petWithClient, appointmentFull };
}

const byDesc = <T>(key: (x: T) => string | null) => (a: T, b: T) => (key(b) ?? '').localeCompare(key(a) ?? '');
const byAsc = <T>(key: (x: T) => string | null) => (a: T, b: T) => (key(a) ?? '').localeCompare(key(b) ?? '');

// ---------------------------------------------------------------- Panel

function dueVaccines(m: Mirror): VaccinationWithPet[] {
  const j = joins(m);
  const limit = toDbDate(addDays(startOfDay(new Date()), DUE_SOON_DAYS));
  const active = m.vaccinations.filter((v) => v.active);
  const byPet = new Map<string, Vaccination[]>();
  for (const v of active) byPet.set(v.pet_id, [...(byPet.get(v.pet_id) ?? []), v]);
  const latest = new Set([...byPet.values()].flatMap((l) => latestPerVaccine(l).map((v) => v.id)));
  return active
    .filter((v) => latest.has(v.id) && v.next_due && v.next_due <= limit)
    .map((v) => {
      const p = j.pets.get(v.pet_id);
      return {
        ...v,
        pet: p
          ? { id: p.id, name: p.name, species: p.species, photo_path: p.photo_path, status: p.status, client: j.clientLite(p.client_id) }
          : null,
      };
    })
    .filter((v) => v.pet?.status === 'activa')
    .sort(byAsc((v) => v.next_due));
}

export function panelOffline(m: Mirror) {
  const j = joins(m);
  const from = startOfDay(new Date()).toISOString();
  const to = addDays(startOfDay(new Date()), 1).toISOString();
  return {
    today: m.appointments
      .filter((a) => a.starts_at >= from && a.starts_at < to)
      .sort(byAsc((a) => a.starts_at))
      .map(j.appointmentFull),
    tasks: m.tasks
      .filter((t) => t.active && !t.completed_at)
      .sort((a, b) => (a.due_at ?? '9999').localeCompare(b.due_at ?? '9999'))
      .slice(0, 20),
    consultations: [...m.consultations]
      .sort(byDesc((c) => c.consulted_at))
      .slice(0, 5)
      .map((c): ConsultationFull => {
        const p = j.pets.get(c.pet_id);
        return {
          ...c,
          vet: j.vetLite(c.vet_id),
          pet: p ? { id: p.id, name: p.name, species: p.species, photo_path: p.photo_path } : null,
        };
      }),
    vaccines: dueVaccines(m),
  };
}

// ---------------------------------------------------------------- Clientes

export function clientsOffline(m: Mirror, q: string, filter: 'activos' | 'inactivos' | 'todos') {
  const counts = new Map<string, number>();
  for (const p of m.pets) if (p.client_id) counts.set(p.client_id, (counts.get(p.client_id) ?? 0) + 1);
  return m.clients
    .filter((c) => filter === 'todos' || c.active === (filter === 'activos'))
    .filter((c) => matches(q, c.first_name, c.last_name, c.email))
    .sort((a, b) => `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`))
    .slice(0, 200)
    .map((c) => ({ ...c, pets: [{ count: counts.get(c.id) ?? 0 }] }));
}

export function clientDetailOffline(m: Mirror, id: string) {
  const j = joins(m);
  const client = j.clients.get(id) as Client | undefined;
  if (!client) return null;
  return {
    client,
    pets: m.pets.filter((p) => p.client_id === id).sort(byAsc((p) => p.name)),
    appointments: m.appointments
      .filter((a) => a.client_id === id)
      .sort(byDesc((a) => a.starts_at))
      .slice(0, 20)
      .map(j.appointmentFull),
  };
}

// ---------------------------------------------------------------- Mascotas

export function petsOffline(
  m: Mirror,
  q: string,
  filter: 'activas' | 'sin_dueno' | 'inactivas' | 'fallecidas' | 'todas',
  species: PetSpecies | 'todas',
) {
  const j = joins(m);
  return m.pets
    .filter((p) => {
      if (filter === 'activas') return p.status === 'activa';
      if (filter === 'inactivas') return p.status === 'inactiva';
      if (filter === 'fallecidas') return p.status === 'fallecida';
      if (filter === 'sin_dueno') return !p.client_id && p.status !== 'fallecida';
      return true;
    })
    .filter((p) => species === 'todas' || p.species === species)
    .filter((p) => matches(q, p.name, p.breed, p.microchip))
    .sort(byAsc((p) => p.name))
    .slice(0, 200)
    .map(j.petWithClient);
}

export function petDetailOffline(m: Mirror, id: string) {
  const j = joins(m);
  const pet = j.pets.get(id);
  if (!pet) return null;
  return {
    pet: j.petWithClient(pet),
    consultations: m.consultations
      .filter((c) => c.pet_id === id)
      .sort(byDesc((c) => c.consulted_at))
      .map((c): ConsultationFull => ({ ...c, vet: j.vetLite(c.vet_id) })),
    treatments: m.treatments.filter((t) => t.pet_id === id).sort(byDesc((t) => t.start_date)) as Treatment[],
    vaccinations: m.vaccinations.filter((v) => v.pet_id === id && v.active).sort(byDesc((v) => v.applied_on)),
    files: m.pet_files.filter((f) => f.pet_id === id && f.active).sort(byDesc((f) => f.created_at)) as PetFile[],
    appointments: m.appointments
      .filter((a) => a.pet_id === id)
      .sort(byDesc((a) => a.starts_at))
      .map(j.appointmentFull),
    owners: m.pet_owner_history
      .filter((o) => o.pet_id === id)
      .sort(byDesc((o) => o.started_at))
      .map((o): PetOwnerHistory => ({ ...o, client: j.clientLite(o.client_id) })),
  };
}

// ---------------------------------------------------------------- Turnos y agenda

export function appointmentsOffline(m: Mirror, from: Date, to: Date, status: AppointmentStatus | 'todos') {
  const j = joins(m);
  const f = from.toISOString();
  const t = to.toISOString();
  return m.appointments
    .filter((a) => a.starts_at >= f && a.starts_at < t && (status === 'todos' || a.status === status))
    .sort(byAsc((a) => a.starts_at))
    .map(j.appointmentFull);
}

export function agendaOffline(m: Mirror, day: Date): { tasks: Task[]; notes: DailyNote[] } {
  const from = day.toISOString();
  const to = addDays(day, 1).toISOString();
  return {
    tasks: m.tasks
      .filter((t) => t.active && ((t.due_at && t.due_at >= from && t.due_at < to) || !t.completed_at))
      .sort((a, b) => (a.due_at ?? '9999').localeCompare(b.due_at ?? '9999')),
    notes: m.daily_notes
      .filter((n) => n.note_date === toDbDate(day) && n.active !== false)
      .sort(byAsc((n) => n.created_at)),
  };
}

export function usersOffline(m: Mirror): Profile[] {
  return [...m.profiles].sort((a, b) => Number(a.active) - Number(b.active) || a.created_at.localeCompare(b.created_at));
}

// ---------------------------------------------------------------- Buscador general

export function searchOffline(m: Mirror, term: string) {
  const j = joins(m);
  const petsByClient = new Map<string, { id: string; name: string }[]>();
  for (const p of m.pets) {
    if (p.client_id) petsByClient.set(p.client_id, [...(petsByClient.get(p.client_id) ?? []), { id: p.id, name: p.name }]);
  }
  return {
    pets: m.pets
      .filter((p) => matches(term, p.name, p.breed, p.microchip))
      .sort(byAsc((p) => p.name))
      .slice(0, 8)
      .map(j.petWithClient),
    clients: m.clients
      .filter((c) => matches(term, c.first_name, c.last_name, c.email, c.phone))
      .sort(byAsc((c) => c.last_name))
      .slice(0, 8)
      .map((c) => ({ ...c, pets: petsByClient.get(c.id) ?? [] })),
  };
}
