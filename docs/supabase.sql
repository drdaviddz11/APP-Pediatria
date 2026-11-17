-- PediaControl Pro: preparación del servidor de sincronización en Supabase.
-- Se ejecuta UNA sola vez: Supabase → su proyecto → SQL Editor → New query → pegar todo → Run.
-- Se puede volver a ejecutar sin problema (no borra datos).
--
-- El servidor solo guarda registros cifrados en los equipos (cifrado de extremo a extremo):
--   seq         número de orden
--   usuario     dueño del registro (la cuenta que lo envió)
--   dispositivo identificador al azar del equipo que lo envió
--   fila        etiqueta anónima: igual para todas las versiones de un mismo dato, no revela cuál es
--   momento     hora del cambio (sin contenido), para conservar solo la versión más reciente
--   datos       el contenido cifrado (AES-256-GCM); el servidor no puede leerlo

create table if not exists public.cambios (
  seq bigint generated always as identity primary key,
  usuario uuid not null default auth.uid() references auth.users (id) on delete cascade,
  dispositivo text not null check (char_length(dispositivo) between 1 and 64),
  fila text not null check (char_length(fila) between 1 and 64),
  momento text not null check (char_length(momento) between 1 and 40),
  datos text not null check (char_length(datos) <= 5000000),
  creado_en timestamptz not null default now()
);

create index if not exists cambios_usuario_seq on public.cambios (usuario, seq);
create index if not exists cambios_usuario_fila on public.cambios (usuario, fila);

-- Seguridad por fila: cada cuenta solo puede leer y agregar SUS registros. Nadie puede modificarlos.
alter table public.cambios enable row level security;

revoke all on public.cambios from anon, authenticated;
grant select, insert, delete on public.cambios to authenticated;

drop policy if exists "cambios: leer los propios" on public.cambios;
create policy "cambios: leer los propios" on public.cambios
  for select to authenticated using (usuario = (select auth.uid()));

drop policy if exists "cambios: agregar los propios" on public.cambios;
create policy "cambios: agregar los propios" on public.cambios
  for insert to authenticated with check (usuario = (select auth.uid()));

drop policy if exists "cambios: borrar los propios" on public.cambios;
create policy "cambios: borrar los propios" on public.cambios
  for delete to authenticated using (usuario = (select auth.uid()));

-- Limpieza: borra las versiones viejas de cada dato y deja solo la más reciente,
-- para que el plan gratuito (500 MB) no se llene. La app la llama una vez al día.
-- Se ejecuta con los permisos de quien la llama, así que solo puede tocar los registros de esa cuenta.
create or replace function public.compactar_cambios()
returns integer
language sql
security invoker
set search_path = ''
as $$
  with borrados as (
    delete from public.cambios c
    using public.cambios d
    where c.usuario = (select auth.uid())
      and d.usuario = c.usuario
      and d.fila = c.fila
      and (d.momento collate "C", d.dispositivo collate "C") > (c.momento collate "C", c.dispositivo collate "C")
    returning 1
  )
  select count(*)::integer from borrados;
$$;

revoke all on function public.compactar_cambios() from public, anon;
grant execute on function public.compactar_cambios() to authenticated;
