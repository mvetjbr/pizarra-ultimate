import { DIBUJO_MUNECO } from './munecosSvg';

// Muñecos del conteo de 10. Los ocho primeros están siempre disponibles; las mascotas se
// desbloquean una por cada 5 jugadas en la biblioteca. Es una función de juego (en este
// dispositivo), no una medida de seguridad.

export const MUNECOS_BASICOS = ['alien', 'tronco', 'nieve', 'mico', 'salero', 'cerdo', 'oso', 'vikingo'];
export const MASCOTAS = ['jaguar', 'toro', 'fresa', 'tornado', 'disco'];
export const JUGADAS_POR_MASCOTA = 5;

export const TODOS_LOS_MUNECOS = [...MUNECOS_BASICOS, ...MASCOTAS].filter((k) => DIBUJO_MUNECO[k]);

export function mascotasDesbloqueadas(jugadas: number, modoEditor: boolean): number {
  if (modoEditor) return MASCOTAS.length;
  return Math.min(MASCOTAS.length, Math.floor(Math.max(0, jugadas) / JUGADAS_POR_MASCOTA));
}

export function estaBloqueado(clave: string, jugadas: number, modoEditor: boolean): boolean {
  const i = MASCOTAS.indexOf(clave);
  return i >= 0 && i >= mascotasDesbloqueadas(jugadas, modoEditor);
}

/** Muñeco válido para mostrar: si el elegido está bloqueado o no existe, el alien. */
export function munecoVisible(clave: string, jugadas: number, modoEditor: boolean): string {
  return DIBUJO_MUNECO[clave] && !estaBloqueado(clave, jugadas, modoEditor) ? clave : 'alien';
}

export function textoDesbloqueo(jugadas: number, modoEditor: boolean): string {
  if (modoEditor) return 'Modo editor: todas las mascotas están desbloqueadas.';
  const u = mascotasDesbloqueadas(jugadas, modoEditor);
  if (u >= MASCOTAS.length) return 'Desbloqueaste todas las mascotas.';
  const faltan = JUGADAS_POR_MASCOTA * (u + 1) - jugadas;
  return `Guarda ${faltan} ${faltan === 1 ? 'jugada más' : 'jugadas más'} para desbloquear la siguiente mascota (${u} de ${MASCOTAS.length}).`;
}

/** Milisegundos por número: 0 → 2 s, 50 → 1 s, 100 → 0,5 s. */
export function msPorNumero(v: number): number {
  return v <= 50 ? 1000 + ((50 - v) / 50) * 1000 : 1000 - ((v - 50) / 50) * 500;
}
