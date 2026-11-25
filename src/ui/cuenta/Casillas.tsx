import { useState } from 'react';
import { TEXTO_CASILLA, TIPOS_ACEPTABLES, type Aceptacion, type TipoAceptable } from '../../../supabase/functions/_compartido/reglas.ts';
import { documento, hashDe } from '../../legal/documentos';
import { VentanaLegal } from './PantallaLegal';

export type EstadoCasillas = Record<TipoAceptable, boolean>;
export const CASILLAS_VACIAS: EstadoCasillas = { terminos: false, privacidad: false };

// Casillas marcadas en la página legal (#/legal/…): el registro las recibe ya marcadas.
// Solo en memoria: si se recarga la página, la persona vuelve a marcarlas.
let precargadas: EstadoCasillas = CASILLAS_VACIAS;
export const guardarCasillas = (v: EstadoCasillas) => {
  precargadas = v;
};
export const tomarCasillas = (): EstadoCasillas => precargadas;

/** Arma las aceptaciones con la versión vigente y el hash del texto exacto que se mostró. */
export async function armarAceptaciones(): Promise<Aceptacion[]> {
  return Promise.all(
    TIPOS_ACEPTABLES.map(async (tipo) => {
      const doc = documento(tipo);
      if (!doc) throw new Error('Falta un documento legal.');
      return { tipo, version: doc.version, hash: await hashDe(doc.texto), texto_casilla: TEXTO_CASILLA[tipo] };
    }),
  );
}

const ENLACE: Record<TipoAceptable, string> = { terminos: 'Ver términos', privacidad: 'Ver política' };

/**
 * Las dos casillas separadas, desmarcadas por defecto, con el enlace al lado.
 * El documento se abre en una ventana, sin perder lo escrito en el formulario.
 */
export function Casillas({
  valor,
  alCambiar,
  prefijo = '',
}: {
  valor: EstadoCasillas;
  alCambiar: (v: EstadoCasillas) => void;
  prefijo?: string;
}) {
  const [abierto, setAbierto] = useState<TipoAceptable | null>(null);
  return (
    <div className="casillas-legales">
      {TIPOS_ACEPTABLES.map((tipo) => (
        <div className="casilla-legal" key={tipo}>
          <input
            id={`${prefijo}acepta-${tipo}`}
            type="checkbox"
            checked={valor[tipo]}
            onChange={(e) => alCambiar({ ...valor, [tipo]: e.target.checked })}
          />
          <label htmlFor={`${prefijo}acepta-${tipo}`}>{TEXTO_CASILLA[tipo]}</label>
          <button type="button" className="enlace" onClick={() => setAbierto(tipo)}>
            {ENLACE[tipo]}
          </button>
        </div>
      ))}
      {abierto && <VentanaLegal tipo={abierto} alCerrar={() => setAbierto(null)} />}
    </div>
  );
}
