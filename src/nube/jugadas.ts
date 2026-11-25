import { create } from 'zustand';
import { del, get, set } from 'idb-keyval';
import type { Play } from '../modelo/tipos';
import { normalizarJugada } from '../modelo/validar';
import { crearJugada } from '../modelo/fabrica';
import { useBiblioteca, abrirJugada } from '../estado/bibliotecaStore';
import { useEditor } from '../estado/editorStore';
import { avisar } from '../estado/avisos';
import { supabase } from './cliente';
import { useSesion } from './sesion';

/*
 * Fase 5B · Jugadas en la nube.
 *
 * Primero el dispositivo: la biblioteca sigue guardándose en IndexedDB y funciona sin conexión.
 * Con sesión iniciada, cada cierto tiempo se compara con la nube usando la versión de cada jugada:
 *   - lo nuevo o cambiado aquí se sube (solo si la versión de la nube es la que conocíamos);
 *   - lo nuevo o cambiado en otro dispositivo se baja;
 *   - si cambió en los dos lados, gana la nube y lo de aquí se guarda como copia (no se pierde nada);
 *   - lo borrado en un lado se borra en el otro.
 * Al cerrar sesión se quitan del dispositivo las jugadas de la cuenta (siguen en la nube).
 */

export type EstadoNube = 'apagada' | 'sincronizando' | 'al-dia' | 'sin-conexion' | 'error';

interface Meta {
  /** Versión de la nube y fecha de edición local de la última vez que coincidieron. */
  versiones: Record<string, { version: number; editada: number }>;
  /** Jugadas de este dispositivo que la persona decidió no subir. */
  soloLocal: string[];
  /** Ya se preguntó si subir las jugadas que había en el dispositivo. */
  preguntado: boolean;
}

interface EstadoSincronizacion {
  estado: EstadoNube;
  ultima: number | null;
  /** Cuántas jugadas sin cuenta hay en el dispositivo (para preguntar si subirlas). */
  porSubir: number;
}

export const useNube = create<EstadoSincronizacion>(() => ({ estado: 'apagada', ultima: null, porSubir: 0 }));

const claveMeta = (uid: string) => `pizarra:nube:${uid}`;
const metaVacia = (): Meta => ({ versiones: {}, soloLocal: [], preguntado: false });

let uid: string | null = null;
let meta: Meta = metaVacia();
let enCurso: Promise<void> | null = null;
let otraVez = false;
let temporizador: ReturnType<typeof setTimeout> | undefined;

const guardarMeta = () => (uid ? set(claveMeta(uid), meta).catch(() => {}) : Promise.resolve());

/** Id nuevo tipo UUID v4 (crypto.randomUUID no existe en http:// de red local). */
export function idNube(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const idValido = (id: string) => /^[A-Za-z0-9_-]{6,64}$/.test(id);

function reemplazarLocal(j: Play) {
  useBiblioteca.getState().upsert(j);
  const ed = useEditor.getState();
  if (ed.jugada.id === j.id && !ed.compartida) ed.reemplazar(j, false);
}

function quitarLocal(id: string) {
  const ed = useEditor.getState();
  if (ed.jugada.id === id && !ed.compartida) {
    const otra = useBiblioteca
      .getState()
      .jugadas.filter((x) => x.id !== id)
      .sort((a, b) => b.editada - a.editada)[0];
    abrirJugada(otra ?? crearJugada());
  }
  useBiblioteca.getState().eliminar(id);
}

async function bajar(ids: string[]) {
  if (!supabase || !ids.length) return [];
  const filas: { id: string; datos: unknown; version: number }[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const { data, error } = await supabase.from('plays').select('id, datos, version').in('id', ids.slice(i, i + 50));
    if (error) throw error;
    filas.push(...(data ?? []));
  }
  return filas;
}

async function sincronizarAhora() {
  if (!supabase || !uid) return;
  const yo = uid;
  useNube.setState({ estado: 'sincronizando' });

  // 1) Qué hay en la nube (solo metadatos).
  const { data: remotas, error } = await supabase.from('plays').select('id, version, borrado').eq('owner_id', yo);
  if (error) throw error;
  if (uid !== yo) return;
  const enNube = new Map(remotas.map((r) => [r.id as string, r as { id: string; version: number; borrado: string | null }]));
  const locales = new Map(useBiblioteca.getState().jugadas.map((j) => [j.id, j]));
  const solo = new Set(meta.soloLocal);
  const paraBajar: string[] = [];

  for (const r of enNube.values()) {
    const m = meta.versiones[r.id];
    const local = locales.get(r.id);
    if (r.borrado) {
      if (local && m) quitarLocal(r.id);
      delete meta.versiones[r.id];
      continue;
    }
    if (m && m.version === r.version) continue;
    if (local && m && local.editada > m.editada) {
      // Cambió aquí y en otro lado: la versión de aquí se guarda como copia.
      const copia: Play = { ...structuredClone(local), id: idNube(), nombre: `${local.nombre} (copia de este dispositivo)` };
      useBiblioteca.getState().upsert(copia);
      avisar(`"${local.nombre}" cambió en otro dispositivo. Tu versión quedó como copia.`);
    }
    paraBajar.push(r.id);
  }

  for (const f of await bajar(paraBajar)) {
    const j = normalizarJugada(f.datos);
    if (!j) continue;
    const jugada = { ...j, id: f.id };
    reemplazarLocal(jugada);
    meta.versiones[f.id] = { version: f.version, editada: jugada.editada };
  }

  // 2) Lo borrado aquí: estaba sincronizado pero ya no está en el dispositivo.
  const ahora = new Set(useBiblioteca.getState().jugadas.map((j) => j.id));
  const borradasAqui = Object.keys(meta.versiones).filter((id) => !ahora.has(id) && enNube.get(id) && !enNube.get(id)!.borrado);
  // Protección: si desaparecieron casi todas de golpe no se borra nada en la nube.
  const total = Object.keys(meta.versiones).length;
  if (borradasAqui.length > 3 && borradasAqui.length > total / 2) {
    console.warn('Demasiadas jugadas faltan en el dispositivo; se vuelven a bajar en vez de borrarlas.');
    for (const id of borradasAqui) delete meta.versiones[id];
    otraVez = true;
  } else {
    for (const id of borradasAqui) {
      const { error: e } = await supabase.rpc('borrar_contenido', { p_tipo: 'play', p_id: id });
      if (!e) delete meta.versiones[id];
    }
  }

  // 3) Lo nuevo o cambiado aquí se sube.
  for (const j of useBiblioteca.getState().jugadas) {
    if (uid !== yo) return;
    if (solo.has(j.id)) continue;
    const m = meta.versiones[j.id];
    if (m && j.editada <= m.editada) continue;
    if (!m && enNube.has(j.id)) continue; // existe en la nube pero borrada: no se revive
    if (!idValido(j.id)) {
      // Id viejo con caracteres raros: se le da uno nuevo antes de subirla.
      quitarLocal(j.id);
      reemplazarLocal({ ...j, id: idNube() });
      otraVez = true;
      continue;
    }
    const cuerpo = { titulo: j.nombre.slice(0, 120) || 'Jugada', datos: j };
    if (!m) {
      const { data, error: e } = await supabase.from('plays').insert({ id: j.id, ...cuerpo }).select('version').maybeSingle();
      if (e) {
        if (e.code === '23505' || e.code === '42501') {
          // El id ya existe (de otra cuenta): se cambia y se reintenta.
          quitarLocal(j.id);
          reemplazarLocal({ ...j, id: idNube() });
          otraVez = true;
          continue;
        }
        throw e;
      }
      meta.versiones[j.id] = { version: data?.version ?? 1, editada: j.editada };
    } else {
      const { data, error: e } = await supabase
        .from('plays')
        .update(cuerpo)
        .eq('id', j.id)
        .eq('version', m.version)
        .select('version');
      if (e) throw e;
      if (data && data.length) meta.versiones[j.id] = { version: data[0].version, editada: j.editada };
      else otraVez = true; // otra persona o dispositivo la cambió: en la próxima vuelta se resuelve
    }
  }

  await guardarMeta();
  useNube.setState({ estado: 'al-dia', ultima: Date.now() });
}

/** Sincroniza ya (si hay sesión). Si ya está corriendo, deja otra vuelta pendiente. */
export function sincronizar(): Promise<void> {
  if (!uid || !supabase) return Promise.resolve();
  if (enCurso) {
    otraVez = true;
    return enCurso;
  }
  enCurso = (async () => {
    try {
      do {
        otraVez = false;
        await sincronizarAhora();
      } while (otraVez && uid);
    } catch (e) {
      console.warn('No se pudo sincronizar', e);
      useNube.setState({ estado: navigator.onLine ? 'error' : 'sin-conexion' });
    } finally {
      enCurso = null;
    }
  })();
  return enCurso;
}

const programar = (ms = 3000) => {
  clearTimeout(temporizador);
  temporizador = setTimeout(() => void sincronizar(), ms);
};

/** Jugadas del dispositivo que aún no son de ninguna cuenta (para preguntar si subirlas). */
function sinCuenta() {
  return useBiblioteca
    .getState()
    .jugadas.filter((j) => !meta.versiones[j.id] && !meta.soloLocal.includes(j.id) && j.pasos.length > 0);
}

/** Respuesta a "¿Guardar en tu cuenta las jugadas de este dispositivo?". */
export async function decidirSubida(subir: boolean) {
  const lista = sinCuenta();
  meta.preguntado = true;
  if (!subir) meta.soloLocal = [...new Set([...meta.soloLocal, ...lista.map((j) => j.id)])];
  useNube.setState({ porSubir: 0 });
  await guardarMeta();
  void sincronizar();
}

async function alIngresar(nuevo: string) {
  uid = nuevo;
  meta = { ...metaVacia(), ...((await get<Meta>(claveMeta(nuevo)).catch(() => undefined)) ?? {}) };
  // La primera vez en este dispositivo se pregunta antes de subir lo que ya había.
  const pendientes = meta.preguntado ? [] : sinCuenta();
  if (pendientes.length) useNube.setState({ porSubir: pendientes.length });
  else meta.preguntado = true;
  if (!pendientes.length) void sincronizar();
}

async function alSalir() {
  const anterior = uid;
  uid = null;
  clearTimeout(temporizador);
  if (anterior) {
    // Las jugadas de la cuenta salen del dispositivo (quedan en la nube); las "solo aquí" se quedan.
    for (const id of Object.keys(meta.versiones)) quitarLocal(id);
    await del(claveMeta(anterior)).catch(() => {});
  }
  meta = metaVacia();
  useNube.setState({ estado: 'apagada', ultima: null, porSubir: 0 });
}

/** Arranca la sincronización (después de cargar la biblioteca local). */
export function iniciarSincronizacion() {
  if (!supabase) return;
  let actual: string | null = null;
  const revisar = () => {
    const s = useSesion.getState();
    const nuevo = s.listo && s.usuario && s.perfil ? s.usuario.id : null;
    if (nuevo === actual) return;
    const antes = actual;
    actual = nuevo;
    void (async () => {
      if (antes) await alSalir();
      if (nuevo) await alIngresar(nuevo);
    })();
  };
  useSesion.subscribe(revisar);
  revisar();

  useBiblioteca.subscribe((s, prev) => {
    if (uid && s.jugadas !== prev.jugadas && !useNube.getState().porSubir) programar();
  });
  window.addEventListener('online', () => programar(500));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') programar(500);
  });
  setInterval(() => {
    if (document.visibilityState === 'visible' && !useNube.getState().porSubir) void sincronizar();
  }, 60_000);
}

/** Para el resto de la app: id de una jugada propia si ya está en la nube. */
export const estaEnNube = (id: string) => !!uid && !!meta.versiones[id];
export const hayCuentaActiva = () => !!uid;
