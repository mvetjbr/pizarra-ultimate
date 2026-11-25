// Herramientas para los textos legales versionados de legal/<tipo>/v<versión>.md
//
//   node scripts/legal.mjs hashes      → muestra el SHA-256 de cada versión y escribe legal/hashes.json
//   node scripts/legal.mjs verificar   → falla si un documento vigente tiene marcadores [ASÍ] sin llenar
//   node scripts/legal.mjs sql <AAAAMMDDHHMMSS>
//                                      → genera supabase/migrations/<fecha>_documentos_legales.sql
//
// El hash se calcula sobre el texto en UTF-8 con saltos de línea LF (igual en Windows y Linux).
// Nunca se edita una versión ya publicada: cada cambio es un archivo nuevo (v1.0.1.md, v1.1.0.md…).
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const dirLegal = join(raiz, 'legal');
const TIPOS = ['terminos', 'privacidad', 'cookies', 'creditos'];
const MARCADOR = /\[(?:[A-ZÁÉÍÓÚÑ_]{4,})\]/g;

export const normalizar = (t) => t.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
export const sha256 = (t) => createHash('sha256').update(normalizar(t), 'utf8').digest('hex');

function documentos() {
  const vigentes = JSON.parse(readFileSync(join(dirLegal, 'vigentes.json'), 'utf8'));
  const lista = [];
  for (const tipo of TIPOS) {
    const dir = join(dirLegal, tipo);
    if (!existsSync(dir)) continue;
    for (const archivo of readdirSync(dir).filter((f) => /^v\d+\.\d+\.\d+\.md$/.test(f))) {
      const version = archivo.slice(1, -3);
      const texto = normalizar(readFileSync(join(dir, archivo), 'utf8'));
      lista.push({ tipo, version, texto, hash: sha256(texto), vigente: vigentes[tipo] === version });
    }
  }
  for (const tipo of TIPOS) {
    if (!lista.some((d) => d.tipo === tipo && d.vigente)) throw new Error(`No existe el archivo de la versión vigente de ${tipo}`);
  }
  return lista;
}

const accion = process.argv[2];

if (accion === 'hashes') {
  const lista = documentos();
  const salida = {};
  for (const d of lista) {
    salida[d.tipo] ??= {};
    salida[d.tipo][d.version] = d.hash;
    console.log(`${d.vigente ? '*' : ' '} ${d.tipo.padEnd(11)} ${d.version.padEnd(7)} ${d.hash}`);
  }
  writeFileSync(join(dirLegal, 'hashes.json'), JSON.stringify(salida, null, 2) + '\n');
  console.log('\n(*) vigente · legal/hashes.json actualizado');
} else if (accion === 'verificar') {
  const aviso = readFileSync(join(dirLegal, 'aviso-corto.md'), 'utf8');
  const pendientes = documentos()
    .filter((d) => d.vigente)
    .flatMap((d) => [...new Set(d.texto.match(MARCADOR) ?? [])].map((m) => `${d.tipo} v${d.version}: ${m}`))
    .concat([...new Set(aviso.match(MARCADOR) ?? [])].map((m) => `aviso-corto: ${m}`));
  if (pendientes.length) {
    console.error('Hay marcadores sin llenar en los textos legales vigentes. No se puede publicar:\n  ' + pendientes.join('\n  '));
    process.exit(1);
  }
  console.log('Textos legales vigentes sin marcadores pendientes.');
} else if (accion === 'sql') {
  const fecha = process.argv[3];
  if (!/^\d{14}$/.test(fecha ?? '')) throw new Error('Uso: node scripts/legal.mjs sql AAAAMMDDHHMMSS');
  const lit = (s) => "'" + s.replace(/'/g, "''") + "'";
  const lista = documentos();
  const filas = lista.map(
    (d) => `  (${lit(d.tipo)}, ${lit(d.version)}, ${lit(d.hash)}, ${lit(d.texto)})`,
  );
  const vigentes = lista.filter((d) => d.vigente);
  const sql = `-- Generado por scripts/legal.mjs: textos legales versionados.
-- Las versiones existentes no se modifican (ON CONFLICT DO NOTHING); solo se agregan nuevas.
insert into public.legal_documents (tipo, version, hash, texto) values
${filas.join(',\n')}
on conflict (tipo, version) do nothing;

-- Marca como vigente la versión indicada en legal/vigentes.json.
${vigentes
  .map(
    (d) => `select public.publicar_documento(${lit(d.tipo)}::public.tipo_documento, ${lit(d.version)});`,
  )
  .join('\n')}
`;
  const ruta = join(raiz, 'supabase', 'migrations', `${fecha}_documentos_legales.sql`);
  writeFileSync(ruta, sql);
  console.log('Escrito', ruta);
} else {
  console.log('Uso: node scripts/legal.mjs hashes | verificar | sql AAAAMMDDHHMMSS');
}
