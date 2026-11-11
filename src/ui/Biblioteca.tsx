import { useMemo, useRef, useState } from 'react';
import type { Categoria, Play } from '../modelo/tipos';
import { CATEGORIAS } from '../modelo/tipos';
import { useEditor } from '../estado/editorStore';
import {
  abrirJugada,
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

type Filtro = Categoria | 'Todas';

const sinTildes = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

function coincide(j: { nombre: string; categoria: Categoria; etiquetas: string[]; notas: string }, q: string, cat: Filtro) {
  if (cat !== 'Todas' && j.categoria !== cat) return false;
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

function TarjetaJugada({ j, actual, alAbrir }: { j: Play; actual: boolean; alAbrir: (presentar: boolean) => void }) {
  return (
    <li className={`tarjeta${actual ? ' actual' : ''}`}>
      <button className="tarjeta-principal" onClick={() => alAbrir(false)} aria-label={`Abrir ${j.nombre}`}>
        <CanchaEstatica paso={j.pasos[0]} vista={j.vista} lado={j.lado} orientacion="horizontal" className="tarjeta-svg" sinNombres />
        <div className="tarjeta-info">
          <strong>{j.nombre}</strong>
          <span className="tarjeta-meta">
            {j.categoria} · {j.pasos.length} {j.pasos.length === 1 ? 'paso' : 'pasos'} · {fecha(j.editada)}
            {actual && ' · abierta'}
          </span>
          <Etiquetas lista={j.etiquetas} />
        </div>
      </button>
      <div className="tarjeta-acciones">
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
  const [pestana, setPestana] = useState<'mias' | 'plantillas'>('mias');
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState<Filtro>('Todas');
  const jugadas = useBiblioteca((s) => s.jugadas);
  const actualId = useEditor((s) => s.jugada.id);
  const entrada = useRef<HTMLInputElement>(null);

  // Vista previa de cada plantilla (se construye una sola vez).
  const previas = useMemo(() => PLANTILLAS.map((p) => ({ p, vista: construirPlantilla(p) })), []);

  const q = sinTildes(busqueda.trim());
  const mias = jugadas
    .filter((j) => coincide(j, q, categoria))
    .sort((a, b) => b.editada - a.editada);
  const plantillas = previas.filter(({ p }) => coincide({ ...p, notas: p.descripcion }, q, categoria));

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
              nuevaJugada();
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
        <button role="tab" aria-selected={pestana === 'plantillas'} onClick={() => setPestana('plantillas')}>
          Plantillas ({PLANTILLAS.length})
        </button>
      </div>
      <div className="filtros">
        <input
          type="search"
          className="buscador"
          placeholder="Buscar por nombre, etiqueta o nota"
          aria-label="Buscar jugadas"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <div className="chips" role="group" aria-label="Filtrar por categoría">
          {(['Todas', ...CATEGORIAS] as Filtro[]).map((c) => (
            <button key={c} className="chip" aria-pressed={categoria === c} onClick={() => setCategoria(c)}>
              {c}
            </button>
          ))}
        </div>
      </div>
      {pestana === 'mias' ? (
        mias.length ? (
          <ul className="lista-tarjetas">
            {mias.map((j) => (
              <TarjetaJugada key={j.id} j={j} actual={j.id === actualId} alAbrir={(p) => abrir(j, p)} />
            ))}
          </ul>
        ) : (
          <p className="vacio">No hay jugadas que coincidan. Prueba con otra búsqueda o empieza desde una plantilla.</p>
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
    </Dialogo>
  );
}
