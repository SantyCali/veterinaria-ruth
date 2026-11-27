-- =====================================================================
-- Veterinaria Ruth: esquema inicial
-- Reglas clave:
--   * Nada se borra físicamente: no hay permisos de DELETE para la app.
--   * Las bajas son lógicas (active / status).
--   * El historial clínico se conserva siempre.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tipos (listas de valores permitidos)
-- ---------------------------------------------------------------------
create type public.user_role          as enum ('admin', 'veterinario');
create type public.pet_species        as enum ('perro', 'gato', 'ave', 'conejo', 'roedor', 'reptil', 'otro');
create type public.pet_sex            as enum ('macho', 'hembra');
create type public.pet_status         as enum ('activa', 'inactiva', 'fallecida');
create type public.appointment_status as enum ('pendiente', 'atendido', 'cancelado');
create type public.task_kind          as enum ('tarea', 'recordatorio', 'actividad');
create type public.file_category      as enum ('radiografia', 'ecografia', 'analisis_sangre', 'laboratorio', 'foto', 'otro');

-- ---------------------------------------------------------------------
-- 2. Función genérica: actualiza updated_at en cada UPDATE
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Perfiles de usuario (uno por cada usuario de Supabase Auth)
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id),
  email       text not null,
  first_name  text not null default '',
  last_name   text not null default '',
  phone       text,
  role        public.user_role not null default 'veterinario',
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Helpers de permisos (security definer para no chocar con el RLS de profiles)
create or replace function public.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.active
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.active and p.role = 'admin'
  );
$$;

-- Al registrarse un usuario se crea su perfil.
-- El PRIMER usuario del sistema queda como admin y activo.
-- Los siguientes quedan como veterinario e INACTIVOS hasta que un admin los apruebe
-- (si no, cualquiera que se registre podría ver los datos de la clínica).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_first boolean := not exists (select 1 from public.profiles);
begin
  insert into public.profiles (id, email, first_name, last_name, role, active)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    case when is_first then 'admin'::public.user_role else 'veterinario'::public.user_role end,
    is_first
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Un usuario común no puede cambiarse el rol ni reactivarse a sí mismo.
create or replace function public.protect_profile_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.role is distinct from old.role or new.active is distinct from old.active
      or new.email is distinct from old.email)
     and not public.is_admin() then
    raise exception 'Solo un administrador puede cambiar rol, estado o email';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_admin_fields before update on public.profiles
  for each row execute function public.protect_profile_admin_fields();

-- ---------------------------------------------------------------------
-- 4. Clientes
-- ---------------------------------------------------------------------
create table public.clients (
  id          uuid primary key default gen_random_uuid(),
  first_name  text not null check (length(trim(first_name)) > 0),
  last_name   text not null check (length(trim(last_name)) > 0),
  email       text,
  phone       text,
  address     text,
  notes       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles (id) default auth.uid()
);

create index clients_name_idx on public.clients (last_name, first_name);
create index clients_email_idx on public.clients (email);

create trigger clients_updated_at before update on public.clients
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 5. Mascotas (client_id NULL = sin dueño)
-- ---------------------------------------------------------------------
create table public.pets (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid references public.clients (id),
  name         text not null check (length(trim(name)) > 0),
  species      public.pet_species not null,
  breed        text,
  birth_date   date,
  sex          public.pet_sex,
  sterilized   boolean not null default false,
  microchip    text,
  allergies    text,
  notes        text,
  status       public.pet_status not null default 'activa',
  deceased_at  date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references public.profiles (id) default auth.uid(),
  constraint pets_deceased_consistency
    check (deceased_at is null or status = 'fallecida')
);

create index pets_client_idx on public.pets (client_id);
create index pets_name_idx on public.pets (name);
create index pets_status_idx on public.pets (status);

create trigger pets_updated_at before update on public.pets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 6. Historial de dueños (lo completa un trigger, no la app)
-- ---------------------------------------------------------------------
create table public.pet_owner_history (
  id          uuid primary key default gen_random_uuid(),
  pet_id      uuid not null references public.pets (id),
  client_id   uuid references public.clients (id),
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  changed_by  uuid references public.profiles (id) default auth.uid()
);

create index pet_owner_history_pet_idx on public.pet_owner_history (pet_id, started_at desc);

create or replace function public.track_pet_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.pet_owner_history (pet_id, client_id) values (new.id, new.client_id);
  elsif new.client_id is distinct from old.client_id then
    update public.pet_owner_history
       set ended_at = now()
     where pet_id = new.id and ended_at is null;
    insert into public.pet_owner_history (pet_id, client_id) values (new.id, new.client_id);
  end if;
  return new;
end;
$$;

create trigger pets_track_owner after insert or update of client_id on public.pets
  for each row execute function public.track_pet_owner();

-- ---------------------------------------------------------------------
-- 7. Turnos
-- ---------------------------------------------------------------------
create table public.appointments (
  id            uuid primary key default gen_random_uuid(),
  pet_id        uuid not null references public.pets (id),
  client_id     uuid references public.clients (id),
  vet_id        uuid references public.profiles (id),
  starts_at     timestamptz not null,
  duration_min  integer not null default 30 check (duration_min > 0),
  reason        text not null check (length(trim(reason)) > 0),
  status        public.appointment_status not null default 'pendiente',
  cancel_reason text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references public.profiles (id) default auth.uid()
);

create index appointments_starts_idx on public.appointments (starts_at);
create index appointments_pet_idx on public.appointments (pet_id);
create index appointments_client_idx on public.appointments (client_id);

create trigger appointments_updated_at before update on public.appointments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 8. Consultas (historia clínica)
-- ---------------------------------------------------------------------
create table public.consultations (
  id              uuid primary key default gen_random_uuid(),
  pet_id          uuid not null references public.pets (id),
  vet_id          uuid references public.profiles (id) default auth.uid(),
  appointment_id  uuid references public.appointments (id),
  consulted_at    timestamptz not null default now(),
  reason          text not null check (length(trim(reason)) > 0),
  weight_kg       numeric(6, 2) check (weight_kg is null or weight_kg > 0),
  symptoms        text,
  diagnosis       text,
  treatment       text,
  medications     text,
  observations    text,
  studies         text,
  study_results   text,
  evolution       text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.profiles (id) default auth.uid()
);

create index consultations_pet_idx on public.consultations (pet_id, consulted_at desc);
create index consultations_date_idx on public.consultations (consulted_at desc);

create trigger consultations_updated_at before update on public.consultations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 9. Tratamientos
-- ---------------------------------------------------------------------
create table public.treatments (
  id               uuid primary key default gen_random_uuid(),
  pet_id           uuid not null references public.pets (id),
  consultation_id  uuid references public.consultations (id),
  name             text not null check (length(trim(name)) > 0),
  dose             text,
  frequency        text,
  duration         text,
  start_date       date,
  end_date         date,
  instructions     text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid references public.profiles (id) default auth.uid(),
  constraint treatments_dates check (end_date is null or start_date is null or end_date >= start_date)
);

create index treatments_pet_idx on public.treatments (pet_id, start_date desc);

create trigger treatments_updated_at before update on public.treatments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 10. Estudios y archivos (el archivo vive en Storage, acá solo la ruta)
-- ---------------------------------------------------------------------
create table public.pet_files (
  id               uuid primary key default gen_random_uuid(),
  pet_id           uuid not null references public.pets (id),
  consultation_id  uuid references public.consultations (id),
  category         public.file_category not null default 'otro',
  storage_path     text not null unique,
  file_name        text not null,
  mime_type        text,
  size_bytes       bigint,
  description      text,
  study_date       date,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  uploaded_by      uuid references public.profiles (id) default auth.uid()
);

create index pet_files_pet_idx on public.pet_files (pet_id, created_at desc);

-- ---------------------------------------------------------------------
-- 11. Agenda: tareas, recordatorios, actividades y notas del día
-- ---------------------------------------------------------------------
create table public.tasks (
  id            uuid primary key default gen_random_uuid(),
  kind          public.task_kind not null default 'tarea',
  title         text not null check (length(trim(title)) > 0),
  description   text,
  due_at        timestamptz,
  completed_at  timestamptz,
  assigned_to   uuid references public.profiles (id),
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references public.profiles (id) default auth.uid()
);

create index tasks_due_idx on public.tasks (due_at);

create trigger tasks_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

create table public.daily_notes (
  id          uuid primary key default gen_random_uuid(),
  note_date   date not null default current_date,
  content     text not null check (length(trim(content)) > 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles (id) default auth.uid()
);

create index daily_notes_date_idx on public.daily_notes (note_date desc);

create trigger daily_notes_updated_at before update on public.daily_notes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 12. Seguridad (RLS): solo personal activo; nadie puede borrar
-- ---------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.clients           enable row level security;
alter table public.pets              enable row level security;
alter table public.pet_owner_history enable row level security;
alter table public.appointments      enable row level security;
alter table public.consultations     enable row level security;
alter table public.treatments        enable row level security;
alter table public.pet_files         enable row level security;
alter table public.tasks             enable row level security;
alter table public.daily_notes       enable row level security;

-- Perfiles: el personal ve a todos; cada uno edita el suyo; el admin edita cualquiera.
create policy "profiles_select_staff" on public.profiles
  for select to authenticated using (public.is_active_staff() or id = auth.uid());
create policy "profiles_update_self_or_admin" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- Tablas operativas: el personal activo puede ver, crear y modificar.
do $$
declare
  t text;
begin
  foreach t in array array[
    'clients', 'pets', 'appointments', 'consultations',
    'treatments', 'pet_files', 'tasks', 'daily_notes'
  ] loop
    execute format(
      'create policy "%1$s_select_staff" on public.%1$I for select to authenticated using (public.is_active_staff())', t);
    execute format(
      'create policy "%1$s_insert_staff" on public.%1$I for insert to authenticated with check (public.is_active_staff())', t);
    execute format(
      'create policy "%1$s_update_staff" on public.%1$I for update to authenticated using (public.is_active_staff()) with check (public.is_active_staff())', t);
  end loop;
end;
$$;

-- El historial de dueños solo se lee (lo escribe el trigger).
create policy "pet_owner_history_select_staff" on public.pet_owner_history
  for select to authenticated using (public.is_active_staff());

-- Doble candado: sin DELETE ni TRUNCATE para los roles de la app.
revoke delete, truncate on all tables in schema public from anon, authenticated;
revoke insert, update on public.pet_owner_history from anon, authenticated;

-- ---------------------------------------------------------------------
-- 13. Storage: bucket privado para estudios (PDF, Excel, imágenes)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pet-files',
  'pet-files',
  false,
  52428800, -- 50 MB
  array[
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif'
  ]
)
on conflict (id) do nothing;

create policy "pet_files_storage_select_staff" on storage.objects
  for select to authenticated
  using (bucket_id = 'pet-files' and public.is_active_staff());

create policy "pet_files_storage_insert_staff" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'pet-files' and public.is_active_staff());
