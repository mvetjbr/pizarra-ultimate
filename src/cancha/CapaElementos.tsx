import type { Player, Step } from '../modelo/tipos';
import { buscarJugador, controlDe, extremos, posDisco } from '../modelo/geometria';
import type { Seleccion } from '../estado/editorStore';
import { JugadorSVG } from './JugadorSVG';
import { DiscoSVG } from './DiscoSVG';
import { FlechaSVG } from './FlechaSVG';
import { TextoSVG, ZonaSVG } from './ZonaTextoSVG';

interface Props {
  paso: Step;
  rot?: string;
  colorAtaque: string;
  colorDefensa: string;
  mostrarMatch: boolean;
  seleccion?: Seleccion | null;
  /** Radio táctil en metros; si falta, la capa es solo de lectura (miniaturas, presentación). */
  radioToque?: number;
  /** Opacidad de las flechas (se desvanecen durante la animación). */
  opacidadFlechas?: number;
  /** Nombre a mostrar debajo de cada ficha (roster). */
  nombreDe?: (j: Player) => string | undefined;
}

/** Dibuja todos los elementos de un paso. Reutilizable en editor, miniaturas y presentación. */
export function CapaElementos({ paso, rot, colorAtaque, colorDefensa, mostrarMatch, seleccion, radioToque, opacidadFlechas, nombreDe }: Props) {
  const es = (tipo: string, id: string) => seleccion?.tipo === tipo && seleccion.id === id;
  const interactivo = radioToque !== undefined;
  const color = (equipo?: string) => (equipo === 'defensa' ? colorDefensa : colorAtaque);
  return (
    <g pointerEvents={interactivo ? undefined : 'none'}>
      <g>
        {paso.zonas.map((z) => (
          <ZonaSVG key={z.id} z={z} rot={rot} seleccionada={es('zona', z.id)} />
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
              colorCorte={color(buscarJugador(paso, f.desdeId)?.equipo)}
              seleccionada={es('flecha', f.id)}
              anchoToque={radioToque ? radioToque * 1.1 : undefined}
            />
          );
        })}
      </g>
      <g>
        {paso.textos.map((t) => (
          <TextoSVG key={t.id} t={t} rot={rot} seleccionado={es('texto', t.id)} interactivo={interactivo} />
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
                color={color(equipo)}
                rot={rot}
                mostrarMatch={mostrarMatch}
                seleccionado={es('jugador', j.id)}
                radioToque={radioToque}
                nombre={nombreDe?.(j)}
              />
            ))}
        </g>
      ))}
      <DiscoSVG
        p={posDisco(paso)}
        seleccionado={es('disco', 'disco')}
        radioToque={radioToque ? Math.max(0.8, radioToque * 0.7) : undefined}
      />
    </g>
  );
}
