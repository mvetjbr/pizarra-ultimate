-- ============================================================================
-- Pizarra Ultimate · Fase 5A (cuentas, textos legales y consentimientos)
-- Pegar COMPLETO en Supabase > SQL Editor y pulsar "Run".
-- Va dentro de una transacción: si algo falla, no queda nada a medias.
-- No toca las tablas existentes (docs, admins, contadores, mascotas).
-- Probado en Postgres (PGlite) con 32 verificaciones antes de entregarlo.
-- ============================================================================
begin;
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
-- Generado por scripts/legal.mjs: textos legales versionados.
-- Las versiones existentes no se modifican (ON CONFLICT DO NOTHING); solo se agregan nuevas.
insert into public.legal_documents (tipo, version, hash, texto) values
  ('terminos', '1.0.0', '827f8e512e4fb99f22985bc24013ef4122a2ac75dead8f92effaa47aff8a90c7', '# TÉRMINOS Y CONDICIONES DE USO DE Pizarra Ultimate

**Versión 1.0.0 — Vigentes desde [FECHA_VIGENCIA]**

### 1. Quiénes somos
Pizarra Ultimate (la "App") es una herramienta para diseñar, guardar y compartir jugadas de Ultimate con los integrantes de un equipo. La App es administrada por [RESPONSABLE], identificado con [ID_RESPONSABLE], con domicilio en [DIRECCION], Villavicencio, Meta, Colombia (en adelante, "nosotros"). Contacto: [CORREO_PRIVACIDAD] – [TELEFONO].

### 2. Aceptación
Al marcar la casilla "He leído y acepto los Términos y Condiciones" y crear tu cuenta, celebras un acuerdo electrónico con nosotros, válido conforme a la Ley 527 de 1999. Si no estás de acuerdo, no uses la App. Guardamos registro de la fecha, hora y versión que aceptaste.

### 3. Quién puede usar la App
- Personas de 18 años o más.
- Personas entre 14 y 17 años, solo con la autorización de su madre, padre o representante legal, otorgada mediante el procedimiento de la App.
- No se permite el registro de menores de 14 años.

### 4. Tu cuenta
- Debes dar información verdadera y mantenerla actualizada.
- Eres responsable de guardar tu contraseña y de lo que se haga desde tu cuenta. Avísanos de inmediato si sospechas un uso no autorizado.
- La cuenta es personal e intransferible.

### 5. Qué puedes hacer
Crear y editar jugadas sobre la cancha, organizarlas, compartirlas con tu equipo y consultar las que te compartan. La App es gratuita salvo que en el futuro se informe lo contrario de manera previa y clara; ningún cobro se hará sin tu aceptación expresa.
Puedes compartir tus jugadas y libros de jugadas mediante enlaces, decidiendo si la otra persona solo puede verlos o también editarlos. Puedes quitar el acceso o desactivar los enlaces en cualquier momento. Quien tenga acceso puede guardar una copia en su propia cuenta; esa copia será suya y no se eliminará aunque borres el original.

### 6. Qué no puedes hacer
- Subir contenido que no te pertenezca o para el que no tengas permiso, incluidas fotos de otras personas sin su autorización.
- Subir contenido ofensivo, discriminatorio, violento, sexual, o que afecte a niños, niñas o adolescentes.
- Acosar, suplantar o recolectar datos de otros usuarios.
- Intentar vulnerar la seguridad, hacer ingeniería inversa, extraer datos masivamente o usar la App para fines ilegales.
- Usar la App con fines comerciales sin nuestra autorización escrita.
- Compartir enlaces de contenido ajeno haciéndolo pasar por propio, o usar las jugadas de otros con fines comerciales sin su permiso.

### 7. Tu contenido
- Las jugadas, nombres y notas que creas **siguen siendo tuyas** (o de tu equipo).
- Nos das una licencia gratuita, no exclusiva y limitada a lo necesario para guardar y mostrar tu contenido dentro de la App a las personas con quienes decidas compartirlo. Al compartir una jugada o libro, autorizas a quienes lo reciban a verlo, a editarlo si les diste ese permiso, y a guardar una copia para su uso personal o el de su equipo, con mención de tu apodo como autor original.
- Declaras que tienes los derechos sobre lo que subes. Si alguien reclama que un contenido infringe sus derechos, podremos ocultarlo mientras se revisa.

### 8. Nuestra propiedad intelectual
El software, diseño, logotipo, nombre Pizarra Ultimate e ilustraciones propias de la App están protegidos por la Ley 23 de 1982, la Decisión Andina 351 de 1993 y demás normas de propiedad intelectual. No puedes copiarlos, modificarlos ni distribuirlos sin autorización. Los recursos de terceros se usan bajo sus licencias, listadas en la sección "Créditos y licencias".

"Frisbee" es una marca registrada de su titular y no tiene relación con esta App. Pizarra Ultimate no está afiliada ni respaldada por WFDF, la Asociación Colombiana de Ultimate ni otra federación, salvo que se indique expresamente.

### 9. Reportar contenido
Si ves contenido que infringe derechos o estos términos, usa el botón "Reportar contenido" o escribe a [CORREO_PRIVACIDAD]. Revisaremos el reporte y podremos retirar el contenido y suspender cuentas.

### 10. Datos personales
El tratamiento de tus datos se rige por la **Política de Tratamiento de Datos Personales**, que aceptas por separado. Esa autorización es independiente de estos términos.

### 11. Disponibilidad y responsabilidad
- Hacemos lo razonable para que la App funcione bien y de forma segura, pero puede tener interrupciones por mantenimiento, fallas de internet o de proveedores.
- Las jugadas son una ayuda táctica. La práctica deportiva implica riesgos propios del deporte que no dependen de la App.
- En la medida permitida por la ley colombiana, no respondemos por daños derivados de causas ajenas a nuestro control o del mal uso de la App. Nada de estos términos limita los derechos que te concede la Ley 1480 de 2011 (Estatuto del Consumidor) ni nuestra responsabilidad por dolo o culpa grave.

### 12. Suspensión y terminación
- Puedes eliminar tu cuenta cuando quieras desde "Mis datos".
- Podemos suspender o cerrar cuentas que incumplan estos términos, informándote el motivo.

### 13. Cambios
Si cambiamos estos términos te avisaremos en la App y deberás aceptar la nueva versión para seguir usándola. Las versiones anteriores quedan disponibles para consulta.

### 14. Ley aplicable
Estos términos se rigen por las leyes de la República de Colombia. Cualquier controversia se intentará resolver primero de forma directa escribiendo a [CORREO_PRIVACIDAD]; si no hay acuerdo, podrás acudir a la Superintendencia de Industria y Comercio o a los jueces competentes de Colombia.
'),
  ('privacidad', '1.0.0', '53641de391e731d6a34e05d29175e16a87d3672f6a053396b5873b2cf40e0e12', '# POLÍTICA DE TRATAMIENTO DE DATOS PERSONALES DE Pizarra Ultimate

**Versión 1.0.0 — Vigente desde [FECHA_VIGENCIA]**
Expedida en cumplimiento de la Ley Estatutaria 1581 de 2012 y el Decreto 1074 de 2015 (Capítulo 25, Título 2, Parte 2, Libro 2).

### 1. Responsable del tratamiento
- **Nombre:** [RESPONSABLE]
- **Identificación:** [ID_RESPONSABLE]
- **Domicilio:** [DIRECCION], Villavicencio, Meta, Colombia
- **Correo:** [CORREO_PRIVACIDAD]
- **Teléfono:** [TELEFONO]

### 2. Datos que recolectamos
**Los que tú nos das al registrarte:**
- Obligatorios: nombre, apellido, correo electrónico, contraseña (guardada cifrada, nunca la vemos) y fecha de nacimiento.
- Opcionales: apodo, número de camiseta, rol preferido, categoría de emparejamiento para la división mixta (MMP/FMP) y foto de perfil.

**Los que se generan al usar la App:**
- Jugadas creadas, equipos a los que perteneces y contenido que compartes.
- Enlaces que creas, personas a las que das acceso y registro de quién abrió tus enlaces y cuándo.
- Datos técnicos: dirección IP, tipo de dispositivo y navegador, versión de la App, fecha y hora de acceso, y registros de aceptación de documentos legales.

**Datos de menores (14 a 17 años):** los anteriores, más el nombre, correo y parentesco de su representante legal.

**No recolectamos** datos de salud, ubicación, contactos del teléfono, datos biométricos ni datos financieros.

**Datos sensibles:** la categoría de emparejamiento es opcional, puedes responder "Prefiero no decir" y **no estás obligado(a) a suministrarla**. Ninguna función de la App se condiciona a que la entregues.

### 3. Finalidades
Usamos tus datos para:
1. Crear y administrar tu cuenta y verificar tu correo.
2. Permitirte diseñar, guardar y compartir jugadas con tu equipo, y mostrar tu apodo, número y foto a los integrantes de tus equipos.
3. Armar líneas en categoría mixta (solo si diste el dato opcional).
4. Verificar tu edad y, si eres menor, gestionar la autorización de tu representante.
5. Enviarte mensajes sobre la cuenta, la seguridad y cambios en los documentos legales (no enviamos publicidad).
6. Garantizar la seguridad de la App, prevenir fraudes y atender reportes de contenido.
7. Conservar prueba de tus autorizaciones y atender requerimientos de autoridades.
8. Atender tus consultas y reclamos.

Si queremos usar tus datos para una finalidad distinta, te pediremos una nueva autorización.

### 4. Tus derechos como titular (art. 8 de la Ley 1581 de 2012)
- Conocer, actualizar y rectificar tus datos.
- Pedir prueba de la autorización que nos diste.
- Saber qué uso le hemos dado a tus datos.
- Presentar quejas ante la Superintendencia de Industria y Comercio (SIC), después de agotar el trámite con nosotros.
- Revocar la autorización y/o pedir que borremos tus datos, cuando no exista un deber legal o contractual de conservarlos.
- Acceder gratis a tus datos.

### 5. Cómo ejercer tus derechos
- **Dentro de la App:** sección "Mis datos" (ver, descargar, corregir, eliminar cuenta, enviar consulta o reclamo).
- **Por correo:** [CORREO_PRIVACIDAD], indicando nombre, correo de la cuenta, tu solicitud y cómo quieres recibir la respuesta.

**Plazos:**
- **Consultas:** respuesta en máximo 10 días hábiles desde el recibo. Si no es posible, te informaremos el motivo y responderemos dentro de los 5 días hábiles siguientes.
- **Reclamos** (corrección, actualización, supresión o incumplimiento): respuesta en máximo 15 días hábiles. Si no es posible, te informaremos el motivo y responderemos dentro de los 8 días hábiles siguientes. Si el reclamo está incompleto, te pediremos completarlo en 5 días; si pasan 2 meses sin respuesta, se entenderá desistido.

También pueden ejercer estos derechos tus causahabientes, tu representante o apoderado, y, en el caso de menores, su representante legal.

### 6. Niños, niñas y adolescentes
Solo tratamos datos de personas entre 14 y 17 años con la autorización de su representante legal y escuchando la opinión del menor, respetando su interés superior y sus derechos fundamentales. Para estas cuentas no hacemos perfilamiento, no mostramos publicidad, no recolectamos ubicación ni datos biométricos, y la foto de perfil está oculta por defecto para personas fuera de sus equipos. Hay un canal visible para reportar contenido o conductas inapropiadas.

### 7. Con quién compartimos tus datos
- **Personas con quienes compartes contenido:** ven tu apodo (o nombre, si no tienes apodo), tu foto de perfil si eres mayor de edad y decidiste mostrarla, y las jugadas o libros que compartiste. Nunca ven tu correo, tu fecha de nacimiento ni tus demás datos. En las copias que hagan de tu contenido aparecerá tu apodo como autor original.
- **Proveedores tecnológicos (encargados):** [PROVEEDOR_HOSTING] aloja la base de datos y la autenticación. Solo tratan los datos por cuenta nuestra y bajo nuestras instrucciones.
- **Autoridades:** cuando una ley o una orden lo exija.

**No vendemos ni cedemos tus datos.**

### 8. Transmisión internacional
Los servidores de [PROVEEDOR_HOSTING] pueden estar ubicados fuera de Colombia ([PAÍS]). Esto es una transmisión a un encargado, amparada en un contrato con cláusulas de protección de datos, conforme al artículo 26 de la Ley 1581 de 2012 y las instrucciones de la SIC. Al autorizar esta política, aceptas esa transmisión.

### 9. Seguridad
Usamos conexión cifrada (HTTPS), contraseñas con hash, control de acceso por equipo y respaldos. Si ocurre un incidente que afecte tus datos, te avisaremos y lo reportaremos a la SIC.

### 10. Conservación
- Datos de cuenta y jugadas: mientras tu cuenta esté activa. Al eliminarla, se borran en máximo 30 días, salvo copias de respaldo que se sobrescriben en su ciclo normal.
- Registros de aceptación de documentos legales: se conservan seudonimizados mínimo 3 años después de terminada la relación, para cumplir el deber legal de conservar prueba de la autorización.
- Si eliminas tu cuenta, las copias que otras personas hicieron de tu contenido se conservan en sus cuentas, sin tu apodo.

### 11. Cambios a esta política
Te avisaremos en la App antes de aplicar cambios sustanciales. Si el cambio afecta las finalidades, te pediremos una nueva autorización. Las versiones anteriores quedan publicadas en la App.

### 12. Autorización
Al marcar la casilla de autorización, declaras que diste tu consentimiento **previo, expreso e informado** para el tratamiento de tus datos conforme a esta política.
'),
  ('cookies', '1.1.0', '5f88f55de52133da1ac74e59f56d5f282d1ae65e93aa1341c1620b5f9f8db546', '# POLÍTICA DE COOKIES Y ALMACENAMIENTO LOCAL

**Versión 1.1.0 — Vigente desde [FECHA_VIGENCIA]**

### 1. Qué son
Las cookies y tecnologías similares (almacenamiento local del navegador, IndexedDB, caché de la aplicación, identificadores de SDK en apps móviles) son pequeños archivos o registros que se guardan en tu dispositivo.

### 2. Cuáles usamos
Resultado de la revisión del código de la App: no usa cookies, SDK de terceros, analítica, publicidad ni píxeles de redes sociales. Solo usa almacenamiento del propio navegador, así:

| Nombre / tecnología | Tipo | Para qué | Duración |
|---|---|---|---|
| IndexedDB: `pizarra:jugada-actual`, `pizarra:biblioteca` | Necesaria | Guardar la jugada que estás editando y tus jugadas, para usar la App sin conexión | Hasta que las borres |
| IndexedDB: `pizarra:preferencias` | Necesaria | Recordar tus preferencias: colores de los equipos, cuadrícula, leyenda, nombres e indicador de match | Hasta que las borres |
| IndexedDB: `pizarra:roster` | Necesaria | Guardar el roster de tu equipo **solo en este dispositivo**; no se envía a nuestros servidores | Hasta que lo borres |
| Caché de la aplicación (Service Worker) | Necesaria | Guardar los archivos de la App para que abra sin internet | Hasta que se publique una versión nueva o borres los datos del sitio |
| localStorage: `sb-<proyecto>-auth-token` | Necesaria | Mantener tu sesión iniciada, solo si creas una cuenta | Hasta que cierres sesión |

La App usa las fuentes tipográficas de tu propio dispositivo; para mostrarlas no se contacta a servicios externos.

Además, si entras con tu cuenta, tu perfil, tus jugadas, libros y enlaces se guardan en tu espacio privado de la base de datos de [PROVEEDOR_HOSTING], que actúa como encargado del tratamiento.

### 3. Consentimiento
- Las **necesarias** son indispensables para que la App funcione y están cubiertas por la autorización de la Política de Datos.
- Actualmente la App no usa cookies de analítica, publicidad ni de redes sociales.

### 4. Cómo eliminarlas
Puedes borrar las cookies y datos del sitio desde la configuración de tu navegador o desinstalando la App. Si borras las necesarias, perderás las jugadas, el roster y las preferencias guardadas en ese dispositivo que no hayas subido a tu cuenta, y tendrás que iniciar sesión de nuevo.
'),
  ('creditos', '1.1.0', '56e3b827bf8ebe71570ee5d56e4f040bb0c4c5e69ed875c1b0691d523e7e4325', '# CRÉDITOS Y LICENCIAS

**Versión 1.1.0 — Vigente desde [FECHA_VIGENCIA]**

### 1. Tipografías
La App usa las fuentes del sistema de cada dispositivo (system-ui). No incluye ni descarga fuentes de terceros.

### 2. Ilustraciones, íconos y animaciones
- La cancha, las fichas de jugadores, las flechas, el disco, los íconos de la interfaz y los íconos de la App fueron creados para la App y están dibujados en código (SVG y un generador propio de PNG). No se usan imágenes ni íconos de terceros.
- No se usan logos de federaciones, torneos, clubes ni marcas. "Frisbee" es una marca registrada de su titular y no tiene relación con esta App.

### 3. Librerías de código
La App se construye con estas librerías de código abierto. Todas permiten su uso en aplicaciones como esta; ninguna es GPL ni AGPL.

| Librería | Versión | Licencia | Para qué |
|---|---|---|---|
| React y React DOM | 18.3.1 | MIT | Interfaz |
| Zustand | 4.5.7 | MIT | Estado de la App |
| idb-keyval | 6.3.0 | Apache-2.0 | Guardar datos en el dispositivo |
| lz-string | 1.5.0 | MIT | Comprimir jugadas en enlaces |
| gifenc | 1.0.3 | MIT | Exportar GIF |
| supabase-js | 2.45.4 | MIT | Cuentas y sincronización |
| Workbox (vía vite-plugin-pwa) | 7.4.1 | MIT | Uso sin conexión |

La lista completa de dependencias y sus licencias se genera automáticamente a partir del código.

### 4. Reglamento
La App no reproduce el reglamento oficial de Ultimate. Para consultarlo, visita el sitio oficial de la WFDF (wfdf.sport).
')
on conflict (tipo, version) do nothing;

-- Marca como vigente la versión indicada en legal/vigentes.json.
select public.publicar_documento('terminos'::public.tipo_documento, '1.0.0');
select public.publicar_documento('privacidad'::public.tipo_documento, '1.0.0');
select public.publicar_documento('cookies'::public.tipo_documento, '1.1.0');
select public.publicar_documento('creditos'::public.tipo_documento, '1.1.0');

commit;

-- Resultado esperado: 4 filas, todas con vigente = true.
select tipo, version, left(hash, 12) as hash, vigente from public.legal_documents order by tipo;