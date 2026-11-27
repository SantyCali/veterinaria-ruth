-- Las notas del día se pueden "borrar" desde la app (tacho de basura).
-- Como en todo el sistema, es una baja lógica: la nota se oculta pero queda guardada.
alter table public.daily_notes add column if not exists active boolean not null default true;
