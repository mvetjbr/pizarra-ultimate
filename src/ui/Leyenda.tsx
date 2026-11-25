import { useState } from 'react';
import { usePreferencias } from '../estado/preferencias';
import { PANTALLA_ANGOSTA } from '../estado/pantalla';
import { useEditor } from '../estado/editorStore';
import { colorFlecha, ESTILO_FLECHA } from '../cancha/FlechaSVG';
import { FormaJugadorSVG } from '../cancha/JugadorSVG';
import { useTema, type EstiloJugador } from '../temas';
import { HERRAMIENTAS } from './BarraHerramientas';

function Linea({ color, tipo, fondo }: { color: string; tipo: keyof typeof ESTILO_FLECHA; fondo: string }) {
  const e = ESTILO_FLECHA[tipo];
  return (
    <svg viewBox="-0.4 -0.4 8.8 2.8" width="40" height="13" aria-hidden="true">
      <rect x="-0.4" y="-0.4" width="8.8" height="2.8" rx="0.5" fill={fondo} />
      <path d="M0 1H6" stroke={color} strokeWidth={e.ancho} strokeDasharray={e.guiones} strokeLinecap={e.extremo} />
      <polygon points="8,1 6.2,0.3 6.2,1.7" fill={color} />
    </svg>
  );
}

/** La forma real del jugador en el tema, sobre un cuadrito del color de la cancha. */
function Muestra({ estilo, cesped }: { estilo: EstiloJugador; cesped: string }) {
  return (
    <svg viewBox="-2 -2 4 4" width="18" height="18" aria-hidden="true" className="muestra-leyenda">
      <rect x="-2" y="-2" width="4" height="4" rx="0.8" fill={cesped} />
      <FormaJugadorSVG estilo={estilo} />
    </svg>
  );
}

/** `plegable`: en el editor se puede cerrar; en el celular empieza cerrada para no tapar la cancha. */
export function Leyenda({ plegable = false }: { plegable?: boolean }) {
  const prefs = usePreferencias();
  const tema = useTema((s) => s.tema);
  const [abierta, setAbierta] = useState(() => !plegable || !window.matchMedia?.(PANTALLA_ANGOSTA).matches);
  if (!prefs.mostrarLeyenda) return null;
  if (!abierta) {
    return (
      <button className="leyenda leyenda-cerrada" onClick={() => setAbierta(true)} aria-expanded="false" aria-label="Mostrar leyenda">
        <Muestra estilo={tema.ataque} cesped={tema.cancha.cesped} />
        Leyenda
      </button>
    );
  }
  return (
    <div className={`leyenda${plegable ? ' plegable' : ''}`} aria-label="Leyenda">
      {plegable && (
        <button className="leyenda-cerrar" onClick={() => setAbierta(false)} aria-expanded="true" aria-label="Ocultar leyenda">
          ×
        </button>
      )}
      <div>
        <Muestra estilo={tema.ataque} cesped={tema.cancha.cesped} />
        Ataque
      </div>
      <div>
        <Muestra estilo={tema.defensa} cesped={tema.cancha.cesped} />
        Defensa
      </div>
      <div>
        <Linea color={colorFlecha(tema, 'corte')} tipo="corte" fondo={tema.cancha.cesped} /> Corte
      </div>
      <div>
        <Linea color={colorFlecha(tema, 'pase')} tipo="pase" fondo={tema.cancha.cesped} /> Pase
      </div>
      <div>
        <Linea color={colorFlecha(tema, 'defensa')} tipo="defensa" fondo={tema.cancha.cesped} /> Mov. defensivo
      </div>
    </div>
  );
}

export function Ayuda() {
  const h = useEditor((s) => s.herramienta);
  const sel = useEditor((s) => s.seleccion);
  // En Seleccionar no hace falta ayuda y así no tapa la cancha.
  if (sel || h === 'seleccionar') return null;
  const info = HERRAMIENTAS.find((x) => x.id === h);
  return <div className="ayuda">{info?.ayuda}</div>;
}
