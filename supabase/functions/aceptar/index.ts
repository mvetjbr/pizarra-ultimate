// POST /functions/v1/aceptar
// Re-aceptación de una nueva versión de términos o política (pantalla bloqueante al iniciar sesión).
import { validarAceptaciones } from '../_compartido/reglas.ts';
import {
  agenteDe,
  clienteServicio,
  documentosVigentes,
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

  const db = clienteServicio();
  const acept = validarAceptaciones(p.cuerpo.aceptaciones, await documentosVigentes(db));
  if (!acept.ok) return error(req, acept.motivo, 422);

  const { error: e } = await db.from('consent_records').insert(
    acept.lista.map((a) => ({
      user_id: usuario.id,
      actor: 'titular',
      action: 'aceptado',
      method: 'casilla_relogin_app',
      document_type: a.tipo,
      document_version: a.version,
      document_hash: a.hash,
      checkbox_text: a.texto_casilla,
      ip_address: ipDe(req),
      user_agent: agenteDe(req),
      app_version: textoCorto(p.cuerpo.app_version, 40),
      locale: 'es-CO',
    })),
  );
  if (e) return error(req, 'No se pudo registrar tu aceptación. Intenta de nuevo.', 500);
  return responder(req, { ok: true });
});
