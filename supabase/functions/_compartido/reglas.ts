// Reglas compartidas entre la app (Vite) y las funciones del servidor (Deno).
// Sin dependencias: este archivo lo importan los dos lados para validar exactamente igual.

/** Texto literal de cada casilla (paquete legal, sección 3). Se guarda tal cual en consent_records. */
export const TEXTO_CASILLA = {
  terminos: 'He leído y acepto los Términos y Condiciones.',
  privacidad:
    'Autorizo de manera previa, expresa e informada el tratamiento de mis datos personales conforme a la Política de Tratamiento de Datos Personales.',
} as const;

export type TipoAceptable = keyof typeof TEXTO_CASILLA;
export const TIPOS_ACEPTABLES: TipoAceptable[] = ['terminos', 'privacidad'];

export interface Aceptacion {
  tipo: TipoAceptable;
  version: string;
  hash: string;
  texto_casilla: string;
}

export const ROLES = ['handler', 'cutter', 'ambos'] as const;
export const CATEGORIAS_MATCH = ['MMP', 'FMP', 'no_dice'] as const;

export interface DatosRegistro {
  nombre: string;
  apellido: string;
  correo: string;
  contrasena: string;
  fecha_nacimiento: string; // AAAA-MM-DD
  apodo?: string;
  numero?: number;
  rol?: (typeof ROLES)[number];
  match_categoria?: (typeof CATEGORIAS_MATCH)[number];
}

/** Fecha de hoy en Colombia (AAAA-MM-DD). */
export function hoyEnColombia(ahora = new Date()): string {
  return ahora.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

/** Edad cumplida en años a la fecha de hoy en Colombia. */
export function edad(fechaNacimiento: string, hoy = hoyEnColombia()): number {
  const [an, mn, dn] = fechaNacimiento.split('-').map(Number);
  const [ah, mh, dh] = hoy.split('-').map(Number);
  let e = ah - an;
  if (mh < mn || (mh === mn && dh < dn)) e--;
  return e;
}

export type ResultadoEdad = 'adulto' | 'menor_14_17' | 'menor_de_14' | 'invalida';

export function clasificarEdad(fechaNacimiento: string, hoy = hoyEnColombia()): ResultadoEdad {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaNacimiento)) return 'invalida';
  const fecha = new Date(`${fechaNacimiento}T12:00:00Z`);
  if (Number.isNaN(fecha.getTime()) || fechaNacimiento > hoy || fechaNacimiento < '1900-01-01') return 'invalida';
  const e = edad(fechaNacimiento, hoy);
  if (e < 14) return 'menor_de_14';
  if (e < 18) return 'menor_14_17';
  return 'adulto';
}

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Valida y limpia los datos del registro. Devuelve los errores por campo (vacío = válido). */
export function validarRegistro(d: Partial<DatosRegistro>): { datos: DatosRegistro; errores: Record<string, string> } {
  const errores: Record<string, string> = {};
  const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const nombre = txt(d.nombre);
  const apellido = txt(d.apellido);
  const correo = txt(d.correo).toLowerCase();
  const contrasena = typeof d.contrasena === 'string' ? d.contrasena : '';
  const fecha = txt(d.fecha_nacimiento);
  const apodo = txt(d.apodo);

  if (nombre.length < 2 || nombre.length > 50) errores.nombre = 'Escribe tu nombre (2 a 50 caracteres).';
  if (apellido.length < 2 || apellido.length > 50) errores.apellido = 'Escribe tu apellido (2 a 50 caracteres).';
  if (!CORREO.test(correo) || correo.length > 254) errores.correo = 'Escribe un correo válido.';
  if (contrasena.length < 8) errores.contrasena = 'La contraseña debe tener al menos 8 caracteres.';
  if (contrasena.length > 72) errores.contrasena = 'La contraseña puede tener máximo 72 caracteres.';
  if (clasificarEdad(fecha) === 'invalida') errores.fecha_nacimiento = 'Escribe una fecha de nacimiento válida.';
  if (apodo.length > 30) errores.apodo = 'El apodo puede tener máximo 30 caracteres.';

  let numero: number | undefined;
  if (d.numero !== undefined && d.numero !== null && String(d.numero) !== '') {
    numero = Number(d.numero);
    if (!Number.isInteger(numero) || numero < 0 || numero > 99) errores.numero = 'El número debe estar entre 0 y 99.';
  }
  const rol = d.rol && (ROLES as readonly string[]).includes(d.rol) ? d.rol : undefined;
  const match_categoria =
    d.match_categoria && (CATEGORIAS_MATCH as readonly string[]).includes(d.match_categoria) ? d.match_categoria : undefined;

  return {
    datos: {
      nombre,
      apellido,
      correo,
      contrasena,
      fecha_nacimiento: fecha,
      apodo: apodo || undefined,
      numero,
      rol,
      match_categoria,
    },
    errores,
  };
}

/**
 * Comprueba que lleguen las dos aceptaciones, con el texto literal de la casilla y la versión vigente.
 * `vigentes` viene de la base de datos (legal_documents con vigente = true).
 */
export function validarAceptaciones(
  aceptaciones: unknown,
  vigentes: { tipo: string; version: string; hash: string }[],
): { ok: true; lista: Aceptacion[] } | { ok: false; motivo: string } {
  if (!Array.isArray(aceptaciones)) return { ok: false, motivo: 'Faltan las aceptaciones.' };
  const lista: Aceptacion[] = [];
  for (const tipo of TIPOS_ACEPTABLES) {
    const a = aceptaciones.find((x) => x && typeof x === 'object' && (x as Aceptacion).tipo === tipo) as Aceptacion | undefined;
    const v = vigentes.find((x) => x.tipo === tipo);
    if (!a) return { ok: false, motivo: `Debes aceptar: ${tipo === 'terminos' ? 'Términos y Condiciones' : 'Política de Tratamiento de Datos'}.` };
    if (!v) return { ok: false, motivo: 'No hay una versión vigente de los documentos legales.' };
    if (a.version !== v.version || a.hash !== v.hash) {
      return { ok: false, motivo: 'Los documentos legales cambiaron mientras los leías. Recarga la página y vuelve a aceptarlos.' };
    }
    if (a.texto_casilla !== TEXTO_CASILLA[tipo]) return { ok: false, motivo: 'El texto de la casilla no corresponde.' };
    lista.push({ tipo, version: a.version, hash: a.hash, texto_casilla: a.texto_casilla });
  }
  return { ok: true, lista };
}

export const CONFIRMACION_ELIMINAR = 'ELIMINAR MI CUENTA';
