import { useEffect } from 'react';
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
      </main>
    </div>
  );
}
