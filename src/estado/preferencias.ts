import { create } from 'zustand';
import { COLORES } from '../estilos/colores';

export interface Preferencias {
  colorAtaque: string;
  colorDefensa: string;
  mostrarCuadricula: boolean;
  mostrarMatch: boolean;
  mostrarLeyenda: boolean;
  mostrarNombres: boolean;
}

export const PREFERENCIAS_INICIALES: Preferencias = {
  colorAtaque: COLORES.ataque,
  colorDefensa: COLORES.defensa,
  mostrarCuadricula: false,
  mostrarMatch: true,
  mostrarLeyenda: true,
  mostrarNombres: true,
};

interface EstadoPreferencias extends Preferencias {
  actualizar: (p: Partial<Preferencias>) => void;
}

export const usePreferencias = create<EstadoPreferencias>((set) => ({
  ...PREFERENCIAS_INICIALES,
  actualizar: (p) => set(p),
}));

export function extraerPreferencias(s: Preferencias): Preferencias {
  return {
    colorAtaque: s.colorAtaque,
    colorDefensa: s.colorDefensa,
    mostrarCuadricula: s.mostrarCuadricula,
    mostrarMatch: s.mostrarMatch,
    mostrarLeyenda: s.mostrarLeyenda,
    mostrarNombres: s.mostrarNombres,
  };
}
