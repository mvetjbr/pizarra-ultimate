import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { Orientacion, Play, Step } from '../modelo/tipos';
import { regionVista } from '../modelo/cancha';
import type { Preferencias } from '../estado/preferencias';
import type { MiembroRoster } from '../estado/rosterStore';
import type { EstiloJugador, Tema } from '../temas';
import { colorFlecha } from '../cancha/FlechaSVG';
import { crearNombreDe, DibujoCancha } from '../cancha/CanchaEstatica';

const FUENTE = "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";

/** Todo lo necesario para dibujar cuadros de una jugada. */
export interface Contexto {
  jugada: Play;
  prefs: Preferencias;
  miembros: MiembroRoster[];
  orientacion: Orientacion;
  /** Tema con que se exporta (el activo): colores y formas de la cancha y la leyenda. */
  tema: Tema;
}

/** Dibuja el paso en un SVG fuera de pantalla y lo devuelve como texto. */
export function svgDePaso(paso: Step, c: Contexto, opacidadFlechas = 1): string {
  const contenedor = document.createElement('div');
  const raiz = createRoot(contenedor);
  flushSync(() => {
    raiz.render(
      <DibujoCancha
        paso={paso}
        vista={c.jugada.vista}
        lado={c.jugada.lado}
        orientacion={c.orientacion}
        tema={c.tema}
        mostrarMatch={c.prefs.mostrarMatch}
        nombreDe={crearNombreDe(c.prefs.mostrarNombres, c.miembros)}
        opacidadFlechas={opacidadFlechas}
        autonomo
      />,
    );
  });
  const svg = new XMLSerializer().serializeToString(contenedor.firstElementChild!);
  raiz.unmount();
  return svg;
}

async function cargarImagen(svg: string): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    // La imagen ya decodificada se puede seguir dibujando.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/** Dibuja la forma de un jugador del tema (círculo, anillo o triángulo) en el lienzo. */
function formaEnLienzo(ctx: CanvasRenderingContext2D, e: EstiloJugador, cx: number, cy: number, r: number) {
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (e.forma === 'triangulo' || e.forma === 'triangulo-redondeado') {
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r * 0.95, cy + r * 0.75);
    ctx.lineTo(cx - r * 0.95, cy + r * 0.75);
    ctx.closePath();
  } else {
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
  }
  ctx.lineWidth = Math.max(2, r * (e.forma === 'anillo' ? 0.3 : 0.2));
  ctx.strokeStyle = e.borde;
  if (e.forma !== 'anillo') {
    ctx.fillStyle = e.relleno;
    ctx.fill();
  }
  ctx.stroke();
}

function leyenda(ctx: CanvasRenderingContext2D, x0: number, y: number, tema: Tema, escala: number) {
  ctx.font = `600 ${22 * escala}px ${FUENTE}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  let x = x0;
  const texto = (t: string) => {
    ctx.fillStyle = tema.css['sobre-capa'];
    ctx.fillText(t, x, y);
    x += ctx.measureText(t).width + 34 * escala;
  };
  const r = 11 * escala;
  formaEnLienzo(ctx, tema.ataque, x + r, y, r);
  x += 2 * r + 8 * escala;
  texto('Ataque');
  formaEnLienzo(ctx, tema.defensa, x + r, y, r);
  x += 2 * r + 8 * escala;
  texto('Defensa');
  const linea = (color: string, guiones: number[], nombre: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 5 * escala;
    ctx.lineCap = guiones.length && guiones[0] < 2 ? 'round' : 'butt';
    ctx.setLineDash(guiones.map((g) => g * escala));
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 46 * escala, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + 58 * escala, y);
    ctx.lineTo(x + 44 * escala, y - 8 * escala);
    ctx.lineTo(x + 44 * escala, y + 8 * escala);
    ctx.fill();
    x += 66 * escala;
    texto(nombre);
  };
  linea(colorFlecha(tema, 'corte'), [], 'Corte');
  linea(colorFlecha(tema, 'pase'), [14, 10], 'Pase');
  linea(colorFlecha(tema, 'defensa'), [0.1, 10], 'Mov. defensivo');
}

/** Lienzo con cabecera (título y paso), cancha y pie (leyenda). */
export class Lienzo {
  readonly canvas = document.createElement('canvas');
  readonly ctx: CanvasRenderingContext2D;
  private readonly altoCancha: number;
  private readonly cabecera: number;
  private readonly pie: number;
  private readonly escala: number;

  constructor(
    private readonly c: Contexto,
    pxPorMetro: number,
  ) {
    const r = regionVista(c.jugada.vista, c.jugada.lado, c.orientacion);
    // Medidas pares: los códecs de video lo exigen.
    const ancho = Math.round((r.w * pxPorMetro) / 2) * 2;
    this.altoCancha = Math.round((r.h * pxPorMetro) / 2) * 2;
    // Título y leyenda se escalan para leerse igual en vertical y horizontal.
    this.escala = Math.max(0.5, Math.min(1.2, ancho / 1600));
    this.cabecera = Math.round((96 * this.escala) / 2) * 2;
    this.pie = Math.round((64 * this.escala) / 2) * 2;
    this.canvas.width = ancho;
    this.canvas.height = this.cabecera + this.altoCancha + this.pie;
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('El navegador no permite dibujar la imagen.');
    this.ctx = ctx;
  }

  /** Dibuja un cuadro completo. `textoPaso` va a la derecha del título. */
  async dibujar(paso: Step, textoPaso: string, opacidadFlechas = 1) {
    const { ctx, canvas, escala } = this;
    const img = await cargarImagen(svgDePaso(paso, this.c, opacidadFlechas));
    ctx.fillStyle = this.c.tema.css.capa;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = this.c.tema.css['sobre-capa'];
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${40 * escala}px ${FUENTE}`;
    const margen = 28 * escala;
    ctx.textAlign = 'right';
    ctx.fillText(textoPaso, canvas.width - margen, this.cabecera / 2);
    const anchoPaso = ctx.measureText(textoPaso).width;
    ctx.textAlign = 'left';
    let titulo = this.c.jugada.nombre;
    while (titulo.length > 3 && ctx.measureText(titulo).width > canvas.width - anchoPaso - margen * 3) titulo = `${titulo.slice(0, -2)}…`;
    ctx.fillText(titulo, margen, this.cabecera / 2);

    ctx.drawImage(img, 0, this.cabecera, canvas.width, this.altoCancha);
    leyenda(ctx, margen, this.cabecera + this.altoCancha + this.pie / 2, this.c.tema, escala);
  }
}

export const textoDePaso = (i: number, total: number) => `Paso ${i + 1} de ${total}`;

/** PNG del paso con título arriba y leyenda abajo, listo para WhatsApp (≈ 2080 px de ancho). */
export async function pngDePaso(c: Contexto, indice: number): Promise<Blob> {
  const lienzo = new Lienzo(c, 20);
  await lienzo.dibujar(c.jugada.pasos[indice], textoDePaso(indice, c.jugada.pasos.length));
  return new Promise((resolver, rechazar) =>
    lienzo.canvas.toBlob((b) => (b ? resolver(b) : rechazar(new Error('No se pudo crear la imagen.'))), 'image/png'),
  );
}
