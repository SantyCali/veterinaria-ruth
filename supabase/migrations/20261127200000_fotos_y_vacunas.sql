-- =====================================================================
-- Foto de perfil de la mascota + plan de vacunas con vencimientos
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Foto de la mascota (el archivo vive en el bucket privado pet-files)
-- ---------------------------------------------------------------------
alter table public.pets add column if not exists photo_path text;

-- ---------------------------------------------------------------------
-- 2. Vacunas
-- ---------------------------------------------------------------------
create table public.vaccinations (
  id          uuid primary key default gen_random_uuid(),
  pet_id      uuid not null references public.pets (id),
  vaccine     text not null check (length(trim(vaccine)) > 0),
  applied_on  date not null default current_date,
  next_due    date,
  batch       text,
  vet_id      uuid references public.profiles (id) default auth.uid(),
  notes       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles (id) default auth.uid(),
  constraint vaccinations_dates check (next_due is null or next_due >= applied_on)
);

create index vaccinations_pet_idx on public.vaccinations (pet_id, applied_on desc);
create index vaccinations_due_idx on public.vaccinations (next_due) where active;

create trigger vaccinations_updated_at before update on public.vaccinations
  for each row execute function public.set_updated_at();

alter table public.vaccinations enable row level security;

create policy "vaccinations_select_staff" on public.vaccinations
  for select to authenticated using (public.is_active_staff());
create policy "vaccinations_insert_staff" on public.vaccinations
  for insert to authenticated with check (public.is_active_staff());
create policy "vaccinations_update_staff" on public.vaccinations
  for update to authenticated using (public.is_active_staff()) with check (public.is_active_staff());

-- Igual que el resto: nada se borra físicamente.
revoke delete, truncate on public.vaccinations from anon, authenticated;
