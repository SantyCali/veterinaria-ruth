// Tipos que reflejan las tablas de supabase/migrations.
// Cuando el proyecto de Supabase esté creado, se pueden regenerar con:
//   npx supabase gen types typescript --linked > src/lib/database.types.ts

export type UserRole = 'admin' | 'veterinario';
export type PetSpecies =
  | 'perro'
  | 'gato'
  | 'ave'
  | 'conejo'
  | 'roedor'
  | 'reptil'
  | 'equino'
  | 'bovino'
  | 'ovino'
  | 'caprino'
  | 'porcino'
  | 'otro';
export type PetSex = 'macho' | 'hembra';
export type PetStatus = 'activa' | 'inactiva' | 'fallecida';
export type AppointmentStatus = 'pendiente' | 'atendido' | 'cancelado';
export type TaskKind = 'tarea' | 'recordatorio' | 'actividad';
export type FileCategory =
  | 'radiografia'
  | 'ecografia'
  | 'analisis_sangre'
  | 'laboratorio'
  | 'foto'
  | 'otro';

export type Profile = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  role: UserRole;
  active: boolean;
  created_at: string;
};

export type Client = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
};

export type Pet = {
  id: string;
  client_id: string | null;
  name: string;
  species: PetSpecies;
  breed: string | null;
  birth_date: string | null;
  sex: PetSex | null;
  sterilized: boolean;
  microchip: string | null;
  allergies: string | null;
  notes: string | null;
  status: PetStatus;
  deceased_at: string | null;
  /** Ruta de la foto de perfil en el bucket privado pet-files. */
  photo_path: string | null;
  created_at: string;
};

export type Vaccination = {
  id: string;
  pet_id: string;
  vaccine: string;
  applied_on: string;
  next_due: string | null;
  batch: string | null;
  vet_id: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
};

export type VaccinationWithPet = Vaccination & {
  pet: (Pick<Pet, 'id' | 'name' | 'species' | 'photo_path' | 'status'> & {
    client: Pick<Client, 'id' | 'first_name' | 'last_name' | 'phone'> | null;
  }) | null;
};

export type PetWithClient = Pet & {
  client: Pick<Client, 'id' | 'first_name' | 'last_name' | 'phone'> | null;
};

export type PetOwnerHistory = {
  id: string;
  pet_id: string;
  client_id: string | null;
  started_at: string;
  ended_at: string | null;
  client: Pick<Client, 'id' | 'first_name' | 'last_name'> | null;
};

export type Appointment = {
  id: string;
  pet_id: string;
  client_id: string | null;
  vet_id: string | null;
  starts_at: string;
  duration_min: number;
  reason: string;
  status: AppointmentStatus;
  cancel_reason: string | null;
  notes: string | null;
};

export type AppointmentFull = Appointment & {
  pet: Pick<Pet, 'id' | 'name' | 'species' | 'breed'> | null;
  client: Pick<Client, 'id' | 'first_name' | 'last_name' | 'phone'> | null;
  vet: Pick<Profile, 'id' | 'first_name' | 'last_name'> | null;
};

export type Consultation = {
  id: string;
  pet_id: string;
  vet_id: string | null;
  appointment_id: string | null;
  consulted_at: string;
  reason: string;
  weight_kg: number | null;
  symptoms: string | null;
  diagnosis: string | null;
  treatment: string | null;
  medications: string | null;
  observations: string | null;
  studies: string | null;
  study_results: string | null;
  evolution: string | null;
};

export type ConsultationFull = Consultation & {
  vet: Pick<Profile, 'id' | 'first_name' | 'last_name'> | null;
  pet?: Pick<Pet, 'id' | 'name' | 'species' | 'photo_path'> | null;
};

export type Treatment = {
  id: string;
  pet_id: string;
  consultation_id: string | null;
  name: string;
  dose: string | null;
  frequency: string | null;
  duration: string | null;
  start_date: string | null;
  end_date: string | null;
  instructions: string | null;
};

export type PetFile = {
  id: string;
  pet_id: string;
  consultation_id: string | null;
  category: FileCategory;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  description: string | null;
  study_date: string | null;
  active: boolean;
  created_at: string;
};

export type Task = {
  id: string;
  kind: TaskKind;
  title: string;
  description: string | null;
  due_at: string | null;
  completed_at: string | null;
  assigned_to: string | null;
  active: boolean;
  created_at: string;
};

export type DailyNote = {
  id: string;
  note_date: string;
  content: string;
  /** false = borrada desde la app (baja lógica). */
  active: boolean;
  created_at: string;
};
