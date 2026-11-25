import { useEffect, useRef } from 'react';
import { useEditor } from '../estado/editorStore';
import { useVentana } from '../estado/ventanas';
import { avisar } from '../estado/avisos';
import { irA, volverAlEditor } from '../estado/ruta';
import { useSesion } from '../nube/sesion';
import { abrirEnlaceNube, abrirJugadaCompartida, copiarJugada } from '../nube/compartir';
import { useDestinoBiblioteca } from './Biblioteca';
import { pedirReporte } from './Nube';

// Si quien abre el enlace no tiene sesión, se guarda el token y se abre al ingresar
// (también si llega desde el correo de verificación, en otra pestaña).
const CLAVE = 'pizarra:enlace-pendiente';
const guardarPendiente = (token: string) => {
  try {
    localStorage.setItem(CLAVE, JSON.stringify({ token, hasta: Date.now() + 86_400_000 }));
  } catch {
    /* sin almacenamiento: tocará abrir el enlace otra vez */
  }
};
const leerPendiente = (): string | null => {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as { token: string; hasta: number } | null;
    return v && v.hasta > Date.now() ? v.token : null;
  } catch {
    return null;
  }
};
const borrarPendiente = () => {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    /* nada */
  }
};

async function procesar(token: string) {
  borrarPendiente();
  try {
    const r = await abrirEnlaceNube(token);
    if (!r) {
      avisar('Este enlace ya no está disponible. Pídele a quien te lo envió uno nuevo.', true);
      return;
    }
    if (r.tipo === 'play') {
      await abrirJugadaCompartida(r.recurso_id);
      avisar(r.permiso === 'dueno' ? 'Es tu propia jugada.' : `"${r.titulo}" de ${r.autor} está en "Compartido conmigo".`);
    } else {
      useDestinoBiblioteca.setState({ pestana: 'compartido', libro: r.recurso_id });
      useVentana.getState().abrir('biblioteca');
    }
  } catch (e) {
    avisar((e as Error).message, true);
  }
}

/** Pantalla de paso para #/c/<token>. */
export function AbrirEnlace({ token }: { token: string }) {
  const listo = useSesion((s) => s.listo);
  const usuario = useSesion((s) => s.usuario);
  const hecho = useRef(false);
  useEffect(() => {
    if (!listo || hecho.current) return;
    hecho.current = true;
    if (!usuario) {
      guardarPendiente(token);
      avisar('Ingresa o crea tu cuenta para abrir lo que te compartieron.');
      irA('/cuenta/registro');
      return;
    }
    volverAlEditor();
    void procesar(token);
  }, [listo, usuario, token]);
  return <div className="cargando">Abriendo lo que te compartieron…</div>;
}

/** Abre el enlace pendiente cuando la persona termina de ingresar o registrarse. */
export function useEnlacePendiente() {
  const usuario = useSesion((s) => s.usuario);
  const perfil = useSesion((s) => s.perfil);
  const cargado = useEditor((s) => s.cargado);
  useEffect(() => {
    if (!usuario || !perfil || !cargado) return;
    const token = leerPendiente();
    if (token && !/^#\/(cuenta|c\/)/.test(location.hash)) void procesar(token);
  }, [usuario, perfil, cargado]);
}

/** Franja sobre la cancha cuando la jugada abierta es de otra persona. */
export function BannerCompartida() {
  const c = useEditor((s) => s.compartida);
  if (!c) return null;
  return (
    <div className="banner-compartida" role="status">
      <span>
        Jugada de <strong>{c.autor}</strong> ·{' '}
        {c.permiso === 'editar' ? 'Puedes editar (se guarda para ambos)' : 'Puedes ver: tus cambios no se guardan'}
      </span>
      <button
        className="boton-texto"
        onClick={async () => {
          try {
            const copia = await copiarJugada(c.id);
            if (copia) {
              useEditor.getState().reemplazar(copia, false);
              avisar(`Copia guardada en tus jugadas. Ahora estás editando tu copia.`);
            } else avisar('Copia guardada en tus jugadas.');
          } catch (e) {
            avisar((e as Error).message, true);
          }
        }}
      >
        Guardar una copia
      </button>
      <button className="boton-texto peligro" onClick={() => pedirReporte('play', c.id)}>
        Reportar
      </button>
    </div>
  );
}
