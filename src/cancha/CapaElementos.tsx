import type { Player, Step } from '../modelo/tipos';
import { buscarJugador, controlDe, extremos, posDisco } from '../modelo/geometria';
import type { Seleccion } from '../estado/editorStore';
import type { Tema } from '../temas';
import { JugadorSVG } from './JugadorSVG';
import { DiscoSVG } from './DiscoSVG';
import { FlechaSVG } from './FlechaSVG';
import { TextoSVG, ZonaSVG } from './ZonaTextoSVG';

interface Props {
  paso: Step;
  rot?: string;
  /** Tema activo: forma y colores de jugadores, flechas y disco. */
  tema: Tema;
  mostrarMatch: boolean;
  seleccion?: Seleccion | null;
  /** Radio táctil en metros; si falta, la capa es solo de lectura (miniaturas, presentación). */
  radioToque?: number;
  /** Cuánto se agrandan las fichas de jugadores en pantalla (1 = tamaño real). */
  escalaFichas?: number;
  /** Opacidad de las flechas (se desvanecen durante la animación). */
  opacidadFlechas?: number;
  /** Nombre a mostrar debajo de cada ficha (roster). */
  nombreDe?: (j: Player) => string | undefined;
}

/** Dibuja todos los elementos de un paso. Reutilizable en editor, miniaturas y presentación. */
export function CapaElementos({ paso, rot, tema, mostrarMatch, seleccion, radioToque, escalaFichas, opacidadFlechas, nombreDe }: Props) {
  const es = (tipo: string, id: string) => seleccion?.tipo === tipo && seleccion.id === id;
  const interactivo = radioToque !== undefined;
  return (
    <g pointerEvents={interactivo ? undefined : 'none'}>
      <g>
        {paso.zonas.map((z) => (
          <ZonaSVG key={z.id} z={z} rot={rot} seleccionada={es('zona', z.id)} colorSeleccion={tema.seleccion} />
        ))}
      </g>
      <g opacity={opacidadFlechas}>
        {paso.flechas.map((f) => {
          const { a, b, ancladoA, ancladoB } = extremos(paso, f);
          return (
            <FlechaSVG
              key={f.id}
              id={f.id}
              tipo={f.tipo}
              a={a}
              b={b}
              c={controlDe(f, a, b)}
              ancladoA={ancladoA}
              ancladoB={ancladoB}
              tema={tema}
              equipoCorte={buscarJugador(paso, f.desdeId)?.equipo === 'defensa' ? 'defensa' : 'ataque'}
              seleccionada={es('flecha', f.id)}
              anchoToque={radioToque ? radioToque * 1.1 : undefined}
            />
          );
        })}
      </g>
      <g>
        {paso.textos.map((t) => (
          <TextoSVG key={t.id} t={t} rot={rot} seleccionado={es('texto', t.id)} interactivo={interactivo} colorSeleccion={tema.seleccion} />
        ))}
      </g>
      {(['defensa', 'ataque'] as const).map((equipo) => (
        <g key={equipo}>
          {paso.jugadores
            .filter((j) => j.equipo === equipo)
            .map((j) => (
              <JugadorSVG
                key={j.id}
                j={j}
                estilo={equipo === 'defensa' ? tema.defensa : tema.ataque}
                colorSeleccion={tema.seleccion}
                rot={rot}
                mostrarMatch={mostrarMatch}
                seleccionado={es('jugador', j.id)}
                radioToque={radioToque}
                escala={escalaFichas}
                nombre={nombreDe?.(j)}
              />
            ))}
        </g>
      ))}
      <DiscoSVG
        p={posDisco(paso)}
        tema={tema}
        seleccionado={es('disco', 'disco')}
        radioToque={radioToque ? Math.max(0.8, radioToque * 0.7) : undefined}
      />
    </g>
  );
}
