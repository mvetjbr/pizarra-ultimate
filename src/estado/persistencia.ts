import { get, set } from 'idb-keyval';
import type { Play } from '../modelo/tipos';
import { nuevoId } from '../modelo/fabrica';
import { normalizarJugada } from '../modelo/validar';
import { useEditor } from './editorStore';
import { useBiblioteca } from './bibliotecaStore';
import { extraerPreferencias, usePreferencias, type Preferencias } from './preferencias';
import { avisar } from './avisos';
import { mascotasDelSistemaViejo } from '../conteo/munecos';
import { useRoster, type MiembroRoster } from './rosterStore';
import { hayEnlace, leerEnlace, limpiarEnlace } from '../exportar/enlace';

const CLAVE_JUGADA = 'pizarra:jugada-actual';
const CLAVE_BIBLIOTECA = 'pizarra:biblioteca';
const CLAVE_PREFS = 'pizarra:preferencias';
const CLAVE_ROSTER = 'pizarra:roster';
const CLAVE_CARPETAS = 'pizarra:carpetas';

/** Abre una jugada recibida por enlace directamente en modo presentación. */
function abrirEnlaceCompartido() {
  if (!hayEnlace()) return;
  const j = leerEnlace();
  limpiarEnlace();
  if (!j) {
    avisar('El enlace no es válido o está incompleto.', true);
    return;
  }
  // Id nuevo para no pisar una jugada propia con el mismo id.
  useEditor.getState().reemplazar({ ...j, id: nuevoId(), editada: Date.now() }, false);
  useEditor.getState().setPresentando(true);
}

/** Carga lo guardado en IndexedDB y guarda automáticamente cada cambio. */
export async function iniciarPersistencia() {
  try {
    const guardadas = await get<unknown[]>(CLAVE_BIBLIOTECA);
    if (Array.isArray(guardadas)) {
      const jugadas = guardadas.map(normalizarJugada).filter((j): j is Play => j !== null);
      useBiblioteca.setState({ jugadas });
    }
  } catch (e) {
    console.warn('No se pudo leer la biblioteca', e);
  }
  try {
    const j = normalizarJugada(await get<unknown>(CLAVE_JUGADA));
    if (j) useEditor.getState().reemplazar(j, false);
  } catch (e) {
    console.warn('No se pudo leer la jugada guardada', e);
  }
  try {
    const p = await get<Partial<Preferencias>>(CLAVE_PREFS);
    if (p) {
      // Los colores de equipo ahora los pone el estilo elegido (ventana Estilos), ya no se guardan aquí.
      const resto: Record<string, unknown> = { ...p };
      delete resto.colorAtaque;
      delete resto.colorDefensa;
      usePreferencias.getState().actualizar(resto as Partial<Preferencias>);
    }
    // Sistema de premios (ADR 0013): quien venía del desbloqueo en orden conserva sus mascotas.
    if (!p || !Array.isArray(p.mascotasElegidas)) {
      const jugadas = useBiblioteca.getState().jugadas.length;
      usePreferencias.getState().actualizar({ mascotasElegidas: mascotasDelSistemaViejo(jugadas) });
    }
  } catch (e) {
    console.warn('No se pudieron leer las preferencias', e);
  }
  try {
    const c = await get<unknown>(CLAVE_CARPETAS);
    if (Array.isArray(c))
      useBiblioteca.setState({ carpetas: c.filter((x): x is string => typeof x === 'string').map((x) => x.slice(0, 40)) });
  } catch (e) {
    console.warn('No se pudieron leer las carpetas', e);
  }
  try {
    const r = await get<unknown>(CLAVE_ROSTER);
    if (Array.isArray(r)) {
      const miembros: MiembroRoster[] = r
        .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object')
        .map((m) => ({
          id: typeof m.id === 'string' ? m.id : nuevoId(),
          nombre: typeof m.nombre === 'string' ? m.nombre.slice(0, 40) : 'Sin nombre',
          numero: typeof m.numero === 'string' ? m.numero.slice(0, 3) : undefined,
          match: m.match === 'F' ? ('F' as const) : ('M' as const),
        }));
      useRoster.setState({ miembros });
    }
  } catch (e) {
    console.warn('No se pudo leer el roster', e);
  }
  // La jugada abierta siempre está en la biblioteca.
  useBiblioteca.getState().upsert(useEditor.getState().jugada);

  // --- Guardado automático ---
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const guardarYa = () => {
    clearTimeout(temporizador);
    temporizador = undefined;
    // Una jugada compartida por otra persona no se mezcla con la biblioteca propia.
    if (useEditor.getState().compartida) return;
    const j = useEditor.getState().jugada;
    useBiblioteca.getState().upsert(j);
    set(CLAVE_JUGADA, j).catch((e) => console.warn('No se pudo guardar', e));
  };
  useEditor.subscribe((s, prev) => {
    if (s.jugada === prev.jugada) return;
    // Al cambiar de jugada se guarda de inmediato la anterior para no perder sus últimos cambios.
    if (s.jugada.id !== prev.jugada.id && !prev.compartida) useBiblioteca.getState().upsert(prev.jugada);
    clearTimeout(temporizador);
    temporizador = setTimeout(guardarYa, 250);
  });
  useBiblioteca.subscribe((s, prev) => {
    if (s.jugadas !== prev.jugadas) set(CLAVE_BIBLIOTECA, s.jugadas).catch((e) => console.warn('No se pudo guardar la biblioteca', e));
    if (s.carpetas !== prev.carpetas) set(CLAVE_CARPETAS, s.carpetas).catch(() => {});
  });
  // Guardar antes de que el celular cierre o esconda la pestaña.
  const alSalir = () => {
    if (temporizador) guardarYa();
  };
  window.addEventListener('pagehide', alSalir);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') alSalir();
  });
  usePreferencias.subscribe((s) => {
    set(CLAVE_PREFS, extraerPreferencias(s)).catch(() => {});
  });
  useRoster.subscribe((s, prev) => {
    if (s.miembros !== prev.miembros) set(CLAVE_ROSTER, s.miembros).catch(() => {});
  });

  // --- Enlaces compartidos (#/ver/...) ---
  abrirEnlaceCompartido();
  window.addEventListener('hashchange', abrirEnlaceCompartido);

  useEditor.setState({ cargado: true });
}
