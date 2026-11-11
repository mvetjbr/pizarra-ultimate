import { memo, useEffect, useRef } from 'react';
import type { Lado, Step, Vista } from '../modelo/tipos';
import { useEditor } from '../estado/editorStore';
import {
  alternarReproduccion,
  cortarAnimacion,
  pasoAnterior,
  pasoSiguiente,
  setVelocidad,
  useReproduccion,
  VELOCIDADES,
} from '../animacion/reproductor';
import { CanchaEstatica } from '../cancha/CanchaEstatica';
import { IconoBorrar } from './Iconos';
import {
  IconoAnterior,
  IconoDerecha,
  IconoDuplicar,
  IconoIzquierda,
  IconoPausa,
  IconoPlay,
  IconoPresentar,
  IconoSiguiente,
} from './IconosReproduccion';

const Miniatura = memo(function Miniatura({
  paso,
  vista,
  lado,
  numero,
  activa,
  alTocar,
}: {
  paso: Step;
  vista: Vista;
  lado: Lado;
  numero: number;
  activa: boolean;
  alTocar: (i: number) => void;
}) {
  return (
    <button
      className={`miniatura${activa ? ' activa' : ''}`}
      onClick={() => alTocar(numero - 1)}
      aria-label={`Paso ${numero}`}
      aria-current={activa ? 'step' : undefined}
    >
      <CanchaEstatica paso={paso} vista={vista} lado={lado} orientacion="horizontal" className="miniatura-svg" sinNombres />
      <span className="miniatura-num">{numero}</span>
    </button>
  );
});

export function ControlesReproduccion({ grande = false }: { grande?: boolean }) {
  const n = useEditor((s) => s.jugada.pasos.length);
  const pasoActual = useEditor((s) => s.pasoActual);
  const posicion = useReproduccion((s) => s.posicion);
  const reproduciendo = useReproduccion((s) => s.reproduciendo);
  const velocidad = useReproduccion((s) => s.velocidad);
  const activo = posicion !== null ? Math.round(posicion) : pasoActual;
  const tam = grande ? 32 : 22;
  const clase = grande ? 'boton-pres' : 'boton-icono';
  return (
    <div className="controles-reproduccion">
      <button className={clase} onClick={pasoAnterior} disabled={activo <= 0} aria-label="Paso anterior" title="Paso anterior (←)">
        <IconoAnterior tam={tam} />
        {grande && <span>Anterior</span>}
      </button>
      <button
        className={`${clase} primario`}
        onClick={alternarReproduccion}
        disabled={n < 2}
        aria-label={reproduciendo ? 'Pausar' : 'Reproducir'}
        title={reproduciendo ? 'Pausar (espacio)' : 'Reproducir (espacio)'}
      >
        {reproduciendo ? <IconoPausa tam={tam} /> : <IconoPlay tam={tam} />}
        {grande && <span>{reproduciendo ? 'Pausa' : 'Reproducir'}</span>}
      </button>
      <button className={clase} onClick={pasoSiguiente} disabled={activo >= n - 1} aria-label="Paso siguiente" title="Paso siguiente (→)">
        <IconoSiguiente tam={tam} />
        {grande && <span>Siguiente</span>}
      </button>
      <div className="segmentado velocidad" role="group" aria-label="Velocidad">
        {VELOCIDADES.map((v) => (
          <button key={v} aria-pressed={velocidad === v} onClick={() => setVelocidad(v)}>
            {v}x
          </button>
        ))}
      </div>
    </div>
  );
}

export function LineaTiempo() {
  const pasos = useEditor((s) => s.jugada.pasos);
  const vista = useEditor((s) => s.jugada.vista);
  const lado = useEditor((s) => s.jugada.lado);
  const pasoActual = useEditor((s) => s.pasoActual);
  const posicion = useReproduccion((s) => s.posicion);
  const activo = posicion !== null ? Math.round(posicion) : pasoActual;
  const lista = useRef<HTMLDivElement>(null);
  const n = pasos.length;

  useEffect(() => {
    lista.current?.querySelector('.miniatura.activa')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activo, n]);

  // Toda acción de edición corta la animación en curso.
  const accion = (fn: () => void) => () => {
    cortarAnimacion();
    fn();
  };
  const st = useEditor.getState();
  const tocarMiniatura = (i: number) => {
    cortarAnimacion();
    useEditor.getState().irAPaso(i);
  };

  return (
    <section className="linea-tiempo" aria-label="Pasos de la jugada">
      <ControlesReproduccion />
      <div className="lt-miniaturas" ref={lista}>
        {pasos.map((p, i) => (
          <Miniatura key={p.id} paso={p} vista={vista} lado={lado} numero={i + 1} activa={i === activo} alTocar={tocarMiniatura} />
        ))}
        <button
          className="miniatura agregar"
          onClick={accion(st.agregarPaso)}
          title="Nuevo paso: los jugadores terminan donde apuntan sus cortes y el disco llega al receptor"
        >
          <span aria-hidden="true">+</span> Paso
        </button>
      </div>
      <div className="lt-acciones">
        <button className="boton-icono" onClick={accion(st.duplicarPasoActual)} title="Duplicar paso" aria-label="Duplicar paso">
          <IconoDuplicar />
        </button>
        <button
          className="boton-icono"
          onClick={accion(() => st.moverPaso(activo, -1))}
          disabled={activo <= 0}
          title="Mover paso a la izquierda"
          aria-label="Mover paso a la izquierda"
        >
          <IconoIzquierda />
        </button>
        <button
          className="boton-icono"
          onClick={accion(() => st.moverPaso(activo, 1))}
          disabled={activo >= n - 1}
          title="Mover paso a la derecha"
          aria-label="Mover paso a la derecha"
        >
          <IconoDerecha />
        </button>
        <button
          className="boton-icono peligro"
          onClick={accion(() => st.eliminarPaso(activo))}
          disabled={n <= 1}
          title="Eliminar paso"
          aria-label="Eliminar paso"
        >
          <IconoBorrar />
        </button>
        <button className="boton-texto primario" onClick={accion(() => st.setPresentando(true))}>
          <IconoPresentar />
          <span>Presentar</span>
        </button>
      </div>
    </section>
  );
}
