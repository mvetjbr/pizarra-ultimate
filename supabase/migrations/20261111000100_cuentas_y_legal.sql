-- Fase 5A: cuentas, textos legales versionados, registro de consentimientos (auditoría SIC)
-- y solicitudes de habeas data. Marco: Ley 1581 de 2012 y Decreto 1074 de 2015.
--
-- Principios de seguridad:
--  * RLS activado en todas las tablas; cada persona solo ve lo suyo.
--  * Los consentimientos solo se insertan desde funciones del servidor (con IP y hora del servidor)
--    y nunca se editan ni se borran (append-only, encadenados con SHA-256).

-- SHA-256 con la función integrada de Postgres (sha256, desde la versión 11): no requiere pgcrypto.

-- ---------------------------------------------------------------------------
-- Textos legales
-- ---------------------------------------------------------------------------
create type public.tipo_documento as enum ('terminos', 'privacidad', 'cookies', 'creditos');

create table public.legal_documents (
  tipo        public.tipo_documento not null,
  version     text not null check (version ~ '^\d+\.\d+\.\d+$'),
  hash        text not null check (hash ~ '^[0-9a-f]{64}$'),
  texto       text not null,
  vigente     boolean not null default false,
  publicado   timestamptz,
  creado      timestamptz not null default now(),
  primary key (tipo, version)
);
create unique index legal_documents_un_vigente on public.legal_documents (tipo) where vigente;

-- El texto y el hash de una versión no se pueden cambiar jamás (solo marcarla vigente o no).
create function public.proteger_documento() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Los textos legales publicados no se pueden borrar';
  end if;
  if new.texto is distinct from old.texto or new.hash is distinct from old.hash
     or new.tipo is distinct from old.tipo or new.version is distinct from old.version then
    raise exception 'Una versión publicada no se modifica: crea una versión nueva';
  end if;
  return new;
end $$;
create trigger proteger_documento before update or delete on public.legal_documents
  for each row execute function public.proteger_documento();

-- Verifica que el hash guardado corresponda al texto (mismo cálculo que scripts/legal.mjs).
-- Antes normaliza los saltos de línea a LF: al copiar y pegar en Windows pueden llegar como CRLF.
create function public.verificar_hash_documento() returns trigger language plpgsql as $$
begin
  new.texto := replace(replace(new.texto, chr(13) || chr(10), chr(10)), chr(13), chr(10));
  if encode(sha256(convert_to(new.texto, 'UTF8')), 'hex') <> new.hash then
    raise exception 'El hash de % v% no corresponde a su texto', new.tipo, new.version;
  end if;
  return new;
end $$;
create trigger verificar_hash_documento before insert on public.legal_documents
  for each row execute function public.verificar_hash_documento();

-- Cambia la versión vigente de un tipo de documento (solo migraciones / service role).
create function public.publicar_documento(p_tipo public.tipo_documento, p_version text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from legal_documents where tipo = p_tipo and version = p_version) then
    raise exception 'No existe % v%', p_tipo, p_version;
  end if;
  if exists (select 1 from legal_documents where tipo = p_tipo and version = p_version and vigente) then
    return;
  end if;
  update legal_documents set vigente = false where tipo = p_tipo and vigente;
  update legal_documents set vigente = true, publicado = coalesce(publicado, now())
    where tipo = p_tipo and version = p_version;
end $$;
revoke execute on function public.publicar_documento(public.tipo_documento, text) from public, anon, authenticated;

alter table public.legal_documents enable row level security;
create policy "Textos legales públicos" on public.legal_documents for select using (true);

-- ---------------------------------------------------------------------------
-- Perfiles (solo los datos que permite el paquete legal, sección 2)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  nombre           text not null check (char_length(btrim(nombre)) between 2 and 50),
  apellido         text not null check (char_length(btrim(apellido)) between 2 and 50),
  fecha_nacimiento date not null,
  apodo            text check (char_length(apodo) <= 30),
  numero           smallint check (numero between 0 and 99),
  rol              text check (rol in ('handler', 'cutter', 'ambos')),
  match_categoria  text check (match_categoria in ('MMP', 'FMP', 'no_dice')),
  foto_url         text,
  es_menor         boolean not null default false,
  estado           text not null default 'activa' check (estado in ('activa', 'pendiente_representante')),
  es_admin         boolean not null default false,
  creado           timestamptz not null default now(),
  actualizado      timestamptz not null default now()
);

create function public.tocar_actualizado() returns trigger language plpgsql as $$
begin new.actualizado := now(); return new; end $$;
create trigger profiles_actualizado before update on public.profiles
  for each row execute function public.tocar_actualizado();

alter table public.profiles enable row level security;
create policy "Ver mi perfil" on public.profiles for select using (id = auth.uid());
create policy "Corregir mi perfil" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- Solo se pueden corregir los datos que no afectan la verificación de edad ni los permisos.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (nombre, apellido, apodo, numero, rol, match_categoria, foto_url) on public.profiles to authenticated;

create function public.es_admin() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select es_admin from profiles where id = auth.uid()), false)
$$;

-- ---------------------------------------------------------------------------
-- Registro de consentimientos (append-only, cadena de hashes)
-- ---------------------------------------------------------------------------
create type public.actor_consentimiento as enum ('titular', 'representante_legal');
create type public.accion_consentimiento as enum ('aceptado', 'revocado', 'rechazado');

create table public.consent_records (
  id                uuid primary key default gen_random_uuid(),
  -- Sin llave foránea a auth.users: el registro se conserva aunque se elimine la cuenta.
  user_id           uuid not null,
  actor             public.actor_consentimiento not null,
  actor_name        text,
  actor_email       text,
  document_type     public.tipo_documento not null,
  document_version  text not null,
  document_hash     text not null,
  action            public.accion_consentimiento not null,
  checkbox_text     text not null,
  method            text not null,
  timestamp_utc     timestamptz not null default now(),
  timezone_display  text not null default 'America/Bogota',
  ip_address        text,
  user_agent        text,
  app_version       text,
  locale            text not null default 'es-CO',
  evidence_hash     text not null default '',
  foreign key (document_type, document_version) references public.legal_documents (tipo, version)
);
create index consent_records_usuario on public.consent_records (user_id, timestamp_utc);

-- Valor que entra a la cadena para nombre y correo del representante: siempre su SHA-256,
-- así la cadena sigue verificando después de seudonimizar (ver seudonimizar_consentimientos).
create function public.huella_dato(p text) returns text language sql immutable as $$
  select case
    when p is null then ''
    when p like 'seud:%' then substr(p, 6)
    else encode(sha256(convert_to(lower(btrim(p)), 'UTF8')), 'hex')
  end
$$;

create function public.contenido_evidencia(r public.consent_records, anterior text) returns text
language sql immutable as $$
  select concat_ws('|',
    r.id::text, r.user_id::text, r.actor::text, public.huella_dato(r.actor_name), public.huella_dato(r.actor_email),
    r.document_type::text, r.document_version, r.document_hash, r.action::text, r.checkbox_text, r.method,
    to_char(r.timestamp_utc at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), r.timezone_display,
    coalesce(r.ip_address, ''), coalesce(r.user_agent, ''), coalesce(r.app_version, ''), r.locale,
    coalesce(anterior, ''))
$$;

create function public.antes_de_consentimiento() returns trigger language plpgsql as $$
declare
  hash_doc text;
  anterior text;
begin
  -- La hora siempre la pone el servidor, nunca el dispositivo.
  new.timestamp_utc := clock_timestamp();
  new.timezone_display := 'America/Bogota';

  select hash into hash_doc from public.legal_documents
    where tipo = new.document_type and version = new.document_version;
  if hash_doc is null or hash_doc <> new.document_hash then
    raise exception 'El documento aceptado no corresponde a una versión registrada';
  end if;
  if new.actor = 'representante_legal' and (new.actor_name is null or new.actor_email is null) then
    raise exception 'Falta el nombre o el correo del representante legal';
  end if;

  -- Un solo registro a la vez por persona para que la cadena no se bifurque.
  perform pg_advisory_xact_lock(hashtext(new.user_id::text));
  select evidence_hash into anterior from public.consent_records
    where user_id = new.user_id order by timestamp_utc desc, id desc limit 1;

  new.evidence_hash := encode(sha256(convert_to(public.contenido_evidencia(new, anterior), 'UTF8')), 'hex');
  return new;
end $$;
create trigger antes_de_consentimiento before insert on public.consent_records
  for each row execute function public.antes_de_consentimiento();

-- Prohibido editar o borrar. Única excepción: seudonimizar nombre/correo del representante
-- cuando se elimina la cuenta (la cadena sigue verificando porque usa sus hashes).
create function public.proteger_consentimiento() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and current_setting('pizarra.seudonimizar', true) = 'si'
     and (new.actor_name is not distinct from old.actor_name or new.actor_name = 'seud:' || public.huella_dato(old.actor_name))
     and (new.actor_email is not distinct from old.actor_email or new.actor_email = 'seud:' || public.huella_dato(old.actor_email))
     and (row(new.id, new.user_id, new.actor, new.document_type, new.document_version, new.document_hash, new.action,
              new.checkbox_text, new.method, new.timestamp_utc, new.ip_address, new.user_agent, new.app_version, new.evidence_hash)
          is not distinct from
          row(old.id, old.user_id, old.actor, old.document_type, old.document_version, old.document_hash, old.action,
              old.checkbox_text, old.method, old.timestamp_utc, old.ip_address, old.user_agent, old.app_version, old.evidence_hash)) then
    return new;
  end if;
  raise exception 'El registro de consentimientos es de solo inserción: no se puede modificar ni borrar';
end $$;
create trigger proteger_consentimiento before update or delete on public.consent_records
  for each row execute function public.proteger_consentimiento();
-- TRUNCATE no dispara triggers por fila: se bloquea aparte.
create function public.bloquear_truncate() returns trigger language plpgsql as $$
begin raise exception 'No se permite vaciar el registro de consentimientos'; end $$;
create trigger bloquear_truncate before truncate on public.consent_records
  for each statement execute function public.bloquear_truncate();

create function public.seudonimizar_consentimientos(p_usuario uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('pizarra.seudonimizar', 'si', true);
  update consent_records
     set actor_name  = case when actor_name  is null or actor_name  like 'seud:%' then actor_name  else 'seud:' || huella_dato(actor_name)  end,
         actor_email = case when actor_email is null or actor_email like 'seud:%' then actor_email else 'seud:' || huella_dato(actor_email) end
   where user_id = p_usuario;
  perform set_config('pizarra.seudonimizar', 'no', true);
end $$;
revoke execute on function public.seudonimizar_consentimientos(uuid) from public, anon, authenticated;

-- Recalcula la cadena de una persona y dice si está íntegra (para auditoría).
create function public.verificar_cadena(p_usuario uuid) returns table (registros int, integra boolean, primer_error uuid)
language plpgsql stable security definer set search_path = public as $$
declare
  r consent_records;
  anterior text := null;
  n int := 0;
begin
  if p_usuario <> auth.uid() and not es_admin() and auth.role() <> 'service_role' then
    raise exception 'Sin permiso';
  end if;
  for r in select * from consent_records where user_id = p_usuario order by timestamp_utc, id loop
    n := n + 1;
    if encode(sha256(convert_to(contenido_evidencia(r, anterior), 'UTF8')), 'hex') <> r.evidence_hash then
      return query select n, false, r.id;
      return;
    end if;
    anterior := r.evidence_hash;
  end loop;
  return query select n, true, null::uuid;
end $$;

alter table public.consent_records enable row level security;
create policy "Ver mis consentimientos" on public.consent_records for select using (user_id = auth.uid() or public.es_admin());
-- Sin políticas de inserción: solo las funciones del servidor (service role) registran consentimientos.
revoke insert, update, delete, truncate on public.consent_records from anon, authenticated;

-- Documentos vigentes que la persona aún no ha aceptado (para la pantalla de re-aceptación).
create function public.documentos_pendientes() returns table (tipo public.tipo_documento, version text, hash text)
language sql stable security definer set search_path = public as $$
  select d.tipo, d.version, d.hash
    from legal_documents d
   where d.vigente and d.tipo in ('terminos', 'privacidad')
     and coalesce((
       select c.action = 'aceptado' and c.document_version = d.version
         from consent_records c
        where c.user_id = auth.uid() and c.document_type = d.tipo
        order by c.timestamp_utc desc, c.id desc limit 1), false) = false
$$;
revoke execute on function public.documentos_pendientes() from public, anon;
grant execute on function public.documentos_pendientes() to authenticated;

-- ---------------------------------------------------------------------------
-- Consultas y reclamos (habeas data, art. 14 y 15 de la Ley 1581)
-- ---------------------------------------------------------------------------
-- Suma días hábiles (lunes a viernes). No descuenta festivos: el plazo resultante
-- queda igual o antes que el legal, nunca después.
create function public.sumar_dias_habiles(desde date, dias int) returns date language plpgsql immutable as $$
declare d date := desde; n int := 0;
begin
  while n < dias loop
    d := d + 1;
    if extract(isodow from d) < 6 then n := n + 1; end if;
  end loop;
  return d;
end $$;

create table public.habeas_data_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  tipo        text not null check (tipo in ('consulta', 'reclamo')),
  mensaje     text not null check (char_length(btrim(mensaje)) between 10 and 4000),
  recibido    timestamptz not null default now(),
  limite      date not null,
  estado      text not null default 'recibida' check (estado in ('recibida', 'en_tramite', 'respondida')),
  respondido  timestamptz,
  respuesta   text
);

create function public.antes_de_solicitud() returns trigger language plpgsql as $$
begin
  new.user_id := auth.uid();
  new.recibido := now();
  new.estado := 'recibida';
  new.respondido := null;
  new.respuesta := null;
  new.limite := public.sumar_dias_habiles((now() at time zone 'America/Bogota')::date,
                                           case when new.tipo = 'consulta' then 10 else 15 end);
  return new;
end $$;
create trigger antes_de_solicitud before insert on public.habeas_data_requests
  for each row execute function public.antes_de_solicitud();

alter table public.habeas_data_requests enable row level security;
create policy "Ver mis solicitudes" on public.habeas_data_requests for select using (user_id = auth.uid() or public.es_admin());
create policy "Radicar una solicitud" on public.habeas_data_requests for insert with check (auth.uid() is not null);
create policy "Responder solicitudes (admin)" on public.habeas_data_requests for update using (public.es_admin());
revoke delete on public.habeas_data_requests from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Permisos explícitos (por si el proyecto no expone automáticamente las tablas nuevas).
-- Solo lo mínimo; las reglas RLS de arriba siguen decidiendo qué filas ve cada quien.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant select on public.legal_documents to anon, authenticated;
grant select on public.profiles to authenticated;
grant select on public.consent_records to authenticated;
grant select, insert on public.habeas_data_requests to authenticated;
grant update (estado, respondido, respuesta) on public.habeas_data_requests to authenticated;
grant all on public.legal_documents, public.profiles, public.consent_records, public.habeas_data_requests to service_role;
grant execute on function public.es_admin(), public.documentos_pendientes(), public.verificar_cadena(uuid) to authenticated, service_role;
grant execute on function public.publicar_documento(public.tipo_documento, text), public.seudonimizar_consentimientos(uuid) to service_role;