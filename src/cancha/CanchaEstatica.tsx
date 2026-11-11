import type { Lado, Orientacion, Player, Step, Vista } from '../modelo/tipos';
import { regionVista, rotacionTexto, transformacion } from '../modelo/cancha';
import { usePreferencias } from '../estado/preferencias';
import { nombreCorto, nombreDeJugador, useRoster, type MiembroRoster } from '../estado/rosterStore';
import { Cancha } from './Cancha';
import { CapaElementos } from './CapaElementos';

export interface PropsDibujo {
  paso: Step;
  vista: Vista;
  lado: Lado;
  orientacion: Orientacion;
  colorAtaque: string;
  colorDefensa: string;
  mostrarMatch: boolean;
  opacidadFlechas?: number;
  className?: string;
  /** Incluye estilos y fondo dentro del SVG para usarlo fuera de la app (PNG). */
  autonomo?: boolean;
  nombreDe?: (j: Player) => string | undefined;
}

const ESTILOS_AUTONOMOS = `
.etiqueta-jugador{text-anchor:middle;dominant-baseline:central;font-weight:700;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif}
.texto-cancha{text-anchor:middle;dominant-baseline:central;font-weight:600;fill:#fff;stroke:rgba(0,0,0,.6);stroke-width:.3px;paint-order:stroke;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif}
`;

/** Dibujo puro (sin hooks) de la cancha con un paso. */
export function DibujoCancha(p: PropsDibujo) {
  const r = regionVista(p.vista, p.lado, p.orientacion);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={p.className}
      viewBox={`${r.x} ${r.y} ${r.w} ${r.h}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      {p.autonomo && (
        <>
          <style>{ESTILOS_AUTONOMOS}</style>
          <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="#22592a" />
        </>
      )}
      <g transform={transformacion(p.orientacion)}>
        <Cancha cuadricula={false} />
        <CapaElementos
          paso={p.paso}
          rot={rotacionTexto(p.orientacion)}
          colorAtaque={p.colorAtaque}
          colorDefensa={p.colorDefensa}
          mostrarMatch={p.mostrarMatch}
          opacidadFlechas={p.opacidadFlechas}
          nombreDe={p.nombreDe}
        />
      </g>
    </svg>
  );
}

type PropsEstatica = Omit<PropsDibujo, 'colorAtaque' | 'colorDefensa' | 'mostrarMatch' | 'autonomo' | 'nombreDe'> & {
  /** Las miniaturas no muestran nombres (no se leerían). */
  sinNombres?: boolean;
};

/** Función de nombres según preferencias y roster. */
export function crearNombreDe(mostrar: boolean, miembros: MiembroRoster[]) {
  if (!mostrar) return undefined;
  return (j: Player) => {
    const n = nombreDeJugador(j, miembros);
    return n ? nombreCorto(n) : undefined;
  };
}

/** Cancha con un paso dibujado, sin interacción (miniaturas, presentación), con los colores del equipo. */
export function CanchaEstatica({ sinNombres, ...props }: PropsEstatica) {
  const prefs = usePreferencias();
  const miembros = useRoster((s) => s.miembros);
  return (
    <DibujoCancha
      {...props}
      colorAtaque={prefs.colorAtaque}
      colorDefensa={prefs.colorDefensa}
      mostrarMatch={prefs.mostrarMatch}
      nombreDe={crearNombreDe(prefs.mostrarNombres && !sinNombres, miembros)}
    />
  );
}
