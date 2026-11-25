import type { Play } from '../modelo/tipos';
import { normalizarJugada } from '../modelo/validar';
import { useEditor } from '../estado/editorStore';
import { abrirJugada, useBiblioteca } from '../estado/bibliotecaStore';
import { avisar } from '../estado/avisos';
import { supabase, urlApp } from './cliente';
import { sincronizar } from './jugadas';

/*
 * Fases 5C y 5D · Libros de jugadas y compartir.
 * Todos los permisos los decide la base de datos (RLS y funciones); aquí solo se llaman.
 */

export type TipoRecurso = 'play' | 'playbook';
export type Permiso = 'ver' | 'editar';

export interface ItemCompartido {
  tipo: TipoRecurso;
  recurso_id: string;
  titulo: string;
  permiso: Permiso;
  autor: string;
  actualizado: string;
}
export interface PersonaConAcceso {
  share_id: string;
  nombre: string;
  permiso: Permiso;
  desde: string;
  ultimo_uso: string;
}
export interface EnlaceActivo {
  id: string;
  token: string;
  permiso: Permiso;
  expira: string | null;
  usos: number;
  creado: string;
}
export interface Libro {
  id: string;
  owner_id: string;
  titulo: string;
  descripcion: string | null;
  source_author_name: string | null;
  actualizado: string;
}
export interface JugadaDeLibro {
  id: string;
  titulo: string;
  posicion: number;
  jugada: Play | null;
}

function cliente() {
  if (!supabase) throw new Error('Las cuentas no están activadas en esta versión de la app.');
  return supabase;
}

/** Convierte errores de la base de datos en un mensaje entendible. */
function falla(e: { message?: string; code?: string } | null): never {
  const m = e?.message ?? '';
  if (/Failed to fetch|NetworkError|network/i.test(m)) throw new Error('No hay conexión con el servidor. Revisa tu internet.');
  if (/^[A-ZÁÉÍÓÚ¿]/.test(m) && !/permission denied|violates|duplicate/i.test(m)) throw new Error(m);
  throw new Error('No se pudo completar. Intenta de nuevo.');
}

async function rpc<T>(nombre: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await cliente().rpc(nombre, args);
  if (error) falla(error);
  return data as T;
}

// ---------------------------------------------------------------------------
// Enlaces y accesos
// ---------------------------------------------------------------------------
export const urlEnlace = (token: string) => `${urlApp()}#/c/${token}`;

export async function crearEnlaceNube(tipo: TipoRecurso, id: string, permiso: Permiso, dias: 1 | 7 | 30 | null) {
  // Una jugada propia debe estar en la nube antes de compartirla.
  if (tipo === 'play') await sincronizar();
  const token = await rpc<string>('crear_enlace', { p_tipo: tipo, p_id: id, p_permiso: permiso, p_dias: dias });
  return urlEnlace(token);
}

export async function enlacesActivos(tipo: TipoRecurso, id: string): Promise<EnlaceActivo[]> {
  const { data, error } = await cliente()
    .from('share_links')
    .select('id, token, permiso, expira, usos, creado')
    .eq('tipo', tipo)
    .eq('recurso_id', id)
    .is('revocado', null)
    .order('creado', { ascending: false });
  if (error) falla(error);
  const ahora = Date.now();
  return (data ?? []).filter((l) => !l.expira || Date.parse(l.expira) > ahora) as EnlaceActivo[];
}

export async function desactivarEnlace(linkId: string) {
  const { error } = await cliente().from('share_links').update({ revocado: new Date().toISOString() }).eq('id', linkId);
  if (error) falla(error);
}

export const personasConAcceso = (tipo: TipoRecurso, id: string) =>
  rpc<PersonaConAcceso[]>('personas_con_acceso', { p_tipo: tipo, p_id: id });

export async function cambiarPermiso(shareId: string, permiso: Permiso) {
  const { error } = await cliente().from('shares').update({ permiso }).eq('id', shareId);
  if (error) falla(error);
}

export async function quitarAcceso(shareId: string) {
  const { error } = await cliente().from('shares').update({ revocado: new Date().toISOString() }).eq('id', shareId);
  if (error) falla(error);
}

export const compartidoConmigo = () => rpc<ItemCompartido[]>('compartido_conmigo', {});

/** "Quitar de mi lista" (no le quita nada a quien lo compartió). */
export async function ocultarCompartido(tipo: TipoRecurso, id: string) {
  const { error } = await cliente().from('shares').update({ oculto: true }).eq('tipo', tipo).eq('recurso_id', id);
  if (error) falla(error);
}

/** Abre un enlace #/c/<token>: da acceso y devuelve qué se compartió (o null si ya no sirve). */
export async function abrirEnlaceNube(token: string) {
  const filas = await rpc<{ tipo: TipoRecurso; recurso_id: string; permiso: Permiso | 'dueno'; titulo: string; autor: string }[]>(
    'abrir_enlace',
    { p_token: token },
  );
  return filas?.[0] ?? null;
}

export const reportar = (tipo: TipoRecurso, id: string, motivo: string) =>
  rpc<void>('reportar_contenido', { p_tipo: tipo, p_id: id, p_motivo: motivo });

/** Copia a mis jugadas; queda con el crédito "Basada en una jugada de …". */
export async function copiarJugada(id: string) {
  const nuevo = await rpc<string>('copiar_jugada', { p_id: id });
  await sincronizar();
  return useBiblioteca.getState().jugadas.find((j) => j.id === nuevo) ?? null;
}

export const copiarLibro = (id: string) => rpc<string>('copiar_libro', { p_id: id });

// ---------------------------------------------------------------------------
// Abrir y guardar una jugada compartida
// ---------------------------------------------------------------------------
export async function abrirJugadaCompartida(id: string) {
  const { data, error } = await cliente().from('plays').select('id, datos, version, owner_id').eq('id', id).maybeSingle();
  if (error) falla(error);
  if (!data) throw new Error('Esta jugada ya no está disponible.');
  const info = (await rpc<{ permiso: string; autor: string; version: number }[]>('info_contenido', { p_tipo: 'play', p_id: id }))[0];
  const j = normalizarJugada(data.datos);
  if (!j || !info) throw new Error('No se pudo abrir la jugada.');
  // Si es mía (p. ej. dentro de mi propio libro) se abre como cualquier jugada propia.
  if (info.permiso === 'dueno') {
    await sincronizar();
    const propia = useBiblioteca.getState().jugadas.find((x) => x.id === id);
    abrirJugada(propia ?? { ...j, id });
    return;
  }
  abrirJugada({ ...j, id });
  useEditor.setState({
    compartida: { id, permiso: info.permiso === 'editar' ? 'editar' : 'ver', autor: info.autor, version: data.version },
  });
}

let guardando: ReturnType<typeof setTimeout> | undefined;

async function guardarCompartida() {
  const ed = useEditor.getState();
  const c = ed.compartida;
  if (!c || c.permiso !== 'editar' || !supabase) return;
  const j = ed.jugada;
  const cuerpo = { titulo: j.nombre.slice(0, 120) || 'Jugada', datos: j };
  let { data, error } = await supabase.from('plays').update(cuerpo).eq('id', c.id).eq('version', c.version).select('version');
  if (error) return avisar('No se pudo guardar en la nube. Revisa tu conexión.', true);
  if (!data?.length) {
    // Otra persona la cambió mientras tanto: se guarda la última versión (esta) y se avisa.
    const info = (await supabase.rpc('info_contenido', { p_tipo: 'play', p_id: c.id })).data?.[0];
    if (!info || !['editar', 'dueno'].includes(info.permiso)) {
      useEditor.setState({ compartida: { ...c, permiso: 'ver' } });
      return avisar('Ya no tienes permiso para editar esta jugada. Guarda una copia para no perder tus cambios.', true);
    }
    ({ data, error } = await supabase.from('plays').update(cuerpo).eq('id', c.id).select('version'));
    if (error || !data?.length) return avisar('No se pudo guardar en la nube.', true);
    avisar(`Esta jugada fue modificada por ${info.editado_por ?? 'otra persona'} mientras la editabas. Se guardó tu versión.`);
  }
  const actual = useEditor.getState().compartida;
  if (actual?.id === c.id) useEditor.setState({ compartida: { ...actual, version: data[0].version } });
}

/** Guarda automáticamente las jugadas compartidas con permiso de editar. */
export function iniciarGuardadoCompartidas() {
  useEditor.subscribe((s, prev) => {
    if (!s.compartida || s.compartida.permiso !== 'editar') return;
    if (s.jugada === prev.jugada || s.jugada.id !== prev.jugada.id) return;
    clearTimeout(guardando);
    guardando = setTimeout(() => void guardarCompartida(), 1200);
  });
}

// ---------------------------------------------------------------------------
// 5C · Libros de jugadas
// ---------------------------------------------------------------------------
export async function misLibros(dueno: string): Promise<Libro[]> {
  const { data, error } = await cliente()
    .from('playbooks')
    .select('id, owner_id, titulo, descripcion, source_author_name, actualizado')
    .eq('owner_id', dueno)
    .is('borrado', null)
    .order('actualizado', { ascending: false });
  if (error) falla(error);
  return (data ?? []) as Libro[];
}

export async function libroPorId(id: string): Promise<Libro | null> {
  const { data, error } = await cliente()
    .from('playbooks')
    .select('id, owner_id, titulo, descripcion, source_author_name, actualizado')
    .eq('id', id)
    .is('borrado', null)
    .maybeSingle();
  if (error) falla(error);
  return data as Libro | null;
}

export async function crearLibro(titulo: string) {
  const { data, error } = await cliente().from('playbooks').insert({ titulo: titulo.trim().slice(0, 80) }).select('id').single();
  if (error) falla(error);
  return data.id as string;
}

export async function editarLibro(id: string, cambios: { titulo?: string; descripcion?: string }) {
  const { error } = await cliente().from('playbooks').update(cambios).eq('id', id);
  if (error) falla(error);
}

export const borrarLibro = (id: string) => rpc<void>('borrar_contenido', { p_tipo: 'playbook', p_id: id });

export async function jugadasDeLibro(id: string): Promise<JugadaDeLibro[]> {
  const { data, error } = await cliente()
    .from('playbook_plays')
    .select('posicion, plays (id, titulo, datos, borrado)')
    .eq('playbook_id', id)
    .order('posicion');
  if (error) falla(error);
  type Fila = { posicion: number; plays: { id: string; titulo: string; datos: unknown; borrado: string | null } | null };
  return ((data ?? []) as unknown as Fila[])
    .filter((f) => f.plays && !f.plays.borrado)
    .map((f) => {
      const j = normalizarJugada(f.plays!.datos);
      return { id: f.plays!.id, titulo: f.plays!.titulo, posicion: f.posicion, jugada: j ? { ...j, id: f.plays!.id } : null };
    });
}

export async function agregarALibro(libro: string, jugada: string) {
  await sincronizar(); // la jugada propia debe estar en la nube
  return rpc<string>('agregar_a_libro', { p_libro: libro, p_play: jugada });
}

export async function quitarDeLibro(libro: string, jugada: string) {
  const { error } = await cliente().from('playbook_plays').delete().eq('playbook_id', libro).eq('play_id', jugada);
  if (error) falla(error);
}

export async function ordenarLibro(libro: string, ids: string[]) {
  for (let i = 0; i < ids.length; i++) {
    const { error } = await cliente().from('playbook_plays').update({ posicion: i }).eq('playbook_id', libro).eq('play_id', ids[i]);
    if (error) falla(error);
  }
}

export async function infoContenido(tipo: TipoRecurso, id: string) {
  const filas = await rpc<{ permiso: 'dueno' | Permiso; autor: string; basado_en: string | null }[]>('info_contenido', {
    p_tipo: tipo,
    p_id: id,
  });
  return filas?.[0] ?? null;
}
