-- ============================================================================
-- Pizarra Ultimate · Mascota en la cuenta (ADR 0014)
-- Pegar COMPLETO en Supabase > SQL Editor y pulsar "Run". Requiere la fase 5A.
-- Va dentro de una transacción: si algo falla, no queda nada a medias.
-- Solo agrega dos columnas a profiles; no borra ni cambia datos existentes.
-- Es el mismo contenido de supabase/migrations/20261126000100_mascota_en_perfil.sql.
-- ============================================================================
begin;

alter table public.profiles
  add column muneco text check (muneco ~ '^[a-z0-9_-]{1,30}$'),
  add column mascotas_elegidas text[] not null default '{}'
    check (cardinality(mascotas_elegidas) <= 50 and array_to_string(mascotas_elegidas, ',') ~ '^[a-z0-9_,-]*$');

grant update (muneco, mascotas_elegidas) on public.profiles to authenticated;

commit;
