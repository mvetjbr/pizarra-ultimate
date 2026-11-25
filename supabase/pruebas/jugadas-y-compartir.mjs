// Prueba las fases 5B-5D (jugadas, libros y compartir) en Postgres real (PGlite)
// con cuatro cuentas: A dueña, B editora, C lectora y D sin acceso.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const MIG = fileURLToPath(new URL('../migrations/', import.meta.url));
const db = new PGlite();
let ok = 0;
let fallos = 0;
const bien = (m) => (ok++, console.log('  ✓ ' + m));
const mal = (m) => (fallos++, console.log('  ✗ ' + m));
const esperar = (cond, m, extra = '') => (cond ? bien(m) : mal(m + ' ' + extra));
const debeFallar = async (m, sql, params) => {
  try {
    await db.query(sql, params);
    mal(m + ' (NO falló)');
  } catch (e) {
    bien(m + ' → ' + e.message.split('\n')[0].slice(0, 80));
  }
};
const como = async (rol, uid) => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`);
  if (rol !== 'postgres') await db.exec(`set role ${rol}`);
};
const q = async (sql, p) => (await db.query(sql, p)).rows;
const uno = async (sql, p) => (await q(sql, p))[0];

await db.exec(`
  create schema auth; create schema extensions;
  create table auth.users (id uuid primary key, email text);
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  grant usage on schema public, auth, extensions to anon, authenticated, service_role;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.role() returns text language sql stable as $$ select 'authenticated' $$;
  grant execute on all functions in schema auth to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`);

console.log('1) Migraciones');
for (const f of ['20261111000100_cuentas_y_legal.sql', '20261111000200_documentos_legales.sql', '20261124000100_jugadas_libros_compartir.sql']) {
  try {
    await db.exec(readFileSync(MIG + f, 'utf8'));
    bien(f);
  } catch (e) {
    mal(f + ': ' + e.message);
    process.exit(1);
  }
}

const A = 'aaaaaaaa-0000-0000-0000-000000000001';
const B = 'bbbbbbbb-0000-0000-0000-000000000002';
const C = 'cccccccc-0000-0000-0000-000000000003';
const D = 'dddddddd-0000-0000-0000-000000000004';
const ADMIN = 'eeeeeeee-0000-0000-0000-000000000005';
await db.exec(`insert into auth.users values ('${A}','a@x.co'),('${B}','b@x.co'),('${C}','c@x.co'),('${D}','d@x.co'),('${ADMIN}','e@x.co')`);
await db.exec(`insert into profiles (id, nombre, apellido, fecha_nacimiento, apodo, es_admin) values
  ('${A}','Ana','Uno','1990-01-01','Anita', false), ('${B}','Beto','Dos','1990-01-01', null, false),
  ('${C}','Caro','Tres','1990-01-01','Caro', false), ('${D}','Dani','Cuatro','1990-01-01', null, false),
  ('${ADMIN}','Admin','Cinco','1990-01-01', null, true)`);
const datos = (id) => JSON.stringify({ id, nombre: 'Salida de pull', pasos: [] });

console.log('2) Jugadas propias (5B)');
await como('authenticated', A);
await db.query(`insert into plays (id, titulo, datos) values ('jugadaA1', 'Salida de pull', $1)`, [datos('jugadaA1')]);
const pA = await uno(`select owner_id, version from plays where id = 'jugadaA1'`);
esperar(pA.owner_id === A && pA.version === 1, 'A crea su jugada (dueña A, versión 1)');
await db.query(`update plays set datos = $1 where id = 'jugadaA1' and version = 1`, [datos('jugadaA1')]);
esperar((await uno(`select version from plays where id='jugadaA1'`)).version === 2, 'editar sube la versión a 2');
const viejo = await db.query(`update plays set titulo = 'x' where id = 'jugadaA1' and version = 1`);
esperar(viejo.affectedRows === 0, 'guardar sobre una versión vieja no pisa nada (conflicto detectable)');
await debeFallar('no puede crear jugadas a nombre de otra persona', `insert into plays (id, owner_id, titulo, datos) values ('falsa001', '${B}', 'x', '{}')`);
await debeFallar('no puede inventar el crédito de autor', `insert into plays (id, titulo, datos, source_author_name) values ('falsa002', 'x', '{}', 'Otro')`);

for (const [u, n] of [[B, 'B'], [C, 'C'], [D, 'D']]) {
  await como('authenticated', u);
  esperar((await q(`select id from plays where id = 'jugadaA1'`)).length === 0, `${n} no ve la jugada de A antes de que se la compartan`);
}
await como('authenticated', D);
const intento = await db.query(`update plays set titulo = 'hackeada' where id = 'jugadaA1'`);
esperar(intento.affectedRows === 0, 'D no puede editarla llamando la API directamente (0 filas)');

console.log('3) Compartir por enlace (5D)');
await como('authenticated', B);
await debeFallar('B no puede crear enlaces de lo que no es suyo', `select crear_enlace('play', 'jugadaA1', 'editar')`);
await como('authenticated', A);
const tEditar = (await uno(`select crear_enlace('play', 'jugadaA1', 'editar') t`)).t;
const tVer = (await uno(`select crear_enlace('play', 'jugadaA1', 'ver', 7) t`)).t;
esperar(/^[0-9a-f]{64}$/.test(tEditar), 'el token es largo y aleatorio (64 hex)');

await como('authenticated', B);
const abreB = await uno(`select * from abrir_enlace($1)`, [tEditar]);
esperar(abreB.permiso === 'editar' && abreB.autor === 'Anita', 'B abre el enlace: puede editar y ve el apodo de la autora', JSON.stringify(abreB));
await db.query(`update plays set titulo = 'Salida de pull (B)' where id = 'jugadaA1'`);
const tras = await uno(`select titulo, version from plays where id='jugadaA1'`);
esperar(tras.titulo === 'Salida de pull (B)' && tras.version === 3, 'B edita el contenido (versión 3)');
await debeFallar('B no puede borrar la jugada', `select borrar_contenido('play', 'jugadaA1')`);
await debeFallar('B no puede marcarla como borrada por la tabla', `update plays set borrado = now() where id = 'jugadaA1'`);
await debeFallar('B no puede volver a compartirla', `select crear_enlace('play', 'jugadaA1', 'ver')`);
await debeFallar('B no puede ver quién más tiene acceso', `select * from personas_con_acceso('play', 'jugadaA1')`);
esperar((await q(`select id from profiles`)).length === 1, 'B no puede listar usuarios (solo ve su perfil)');
await debeFallar('B no puede consultar nombres de otros', `select nombre_publico('${C}')`);

await como('authenticated', C);
const abreC = await uno(`select * from abrir_enlace($1)`, [tVer]);
esperar(abreC.permiso === 'ver', 'C abre el enlace de solo ver');
const edC = await db.query(`update plays set titulo = 'C cambió' where id = 'jugadaA1'`);
esperar(edC.affectedRows === 0, 'C (ver) no puede editar (0 filas)');
const cc = await uno(`select * from compartido_conmigo()`);
esperar(cc?.titulo === 'Salida de pull (B)' && cc.permiso === 'ver' && cc.autor === 'Anita', '"Compartido conmigo" de C muestra título, permiso y apodo');
const copia = (await uno(`select copiar_jugada('jugadaA1') id`)).id;
const cop = await uno(`select owner_id, source_author_name, datos->>'id' did from plays where id = $1`, [copia]);
esperar(cop.owner_id === C && cop.source_author_name === 'Anita' && cop.did === copia, 'C guarda una copia: es suya y dice "basada en Anita"');
await db.query(`update shares set oculto = true where recurso_id = 'jugadaA1'`);
esperar((await q(`select * from compartido_conmigo()`)).length === 0, 'C puede quitarla de su lista');
await debeFallar('C no puede subirse el permiso a editar', `update shares set permiso = 'editar' where recurso_id = 'jugadaA1'`);

await como('authenticated', D);
esperar((await q(`select * from abrir_enlace('${'0'.repeat(64)}')`)).length === 0, 'un token inventado no da acceso (0 filas)');
let bloqueado = false;
for (let i = 0; i < 31 && !bloqueado; i++) {
  try {
    await db.query(`select * from abrir_enlace('malo${i}')`);
  } catch (e) {
    if (/Demasiados intentos/.test(e.message)) bloqueado = true;
  }
}
esperar(bloqueado, 'tras 30 intentos en un minuto se bloquea (límite de abuso)');
await como('postgres');
await db.exec(`delete from intentos_enlace`); // pasa el minuto

console.log('4) Personas con acceso y revocar');
await como('authenticated', A);
const personas = await q(`select * from personas_con_acceso('play', 'jugadaA1') order by nombre`);
esperar(personas.map((p) => `${p.nombre}:${p.permiso}`).join(',') === 'Beto:editar,Caro:ver', 'A ve quién tiene acceso (apodo o nombre y permiso)', JSON.stringify(personas));
esperar(personas.every((p) => !JSON.stringify(p).includes('@')), 'sin correos en la lista');
await db.query(`update shares set revocado = now() where grantee_id = $1`, [C]);
await como('authenticated', C);
esperar((await q(`select id from plays where id = 'jugadaA1'`)).length === 0, 'al quitarle el acceso, C ya no la ve');
esperar((await q(`select id from plays where id = $1`, [copia])).length === 1, 'pero conserva su copia');

console.log('5) Libros de jugadas (5C)');
await como('authenticated', A);
await db.query(`insert into plays (id, titulo, datos) values ('jugadaA2', 'Zona 3-3-1', $1)`, [datos('jugadaA2')]);
const libro = (await uno(`insert into playbooks (titulo) values ('Defensa') returning id`)).id;
await db.query(`select agregar_a_libro($1, 'jugadaA2')`, [libro]);
const tLibro = (await uno(`select crear_enlace('playbook', $1, 'ver') t`, [libro])).t;
await como('authenticated', D);
await db.query(`select * from abrir_enlace($1)`, [tLibro]);
esperar((await q(`select id from plays where id = 'jugadaA2'`)).length === 1, 'D (con el libro) ve sus jugadas');
await como('authenticated', A);
await db.query(`insert into plays (id, titulo, datos) values ('jugadaA3', 'Hammer', $1)`, [datos('jugadaA3')]);
await db.query(`select agregar_a_libro($1, 'jugadaA3')`, [libro]);
await como('authenticated', D);
esperar((await q(`select id from plays where id = 'jugadaA3'`)).length === 1, 'y también las que se agregan después');
const sinD = await db.query(`delete from playbook_plays where playbook_id = $1`, [libro]);
esperar(sinD.affectedRows === 0, 'D (ver) no puede quitar jugadas del libro');
await como('authenticated', B);
await debeFallar('B (editora de una jugada) no puede tocar un libro que no le compartieron', `select agregar_a_libro('${libro}', 'jugadaA1')`);
await como('authenticated', D);
const libroCopia = (await uno(`select copiar_libro($1) id`, [libro])).id;
const enCopia = await q(`select p.owner_id, p.source_author_name from playbook_plays pp join plays p on p.id = pp.play_id where pp.playbook_id = $1`, [libroCopia]);
esperar(enCopia.length === 2 && enCopia.every((p) => p.owner_id === D && p.source_author_name === 'Anita'), 'D copia el libro: 2 jugadas suyas con crédito a Anita');

console.log('6) Borrar (solo dueña) y reportes');
await como('authenticated', C);
await debeFallar('sin acceso no se puede reportar', `select reportar_contenido('play', 'jugadaA1', 'no me gusta')`);
await como('authenticated', D);
await db.query(`select reportar_contenido('playbook', $1, 'Contenido ofensivo en las notas')`, [libro]);
esperar((await q(`select * from reportes`)).length === 0, 'quien reporta no puede leer la tabla de reportes');
await debeFallar('no administradores no ven el panel de reportes', `select * from reportes_admin()`);
await como('authenticated', ADMIN);
const reps = await q(`select * from reportes_admin()`);
esperar(reps.length === 1 && reps[0].titulo === 'Defensa' && reps[0].autor === 'Anita', 'administración ve el reporte con título y autora');
await como('authenticated', A);
await db.query(`select borrar_contenido('play', 'jugadaA1')`);
await como('authenticated', B);
esperar((await q(`select id from plays where id = 'jugadaA1'`)).length === 0, 'al borrarla A, B pierde el acceso');
await como('authenticated', A);
esperar((await uno(`select borrado is not null b, version from plays where id = 'jugadaA1'`)).b, 'A la sigue viendo como borrada (para sincronizar)');
esperar((await q(`select id from share_links where recurso_id = 'jugadaA1' and revocado is null`)).length === 0, 'y sus enlaces quedaron desactivados');

console.log('7) Eliminar cuenta');
await como('postgres');
await db.exec(`delete from auth.users where id = '${A}'`);
const huerfana = await uno(`select source_author_name, source_owner_id from plays where id = $1`, [copia]);
esperar(huerfana.source_author_name === 'Autor que eliminó su cuenta' && huerfana.source_owner_id === null, 'la copia de C dice "Autor que eliminó su cuenta"', JSON.stringify(huerfana));
esperar((await uno(`select count(*)::int n from plays where owner_id = '${A}'`)).n === 0, 'el contenido propio de A se borró');
esperar((await uno(`select count(*)::int n from plays where owner_id = '${D}'`)).n === 2, 'las copias de D se conservan');

console.log(`\nResultado: ${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
