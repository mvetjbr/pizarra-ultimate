import type { Player, Punto, Step } from '../modelo/tipos';
import { controlDe, extremos, OFFSET_DISCO, posDisco, puntoEnCurva } from '../modelo/geometria';

export interface Cuadro {
  paso: Step;
  /** Las flechas del paso de origen se desvanecen mientras se ejecutan. */
  opacidadFlechas: number;
}

const suavizar = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const limitar01 = (t: number) => Math.max(0, Math.min(1, t));

/** Fracción del tiempo en que el disco espera a que arranquen los cortes antes de salir. */
const SALIDA_DISCO = 0.3;

/**
 * Estado intermedio de la jugada en una posición continua de la línea de tiempo:
 * 0 = paso 1, 1.5 = mitad del camino entre el paso 2 y el 3, etc.
 */
export function interpolar(pasos: Step[], posicion: number): Cuadro {
  const n = pasos.length;
  const pos = Math.max(0, Math.min(n - 1, posicion));
  const i = Math.min(Math.floor(pos), Math.max(0, n - 2));
  const t = pos - i;
  if (n < 2 || t <= 0) return { paso: pasos[i], opacidadFlechas: 1 };
  if (t >= 1) return { paso: pasos[i + 1], opacidadFlechas: 1 };

  const A = pasos[i];
  const B = pasos[i + 1];
  const e = suavizar(t);

  // Jugadores: se emparejan por id entre los dos pasos.
  const enB = new Map(B.jugadores.map((j) => [j.id, j]));
  const enA = new Set(A.jugadores.map((j) => j.id));
  const jugadores: Player[] = [];
  for (const ja of A.jugadores) {
    const jb = enB.get(ja.id);
    if (jb) jugadores.push({ ...jb, x: lerp(ja.x, jb.x, e), y: lerp(ja.y, jb.y, e) });
    else if (t < 0.5) jugadores.push(ja);
  }
  if (t >= 0.5) for (const jb of B.jugadores) if (!enA.has(jb.id)) jugadores.push(jb);

  // Disco
  const da = posDisco(A);
  const db = posDisco(B);
  let disco: Punto;
  const mismoPoseedor = !!B.disco.poseedorId && B.disco.poseedorId === A.disco.poseedorId;
  const portador = mismoPoseedor ? jugadores.find((j) => j.id === B.disco.poseedorId) : undefined;
  const pase =
    A.flechas.find((f) => f.tipo === 'pase' && f.desdeId && f.desdeId === A.disco.poseedorId) ??
    A.flechas.find((f) => f.tipo === 'pase');
  if (portador) {
    disco = { x: portador.x + OFFSET_DISCO.x, y: portador.y + OFFSET_DISCO.y };
  } else if (pase) {
    // Viaja por la trayectoria del pase (recta o curva) después de que arrancan los cortes.
    const { a, b } = extremos(A, pase);
    const c = controlDe(pase, a, b);
    const td = limitar01((t - SALIDA_DISCO) / (1 - SALIDA_DISCO));
    disco = puntoEnCurva(da, c, db, td);
  } else {
    disco = { x: lerp(da.x, db.x, e), y: lerp(da.y, db.y, e) };
  }

  // Flechas del paso de origen: el inicio sigue al jugador que corre (la flecha se "consume")
  // y el final queda fijo donde estaba.
  const flechas = A.flechas.map((f) => {
    const { b } = extremos(A, f);
    return { ...f, hasta: b, hastaId: undefined, control: f.curva ? controlDe(f, extremos(A, f).a, b) ?? undefined : undefined };
  });

  const segundaMitad = t >= 0.5;
  return {
    paso: {
      id: A.id,
      jugadores,
      disco: { x: disco.x, y: disco.y },
      flechas,
      zonas: segundaMitad ? B.zonas : A.zonas,
      textos: segundaMitad ? B.textos : A.textos,
    },
    opacidadFlechas: 1 - e,
  };
}
