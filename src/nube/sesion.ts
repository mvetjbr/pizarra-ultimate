import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './cliente';

export interface Perfil {
  id: string;
  nombre: string;
  apellido: string;
  fecha_nacimiento: string;
  apodo: string | null;
  numero: number | null;
  rol: 'handler' | 'cutter' | 'ambos' | null;
  match_categoria: 'MMP' | 'FMP' | 'no_dice' | null;
  foto_url: string | null;
  /** Mascota elegida y mascotas desbloqueadas (pueden faltar si la base aún no tiene las columnas). */
  muneco?: string | null;
  mascotas_elegidas?: string[] | null;
  es_menor: boolean;
  estado: 'activa' | 'pendiente_representante';
  es_admin: boolean;
  creado: string;
}

export interface DocumentoPendiente {
  tipo: 'terminos' | 'privacidad';
  version: string;
  hash: string;
}

interface EstadoSesion {
  listo: boolean;
  usuario: User | null;
  perfil: Perfil | null;
  /** Documentos vigentes que la persona debe aceptar antes de seguir. */
  pendientes: DocumentoPendiente[];
  /** Llegó desde el enlace de "olvidé mi contraseña". */
  recuperandoContrasena: boolean;
}

export const useSesion = create<EstadoSesion>(() => ({
  listo: !supabase,
  usuario: null,
  perfil: null,
  pendientes: [],
  recuperandoContrasena: false,
}));

async function aplicar(sesion: Session | null) {
  if (!supabase || !sesion) {
    useSesion.setState({ listo: true, usuario: null, perfil: null, pendientes: [] });
    return;
  }
  const usuario = sesion.user;
  const [perfil, pendientes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', usuario.id).maybeSingle(),
    supabase.rpc('documentos_pendientes'),
  ]);
  useSesion.setState({
    listo: true,
    usuario,
    perfil: (perfil.data as Perfil | null) ?? null,
    pendientes: (pendientes.data as DocumentoPendiente[] | null) ?? [],
  });
}

/** Lee la sesión guardada y escucha los cambios (ingreso, salida, enlace de recuperación). */
export async function iniciarSesionNube() {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  await aplicar(data.session);
  supabase.auth.onAuthStateChange((evento, sesion) => {
    if (evento === 'PASSWORD_RECOVERY') useSesion.setState({ recuperandoContrasena: true });
    // supabase-js recomienda no llamar a la API dentro del callback: se difiere un instante.
    setTimeout(() => void aplicar(sesion), 0);
  });
}

export async function recargarSesion() {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  await aplicar(data.session);
}

export async function cerrarSesion() {
  await supabase?.auth.signOut();
  useSesion.setState({ usuario: null, perfil: null, pendientes: [], recuperandoContrasena: false });
}

/** Nombre corto para mostrar: apodo, o nombre si no tiene apodo. */
export const nombreVisible = (p: Perfil | null) => p?.apodo?.trim() || p?.nombre || '';
