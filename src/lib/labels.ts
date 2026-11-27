import type { IconName } from '@/components/ui';

import { colors } from './theme';
import type {
  AppointmentStatus,
  FileCategory,
  PetSex,
  PetSpecies,
  PetStatus,
  TaskKind,
  UserRole,
} from './types';

type Tone = { label: string; fg: string; bg: string };

// Las claves (perro, gato) son los valores del enum en la base; lo que se muestra es Canino y Felino.
// Las especies de campo están para poder elegirlas, pero la clínica atiende sobre todo caninos y felinos.
export const speciesLabel: Record<PetSpecies, string> = {
  perro: 'Canino',
  gato: 'Felino',
  ave: 'Ave',
  conejo: 'Conejo',
  roedor: 'Roedor',
  reptil: 'Reptil',
  equino: 'Equino',
  bovino: 'Bovino',
  ovino: 'Ovino',
  caprino: 'Caprino',
  porcino: 'Porcino',
  otro: 'Otro',
};

export const speciesOptions = Object.entries(speciesLabel).map(([value, label]) => ({
  value: value as PetSpecies,
  label,
}));

export const sexLabel: Record<PetSex, string> = { macho: 'Macho', hembra: 'Hembra' };

export const petStatus: Record<PetStatus, Tone> = {
  activa: { label: 'Activa', fg: colors.success, bg: colors.successSoft },
  inactiva: { label: 'Inactiva', fg: colors.neutral, bg: colors.neutralSoft },
  fallecida: { label: 'Fallecida', fg: '#f1f5f9', bg: '#334155' },
};

export const appointmentStatus: Record<AppointmentStatus, Tone> = {
  pendiente: { label: 'Pendiente', fg: colors.warning, bg: colors.warningSoft },
  atendido: { label: 'Atendido', fg: colors.success, bg: colors.successSoft },
  cancelado: { label: 'Cancelado', fg: colors.danger, bg: colors.dangerSoft },
};

export const clientStatus = (active: boolean): Tone =>
  active
    ? { label: 'Activo', fg: colors.success, bg: colors.successSoft }
    : { label: 'Inactivo', fg: colors.neutral, bg: colors.neutralSoft };

export const taskKind: Record<TaskKind, Tone> = {
  tarea: { label: 'Tarea', fg: colors.primary, bg: colors.primarySoft },
  recordatorio: { label: 'Recordatorio', fg: colors.accent, bg: colors.accentSoft },
  actividad: { label: 'Actividad', fg: colors.info, bg: colors.infoSoft },
};

export const fileCategoryLabel: Record<FileCategory, string> = {
  radiografia: 'Radiografía',
  ecografia: 'Ecografía',
  analisis_sangre: 'Análisis de sangre',
  laboratorio: 'Laboratorio',
  foto: 'Fotografía',
  otro: 'Otro estudio',
};

export const fileCategoryOptions = Object.entries(fileCategoryLabel).map(([value, label]) => ({
  value: value as FileCategory,
  label,
}));

export const roleLabel: Record<UserRole, string> = {
  admin: 'Administrador',
  veterinario: 'Veterinario',
};

/** Ícono (MaterialCommunityIcons) según la especie. */
export const speciesIcon: Record<PetSpecies, IconName> = {
  perro: 'dog',
  gato: 'cat',
  ave: 'bird',
  conejo: 'rabbit',
  roedor: 'rodent',
  reptil: 'snake',
  equino: 'horse',
  bovino: 'cow',
  ovino: 'sheep',
  caprino: 'paw',
  porcino: 'pig',
  otro: 'paw',
};
