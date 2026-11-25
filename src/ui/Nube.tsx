import { useCallback, useEffect, useState } from 'react';
import type { Play } from '../modelo/tipos';
import { useBiblioteca } from '../estado/bibliotecaStore';
import { useEditor } from '../estado/editorStore';
import { avisar } from '../estado/avisos';
import { irA } from '../estado/ruta';
import { useSesion } from '../nube/sesion';
import { CanchaEstatica } from '../cancha/CanchaEstatica';
import {
  abrirJugadaCompartida,
  agregarALibro,
  borrarLibro,
  compartidoConmigo,
  copiarJugada,
  copiarLibro,
  crearLibro,
  editarLibro,
  infoContenido,
  jugadasDeLibro,
  libroPorId,
  misLibros,
  ocultarCompartido,
  ordenarLibro,
  quitarDeLibro,
  reportar,
  type ItemCompartido,
  type JugadaDeLibro,
  type Libro,
  type TipoRecurso,
} from '../nube/compartir';
import { PanelCompartir } from './PanelCompartir';

const fecha = (s: string) => new Date(s).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

/** Pide el motivo y envía el reporte (sección 6: "Reportar contenido" visible en todo lo compartido). */
export async function pedirReporte(tipo: TipoRecurso, id: string) {
  const motivo = window.prompt('¿Por qué reportas este contenido? (lo revisará la administración)');
  if (motivo === null) return;
  if (motivo.trim().length < 3) return avisar('Escribe un motivo un poco más largo.', true);
  try {
    await reportar(tipo, id, motivo);
    avisar('Gracias. Recibimos tu reporte.');
  } catch (e) {
    avisar((e as Error).message, true);
  }
}

function SinCuenta({ que }: { que: string }) {
  return (
    <div className="vacio">
      <p>Para {que} necesitas una cuenta.</p>
      <button className="boton-texto primario" onClick={() => irA('/cuenta')}>
        Ingresar o crear cuenta
      </button>
    </div>
  );
}

function useCarga<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cargar = useCallback(async () => {
    try {
      setDatos(await fn());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, deps);
  useEffect(() => {
    void cargar();
  }, [cargar]);
  return { datos, error, cargar };
}

const abrirYCerrar = async (id: string, alCerrar: () => void, presentar = false) => {
  try {
    await abrirJugadaCompartida(id);
    if (presentar) useEditor.getState().setPresentando(true);
    alCerrar();
  } catch (e) {
    avisar((e as Error).message, true);
  }
};

// ---------------------------------------------------------------------------
// "Compartido conmigo"
// ---------------------------------------------------------------------------
export function PestanaCompartido({ alCerrar, alVerLibro }: { alCerrar: () => void; alVerLibro: (id: string) => void }) {
  const usuario = useSesion((s) => s.usuario);
  const { datos, error, cargar } = useCarga(() => (usuario ? compartidoConmigo() : Promise.resolve([])), [usuario?.id]);
  if (!usuario) return <SinCuenta que="recibir jugadas y libros compartidos" />;
  if (error) return <p className="vacio">{error}</p>;
  if (!datos) return <p className="vacio">Cargando…</p>;
  if (!datos.length)
    return <p className="vacio">Aún nadie te ha compartido nada. Cuando abras un enlace compartido, aparecerá aquí.</p>;

  const copiar = async (it: ItemCompartido) => {
    try {
      if (it.tipo === 'play') {
        const c = await copiarJugada(it.recurso_id);
        avisar(c ? `Copia guardada en tus jugadas: "${c.nombre}"` : 'Copia guardada en tus jugadas');
      } else {
        await copiarLibro(it.recurso_id);
        avisar('Copia del libro guardada en tus libros');
      }
    } catch (e) {
      avisar((e as Error).message, true);
    }
  };

  return (
    <ul className="lista-filas">
      {datos.map((it) => (
        <li key={it.tipo + it.recurso_id}>
          <button
            className="fila-principal"
            onClick={() => (it.tipo === 'play' ? abrirYCerrar(it.recurso_id, alCerrar) : alVerLibro(it.recurso_id))}
          >
            <strong>
              {it.tipo === 'playbook' ? '📚 ' : ''}
              {it.titulo}
            </strong>
            <small>
              de {it.autor} · {fecha(it.actualizado)} ·{' '}
              <span className={`etiqueta-permiso ${it.permiso}`}>{it.permiso === 'editar' ? 'Puedes editar' : 'Puedes ver'}</span>
            </small>
          </button>
          <div className="fila-acciones">
            <button className="boton-texto" onClick={() => copiar(it)}>
              Guardar una copia
            </button>
            <button
              className="boton-texto"
              onClick={async () => {
                try {
                  await ocultarCompartido(it.tipo, it.recurso_id);
                  await cargar();
                } catch (e) {
                  avisar((e as Error).message, true);
                }
              }}
            >
              Quitar de mi lista
            </button>
            <button className="boton-texto peligro" onClick={() => pedirReporte(it.tipo, it.recurso_id)}>
              Reportar
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Libros de jugadas
// ---------------------------------------------------------------------------
export function PestanaLibros({ alVerLibro }: { alVerLibro: (id: string) => void }) {
  const usuario = useSesion((s) => s.usuario);
  const { datos, error, cargar } = useCarga(() => (usuario ? misLibros(usuario.id) : Promise.resolve([])), [usuario?.id]);
  if (!usuario) return <SinCuenta que="crear libros de jugadas" />;

  const nuevo = async () => {
    const t = window.prompt('Nombre del libro (ej. "Zona 3-3-1", "Salidas de pull", "Endzone")');
    if (!t?.trim()) return;
    try {
      const id = await crearLibro(t);
      await cargar();
      alVerLibro(id);
    } catch (e) {
      avisar((e as Error).message, true);
    }
  };

  return (
    <>
      <div className="fila-botones">
        <button className="boton-texto primario" onClick={nuevo}>
          + Nuevo libro
        </button>
      </div>
      {error && <p className="vacio">{error}</p>}
      {!datos ? (
        !error && <p className="vacio">Cargando…</p>
      ) : datos.length === 0 ? (
        <p className="vacio">Un libro es una colección ordenada de jugadas para compartir con tu equipo. Crea el primero.</p>
      ) : (
        <ul className="lista-filas">
          {datos.map((l) => (
            <li key={l.id}>
              <button className="fila-principal" onClick={() => alVerLibro(l.id)}>
                <strong>📚 {l.titulo}</strong>
                <small>
                  {l.source_author_name ? `Basado en un libro de ${l.source_author_name} · ` : ''}
                  {fecha(l.actualizado)}
                </small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function MiniJugada({ j }: { j: Play | null }) {
  if (!j) return <div className="tarjeta-svg vacia" />;
  return <CanchaEstatica paso={j.pasos[0]} vista={j.vista} lado={j.lado} orientacion="horizontal" className="tarjeta-svg" sinNombres />;
}

export function DetalleLibro({ id, alVolver, alCerrar }: { id: string; alVolver: () => void; alCerrar: () => void }) {
  const usuario = useSesion((s) => s.usuario);
  const propias = useBiblioteca((s) => s.jugadas);
  const [eligiendo, setEligiendo] = useState(false);
  const [compartiendo, setCompartiendo] = useState(false);
  const { datos, error, cargar } = useCarga(async () => {
    const [libro, jugadas, info] = await Promise.all([libroPorId(id), jugadasDeLibro(id), infoContenido('playbook', id)]);
    return { libro, jugadas, info };
  }, [id]);

  if (error) return <p className="vacio">{error}</p>;
  if (!datos) return <p className="vacio">Cargando…</p>;
  const { libro, jugadas, info } = datos;
  if (!libro || !info) return <p className="vacio">Este libro ya no está disponible.</p>;
  const esDueno = info.permiso === 'dueno';
  const puedeEditar = esDueno || info.permiso === 'editar';

  const hacer = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) avisar(ok);
      await cargar();
    } catch (e) {
      avisar((e as Error).message, true);
    }
  };
  const mover = (i: number, d: -1 | 1) => {
    const ids = jugadas.map((x: JugadaDeLibro) => x.id);
    const k = i + d;
    if (k < 0 || k >= ids.length) return;
    [ids[i], ids[k]] = [ids[k], ids[i]];
    void hacer(() => ordenarLibro(id, ids));
  };
  const enLibro = new Set(jugadas.map((x) => x.id));

  return (
    <div className="detalle-libro">
      <div className="fila-botones">
        <button className="boton-texto" onClick={alVolver}>
          ← Volver
        </button>
        {!esDueno && <span className={`etiqueta-permiso ${info.permiso}`}>{info.permiso === 'editar' ? 'Puedes editar' : 'Puedes ver'}</span>}
      </div>
      <h3>📚 {libro.titulo}</h3>
      <p className="nota">
        {esDueno ? 'Tu libro' : `De ${info.autor}`}
        {info.basado_en ? ` · Basado en un libro de ${info.basado_en}` : ''} · {jugadas.length}{' '}
        {jugadas.length === 1 ? 'jugada' : 'jugadas'}
      </p>
      <div className="fila-botones">
        {puedeEditar && (
          <button className="boton-texto primario" onClick={() => setEligiendo(!eligiendo)}>
            + Agregar jugada
          </button>
        )}
        {esDueno && (
          <>
            <button className="boton-texto" onClick={() => setCompartiendo(!compartiendo)}>
              Compartir
            </button>
            <button
              className="boton-texto"
              onClick={() => {
                const t = window.prompt('Nuevo nombre del libro', libro.titulo);
                if (t?.trim()) void hacer(() => editarLibro(id, { titulo: t.trim().slice(0, 80) }), 'Libro renombrado');
              }}
            >
              Renombrar
            </button>
            <button
              className="boton-texto peligro"
              onClick={() => {
                if (window.confirm(`¿Borrar el libro "${libro.titulo}"? Las jugadas no se borran, y quienes hicieron copias las conservan.`))
                  void borrarLibro(id).then(alVolver, (e: Error) => avisar(e.message, true));
              }}
            >
              Borrar libro
            </button>
          </>
        )}
        {!esDueno && (
          <>
            <button className="boton-texto" onClick={() => hacer(() => copiarLibro(id), 'Copia guardada en tus libros')}>
              Guardar una copia
            </button>
            <button className="boton-texto peligro" onClick={() => pedirReporte('playbook', id)}>
              Reportar
            </button>
          </>
        )}
      </div>

      {compartiendo && esDueno && <PanelCompartir tipo="playbook" id={id} titulo={libro.titulo} />}

      {eligiendo && (
        <div className="elegir-jugada">
          <p className="nota">
            {esDueno ? 'Elige una de tus jugadas:' : `Elige una de tus jugadas; se agregará una copia al libro de ${info.autor}:`}
          </p>
          <ul className="lista-filas compacta">
            {propias
              .filter((p) => !enLibro.has(p.id))
              .sort((a, b) => b.editada - a.editada)
              .map((p) => (
                <li key={p.id}>
                  <button
                    className="fila-principal"
                    onClick={() => {
                      setEligiendo(false);
                      void hacer(() => agregarALibro(id, p.id), `"${p.nombre}" agregada`);
                    }}
                  >
                    <strong>{p.nombre}</strong>
                    <small>
                      {p.categoria} · {p.pasos.length} pasos
                    </small>
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}

      {jugadas.length === 0 ? (
        <p className="vacio">Este libro aún no tiene jugadas.</p>
      ) : (
        <ol className="lista-tarjetas">
          {jugadas.map((x, i) => (
            <li key={x.id} className="tarjeta">
              <button className="tarjeta-principal" onClick={() => abrirYCerrar(x.id, alCerrar)} aria-label={`Abrir ${x.titulo}`}>
                <MiniJugada j={x.jugada} />
                <div className="tarjeta-info">
                  <strong>
                    {i + 1}. {x.titulo}
                  </strong>
                  <span className="tarjeta-meta">{x.jugada ? `${x.jugada.pasos.length} pasos` : ''}</span>
                </div>
              </button>
              <div className="tarjeta-acciones">
                <button className="boton-texto" onClick={() => abrirYCerrar(x.id, alCerrar, true)}>
                  Presentar
                </button>
                {puedeEditar && (
                  <>
                    <button className="boton-texto" disabled={i === 0} onClick={() => mover(i, -1)} aria-label="Subir">
                      ↑
                    </button>
                    <button className="boton-texto" disabled={i === jugadas.length - 1} onClick={() => mover(i, 1)} aria-label="Bajar">
                      ↓
                    </button>
                    <button className="boton-texto peligro" onClick={() => hacer(() => quitarDeLibro(id, x.id), 'Quitada del libro')}>
                      Quitar
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
      {!usuario && <SinCuenta que="ver este libro" />}
    </div>
  );
}

export type { Libro };
