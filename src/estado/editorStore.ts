import { create } from 'zustand';
import type { Arrow, Equipo, FormaZona, Play, Punto, Step, Zone } from '../modelo/tipos';
import { crearJugada, crearPasoSiguiente, duplicarPaso, nuevoId } from '../modelo/fabrica';
import { posDisco } from '../modelo/geometria';

export type Herramienta = 'seleccionar' | 'corte' | 'pase' | 'defensa' | 'zona' | 'texto' | 'borrar';
export type TipoSeleccion = 'jugador' | 'disco' | 'flecha' | 'zona' | 'texto';
export interface Seleccion {
  tipo: TipoSeleccion;
  id: string;
}

type Receta = (jugada: Play, paso: Step) => void;

/** Jugada de otra persona abierta desde "Compartido conmigo" (no vive en la biblioteca propia). */
export interface Compartida {
  id: string;
  permiso: 'ver' | 'editar';
  autor: string;
  version: number;
}

const LIMITE_HISTORIAL = 100;

interface EstadoEditor {
  jugada: Play;
  pasoActual: number;
  herramienta: Herramienta;
  seleccion: Seleccion | null;
  /** Varios jugadores elegidos con el recuadro (se mueven juntos). */
  grupo: string[];
  formaZona: FormaZona;
  pasado: Play[];
  futuro: Play[];
  /** Copia tomada al iniciar un gesto (arrastre o escritura) para deshacerlo de una vez. */
  pendiente: Play | null;
  cargado: boolean;
  presentando: boolean;
  compartida: Compartida | null;

  setHerramienta: (h: Herramienta) => void;
  seleccionar: (s: Seleccion | null) => void;
  seleccionarGrupo: (ids: string[]) => void;
  setFormaZona: (f: FormaZona) => void;
  setPresentando: (v: boolean) => void;

  /** Cambio con entrada en el historial. */
  cambiar: (fn: Receta) => void;
  /** Gestos continuos: una sola entrada de historial al terminar. */
  iniciarGesto: () => void;
  moverGesto: (fn: Receta) => void;
  terminarGesto: () => void;
  /** Deshace lo movido desde iniciarGesto sin dejar rastro en el historial (p. ej. al empezar un zoom). */
  cancelarGesto: () => void;

  deshacer: () => void;
  rehacer: () => void;
  reemplazar: (j: Play, conHistorial?: boolean) => void;

  agregarFlecha: (f: Omit<Arrow, 'id'>) => void;
  agregarZona: (z: Omit<Zone, 'id'>) => void;
  agregarTexto: (p: Punto) => void;
  agregarJugador: (e: Equipo) => void;
  eliminar: (s: Seleccion) => void;

  irAPaso: (i: number) => void;
  /** Nuevo paso después del actual, aplicando sus cortes y su pase. */
  agregarPaso: () => void;
  duplicarPasoActual: () => void;
  eliminarPaso: (i: number) => void;
  moverPaso: (i: number, dir: -1 | 1) => void;
}

/**
 * Copia superficial de la jugada y profunda solo del paso activo: así los demás
 * pasos conservan su referencia y sus miniaturas no se vuelven a dibujar.
 * Las recetas deben reemplazar (no mutar) los arreglos de la jugada como `etiquetas`.
 */
function aplicar(j: Play, idx: number, fn: Receta): Play {
  const i = Math.min(idx, j.pasos.length - 1);
  const n: Play = { ...j, pasos: j.pasos.slice() };
  n.pasos[i] = structuredClone(j.pasos[i]);
  fn(n, n.pasos[i]);
  n.editada = Date.now();
  return n;
}

export const useEditor = create<EstadoEditor>((set, get) => ({
  jugada: crearJugada(),
  pasoActual: 0,
  herramienta: 'seleccionar',
  seleccion: null,
  grupo: [],
  formaZona: 'rect',
  pasado: [],
  futuro: [],
  pendiente: null,
  cargado: false,
  presentando: false,
  compartida: null,

  setHerramienta: (herramienta) => set({ herramienta, seleccion: null, grupo: [] }),
  seleccionar: (seleccion) => set({ seleccion, grupo: [] }),
  seleccionarGrupo: (grupo) => set({ grupo, seleccion: null }),
  setFormaZona: (formaZona) => set({ formaZona }),
  setPresentando: (presentando) => set({ presentando, seleccion: null, grupo: [] }),

  cambiar: (fn) =>
    set((s) => ({
      jugada: aplicar(s.jugada, s.pasoActual, fn),
      pasado: [...s.pasado, s.jugada].slice(-LIMITE_HISTORIAL),
      futuro: [],
    })),

  iniciarGesto: () => set((s) => ({ pendiente: s.jugada })),
  moverGesto: (fn) => set((s) => ({ jugada: aplicar(s.jugada, s.pasoActual, fn) })),
  terminarGesto: () =>
    set((s) => {
      if (!s.pendiente) return {};
      if (s.pendiente === s.jugada) return { pendiente: null };
      return {
        pendiente: null,
        pasado: [...s.pasado, s.pendiente].slice(-LIMITE_HISTORIAL),
        futuro: [],
      };
    }),

  cancelarGesto: () => set((s) => (s.pendiente ? { jugada: s.pendiente, pendiente: null } : {})),

  deshacer: () =>
    set((s) => {
      const prev = s.pasado[s.pasado.length - 1];
      if (!prev) return {};
      return {
        jugada: prev,
        pasado: s.pasado.slice(0, -1),
        futuro: [s.jugada, ...s.futuro].slice(0, LIMITE_HISTORIAL),
        pendiente: null,
        seleccion: null,
        grupo: [],
        pasoActual: Math.min(s.pasoActual, prev.pasos.length - 1),
      };
    }),
  rehacer: () =>
    set((s) => {
      const sig = s.futuro[0];
      if (!sig) return {};
      return {
        jugada: sig,
        pasado: [...s.pasado, s.jugada].slice(-LIMITE_HISTORIAL),
        futuro: s.futuro.slice(1),
        pendiente: null,
        seleccion: null,
        grupo: [],
        pasoActual: Math.min(s.pasoActual, sig.pasos.length - 1),
      };
    }),

  reemplazar: (j, conHistorial = true) =>
    set((s) => ({
      jugada: j,
      pasoActual: 0,
      seleccion: null,
      grupo: [],
      pendiente: null,
      pasado: conHistorial ? [...s.pasado, s.jugada].slice(-LIMITE_HISTORIAL) : [],
      futuro: [],
      // Abrir otra jugada (sin historial) sale del modo "compartida"; quien la abre lo vuelve a fijar.
      compartida: conHistorial ? s.compartida : null,
    })),

  agregarFlecha: (f) => {
    const id = nuevoId();
    get().cambiar((_, paso) => {
      paso.flechas.push({ ...f, id });
    });
    set({ seleccion: { tipo: 'flecha', id } });
  },

  agregarZona: (z) => {
    const id = nuevoId();
    get().cambiar((_, paso) => {
      paso.zonas.push({ ...z, id });
    });
    set({ seleccion: { tipo: 'zona', id } });
  },

  agregarTexto: (p) => {
    const id = nuevoId();
    get().cambiar((_, paso) => {
      paso.textos.push({ id, x: p.x, y: p.y, texto: 'Nota' });
    });
    set({ seleccion: { tipo: 'texto', id } });
  },

  agregarJugador: (equipo) => {
    const id = nuevoId();
    get().cambiar((_, paso) => {
      const delEquipo = paso.jugadores.filter((j) => j.equipo === equipo);
      const usadas = new Set(delEquipo.map((j) => j.etiqueta));
      let n = 1;
      while (usadas.has(String(n))) n++;
      paso.jugadores.push({
        id,
        equipo,
        etiqueta: String(n),
        x: 50 + (equipo === 'ataque' ? -3 : 3),
        y: 4 + delEquipo.length * 2,
      });
    });
    set({ seleccion: { tipo: 'jugador', id } });
  },

  eliminar: (sel) => {
    if (sel.tipo === 'disco') return; // el disco es único y no se borra
    get().cambiar((_, paso) => {
      if (sel.tipo === 'jugador') {
        const j = paso.jugadores.find((x) => x.id === sel.id);
        if (!j) return;
        if (paso.disco.poseedorId === j.id) {
          const p = posDisco(paso);
          paso.disco = { x: p.x, y: p.y };
        }
        paso.jugadores = paso.jugadores.filter((x) => x.id !== sel.id);
        paso.flechas = paso.flechas
          .filter((f) => f.desdeId !== sel.id)
          .map((f) => (f.hastaId === sel.id ? { ...f, hastaId: undefined, hasta: { x: j.x, y: j.y } } : f));
      } else if (sel.tipo === 'flecha') {
        paso.flechas = paso.flechas.filter((f) => f.id !== sel.id);
      } else if (sel.tipo === 'zona') {
        paso.zonas = paso.zonas.filter((z) => z.id !== sel.id);
      } else if (sel.tipo === 'texto') {
        paso.textos = paso.textos.filter((t) => t.id !== sel.id);
      }
    });
    const actual = get().seleccion;
    if (actual && actual.id === sel.id) set({ seleccion: null });
  },

  irAPaso: (i) =>
    set((s) => ({ pasoActual: Math.max(0, Math.min(i, s.jugada.pasos.length - 1)), seleccion: null })),

  agregarPaso: () => {
    const k = get().pasoActual;
    get().cambiar((j, paso) => {
      j.pasos.splice(k + 1, 0, crearPasoSiguiente(paso));
    });
    set({ pasoActual: k + 1, seleccion: null });
  },

  duplicarPasoActual: () => {
    const k = get().pasoActual;
    get().cambiar((j, paso) => {
      j.pasos.splice(k + 1, 0, duplicarPaso(paso));
    });
    set({ pasoActual: k + 1, seleccion: null });
  },

  eliminarPaso: (i) => {
    const s = get();
    if (s.jugada.pasos.length <= 1) return;
    s.cambiar((j) => {
      j.pasos.splice(i, 1);
    });
    const total = get().jugada.pasos.length;
    const nuevo = i < s.pasoActual ? s.pasoActual - 1 : Math.min(s.pasoActual, total - 1);
    set({ pasoActual: nuevo, seleccion: null });
  },

  moverPaso: (i, dir) => {
    const s = get();
    const t = i + dir;
    if (t < 0 || t >= s.jugada.pasos.length) return;
    s.cambiar((j) => {
      [j.pasos[i], j.pasos[t]] = [j.pasos[t], j.pasos[i]];
    });
    set({ pasoActual: s.pasoActual === i ? t : s.pasoActual === t ? i : s.pasoActual });
  },
}));

export const pasoActivo = (s: { jugada: Play; pasoActual: number }): Step =>
  s.jugada.pasos[Math.min(s.pasoActual, s.jugada.pasos.length - 1)];
