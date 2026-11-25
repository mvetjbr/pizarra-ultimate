import { useState, type FormEvent, type ReactNode } from 'react';
import {
  CATEGORIAS_MATCH,
  clasificarEdad,
  ROLES,
  validarRegistro,
  type DatosRegistro,
} from '../../../supabase/functions/_compartido/reglas.ts';
import { hayServidor, llamarFuncion, supabase, urlApp } from '../../nube/cliente';
import { recargarSesion, useSesion } from '../../nube/sesion';
import { AVISO_PRIVACIDAD_CORTO } from '../../legal/documentos';
import { irA, volverAlEditor } from '../../estado/ruta';
import { avisar } from '../../estado/avisos';
import { Markdown } from '../Markdown';
import { armarAceptaciones, Casillas, CASILLAS_VACIAS, type EstadoCasillas } from './Casillas';

export const NOMBRE_ROL: Record<(typeof ROLES)[number], string> = { handler: 'Handler', cutter: 'Cutter', ambos: 'Ambos' };
export const NOMBRE_MATCH: Record<(typeof CATEGORIAS_MATCH)[number], string> = {
  MMP: 'MMP (male matching)',
  FMP: 'FMP (female matching)',
  no_dice: 'Prefiero no decir',
};

function Marco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="pagina">
      <header className="pagina-cabecera">
        <button className="boton-texto" onClick={volverAlEditor}>
          ← Volver a la app
        </button>
      </header>
      <main className="pagina-cuerpo angosto">
        <h1>{titulo}</h1>
        {children}
        <p className="pie-legal">
          <a href="#/legal/terminos">Términos</a> · <a href="#/legal/privacidad">Privacidad</a> ·{' '}
          <a href="#/legal/cookies">Cookies</a> · <a href="#/legal/creditos">Créditos</a>
        </p>
      </main>
    </div>
  );
}

function Campo({
  etiqueta,
  error,
  ayuda,
  children,
}: {
  etiqueta: string;
  error?: string;
  ayuda?: string;
  children: ReactNode;
}) {
  return (
    <label className={`campo${error ? ' con-error' : ''}`}>
      <span>{etiqueta}</span>
      {children}
      {ayuda && <small className="ayuda-campo">{ayuda}</small>}
      {error && <small className="error-campo">{error}</small>}
    </label>
  );
}

function Ingresar() {
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setOcupado(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithPassword({ email: correo.trim().toLowerCase(), password: contrasena });
    setOcupado(false);
    if (err) {
      setError(
        err.message.toLowerCase().includes('confirm')
          ? 'Primero confirma tu correo: abre el enlace que te enviamos al registrarte.'
          : 'Correo o contraseña incorrectos.',
      );
      return;
    }
    await recargarSesion();
    avisar('Sesión iniciada');
    volverAlEditor();
  };

  return (
    <Marco titulo="Ingresar">
      <form className="formulario" onSubmit={enviar}>
        <Campo etiqueta="Correo electrónico">
          <input type="email" autoComplete="email" required value={correo} onChange={(e) => setCorreo(e.target.value)} />
        </Campo>
        <Campo etiqueta="Contraseña">
          <input
            type="password"
            autoComplete="current-password"
            required
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
          />
        </Campo>
        {error && <p className="error-formulario" role="alert">{error}</p>}
        <button className="boton-texto primario grande" disabled={ocupado}>
          {ocupado ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
      <p className="enlaces-cuenta">
        <a href="#/cuenta/recuperar">Olvidé mi contraseña</a>
        <span>¿No tienes cuenta? <a href="#/cuenta/registro">Crear cuenta</a></span>
      </p>
      <p className="nota">
        No necesitas cuenta para dibujar y presentar jugadas: todo se guarda en este dispositivo. La cuenta sirve para
        tener tus jugadas en la nube y compartirlas con permisos.
      </p>
    </Marco>
  );
}

type Formulario = Omit<DatosRegistro, 'numero'> & { numero: string };
const VACIO: Formulario = {
  nombre: '',
  apellido: '',
  correo: '',
  contrasena: '',
  fecha_nacimiento: '',
  apodo: '',
  numero: '',
  rol: undefined,
  match_categoria: undefined,
};

function Registro() {
  const [f, setF] = useState<Formulario>(VACIO);
  const [casillas, setCasillas] = useState<EstadoCasillas>(CASILLAS_VACIAS);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [listo, setListo] = useState<string | null>(null);

  const cambiar = <K extends keyof Formulario>(k: K, v: Formulario[K]) => setF((x) => ({ ...x, [k]: v }));
  const ambas = casillas.terminos && casillas.privacidad;
  const edad = f.fecha_nacimiento ? clasificarEdad(f.fecha_nacimiento) : null;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const { errores: errs } = validarRegistro({ ...f, numero: f.numero === '' ? undefined : Number(f.numero) });
    setErrores(errs);
    if (Object.keys(errs).length) return;
    if (edad === 'menor_de_14') return setError('Por ahora Pizarra Ultimate es para personas de 14 años o más.');
    if (!ambas) return;
    setOcupado(true);
    try {
      await llamarFuncion('registro', {
        ...f,
        numero: f.numero === '' ? undefined : Number(f.numero),
        aceptaciones: await armarAceptaciones(),
        redireccion: urlApp(),
      });
      setListo(f.correo.trim().toLowerCase());
    } catch (err) {
      const e2 = err as Error & { errores?: Record<string, string> };
      if (e2.errores) setErrores(e2.errores);
      setError(e2.message);
    } finally {
      setOcupado(false);
    }
  };

  if (listo) {
    return (
      <Marco titulo="Revisa tu correo">
        <p>
          Te enviamos un enlace a <strong>{listo}</strong>. Ábrelo para activar tu cuenta y luego ingresa.
        </p>
        <p className="nota">Si no lo ves en unos minutos, revisa la carpeta de spam o correo no deseado.</p>
        <button className="boton-texto primario" onClick={() => irA('/cuenta')}>
          Ir a ingresar
        </button>
      </Marco>
    );
  }

  return (
    <Marco titulo="Crear cuenta">
      <form className="formulario" onSubmit={enviar} noValidate>
        <div className="fila-campos">
          <Campo etiqueta="Nombre *" error={errores.nombre}>
            <input autoComplete="given-name" maxLength={50} value={f.nombre} onChange={(e) => cambiar('nombre', e.target.value)} />
          </Campo>
          <Campo etiqueta="Apellido *" error={errores.apellido}>
            <input autoComplete="family-name" maxLength={50} value={f.apellido} onChange={(e) => cambiar('apellido', e.target.value)} />
          </Campo>
        </div>
        <Campo etiqueta="Correo electrónico *" error={errores.correo} ayuda="Te enviaremos un enlace para verificarlo.">
          <input type="email" autoComplete="email" value={f.correo} onChange={(e) => cambiar('correo', e.target.value)} />
        </Campo>
        <Campo etiqueta="Contraseña *" error={errores.contrasena} ayuda="Mínimo 8 caracteres.">
          <input type="password" autoComplete="new-password" value={f.contrasena} onChange={(e) => cambiar('contrasena', e.target.value)} />
        </Campo>
        <Campo etiqueta="Fecha de nacimiento *" error={errores.fecha_nacimiento} ayuda="Solo para verificar tu edad.">
          <input type="date" value={f.fecha_nacimiento} onChange={(e) => cambiar('fecha_nacimiento', e.target.value)} />
        </Campo>
        {edad === 'menor_de_14' && (
          <p className="error-formulario" role="alert">
            Por ahora Pizarra Ultimate es para personas de 14 años o más.
          </p>
        )}
        {edad === 'menor_14_17' && (
          <p className="aviso-formulario" role="status">
            Si tienes entre 14 y 17 años, necesitas la autorización de tu madre, padre o representante legal. Esa opción
            estará disponible pronto.
          </p>
        )}

        <fieldset className="opcionales">
          <legend>Opcional</legend>
          <div className="fila-campos">
            <Campo etiqueta="Apodo en cancha" error={errores.apodo} ayuda="Es lo que ven los demás en las jugadas.">
              <input maxLength={30} value={f.apodo} onChange={(e) => cambiar('apodo', e.target.value)} />
            </Campo>
            <Campo etiqueta="Número de camiseta" error={errores.numero}>
              <input type="number" min={0} max={99} inputMode="numeric" value={f.numero} onChange={(e) => cambiar('numero', e.target.value)} />
            </Campo>
          </div>
          <Campo etiqueta="Rol preferido">
            <select value={f.rol ?? ''} onChange={(e) => cambiar('rol', (e.target.value || undefined) as Formulario['rol'])}>
              <option value="">—</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {NOMBRE_ROL[r]}
                </option>
              ))}
            </select>
          </Campo>
          <Campo
            etiqueta="Categoría de emparejamiento en mixto"
            ayuda="Opcional. Solo se usa para armar líneas en la categoría mixta."
          >
            <select
              value={f.match_categoria ?? ''}
              onChange={(e) => cambiar('match_categoria', (e.target.value || undefined) as Formulario['match_categoria'])}
            >
              <option value="">—</option>
              {CATEGORIAS_MATCH.map((c) => (
                <option key={c} value={c}>
                  {NOMBRE_MATCH[c]}
                </option>
              ))}
            </select>
          </Campo>
        </fieldset>

        <Casillas valor={casillas} alCambiar={setCasillas} />
        <div className="aviso-privacidad">
          <Markdown texto={AVISO_PRIVACIDAD_CORTO} />
          <a href="#/legal/privacidad" target="_blank" rel="noopener">
            Política de Tratamiento de Datos Personales
          </a>
        </div>

        {error && <p className="error-formulario" role="alert">{error}</p>}
        <button className="boton-texto primario grande" disabled={!ambas || ocupado || edad === 'menor_de_14' || edad === 'menor_14_17'}>
          {ocupado ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
      </form>
      <p className="enlaces-cuenta">
        <span>¿Ya tienes cuenta? <a href="#/cuenta">Ingresar</a></span>
      </p>
    </Marco>
  );
}

function Recuperar() {
  const [correo, setCorreo] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setOcupado(true);
    // Siempre se responde igual, exista o no la cuenta (no se revela qué correos están registrados).
    await supabase.auth.resetPasswordForEmail(correo.trim().toLowerCase(), { redirectTo: urlApp() });
    setOcupado(false);
    setEnviado(true);
  };
  return (
    <Marco titulo="Recuperar contraseña">
      {enviado ? (
        <p>Si existe una cuenta con ese correo, te llegará un enlace para crear una contraseña nueva.</p>
      ) : (
        <form className="formulario" onSubmit={enviar}>
          <Campo etiqueta="Correo electrónico">
            <input type="email" autoComplete="email" required value={correo} onChange={(e) => setCorreo(e.target.value)} />
          </Campo>
          <button className="boton-texto primario grande" disabled={ocupado}>
            Enviar enlace
          </button>
        </form>
      )}
      <p className="enlaces-cuenta">
        <a href="#/cuenta">Volver a ingresar</a>
      </p>
    </Marco>
  );
}

/** Se muestra al volver desde el enlace de recuperación. */
export function NuevaContrasena() {
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState('');
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    if (contrasena.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');
    const { error: err } = await supabase.auth.updateUser({ password: contrasena });
    if (err) return setError('No se pudo cambiar la contraseña. Pide un enlace nuevo.');
    useSesion.setState({ recuperandoContrasena: false });
    avisar('Contraseña actualizada');
    volverAlEditor();
  };
  return (
    <Marco titulo="Nueva contraseña">
      <form className="formulario" onSubmit={enviar}>
        <Campo etiqueta="Contraseña nueva" error={error} ayuda="Mínimo 8 caracteres.">
          <input type="password" autoComplete="new-password" value={contrasena} onChange={(e) => setContrasena(e.target.value)} />
        </Campo>
        <button className="boton-texto primario grande">Guardar contraseña</button>
      </form>
    </Marco>
  );
}

export function Cuenta({ modo }: { modo: 'ingresar' | 'registro' | 'recuperar' }) {
  const usuario = useSesion((s) => s.usuario);
  if (!hayServidor) {
    return (
      <Marco titulo="Cuentas">
        <p>Las cuentas todavía no están activadas en esta versión. Puedes seguir usando la app: todo se guarda en este dispositivo.</p>
      </Marco>
    );
  }
  if (usuario) {
    return (
      <Marco titulo="Ya ingresaste">
        <p>Tu sesión está iniciada.</p>
        <button className="boton-texto primario" onClick={() => irA('/mis-datos')}>
          Ir a Mis datos
        </button>
      </Marco>
    );
  }
  if (modo === 'registro') return <Registro />;
  if (modo === 'recuperar') return <Recuperar />;
  return <Ingresar />;
}
