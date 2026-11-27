import { addDays, startOfDay, toDbDate } from './dates';
import { colors } from './theme';
import { supabase } from './supabase';
import type { Vaccination, VaccinationWithPet } from './types';

/** Días antes del vencimiento en que una vacuna pasa a "vence pronto". */
export const DUE_SOON_DAYS = 30;

export type VaccineState = 'vencida' | 'pronto' | 'al_dia' | 'sin_refuerzo';

export const vaccineStateTone: Record<VaccineState, { label: string; fg: string; bg: string }> = {
  vencida: { label: 'Vencida', fg: colors.danger, bg: colors.dangerSoft },
  pronto: { label: 'Vence pronto', fg: colors.warning, bg: colors.warningSoft },
  al_dia: { label: 'Al día', fg: colors.success, bg: colors.successSoft },
  sin_refuerzo: { label: 'Sin refuerzo', fg: colors.neutral, bg: colors.neutralSoft },
};

export function vaccineState(nextDue: string | null, today = new Date()): VaccineState {
  if (!nextDue) return 'sin_refuerzo';
  const t = toDbDate(startOfDay(today));
  if (nextDue < t) return 'vencida';
  if (nextDue <= toDbDate(addDays(startOfDay(today), DUE_SOON_DAYS))) return 'pronto';
  return 'al_dia';
}

/**
 * Se queda con la aplicación más reciente de cada vacuna: es la que define
 * si la mascota está al día (las anteriores son historial).
 */
export function latestPerVaccine(list: Vaccination[]) {
  const byName = new Map<string, Vaccination>();
  for (const v of list) {
    const key = v.vaccine.trim().toLowerCase();
    const prev = byName.get(key);
    if (!prev || v.applied_on > prev.applied_on) byName.set(key, v);
  }
  return [...byName.values()];
}

/**
 * Vacunas vencidas o por vencer (próximos DUE_SOON_DAYS días) de mascotas activas.
 * Solo cuenta la aplicación más reciente de cada vacuna: si ya se aplicó el refuerzo,
 * la dosis anterior no aparece como vencida.
 */
export async function fetchDueVaccines(): Promise<{ data: VaccinationWithPet[] | null; error: { message: string } | null }> {
  const limit = toDbDate(addDays(startOfDay(new Date()), DUE_SOON_DAYS));
  const due = await supabase
    .from('vaccinations')
    .select('*, pet:pets(id, name, species, photo_path, status, client:clients(id, first_name, last_name, phone))')
    .eq('active', true)
    .not('next_due', 'is', null)
    .lte('next_due', limit)
    .order('next_due');
  if (due.error) return { data: null, error: due.error };
  const rows = (due.data as VaccinationWithPet[]).filter((v) => v.pet?.status === 'activa');
  if (rows.length === 0) return { data: [], error: null };

  const all = await supabase
    .from('vaccinations')
    .select('*')
    .eq('active', true)
    .in('pet_id', [...new Set(rows.map((r) => r.pet_id))]);
  if (all.error) return { data: null, error: all.error };

  const byPet = new Map<string, Vaccination[]>();
  for (const v of all.data as Vaccination[]) byPet.set(v.pet_id, [...(byPet.get(v.pet_id) ?? []), v]);
  const latestIds = new Set([...byPet.values()].flatMap((list) => latestPerVaccine(list).map((v) => v.id)));
  return { data: rows.filter((r) => latestIds.has(r.id)), error: null };
}

/** Resumen para el encabezado de la mascota: "Al día", "1 vencida", etc. */
export function vaccineSummary(list: Vaccination[]) {
  const states = latestPerVaccine(list).map((v) => vaccineState(v.next_due));
  const overdue = states.filter((s) => s === 'vencida').length;
  const soon = states.filter((s) => s === 'pronto').length;
  if (list.length === 0) return 'Sin registro';
  if (overdue) return `${overdue} vencida${overdue > 1 ? 's' : ''}`;
  if (soon) return `${soon} por vencer`;
  return 'Al día';
}
