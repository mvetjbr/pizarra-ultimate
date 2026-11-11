import type { Arrow, Player, Punto, Step } from './tipos';

export const RADIO_JUGADOR = 1.1;
export const RADIO_DEFENSA = 1.45; // circunradio del triángulo
export const OFFSET_DISCO: Punto = { x: 0.95, y: -0.95 };

export const distancia = (a: Punto, b: Punto) => Math.hypot(a.x - b.x, a.y - b.y);

export function buscarJugador(paso: Step, id?: string): Player | undefined {
  return id ? paso.jugadores.find((j) => j.id === id) : undefined;
}

export function posDisco(paso: Step): Punto {
  const p = buscarJugador(paso, paso.disco.poseedorId);
  return p ? { x: p.x + OFFSET_DISCO.x, y: p.y + OFFSET_DISCO.y } : { x: paso.disco.x, y: paso.disco.y };
}

/** Extremos reales de una flecha (siguen al jugador si están anclados). */
export function extremos(paso: Step, f: Arrow) {
  const ja = buscarJugador(paso, f.desdeId);
  const jb = buscarJugador(paso, f.hastaId);
  return {
    a: ja ? { x: ja.x, y: ja.y } : f.desde,
    b: jb ? { x: jb.x, y: jb.y } : f.hasta,
    ancladoA: !!ja,
    ancladoB: !!jb,
  };
}

export function controlPorDefecto(a: Punto, b: Punto): Punto {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  return { x: mx - (b.y - a.y) * 0.3, y: my + (b.x - a.x) * 0.3 };
}

export function controlDe(f: Arrow, a: Punto, b: Punto): Punto | null {
  if (f.tipo !== 'pase' || !f.curva) return null;
  return f.control ?? controlPorDefecto(a, b);
}

/** Punto en una curva cuadrática de Bézier (o recta si no hay control). */
export function puntoEnCurva(a: Punto, c: Punto | null, b: Punto, t: number): Punto {
  if (!c) return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
  };
}

/** Avanza `d` metros desde `desde` en dirección a `hacia`. */
export function avanzar(desde: Punto, hacia: Punto, d: number): Punto {
  const L = distancia(desde, hacia) || 1;
  return { x: desde.x + ((hacia.x - desde.x) / L) * d, y: desde.y + ((hacia.y - desde.y) / L) * d };
}

export function jugadorCercano(paso: Step, p: Punto, max: number, excluir?: string): Player | undefined {
  let mejor: Player | undefined;
  let dMin = max;
  for (const j of paso.jugadores) {
    if (j.id === excluir) continue;
    const d = distancia(j, p);
    if (d <= dMin) {
      dMin = d;
      mejor = j;
    }
  }
  return mejor;
}
