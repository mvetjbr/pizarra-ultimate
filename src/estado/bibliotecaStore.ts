import { create } from 'zustand';
import type { Play } from '../modelo/tipos';
import { crearJugada, nuevoId } from '../modelo/fabrica';
import { useEditor } from './editorStore';
import { cortarAnimacion } from '../animacion/reproductor';

interface EstadoBiblioteca {
  /** Todas las jugadas guardadas; la que está en el editor también vive aquí. */
  jugadas: Play[];
  upsert: (j: Play) => void;
  eliminar: (id: string) => void;
  /** Agrega jugadas importadas (con id nuevo si ya existe). Devuelve las agregadas. */
  importar: (js: Play[]) => Play[];
}

export const useBiblioteca = create<EstadoBiblioteca>((set, get) => ({
  jugadas: [],
  upsert: (j) =>
    set((s) => {
      const i = s.jugadas.findIndex((x) => x.id === j.id);
      if (i === -1) return { jugadas: [j, ...s.jugadas] };
      if (s.jugadas[i] === j) return {};
      const jugadas = s.jugadas.slice();
      jugadas[i] = j;
      return { jugadas };
    }),
  eliminar: (id) => set((s) => ({ jugadas: s.jugadas.filter((x) => x.id !== id) })),
  importar: (js) => {
    const ids = new Set(get().jugadas.map((x) => x.id));
    const nuevas = js.map((j) => (ids.has(j.id) ? { ...j, id: nuevoId() } : j));
    set((s) => ({ jugadas: [...nuevas, ...s.jugadas] }));
    return nuevas;
  },
}));

/** Carga una jugada en el editor (sin historial: deshacer no salta entre jugadas). */
export function abrirJugada(j: Play) {
  cortarAnimacion();
  useEditor.getState().reemplazar(j, false);
}

export function nuevaJugada() {
  abrirJugada(crearJugada());
}

/** Copia con id y nombre nuevos. */
export function duplicarJugada(j: Play): Play {
  const ahora = Date.now();
  const copia: Play = { ...structuredClone(j), id: nuevoId(), nombre: `${j.nombre} (copia)`, creada: ahora, editada: ahora };
  useBiblioteca.getState().upsert(copia);
  return copia;
}

export function eliminarJugada(id: string) {
  // Si es la que está abierta, primero se abre otra (así el guardado pendiente no la revive).
  if (useEditor.getState().jugada.id === id) {
    const otra = useBiblioteca
      .getState()
      .jugadas.filter((x) => x.id !== id)
      .sort((a, b) => b.editada - a.editada)[0];
    abrirJugada(otra ?? crearJugada());
  }
  useBiblioteca.getState().eliminar(id);
}
