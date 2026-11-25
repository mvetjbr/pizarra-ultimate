import { TEMAS, elegirTema, useTema, type Tema } from '../temas';
import { FormaJugadorSVG } from '../cancha/JugadorSVG';
import { Dialogo } from './Dialogo';

/** Miniatura real del tema: fondo, un trozo de cancha, un atacante y un defensor con sus colores y formas. */
function Miniatura({ t }: { t: Tema }) {
  const c = t.cancha;
  return (
    <svg viewBox="0 0 40 22" className="miniatura-tema" aria-hidden="true">
      <rect width="40" height="22" fill={t.css.fondo} />
      <rect x="3" y="3" width="34" height="16" rx={c.radio ? 2 : 0} fill={c.cesped} />
      <rect x="3" y="3" width="8" height="16" fill={c.zonaRayas ? c.zonaRayas[0] : c.zona} />
      <rect
        x="3"
        y="3"
        width="34"
        height="16"
        rx={c.radio ? 2 : 0}
        fill="none"
        stroke={c.borde?.color ?? c.lineas}
        strokeWidth="0.5"
      />
      <line x1="11" y1="3" x2="11" y2="19" stroke={c.lineaGol?.color ?? c.lineas} strokeWidth="0.5" />
      <g transform="translate(19 11) scale(1.6)">
        <FormaJugadorSVG estilo={t.ataque} etiqueta="1" />
      </g>
      <g transform="translate(28 11) scale(1.6)">
        <FormaJugadorSVG estilo={t.defensa} etiqueta="1" />
      </g>
    </svg>
  );
}

/** Pestaña "Estilos": una tarjeta por tema; al tocar una se aplica al instante y queda guardada. */
export function Estilos({ alCerrar }: { alCerrar: () => void }) {
  const activo = useTema((s) => s.tema.id);
  return (
    <Dialogo
      titulo="Estilos"
      alCerrar={alCerrar}
      pie={
        <button className="boton-texto primario" onClick={alCerrar}>
          Listo
        </button>
      }
    >
      <p className="nota">Cambia solo cómo se ve la app en este dispositivo. Tus jugadas no cambian.</p>
      <div className="lista-temas" role="radiogroup" aria-label="Estilo visual">
        {TEMAS.map((t) => (
          <button
            key={t.id}
            role="radio"
            aria-checked={activo === t.id}
            aria-label={`Estilo ${t.nombre}: ${t.frase}${activo === t.id ? ' (activo)' : ''}`}
            className={`tarjeta-tema${activo === t.id ? ' activa' : ''}`}
            onClick={() => elegirTema(t.id)}
          >
            <Miniatura t={t} />
            <span className="tarjeta-tema-texto">
              <strong>{t.nombre}</strong>
              <small>{t.frase}</small>
            </span>
            {activo === t.id && <span className="tarjeta-tema-marca">✓ Activo</span>}
          </button>
        ))}
      </div>
    </Dialogo>
  );
}
