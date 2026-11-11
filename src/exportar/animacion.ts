import { applyPalette, GIFEncoder, quantize } from 'gifenc';
import { interpolar } from '../animacion/interpolar';
import { Lienzo, textoDePaso, type Contexto } from './imagen';

/** Tiempos de la animación exportada (segundos, a velocidad 1x). */
const TRANSICION = 1.8;
const PAUSA = 0.8;
const PAUSA_FINAL = 1.6;

type Progreso = (fraccion: number) => void;

/**
 * Línea de tiempo: pausa en cada paso y transición al siguiente.
 * Devuelve la duración total y una función tiempo → posición (0 = paso 1, 1.5 = mitad entre 2 y 3…).
 */
function lineaDeTiempo(pasos: number, velocidad: number) {
  const T = TRANSICION / velocidad;
  const P = PAUSA / velocidad;
  const tramo = P + T;
  const total = (pasos - 1) * tramo + PAUSA_FINAL;
  const posicion = (t: number) => {
    const i = Math.floor(t / tramo);
    if (i >= pasos - 1) return pasos - 1;
    const dentro = t - i * tramo;
    return dentro <= P ? i : i + (dentro - P) / T;
  };
  return { total, posicion, T, P };
}

async function dibujarPosicion(lienzo: Lienzo, c: Contexto, pos: number) {
  const { paso, opacidadFlechas } = interpolar(c.jugada.pasos, pos);
  await lienzo.dibujar(paso, textoDePaso(Math.round(pos), c.jugada.pasos.length), opacidadFlechas);
}

const respirar = () => new Promise((r) => setTimeout(r, 0));

/** GIF animado (≈ 940 px de ancho, 12 cuadros por segundo). */
export async function gifDeJugada(c: Contexto, velocidad: number, alProgresar: Progreso): Promise<Blob> {
  const n = c.jugada.pasos.length;
  const lienzo = new Lienzo(c, 9);
  const { width: w, height: h } = lienzo.canvas;
  const gif = GIFEncoder();
  const fps = 12;
  const { T, P } = lineaDeTiempo(n, velocidad);
  const cuadrosTransicion = Math.max(2, Math.round(T * fps));

  // Lista de cuadros: [posición, duración en ms]. Las pausas son un solo cuadro largo.
  const cuadros: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    cuadros.push([i, Math.round((i === n - 1 ? PAUSA_FINAL : P) * 1000)]);
    if (i < n - 1) for (let k = 1; k < cuadrosTransicion; k++) cuadros.push([i + k / cuadrosTransicion, Math.round(1000 / fps)]);
  }

  for (let k = 0; k < cuadros.length; k++) {
    const [pos, demora] = cuadros[k];
    await dibujarPosicion(lienzo, c, pos);
    const { data } = lienzo.ctx.getImageData(0, 0, w, h);
    const paleta = quantize(data, 256, { format: 'rgb444' });
    gif.writeFrame(applyPalette(data, paleta, 'rgb444'), w, h, { palette: paleta, delay: demora, repeat: 0 });
    alProgresar((k + 1) / cuadros.length);
    await respirar();
  }
  gif.finish();
  return new Blob([gif.bytes()], { type: 'image/gif' });
}

/** Formato de video que soporta el navegador (WebM en Chrome/Android, MP4 en iPhone). */
export function formatoVideo(): { tipo: string; extension: string } | null {
  if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) return null;
  const opciones = [
    { tipo: 'video/webm;codecs=vp9', extension: 'webm' },
    { tipo: 'video/webm;codecs=vp8', extension: 'webm' },
    { tipo: 'video/webm', extension: 'webm' },
    { tipo: 'video/mp4', extension: 'mp4' },
  ];
  return opciones.find((o) => MediaRecorder.isTypeSupported(o.tipo)) ?? null;
}

/**
 * Video grabado en tiempo real desde un canvas (≈ 1250 px de ancho). Como la posición se
 * calcula con el reloj, el video dura lo mismo aunque el equipo sea lento (solo pierde cuadros).
 */
export async function videoDeJugada(c: Contexto, velocidad: number, alProgresar: Progreso): Promise<{ blob: Blob; extension: string }> {
  const formato = formatoVideo();
  if (!formato) throw new Error('Este navegador no puede grabar video.');
  const lienzo = new Lienzo(c, 12);
  const { total, posicion } = lineaDeTiempo(c.jugada.pasos.length, velocidad);

  // Primer cuadro dibujado antes de empezar a grabar (evita un inicio en negro).
  await dibujarPosicion(lienzo, c, 0);
  const flujo = lienzo.canvas.captureStream(30);
  const grabadora = new MediaRecorder(flujo, { mimeType: formato.tipo, videoBitsPerSecond: 5_000_000 });
  const partes: Blob[] = [];
  grabadora.ondataavailable = (e) => {
    if (e.data.size > 0) partes.push(e.data);
  };
  const terminado = new Promise<void>((resolver) => {
    grabadora.onstop = () => resolver();
  });

  grabadora.start(250);
  const t0 = performance.now();
  for (;;) {
    const t = (performance.now() - t0) / 1000;
    if (t >= total) break;
    await dibujarPosicion(lienzo, c, posicion(t));
    alProgresar(Math.min(1, t / total));
    await new Promise((r) => requestAnimationFrame(r));
  }
  await dibujarPosicion(lienzo, c, c.jugada.pasos.length - 1);
  await new Promise((r) => setTimeout(r, 300));
  grabadora.stop();
  await terminado;
  flujo.getTracks().forEach((t) => t.stop());
  alProgresar(1);
  return { blob: new Blob(partes, { type: formato.tipo.split(';')[0] }), extension: formato.extension };
}
