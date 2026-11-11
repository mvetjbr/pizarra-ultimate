import type { Player } from '../modelo/tipos';
import { RADIO_DEFENSA, RADIO_JUGADOR } from '../modelo/geometria';
import { COLORES, luminancia, textoSobre } from '../estilos/colores';

interface Props {
  j: Player;
  color: string;
  rot?: string;
  mostrarMatch: boolean;
  seleccionado: boolean;
  /** Radio del área táctil en metros (si no se pasa, el jugador no es interactivo). */
  radioToque?: number;
  /** Nombre corto que se escribe debajo de la ficha. */
  nombre?: string;
}

const r = RADIO_DEFENSA;
const TRIANGULO = `0,${-r} ${r * 0.866},${r * 0.5} ${-r * 0.866},${r * 0.5}`;

export function JugadorSVG({ j, color, rot, mostrarMatch, seleccionado, radioToque, nombre }: Props) {
  const tam = j.etiqueta.length > 2 ? 0.72 : j.etiqueta.length > 1 ? 0.85 : 1;
  const esAtaque = j.equipo === 'ataque';
  return (
    <g transform={`translate(${j.x} ${j.y})`} data-tipo="jugador" data-id={j.id} className="elemento">
      {radioToque && <circle r={radioToque} fill="transparent" />}
      {seleccionado && (
        <circle r={(esAtaque ? RADIO_JUGADOR : RADIO_DEFENSA) + 0.45} fill="none" stroke={COLORES.seleccion} strokeWidth={0.25} />
      )}
      <g transform={rot}>
        {esAtaque ? (
          <>
            <circle r={RADIO_JUGADOR} fill={color} stroke="#FFFFFF" strokeWidth={0.18} />
            <text className="etiqueta-jugador" fontSize={tam} fill={textoSobre(color)}>
              {j.etiqueta}
            </text>
          </>
        ) : (
          <>
            <polygon points={TRIANGULO} fill="#FFFFFF" stroke={color} strokeWidth={0.32} strokeLinejoin="round" />
            <text className="etiqueta-jugador" y={0.22} fontSize={tam * 0.85} fill={luminancia(color) > 0.35 ? '#111111' : color}>
              {j.etiqueta}
            </text>
          </>
        )}
        {nombre && (
          <text className="texto-cancha" y={(esAtaque ? RADIO_JUGADOR : RADIO_DEFENSA * 0.5) + 0.85} fontSize={0.8}>
            {nombre}
          </text>
        )}
        {mostrarMatch && j.match && (
          <g transform={`translate(${esAtaque ? 0.85 : 1.05} ${esAtaque ? -0.85 : -0.95})`}>
            <circle r={0.48} fill={j.match === 'M' ? COLORES.matchM : COLORES.matchF} stroke="#FFFFFF" strokeWidth={0.08} />
            <text className="etiqueta-jugador" fontSize={0.58} fill="#FFFFFF">
              {j.match}
            </text>
          </g>
        )}
      </g>
    </g>
  );
}
