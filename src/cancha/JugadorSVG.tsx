import type { Player } from '../modelo/tipos';
import { RADIO_DEFENSA, RADIO_JUGADOR } from '../modelo/geometria';
import { COLORES } from '../estilos/colores';
import type { EstiloJugador, FormaJugador } from '../temas';

interface Props {
  j: Player;
  /** Cómo se dibuja según el tema activo (forma y colores). */
  estilo: EstiloJugador;
  /** Color del halo de selección. */
  colorSeleccion: string;
  rot?: string;
  mostrarMatch: boolean;
  seleccionado: boolean;
  /** Radio del área táctil en metros (si no se pasa, el jugador no es interactivo). */
  radioToque?: number;
  /** Nombre corto que se escribe debajo de la ficha. */
  nombre?: string;
  /** Agranda la ficha en pantallas pequeñas (1 = tamaño real). */
  escala?: number;
}

const triangulo = (r: number) => `0,${-r} ${r * 0.866},${r * 0.5} ${-r * 0.866},${r * 0.5}`;
const esTriangulo = (f: FormaJugador) => f === 'triangulo' || f === 'triangulo-redondeado';

/** Radio exterior de la forma (para el halo de selección y la posición de la insignia M/F). */
export const radioForma = (e: EstiloJugador) => (esTriangulo(e.forma) ? RADIO_DEFENSA : RADIO_JUGADOR) * (e.escala ?? 1);

/** La forma sola (también la usan la leyenda y las miniaturas de la ventana Estilos). */
export function FormaJugadorSVG({ estilo: e, etiqueta }: { estilo: EstiloJugador; etiqueta?: string }) {
  const k = e.escala ?? 1;
  const tam = !etiqueta ? 1 : etiqueta.length > 2 ? 0.72 : etiqueta.length > 1 ? 0.85 : 1;
  const texto = etiqueta && (
    <text
      className="etiqueta-jugador"
      y={esTriangulo(e.forma) ? 0.22 * k : 0}
      fontSize={tam * (esTriangulo(e.forma) ? 0.85 : 1) * k}
      fill={e.texto}
    >
      {etiqueta}
    </text>
  );
  if (esTriangulo(e.forma)) {
    // Triángulo redondeado: el borde grueso con uniones redondas, pintado por fuera del relleno.
    const redondo = e.forma === 'triangulo-redondeado';
    return (
      <>
        <polygon
          points={triangulo(RADIO_DEFENSA * k)}
          fill={e.relleno}
          stroke={e.borde}
          strokeWidth={e.anchoBorde}
          strokeLinejoin="round"
          paintOrder={redondo ? 'stroke' : undefined}
        />
        {texto}
      </>
    );
  }
  const R = RADIO_JUGADOR * k;
  return (
    <>
      {e.brillo && <circle r={R * 1.55} fill={e.brillo} opacity={0.28} />}
      {e.anillo && <circle r={R + 0.32} fill="none" stroke={e.anillo} strokeWidth={0.22} />}
      <circle r={R} fill={e.relleno} stroke={e.borde} strokeWidth={e.anchoBorde} />
      {texto}
    </>
  );
}

export function JugadorSVG({ j, estilo, colorSeleccion, rot, mostrarMatch, seleccionado, radioToque, nombre, escala = 1 }: Props) {
  const R = radioForma(estilo);
  const tri = esTriangulo(estilo.forma);
  return (
    <g transform={`translate(${j.x} ${j.y})`} data-tipo="jugador" data-id={j.id} className="elemento">
      {radioToque && <circle r={radioToque} fill="transparent" />}
      {seleccionado && <circle r={R * escala + 0.45} fill="none" stroke={colorSeleccion} strokeWidth={0.25} />}
      <g transform={escala !== 1 ? `${rot ?? ''} scale(${escala})` : rot}>
        <FormaJugadorSVG estilo={estilo} etiqueta={j.etiqueta} />
        {nombre && (
          <text className="texto-cancha" y={(tri ? R * 0.5 : R) + 0.85} fontSize={0.8}>
            {nombre}
          </text>
        )}
        {mostrarMatch && j.match && (
          <g transform={`translate(${tri ? R * 0.72 : R * 0.77} ${tri ? -R * 0.66 : -R * 0.77})`}>
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
