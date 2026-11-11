import type { Match, Play, Player, Step } from './tipos';
import { CANCHA } from './cancha';
import { extremos, jugadorCercano, OFFSET_DISCO } from './geometria';

/** Id corto. No usa crypto.randomUUID porque no existe en http:// (pruebas por red local). */
export function nuevoId(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

const MATCH_INICIAL: Match[] = ['M', 'F', 'M', 'F', 'M', 'F', 'M'];

/** Paso inicial: vertical stack atacando hacia la derecha, cada defensa marcando. */
export function crearPasoInicial(): Step {
  const y = CANCHA.ancho / 2;
  const posAtaque = [
    { x: 30, y },
    { x: 40, y },
    { x: 45, y },
    { x: 50, y },
    { x: 55, y },
    { x: 60, y },
    { x: 65, y },
  ];
  const jugadores: Player[] = [];
  posAtaque.forEach((p, i) => {
    jugadores.push({ id: nuevoId(), equipo: 'ataque', etiqueta: String(i + 1), match: MATCH_INICIAL[i], ...p });
  });
  posAtaque.forEach((p, i) => {
    jugadores.push({
      id: nuevoId(),
      equipo: 'defensa',
      etiqueta: String(i + 1),
      match: MATCH_INICIAL[i],
      // La marca del handler va a un lado; las del stack, del lado contrario y hacia la zona.
      x: p.x + (i === 0 ? 1.5 : 1.8),
      y: p.y + (i === 0 ? -2.2 : 2.2),
    });
  });
  const handler = jugadores[0];
  return {
    id: nuevoId(),
    jugadores,
    disco: { x: handler.x + OFFSET_DISCO.x, y: handler.y + OFFSET_DISCO.y, poseedorId: handler.id },
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

export function crearJugada(nombre = 'Jugada nueva'): Play {
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
    pasos: [crearPasoInicial()],
  };
}
