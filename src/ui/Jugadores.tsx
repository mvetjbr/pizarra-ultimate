import type { Equipo } from '../modelo/tipos';
import type { Proporcion } from '../modelo/fabrica';
import { pasoActivo, useEditor } from '../estado/editorStore';
import { aplicarProporcion, fijarCantidad, proporcionDe } from '../estado/jugadores';
import { usePreferencias } from '../estado/preferencias';
import { Dialogo } from './Dialogo';
import { ubicarFormacion, type Carril, type Formacion } from '../modelo/formaciones';
import { avisar } from '../estado/avisos';

const FORMACIONES: { id: Formacion; nombre: string }[] = [
  { id: 'vertical', nombre: 'Stack vertical' },
  { id: 'horizontal', nombre: 'Stack horizontal' },
];
const CARRILES: { id: Carril; nombre: string }[] = [
  { id: 'izquierda', nombre: 'Izquierda' },
  { id: 'centro', nombre: 'Centro' },
  { id: 'derecha', nombre: 'Derecha' },
];

/** Formación del ataque: acomoda el paso abierto y queda para las jugadas nuevas. */
function FormacionAtaque() {
  const formacion = usePreferencias((s) => s.formacion);
  const carril = usePreferencias((s) => s.carril);
  const pasoActual = useEditor((s) => s.pasoActual);
  const aplicar = (f: Formacion, c: Carril) => {
    usePreferencias.getState().actualizar({ formacion: f, carril: c });
    useEditor.getState().cambiar((_, paso) => ubicarFormacion(paso, f, c));
    avisar(`Paso ${pasoActual + 1}: ataque en ${f === 'vertical' ? 'stack vertical' : 'stack horizontal'} (${c}). Deshacer lo devuelve.`);
  };
  return (
    <>
      <div className="campo">
        <span>Formación del ataque</span>
        <div className="segmentado" role="group" aria-label="Formación del ataque">
          {FORMACIONES.map((f) => (
            <button key={f.id} type="button" aria-pressed={formacion === f.id} onClick={() => aplicar(f.id, carril)}>
              {f.nombre}
            </button>
          ))}
        </div>
      </div>
      <div className="campo">
        <span>Lado (mirando hacia donde ataca)</span>
        <div className="segmentado" role="group" aria-label="Lado de la formación">
          {CARRILES.map((c) => (
            <button key={c.id} type="button" aria-pressed={carril === c.id} onClick={() => aplicar(formacion, c.id)}>
              {c.nombre}
            </button>
          ))}
        </div>
      </div>
      <p className="nota">
        Acomoda a los jugadores del paso {pasoActual + 1} (la defensa marca a su atacante) y queda para las jugadas nuevas.
      </p>
    </>
  );
}

const NUMEROS = [0, 1, 2, 3, 4, 5, 6, 7];
const PROPORCIONES: { id: Proporcion; nombre: string; ayuda: string }[] = [
  { id: 'M', nombre: '4♂ 3♀', ayuda: '4 hombres y 3 mujeres' },
  { id: 'F', nombre: '3♂ 4♀', ayuda: '3 hombres y 4 mujeres' },
  { id: 'N', nombre: 'Sin género', ayuda: 'Sin indicador de match' },
];

function Cantidad({ equipo, nombre }: { equipo: Equipo; nombre: string }) {
  const n = useEditor((s) => pasoActivo(s).jugadores.filter((j) => j.equipo === equipo).length);
  return (
    <div className="campo">
      <span>{nombre}</span>
      <div className="segmentado numeros" role="group" aria-label={`Cantidad de jugadores de ${nombre.toLowerCase()}`}>
        {NUMEROS.map((k) => (
          <button key={k} type="button" aria-pressed={n === k} onClick={() => fijarCantidad(equipo, k)}>
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Cantidad de jugadores (0 a 7 por equipo) y proporción de match de la jugada abierta. */
export function Jugadores({ alCerrar }: { alCerrar: () => void }) {
  const actual = useEditor((s) => proporcionDe(pasoActivo(s)));
  const preferida = usePreferencias((s) => s.proporcion);
  const conRoster = useEditor((s) => pasoActivo(s).jugadores.some((j) => j.rosterId));
  const marcada = actual ?? (useEditor.getState().jugada.pasos[0].jugadores.length === 0 ? preferida : null);

  return (
    <Dialogo titulo="Jugadores y formación" alCerrar={alCerrar} pie={<button className="boton-texto primario" onClick={alCerrar}>Listo</button>}>
      <div className="formulario">
        <FormacionAtaque />
        <Cantidad equipo="ataque" nombre="Ataque" />
        <Cantidad equipo="defensa" nombre="Defensa" />
        <p className="nota">
          Cambia la jugada abierta (en todos sus pasos) y queda como cantidad para las jugadas nuevas. Al bajar la
          cantidad se quitan los de número más alto, con sus flechas.
        </p>
        <div className="campo">
          <span>Proporción (mixto)</span>
          <div className="segmentado" role="group" aria-label="Proporción de hombres y mujeres">
            {PROPORCIONES.map((p) => (
              <button key={p.id} type="button" aria-pressed={marcada === p.id} title={p.ayuda} onClick={() => aplicarProporcion(p.id)}>
                {p.nombre}
              </button>
            ))}
          </div>
        </div>
        <p className="nota">
          Asigna el match en orden de número, en ataque y en defensa, y queda para las jugadas nuevas.
          {conRoster && ' Los jugadores asignados desde el roster conservan su match.'} Cada ficha se puede cambiar
          después tocándola.
        </p>
      </div>
    </Dialogo>
  );
}
