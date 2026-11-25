import { useRef } from 'react';
import type { Vista } from '../modelo/tipos';
import { pasoActivo, useEditor } from '../estado/editorStore';
import { usePreferencias } from '../estado/preferencias';
import { nuevaJugada } from '../estado/bibliotecaStore';
import { useVentana, type Ventana } from '../estado/ventanas';
import { esIOS, instalar, useInstalacion } from '../estado/instalacion';
import { avisar } from '../estado/avisos';
import { cortarAnimacion } from '../animacion/reproductor';
import { hayServidor } from '../nube/cliente';
import { nombreVisible, useSesion } from '../nube/sesion';
import { irA } from '../estado/ruta';
import { iniciales } from '../estado/rosterStore';
import {
  IconoBiblioteca,
  IconoCompartir,
  IconoCuadricula,
  IconoDeshacer,
  IconoMenu,
  IconoRehacer,
  IconoRotar,
  IconoUsuario,
} from './Iconos';
import { Biblioteca } from './Biblioteca';
import { DetallesJugada } from './DetallesJugada';
import { Compartir } from './Compartir';
import { Roster } from './Roster';
import { Jugadores } from './Jugadores';
import { AjustesConteo } from '../conteo/AjustesConteo';
import { proporcionValida } from '../estado/jugadores';
import { useOrientacionAutomatica } from '../estado/pantalla';
import { encuadrar } from '../modelo/encuadre';
import { urlApp } from '../nube/cliente';
import { sincronizar, useNube } from '../nube/jugadas';

const TEXTO_NUBE = {
  apagada: '',
  sincronizando: 'Sincronizando…',
  'al-dia': 'Jugadas al día en tu cuenta',
  'sin-conexion': 'Sin conexión: se sincroniza al volver',
  error: 'No se pudo sincronizar. Toca para reintentar',
} as const;

async function invitar() {
  const texto = `Te invito a Pizarra Ultimate para diseñar y compartir jugadas de Ultimate. Crea tu cuenta aquí: ${urlApp()}`;
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: 'Pizarra Ultimate', text: texto });
      return;
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(texto);
    avisar('Invitación copiada. Pégala en WhatsApp.');
  } catch {
    window.prompt('Copia la invitación:', texto);
  }
}

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
  const usuario = useSesion((s) => s.usuario);
  const perfil = useSesion((s) => s.perfil);
  const orientacionAutomatica = useOrientacionAutomatica();
  const estadoNube = useNube((s) => s.estado);

  const ataque = paso.jugadores.filter((j) => j.equipo === 'ataque');
  const defensa = paso.jugadores.filter((j) => j.equipo === 'defensa');
  const m = ataque.filter((j) => j.match === 'M').length;
  const f = ataque.filter((j) => j.match === 'F').length;
  // En mixto la línea debe ser 4-3; con menos jugadores o sin género, ningún match pasa de 4.
  const proporcionRara = !proporcionValida(m, f, ataque.length - m - f);
  const textoProporcion =
    ataque.length > 0 && m + f === 0
      ? 'Sin género'
      : `${m}M-${f}F${ataque.length - m - f > 0 ? ` · ${ataque.length - m - f} s/g` : ''}`;
  // Al pasar a Media o Zona, la jugada se corre para que ningún jugador quede fuera de lo que se ve.
  const encuadrarCon = (vista: Vista, lado: typeof jugada.lado) => {
    // En el celular el menú tapa la cancha: se cierra para que se vea el cambio.
    cerrarMenu();
    let ajuste: ReturnType<typeof encuadrar> = null;
    cambiar((j) => {
      ajuste = encuadrar(j, vista, lado);
    });
    const a = ajuste as ReturnType<typeof encuadrar>;
    if (a)
      avisar(
        a.escala < 1
          ? 'Acomodé la jugada (más junta) para que todos quepan en esta vista. Deshacer la devuelve como estaba.'
          : 'Corrí la jugada para que se vean todos los jugadores. Deshacer la devuelve como estaba.',
      );
  };
  const cambiarVista = (v: Vista) => encuadrarCon(v, jugada.lado);
  const cambiarLado = () => encuadrarCon(jugada.vista, jugada.lado === 'derecha' ? 'izquierda' : 'derecha');
  const irACuenta = () => {
    cerrarMenu();
    irA(usuario ? '/mis-datos' : '/cuenta');
  };

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

      {/* En el celular, la vista, el lado, la cuadrícula, el roster y la cuenta pasan al menú «⋯». */}
      <div className="segmentado solo-escritorio" role="group" aria-label="Vista de la cancha">
        {VISTAS.map((v) => (
          <button key={v.id} aria-pressed={jugada.vista === v.id} onClick={() => cambiarVista(v.id)}>
            {v.nombre}
          </button>
        ))}
      </div>
      {jugada.vista !== 'completa' && (
        <button className="boton-texto solo-escritorio" title="Cambiar de lado" onClick={cambiarLado}>
          {jugada.lado === 'derecha' ? 'Lado der. ⇄' : '⇄ Lado izq.'}
        </button>
      )}

      <div className="grupo solo-escritorio">
        <button
          className="boton-icono"
          hidden={orientacionAutomatica}
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
        className={`proporcion solo-escritorio${proporcionRara ? ' alerta' : ''}`}
        title={
          proporcionRara
            ? 'En mixto la línea debe ser 4-3. Toca para abrir el roster.'
            : 'Proporción de match del ataque en cancha. Toca para abrir el roster.'
        }
        onClick={() => abrir('roster')}
      >
        {textoProporcion}
      </button>

      <button
        className="boton-texto primario boton-compartir"
        onClick={() => abrir('compartir')}
        title="Compartir y exportar"
        aria-label="Compartir y exportar"
      >
        <IconoCompartir />
        <span className="ocultar-movil">Compartir</span>
      </button>

      {hayServidor && (
        <button
          className="boton-icono solo-escritorio"
          onClick={irACuenta}
          title={usuario ? `Mis datos (${nombreVisible(perfil)})` : 'Ingresar o crear cuenta'}
          aria-label={usuario ? 'Mis datos' : 'Ingresar o crear cuenta'}
        >
          {usuario && perfil ? <span className="avatar-mini">{iniciales(nombreVisible(perfil))}</span> : <IconoUsuario />}
        </button>
      )}

      <details className="menu" ref={menu}>
        <summary className="boton-icono" aria-label="Más opciones" title="Más opciones">
          <IconoMenu />
        </summary>
        <div className="menu-lista">
          {hayServidor && (
            <button className="solo-movil" onClick={irACuenta}>
              {usuario ? `Mis datos (${nombreVisible(perfil)})` : 'Ingresar o crear cuenta'}
            </button>
          )}
          <div className="menu-fila solo-movil">
            <span>Vista</span>
            <div className="segmentado" role="group" aria-label="Vista de la cancha">
              {VISTAS.map((v) => (
                <button key={v.id} aria-pressed={jugada.vista === v.id} onClick={() => cambiarVista(v.id)}>
                  {v.nombre}
                </button>
              ))}
            </div>
          </div>
          {jugada.vista !== 'completa' && (
            <button className="solo-movil" onClick={cambiarLado}>
              Lado de la cancha <strong>{jugada.lado === 'derecha' ? 'Derecho ⇄' : 'Izquierdo ⇄'}</strong>
            </button>
          )}
          <label className="menu-check solo-movil">
            <input
              type="checkbox"
              checked={prefs.mostrarCuadricula}
              onChange={(e) => prefs.actualizar({ mostrarCuadricula: e.target.checked })}
            />
            Cuadrícula cada 5 m
          </label>
          <hr className="solo-movil" />
          {hayServidor && usuario && estadoNube !== 'apagada' && (
            <button className={`estado-nube ${estadoNube}`} onClick={() => void sincronizar()}>
              ☁ {TEXTO_NUBE[estadoNube]}
            </button>
          )}
          {hayServidor && (
            <button
              onClick={() => {
                cerrarMenu();
                void invitar();
              }}
            >
              Invitar a la app…
            </button>
          )}
          {perfil?.es_admin && (
            <button
              onClick={() => {
                cerrarMenu();
                irA('/admin');
              }}
            >
              Administración
            </button>
          )}
          <button onClick={() => abrir('detalles')}>Detalles y notas de la jugada…</button>
          <button onClick={() => abrir('roster')}>
            Roster del equipo…
            <span className={`proporcion${proporcionRara ? ' alerta' : ''}`}>{textoProporcion}</span>
          </button>
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
            Formación y jugadores… ({ataque.length} vs {defensa.length})
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
            <input type="color" aria-label="Color del ataque" value={prefs.colorAtaque} onChange={(e) => prefs.actualizar({ colorAtaque: e.target.value })} />
          </label>
          <label className="menu-color">
            Color defensa
            <input type="color" aria-label="Color de la defensa" value={prefs.colorDefensa} onChange={(e) => prefs.actualizar({ colorDefensa: e.target.value })} />
          </label>
          <hr />
          <button
            onClick={() => {
              cerrarMenu();
              irA('/legal/terminos');
            }}
          >
            Términos, privacidad y créditos
          </button>
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
