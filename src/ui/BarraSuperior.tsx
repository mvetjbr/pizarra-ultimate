import { useRef } from 'react';
import type { Vista } from '../modelo/tipos';
import { pasoActivo, useEditor } from '../estado/editorStore';
import { usePreferencias } from '../estado/preferencias';
import { nuevaJugada } from '../estado/bibliotecaStore';
import { useVentana, type Ventana } from '../estado/ventanas';
import { esIOS, instalar, useInstalacion } from '../estado/instalacion';
import { avisar } from '../estado/avisos';
import { cortarAnimacion } from '../animacion/reproductor';
import {
  IconoBiblioteca,
  IconoCompartir,
  IconoCuadricula,
  IconoDeshacer,
  IconoMenu,
  IconoRehacer,
  IconoRotar,
} from './Iconos';
import { Biblioteca } from './Biblioteca';
import { DetallesJugada } from './DetallesJugada';
import { Compartir } from './Compartir';
import { Roster } from './Roster';
import { Jugadores } from './Jugadores';
import { AjustesConteo } from '../conteo/AjustesConteo';
import { proporcionValida } from '../estado/jugadores';

const VISTAS: { id: Vista; nombre: string }[] = [
  { id: 'completa', nombre: 'Completa' },
  { id: 'media', nombre: 'Media' },
  { id: 'zona', nombre: 'Zona' },
];

export function BarraSuperior() {
  const jugada = useEditor((s) => s.jugada);
  const paso = useEditor(pasoActivo);
  const puedeDeshacer = useEditor((s) => s.pasado.length > 0);
  const puedeRehacer = useEditor((s) => s.futuro.length > 0);
  const { deshacer, rehacer, cambiar } = useEditor.getState();
  const prefs = usePreferencias();
  const ventana = useVentana((s) => s.ventana);
  const cerrar = useVentana((s) => s.cerrar);
  const puedeInstalar = useInstalacion((s) => !!s.evento);
  const instalada = useInstalacion((s) => s.instalada);
  const menu = useRef<HTMLDetailsElement>(null);

  const ataque = paso.jugadores.filter((j) => j.equipo === 'ataque');
  const defensa = paso.jugadores.filter((j) => j.equipo === 'defensa');
  const m = ataque.filter((j) => j.match === 'M').length;
  const f = ataque.filter((j) => j.match === 'F').length;
  // En mixto la línea debe ser 4-3; con menos jugadores o sin género, ningún match pasa de 4.
  const proporcionRara = !proporcionValida(m, f, ataque.length - m - f);

  const cerrarMenu = () => menu.current?.removeAttribute('open');
  const abrir = (v: Ventana) => {
    cortarAnimacion();
    cerrarMenu();
    useVentana.getState().abrir(v);
  };

  return (
    <header className="barra-superior">
      <button
        className="boton-icono"
        onClick={() => abrir('biblioteca')}
        title="Biblioteca de jugadas y plantillas"
        aria-label="Biblioteca de jugadas y plantillas"
      >
        <IconoBiblioteca />
      </button>

      <input
        className="nombre-jugada"
        aria-label="Nombre de la jugada"
        value={jugada.nombre}
        onFocus={() => useEditor.getState().iniciarGesto()}
        onChange={(e) => {
          const v = e.target.value;
          useEditor.getState().moverGesto((j) => {
            j.nombre = v;
          });
        }}
        onBlur={() => useEditor.getState().terminarGesto()}
      />

      <div className="grupo">
        <button className="boton-icono" onClick={deshacer} disabled={!puedeDeshacer} title="Deshacer (Ctrl+Z)" aria-label="Deshacer">
          <IconoDeshacer />
        </button>
        <button className="boton-icono" onClick={rehacer} disabled={!puedeRehacer} title="Rehacer (Ctrl+Y)" aria-label="Rehacer">
          <IconoRehacer />
        </button>
      </div>

      <div className="segmentado" role="group" aria-label="Vista de la cancha">
        {VISTAS.map((v) => (
          <button
            key={v.id}
            aria-pressed={jugada.vista === v.id}
            onClick={() =>
              cambiar((j) => {
                j.vista = v.id;
              })
            }
          >
            {v.nombre}
          </button>
        ))}
      </div>
      {jugada.vista !== 'completa' && (
        <button
          className="boton-texto"
          title="Cambiar de lado"
          onClick={() =>
            cambiar((j) => {
              j.lado = j.lado === 'derecha' ? 'izquierda' : 'derecha';
            })
          }
        >
          {jugada.lado === 'derecha' ? 'Lado der. ⇄' : '⇄ Lado izq.'}
        </button>
      )}

      <div className="grupo">
        <button
          className="boton-icono"
          aria-pressed={jugada.orientacion === 'vertical'}
          title="Rotar cancha"
          aria-label="Rotar cancha"
          onClick={() =>
            cambiar((j) => {
              j.orientacion = j.orientacion === 'horizontal' ? 'vertical' : 'horizontal';
            })
          }
        >
          <IconoRotar />
        </button>
        <button
          className="boton-icono"
          aria-pressed={prefs.mostrarCuadricula}
          title="Cuadrícula cada 5 m"
          aria-label="Cuadrícula cada 5 metros"
          onClick={() => prefs.actualizar({ mostrarCuadricula: !prefs.mostrarCuadricula })}
        >
          <IconoCuadricula />
        </button>
      </div>

      <button
        className={`proporcion${proporcionRara ? ' alerta' : ''}`}
        title={
          proporcionRara
            ? 'En mixto la línea debe ser 4-3. Toca para abrir el roster.'
            : 'Proporción de match del ataque en cancha. Toca para abrir el roster.'
        }
        onClick={() => abrir('roster')}
      >
        {ataque.length > 0 && m + f === 0
          ? 'Sin género'
          : `${m}M-${f}F${ataque.length - m - f > 0 ? ` · ${ataque.length - m - f} s/g` : ''}`}
      </button>

      <button className="boton-texto primario" onClick={() => abrir('compartir')} title="Compartir y exportar">
        <IconoCompartir />
        <span className="ocultar-movil">Compartir</span>
      </button>

      <details className="menu" ref={menu}>
        <summary className="boton-icono" aria-label="Más opciones" title="Más opciones">
          <IconoMenu />
        </summary>
        <div className="menu-lista">
          <button onClick={() => abrir('detalles')}>Detalles y notas de la jugada…</button>
          <button onClick={() => abrir('roster')}>Roster del equipo…</button>
          <button
            onClick={() => {
              nuevaJugada();
              cerrarMenu();
            }}
          >
            Nueva jugada en blanco
          </button>
          <hr />
          <button onClick={() => abrir('conteo')}>Conteo de 10…</button>
          <button onClick={() => abrir('jugadores')}>
            Jugadores y proporción… ({ataque.length} vs {defensa.length})
          </button>
          <hr />
          <label className="menu-check">
            <input
              type="checkbox"
              checked={prefs.mostrarNombres}
              onChange={(e) => prefs.actualizar({ mostrarNombres: e.target.checked })}
            />
            Mostrar nombres del roster
          </label>
          <label className="menu-check">
            <input
              type="checkbox"
              checked={prefs.mostrarMatch}
              onChange={(e) => prefs.actualizar({ mostrarMatch: e.target.checked })}
            />
            Mostrar indicador M/F
          </label>
          <label className="menu-check">
            <input
              type="checkbox"
              checked={prefs.mostrarLeyenda}
              onChange={(e) => prefs.actualizar({ mostrarLeyenda: e.target.checked })}
            />
            Mostrar leyenda
          </label>
          <label className="menu-color">
            Color ataque
            <input type="color" value={prefs.colorAtaque} onChange={(e) => prefs.actualizar({ colorAtaque: e.target.value })} />
          </label>
          <label className="menu-color">
            Color defensa
            <input type="color" value={prefs.colorDefensa} onChange={(e) => prefs.actualizar({ colorDefensa: e.target.value })} />
          </label>
          {!instalada && (
            <>
              <hr />
              <button
                onClick={async () => {
                  cerrarMenu();
                  if (puedeInstalar) await instalar();
                  else if (esIOS()) avisar('En iPhone: toca Compartir ⬆️ y luego «Agregar a inicio».');
                  else avisar('Usa el menú del navegador: «Instalar app» o «Agregar a la pantalla principal».');
                }}
              >
                Instalar en este dispositivo
              </button>
            </>
          )}
        </div>
      </details>

      {ventana === 'biblioteca' && <Biblioteca alCerrar={cerrar} />}
      {ventana === 'detalles' && <DetallesJugada alCerrar={cerrar} />}
      {ventana === 'compartir' && <Compartir alCerrar={cerrar} />}
      {ventana === 'roster' && <Roster alCerrar={cerrar} />}
      {ventana === 'jugadores' && <Jugadores alCerrar={cerrar} />}
      {ventana === 'conteo' && <AjustesConteo alCerrar={cerrar} />}
    </header>
  );
}
