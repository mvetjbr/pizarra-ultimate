import { create } from 'zustand';

export type Ventana = 'biblioteca' | 'detalles' | 'compartir' | 'roster' | 'jugadores' | null;

/** Qué ventana (diálogo) está abierta; así cualquier parte de la interfaz puede abrir una. */
export const useVentana = create<{ ventana: Ventana; abrir: (v: Ventana) => void; cerrar: () => void }>((set) => ({
  ventana: null,
  abrir: (ventana) => set({ ventana }),
  cerrar: () => set({ ventana: null }),
}));
