import vigentes from '../../legal/vigentes.json';
import avisoCorto from '../../legal/aviso-corto.md?raw';

// Textos legales versionados (legal/<tipo>/v<versión>.md). Van dentro de la app para poder
// leerlos sin conexión y sin cuenta; el servidor guarda los mismos textos con su SHA-256.
const archivos = import.meta.glob('../../legal/*/v*.md', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>;

export type TipoDocumento = 'terminos' | 'privacidad' | 'cookies' | 'creditos';
export const TIPOS_DOCUMENTO: TipoDocumento[] = ['terminos', 'privacidad', 'cookies', 'creditos'];

export const NOMBRE_DOCUMENTO: Record<TipoDocumento, string> = {
  terminos: 'Términos y Condiciones',
  privacidad: 'Política de Tratamiento de Datos',
  cookies: 'Política de Cookies',
  creditos: 'Créditos y licencias',
};

export const AVISO_PRIVACIDAD_CORTO = avisoCorto.trim();

export interface DocumentoLegal {
  tipo: TipoDocumento;
  version: string;
  texto: string;
  vigente: boolean;
}

const normalizar = (t: string) => t.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
const comparaVersion = (a: string, b: string) => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pb[i] - pa[i];
  return 0;
};

const TODOS: DocumentoLegal[] = Object.entries(archivos)
  .map(([ruta, texto]) => {
    const m = ruta.match(/legal\/([a-z]+)\/v(\d+\.\d+\.\d+)\.md$/);
    if (!m) return null;
    const tipo = m[1] as TipoDocumento;
    return { tipo, version: m[2], texto: normalizar(texto), vigente: (vigentes as Record<string, string>)[tipo] === m[2] };
  })
  .filter((d): d is DocumentoLegal => d !== null && TIPOS_DOCUMENTO.includes(d.tipo));

/** Versiones de un documento, de la más nueva a la más vieja. */
export const versiones = (tipo: TipoDocumento) =>
  TODOS.filter((d) => d.tipo === tipo)
    .map((d) => d.version)
    .sort(comparaVersion);

export function documento(tipo: TipoDocumento, version?: string): DocumentoLegal | undefined {
  const v = version ?? (vigentes as Record<string, string>)[tipo];
  return TODOS.find((d) => d.tipo === tipo && d.version === v);
}

/** Fecha de vigencia tal como aparece en el encabezado del documento. */
export function vigenciaDe(texto: string): string {
  return texto.match(/Vigentes? desde ([^*\n]+)/)?.[1]?.trim() ?? '';
}

/** SHA-256 del texto (mismo cálculo que scripts/legal.mjs y la base de datos). */
export async function hashDe(texto: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalizar(texto)));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}
