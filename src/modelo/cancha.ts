import type { Lado, Orientacion, Vista } from './tipos';

/** Medidas WFDF en metros. */
export const CANCHA = {
  largo: 100,
  ancho: 37,
  zona: 18,
  /** Distancia del brick a la línea de zona de anotación. */
  brick: 20,
} as const;

export const BRICKS = [
  { x: CANCHA.zona + CANCHA.brick, y: CANCHA.ancho / 2 },
  { x: CANCHA.largo - CANCHA.zona - CANCHA.brick, y: CANCHA.ancho / 2 },
];

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MARGEN = 2;

/** Región de la cancha (en metros, sin rotar) que muestra cada vista. */
export function regionCancha(vista: Vista, lado: Lado): Rect {
  const y = -MARGEN;
  const h = CANCHA.ancho + 2 * MARGEN;
  if (vista === 'media') {
    const w = CANCHA.largo / 2 + 2 * MARGEN;
    return { x: lado === 'derecha' ? CANCHA.largo / 2 - MARGEN : -MARGEN, y, w, h };
  }
  if (vista === 'zona') {
    // Zona de anotación + 12 m de cancha central para dar contexto.
    const w = CANCHA.zona + 12 + 2 * MARGEN;
    return { x: lado === 'derecha' ? CANCHA.largo - w + MARGEN : -MARGEN, y, w, h };
  }
  return { x: -MARGEN, y, w: CANCHA.largo + 2 * MARGEN, h };
}

/**
 * En vertical la cancha gira 90° a la izquierda: la zona de anotación derecha
 * queda arriba. Punto (x, y) → (y, 100 - x).
 */
export function transformacion(o: Orientacion): string | undefined {
  return o === 'vertical' ? `matrix(0 -1 1 0 0 ${CANCHA.largo})` : undefined;
}

/** Rotación que hay que aplicar a textos y símbolos para que se vean derechos. */
export function rotacionTexto(o: Orientacion): string | undefined {
  return o === 'vertical' ? 'rotate(90)' : undefined;
}

/** viewBox del SVG para una vista y orientación. */
export function regionVista(vista: Vista, lado: Lado, o: Orientacion): Rect {
  const r = regionCancha(vista, lado);
  if (o === 'horizontal') return r;
  return { x: r.y, y: CANCHA.largo - r.x - r.w, w: r.h, h: r.w };
}

export function limitarPunto(x: number, y: number) {
  return {
    x: Math.min(CANCHA.largo + 3, Math.max(-3, x)),
    y: Math.min(CANCHA.ancho + 3, Math.max(-3, y)),
  };
}
