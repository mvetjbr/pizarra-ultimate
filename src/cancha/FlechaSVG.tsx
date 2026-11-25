import type { Punto, TipoFlecha } from '../modelo/tipos';
import { avanzar, distancia, RADIO_JUGADOR } from '../modelo/geometria';
import type { Tema } from '../temas';

interface Props {
  id?: string;
  tipo: TipoFlecha;
  a: Punto;
  b: Punto;
  c: Punto | null;
  ancladoA?: boolean;
  ancladoB?: boolean;
  /** Tema activo (colores de cada tipo de flecha y de la selección). */
  tema: Tema;
  /** Equipo del jugador que corre (el corte toma su color). */
  equipoCorte?: 'ataque' | 'defensa';
  seleccionada?: boolean;
  /** Grosor del área táctil en metros. */
  anchoToque?: number;
}

export const ESTILO_FLECHA = {
  corte: { ancho: 0.3, guiones: undefined, extremo: 'butt' },
  pase: { ancho: 0.28, guiones: '1.1 0.8', extremo: 'butt' },
  defensa: { ancho: 0.34, guiones: '0.01 0.6', extremo: 'round' },
} as const;

/** Calcula el trazo visible (recortado en los jugadores) y la punta. */
export function geometriaFlecha(a: Punto, b: Punto, c: Punto | null, ancladoA = false, ancladoB = false) {
  const R = RADIO_JUGADOR + 0.25;
  const largo = distancia(a, b);
  const recortar = largo > R * 2.5;
  const a2 = ancladoA && recortar ? avanzar(a, c ?? b, R) : a;
  const b2 = ancladoB && recortar ? avanzar(b, c ?? a, R) : b;
  const origenDir = c ?? a2;
  const L = distancia(origenDir, b2) || 1;
  const dir = { x: (b2.x - origenDir.x) / L, y: (b2.y - origenDir.y) / L };
  const perp = { x: -dir.y, y: dir.x };
  const cabeza = Math.min(1.2, Math.max(0.6, largo * 0.3));
  const base = { x: b2.x - dir.x * cabeza, y: b2.y - dir.y * cabeza };
  const fin = { x: b2.x - dir.x * cabeza * 0.6, y: b2.y - dir.y * cabeza * 0.6 };
  const d = c ? `M${a2.x} ${a2.y} Q${c.x} ${c.y} ${fin.x} ${fin.y}` : `M${a2.x} ${a2.y} L${fin.x} ${fin.y}`;
  const ancho = cabeza * 0.5;
  const punta = `${b2.x},${b2.y} ${base.x + perp.x * ancho},${base.y + perp.y * ancho} ${base.x - perp.x * ancho},${base.y - perp.y * ancho}`;
  return { d, punta, a2, b2 };
}

/** Color de una flecha según el tema. */
export const colorFlecha = (tema: Tema, tipo: TipoFlecha, equipoCorte: 'ataque' | 'defensa' = 'ataque') =>
  tipo === 'corte'
    ? equipoCorte === 'defensa'
      ? tema.flechas.corteDefensa
      : tema.flechas.corteAtaque
    : tipo === 'pase'
      ? tema.flechas.pase
      : tema.flechas.defensa;

export function FlechaSVG({ id, tipo, a, b, c, ancladoA, ancladoB, tema, equipoCorte, seleccionada, anchoToque }: Props) {
  const { d, punta } = geometriaFlecha(a, b, c, ancladoA, ancladoB);
  const estilo = ESTILO_FLECHA[tipo];
  const color = colorFlecha(tema, tipo, equipoCorte);
  return (
    <g data-tipo={id ? 'flecha' : undefined} data-id={id} className="elemento">
      {seleccionada && (
        <path d={d} fill="none" stroke={tema.seleccion} strokeOpacity={0.55} strokeWidth={estilo.ancho + 0.7} strokeLinecap="round" />
      )}
      {anchoToque && <path d={d} fill="none" stroke="transparent" strokeWidth={anchoToque} pointerEvents="stroke" />}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={estilo.ancho}
        strokeDasharray={estilo.guiones}
        strokeLinecap={estilo.extremo}
      />
      <polygon points={punta} fill={color} />
    </g>
  );
}
