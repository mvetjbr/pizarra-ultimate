import { useEffect, useState } from 'react';
import { hayServidor } from '../../nube/cliente';
import { useSesion } from '../../nube/sesion';
import { Casillas, guardarCasillas, tomarCasillas, type EstadoCasillas } from './Casillas';
import {
  documento,
  NOMBRE_DOCUMENTO,
  TIPOS_DOCUMENTO,
  versiones,
  vigenciaDe,
  type TipoDocumento,
} from '../../legal/documentos';
import { irA, volverAlEditor } from '../../estado/ruta';
import { Markdown } from '../Markdown';
import { Dialogo } from '../Dialogo';

/** Texto de un documento con su versión y vigencia (se usa en la página y en las ventanas). */
export function TextoLegal({ tipo, version }: { tipo: TipoDocumento; version?: string }) {
  const doc = documento(tipo, version);
  if (!doc) return <p className="vacio">No existe esa versión del documento.</p>;
  return (
    <article className="texto-legal">
      <p className="meta-legal">
        Versión <strong>{doc.version}</strong>
        {doc.vigente ? ' (vigente)' : ' (versión anterior)'} · Vigente desde {vigenciaDe(doc.texto) || '—'}
      </p>
      <Markdown texto={doc.texto} />
    </article>
  );
}

/** Ventana con un documento legal: se abre desde el registro sin perder lo escrito. */
export function VentanaLegal({ tipo, alCerrar }: { tipo: TipoDocumento; alCerrar: () => void }) {
  return (
    <Dialogo titulo={NOMBRE_DOCUMENTO[tipo]} alCerrar={alCerrar} grande>
      <TextoLegal tipo={tipo} />
    </Dialogo>
  );
}

/**
 * Al final de Términos y Privacidad: las casillas de aceptación y el botón para crear la cuenta.
 * La aceptación queda registrada (fecha, hora, versión y hash) cuando se crea la cuenta, no aquí.
 */
function AceptarYCrear() {
  const usuario = useSesion((s) => s.usuario);
  const [casillas, setCasillas] = useState<EstadoCasillas>(tomarCasillas);
  if (usuario) return null;
  const ambas = casillas.terminos && casillas.privacidad;
  const cambiar = (v: EstadoCasillas) => {
    setCasillas(v);
    guardarCasillas(v);
  };
  return (
    <section className="aceptar-y-crear" aria-labelledby="titulo-aceptar">
      <h2 id="titulo-aceptar">¿Estás de acuerdo?</h2>
      {hayServidor ? (
        <>
          <p className="nota">Marca las dos casillas y crea tu cuenta. Guardamos la fecha, la hora y la versión que aceptaste.</p>
          <Casillas valor={casillas} alCambiar={cambiar} prefijo="legal-" />
          <button className="boton-texto primario grande" disabled={!ambas} onClick={() => irA('/cuenta/registro')}>
            Crear mi cuenta
          </button>
          <p className="enlaces-cuenta">
            <span>
              ¿Ya tienes cuenta? <a href="#/cuenta">Ingresar</a>
            </span>
          </p>
        </>
      ) : (
        <p className="nota">Las cuentas todavía no están activadas en esta versión. Puedes usar la app sin cuenta.</p>
      )}
    </section>
  );
}

/** Página pública #/legal/<tipo>[/<versión>]: se puede abrir sin cuenta (requisito de las tiendas). */
export function PantallaLegal({ tipo, version }: { tipo: string; version?: string }) {
  const t = (TIPOS_DOCUMENTO.includes(tipo as TipoDocumento) ? tipo : 'terminos') as TipoDocumento;
  const lista = versiones(t);
  useEffect(() => {
    document.title = `${NOMBRE_DOCUMENTO[t]} · Pizarra Ultimate`;
    return () => {
      document.title = 'Pizarra Ultimate';
    };
  }, [t]);

  return (
    <div className="pagina">
      <header className="pagina-cabecera">
        <button className="boton-texto" onClick={volverAlEditor}>
          ← Volver a la app
        </button>
        <nav className="pestanas-legales" aria-label="Documentos legales">
          {TIPOS_DOCUMENTO.map((d) => (
            <a key={d} href={`#/legal/${d}`} aria-current={d === t ? 'page' : undefined}>
              {NOMBRE_DOCUMENTO[d]}
            </a>
          ))}
        </nav>
      </header>
      <main className="pagina-cuerpo">
        {lista.length > 1 && (
          <label className="campo selector-version">
            <span>Versión</span>
            <select value={version ?? documento(t)?.version} onChange={(e) => irA(`/legal/${t}/${e.target.value}`)}>
              {lista.map((v) => (
                <option key={v} value={v}>
                  {v}
                  {documento(t, v)?.vigente ? ' (vigente)' : ''}
                </option>
              ))}
            </select>
          </label>
        )}
        <TextoLegal tipo={t} version={version} />
        {(t === 'terminos' || t === 'privacidad') && <AceptarYCrear />}
      </main>
    </div>
  );
}
