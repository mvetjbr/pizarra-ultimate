import type { Player, Punto, Step } from './tipos';
import { CANCHA } from './cancha';
import { OFFSET_DISCO } from './geometria';

/*
 * Formación inicial del ataque (el ataque anota a la derecha, hacia x = 100).
 * "Izquierda" y "derecha" son mirando hacia donde ataca el equipo: en la cancha horizontal,
 * izquierda queda arriba (y pequeña) y derecha abajo (y grande).
 */
export type Formacion = 'vertical' | 'horizontal';
export type Carril = 'izquierda' | 'centro' | 'derecha';

const Y_CARRIL: Record<Carril, number> = { izquierda: 9.5, centro: CANCHA.ancho / 2, derecha: CANCHA.ancho - 9.5 };
const limY = (y: number) => Math.min(CANCHA.ancho - 1.5, Math.max(1.5, y));

/** Posiciones del ataque 1 a 7 en orden de número. */
export function posicionesAtaque(f: Formacion, c: Carril): Punto[] {
  if (f === 'vertical') {
    const y = Y_CARRIL[c];
    // Handler (1) detrás del stack, un poco hacia el centro; el stack (2 a 7) en fila hacia la zona.
    const yHandler = c === 'centro' ? y : c === 'izquierda' ? y + 3 : y - 3;
    return [{ x: 30, y: yHandler }, ...[40, 45, 50, 55, 60, 65].map((x) => ({ x, y }))];
  }
  // Horizontal: 3 handlers atrás y 4 cortadores en línea adelante, corridos hacia el lado elegido.
  const d = c === 'izquierda' ? -3 : c === 'derecha' ? 3 : 0;
  return [
    { x: 30, y: limY(18.5 + d) },
    { x: 33, y: limY(8.5 + d) },
    { x: 33, y: limY(28.5 + d) },
    { x: 50, y: limY(5 + d) },
    { x: 50, y: limY(14 + d) },
    { x: 50, y: limY(23 + d) },
    { x: 50, y: limY(32 + d) },
  ];
}

/**
 * Marca de cada defensor junto a su atacante. En vertical: el 1 a un lado del handler y el resto
 * del lado contrario. En horizontal los cortadores están en línea a lo ancho: la marca va delante.
 */
function marca(p: Punto, numero: number, f: Formacion): Punto {
  if (f === 'horizontal') return numero <= 3 ? { x: p.x + 2, y: limY(p.y - 2.2) } : { x: p.x + 3, y: limY(p.y + 1.2) };
  const lado = numero === 1 ? -1 : 1;
  let y = p.y + lado * 3.4;
  if (y < 1.5 || y > CANCHA.ancho - 1.5) y = p.y - lado * 3.4;
  return { x: p.x + (numero === 1 ? 1.5 : 1.8), y };
}

const numero = (j: Player) => Number.parseInt(j.etiqueta, 10);

/**
 * Acomoda a todos los jugadores del paso en la formación elegida, emparejando por número
 * (los defensores marcan a su atacante). Las flechas pegadas a jugadores los siguen solas;
 * el disco queda con el handler si lo tenía alguien del ataque.
 */
export function ubicarFormacion(paso: Step, f: Formacion, c: Carril) {
  const pos = posicionesAtaque(f, c);
  const ordenados = (e: 'ataque' | 'defensa') =>
    paso.jugadores
      .filter((j) => j.equipo === e)
      .sort((a, b) => (numero(a) || 99) - (numero(b) || 99));
  const ataque = ordenados('ataque');
  ataque.forEach((j, i) => {
    const p = pos[Math.min(i, pos.length - 1)];
    j.x = p.x;
    j.y = p.y;
  });
  ordenados('defensa').forEach((j, i) => {
    const p = marca(pos[Math.min(i, pos.length - 1)], i + 1, f);
    j.x = p.x;
    j.y = p.y;
  });
  // Las flechas sueltas (sin jugador) no se tocan; las curvas pegadas se reinician para no quedar torcidas.
  for (const fl of paso.flechas) if (fl.desdeId || fl.hastaId) fl.control = undefined;
  const poseedor = paso.jugadores.find((j) => j.id === paso.disco.poseedorId);
  const handler = ataque[0];
  if (handler && (!poseedor || poseedor.equipo === 'ataque')) {
    paso.disco = { x: handler.x + OFFSET_DISCO.x, y: handler.y + OFFSET_DISCO.y, poseedorId: handler.id };
  }
}
