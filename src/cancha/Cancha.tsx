import { memo } from 'react';
import { BRICKS, CANCHA } from '../modelo/cancha';
import { COLORES } from '../estilos/colores';

// vector-effect no se hereda, por eso se pone en cada trazo: el grosor queda en píxeles.
const NS = { vectorEffect: 'non-scaling-stroke' } as const;

/** Césped, zonas de anotación, líneas, bricks y cuadrícula opcional (todo en metros). */
export const Cancha = memo(function Cancha({ cuadricula }: { cuadricula: boolean }) {
  const { largo, ancho, zona } = CANCHA;
  const lineasX: number[] = [];
  const lineasY: number[] = [];
  if (cuadricula) {
    for (let x = 5; x < largo; x += 5) lineasX.push(x);
    for (let y = 5; y < ancho; y += 5) lineasY.push(y);
  }
  return (
    <g pointerEvents="none">
      <rect x={0} y={0} width={largo} height={ancho} fill={COLORES.cesped} />
      <rect x={0} y={0} width={zona} height={ancho} fill={COLORES.zonaAnotacion} />
      <rect x={largo - zona} y={0} width={zona} height={ancho} fill={COLORES.zonaAnotacion} />
      {cuadricula && (
        <g stroke="#FFFFFF" strokeOpacity={0.2} strokeWidth={1}>
          {lineasX.map((x) => (
            <line key={`x${x}`} x1={x} y1={0} x2={x} y2={ancho} {...NS} />
          ))}
          {lineasY.map((y) => (
            <line key={`y${y}`} x1={0} y1={y} x2={largo} y2={y} {...NS} />
          ))}
        </g>
      )}
      <g stroke={COLORES.lineas} strokeWidth={2} fill="none">
        <rect x={0} y={0} width={largo} height={ancho} {...NS} />
        <line x1={zona} y1={0} x2={zona} y2={ancho} {...NS} />
        <line x1={largo - zona} y1={0} x2={largo - zona} y2={ancho} {...NS} />
        {BRICKS.map((b) => (
          <g key={b.x}>
            <line x1={b.x - 0.6} y1={b.y - 0.6} x2={b.x + 0.6} y2={b.y + 0.6} {...NS} />
            <line x1={b.x - 0.6} y1={b.y + 0.6} x2={b.x + 0.6} y2={b.y - 0.6} {...NS} />
          </g>
        ))}
      </g>
    </g>
  );
});
