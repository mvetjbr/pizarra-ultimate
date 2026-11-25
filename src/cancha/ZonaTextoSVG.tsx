import type { Label, Zone } from '../modelo/tipos';

export function ZonaSVG({ z, rot, seleccionada, colorSeleccion }: { z: Zone; rot?: string; seleccionada: boolean; colorSeleccion: string }) {
  const comun = {
    fill: z.color,
    fillOpacity: 0.28,
    stroke: seleccionada ? colorSeleccion : z.color,
    strokeWidth: seleccionada ? 0.3 : 0.18,
    strokeDasharray: seleccionada ? undefined : '0.7 0.4',
  };
  return (
    <g data-tipo="zona" data-id={z.id} className="elemento">
      {z.forma === 'elipse' ? (
        <ellipse cx={z.x + z.ancho / 2} cy={z.y + z.alto / 2} rx={z.ancho / 2} ry={z.alto / 2} {...comun} />
      ) : (
        <rect x={z.x} y={z.y} width={z.ancho} height={z.alto} rx={0.4} {...comun} />
      )}
      {z.texto && (
        <g transform={`translate(${z.x + z.ancho / 2} ${z.y + z.alto / 2})`}>
          <g transform={rot}>
            <text className="texto-cancha" fontSize={1.1}>
              {z.texto}
            </text>
          </g>
        </g>
      )}
    </g>
  );
}

const TAM_TEXTO = 1.3;

export function TextoSVG({
  t,
  rot,
  seleccionado,
  interactivo,
  colorSeleccion,
}: {
  t: Label;
  rot?: string;
  seleccionado: boolean;
  interactivo: boolean;
  colorSeleccion: string;
}) {
  const lineas = (t.texto || ' ').split('\n');
  const maxLargo = Math.max(...lineas.map((l) => l.length), 2);
  const ancho = maxLargo * TAM_TEXTO * 0.6 + 1;
  const alto = lineas.length * TAM_TEXTO * 1.2 + 0.6;
  return (
    <g transform={`translate(${t.x} ${t.y})`} data-tipo="texto" data-id={t.id} className="elemento">
      <g transform={rot}>
        {(interactivo || seleccionado) && (
          <rect
            x={-ancho / 2}
            y={-alto / 2}
            width={ancho}
            height={alto}
            rx={0.4}
            fill="transparent"
            stroke={seleccionado ? colorSeleccion : 'none'}
            strokeWidth={0.2}
          />
        )}
        <text className="texto-cancha" fontSize={TAM_TEXTO} y={(-(lineas.length - 1) * TAM_TEXTO * 1.2) / 2}>
          {lineas.map((l, i) => (
            <tspan key={i} x={0} dy={i === 0 ? 0 : TAM_TEXTO * 1.2}>
              {l}
            </tspan>
          ))}
        </text>
      </g>
    </g>
  );
}
