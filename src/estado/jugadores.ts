import type { Equipo, Match, Player, Step } from '../modelo/tipos';
import { crearJugador, PATRON_MATCH, type Proporcion } from '../modelo/fabrica';
import { buscarJugador, posDisco } from '../modelo/geometria';
import { pasoActivo, useEditor } from './editorStore';
import { usePreferencias } from './preferencias';

// Cantidad de jugadores y proporción de match de la jugada abierta (en todos sus pasos).
// Nunca se modifican los pasos existentes: se crean copias, así "deshacer" sigue funcionando.

const numeroDe = (j: Player) => {
  const n = parseInt(j.etiqueta, 10);
  return Number.isFinite(n) ? n : 999;
};

/** Jugadores ordenados por número de ficha (los que tienen iniciales van al final). */
export function ordenarPorNumero(lista: Player[]): Player[] {
  return lista
    .map((j, i) => ({ j, i }))
    .sort((a, b) => numeroDe(a.j) - numeroDe(b.j) || a.i - b.i)
    .map((x) => x.j);
}

/** Copia del paso sin esos jugadores: se van sus flechas y, si tenían el disco, queda libre. */
function sinJugadores(p: Step, ids: Set<string>): Step {
  if (!p.jugadores.some((j) => ids.has(j.id))) return p;
  const disco = p.disco.poseedorId && ids.has(p.disco.poseedorId) ? { ...posDisco(p) } : p.disco;
  const flechas = p.flechas
    .filter((f) => !(f.desdeId && ids.has(f.desdeId)))
    .map((f) => {
      if (!f.hastaId || !ids.has(f.hastaId)) return f;
      const j = buscarJugador(p, f.hastaId);
      return { ...f, hastaId: undefined, hasta: j ? { x: j.x, y: j.y } : f.hasta };
    });
  return { ...p, jugadores: p.jugadores.filter((j) => !ids.has(j.id)), disco, flechas };
}

/**
 * Deja `n` jugadores (0 a 7) de un equipo en toda la jugada. Al bajar se quitan los de
 * número más alto; al subir se agregan con el siguiente número libre en la formación base.
 * También queda como cantidad para las jugadas nuevas.
 */
export function fijarCantidad(equipo: Equipo, n: number) {
  const objetivo = Math.max(0, Math.min(7, Math.round(n)));
  const st = useEditor.getState();
  const actuales = ordenarPorNumero(pasoActivo(st).jugadores.filter((j) => j.equipo === equipo));
  const prefs = usePreferencias.getState();
  prefs.actualizar(equipo === 'ataque' ? { cantidadAtaque: objetivo } : { cantidadDefensa: objetivo });
  if (actuales.length === objetivo) return;

  st.cambiar((jugada) => {
    if (actuales.length > objetivo) {
      const ids = new Set(actuales.slice(objetivo).map((j) => j.id));
      jugada.pasos = jugada.pasos.map((p) => sinJugadores(p, ids));
      return;
    }
    const usados = new Set(actuales.map(numeroDe));
    const nuevos: Player[] = [];
    for (let k = 1; nuevos.length < objetivo - actuales.length && k <= 99; k++) {
      if (!usados.has(k)) nuevos.push(crearJugador(equipo, k, prefs.proporcion));
    }
    // El mismo id en todos los pasos para que la animación los reconozca.
    jugada.pasos = jugada.pasos.map((p) => ({ ...p, jugadores: [...p.jugadores, ...nuevos.map((x) => ({ ...x }))] }));
  });
  useEditor.setState({ seleccion: null });
}

/**
 * Asigna el match en orden de número a ataque y defensa (4M-3F, 3M-4F o sin género).
 * Quien tiene un jugador del roster asignado conserva su match real.
 */
export function aplicarProporcion(proporcion: Proporcion) {
  const st = useEditor.getState();
  const paso = pasoActivo(st);
  const asignar = new Map<string, Match | undefined>();
  for (const equipo of ['ataque', 'defensa'] as const) {
    ordenarPorNumero(paso.jugadores.filter((j) => j.equipo === equipo)).forEach((j, i) => {
      if (!j.rosterId) asignar.set(j.id, PATRON_MATCH[proporcion][Math.min(i, 6)]);
    });
  }
  usePreferencias.getState().actualizar({ proporcion });
  if (asignar.size === 0) return;
  st.cambiar((jugada) => {
    jugada.pasos = jugada.pasos.map((p) =>
      p.jugadores.some((j) => asignar.has(j.id))
        ? { ...p, jugadores: p.jugadores.map((j) => (asignar.has(j.id) ? { ...j, match: asignar.get(j.id) } : j)) }
        : p,
    );
  });
}

/** Qué proporción tiene el ataque del paso, si coincide exactamente con una de las tres. */
export function proporcionDe(paso: Step): Proporcion | null {
  const ataque = ordenarPorNumero(paso.jugadores.filter((j) => j.equipo === 'ataque'));
  if (ataque.length === 0) return null;
  for (const k of ['M', 'F', 'N'] as Proporcion[]) {
    if (ataque.every((j, i) => (j.match ?? undefined) === PATRON_MATCH[k][Math.min(i, 6)])) return k;
  }
  return null;
}

/**
 * ¿La proporción del ataque es válida en mixto? Con 7 conocidos debe ser 4-3 (en cualquier
 * sentido); con menos jugadores o sin género, que ningún match pase de 4.
 */
export function proporcionValida(m: number, f: number, sinGenero: number): boolean {
  if (m > 4 || f > 4) return false;
  if (sinGenero === 0 && m + f === 7) return Math.abs(m - f) === 1;
  return true;
}
