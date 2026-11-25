import { useCallback, useEffect, useState } from 'react';
import { avisar } from '../estado/avisos';
import {
  cambiarPermiso,
  crearEnlaceNube,
  desactivarEnlace,
  enlacesActivos,
  personasConAcceso,
  quitarAcceso,
  urlEnlace,
  type EnlaceActivo,
  type Permiso,
  type PersonaConAcceso,
  type TipoRecurso,
} from '../nube/compartir';

const fecha = (s: string) => new Date(s).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
const NOMBRE_APP = 'Pizarra Ultimate';

async function copiarTexto(t: string) {
  try {
    await navigator.clipboard.writeText(t);
    avisar('Enlace copiado');
  } catch {
    window.prompt('Copia el enlace:', t);
  }
}

/** Panel "Compartir" de la sección 3.2: crear enlace, personas con acceso y enlaces activos. Solo el dueño. */
export function PanelCompartir({ tipo, id, titulo }: { tipo: TipoRecurso; id: string; titulo: string }) {
  const [permiso, setPermiso] = useState<Permiso>('ver');
  const [dias, setDias] = useState<'' | '1' | '7' | '30'>('');
  const [ocupado, setOcupado] = useState(false);
  const [personas, setPersonas] = useState<PersonaConAcceso[]>([]);
  const [enlaces, setEnlaces] = useState<EnlaceActivo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const nombreTipo = tipo === 'play' ? 'la jugada' : 'el libro de jugadas';

  const cargar = useCallback(async () => {
    try {
      const [p, e] = await Promise.all([personasConAcceso(tipo, id), enlacesActivos(tipo, id)]);
      setPersonas(p ?? []);
      setEnlaces(e);
      setError(null);
    } catch (e) {
      // Si aún no está en la nube no hay accesos que mostrar.
      setPersonas([]);
      setEnlaces([]);
      if (!/Solo quien/.test((e as Error).message)) setError((e as Error).message);
    }
  }, [tipo, id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const crear = async (compartirYa: boolean) => {
    setOcupado(true);
    try {
      const url = await crearEnlaceNube(tipo, id, permiso, dias ? (Number(dias) as 1 | 7 | 30) : null);
      const texto = `Te comparto ${nombreTipo} "${titulo}" en ${NOMBRE_APP}: ${url}`;
      if (compartirYa && typeof navigator.share === 'function') {
        try {
          await navigator.share({ title: titulo, text: texto });
        } catch (e) {
          if ((e as DOMException)?.name !== 'AbortError') await copiarTexto(url);
        }
      } else {
        await copiarTexto(url);
      }
      await cargar();
    } catch (e) {
      avisar((e as Error).message, true);
    } finally {
      setOcupado(false);
    }
  };

  const accion = async (fn: () => Promise<void>, ok: string) => {
    try {
      await fn();
      avisar(ok);
      await cargar();
    } catch (e) {
      avisar((e as Error).message, true);
    }
  };

  return (
    <section className="panel-compartir" aria-label="Compartir con permisos">
      <h3>Compartir con otras personas</h3>
      <p className="nota">
        Quien abra el enlace necesita una cuenta. Solo verá tu apodo, nunca tu correo. Puedes quitar el acceso cuando quieras.
      </p>
      <div className="fila-opciones">
        <label className="campo">
          Permiso
          <select value={permiso} onChange={(e) => setPermiso(e.target.value as Permiso)}>
            <option value="ver">Puede ver</option>
            <option value="editar">Puede editar</option>
          </select>
        </label>
        <label className="campo">
          Vence
          <select value={dias} onChange={(e) => setDias(e.target.value as typeof dias)}>
            <option value="">Sin vencimiento</option>
            <option value="1">En 1 día</option>
            <option value="7">En 7 días</option>
            <option value="30">En 30 días</option>
          </select>
        </label>
      </div>
      <div className="fila-botones">
        {typeof navigator.share === 'function' && (
          <button className="boton-texto primario" disabled={ocupado} onClick={() => crear(true)}>
            Compartir por WhatsApp u otra app
          </button>
        )}
        <button className="boton-texto" disabled={ocupado} onClick={() => crear(false)}>
          Crear y copiar enlace
        </button>
      </div>
      {error && <p className="nota error">{error}</p>}

      <h4>Personas con acceso</h4>
      {personas.length === 0 ? (
        <p className="nota">Todavía nadie. Cuando alguien abra tu enlace aparecerá aquí.</p>
      ) : (
        <ul className="lista-accesos">
          {personas.map((p) => (
            <li key={p.share_id}>
              <span>
                <strong>{p.nombre}</strong>
                <small>desde {fecha(p.desde)} · último uso {fecha(p.ultimo_uso)}</small>
              </span>
              <select
                aria-label={`Permiso de ${p.nombre}`}
                value={p.permiso}
                onChange={(e) => accion(() => cambiarPermiso(p.share_id, e.target.value as Permiso), 'Permiso cambiado')}
              >
                <option value="ver">Puede ver</option>
                <option value="editar">Puede editar</option>
              </select>
              <button className="boton-texto peligro" onClick={() => accion(() => quitarAcceso(p.share_id), 'Acceso quitado')}>
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}

      <h4>Enlaces activos</h4>
      {enlaces.length === 0 ? (
        <p className="nota">No hay enlaces activos.</p>
      ) : (
        <ul className="lista-accesos">
          {enlaces.map((l) => (
            <li key={l.id}>
              <span>
                <strong>{l.permiso === 'editar' ? 'Puede editar' : 'Puede ver'}</strong>
                <small>
                  creado {fecha(l.creado)} · {l.expira ? `vence ${fecha(l.expira)}` : 'sin vencimiento'} · {l.usos}{' '}
                  {l.usos === 1 ? 'uso' : 'usos'}
                </small>
              </span>
              <button className="boton-texto" onClick={() => copiarTexto(urlEnlace(l.token))}>
                Copiar
              </button>
              <button className="boton-texto peligro" onClick={() => accion(() => desactivarEnlace(l.id), 'Enlace desactivado')}>
                Desactivar
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
