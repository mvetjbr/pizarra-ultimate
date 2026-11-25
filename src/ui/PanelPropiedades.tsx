import { useState, type ReactNode } from 'react';
import type { Match, Play, Step, TipoFlecha } from '../modelo/tipos';
import { OFFSET_DISCO, posDisco } from '../modelo/geometria';
import { pasoActivo, useEditor } from '../estado/editorStore';
import { COLORES_ZONA } from '../estilos/colores';
import { IconoBorrar, IconoCerrar } from './Iconos';
import { useRoster } from '../estado/rosterStore';
import { useVentana } from '../estado/ventanas';
import { cambiarJugadorEnTodos, datosDeMiembro } from './Roster';

/** Campo de texto: toda la edición queda como un solo paso de deshacer. */
function CampoTexto({
  etiqueta,
  valor,
  alCambiar,
  multilinea,
  maxLength,
  autoFocus,
}: {
  etiqueta: string;
  valor: string;
  alCambiar: (paso: Step, v: string, jugada: Play) => void;
  multilinea?: boolean;
  maxLength?: number;
  autoFocus?: boolean;
}) {
  const st = useEditor.getState;
  const props = {
    value: valor,
    maxLength,
    autoFocus,
    onFocus: (e: { target: HTMLInputElement | HTMLTextAreaElement }) => {
      st().iniciarGesto();
      if (autoFocus) e.target.select();
    },
    onChange: (e: { target: HTMLInputElement | HTMLTextAreaElement }) => {
      const v = e.target.value;
      st().moverGesto((jugada, paso) => alCambiar(paso, v, jugada));
    },
    onBlur: () => st().terminarGesto(),
  };
  return (
    <label className="campo">
      <span>{etiqueta}</span>
      {multilinea ? <textarea rows={2} {...props} /> : <input {...props} />}
    </label>
  );
}

function Opciones<T extends string>({
  valor,
  opciones,
  alElegir,
  etiqueta,
}: {
  valor: T | undefined;
  opciones: { id: T; nombre: string }[];
  alElegir: (v: T) => void;
  etiqueta: string;
}) {
  return (
    <div className="campo">
      <span>{etiqueta}</span>
      <div className="segmentado">
        {opciones.map((o) => (
          <button key={o.id} aria-pressed={valor === o.id} onClick={() => alElegir(o.id)}>
            {o.nombre}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PanelPropiedades() {
  const sel = useEditor((s) => s.seleccion);
  const paso = useEditor(pasoActivo);
  const herramienta = useEditor((s) => s.herramienta);
  const formaZona = useEditor((s) => s.formaZona);
  const { cambiar, eliminar, seleccionar, setFormaZona } = useEditor.getState();
  const miembros = useRoster((s) => s.miembros);
  // Jugadores y flechas: burbuja pequeña; el panel completo solo si se pide con «⋯».
  const [expandido, setExpandido] = useState<string | null>(null);
  const claveSel = sel ? `${sel.tipo}:${sel.id}` : null;

  // Sin selección: opciones de la herramienta de zona.
  if (!sel) {
    if (herramienta !== 'zona') return null;
    return (
      <aside className="panel">
        <Opciones
          etiqueta="Forma de la zona"
          valor={formaZona}
          opciones={[
            { id: 'rect', nombre: 'Rectángulo' },
            { id: 'elipse', nombre: 'Elipse' },
          ]}
          alElegir={setFormaZona}
        />
      </aside>
    );
  }

  // El disco no necesita panel: se arrastra hasta un jugador para dárselo.
  if (sel.tipo === 'disco') return null;

  if ((sel.tipo === 'jugador' || sel.tipo === 'flecha') && expandido !== claveSel) {
    const f = sel.tipo === 'flecha' ? paso.flechas.find((x) => x.id === sel.id) : undefined;
    return (
      <div className="burbuja-seleccion" role="toolbar" aria-label="Acciones del elemento seleccionado">
        {f?.tipo === 'pase' && (
          <button
            aria-pressed={!!f.curva}
            title={f.curva ? 'Pase en curva (toca para hacerlo recto)' : 'Hacer el pase en curva'}
            onClick={() =>
              cambiar((_, p) => {
                const x = p.flechas.find((y) => y.id === sel.id);
                if (x) x.curva = !x.curva;
              })
            }
          >
            ⤴ Curva
          </button>
        )}
        <button className="borrar" onClick={() => eliminar(sel)} title="Eliminar" aria-label="Eliminar">
          <IconoBorrar />
        </button>
        <button onClick={() => setExpandido(claveSel)} title="Más opciones" aria-label="Más opciones">
          ⋯
        </button>
      </div>
    );
  }

  let titulo = '';
  let contenido: ReactNode = null;

  if (sel.tipo === 'jugador') {
    const j = paso.jugadores.find((x) => x.id === sel.id);
    if (!j) return null;
    titulo = j.equipo === 'ataque' ? 'Jugador de ataque' : 'Defensor';
    const tieneDisco = paso.disco.poseedorId === j.id;
    const miembro = miembros.find((m) => m.id === j.rosterId);
    contenido = (
      <>
        <label className="campo">
          <span>Jugador del roster</span>
          <select
            value={miembro?.id ?? ''}
            onChange={(e) => {
              const m = miembros.find((x) => x.id === e.target.value);
              cambiar((jug) =>
                cambiarJugadorEnTodos(jug, j.id, m ? datosDeMiembro(m) : { rosterId: undefined, nombre: undefined }),
              );
            }}
          >
            <option value="">— Sin asignar —</option>
            {miembros.map((m) => {
              const ocupado = paso.jugadores.some((x) => x.rosterId === m.id && x.id !== j.id);
              return (
                <option key={m.id} value={m.id} disabled={ocupado}>
                  {m.nombre} ({m.match}){ocupado ? ' · ya en cancha' : ''}
                </option>
              );
            })}
          </select>
        </label>
        {miembros.length === 0 && (
          <button className="boton-texto" onClick={() => useVentana.getState().abrir('roster')}>
            Crear el roster del equipo
          </button>
        )}
        <CampoTexto
          etiqueta="Número o iniciales"
          valor={j.etiqueta}
          maxLength={3}
          alCambiar={(_, v, jug) => cambiarJugadorEnTodos(jug, j.id, { etiqueta: v.toUpperCase() })}
        />
        <Opciones<Match | 'ninguno'>
          etiqueta="Match"
          valor={j.match ?? 'ninguno'}
          opciones={[
            { id: 'M', nombre: 'M' },
            { id: 'F', nombre: 'F' },
            { id: 'ninguno', nombre: '—' },
          ]}
          alElegir={(v) => cambiar((jug) => cambiarJugadorEnTodos(jug, j.id, { match: v === 'ninguno' ? undefined : v }))}
        />
        <button
          className="boton-texto"
          onClick={() =>
            cambiar((_, p) => {
              if (tieneDisco) {
                const d = posDisco(p);
                p.disco = { x: d.x, y: d.y };
              } else {
                p.disco = { x: j.x + OFFSET_DISCO.x, y: j.y + OFFSET_DISCO.y, poseedorId: j.id };
              }
            })
          }
        >
          {tieneDisco ? 'Soltar el disco' : 'Darle el disco'}
        </button>
      </>
    );
  } else if (sel.tipo === 'flecha') {
    const f = paso.flechas.find((x) => x.id === sel.id);
    if (!f) return null;
    titulo = 'Flecha';
    contenido = (
      <>
        <Opciones<TipoFlecha>
          etiqueta="Tipo"
          valor={f.tipo}
          opciones={[
            { id: 'corte', nombre: 'Corte' },
            { id: 'pase', nombre: 'Pase' },
            { id: 'defensa', nombre: 'Defensa' },
          ]}
          alElegir={(v) =>
            cambiar((_, p) => {
              const x = p.flechas.find((y) => y.id === sel.id);
              if (x) x.tipo = v;
            })
          }
        />
        {f.tipo === 'pase' && (
          <Opciones<'recta' | 'curva'>
            etiqueta="Trayectoria"
            valor={f.curva ? 'curva' : 'recta'}
            opciones={[
              { id: 'recta', nombre: 'Recta' },
              { id: 'curva', nombre: 'Curva' },
            ]}
            alElegir={(v) =>
              cambiar((_, p) => {
                const x = p.flechas.find((y) => y.id === sel.id);
                if (x) x.curva = v === 'curva';
              })
            }
          />
        )}
        {f.tipo === 'pase' && f.curva && <p className="nota">Arrastra el punto celeste: el disco pasará justo por donde lo dejes (IO, OI, hammer).</p>}
      </>
    );
  } else if (sel.tipo === 'zona') {
    const z = paso.zonas.find((x) => x.id === sel.id);
    if (!z) return null;
    titulo = 'Zona';
    contenido = (
      <>
        <CampoTexto
          etiqueta="Texto"
          valor={z.texto ?? ''}
          alCambiar={(p, v) => {
            const x = p.zonas.find((y) => y.id === sel.id);
            if (x) x.texto = v;
          }}
        />
        <Opciones
          etiqueta="Forma"
          valor={z.forma}
          opciones={[
            { id: 'rect', nombre: 'Rectángulo' },
            { id: 'elipse', nombre: 'Elipse' },
          ]}
          alElegir={(v) =>
            cambiar((_, p) => {
              const x = p.zonas.find((y) => y.id === sel.id);
              if (x) x.forma = v;
            })
          }
        />
        <div className="campo">
          <span>Color</span>
          <div className="colores">
            {COLORES_ZONA.map((c) => (
              <button
                key={c.valor}
                className="muestra"
                style={{ background: c.valor }}
                aria-label={c.nombre}
                aria-pressed={z.color === c.valor}
                onClick={() =>
                  cambiar((_, p) => {
                    const x = p.zonas.find((y) => y.id === sel.id);
                    if (x) x.color = c.valor;
                  })
                }
              />
            ))}
          </div>
        </div>
      </>
    );
  } else if (sel.tipo === 'texto') {
    const t = paso.textos.find((x) => x.id === sel.id);
    if (!t) return null;
    titulo = 'Nota';
    contenido = (
      <CampoTexto
        key={t.id}
        etiqueta="Texto"
        valor={t.texto}
        multilinea
        autoFocus={t.texto === 'Nota'}
        alCambiar={(p, v) => {
          const x = p.textos.find((y) => y.id === sel.id);
          if (x) x.texto = v;
        }}
      />
    );
  }

  return (
    <aside className="panel" aria-label="Propiedades">
      <div className="panel-cabecera">
        <h2>{titulo}</h2>
        <button className="boton-icono pequeno" onClick={() => seleccionar(null)} aria-label="Cerrar">
          <IconoCerrar />
        </button>
      </div>
      {contenido}
      <button className="boton-texto peligro" onClick={() => eliminar(sel)}>
        Eliminar
      </button>
    </aside>
  );
}
