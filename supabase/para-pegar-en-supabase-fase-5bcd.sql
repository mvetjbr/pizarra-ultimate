-- ============================================================================
-- Pizarra Ultimate · Fases 5B, 5C y 5D (jugadas en la nube, libros y compartir)
-- Pegar COMPLETO en Supabase > SQL Editor y pulsar "Run". Requiere la fase 5A.
-- Va dentro de una transacción: si algo falla, no queda nada a medias.
-- No toca las tablas de la fase 5A ni las de la app anterior.
-- ============================================================================
begin;

-- ============================================================================
-- Pizarra Ultimate · Fases 5B, 5C y 5D
--   5B: jugadas en la nube (cada persona las suyas, sincronizadas entre dispositivos)
--   5C: libros de jugadas (colecciones ordenadas)
--   5D: compartir por enlace con permiso "ver" o "editar", copias y reportes
-- Reglas (docs/MULTIUSUARIO_Y_COMPARTIR.md §4), todas validadas aquí y no solo en la app:
--   * Ver: dueño, "editar" y "ver".  Editar contenido: dueño y "editar".
--   * Compartir, cambiar permisos, revocar y borrar: solo el dueño.
--   * Nadie puede listar usuarios. A otras personas solo se les muestra el apodo (o nombre).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Nombre público: apodo o, si no tiene, el nombre. Nunca correo, fecha ni foto.
-- Solo lo usan las funciones de este archivo (no se expone directamente).
-- ---------------------------------------------------------------------------
create function public.nombre_publico(p_usuario uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(btrim(apodo), ''), nombre) from public.profiles where id = p_usuario
$$;
revoke execute on function public.nombre_publico(uuid) from public, anon, authenticated;

create type public.permiso as enum ('ver', 'editar');

-- ---------------------------------------------------------------------------
-- 5B · Jugadas
-- El id lo genera la app (así funciona sin conexión). Los nuevos son UUID.
-- ---------------------------------------------------------------------------
create table public.plays (
  id                 text primary key check (id ~ '^[A-Za-z0-9_-]{6,64}$'),
  owner_id           uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  titulo             text not null default 'Jugada' check (char_length(titulo) <= 120),
  datos              jsonb not null check (jsonb_typeof(datos) = 'object' and octet_length(datos::text) <= 600000),
  version            integer not null default 1,
  editado_por        uuid references public.profiles (id) on delete set null,
  source_play_id     text,
  source_owner_id    uuid references public.profiles (id) on delete set null,
  source_author_name text check (char_length(source_author_name) <= 60),
  creado             timestamptz not null default now(),
  actualizado        timestamptz not null default now(),
  borrado            timestamptz
);
create index plays_owner on public.plays (owner_id);

-- ---------------------------------------------------------------------------
-- 5C · Libros de jugadas
-- ---------------------------------------------------------------------------
create table public.playbooks (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  titulo             text not null check (char_length(btrim(titulo)) between 1 and 80),
  descripcion        text check (char_length(descripcion) <= 500),
  version            integer not null default 1,
  editado_por        uuid references public.profiles (id) on delete set null,
  source_playbook_id uuid,
  source_owner_id    uuid references public.profiles (id) on delete set null,
  source_author_name text check (char_length(source_author_name) <= 60),
  creado             timestamptz not null default now(),
  actualizado        timestamptz not null default now(),
  borrado            timestamptz
);
create index playbooks_owner on public.playbooks (owner_id);

-- Una jugada puede estar en varios libros, pero siempre del mismo dueño del libro.
create table public.playbook_plays (
  playbook_id uuid not null references public.playbooks (id) on delete cascade,
  play_id     text not null references public.plays (id) on delete cascade,
  posicion    integer not null default 0,
  primary key (playbook_id, play_id)
);
create index playbook_plays_play on public.playbook_plays (play_id);

-- ---------------------------------------------------------------------------
-- 5D · Compartir
-- ---------------------------------------------------------------------------
create table public.share_links (
  id         uuid primary key default gen_random_uuid(),
  tipo       text not null check (tipo in ('play', 'playbook')),
  recurso_id text not null,
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  -- 244 bits aleatorios: imposible de adivinar.
  token      text not null unique default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  permiso    public.permiso not null default 'ver',
  expira     timestamptz,
  max_usos   integer check (max_usos > 0),
  usos       integer not null default 0,
  revocado   timestamptz,
  creado     timestamptz not null default now()
);
create index share_links_recurso on public.share_links (tipo, recurso_id);
create index share_links_owner_creado on public.share_links (owner_id, creado);

create table public.shares (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null check (tipo in ('play', 'playbook')),
  recurso_id  text not null,
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  grantee_id  uuid not null references public.profiles (id) on delete cascade,
  permiso     public.permiso not null default 'ver',
  link_id     uuid references public.share_links (id) on delete set null,
  oculto      boolean not null default false, -- "Quitar de mi lista" (lo decide quien recibe)
  creado      timestamptz not null default now(),
  ultimo_uso  timestamptz not null default now(),
  revocado    timestamptz,
  unique (tipo, recurso_id, grantee_id),
  check (grantee_id <> owner_id)
);
create index shares_grantee on public.shares (grantee_id) where revocado is null;

-- Registro de quién abrió cada enlace (lo ve solo el dueño) y de intentos (límite de abuso).
create table public.share_link_opens (
  id       bigint generated always as identity primary key,
  link_id  uuid not null references public.share_links (id) on delete cascade,
  user_id  uuid references public.profiles (id) on delete cascade,
  abierto  timestamptz not null default now()
);
create table public.intentos_enlace (
  user_id uuid not null,
  momento timestamptz not null default now()
);
create index intentos_enlace_usuario on public.intentos_enlace (user_id, momento);

create table public.reportes (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  tipo        text not null check (tipo in ('play', 'playbook')),
  recurso_id  text not null,
  motivo      text not null check (char_length(btrim(motivo)) between 3 and 1000),
  estado      text not null default 'recibido' check (estado in ('recibido', 'revisado', 'retirado', 'descartado')),
  nota_admin  text,
  creado      timestamptz not null default now(),
  revisado    timestamptz
);

-- ---------------------------------------------------------------------------
-- Nivel de acceso de quien llama: 'dueno', 'editar', 'ver' o null.
-- Compartir un libro da acceso a todas sus jugadas (también a las que se agreguen después).
-- ---------------------------------------------------------------------------
create function public.nivel_acceso(p_tipo text, p_id text) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  yo uuid := auth.uid();
  dueno uuid;
  puede_editar boolean;
  puede_ver boolean;
begin
  if yo is null or p_id is null then return null; end if;
  if p_tipo = 'play' then
    select owner_id into dueno from plays where id = p_id and borrado is null;
    if dueno is null then return null; end if;
    if dueno = yo then return 'dueno'; end if;
    select bool_or(s.permiso = 'editar'), count(*) > 0 into puede_editar, puede_ver
      from shares s
     where s.grantee_id = yo and s.revocado is null
       and ((s.tipo = 'play' and s.recurso_id = p_id)
         or (s.tipo = 'playbook' and exists (
               select 1 from playbook_plays pp join playbooks b on b.id = pp.playbook_id
                where pp.play_id = p_id and b.id::text = s.recurso_id and b.borrado is null)));
  elsif p_tipo = 'playbook' then
    select owner_id into dueno from playbooks where id::text = p_id and borrado is null;
    if dueno is null then return null; end if;
    if dueno = yo then return 'dueno'; end if;
    select bool_or(s.permiso = 'editar'), count(*) > 0 into puede_editar, puede_ver
      from shares s
     where s.grantee_id = yo and s.revocado is null and s.tipo = 'playbook' and s.recurso_id = p_id;
  else
    return null;
  end if;
  if puede_editar then return 'editar'; end if;
  if puede_ver then return 'ver'; end if;
  return null;
end $$;

-- ---------------------------------------------------------------------------
-- Disparadores de versión y de columnas protegidas
-- ---------------------------------------------------------------------------
-- Cada cambio sube la versión (para detectar ediciones simultáneas) y deja quién editó.
-- Quien no es dueño (editor) solo puede cambiar el contenido, nunca dueño, borrado ni crédito.
create function public.antes_de_editar_contenido() returns trigger language plpgsql as $$
declare
  -- Al eliminar su cuenta el autor original, la base de datos pone source_owner_id en null
  -- (y autor_eliminado cambia el crédito): eso sí se permite.
  autor_se_fue boolean := old.source_owner_id is not null and new.source_owner_id is null;
begin
  if current_setting('pizarra.interno', true) is distinct from 'si' then
    if new.owner_id is distinct from old.owner_id or new.borrado is distinct from old.borrado
       or (not autor_se_fue and (new.source_owner_id is distinct from old.source_owner_id
                                 or new.source_author_name is distinct from old.source_author_name))
       or new.creado is distinct from old.creado then
      raise exception 'Solo se puede cambiar el contenido';
    end if;
  end if;
  new.version := old.version + 1;
  new.actualizado := now();
  new.editado_por := coalesce(auth.uid(), new.editado_por);
  return new;
end $$;
create trigger plays_editar before update on public.plays
  for each row execute function public.antes_de_editar_contenido();
create trigger playbooks_editar before update on public.playbooks
  for each row execute function public.antes_de_editar_contenido();

-- Lo que se crea desde la app es siempre de quien lo crea y sin crédito inventado.
create function public.antes_de_crear_contenido() returns trigger language plpgsql as $$
begin
  if current_setting('pizarra.interno', true) is distinct from 'si' then
    new.owner_id := auth.uid();
    new.source_owner_id := null;
    new.source_author_name := null;
    new.borrado := null;
  end if;
  new.version := 1;
  new.editado_por := auth.uid();
  new.creado := now();
  new.actualizado := now();
  return new;
end $$;
create trigger plays_crear before insert on public.plays
  for each row execute function public.antes_de_crear_contenido();
create trigger playbooks_crear before insert on public.playbooks
  for each row execute function public.antes_de_crear_contenido();

-- Si el autor original elimina su cuenta, las copias conservan la jugada pero no su apodo.
create function public.autor_eliminado() returns trigger language plpgsql as $$
begin
  if old.source_owner_id is not null and new.source_owner_id is null then
    new.source_author_name := 'Autor que eliminó su cuenta';
  end if;
  return new;
end $$;
create trigger plays_autor_eliminado before update of source_owner_id on public.plays
  for each row execute function public.autor_eliminado();
create trigger playbooks_autor_eliminado before update of source_owner_id on public.playbooks
  for each row execute function public.autor_eliminado();

-- Un libro solo contiene jugadas de su propio dueño.
create function public.verificar_jugada_de_libro() returns trigger language plpgsql
security definer set search_path = public as $$
begin
  if not exists (select 1 from plays p join playbooks b on b.id = new.playbook_id
                  where p.id = new.play_id and p.owner_id = b.owner_id and p.borrado is null) then
    raise exception 'La jugada no pertenece al dueño del libro';
  end if;
  return new;
end $$;
create trigger playbook_plays_verificar before insert or update on public.playbook_plays
  for each row execute function public.verificar_jugada_de_libro();

-- Cambiar el contenido de un libro (agregar/quitar/ordenar) sube su versión.
create function public.tocar_libro() returns trigger language plpgsql
security definer set search_path = public as $$
declare antes text := coalesce(current_setting('pizarra.interno', true), '');
begin
  perform set_config('pizarra.interno', 'si', true);
  update playbooks set version = version where id = coalesce(new.playbook_id, old.playbook_id);
  perform set_config('pizarra.interno', antes, true);
  return null;
end $$;
create trigger playbook_plays_tocar after insert or update or delete on public.playbook_plays
  for each row execute function public.tocar_libro();

-- En shares: el dueño cambia permiso o revoca; quien recibe solo puede ocultarlo de su lista.
create function public.antes_de_editar_share() returns trigger language plpgsql as $$
begin
  if current_setting('pizarra.interno', true) = 'si' then return new; end if;
  if auth.uid() = old.owner_id then
    if new.oculto is distinct from old.oculto then raise exception 'No permitido'; end if;
  elsif auth.uid() = old.grantee_id then
    if new.permiso is distinct from old.permiso or new.revocado is distinct from old.revocado then
      raise exception 'Solo quien compartió puede cambiar el permiso';
    end if;
  else
    raise exception 'No permitido';
  end if;
  if new.tipo is distinct from old.tipo or new.recurso_id is distinct from old.recurso_id
     or new.owner_id is distinct from old.owner_id or new.grantee_id is distinct from old.grantee_id then
    raise exception 'No permitido';
  end if;
  return new;
end $$;
create trigger shares_editar before update on public.shares
  for each row execute function public.antes_de_editar_share();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.plays enable row level security;
alter table public.playbooks enable row level security;
alter table public.playbook_plays enable row level security;
alter table public.share_links enable row level security;
alter table public.shares enable row level security;
alter table public.share_link_opens enable row level security;
alter table public.intentos_enlace enable row level security;
alter table public.reportes enable row level security;

-- El dueño ve también lo borrado (lo necesita la sincronización); los demás, solo lo activo.
create policy "Ver jugadas" on public.plays for select
  using (owner_id = auth.uid() or public.nivel_acceso('play', id) is not null);
create policy "Crear mis jugadas" on public.plays for insert
  with check (owner_id = auth.uid());
create policy "Editar jugadas" on public.plays for update
  using (public.nivel_acceso('play', id) in ('dueno', 'editar'))
  with check (public.nivel_acceso('play', id) in ('dueno', 'editar'));

create policy "Ver libros" on public.playbooks for select
  using (owner_id = auth.uid() or public.nivel_acceso('playbook', id::text) is not null);
create policy "Crear mis libros" on public.playbooks for insert
  with check (owner_id = auth.uid());
create policy "Editar libros" on public.playbooks for update
  using (public.nivel_acceso('playbook', id::text) in ('dueno', 'editar'))
  with check (public.nivel_acceso('playbook', id::text) in ('dueno', 'editar'));

create policy "Ver jugadas de un libro" on public.playbook_plays for select
  using (public.nivel_acceso('playbook', playbook_id::text) is not null);
create policy "Agregar a un libro" on public.playbook_plays for insert
  with check (public.nivel_acceso('playbook', playbook_id::text) in ('dueno', 'editar'));
create policy "Ordenar un libro" on public.playbook_plays for update
  using (public.nivel_acceso('playbook', playbook_id::text) in ('dueno', 'editar'))
  with check (public.nivel_acceso('playbook', playbook_id::text) in ('dueno', 'editar'));
create policy "Quitar de un libro" on public.playbook_plays for delete
  using (public.nivel_acceso('playbook', playbook_id::text) in ('dueno', 'editar'));

create policy "Mis enlaces" on public.share_links for select using (owner_id = auth.uid());
create policy "Desactivar mis enlaces" on public.share_links for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "Accesos míos o que di" on public.shares for select
  using (owner_id = auth.uid() or grantee_id = auth.uid());
create policy "Cambiar accesos" on public.shares for update
  using (owner_id = auth.uid() or grantee_id = auth.uid())
  with check (owner_id = auth.uid() or grantee_id = auth.uid());

create policy "Reportes (admin)" on public.reportes for select using (public.es_admin());
create policy "Revisar reportes (admin)" on public.reportes for update using (public.es_admin()) with check (public.es_admin());

-- Permisos por columna: lo demás solo cambia por funciones.
revoke all on public.plays, public.playbooks, public.playbook_plays, public.share_links, public.shares,
  public.share_link_opens, public.intentos_enlace, public.reportes from anon, authenticated;
grant select on public.plays, public.playbooks, public.playbook_plays, public.share_links, public.shares to authenticated;
grant insert (id, titulo, datos) on public.plays to authenticated;
grant update (titulo, datos) on public.plays to authenticated;
grant insert (titulo, descripcion) on public.playbooks to authenticated;
grant update (titulo, descripcion) on public.playbooks to authenticated;
grant insert, delete on public.playbook_plays to authenticated;
grant update (posicion) on public.playbook_plays to authenticated;
grant update (revocado) on public.share_links to authenticated;
grant update (permiso, revocado, oculto) on public.shares to authenticated;
grant select, update (estado, nota_admin, revisado) on public.reportes to authenticated;
grant all on public.plays, public.playbooks, public.playbook_plays, public.share_links, public.shares,
  public.share_link_opens, public.intentos_enlace, public.reportes to service_role;

-- ---------------------------------------------------------------------------
-- Funciones (RPC)
-- ---------------------------------------------------------------------------

-- Borrar (solo dueño): borrado lógico + se desactivan todos sus enlaces y accesos.
-- Las copias que otros hicieron se conservan (ya son de ellos).
create function public.borrar_contenido(p_tipo text, p_id text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.nivel_acceso(p_tipo, p_id) is distinct from 'dueno' then
    raise exception 'Solo quien lo creó puede borrarlo';
  end if;
  perform set_config('pizarra.interno', 'si', true);
  if p_tipo = 'play' then
    update plays set borrado = now() where id = p_id;
    delete from playbook_plays where play_id = p_id;
  else
    update playbooks set borrado = now() where id::text = p_id;
  end if;
  update share_links set revocado = now() where tipo = p_tipo and recurso_id = p_id and revocado is null;
  update shares set revocado = now() where tipo = p_tipo and recurso_id = p_id and revocado is null;
  perform set_config('pizarra.interno', '', true);
end $$;

-- Crear enlace (solo dueño). Máximo 30 enlaces por minuto por persona.
create function public.crear_enlace(p_tipo text, p_id text, p_permiso public.permiso, p_dias integer default null)
returns text language plpgsql security definer set search_path = public as $$
declare t text;
begin
  if public.nivel_acceso(p_tipo, p_id) is distinct from 'dueno' then
    raise exception 'Solo quien lo creó puede compartirlo';
  end if;
  if (select count(*) from share_links where owner_id = auth.uid() and creado > now() - interval '1 minute') >= 30 then
    raise exception 'Creaste demasiados enlaces seguidos. Espera un minuto.';
  end if;
  if p_dias is not null and p_dias not in (1, 7, 30) then raise exception 'Vencimiento no válido'; end if;
  insert into share_links (tipo, recurso_id, owner_id, permiso, expira)
  values (p_tipo, p_id, auth.uid(), coalesce(p_permiso, 'ver'),
          case when p_dias is null then null else now() + make_interval(days => p_dias) end)
  returning token into t;
  return t;
end $$;

-- Abrir un enlace: da acceso a quien lo abre y lo deja en "Compartido conmigo".
-- Máximo 30 intentos por minuto por persona (también cuentan los enlaces inválidos).
-- Un enlace inválido devuelve cero filas (no un error): así el intento queda registrado.
create function public.abrir_enlace(p_token text)
returns table (tipo text, recurso_id text, permiso text, titulo text, autor text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  yo uuid := auth.uid();
  l share_links;
  t text;
begin
  if yo is null then raise exception 'Inicia sesión para abrir el enlace'; end if;
  delete from intentos_enlace where user_id = yo and momento < now() - interval '1 hour';
  if (select count(*) from intentos_enlace where user_id = yo and momento > now() - interval '1 minute') >= 30 then
    raise exception 'Demasiados intentos. Espera un minuto.';
  end if;
  insert into intentos_enlace (user_id) values (yo);

  select * into l from share_links where token = p_token;
  if l.id is null or l.revocado is not null or (l.expira is not null and l.expira < now())
     or (l.max_usos is not null and l.usos >= l.max_usos) then
    return;
  end if;
  if l.tipo = 'play' then
    select p.titulo into t from plays p where p.id = l.recurso_id and p.borrado is null;
  else
    select b.titulo into t from playbooks b where b.id::text = l.recurso_id and b.borrado is null;
  end if;
  if t is null then return; end if;

  perform set_config('pizarra.interno', 'si', true);
  insert into share_link_opens (link_id, user_id) values (l.id, yo);
  if l.owner_id <> yo then
    update share_links set usos = usos + 1 where id = l.id;
    insert into shares (tipo, recurso_id, owner_id, grantee_id, permiso, link_id)
    values (l.tipo, l.recurso_id, l.owner_id, yo, l.permiso, l.id)
    on conflict on constraint shares_tipo_recurso_id_grantee_id_key do update
      set permiso = case when shares.revocado is null and shares.permiso = 'editar' then 'editar'::public.permiso
                         else excluded.permiso end,
          revocado = null, oculto = false, link_id = excluded.link_id, ultimo_uso = now();
  end if;
  perform set_config('pizarra.interno', '', true);

  return query select l.tipo, l.recurso_id, public.nivel_acceso(l.tipo, l.recurso_id), t, public.nombre_publico(l.owner_id);
end $$;

-- "Compartido conmigo": lo que otras personas me compartieron (sin lo que oculté).
create function public.compartido_conmigo()
returns table (tipo text, recurso_id text, titulo text, permiso text, autor text, actualizado timestamptz)
language sql stable security definer set search_path = public as $$
  select s.tipo, s.recurso_id, coalesce(p.titulo, b.titulo), s.permiso::text, public.nombre_publico(s.owner_id),
         coalesce(p.actualizado, b.actualizado)
    from shares s
    left join plays p on s.tipo = 'play' and p.id = s.recurso_id and p.borrado is null
    left join playbooks b on s.tipo = 'playbook' and b.id::text = s.recurso_id and b.borrado is null
   where s.grantee_id = auth.uid() and s.revocado is null and not s.oculto
     and (p.id is not null or b.id is not null)
   order by coalesce(p.actualizado, b.actualizado) desc
$$;

-- "Personas con acceso" (solo dueño): apodo, permiso y último uso. Nunca correos.
create function public.personas_con_acceso(p_tipo text, p_id text)
returns table (share_id uuid, nombre text, permiso text, desde timestamptz, ultimo_uso timestamptz)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if public.nivel_acceso(p_tipo, p_id) is distinct from 'dueno' then
    raise exception 'Solo quien lo creó puede ver quién tiene acceso';
  end if;
  return query
    select s.id, public.nombre_publico(s.grantee_id), s.permiso::text, s.creado, s.ultimo_uso
      from shares s where s.tipo = p_tipo and s.recurso_id = p_id and s.revocado is null
     order by s.creado;
end $$;

-- Autor y estado actuales de una jugada o libro al que tengo acceso.
create function public.info_contenido(p_tipo text, p_id text)
returns table (permiso text, autor text, editado_por text, version integer, actualizado timestamptz,
               basado_en text)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare n text := public.nivel_acceso(p_tipo, p_id);
begin
  if n is null then return; end if;
  if p_tipo = 'play' then
    return query select n, public.nombre_publico(p.owner_id), public.nombre_publico(p.editado_por), p.version,
                        p.actualizado, p.source_author_name from plays p where p.id = p_id;
  else
    return query select n, public.nombre_publico(b.owner_id), public.nombre_publico(b.editado_por), b.version,
                        b.actualizado, b.source_author_name from playbooks b where b.id::text = p_id;
  end if;
end $$;

-- Guardar una copia en mis jugadas (cualquiera con acceso). Devuelve el id de la copia.
create function public.copiar_jugada(p_id text) returns text
language plpgsql security definer set search_path = public as $$
declare
  o plays;
  nuevo text := gen_random_uuid()::text;
begin
  if public.nivel_acceso('play', p_id) is null then raise exception 'No tienes acceso a esta jugada'; end if;
  select * into o from plays where id = p_id;
  perform set_config('pizarra.interno', 'si', true);
  insert into plays (id, owner_id, titulo, datos, source_play_id, source_owner_id, source_author_name)
  values (nuevo, auth.uid(), o.titulo, jsonb_set(o.datos, '{id}', to_jsonb(nuevo)), o.id,
          case when o.owner_id = auth.uid() then o.source_owner_id else o.owner_id end,
          case when o.owner_id = auth.uid() then o.source_author_name else public.nombre_publico(o.owner_id) end);
  perform set_config('pizarra.interno', '', true);
  return nuevo;
end $$;

-- Copiar un libro completo (con copias de sus jugadas). Devuelve el id del libro nuevo.
create function public.copiar_libro(p_id text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  o playbooks;
  nuevo uuid;
  r record;
  copia text;
  autor text;
begin
  if public.nivel_acceso('playbook', p_id) is null then raise exception 'No tienes acceso a este libro'; end if;
  select * into o from playbooks where id::text = p_id;
  autor := case when o.owner_id = auth.uid() then o.source_author_name else public.nombre_publico(o.owner_id) end;
  perform set_config('pizarra.interno', 'si', true);
  insert into playbooks (owner_id, titulo, descripcion, source_playbook_id, source_owner_id, source_author_name)
  values (auth.uid(), o.titulo, o.descripcion, o.id,
          case when o.owner_id = auth.uid() then o.source_owner_id else o.owner_id end, autor)
  returning id into nuevo;
  for r in select p.*, pp.posicion from playbook_plays pp join plays p on p.id = pp.play_id
            where pp.playbook_id = o.id and p.borrado is null order by pp.posicion loop
    copia := gen_random_uuid()::text;
    insert into plays (id, owner_id, titulo, datos, source_play_id, source_owner_id, source_author_name)
    values (copia, auth.uid(), r.titulo, jsonb_set(r.datos, '{id}', to_jsonb(copia)), r.id,
            case when r.owner_id = auth.uid() then r.source_owner_id else r.owner_id end, autor);
    insert into playbook_plays (playbook_id, play_id, posicion) values (nuevo, copia, r.posicion);
  end loop;
  perform set_config('pizarra.interno', '', true);
  return nuevo;
end $$;

-- Agregar una jugada mía a un libro. Si el libro es de otra persona (y puedo editarlo),
-- se agrega una copia que queda a nombre del dueño del libro, con crédito para mí.
create function public.agregar_a_libro(p_libro uuid, p_play text) returns text
language plpgsql security definer set search_path = public as $$
declare
  b playbooks;
  o plays;
  id_final text := p_play;
  pos integer;
begin
  -- coalesce: sin ningún acceso nivel_acceso da null, y "null not in (...)" no es verdadero.
  if coalesce(public.nivel_acceso('playbook', p_libro::text), '') not in ('dueno', 'editar') then
    raise exception 'No puedes modificar este libro';
  end if;
  if public.nivel_acceso('play', p_play) is null then raise exception 'No tienes acceso a esa jugada'; end if;
  select * into b from playbooks where id = p_libro;
  select * into o from plays where id = p_play;
  select coalesce(max(posicion) + 1, 0) into pos from playbook_plays where playbook_id = p_libro;
  perform set_config('pizarra.interno', 'si', true);
  if o.owner_id <> b.owner_id then
    id_final := gen_random_uuid()::text;
    insert into plays (id, owner_id, titulo, datos, source_play_id, source_owner_id, source_author_name)
    values (id_final, b.owner_id, o.titulo, jsonb_set(o.datos, '{id}', to_jsonb(id_final)), o.id, o.owner_id,
            public.nombre_publico(o.owner_id));
  end if;
  insert into playbook_plays (playbook_id, play_id, posicion) values (p_libro, id_final, pos)
  on conflict do nothing;
  perform set_config('pizarra.interno', '', true);
  return id_final;
end $$;

-- Reportar contenido (cualquiera con acceso).
create function public.reportar_contenido(p_tipo text, p_id text, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.nivel_acceso(p_tipo, p_id) is null then raise exception 'No tienes acceso a este contenido'; end if;
  if (select count(*) from reportes where reporter_id = auth.uid() and creado > now() - interval '1 hour') >= 10 then
    raise exception 'Enviaste muchos reportes. Intenta más tarde.';
  end if;
  insert into reportes (reporter_id, tipo, recurso_id, motivo) values (auth.uid(), p_tipo, p_id, btrim(p_motivo));
end $$;

-- Administración: ver reportes con el título y el autor del contenido, y retirarlo si viola los términos.
create function public.reportes_admin()
returns table (id uuid, tipo text, recurso_id text, titulo text, autor text, motivo text, estado text,
               creado timestamptz)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.es_admin() then raise exception 'Solo administración'; end if;
  return query
    select r.id, r.tipo, r.recurso_id, coalesce(p.titulo, b.titulo), public.nombre_publico(coalesce(p.owner_id, b.owner_id)),
           r.motivo, r.estado, r.creado
      from reportes r
      left join plays p on r.tipo = 'play' and p.id = r.recurso_id
      left join playbooks b on r.tipo = 'playbook' and b.id::text = r.recurso_id
     order by (r.estado = 'recibido') desc, r.creado desc;
end $$;

create function public.retirar_contenido(p_reporte uuid, p_nota text) returns void
language plpgsql security definer set search_path = public as $$
declare r reportes;
begin
  if not public.es_admin() then raise exception 'Solo administración'; end if;
  select * into r from reportes where id = p_reporte;
  if r.id is null then raise exception 'Reporte no encontrado'; end if;
  perform set_config('pizarra.interno', 'si', true);
  if r.tipo = 'play' then update plays set borrado = now() where id = r.recurso_id;
  else update playbooks set borrado = now() where id::text = r.recurso_id; end if;
  update share_links set revocado = now() where tipo = r.tipo and recurso_id = r.recurso_id and revocado is null;
  update shares set revocado = now() where tipo = r.tipo and recurso_id = r.recurso_id and revocado is null;
  update reportes set estado = 'retirado', nota_admin = p_nota, revisado = now()
   where tipo = r.tipo and recurso_id = r.recurso_id and estado = 'recibido';
  perform set_config('pizarra.interno', '', true);
end $$;

revoke execute on function public.nivel_acceso(text, text), public.borrar_contenido(text, text),
  public.crear_enlace(text, text, public.permiso, integer), public.abrir_enlace(text), public.compartido_conmigo(),
  public.personas_con_acceso(text, text), public.info_contenido(text, text), public.copiar_jugada(text),
  public.copiar_libro(text), public.agregar_a_libro(uuid, text), public.reportar_contenido(text, text, text),
  public.reportes_admin(), public.retirar_contenido(uuid, text)
  from public, anon;
grant execute on function public.nivel_acceso(text, text), public.borrar_contenido(text, text),
  public.crear_enlace(text, text, public.permiso, integer), public.abrir_enlace(text), public.compartido_conmigo(),
  public.personas_con_acceso(text, text), public.info_contenido(text, text), public.copiar_jugada(text),
  public.copiar_libro(text), public.agregar_a_libro(uuid, text), public.reportar_contenido(text, text, text),
  public.reportes_admin(), public.retirar_contenido(uuid, text)
  to authenticated, service_role;

commit;

-- Debe mostrar 8 filas, todas con rls = true.
select tablename, rowsecurity as rls from pg_tables
 where schemaname = 'public' and tablename in ('plays','playbooks','playbook_plays','share_links','shares','share_link_opens','intentos_enlace','reportes')
 order by tablename;
