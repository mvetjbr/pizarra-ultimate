import { createClient, FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js';

// URL y clave pública del proyecto (van en .env.local o en las variables del despliegue).
// Son públicas por diseño: la seguridad la ponen las reglas RLS de la base de datos.
const URL_SUPABASE = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const CLAVE_PUBLICA = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** null si la app se compiló sin servidor: funciona igual, solo en el dispositivo. */
export const supabase: SupabaseClient | null =
  URL_SUPABASE && CLAVE_PUBLICA
    ? createClient(URL_SUPABASE, CLAVE_PUBLICA, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' },
      })
    : null;

export const hayServidor = supabase !== null;

export const VERSION_APP = '2.0.0-beta';

/** Dirección pública de la app (para los enlaces de los correos). */
export const urlApp = () => `${location.origin}${location.pathname}`;

/** Llama una función del servidor y devuelve su respuesta o lanza un Error con el mensaje en español. */
export async function llamarFuncion<T = { ok: true }>(nombre: string, cuerpo: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('Las cuentas no están activadas en esta versión de la app.');
  const { data, error } = await supabase.functions.invoke(nombre, { body: { ...cuerpo, app_version: VERSION_APP } });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const cuerpoError = await error.context.json().catch(() => null);
      const e = new Error(cuerpoError?.error ?? 'Ocurrió un error. Intenta de nuevo.') as Error & { errores?: Record<string, string> };
      e.errores = cuerpoError?.errores;
      throw e;
    }
    throw new Error('No hay conexión con el servidor. Revisa tu internet.');
  }
  return data as T;
}
