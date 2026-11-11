import { create } from 'zustand';
import { useEditor } from '../estado/editorStore';

export type Velocidad = 0.5 | 1 | 2;
export const VELOCIDADES: Velocidad[] = [0.5, 1, 2];

/** Duración de una transición entre pasos a velocidad 1x (ms). */
const DURACION = 1800;
/** Pausa en cada paso durante la reproducción continua (ms). */
const PAUSA = 700;

interface EstadoReproduccion {
  /** Posición continua en la línea de tiempo mientras se anima; null = quieto en el paso actual. */
  posicion: number | null;
  reproduciendo: boolean;
  velocidad: Velocidad;
}

export const useReproduccion = create<EstadoReproduccion>(() => ({
  posicion: null,
  reproduciendo: false,
  velocidad: 1,
}));

let raf = 0;
let espera: ReturnType<typeof setTimeout> | undefined;

function cancelar() {
  cancelAnimationFrame(raf);
  clearTimeout(espera);
  raf = 0;
  espera = undefined;
}

const totalPasos = () => useEditor.getState().jugada.pasos.length;
const velocidad = () => useReproduccion.getState().velocidad;
const fijarPaso = (k: number) => useEditor.getState().irAPaso(k);

function animar(desde: number, hasta: number, alTerminar: () => void) {
  const dur = (DURACION * Math.abs(hasta - desde)) / velocidad();
  const t0 = performance.now();
  const cuadro = (ahora: number) => {
    const p = dur > 0 ? Math.min(1, (ahora - t0) / dur) : 1;
    useReproduccion.setState({ posicion: desde + (hasta - desde) * p });
    if (p < 1) raf = requestAnimationFrame(cuadro);
    else alTerminar();
  };
  raf = requestAnimationFrame(cuadro);
}

function terminar() {
  useReproduccion.setState({ posicion: null, reproduciendo: false });
}

function seguir(k: number) {
  if (k >= totalPasos() - 1) return terminar();
  animar(k, k + 1, () => {
    fijarPaso(k + 1);
    if (k + 1 >= totalPasos() - 1) return terminar();
    useReproduccion.setState({ posicion: k + 1 });
    espera = setTimeout(() => seguir(k + 1), PAUSA / velocidad());
  });
}

/** Reproduce desde el paso actual hasta el final (o desde el inicio si ya está al final). */
export function reproducir() {
  const n = totalPasos();
  if (n < 2) return;
  cancelar();
  useEditor.getState().seleccionar(null);
  let k = useEditor.getState().pasoActual;
  useReproduccion.setState({ reproduciendo: true });
  if (k >= n - 1) {
    k = 0;
    fijarPaso(0);
    useReproduccion.setState({ posicion: 0 });
    espera = setTimeout(() => seguir(0), PAUSA / velocidad());
  } else {
    useReproduccion.setState({ posicion: k });
    seguir(k);
  }
}

/** Detiene la animación y deja visible el paso más cercano. */
export function detener() {
  cancelar();
  const pos = useReproduccion.getState().posicion;
  if (pos !== null) fijarPaso(Math.round(pos));
  terminar();
}

export function alternarReproduccion() {
  if (useReproduccion.getState().reproduciendo) detener();
  else reproducir();
}

/** Va a un paso vecino animando la transición (también hacia atrás); a otros salta directo. */
export function irAPasoAnimado(destino: number) {
  const n = totalPasos();
  if (destino < 0 || destino >= n) return;
  const pos = useReproduccion.getState().posicion;
  const actual = pos ?? useEditor.getState().pasoActual;
  cancelar();
  useReproduccion.setState({ reproduciendo: false });
  if (Math.abs(destino - actual) > 1.001) {
    fijarPaso(destino);
    useReproduccion.setState({ posicion: null });
    return;
  }
  useEditor.getState().seleccionar(null);
  animar(actual, destino, () => {
    fijarPaso(destino);
    useReproduccion.setState({ posicion: null });
  });
}

function pasoBase(sentido: 1 | -1) {
  const pos = useReproduccion.getState().posicion;
  if (pos === null) return useEditor.getState().pasoActual;
  return sentido === 1 ? Math.floor(pos) : Math.ceil(pos);
}

export const pasoSiguiente = () => irAPasoAnimado(pasoBase(1) + 1);
export const pasoAnterior = () => irAPasoAnimado(pasoBase(-1) - 1);

export function setVelocidad(v: Velocidad) {
  useReproduccion.setState({ velocidad: v });
}

/** Detiene todo sin mover el paso (al editar, cambiar de jugada, etc.). */
export function cortarAnimacion() {
  cancelar();
  terminar();
}
