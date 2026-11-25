import { useState } from 'react';
import { useEditor } from '../estado/editorStore';
import { usePreferencias, extraerPreferencias } from '../estado/preferencias';
import { useRoster } from '../estado/rosterStore';
import { avisar } from '../estado/avisos';
import { useReproduccion } from '../animacion/reproductor';
import { crearEnlace } from '../exportar/enlace';
import { compartirArchivo, descargar, nombreArchivo, puedeCompartirArchivos } from '../exportar/archivos';
import { jsonDeJugadas } from '../exportar/json';
import type { Contexto } from '../exportar/imagen';
import { Dialogo } from './Dialogo';
import { PanelCompartir } from './PanelCompartir';
import { useSesion } from '../nube/sesion';
import { irA } from '../estado/ruta';
import { hayServidor } from '../nube/cliente';

async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

function contextoActual(): Contexto {
  const jugada = useEditor.getState().jugada;
  return {
    jugada,
    prefs: extraerPreferencias(usePreferencias.getState()),
    miembros: useRoster.getState().miembros,
    orientacion: jugada.orientacion,
  };
}

type Tarea = 'png' | 'gif' | 'video' | null;

/** Compartir con permisos (necesita cuenta). Una jugada de otra persona no se puede volver a compartir. */
function SeccionNube({ nombre, id }: { nombre: string; id: string }) {
  const usuario = useSesion((s) => s.usuario);
  const compartida = useEditor((s) => s.compartida);
  if (compartida)
    return (
      <section className="seccion-compartir">
        <p className="nota">Esta jugada es de {compartida.autor}: solo esa persona puede compartirla. Puedes guardar una copia y compartir la tuya.</p>
      </section>
    );
  if (!usuario)
    return (
      <section className="seccion-compartir">
        <h3>Compartir con permisos</h3>
        <p className="nota">Con una cuenta puedes compartir con permiso de ver o editar, y quitar el acceso cuando quieras.</p>
        <button className="boton-texto" onClick={() => irA('/cuenta')}>
          Ingresar o crear cuenta
        </button>
      </section>
    );
  return <PanelCompartir tipo="play" id={id} titulo={nombre} />;
}

/** Enlace para WhatsApp, imagen PNG del paso, animación (GIF/video) y respaldo JSON. */
export function Compartir({ alCerrar }: { alCerrar: () => void }) {
  const jugada = useEditor((s) => s.jugada);
  const pasoActual = useEditor((s) => s.pasoActual);
  const velocidad = useReproduccion((s) => s.velocidad);
  const [tarea, setTarea] = useState<Tarea>(null);
  const [progreso, setProgreso] = useState(0);
  const [enlaceVisible, setEnlaceVisible] = useState<string | null>(null);
  const hayShare = typeof navigator.share === 'function';
  const archivosOk = puedeCompartirArchivos();
  const variosPasos = jugada.pasos.length > 1;

  const compartirEnlace = async () => {
    const url = crearEnlace(useEditor.getState().jugada);
    try {
      await navigator.share({ title: jugada.nombre, text: `Jugada: ${jugada.nombre}`, url });
    } catch (e) {
      if ((e as DOMException)?.name !== 'AbortError') avisar('No se pudo abrir el menú de compartir.', true);
    }
  };

  const copiarEnlace = async () => {
    const url = crearEnlace(useEditor.getState().jugada);
    if (await copiar(url)) avisar('Enlace copiado. Pégalo en WhatsApp.');
    else setEnlaceVisible(url); // sin permiso de portapapeles: se muestra para copiar a mano
  };

  /** Entrega un archivo: menú de compartir en el celular o descarga en el PC. */
  const entregar = async (blob: Blob, nombre: string, compartir: boolean) => {
    if (compartir) {
      try {
        await compartirArchivo(blob, nombre, jugada.nombre);
        return;
      } catch (e) {
        // Si la creación tardó, el navegador ya no permite abrir el menú de compartir: se descarga.
        if ((e as DOMException)?.name !== 'NotAllowedError') throw e;
      }
    }
    {
      descargar(blob, nombre);
      avisar('Archivo descargado');
    }
  };

  const ejecutar = async (t: Exclude<Tarea, null>, compartir: boolean) => {
    setTarea(t);
    setProgreso(0);
    try {
      const c = contextoActual();
      if (t === 'png') {
        // Se cargan solo cuando se usan, para que la app abra más rápido.
        const { pngDePaso } = await import('../exportar/imagen');
        const blob = await pngDePaso(c, pasoActual);
        await entregar(blob, nombreArchivo(`${c.jugada.nombre}-paso-${pasoActual + 1}`, 'png'), compartir);
      } else if (t === 'gif') {
        const { gifDeJugada } = await import('../exportar/animacion');
        const blob = await gifDeJugada(c, velocidad, setProgreso);
        await entregar(blob, nombreArchivo(c.jugada.nombre, 'gif'), compartir);
      } else {
        const { videoDeJugada } = await import('../exportar/animacion');
        const { blob, extension } = await videoDeJugada(c, velocidad, setProgreso);
        await entregar(blob, nombreArchivo(c.jugada.nombre, extension), compartir);
      }
    } catch (e) {
      avisar(`No se pudo crear el archivo: ${(e as Error).message}`, true);
    } finally {
      setTarea(null);
    }
  };

  const ocupado = tarea !== null;
  const puedeVideo = typeof MediaRecorder !== 'undefined';

  return (
    <Dialogo titulo="Compartir y exportar" alCerrar={() => !ocupado && alCerrar()}>
      {hayServidor && <SeccionNube nombre={jugada.nombre} id={jugada.id} />}
      <section className="seccion-compartir">
        <h3>Enlace</h3>
        <p className="nota">
          La jugada completa va dentro del enlace: se abre directo en modo presentación, sin cuenta ni servidor.
        </p>
        <div className="botones-compartir">
          {hayShare && (
            <button className="boton-texto primario" onClick={compartirEnlace}>
              Compartir (WhatsApp…)
            </button>
          )}
          <button className={`boton-texto${hayShare ? '' : ' primario'}`} onClick={copiarEnlace}>
            Copiar enlace
          </button>
        </div>
        {enlaceVisible && (
          <textarea className="enlace-manual" readOnly rows={3} value={enlaceVisible} onFocus={(e) => e.target.select()} />
        )}
      </section>

      <section className="seccion-compartir">
        <h3>Imagen del paso {pasoActual + 1}</h3>
        <p className="nota">PNG en alta resolución con la cancha, el título y la leyenda.</p>
        <div className="botones-compartir">
          {archivosOk && (
            <button className="boton-texto primario" disabled={ocupado} onClick={() => ejecutar('png', true)}>
              Compartir imagen
            </button>
          )}
          <button className="boton-texto" disabled={ocupado} onClick={() => ejecutar('png', false)}>
            {tarea === 'png' ? 'Creando…' : 'Descargar PNG'}
          </button>
        </div>
      </section>

      <section className="seccion-compartir">
        <h3>Animación completa</h3>
        <p className="nota">
          {variosPasos
            ? `Los ${jugada.pasos.length} pasos animados a velocidad ${velocidad}x. El GIF se ve en cualquier lado; el video pesa menos y se ve más fluido.`
            : 'Agrega al menos un paso más para exportar la animación.'}
        </p>
        <div className="botones-compartir">
          <button className="boton-texto" disabled={ocupado || !variosPasos} onClick={() => ejecutar('gif', archivosOk)}>
            {tarea === 'gif' ? `Creando GIF… ${Math.round(progreso * 100)}%` : archivosOk ? 'Compartir GIF' : 'Descargar GIF'}
          </button>
          {puedeVideo && (
            <button className="boton-texto" disabled={ocupado || !variosPasos} onClick={() => ejecutar('video', archivosOk)}>
              {tarea === 'video' ? `Grabando video… ${Math.round(progreso * 100)}%` : archivosOk ? 'Compartir video' : 'Descargar video'}
            </button>
          )}
        </div>
        {(tarea === 'gif' || tarea === 'video') && <progress className="progreso" value={progreso} max={1} />}
        {tarea === 'video' && <p className="nota">El video se graba en tiempo real: deja esta pestaña abierta hasta que termine.</p>}
      </section>

      <section className="seccion-compartir">
        <h3>Archivo de respaldo</h3>
        <p className="nota">JSON para guardar o pasar la jugada a otro dispositivo. Se importa desde la Biblioteca.</p>
        <div className="botones-compartir">
          <button
            className="boton-texto"
            onClick={() => descargar(jsonDeJugadas([useEditor.getState().jugada]), nombreArchivo(jugada.nombre, 'json'))}
          >
            Exportar esta jugada (JSON)
          </button>
        </div>
      </section>
    </Dialogo>
  );
}
