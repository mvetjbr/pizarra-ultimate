import { memo } from 'react';
import { BRICKS, CANCHA } from '../modelo/cancha';
import type { Tema } from '../temas';

// vector-effect no se hereda, por eso se pone en cada trazo: el grosor queda en píxeles.
const NS = { vectorEffect: 'non-scaling-stroke' } as const;

/** Césped, zonas de anotación, líneas, bricks y cuadrícula opcional (todo en metros), según el tema. */
export const Cancha = memo(function Cancha({ cuadricula, tema }: { cuadricula: boolean; tema: Tema }) {
  const { largo, ancho, zona } = CANCHA;
  const c = tema.cancha;
  const id = `cancha-${tema.id}`;
  const lineasX: number[] = [];
  const lineasY: number[] = [];
  if (cuadricula) {
    for (let x = 5; x < largo; x += 5) lineasX.push(x);
    for (let y = 5; y < ancho; y += 5) lineasY.push(y);
  }
  const rellenoZona = c.zonaRayas ? `url(#${id}-rayas)` : c.zona;
  const brillo = c.borde?.brillo || c.lineaGol?.brillo;
  return (
    <g pointerEvents="none">
      <defs>
        {c.zonaRayas && (
          <pattern id={`${id}-rayas`} width="1.6" height="1.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="1.6" height="1.6" fill={c.zonaRayas[1]} />
            <rect width="0.8" height="1.6" fill={c.zonaRayas[0]} />
          </pattern>
        )}
        {c.radio && (
          <clipPath id={`${id}-recorte`}>
            <rect x={0} y={0} width={largo} height={ancho} rx={c.radio} />
          </clipPath>
        )}
        {brillo && (
          <filter id={`${id}-brillo`} x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="0.45" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>
      <g clipPath={c.radio ? `url(#${id}-recorte)` : undefined}>
        <rect x={0} y={0} width={largo} height={ancho} fill={c.cesped} />
        <rect x={0} y={0} width={zona} height={ancho} fill={rellenoZona} />
        <rect x={largo - zona} y={0} width={zona} height={ancho} fill={rellenoZona} />
      </g>
      {cuadricula && (
        <g stroke={c.cuadricula} strokeOpacity={0.2} strokeWidth={1}>
          {lineasX.map((x) => (
            <line key={`x${x}`} x1={x} y1={0} x2={x} y2={ancho} {...NS} />
          ))}
          {lineasY.map((y) => (
            <line key={`y${y}`} x1={0} y1={y} x2={largo} y2={y} {...NS} />
          ))}
        </g>
      )}
      <g stroke={c.lineas} strokeWidth={c.anchoLinea} fill="none">
        {!c.borde && <rect x={0} y={0} width={largo} height={ancho} rx={c.radio} {...NS} />}
        {!c.lineaGol && (
          <>
            <line x1={zona} y1={0} x2={zona} y2={ancho} {...NS} />
            <line x1={largo - zona} y1={0} x2={largo - zona} y2={ancho} {...NS} />
          </>
        )}
        {BRICKS.map((b) => (
          <g key={b.x}>
            <line x1={b.x - 0.6} y1={b.y - 0.6} x2={b.x + 0.6} y2={b.y + 0.6} {...NS} />
            <line x1={b.x - 0.6} y1={b.y + 0.6} x2={b.x + 0.6} y2={b.y - 0.6} {...NS} />
          </g>
        ))}
      </g>
      {c.lineaGol && (
        <g stroke={c.lineaGol.color} strokeWidth={c.anchoLinea} filter={c.lineaGol.brillo ? `url(#${id}-brillo)` : undefined}>
          <line x1={zona} y1={0} x2={zona} y2={ancho} {...NS} />
          <line x1={largo - zona} y1={0} x2={largo - zona} y2={ancho} {...NS} />
        </g>
      )}
      {c.borde && (
        <rect
          x={0}
          y={0}
          width={largo}
          height={ancho}
          rx={c.radio}
          fill="none"
          stroke={c.borde.color}
          strokeWidth={c.anchoLinea}
          filter={c.borde.brillo ? `url(#${id}-brillo)` : undefined}
          {...NS}
        />
      )}
    </g>
  );
});
