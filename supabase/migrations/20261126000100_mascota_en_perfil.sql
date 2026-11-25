-- Mascota en la cuenta: el muñeco elegido y las mascotas desbloqueadas viajan con el perfil,
-- para que la pantalla de inicio salude con la misma mascota en cualquier dispositivo.
-- Es una preferencia de juego, no un dato personal; el desbloqueo es un juego, no una medida de seguridad (ADR 0013).

alter table public.profiles
  add column muneco text check (muneco ~ '^[a-z0-9_-]{1,30}$'),
  add column mascotas_elegidas text[] not null default '{}'
    check (cardinality(mascotas_elegidas) <= 50 and array_to_string(mascotas_elegidas, ',') ~ '^[a-z0-9_,-]*$');

-- Cada persona puede cambiar su propia mascota (la regla "Corregir mi perfil" ya limita a su fila).
grant update (muneco, mascotas_elegidas) on public.profiles to authenticated;
