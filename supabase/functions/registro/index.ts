// POST /functions/v1/registro
// Crea la cuenta solo si llegan las dos aceptaciones legales (validación en el servidor),
// guarda el perfil con los campos permitidos y registra los consentimientos con IP y hora del servidor.
import { clasificarEdad, validarAceptaciones, validarRegistro } from '../_compartido/reglas.ts';
import {
  agenteDe,
  clientePublico,
  clienteServicio,
  documentosVigentes,
  error,
  ipDe,
  leerPeticion,
  redireccionPermitida,
  responder,
  textoCorto,
} from '../_compartido/servidor.ts';

const ORIGEN_APP = Deno.env.get('URL_APP') ?? 'https://pizarra-ultimate.pages.dev/';

Deno.serve(async (req) => {
  const p = await leerPeticion(req);
  if ('respuesta' in p) return p.respuesta;
  const b = p.cuerpo;

  const { datos, errores } = validarRegistro(b as never);
  if (Object.keys(errores).length) return responder(req, { error: 'Revisa los datos del formulario.', errores }, 422);

  const edad = clasificarEdad(datos.fecha_nacimiento);
  if (edad === 'menor_de_14') return error(req, 'Por ahora Pizarra Ultimate es para personas de 14 años o más.', 403);
  if (edad === 'menor_14_17') {
    return error(
      req,
      'Para personas de 14 a 17 años el registro necesita la autorización de tu madre, padre o representante legal. Esta opción estará disponible pronto.',
      403,
    );
  }

  const db = clienteServicio();
  let vigentes;
  try {
    vigentes = await documentosVigentes(db);
  } catch {
    return error(req, 'No se pudieron leer los documentos legales. Intenta más tarde.', 503);
  }
  const acept = validarAceptaciones(b.aceptaciones, vigentes);
  if (!acept.ok) return error(req, acept.motivo, 422);

  // signUp con la clave pública: Supabase envía el correo de verificación.
  const { data, error: e } = await clientePublico().auth.signUp({
    email: datos.correo,
    password: datos.contrasena,
    options: { emailRedirectTo: redireccionPermitida(b.redireccion, ORIGEN_APP), data: { nombre: datos.nombre } },
  });
  if (e) {
    const m = e.message.toLowerCase();
    if (m.includes('rate')) return error(req, 'Demasiados intentos. Espera unos minutos y vuelve a intentar.', 429);
    if (m.includes('password')) return error(req, 'La contraseña es muy débil. Usa una más larga o menos común.', 422);
    return error(req, 'No se pudo crear la cuenta. Intenta más tarde.', 500);
  }
  const usuario = data.user;
  // Si el correo ya existía, Supabase no lo revela (identities vacío). Respondemos igual para no filtrarlo.
  if (!usuario || (usuario.identities && usuario.identities.length === 0)) {
    return responder(req, { ok: true, revisar_correo: true });
  }

  const { error: ePerfil } = await db.from('profiles').insert({
    id: usuario.id,
    nombre: datos.nombre,
    apellido: datos.apellido,
    fecha_nacimiento: datos.fecha_nacimiento,
    apodo: datos.apodo ?? null,
    numero: datos.numero ?? null,
    rol: datos.rol ?? null,
    match_categoria: datos.match_categoria ?? null,
    es_menor: false,
    estado: 'activa',
  });
  if (ePerfil) {
    await db.auth.admin.deleteUser(usuario.id);
    return error(req, 'No se pudo crear la cuenta. Intenta más tarde.', 500);
  }

  // Las dos aceptaciones en una sola inserción: o quedan ambas o ninguna.
  const comunes = {
    user_id: usuario.id,
    actor: 'titular',
    action: 'aceptado',
    method: 'casilla_registro_web',
    ip_address: ipDe(req),
    user_agent: agenteDe(req),
    app_version: textoCorto(b.app_version, 40),
    locale: 'es-CO',
  };
  const { error: eConsent } = await db.from('consent_records').insert(
    acept.lista.map((a) => ({
      ...comunes,
      document_type: a.tipo,
      document_version: a.version,
      document_hash: a.hash,
      checkbox_text: a.texto_casilla,
    })),
  );
  if (eConsent) {
    await db.auth.admin.deleteUser(usuario.id);
    return error(req, 'No se pudo registrar tu aceptación. Intenta más tarde.', 500);
  }

  return responder(req, { ok: true, revisar_correo: true });
});
