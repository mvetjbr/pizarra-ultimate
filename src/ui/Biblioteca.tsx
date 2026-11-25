import { useMemo, useRef, useState } from 'react';
import { create } from 'zustand';
import { hayServidor } from '../nube/cliente';
import { DetalleLibro, PestanaCompartido, PestanaLibros } from './Nube';
import type { Play } from '../modelo/tipos';
import { useEditor } from '../estado/editorStore';
import {
  abrirJugada,
  borrarCarpeta,
  crearCarpeta,
  listaCarpetas,
  moverACarpeta,
  renombrarCarpeta,
  duplicarJugada,
  eliminarJugada,
  nuevaJugada,
  useBiblioteca,
} from '../estado/bibliotecaStore';
import { avisar } from '../estado/avisos';
import { construirPlantilla, PLANTILLAS, type Plantilla } from '../plantillas/plantillas';
import { CanchaEstatica } from '../cancha/CanchaEstatica';
import { descargar } from '../exportar/archivos';
import { jsonDeJugadas, leerArchivoJugadas } from '../exportar/json';
import { Dialogo } from './Dialogo';

/** null = todas; SIN_CARPETA = las que no están en ninguna; si no, el nombre de la carpeta. */
type Filtro = string | null;
const SIN_CARPETA = '\u0000sin';
type Pestana = 'mias' | 'libros' | 'compartido' | 'plantillas';

/** Para abrir la biblioteca directo en una pestaña o un libro (p. ej. desde un enlace compartido). */
export const useDestinoBiblioteca = create<{ pestana: Pestana; libro: string | null }>(() => ({ pestana: 'mias', libro: null }));

const sinTildes = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

function coincide(j: { nombre: string; etiquetas: string[]; notas: string; carpeta?: string }, q: string, carpeta: Filtro) {
  if (carpeta === SIN_CARPETA ? !!j.carpeta : carpeta !== null && j.carpeta !== carpeta) return false;
  if (!q) return true;
  return sinTildes([j.nombre, j.etiquetas.join(' '), j.notas].join(' ')).includes(q);
}

const fecha = (t: number) => new Date(t).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

function Etiquetas({ lista }: { lista: string[] }) {
  if (!lista.length) return null;
  return (
    <div className="chips-etiquetas">
      {lista.map((e) => (
        <span key={e} className="chip-etiqueta">
          {e}
        </span>
      ))}
    </div>
  );
}

const NUEVA = '\u0000nueva';

/** Selector para mover una jugada a otra carpeta (o crear una nueva). */
function SelectorCarpeta({ j, carpetas }: { j: Play; carpetas: string[] }) {
  return (
    <select
      className="selector-carpeta"
      aria-label={`Carpeta de ${j.nombre}`}
      value={j.carpeta ?? ''}
      onChange={(e) => {
        let destino: string | undefined = e.target.value || undefined;
        if (destino === NUEVA) {
          const n = window.prompt('Nombre de la carpeta nueva (puedes empezar con un emoji como ícono)');
          destino = n ? (crearCarpeta(n) ?? undefined) : j.carpeta;
          if (!n) return;
        }
        moverACarpeta(j.id, destino);
        avisar(destino ? `"${j.nombre}" está en la carpeta ${destino}` : `"${j.nombre}" quedó sin carpeta`);
      }}
    >
      <option value="">Sin carpeta</option>
      {carpetas.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
      <option value={NUEVA}>+ Carpeta nueva…</option>
    </select>
  );
}

function TarjetaJugada({
  j,
  actual,
  alAbrir,
  carpetas,
}: {
  j: Play;
  actual: boolean;
  alAbrir: (presentar: boolean) => void;
  carpetas: string[];
}) {
  return (
    <li className={`tarjeta${actual ? ' actual' : ''}`}>
      <button className="tarjeta-principal" onClick={() => alAbrir(false)} aria-label={`Abrir ${j.nombre}`}>
        <CanchaEstatica paso={j.pasos[0]} vista={j.vista} lado={j.lado} orientacion="horizontal" className="tarjeta-svg" sinNombres />
        <div className="tarjeta-info">
          <strong>{j.nombre}</strong>
          <span className="tarjeta-meta">
            {j.carpeta ? `${j.carpeta} · ` : ''}
            {j.pasos.length} {j.pasos.length === 1 ? 'paso' : 'pasos'} · {fecha(j.editada)}
            {actual && ' · abierta'}
          </span>
          <Etiquetas lista={j.etiquetas} />
        </div>
      </button>
      <div className="tarjeta-acciones">
        <SelectorCarpeta j={j} carpetas={carpetas} />
        <button className="boton-texto" onClick={() => alAbrir(true)}>
          Presentar
        </button>
        <button
          className="boton-texto"
          onClick={() => {
            duplicarJugada(j);
            avisar('Jugada duplicada');
          }}
        >
          Duplicar
        </button>
        <button
          className="boton-texto peligro"
          onClick={() => {
            if (window.confirm(`¿Eliminar "${j.nombre}"? Esta acción no se puede deshacer.`)) {
              eliminarJugada(j.id);
              avisar('Jugada eliminada');
            }
          }}
        >
          Eliminar
        </button>
      </div>
    </li>
  );
}

function TarjetaPlantilla({ p, vista, alUsar }: { p: Plantilla; vista: Play; alUsar: () => void }) {
  return (
    <li className="tarjeta">
      <button className="tarjeta-principal" onClick={alUsar} aria-label={`Usar plantilla ${p.nombre}`}>
        <CanchaEstatica paso={vista.pasos[0]} vista={vista.vista} lado={vista.lado} orientacion="horizontal" className="tarjeta-svg" />
        <div className="tarjeta-info">
          <strong>{p.nombre}</strong>
          <span className="tarjeta-meta">
            {p.categoria} · {vista.pasos.length} pasos
          </span>
          <span className="tarjeta-descripcion">{p.descripcion}</span>
        </div>
      </button>
      <div className="tarjeta-acciones">
        <button className="boton-texto primario" onClick={alUsar}>
          Usar plantilla
        </button>
      </div>
    </li>
  );
}

export function Biblioteca({ alCerrar }: { alCerrar: () => void }) {
  const [pestana, setPestanaLocal] = useState<Pestana>(() => useDestinoBiblioteca.getState().pestana);
  const [libro, setLibro] = useState<string | null>(() => useDestinoBiblioteca.getState().libro);
  const setPestana = (p: Pestana) => {
    setPestanaLocal(p);
    setLibro(null);
    useDestinoBiblioteca.setState({ pestana: p, libro: null });
  };
  const verLibro = (id: string | null) => {
    setLibro(id);
    useDestinoBiblioteca.setState({ libro: id });
  };
  const [busqueda, setBusqueda] = useState('');
  const [carpeta, setCarpeta] = useState<Filtro>(null);
  const jugadas = useBiblioteca((s) => s.jugadas);
  const creadas = useBiblioteca((s) => s.carpetas);
  const carpetas = listaCarpetas(creadas, jugadas);
  const enCarpeta = carpeta && carpeta !== SIN_CARPETA ? carpeta : undefined;
  const actualId = useEditor((s) => s.jugada.id);
  const entrada = useRef<HTMLInputElement>(null);

  // Vista previa de cada plantilla (se construye una sola vez).
  const previas = useMemo(() => PLANTILLAS.map((p) => ({ p, vista: construirPlantilla(p) })), []);

  const q = sinTildes(busqueda.trim());
  const mias = jugadas
    .filter((j) => coincide(j, q, carpeta))
    .sort((a, b) => b.editada - a.editada);
  const plantillas = previas.filter(({ p }) => coincide({ ...p, notas: p.descripcion }, q, null));
  const cuantas = (c: Filtro) => jugadas.filter((j) => coincide(j, '', c)).length;

  const abrir = (j: Play, presentar: boolean) => {
    abrirJugada(j);
    if (presentar) useEditor.getState().setPresentando(true);
    alCerrar();
  };

  const importar = async (archivo: File | undefined) => {
    if (!archivo) return;
    try {
      const nuevas = useBiblioteca.getState().importar(await leerArchivoJugadas(archivo));
      avisar(nuevas.length === 1 ? `Se importó "${nuevas[0].nombre}"` : `Se importaron ${nuevas.length} jugadas`);
      if (nuevas.length === 1) abrir(nuevas[0], false);
      else setPestana('mias');
    } catch (e) {
      avisar((e as Error).message, true);
    }
  };

  return (
    <Dialogo
      titulo="Biblioteca de jugadas"
      alCerrar={alCerrar}
      grande
      pie={
        <>
          <button
            className="boton-texto primario"
            onClick={() => {
              nuevaJugada(pestana === 'mias' ? enCarpeta : undefined);
              alCerrar();
            }}
          >
            + Nueva jugada
          </button>
          <button className="boton-texto" onClick={() => entrada.current?.click()}>
            Importar JSON
          </button>
          <button
            className="boton-texto"
            disabled={jugadas.length === 0}
            onClick={() => descargar(jsonDeJugadas(jugadas), `pizarra-ultimate-respaldo-${new Date().toISOString().slice(0, 10)}.json`)}
          >
            Exportar todas
          </button>
          <input
            ref={entrada}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              importar(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </>
      }
    >
      <div className="pestanas" role="tablist">
        <button role="tab" aria-selected={pestana === 'mias'} onClick={() => setPestana('mias')}>
          Mis jugadas ({jugadas.length})
        </button>
        {hayServidor && (
          <>
            <button role="tab" aria-selected={pestana === 'libros'} onClick={() => setPestana('libros')}>
              Mis libros
            </button>
            <button role="tab" aria-selected={pestana === 'compartido'} onClick={() => setPestana('compartido')}>
              Compartido conmigo
            </button>
          </>
        )}
        <button role="tab" aria-selected={pestana === 'plantillas'} onClick={() => setPestana('plantillas')}>
          Plantillas ({PLANTILLAS.length})
        </button>
      </div>
      {libro ? (
        <DetalleLibro id={libro} alVolver={() => verLibro(null)} alCerrar={alCerrar} />
      ) : pestana === 'libros' ? (
        <PestanaLibros alVerLibro={verLibro} />
      ) : pestana === 'compartido' ? (
        <PestanaCompartido alCerrar={alCerrar} alVerLibro={verLibro} />
      ) : (
      <>
      <div className="filtros">
        <input
          type="search"
          className="buscador"
          placeholder="Buscar por nombre, etiqueta o nota"
          aria-label="Buscar jugadas"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        {pestana === 'mias' && (
          <div className="chips" role="group" aria-label="Carpetas">
            <button className="chip" aria-pressed={carpeta === null} onClick={() => setCarpeta(null)}>
              Todas ({jugadas.length})
            </button>
            {carpetas.map((c) => (
              <button key={c} className="chip" aria-pressed={carpeta === c} onClick={() => setCarpeta(c)}>
                {c} ({cuantas(c)})
              </button>
            ))}
            {carpetas.length > 0 && cuantas(SIN_CARPETA) > 0 && (
              <button className="chip" aria-pressed={carpeta === SIN_CARPETA} onClick={() => setCarpeta(SIN_CARPETA)}>
                Sin carpeta ({cuantas(SIN_CARPETA)})
              </button>
            )}
            <button
              className="chip chip-nueva"
              aria-label="Crear carpeta"
              title="Crear carpeta"
              onClick={() => {
                const n = window.prompt('Nombre de la carpeta. Puedes empezar con el emoji que quieras como ícono, ej. "🔥 Zona 3-3-1" o "🥏 Salidas de pull"');
                const c = n ? crearCarpeta(n) : null;
                if (c) {
                  setCarpeta(c);
                  avisar(`Carpeta "${c}" creada. Usa el selector de carpeta de cada jugada para meterla aquí.`);
                }
              }}
            >
              + Carpeta
            </button>
          </div>
        )}
        {enCarpeta && pestana === 'mias' && (
          <div className="fila-botones acciones-carpeta">
            <button
              className="boton-texto"
              onClick={() => {
                const n = window.prompt('Nuevo nombre de la carpeta (el emoji del inicio es su ícono)', enCarpeta);
                const c = n ? renombrarCarpeta(enCarpeta, n) : null;
                if (c) setCarpeta(c);
              }}
            >
              Renombrar carpeta
            </button>
            <button
              className="boton-texto peligro"
              onClick={() => {
                if (window.confirm(`¿Borrar la carpeta "${enCarpeta}"? Las jugadas no se borran: quedan sin carpeta.`)) {
                  borrarCarpeta(enCarpeta);
                  setCarpeta(null);
                }
              }}
            >
              Borrar carpeta
            </button>
          </div>
        )}
      </div>
      {pestana === 'mias' ? (
        mias.length ? (
          <ul className="lista-tarjetas">
            {mias.map((j) => (
              <TarjetaJugada key={j.id} j={j} actual={j.id === actualId} alAbrir={(p) => abrir(j, p)} carpetas={carpetas} />
            ))}
          </ul>
        ) : (
          <p className="vacio">
            {enCarpeta && !q
              ? 'Esta carpeta está vacía. Crea una jugada nueva aquí, o en «Todas» usa el selector de carpeta de una jugada para moverla.'
              : 'No hay jugadas que coincidan. Prueba con otra búsqueda o empieza desde una plantilla.'}
          </p>
        )
      ) : plantillas.length ? (
        <ul className="lista-tarjetas">
          {plantillas.map(({ p, vista }) => (
            <TarjetaPlantilla
              key={p.id}
              p={p}
              vista={vista}
              alUsar={() => {
                // Copia nueva para que cada uso tenga su propio id.
                abrir(construirPlantilla(p), false);
                avisar(`Plantilla "${p.nombre}" lista para editar`);
              }}
            />
          ))}
        </ul>
      ) : (
        <p className="vacio">No hay plantillas en esta categoría.</p>
      )}
      </>
      )}
    </Dialogo>
  );
}
