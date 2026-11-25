import type { Equipo, Match, Play, Player, Punto, Step } from './tipos';
import { CANCHA } from './cancha';
import { extremos, jugadorCercano, OFFSET_DISCO } from './geometria';

/** Id corto. No usa crypto.randomUUID porque no existe en http:// (pruebas por red local). */
export function nuevoId(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

/** Proporción de match en mixto: 4M-3F, 3M-4F o sin género (N). */
export type Proporcion = 'M' | 'F' | 'N';

/** Match de los jugadores 1 a 7, en orden, según la proporción. */
export const PATRON_MATCH: Record<Proporcion, (Match | undefined)[]> = {
  M: ['M', 'F', 'M', 'F', 'M', 'F', 'M'],
  F: ['F', 'M', 'F', 'M', 'F', 'M', 'F'],
  N: [undefined, undefined, undefined, undefined, undefined, undefined, undefined],
};

export interface OpcionesJugada {
  ataque: number;
  defensa: number;
  proporcion: Proporcion;
}

const OPCIONES_INICIALES: OpcionesJugada = { ataque: 7, defensa: 7, proporcion: 'M' };
const Y = CANCHA.ancho / 2;
/** Vertical stack: handler (1) y el stack (2 a 7) atacando hacia la derecha. */
const POS_ATAQUE: Punto[] = [30, 40, 45, 50, 55, 60, 65].map((x) => ({ x, y: Y }));

/**
 * Posición inicial del jugador número `numero` (1 a 7) de cada equipo.
 * La marca del handler va a un lado; las del stack, del lado contrario y hacia la zona.
 */
export function posicionBase(equipo: Equipo, numero: number): Punto {
  const p = POS_ATAQUE[Math.min(Math.max(numero, 1), 7) - 1];
  if (equipo === 'ataque') return { ...p };
  // Separadas lo suficiente para que el triángulo no tape la ficha del atacante.
  return numero === 1 ? { x: p.x + 1.5, y: p.y - 3.4 } : { x: p.x + 1.8, y: p.y + 3.4 };
}

export function crearJugador(equipo: Equipo, numero: number, proporcion: Proporcion): Player {
  return {
    id: nuevoId(),
    equipo,
    etiqueta: String(numero),
    match: PATRON_MATCH[proporcion][Math.min(numero, 7) - 1],
    ...posicionBase(equipo, numero),
  };
}

/** Paso inicial: vertical stack con la cantidad de jugadores y la proporción indicadas. */
export function crearPasoInicial(opciones: OpcionesJugada = OPCIONES_INICIALES): Step {
  const jugadores: Player[] = [];
  for (let i = 1; i <= opciones.ataque; i++) jugadores.push(crearJugador('ataque', i, opciones.proporcion));
  for (let i = 1; i <= opciones.defensa; i++) jugadores.push(crearJugador('defensa', i, opciones.proporcion));
  const handler = jugadores.find((j) => j.equipo === 'ataque');
  return {
    id: nuevoId(),
    jugadores,
    disco: handler
      ? { x: handler.x + OFFSET_DISCO.x, y: handler.y + OFFSET_DISCO.y, poseedorId: handler.id }
      : { x: CANCHA.largo / 2, y: Y },
    flechas: [],
    zonas: [],
    textos: [],
  };
}

/** Copia exacta de un paso con id nuevo. Los jugadores conservan su id para poder animarlos. */
export function duplicarPaso(paso: Step): Step {
  return { ...structuredClone(paso), id: nuevoId() };
}

/**
 * Paso siguiente "ejecutando" el actual: cada jugador termina donde apunta su corte
 * o movimiento defensivo, y el disco llega al receptor del pase. Las flechas se limpian.
 */
export function crearPasoSiguiente(paso: Step): Step {
  const n = duplicarPaso(paso);
  for (const f of paso.flechas) {
    if (f.tipo === 'pase' || !f.desdeId) continue;
    const { b } = extremos(paso, f);
    const j = n.jugadores.find((x) => x.id === f.desdeId);
    if (j) {
      j.x = b.x;
      j.y = b.y;
    }
  }
  const pase = paso.flechas.find((f) => f.tipo === 'pase');
  if (pase) {
    const { b } = extremos(paso, pase);
    // El receptor es el jugador anclado o el que quedó más cerca del final del pase.
    const receptor =
      n.jugadores.find((x) => x.id === pase.hastaId) ?? jugadorCercano(n, b, 3, pase.desdeId);
    n.disco = receptor
      ? { x: receptor.x + OFFSET_DISCO.x, y: receptor.y + OFFSET_DISCO.y, poseedorId: receptor.id }
      : { x: b.x, y: b.y };
  } else if (n.disco.poseedorId) {
    const j = n.jugadores.find((x) => x.id === n.disco.poseedorId);
    if (j) n.disco = { x: j.x + OFFSET_DISCO.x, y: j.y + OFFSET_DISCO.y, poseedorId: j.id };
  }
  n.flechas = [];
  return n;
}

export function crearJugada(nombre = 'Jugada nueva', opciones: OpcionesJugada = OPCIONES_INICIALES): Play {
  const ahora = Date.now();
  return {
    id: nuevoId(),
    nombre,
    categoria: 'Ataque',
    etiquetas: [],
    notas: '',
    creada: ahora,
    editada: ahora,
    vista: 'completa',
    lado: 'derecha',
    orientacion: 'horizontal',
    pasos: [crearPasoInicial(opciones)],
  };
}
