import { useEffect, useState, type FormEvent } from 'react';
import { CATEGORIAS_MATCH, CONFIRMACION_ELIMINAR, ROLES } from '../../../supabase/functions/_compartido/reglas.ts';
import { llamarFuncion, supabase } from '../../nube/cliente';
import { cerrarSesion, recargarSesion, useSesion, type Perfil } from '../../nube/sesion';
import { NOMBRE_DOCUMENTO, type TipoDocumento } from '../../legal/documentos';
import { irA, volverAlEditor } from '../../estado/ruta';
import { avisar } from '../../estado/avisos';
import { descargar } from '../../exportar/archivos';
import { NOMBRE_MATCH, NOMBRE_ROL } from './Cuenta';

interface Consentimiento {
  id: string;
  document_type: TipoDocumento;
  document_version: string;
  action: 'aceptado' | 'revocado' | 'rechazado';
  method: string;
  timestamp_utc: string;
  actor: string;
  checkbox_text: string;
  evidence_hash: string;
}

interface Solicitud {
  id: string;
  tipo: 'consulta' | 'reclamo';
  mensaje: string;
  recibido: string;
  limite: string;
  estado: string;
  respuesta: string | null;
}

const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' });

function EditarPerfil({ perfil }: { perfil: Perfil }) {
  const [f, setF] = useState({
    nombre: perfil.nombre,
    apellido: perfil.apellido,
    apodo: perfil.apodo ?? '',
    numero: perfil.numero?.toString() ?? '',
    rol: perfil.rol ?? '',
    match_categoria: perfil.match_categoria ?? '',
  });
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    const numero = f.numero === '' ? null : Number(f.numero);
    if (f.nombre.trim().length < 2 || f.apellido.trim().length < 2) return setError('Nombre y apellido: mínimo 2 caracteres.');
    if (numero !== null && (!Number.isInteger(numero) || numero < 0 || numero > 99)) return setError('El número debe estar entre 0 y 99.');
    setOcupado(true);
    setError('');
    const { error: err } = await supabase
      .from('profiles')
      .update({
        nombre: f.nombre.trim(),
        apellido: f.apellido.trim(),
        apodo: f.apodo.trim() || null,
        numero,
        rol: f.rol || null,
        match_categoria: f.match_categoria || null,
      })
      .eq('id', perfil.id);
    setOcupado(false);
    if (err) return setError('No se pudieron guardar los cambios.');
    await recargarSesion();
    avisar('Datos actualizados');
  };

  const campo = (k: keyof typeof f, etiqueta: string, max = 50) => (
    <label className="campo">
      <span>{etiqueta}</span>
      <input maxLength={max} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </label>
  );

  return (
    <form className="formulario" onSubmit={guardar}>
      <div className="fila-campos">
        {campo('nombre', 'Nombre')}
        {campo('apellido', 'Apellido')}
      </div>
      <div className="fila-campos">
        {campo('apodo', 'Apodo en cancha', 30)}
        <label className="campo">
          <span>Número de camiseta</span>
          <input type="number" min={0} max={99} value={f.numero} onChange={(e) => setF({ ...f, numero: e.target.value })} />
        </label>
      </div>
      <div className="fila-campos">
        <label className="campo">
          <span>Rol preferido</span>
          <select value={f.rol} onChange={(e) => setF({ ...f, rol: e.target.value })}>
            <option value="">—</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {NOMBRE_ROL[r]}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>Categoría en mixto (opcional)</span>
          <select value={f.match_categoria} onChange={(e) => setF({ ...f, match_categoria: e.target.value })}>
            <option value="">—</option>
            {CATEGORIAS_MATCH.map((c) => (
              <option key={c} value={c}>
                {NOMBRE_MATCH[c]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="nota">
        La fecha de nacimiento ({perfil.fecha_nacimiento}) no se puede cambiar desde aquí porque se usa para verificar la
        edad. Si está mal, envía un reclamo abajo.
      </p>
      {error && <p className="error-formulario" role="alert">{error}</p>}
      <button className="boton-texto primario" disabled={ocupado}>
        {ocupado ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </form>
  );
}

function NuevaSolicitud({ alEnviar }: { alEnviar: () => void }) {
  const [tipo, setTipo] = useState<'consulta' | 'reclamo'>('consulta');
  const [mensaje, setMensaje] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase || mensaje.trim().length < 10) return;
    setOcupado(true);
    const { error } = await supabase.from('habeas_data_requests').insert({ tipo, mensaje: mensaje.trim() });
    setOcupado(false);
    if (error) return avisar('No se pudo radicar la solicitud. Intenta de nuevo.', true);
    setMensaje('');
    avisar('Solicitud radicada');
    alEnviar();
  };
  return (
    <form className="formulario" onSubmit={enviar}>
      <div className="segmentado" role="group" aria-label="Tipo de solicitud">
        <button type="button" aria-pressed={tipo === 'consulta'} onClick={() => setTipo('consulta')}>
          Consulta
        </button>
        <button type="button" aria-pressed={tipo === 'reclamo'} onClick={() => setTipo('reclamo')}>
          Reclamo
        </button>
      </div>
      <p className="nota">
        {tipo === 'consulta'
          ? 'Para preguntar qué datos tenemos o cómo los usamos. Plazo de respuesta: 10 días hábiles.'
          : 'Para corregir, actualizar o suprimir datos, o si crees que no cumplimos la ley. Plazo de respuesta: 15 días hábiles.'}
      </p>
      <label className="campo">
        <span>Tu solicitud</span>
        <textarea rows={4} maxLength={4000} value={mensaje} onChange={(e) => setMensaje(e.target.value)} />
      </label>
      <button className="boton-texto" disabled={ocupado || mensaje.trim().length < 10}>
        Radicar {tipo}
      </button>
    </form>
  );
}

function EliminarCuenta() {
  const [texto, setTexto] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const eliminar = async () => {
    setOcupado(true);
    try {
      await llamarFuncion('eliminar-cuenta', { confirmacion: texto });
      await cerrarSesion();
      avisar('Tu cuenta fue eliminada');
      volverAlEditor();
    } catch (e) {
      avisar((e as Error).message, true);
    } finally {
      setOcupado(false);
    }
  };
  return (
    <div className="formulario">
      <p>
        Se borran tu perfil, tus solicitudes y, cuando existan, tus jugadas en la nube y tus enlaces. Las jugadas guardadas
        en este dispositivo no se borran. Por obligación legal conservamos, sin tus datos de contacto, el registro de las
        autorizaciones que diste (mínimo 3 años).
      </p>
      <label className="campo">
        <span>
          Escribe <strong>{CONFIRMACION_ELIMINAR}</strong> para confirmar
        </span>
        <input value={texto} onChange={(e) => setTexto(e.target.value)} autoComplete="off" />
      </label>
      <button className="boton-texto peligro" disabled={texto !== CONFIRMACION_ELIMINAR || ocupado} onClick={eliminar}>
        {ocupado ? 'Eliminando…' : 'Eliminar mi cuenta'}
      </button>
    </div>
  );
}

export function MisDatos() {
  const usuario = useSesion((s) => s.usuario);
  const perfil = useSesion((s) => s.perfil);
  const [consentimientos, setConsentimientos] = useState<Consentimiento[]>([]);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);

  const cargar = async () => {
    if (!supabase || !usuario) return;
    const [c, s] = await Promise.all([
      supabase.from('consent_records').select('*').eq('user_id', usuario.id).order('timestamp_utc', { ascending: false }),
      supabase.from('habeas_data_requests').select('*').order('recibido', { ascending: false }),
    ]);
    setConsentimientos((c.data as Consentimiento[]) ?? []);
    setSolicitudes((s.data as Solicitud[]) ?? []);
  };
  useEffect(() => {
    void cargar();
  }, [usuario?.id]);

  if (!usuario) {
    return (
      <div className="pagina">
        <main className="pagina-cuerpo angosto">
          <h1>Mis datos</h1>
          <p>Ingresa a tu cuenta para ver tus datos.</p>
          <button className="boton-texto primario" onClick={() => irA('/cuenta')}>
            Ingresar
          </button>
        </main>
      </div>
    );
  }

  const descargarDatos = () => {
    const datos = {
      generado: new Date().toISOString(),
      cuenta: { correo: usuario.email, creada: usuario.created_at },
      perfil,
      autorizaciones: consentimientos,
      solicitudes,
    };
    descargar(new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' }), 'mis-datos-pizarra-ultimate.json');
  };

  return (
    <div className="pagina">
      <header className="pagina-cabecera">
        <button className="boton-texto" onClick={volverAlEditor}>
          ← Volver a la app
        </button>
        <button className="boton-texto" onClick={() => void cerrarSesion().then(volverAlEditor)}>
          Cerrar sesión
        </button>
      </header>
      <main className="pagina-cuerpo angosto">
        <h1>Mis datos</h1>
        <p className="nota">Correo: {usuario.email}</p>

        <section className="seccion-datos">
          <h2>Corregir mis datos</h2>
          {perfil ? <EditarPerfil perfil={perfil} /> : <p className="nota">Cargando…</p>}
        </section>

        <section className="seccion-datos">
          <h2>Descargar mis datos</h2>
          <p className="nota">Un archivo JSON con tu perfil, tus autorizaciones y tus solicitudes.</p>
          <button className="boton-texto" onClick={descargarDatos}>
            Descargar (JSON)
          </button>
        </section>

        <section className="seccion-datos">
          <h2>Mis autorizaciones</h2>
          {consentimientos.length === 0 ? (
            <p className="nota">Sin registros.</p>
          ) : (
            <ul className="lista-registros">
              {consentimientos.map((c) => (
                <li key={c.id}>
                  <strong>{NOMBRE_DOCUMENTO[c.document_type]}</strong> v{c.document_version} —{' '}
                  {c.action === 'aceptado' ? 'aceptado' : c.action === 'revocado' ? 'revocado' : 'rechazado'} el{' '}
                  {fechaHora(c.timestamp_utc)}
                  <a href={`#/legal/${c.document_type}/${c.document_version}`}> ver texto</a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="seccion-datos">
          <h2>Consultas y reclamos</h2>
          <NuevaSolicitud alEnviar={cargar} />
          {solicitudes.length > 0 && (
            <ul className="lista-registros">
              {solicitudes.map((s) => (
                <li key={s.id}>
                  <strong>{s.tipo === 'consulta' ? 'Consulta' : 'Reclamo'}</strong> del {fechaHora(s.recibido)} —{' '}
                  {s.estado === 'respondida' ? 'respondida' : `en trámite, respuesta a más tardar el ${s.limite}`}
                  {s.respuesta && <p className="respuesta-solicitud">{s.respuesta}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="seccion-datos peligro">
          <h2>Eliminar mi cuenta</h2>
          <EliminarCuenta />
        </section>
      </main>
    </div>
  );
}
