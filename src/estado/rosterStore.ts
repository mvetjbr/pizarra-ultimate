import { create } from 'zustand';
import type { Match, Player } from '../modelo/tipos';
import { nuevoId } from '../modelo/fabrica';

export interface MiembroRoster {
  id: string;
  nombre: string;
  /** Dorsal; si falta se usan las iniciales en la ficha. */
  numero?: string;
  match: Match;
}

interface EstadoRoster {
  miembros: MiembroRoster[];
  agregar: (m: Omit<MiembroRoster, 'id'>) => void;
  actualizar: (id: string, cambios: Partial<Omit<MiembroRoster, 'id'>>) => void;
  eliminar: (id: string) => void;
}

export const useRoster = create<EstadoRoster>((set) => ({
  miembros: [],
  agregar: (m) => set((s) => ({ miembros: [...s.miembros, { ...m, id: nuevoId() }] })),
  actualizar: (id, cambios) => set((s) => ({ miembros: s.miembros.map((m) => (m.id === id ? { ...m, ...cambios } : m)) })),
  eliminar: (id) => set((s) => ({ miembros: s.miembros.filter((m) => m.id !== id) })),
}));

export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/** Lo que se escribe dentro de la ficha: dorsal o iniciales (máx. 3 caracteres). */
export const etiquetaDe = (m: MiembroRoster) => (m.numero?.trim() || iniciales(m.nombre)).slice(0, 3);

/** Primer nombre, para mostrar debajo de la ficha sin tapar la cancha. */
export const nombreCorto = (nombre: string) => nombre.trim().split(/\s+/)[0]?.slice(0, 12) ?? '';

/**
 * Nombre a mostrar de un jugador: el del roster local si existe y, si no, el que viene
 * guardado en la jugada (así una jugada compartida por enlace conserva los nombres).
 */
export function nombreDeJugador(j: Player, miembros: MiembroRoster[]): string | undefined {
  const m = j.rosterId ? miembros.find((x) => x.id === j.rosterId) : undefined;
  return m?.nombre ?? j.nombre;
}
