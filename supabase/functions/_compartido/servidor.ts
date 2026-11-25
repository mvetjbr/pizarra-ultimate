// Utilidades de las funciones del servidor (Deno / Supabase Edge Functions).
import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2.45.4';

const ORIGENES = (Deno.env.get('ORIGENES_PERMITIDOS') ??
  'https://prueba.pizarra-ultimate.pages.dev,https://pizarra-ultimate.pages.dev,https://mvetjbr.github.io,http://localhost:5173,http://localhost:4173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

export function cabeceras(req: Request): HeadersInit {
  const origen = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ORIGENES.includes(origen) ? origen : ORIGENES[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

export function responder(req: Request, cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...cabeceras(req), 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export const error = (req: Request, mensaje: string, estado = 400) => responder(req, { error: mensaje }, estado);

/** Atiende el preflight CORS y exige POST con JSON. Devuelve el cuerpo o una respuesta de error. */
export async function leerPeticion(req: Request): Promise<{ cuerpo: Record<string, unknown> } | { respuesta: Response }> {
  if (req.method === 'OPTIONS') return { respuesta: new Response('ok', { headers: cabeceras(req) }) };
  if (req.method !== 'POST') return { respuesta: error(req, 'Método no permitido', 405) };
  try {
    const cuerpo = await req.json();
    if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) throw new Error();
    return { cuerpo };
  } catch {
    return { respuesta: error(req, 'Petición inválida') };
  }
}

/** IP del cliente según el proxy de Supabase. */
export function ipDe(req: Request): string | null {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();
  return ip || null;
}

export const agenteDe = (req: Request) => (req.headers.get('user-agent') ?? '').slice(0, 500) || null;

/** Cliente con permisos de servicio (solo en el servidor; nunca sale de aquí). */
export function clienteServicio(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Cliente con la clave pública (para signUp: así Supabase envía el correo de verificación). */
export function clientePublico(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Usuario autenticado de la petición (token del encabezado Authorization) o null. */
export async function usuarioDe(req: Request): Promise<User | null> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error: e } = await clienteServicio().auth.getUser(token);
  return e ? null : data.user;
}

export async function documentosVigentes(db: SupabaseClient) {
  const { data, error: e } = await db
    .from('legal_documents')
    .select('tipo, version, hash')
    .eq('vigente', true)
    .in('tipo', ['terminos', 'privacidad']);
  if (e) throw e;
  return data as { tipo: string; version: string; hash: string }[];
}

/** Dirección a la que vuelve el enlace del correo: la que pidió la app si es de un origen permitido. */
export function redireccionPermitida(pedida: unknown, porDefecto: string): string {
  if (typeof pedida !== 'string') return porDefecto;
  try {
    const u = new URL(pedida);
    return ORIGENES.includes(u.origin) ? u.origin + u.pathname : porDefecto;
  } catch {
    return porDefecto;
  }
}

export const textoCorto = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : null);
