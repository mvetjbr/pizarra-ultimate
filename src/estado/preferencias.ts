import { create } from 'zustand';
import { COLORES } from '../estilos/colores';
import type { Proporcion } from '../modelo/fabrica';

export interface Preferencias {
  colorAtaque: string;
  colorDefensa: string;
  mostrarCuadricula: boolean;
  mostrarMatch: boolean;
  mostrarLeyenda: boolean;
  mostrarNombres: boolean;
  /** Jugadores con que empiezan las jugadas nuevas (0 a 7). */
  cantidadAtaque: number;
  cantidadDefensa: number;
  /** Match con que empiezan las jugadas nuevas: 4M-3F, 3M-4F o sin género. */
  proporcion: Proporcion;
  /** Muñeco del conteo de 10 sobre la cancha. */
  mostrarConteo: boolean;
  muneco: string;
  /** 0 = 2 s por número, 50 = 1 s, 100 = 0,5 s. */
  velocidadConteo: number;
  /** Modo editor: todas las mascotas desbloqueadas en este dispositivo. */
  modoEditor: boolean;
}

export const PREFERENCIAS_INICIALES: Preferencias = {
  colorAtaque: COLORES.ataque,
  colorDefensa: COLORES.defensa,
  mostrarCuadricula: false,
  mostrarMatch: true,
  mostrarLeyenda: true,
  mostrarNombres: true,
  cantidadAtaque: 7,
  cantidadDefensa: 7,
  proporcion: 'M',
  mostrarConteo: true,
  muneco: 'alien',
  velocidadConteo: 50,
  modoEditor: false,
};

interface EstadoPreferencias extends Preferencias {
  actualizar: (p: Partial<Preferencias>) => void;
}

export const usePreferencias = create<EstadoPreferencias>((set) => ({
  ...PREFERENCIAS_INICIALES,
  actualizar: (p) => set(p),
}));

const cantidadValida = (n: unknown) => (typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 7 ? n : 7);
const entre = (n: unknown, min: number, max: number, def: number) =>
  typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max ? n : def;

export function extraerPreferencias(s: Preferencias): Preferencias {
  return {
    colorAtaque: s.colorAtaque,
    colorDefensa: s.colorDefensa,
    mostrarCuadricula: s.mostrarCuadricula,
    mostrarMatch: s.mostrarMatch,
    mostrarLeyenda: s.mostrarLeyenda,
    mostrarNombres: s.mostrarNombres,
    cantidadAtaque: cantidadValida(s.cantidadAtaque),
    cantidadDefensa: cantidadValida(s.cantidadDefensa),
    proporcion: s.proporcion === 'F' || s.proporcion === 'N' ? s.proporcion : 'M',
    mostrarConteo: s.mostrarConteo !== false,
    muneco: typeof s.muneco === 'string' ? s.muneco : 'alien',
    velocidadConteo: entre(s.velocidadConteo, 0, 100, 50),
    modoEditor: s.modoEditor === true,
  };
}
