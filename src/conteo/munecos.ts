import { DIBUJO_MUNECO } from './munecosSvg';

// Muñecos del conteo de 10 y sistema de premios (docs/adr/0013-munecos-y-premios.md).
// Los básicos están siempre libres. Las mascotas se ganan: cada 5 jugadas en la biblioteca dan
// un premio y la persona elige qué mascota desbloquear. Es un juego local, no una medida de seguridad.

export const MUNECOS_BASICOS = ['alien', 'tronco', 'nieve', 'mico', 'salero', 'cerdo', 'oso', 'vikingo'];
/** Orden de la grilla (no del desbloqueo: ese lo elige la persona). */
export const MASCOTAS = [
  'jaguar',
  'toro',
  'fresa',
  'tornado',
  'disco',
  'porro',
  'planta',
  'duende',
  'chancla',
  'titere',
  'jesus',
  'buda',
];
export const JUGADAS_POR_MASCOTA = 5;
/** Orden fijo en que se desbloqueaban las mascotas antes del ADR 0013. */
const ORDEN_VIEJO = ['jaguar', 'toro', 'fresa', 'tornado', 'disco'];

export const TODOS_LOS_MUNECOS = [...MUNECOS_BASICOS, ...MASCOTAS].filter((k) => DIBUJO_MUNECO[k]);

/** Elegidas que siguen existiendo, sin repetidas. */
function elegidasValidas(elegidas: readonly string[]): string[] {
  return MASCOTAS.filter((k) => elegidas.includes(k));
}

export function premiosGanados(jugadas: number): number {
  return Math.floor(Math.max(0, jugadas) / JUGADAS_POR_MASCOTA);
}

/** Premios ganados que todavía no se han usado (nunca más que las mascotas bloqueadas). */
export function premiosPendientes(jugadas: number, elegidas: readonly string[], modoEditor: boolean): number {
  if (modoEditor) return 0;
  const usadas = elegidasValidas(elegidas).length;
  return Math.max(0, Math.min(MASCOTAS.length - usadas, premiosGanados(jugadas) - usadas));
}

export function estaBloqueado(clave: string, elegidas: readonly string[], modoEditor: boolean): boolean {
  return !modoEditor && MASCOTAS.includes(clave) && !elegidas.includes(clave);
}

export function mascotasBloqueadas(elegidas: readonly string[], modoEditor: boolean): string[] {
  return MASCOTAS.filter((k) => DIBUJO_MUNECO[k] && estaBloqueado(k, elegidas, modoEditor));
}

/** Muñeco válido para mostrar: si el elegido está bloqueado o no existe, el alien. */
export function munecoVisible(clave: string, elegidas: readonly string[], modoEditor: boolean): string {
  return DIBUJO_MUNECO[clave] && !estaBloqueado(clave, elegidas, modoEditor) ? clave : 'alien';
}

/** Para quien venía del sistema viejo: las mascotas que ya tenía desbloqueadas. */
export function mascotasDelSistemaViejo(jugadas: number): string[] {
  return ORDEN_VIEJO.slice(0, premiosGanados(jugadas));
}

export function textoDesbloqueo(jugadas: number, elegidas: readonly string[], modoEditor: boolean): string {
  if (modoEditor) return 'Modo editor: todas las mascotas están desbloqueadas.';
  const usadas = elegidasValidas(elegidas).length;
  if (usadas >= MASCOTAS.length) return 'Desbloqueaste todas las mascotas.';
  const p = premiosPendientes(jugadas, elegidas, modoEditor);
  if (p > 0)
    return `Tienes ${p} ${p === 1 ? 'premio' : 'premios'}: toca una mascota con candado para desbloquearla.`;
  const faltan = JUGADAS_POR_MASCOTA * (usadas + 1) - jugadas;
  return `Guarda ${faltan} ${faltan === 1 ? 'jugada más' : 'jugadas más'} para ganar otra mascota (${usadas} de ${MASCOTAS.length}).`;
}

/** Milisegundos por número: 0 → 2 s, 50 → 1 s, 100 → 0,5 s. */
export function msPorNumero(v: number): number {
  return v <= 50 ? 1000 + ((50 - v) / 50) * 1000 : 1000 - ((v - 50) / 50) * 500;
}
