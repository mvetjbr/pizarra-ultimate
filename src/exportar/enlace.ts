import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import type { Play } from '../modelo/tipos';
import { normalizarJugada } from '../modelo/validar';

const PREFIJO = '#/ver/';

/** Redondea a 10 cm y quita datos que no hacen falta para ver la jugada. */
function compactar(j: Play): string {
  const { creada: _c, editada: _e, ...resto } = j;
  void _c;
  void _e;
  return JSON.stringify(resto, (clave, valor) => {
    if (clave === 'rosterId') return undefined;
    if (typeof valor === 'number') return Math.round(valor * 10) / 10;
    if (valor === false) return undefined;
    return valor;
  });
}

/** Enlace que abre la jugada en modo presentación, sin servidor: todo va en la URL. */
export function crearEnlace(j: Play): string {
  const base = `${location.origin}${location.pathname}`;
  return `${base}${PREFIJO}${compressToEncodedURIComponent(compactar(j))}`;
}

export function hayEnlace(hash = location.hash): boolean {
  return hash.startsWith(PREFIJO);
}

export function leerEnlace(hash = location.hash): Play | null {
  if (!hayEnlace(hash)) return null;
  try {
    const texto = decompressFromEncodedURIComponent(hash.slice(PREFIJO.length));
    if (!texto) return null;
    return normalizarJugada(JSON.parse(texto));
  } catch {
    return null;
  }
}

export function limpiarEnlace() {
  history.replaceState(null, '', `${location.pathname}${location.search}`);
}
