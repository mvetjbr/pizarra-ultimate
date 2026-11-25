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
import { Conteo } from './conteo/Conteo';
import { AvisoPremio } from './conteo/ElegirMascota';
import { useRuta } from './estado/ruta';
import { useSesion } from './nube/sesion';
import { PantallaLegal } from './ui/cuenta/PantallaLegal';
import { Cuenta, NuevaContrasena } from './ui/cuenta/Cuenta';
import { MisDatos } from './ui/cuenta/MisDatos';
import { ReAceptar } from './ui/cuenta/ReAceptar';
import { Admin } from './ui/cuenta/Admin';
import { AbrirEnlace, BannerCompartida, useEnlacePendiente } from './ui/AbrirEnlace';
import { decidirSubida, useNube } from './nube/jugadas';
import { Dialogo } from './ui/Dialogo';
import { PantallaInicio } from './ui/cuenta/Inicio';
import { useInicio } from './estado/inicio';
import { hayServidor } from './nube/cliente';

/** Primera vez con cuenta en este dispositivo: ¿subir las jugadas que ya había? */
function PreguntaSubir() {
  const n = useNube((s) => s.porSubir);
  if (!n) return null;
  return (
    <Dialogo
      titulo="Guardar tus jugadas en tu cuenta"
      alCerrar={() => void decidirSubida(false)}
      pie={
        <>
          <button className="boton-texto primario" onClick={() => void decidirSubida(true)}>
            Sí, guardarlas en mi cuenta
          </button>
          <button className="boton-texto" onClick={() => void decidirSubida(false)}>
            No, dejarlas solo aquí
          </button>
        </>
      }
    >
      <p>
        Este dispositivo tiene {n} {n === 1 ? 'jugada guardada' : 'jugadas guardadas'} sin cuenta. Si las guardas en tu cuenta,
        las verás en tus otros dispositivos y podrás compartirlas.
      </p>
    </Dialogo>
  );
}

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
      if (/^#\/(legal|cuenta|mis-datos)/.test(location.hash)) return; // páginas fuera del editor
      if (document.querySelector('.inicio')) return; // pantalla de inicio
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
  const ruta = useRuta();
  const recuperando = useSesion((s) => s.recuperandoContrasena);
  const debeAceptar = useSesion((s) => !!s.usuario && s.pendientes.length > 0);
  const sesionLista = useSesion((s) => s.listo);
  const conUsuario = useSesion((s) => !!s.usuario);
  const omitioInicio = useInicio((s) => s.omitido);
  // El inicio sale a quien no ha ingresado ni lo ha omitido en este dispositivo (solo si hay cuentas).
  const pideInicio = hayServidor && !omitioInicio && !conUsuario;
  useAtajosTeclado();
  useEnlacePendiente();

  // Las páginas legales son públicas: se muestran aunque la app aún esté cargando datos.
  if (ruta.pantalla === 'legal') return <PantallaLegal tipo={ruta.tipo} version={ruta.version} />;
  if (recuperando)
    return (
      <>
        <NuevaContrasena />
        <Aviso />
      </>
    );
  if (ruta.pantalla === 'cuenta')
    return (
      <>
        <Cuenta modo={ruta.modo} />
        <Aviso />
      </>
    );
  if (ruta.pantalla === 'admin')
    return (
      <>
        <Admin />
        <Aviso />
      </>
    );
  if (ruta.pantalla === 'enlace')
    return (
      <>
        <AbrirEnlace token={ruta.token} />
        <Aviso />
      </>
    );
  if (ruta.pantalla === 'mis-datos')
    return (
      <>
        <MisDatos />
        {debeAceptar && <ReAceptar />}
        <Aviso />
      </>
    );
  if (!cargado || (pideInicio && !sesionLista)) return <div className="cargando">Cargando…</div>;
  if (pideInicio)
    return (
      <>
        <PantallaInicio />
        <Aviso />
      </>
    );
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
          <BannerCompartida />
          <main className="lienzo">
            <Pizarra />
            <Leyenda plegable />
            <Conteo />
            <Ayuda />
            <PanelPropiedades />
          </main>
          <LineaTiempo />
        </div>
      </div>
      {debeAceptar ? <ReAceptar /> : <PreguntaSubir />}
      <AvisoPremio />
      <Aviso />
    </div>
  );
}
