import { useRef } from 'react';
import { usePreferencias } from '../estado/preferencias';
import { useBiblioteca } from '../estado/bibliotecaStore';
import { avisar } from '../estado/avisos';
import { Dialogo } from '../ui/Dialogo';
import { DIBUJO_MUNECO } from './munecosSvg';
import { estaBloqueado, msPorNumero, munecoVisible, textoDesbloqueo, TODOS_LOS_MUNECOS } from './munecos';
import { DibujoMuneco } from './Conteo';

/** Mostrar u ocultar el muñeco, elegirlo y ajustar la velocidad del conteo. */
export function AjustesConteo({ alCerrar }: { alCerrar: () => void }) {
  const prefs = usePreferencias();
  const jugadas = useBiblioteca((s) => s.jugadas.length);
  const actual = munecoVisible(prefs.muneco, jugadas, prefs.modoEditor);
  const ms = msPorNumero(prefs.velocidadConteo);
  // Siete toques seguidos en el título activan o desactivan el modo editor.
  const toques = useRef({ n: 0, t: 0 });

  const tocarTitulo = () => {
    const ahora = Date.now();
    toques.current.n = ahora - toques.current.t < 1000 ? toques.current.n + 1 : 1;
    toques.current.t = ahora;
    if (toques.current.n >= 7) {
      toques.current.n = 0;
      const activo = !prefs.modoEditor;
      prefs.actualizar({ modoEditor: activo });
      avisar(activo ? 'Modo editor activado: todas las mascotas desbloqueadas' : 'Modo editor desactivado');
    }
  };

  return (
    <Dialogo titulo="Conteo de 10" alCerrar={alCerrar} pie={<button className="boton-texto primario" onClick={alCerrar}>Listo</button>}>
      <div className="formulario">
        <label className="menu-check fila-check">
          <input type="checkbox" checked={prefs.mostrarConteo} onChange={(e) => prefs.actualizar({ mostrarConteo: e.target.checked })} />
          Mostrar el muñeco sobre la cancha
        </label>

        <div className="campo">
          <span onClick={tocarTitulo}>Muñeco</span>
          <div className="grilla-munecos" role="group" aria-label="Elegir muñeco">
            {TODOS_LOS_MUNECOS.map((k) => {
              const bloqueado = estaBloqueado(k, jugadas, prefs.modoEditor);
              return (
                <button
                  key={k}
                  type="button"
                  className={`${k === actual ? 'elegido' : ''}${bloqueado ? ' bloqueado' : ''}`}
                  aria-pressed={k === actual}
                  aria-disabled={bloqueado}
                  aria-label={`${DIBUJO_MUNECO[k].nombre}${bloqueado ? ' (bloqueado)' : ''}`}
                  title={DIBUJO_MUNECO[k].nombre}
                  onClick={() => {
                    if (bloqueado) avisar(textoDesbloqueo(jugadas, prefs.modoEditor));
                    else prefs.actualizar({ muneco: k });
                  }}
                >
                  <DibujoMuneco clave={k} />
                  {bloqueado && (
                    <svg className="candado" viewBox="0 0 24 24" aria-hidden="true">
                      <rect x="5" y="11" width="14" height="10" rx="2" fill="#14221A" />
                      <path d="M8 11V8a4 4 0 018 0v3" fill="none" stroke="#14221A" strokeWidth="2.4" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
          <small className="ayuda-campo" aria-live="polite">
            {textoDesbloqueo(jugadas, prefs.modoEditor)}
          </small>
        </div>

        <label className="campo">
          <span>Velocidad: {String(Math.round(ms / 10) / 100).replace('.', ',')} s por número</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={prefs.velocidadConteo}
            aria-label="Velocidad del conteo: izquierda más lento, derecha más rápido"
            onChange={(e) => {
              let v = Number(e.target.value);
              if (Math.abs(v - 50) < 4) v = 50; // se "pega" en 1 s
              prefs.actualizar({ velocidadConteo: v });
            }}
          />
          <div className="escala-velocidad">
            <span>2 s</span>
            <span>1 s</span>
            <span>0,5 s</span>
          </div>
        </label>
      </div>
    </Dialogo>
  );
}
