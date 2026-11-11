import { useState } from 'react';
import type { Match, Play, Player } from '../modelo/tipos';
import { useEditor } from '../estado/editorStore';
import { etiquetaDe, useRoster, type MiembroRoster } from '../estado/rosterStore';
import { avisar } from '../estado/avisos';
import { Dialogo } from './Dialogo';

/**
 * Cambia un jugador (mismo id) en TODOS los pasos. Copia solo los pasos que toca,
 * para no modificar los objetos que guarda el historial.
 */
export function cambiarJugadorEnTodos(j: Play, id: string, cambios: Partial<Player>) {
  j.pasos = j.pasos.map((p) =>
    p.jugadores.some((x) => x.id === id)
      ? { ...p, jugadores: p.jugadores.map((x) => (x.id === id ? { ...x, ...cambios } : x)) }
      : p,
  );
}

export const datosDeMiembro = (m: MiembroRoster): Partial<Player> => ({
  rosterId: m.id,
  nombre: m.nombre,
  etiqueta: etiquetaDe(m),
  match: m.match,
});

function BotonesMatch({ valor, alElegir }: { valor: Match; alElegir: (m: Match) => void }) {
  return (
    <div className="segmentado" role="group" aria-label="Match">
      {(['M', 'F'] as const).map((m) => (
        <button key={m} type="button" aria-pressed={valor === m} onClick={() => alElegir(m)}>
          {m}
        </button>
      ))}
    </div>
  );
}

/** Roster del equipo: nombres reales, dorsal y match; y armado de la línea en cancha. */
export function Roster({ alCerrar }: { alCerrar: () => void }) {
  const miembros = useRoster((s) => s.miembros);
  const { agregar, actualizar, eliminar } = useRoster.getState();
  const [nombre, setNombre] = useState('');
  const [numero, setNumero] = useState('');
  const [match, setMatch] = useState<Match>('M');
  const [linea, setLinea] = useState<string[]>([]);

  const enLinea = miembros.filter((m) => linea.includes(m.id));
  const lm = enLinea.filter((m) => m.match === 'M').length;
  const lf = enLinea.length - lm;
  const totalM = miembros.filter((m) => m.match === 'M').length;

  const crear = () => {
    if (!nombre.trim()) return;
    agregar({ nombre: nombre.trim().slice(0, 40), numero: numero.trim().slice(0, 3) || undefined, match });
    setNombre('');
    setNumero('');
  };

  const alternarLinea = (id: string) =>
    setLinea((l) => (l.includes(id) ? l.filter((x) => x !== id) : l.length >= 7 ? l : [...l, id]));

  /** Asigna la línea elegida a los jugadores de ataque, en orden, en todos los pasos. */
  const ponerEnCancha = () => {
    const ataque = useEditor
      .getState()
      .jugada.pasos[0].jugadores.filter((j) => j.equipo === 'ataque')
      .slice(0, enLinea.length);
    useEditor.getState().cambiar((j) => {
      ataque.forEach((pl, i) => cambiarJugadorEnTodos(j, pl.id, datosDeMiembro(enLinea[i])));
    });
    avisar(`Línea en cancha: ${lm}M-${lf}F`);
    alCerrar();
  };

  return (
    <Dialogo
      titulo="Roster del equipo"
      alCerrar={alCerrar}
      grande
      pie={
        <>
          <span className={`proporcion${enLinea.length === 7 && Math.abs(lm - lf) !== 1 ? ' alerta' : ''}`}>
            Línea: {enLinea.length}/7 · {lm}M-{lf}F
          </span>
          <button className="boton-texto primario" disabled={enLinea.length === 0} onClick={ponerEnCancha}>
            Poner en el ataque
          </button>
        </>
      }
    >
      <form
        className="roster-nuevo"
        onSubmit={(e) => {
          e.preventDefault();
          crear();
        }}
      >
        <label className="campo crece">
          <span>Nombre</span>
          <input value={nombre} maxLength={40} placeholder="Ej. Laura Gómez" onChange={(e) => setNombre(e.target.value)} />
        </label>
        <label className="campo corto">
          <span>Dorsal</span>
          <input value={numero} maxLength={3} inputMode="numeric" placeholder="7" onChange={(e) => setNumero(e.target.value)} />
        </label>
        <div className="campo">
          <span>Match</span>
          <BotonesMatch valor={match} alElegir={setMatch} />
        </div>
        <button className="boton-texto primario" type="submit" disabled={!nombre.trim()}>
          Agregar
        </button>
      </form>

      <p className="nota">
        {miembros.length} en el roster · {totalM} M · {miembros.length - totalM} F. Marca hasta 7 en la columna «Línea» y
        pulsa «Poner en el ataque» para asignarlos a las fichas (en todos los pasos). También puedes asignar uno por uno
        tocando una ficha.
      </p>

      {miembros.length === 0 ? (
        <p className="vacio">Todavía no hay jugadores. Agrega el primero arriba.</p>
      ) : (
        <ul className="lista-roster">
          {miembros.map((m) => (
            <li key={m.id}>
              <label className="roster-linea" title="En la línea">
                <input
                  type="checkbox"
                  checked={linea.includes(m.id)}
                  disabled={!linea.includes(m.id) && linea.length >= 7}
                  onChange={() => alternarLinea(m.id)}
                  aria-label={`${m.nombre} en la línea`}
                />
              </label>
              <input
                className="roster-nombre"
                value={m.nombre}
                maxLength={40}
                aria-label="Nombre"
                onChange={(e) => actualizar(m.id, { nombre: e.target.value })}
              />
              <input
                className="roster-numero"
                value={m.numero ?? ''}
                maxLength={3}
                inputMode="numeric"
                aria-label="Dorsal"
                placeholder="#"
                onChange={(e) => actualizar(m.id, { numero: e.target.value || undefined })}
              />
              <BotonesMatch valor={m.match} alElegir={(v) => actualizar(m.id, { match: v })} />
              <button
                className="boton-icono pequeno peligro"
                aria-label={`Eliminar a ${m.nombre}`}
                onClick={() => {
                  if (window.confirm(`¿Quitar a ${m.nombre} del roster?`)) {
                    eliminar(m.id);
                    setLinea((l) => l.filter((x) => x !== m.id));
                  }
                }}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dialogo>
  );
}
