// POST /functions/v1/eliminar-cuenta   { confirmacion: "ELIMINAR MI CUENTA" }
// Revoca la autorización, conserva el registro de consentimientos (seudonimizado) y borra la cuenta.
import { CONFIRMACION_ELIMINAR } from '../_compartido/reglas.ts';
import {
  agenteDe,
  clienteServicio,
  error,
  ipDe,
  leerPeticion,
  responder,
  textoCorto,
  usuarioDe,
} from '../_compartido/servidor.ts';

Deno.serve(async (req) => {
  const p = await leerPeticion(req);
  if ('respuesta' in p) return p.respuesta;
  const usuario = await usuarioDe(req);
  if (!usuario) return error(req, 'Inicia sesión de nuevo.', 401);
  if (p.cuerpo.confirmacion !== CONFIRMACION_ELIMINAR) return error(req, `Escribe ${CONFIRMACION_ELIMINAR} para confirmar.`, 422);

  const db = clienteServicio();

  // 1. Revocación: un registro nuevo por cada documento que la persona tenía aceptado.
  const { data: aceptados, error: eLeer } = await db
    .from('consent_records')
    .select('document_type, document_version, document_hash, action, timestamp_utc')
    .eq('user_id', usuario.id)
    .eq('actor', 'titular')
    .order('timestamp_utc', { ascending: false });
  if (eLeer) return error(req, 'No se pudo eliminar la cuenta. Intenta de nuevo.', 500);
  const ultimo = new Map<string, { document_version: string; document_hash: string; action: string }>();
  for (const r of aceptados ?? []) if (!ultimo.has(r.document_type)) ultimo.set(r.document_type, r);
  const revocar = [...ultimo.entries()].filter(([, r]) => r.action === 'aceptado');
  if (revocar.length) {
    const { error: eRev } = await db.from('consent_records').insert(
      revocar.map(([tipo, r]) => ({
        user_id: usuario.id,
        actor: 'titular',
        action: 'revocado',
        method: 'eliminacion_cuenta_app',
        document_type: tipo,
        document_version: r.document_version,
        document_hash: r.document_hash,
        checkbox_text: `Confirmación escrita: ${CONFIRMACION_ELIMINAR}`,
        ip_address: ipDe(req),
        user_agent: agenteDe(req),
        app_version: textoCorto(p.cuerpo.app_version, 40),
        locale: 'es-CO',
      })),
    );
    if (eRev) return error(req, 'No se pudo eliminar la cuenta. Intenta de nuevo.', 500);
  }

  // 2. Seudonimizar datos de terceros (representante legal) en el registro de consentimientos.
  const { error: eSeud } = await db.rpc('seudonimizar_consentimientos', { p_usuario: usuario.id });
  if (eSeud) return error(req, 'No se pudo eliminar la cuenta. Intenta de nuevo.', 500);

  // 3. Borrar la cuenta: el perfil y las solicitudes se borran en cascada.
  //    El registro de consentimientos se conserva (mínimo 3 años) como prueba ante la SIC.
  const { error: eBorrar } = await db.auth.admin.deleteUser(usuario.id);
  if (eBorrar) return error(req, 'No se pudo eliminar la cuenta. Intenta de nuevo.', 500);

  return responder(req, { ok: true });
});
