import type { Lado, Play, Step, Vista } from './tipos';
import { CANCHA, regionCancha } from './cancha';

/** Margen (m) que se deja entre los jugadores y el borde de lo que se ve. */
const HOLGURA = 2.5;

/** Transformación a lo largo de la cancha: x' = desde + (x - origen) * escala. */
export interface Ajuste {
  origen: number;
  desde: number;
  escala: number;
}

/** Cómo correr (y, si no cabe, apretar) la jugada para que todos sus jugadores y el disco se vean. */
export function ajusteParaVer(j: Play, vista: Vista, lado: Lado): Ajuste | null {
  if (vista === 'completa') return null;
  const r = regionCancha(vista, lado);
  // regionCancha incluye un margen de 2 m a cada lado; se encuadra dentro de la cancha visible.
  const izq = Math.max(0, r.x + 2) + HOLGURA;
  const der = Math.min(CANCHA.largo, r.x + r.w - 2) - HOLGURA;
  const xs = j.pasos.flatMap((p) => [...p.jugadores.map((x) => x.x), p.disco.x]);
  if (!xs.length) return null;
  const min = Math.min(...xs);
  const max = Math.max(...xs);
  if (min >= izq && max <= der) return null;
  if (max - min > der - izq) return { origen: min, desde: izq, escala: (der - izq) / (max - min) };
  return { origen: min, desde: min < izq ? izq : der - (max - min), escala: 1 };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

function ajustarPaso(p: Step, a: Ajuste): Step {
  const fx = (x: number) => r1(a.desde + (x - a.origen) * a.escala);
  const c = structuredClone(p);
  for (const x of c.jugadores) x.x = fx(x.x);
  c.disco.x = fx(c.disco.x);
  for (const f of c.flechas) {
    f.desde.x = fx(f.desde.x);
    f.hasta.x = fx(f.hasta.x);
    if (f.control) f.control.x = fx(f.control.x);
  }
  for (const z of c.zonas) {
    z.x = fx(z.x);
    z.ancho = Math.max(0.5, r1(z.ancho * a.escala));
  }
  for (const t of c.textos) t.x = fx(t.x);
  return c;
}

/**
 * Cambia la vista (y el lado) y, si hace falta, corre la jugada (y la aprieta si no cabe)
 * para que nadie quede fuera. Pensada para `cambiar` del editor: crea pasos nuevos.
 * Devuelve el ajuste hecho, o null si no hizo falta.
 */
export function encuadrar(j: Play, vista: Vista, lado: Lado): Ajuste | null {
  const a = ajusteParaVer(j, vista, lado);
  j.vista = vista;
  j.lado = lado;
  if (a) j.pasos = j.pasos.map((p) => ajustarPaso(p, a));
  return a;
}
