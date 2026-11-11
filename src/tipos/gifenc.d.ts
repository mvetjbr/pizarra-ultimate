declare module 'gifenc' {
  export type Paleta = number[][];
  export interface OpcionesCuadro {
    palette?: Paleta;
    delay?: number;
    repeat?: number;
    transparent?: boolean;
    dispose?: number;
  }
  export interface Codificador {
    writeFrame(indice: Uint8Array, ancho: number, alto: number, opciones?: OpcionesCuadro): void;
    finish(): void;
    bytes(): Uint8Array;
  }
  export function GIFEncoder(): Codificador;
  export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColores: number, opciones?: { format?: string }): Paleta;
  export function applyPalette(rgba: Uint8Array | Uint8ClampedArray, paleta: Paleta, formato?: string): Uint8Array;
}
