import { create } from 'zustand';
import type { Play } from '../modelo/tipos';
import { crearJugada, nuevoId } from '../modelo/fabrica';
import { useEditor } from './editorStore';
import { cortarAnimacion } from '../animacion/reproductor';
import { usePreferencias } from './preferencias';
import { ubicarFormacion } from '../modelo/formaciones';

interface EstadoBiblioteca {
  /** Todas las jugadas guardadas; la que está en el editor también vive aquí. */
  jugadas: Play[];
  upsert: (j: Play) => void;
  eliminar: (id: string) => void;
  /** Agrega jugadas importadas (con id nuevo si ya existe). Devuelve las agregadas. */
  importar: (js: Play[]) => Play[];
  /** Carpetas creadas (también las vacías). Las de las jugadas se suman al mostrarlas. */
  carpetas: string[];
}

const limpiarNombre = (s: string) => s.trim().replace(/\s+/g, ' ').slice(0, 40);

/** Todas las carpetas: las creadas y las que tienen jugadas, en orden alfabético. */
export function listaCarpetas(carpetas: string[], jugadas: Play[]): string[] {
  const todas = new Set(carpetas);
  for (const j of jugadas) if (j.carpeta) todas.add(j.carpeta);
  return [...todas].sort((a, b) => a.localeCompare(b, 'es'));
}

export function crearCarpeta(nombre: string): string | null {
  const n = limpiarNombre(nombre);
  if (!n) return null;
  useBiblioteca.setState((s) => (s.carpetas.includes(n) ? {} : { carpetas: [...s.carpetas, n] }));
  return n;
}

/** Mueve una jugada a una carpeta (o la saca de toda carpeta con undefined). */
export function moverACarpeta(id: string, carpeta: string | undefined) {
  const ed = useEditor.getState();
  // La jugada abierta se cambia en el editor, si no el guardado automático la devolvería a como estaba.
  if (ed.jugada.id === id && !ed.compartida) {
    ed.cambiar((j) => {
      j.carpeta = carpeta;
    });
    return;
  }
  const j = useBiblioteca.getState().jugadas.find((x) => x.id === id);
  if (j) useBiblioteca.getState().upsert({ ...j, carpeta, editada: Date.now() });
}

export function renombrarCarpeta(vieja: string, nueva: string): string | null {
  const n = limpiarNombre(nueva);
  if (!n || n === vieja) return null;
  for (const j of useBiblioteca.getState().jugadas) if (j.carpeta === vieja) moverACarpeta(j.id, n);
  useBiblioteca.setState((s) => ({ carpetas: [...new Set(s.carpetas.map((c) => (c === vieja ? n : c)))] }));
  return n;
}

/** Borra la carpeta; sus jugadas no se borran, quedan sin carpeta. */
export function borrarCarpeta(nombre: string) {
  for (const j of useBiblioteca.getState().jugadas) if (j.carpeta === nombre) moverACarpeta(j.id, undefined);
  useBiblioteca.setState((s) => ({ carpetas: s.carpetas.filter((c) => c !== nombre) }));
}

export const useBiblioteca = create<EstadoBiblioteca>((set, get) => ({
  jugadas: [],
  carpetas: [],
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

/** Jugada nueva con la cantidad de jugadores y la proporción elegidas en Jugadores en cancha. */
export function nuevaJugada(carpeta?: string) {
  const p = usePreferencias.getState();
  const j = crearJugada(undefined, { ataque: p.cantidadAtaque, defensa: p.cantidadDefensa, proporcion: p.proporcion });
  ubicarFormacion(j.pasos[0], p.formacion, p.carril);
  if (carpeta) j.carpeta = carpeta;
  abrirJugada(j);
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
