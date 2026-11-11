import { useEffect, useRef, useState } from 'react';
import type { Orientacion } from '../modelo/tipos';
import { useEditor } from '../estado/editorStore';
import {
  alternarReproduccion,
  cortarAnimacion,
  detener,
  pasoAnterior,
  pasoSiguiente,
  useReproduccion,
} from '../animacion/reproductor';
import { interpolar } from '../animacion/interpolar';
import { CanchaEstatica } from '../cancha/CanchaEstatica';
import { ControlesReproduccion } from './LineaTiempo';
import { Leyenda } from './Leyenda';
import { IconoCerrar, IconoNotas, IconoRotar } from './Iconos';

function useRetrato() {
  const [retrato, setRetrato] = useState(() => window.innerHeight > window.innerWidth);
  useEffect(() => {
    const alCambiar = () => setRetrato(window.innerHeight > window.innerWidth);
    window.addEventListener('resize', alCambiar);
    return () => window.removeEventListener('resize', alCambiar);
  }, []);
  return retrato;
}

/** Pantalla completa para TV, proyector o un celular que pasa de mano en mano. */
export function ModoPresentacion() {
  const jugada = useEditor((s) => s.jugada);
  const pasoActual = useEditor((s) => s.pasoActual);
  const posicion = useReproduccion((s) => s.posicion);
  const retrato = useRetrato();
  // Por defecto se acomoda al aparato: vertical si la pantalla es más alta que ancha.
  const [forzada, setForzada] = useState<Orientacion | null>(null);
  const [verNotas, setVerNotas] = useState(false);
  const orientacion: Orientacion = forzada ?? (retrato ? 'vertical' : 'horizontal');

  const salir = () => {
    detener();
    useEditor.getState().setPresentando(false);
  };

  // Pantalla completa del navegador (si existe; en iPhone se usa toda la ventana).
  useEffect(() => {
    const raiz = document.documentElement;
    let entro = false;
    if (!document.fullscreenElement && raiz.requestFullscreen) {
      raiz
        .requestFullscreen()
        .then(() => {
          entro = true;
        })
        .catch(() => {});
    }
    const alCambiar = () => {
      // Si el usuario sale de pantalla completa (Esc), también sale de la presentación.
      if (entro && !document.fullscreenElement) {
        cortarAnimacion();
        useEditor.getState().setPresentando(false);
      }
    };
    document.addEventListener('fullscreenchange', alCambiar);
    return () => {
      document.removeEventListener('fullscreenchange', alCambiar);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);

  useEffect(() => {
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') pasoSiguiente();
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') pasoAnterior();
      else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        alternarReproduccion();
      } else if (e.key === 'Escape') salir();
    };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, []);

  // Deslizar el dedo: izquierda = siguiente, derecha = anterior.
  const inicio = useRef<{ x: number; y: number } | null>(null);

  const n = jugada.pasos.length;
  const activo = posicion !== null ? Math.round(posicion) : pasoActual;
  const cuadro = posicion !== null ? interpolar(jugada.pasos, posicion) : { paso: jugada.pasos[pasoActual], opacidadFlechas: 1 };

  return (
    <div className="presentacion">
      <header className="pres-cabecera">
        <h1>{jugada.nombre}</h1>
        <span className="pres-paso" aria-live="polite">
          Paso {activo + 1} / {n}
        </span>
        {jugada.notas.trim() && (
          <button
            className="boton-pres solo-icono"
            aria-pressed={verNotas}
            onClick={() => setVerNotas(!verNotas)}
            aria-label="Notas del entrenador"
            title="Notas del entrenador"
          >
            <IconoNotas />
          </button>
        )}
        <button
          className="boton-pres solo-icono"
          onClick={() => setForzada(orientacion === 'vertical' ? 'horizontal' : 'vertical')}
          aria-label="Rotar cancha"
          title="Rotar cancha"
        >
          <IconoRotar />
        </button>
        <button className="boton-pres solo-icono" onClick={salir} aria-label="Salir de la presentación" title="Salir (Esc)">
          <IconoCerrar />
        </button>
      </header>
      <div
        className="pres-cancha"
        onPointerDown={(e) => {
          inicio.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          const s = inicio.current;
          inicio.current = null;
          if (!s) return;
          const dx = e.clientX - s.x;
          const dy = e.clientY - s.y;
          if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            if (dx < 0) pasoSiguiente();
            else pasoAnterior();
          }
        }}
      >
        <CanchaEstatica
          paso={cuadro.paso}
          vista={jugada.vista}
          lado={jugada.lado}
          orientacion={orientacion}
          opacidadFlechas={cuadro.opacidadFlechas}
          className="pres-svg"
        />
        <Leyenda />
        {verNotas && (
          <div className="pres-notas" onPointerDown={(e) => e.stopPropagation()}>
            <h2>Notas del entrenador</h2>
            <p>{jugada.notas}</p>
          </div>
        )}
      </div>
      <footer className="pres-controles">
        <ControlesReproduccion grande />
      </footer>
    </div>
  );
}
