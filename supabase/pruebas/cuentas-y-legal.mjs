// Prueba las migraciones de la fase 5A en un Postgres real (PGlite) con un entorno parecido a Supabase.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const MIG = fileURLToPath(new URL('../migrations/', import.meta.url));
const db = new PGlite();

let ok = 0;
let fallos = 0;
const bien = (m) => {
  ok++;
  console.log('  ✓ ' + m);
};
const mal = (m) => {
  fallos++;
  console.log('  ✗ ' + m);
};
const debeFallar = async (m, sql, params) => {
  try {
    await db.query(sql, params);
    mal(m + ' (NO falló)');
  } catch (e) {
    bien(m + ' → ' + e.message.split('\n')[0].slice(0, 90));
  }
};
const como = async (rol, uid) => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false); select set_config('request.jwt.claim.role', '${rol}', false);`);
  if (rol !== 'postgres') await db.exec(`set role ${rol}`);
};

// ---------- Entorno tipo Supabase ----------
await db.exec(`
  create schema auth;
  create schema extensions;
  create table auth.users (id uuid primary key, email text);
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  grant usage on schema public, auth, extensions to anon, authenticated, service_role;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'postgres') $$;
  grant execute on all functions in schema auth to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`);

console.log('1) Migraciones');
for (const f of ['20261111000100_cuentas_y_legal.sql', '20261111000200_documentos_legales.sql']) {
  try {
    await db.exec(readFileSync(MIG + f, 'utf8'));
    bien(f);
  } catch (e) {
    mal(f + ': ' + e.message);
    process.exit(1);
  }
}
// En Supabase, extensions vive en su esquema; hay que dar uso a los roles.
await db.exec(`grant usage on schema extensions to anon, authenticated, service_role; grant execute on all functions in schema extensions to anon, authenticated, service_role;`);

console.log('2) Textos legales');
const docs = (await db.query(`select tipo, version, hash, vigente from legal_documents order by tipo`)).rows;
docs.length === 4 && docs.every((d) => d.vigente) ? bien('4 documentos vigentes cargados') : mal('documentos: ' + JSON.stringify(docs));
const hTerm = createHash('sha256').update(readFileSync(fileURLToPath(new URL('../../legal/terminos/v1.0.0.md', import.meta.url)), 'utf8').replace(/\r\n?/g, '\n'), 'utf8').digest('hex');
docs.find((d) => d.tipo === 'terminos')?.hash === hTerm ? bien('hash de términos igual al de Node y del navegador') : mal('hash distinto');
await debeFallar('no se puede cambiar el texto de una versión', `update legal_documents set texto = texto || ' ' where tipo = 'terminos'`);
await debeFallar('no se puede borrar una versión', `delete from legal_documents where tipo = 'cookies'`);
await debeFallar('el hash debe corresponder al texto', `insert into legal_documents (tipo, version, hash, texto) values ('terminos','9.9.9','${'0'.repeat(64)}','x')`);

console.log('3) Registro (como lo hace la función del servidor)');
const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
await db.exec(`insert into auth.users values ('${A}','a@prueba.co'), ('${B}','b@prueba.co')`);
await como('service_role');
await db.exec(`insert into profiles (id, nombre, apellido, fecha_nacimiento) values ('${A}','Ana','Prueba','1995-05-05'), ('${B}','Beto','Prueba','1990-01-01')`);
const vig = Object.fromEntries(docs.map((d) => [d.tipo, d]));
const consent = (u, tipo, accion = 'aceptado', extra = '') =>
  `('${u}','titular','${tipo}','${vig[tipo].version}','${vig[tipo].hash}','${accion}','Texto de la casilla','casilla_registro_web','190.0.0.1','Prueba'${extra})`;
await db.exec(`insert into consent_records (user_id, actor, document_type, document_version, document_hash, action, checkbox_text, method, ip_address, user_agent) values ${consent(A, 'terminos')}, ${consent(A, 'privacidad')}`);
const regs = (await db.query(`select evidence_hash, timestamp_utc from consent_records where user_id = $1 order by timestamp_utc`, [A])).rows;
regs.length === 2 && regs.every((r) => /^[0-9a-f]{64}$/.test(r.evidence_hash)) ? bien('2 consentimientos con hash de evidencia') : mal('consentimientos: ' + JSON.stringify(regs));
await debeFallar('rechaza un hash de documento que no corresponde', `insert into consent_records (user_id, actor, document_type, document_version, document_hash, action, checkbox_text, method) values ('${A}','titular','terminos','1.0.0','${'f'.repeat(64)}','aceptado','x','x')`);
const cadena = (await db.query(`select * from verificar_cadena($1)`, [A])).rows[0];
cadena.integra && cadena.registros === 2 ? bien('cadena íntegra (2 registros)') : mal('cadena: ' + JSON.stringify(cadena));

console.log('4) Solo inserción (ni el servicio puede editar ni borrar)');
await debeFallar('UPDATE prohibido', `update consent_records set ip_address = '1.1.1.1' where user_id = '${A}'`);
await debeFallar('DELETE prohibido', `delete from consent_records where user_id = '${A}'`);
await debeFallar('TRUNCATE prohibido', `truncate consent_records`);

console.log('5) Representante legal y seudonimización');
await db.exec(`insert into consent_records (user_id, actor, actor_name, actor_email, document_type, document_version, document_hash, action, checkbox_text, method) values ('${B}','representante_legal','Carla Mamá','carla@prueba.co','privacidad','${vig.privacidad.version}','${vig.privacidad.hash}','aceptado','x','enlace_correo_representante')`);
await db.exec(`select seudonimizar_consentimientos('${B}')`);
const seud = (await db.query(`select actor_name, actor_email from consent_records where user_id = $1`, [B])).rows[0];
seud.actor_name.startsWith('seud:') && seud.actor_email.startsWith('seud:') ? bien('nombre y correo del representante seudonimizados') : mal('seudonimización: ' + JSON.stringify(seud));
const cadenaB = (await db.query(`select * from verificar_cadena($1)`, [B])).rows[0];
cadenaB.integra ? bien('la cadena sigue íntegra después de seudonimizar') : mal('cadena B rota');

console.log('6) Permisos de una persona con sesión (RLS)');
await como('authenticated', A);
const perfiles = (await db.query(`select id from profiles`)).rows;
perfiles.length === 1 && perfiles[0].id === A ? bien('solo ve su propio perfil') : mal('perfiles visibles: ' + perfiles.length);
await db.query(`update profiles set apodo = 'Anita' where id = $1`, [A]);
bien('puede corregir su apodo');
await debeFallar('no puede cambiar su fecha de nacimiento', `update profiles set fecha_nacimiento = '2015-01-01' where id = '${A}'`);
await debeFallar('no puede volverse administradora', `update profiles set es_admin = true where id = '${A}'`);
const otro = await db.query(`update profiles set apodo = 'x' where id = $1`, [B]);
otro.affectedRows === 0 ? bien('no puede tocar el perfil de otra persona (0 filas)') : mal('modificó otro perfil');
(await db.query(`select * from consent_records`)).rows.every((r) => r.user_id === A) ? bien('solo ve sus consentimientos') : mal('ve consentimientos ajenos');
await debeFallar('no puede insertar consentimientos directamente', `insert into consent_records (user_id, actor, document_type, document_version, document_hash, action, checkbox_text, method) values ('${A}','titular','terminos','${vig.terminos.version}','${vig.terminos.hash}','aceptado','x','x')`);
const pend = (await db.query(`select * from documentos_pendientes()`)).rows;
pend.length === 0 ? bien('sin documentos pendientes (ya aceptó)') : mal('pendientes: ' + JSON.stringify(pend));
await debeFallar('no puede publicar documentos', `select publicar_documento('terminos','1.0.0')`);
await debeFallar('no puede seudonimizar', `select seudonimizar_consentimientos('${A}')`);

console.log('7) Consultas y reclamos');
await db.query(`insert into habeas_data_requests (tipo, mensaje, user_id) values ('reclamo', 'Mi fecha de nacimiento está mal', $1)`, [B]);
const sol = (await db.query(`select user_id, estado, limite, recibido from habeas_data_requests`)).rows[0];
sol.user_id === A ? bien('la solicitud queda a nombre de quien la envía (aunque intente poner otro)') : mal('user_id: ' + sol.user_id);
sol.estado === 'recibida' ? bien('estado inicial "recibida"; plazo: ' + new Date(sol.limite).toISOString().slice(0, 10)) : mal('estado ' + sol.estado);
const resp = await db.query(`update habeas_data_requests set estado = 'respondida'`);
resp.affectedRows === 0 ? bien('no puede marcar su solicitud como respondida (0 filas)') : mal('pudo responderse');

console.log('8) Persona B, sin consentimientos propios de titular');
await como('authenticated', B);
const pendB = (await db.query(`select tipo from documentos_pendientes() order by tipo`)).rows.map((r) => r.tipo);
pendB.join(',') === 'terminos' ? bien('le pide aceptar términos (la privacidad la autorizó su representante)') : mal('pendientes B: ' + pendB);

console.log('9) Sin sesión (anon)');
await como('anon');
(await db.query(`select count(*)::int n from legal_documents`)).rows[0].n === 4 ? bien('puede leer los textos legales públicos') : mal('anon no lee textos');
(await db.query(`select count(*)::int n from profiles`)).rows[0].n === 0 ? bien('no ve ningún perfil') : mal('anon ve perfiles');
(await db.query(`select count(*)::int n from consent_records`)).rows[0].n === 0 ? bien('no ve consentimientos') : mal('anon ve consentimientos');

console.log(`\nResultado: ${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
