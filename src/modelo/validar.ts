import type { Arrow, Categoria, Label, Play, Player, Punto, Step, Zone } from './tipos';
import { CATEGORIAS } from './tipos';
import { nuevoId } from './fabrica';

// Validación de datos que vienen de afuera (archivos JSON, enlaces compartidos).
// Nunca se confía en su forma: se reconstruye cada campo con valores por defecto.

type Obj = Record<string, unknown>;
const esObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown, def = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : def);
const coord = (v: unknown) => Math.max(-50, Math.min(150, num(v)));
const txt = (v: unknown, max: number, def = '') => (typeof v === 'string' ? v.slice(0, max) : def);
const idDe = (v: unknown) => (typeof v === 'string' && v.length > 0 && v.length <= 40 ? v : nuevoId());
const COLOR = /^#[0-9a-f]{3,8}$/i;
const lista = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : []);
function unoDe<T extends string>(v: unknown, opciones: readonly T[], def: T): T {
  return opciones.includes(v as T) ? (v as T) : def;
}

function punto(v: unknown): Punto {
  const o = esObj(v) ? v : {};
  return { x: coord(o.x), y: coord(o.y) };
}

function jugador(v: unknown): Player | null {
  if (!esObj(v)) return null;
  const match = v.match === 'M' || v.match === 'F' ? v.match : undefined;
  return {
    id: idDe(v.id),
    equipo: unoDe(v.equipo, ['ataque', 'defensa'] as const, 'ataque'),
    etiqueta: txt(v.etiqueta, 3),
    match,
    rosterId: typeof v.rosterId === 'string' ? v.rosterId.slice(0, 40) : undefined,
    nombre: txt(v.nombre, 40) || undefined,
    ...punto(v),
  };
}

function flecha(v: unknown): Arrow | null {
  if (!esObj(v)) return null;
  return {
    id: idDe(v.id),
    tipo: unoDe(v.tipo, ['corte', 'pase', 'defensa'] as const, 'corte'),
    desde: punto(v.desde),
    hasta: punto(v.hasta),
    desdeId: typeof v.desdeId === 'string' ? v.desdeId : undefined,
    hastaId: typeof v.hastaId === 'string' ? v.hastaId : undefined,
    curva: v.curva === true,
    control: esObj(v.control) ? punto(v.control) : undefined,
  };
}

function zona(v: unknown): Zone | null {
  if (!esObj(v)) return null;
  return {
    id: idDe(v.id),
    forma: unoDe(v.forma, ['rect', 'elipse'] as const, 'rect'),
    x: coord(v.x),
    y: coord(v.y),
    ancho: Math.max(0.5, Math.min(110, num(v.ancho, 5))),
    alto: Math.max(0.5, Math.min(50, num(v.alto, 5))),
    color: typeof v.color === 'string' && COLOR.test(v.color) ? v.color : '#FFE066',
    texto: txt(v.texto, 60) || undefined,
  };
}

function texto(v: unknown): Label | null {
  if (!esObj(v)) return null;
  return { id: idDe(v.id), texto: txt(v.texto, 200), ...punto(v) };
}

const sinNulos = <T,>(xs: (T | null)[]) => xs.filter((x): x is T => x !== null);

function paso(v: unknown): Step | null {
  if (!esObj(v)) return null;
  const jugadores = sinNulos(lista(v.jugadores, 30).map(jugador));
  const ids = new Set(jugadores.map((j) => j.id));
  const d = esObj(v.disco) ? v.disco : {};
  const poseedorId = typeof d.poseedorId === 'string' && ids.has(d.poseedorId) ? d.poseedorId : undefined;
  return {
    id: idDe(v.id),
    jugadores,
    disco: { ...punto(d), poseedorId },
    flechas: sinNulos(lista(v.flechas, 60).map(flecha)),
    zonas: sinNulos(lista(v.zonas, 30).map(zona)),
    textos: sinNulos(lista(v.textos, 30).map(texto)),
  };
}

export function normalizarJugada(v: unknown): Play | null {
  if (!esObj(v)) return null;
  const pasos = sinNulos(lista(v.pasos, 100).map(paso));
  if (pasos.length === 0) return null;
  const ahora = Date.now();
  return {
    id: idDe(v.id),
    nombre: txt(v.nombre, 80).trim() || 'Jugada sin nombre',
    categoria: unoDe<Categoria>(v.categoria, CATEGORIAS, 'Otro'),
    etiquetas: lista(v.etiquetas, 20)
      .filter((e): e is string => typeof e === 'string')
      .map((e) => e.slice(0, 30)),
    notas: txt(v.notas, 5000),
    creada: num(v.creada, ahora),
    editada: num(v.editada, ahora),
    vista: unoDe(v.vista, ['completa', 'media', 'zona'] as const, 'completa'),
    lado: unoDe(v.lado, ['izquierda', 'derecha'] as const, 'derecha'),
    orientacion: unoDe(v.orientacion, ['horizontal', 'vertical'] as const, 'horizontal'),
    pasos,
  };
}
