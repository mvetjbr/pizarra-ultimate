import type { Play } from '../modelo/tipos';
import { normalizarJugada } from '../modelo/validar';

const FORMATO = 'pizarra-ultimate';
const VERSION = 1;
const TAMANO_MAXIMO = 20 * 1024 * 1024;

/** Archivo de respaldo con una o varias jugadas. */
export function jsonDeJugadas(jugadas: Play[]): Blob {
  const datos = { formato: FORMATO, version: VERSION, exportado: new Date().toISOString(), jugadas };
  return new Blob([JSON.stringify(datos, null, 1)], { type: 'application/json' });
}

/** Lee un archivo exportado (o una jugada suelta) y devuelve solo las jugadas válidas. */
export async function leerArchivoJugadas(archivo: File): Promise<Play[]> {
  if (archivo.size > TAMANO_MAXIMO) throw new Error('El archivo es demasiado grande.');
  let datos: unknown;
  try {
    datos = JSON.parse(await archivo.text());
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }
  const crudas: unknown[] = Array.isArray(datos)
    ? datos
    : datos && typeof datos === 'object' && Array.isArray((datos as { jugadas?: unknown }).jugadas)
      ? (datos as { jugadas: unknown[] }).jugadas
      : [datos];
  const jugadas = crudas.slice(0, 1000).map(normalizarJugada).filter((j): j is Play => j !== null);
  if (jugadas.length === 0) throw new Error('El archivo no contiene jugadas de Pizarra Ultimate.');
  return jugadas;
}
