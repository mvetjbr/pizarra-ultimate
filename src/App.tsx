import { useEffect } from 'react';
import { useEditor, type Herramienta } from './estado/editorStore';
import { alternarReproduccion, cortarAnimacion, pasoAnterior, pasoSiguiente } from './animacion/reproductor';
import { Pizarra } from './cancha/Pizarra';
import { BarraSuperior } from './ui/BarraSuperior';
import { BarraHerramientas } from './ui/BarraHerramientas';
import { PanelPropiedades } from './ui/PanelPropiedades';
import { Ayuda, Leyenda } from './ui/Leyenda';
import { LineaTiempo } from './ui/LineaTiempo';
import { ModoPresentacion } from './ui/ModoPresentacion';
import { Aviso } from './ui/Aviso';

const ATAJOS: Record<string, Herramienta> = {
  v: 'seleccionar',
  c: 'corte',
  p: 'pase',
  d: 'defensa',
  z: 'zona',
  t: 'texto',
  b: 'borrar',
};

function useAtajosTeclado() {
  useEffect(() => {
    const alPresionar = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable="true"]')) return;
      const st = useEditor.getState();
      if (st.presentando) return; // la presentación tiene sus propios atajos
      if (document.querySelector('.fondo-dialogo')) return; // hay una ventana abierta
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === 'z' && !e.shiftKey) {
        e.preventDefault();
        cortarAnimacion();
        st.deshacer();
      } else if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) {
        e.preventDefault();
        cortarAnimacion();
        st.rehacer();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && st.seleccion) {
        e.preventDefault();
        st.eliminar(st.seleccion);
      } else if (e.key === 'Escape') {
        st.seleccionar(null);
      } else if (e.key === ' ' && !t.closest('button')) {
        e.preventDefault();
        alternarReproduccion();
      } else if (e.key === 'ArrowRight' && !st.seleccion) {
        pasoSiguiente();
      } else if (e.key === 'ArrowLeft' && !st.seleccion) {
        pasoAnterior();
      } else if (!mod && !e.altKey && ATAJOS[k]) {
        st.setHerramienta(ATAJOS[k]);
      }
    };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, []);
}

export default function App() {
  const cargado = useEditor((s) => s.cargado);
  const presentando = useEditor((s) => s.presentando);
  useAtajosTeclado();
  if (!cargado) return <div className="cargando">Cargando…</div>;
  if (presentando)
    return (
      <>
        <ModoPresentacion />
        <Aviso />
      </>
    );
  return (
    <div className="app">
      <BarraSuperior />
      <div className="cuerpo">
        <BarraHerramientas />
        <div className="columna">
          <main className="lienzo">
            <Pizarra />
            <Leyenda />
            <Ayuda />
            <PanelPropiedades />
          </main>
          <LineaTiempo />
        </div>
      </div>
      <Aviso />
    </div>
  );
}
