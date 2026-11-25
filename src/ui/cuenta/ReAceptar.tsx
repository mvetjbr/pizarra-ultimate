import { useState } from 'react';
import { llamarFuncion } from '../../nube/cliente';
import { cerrarSesion, recargarSesion, useSesion } from '../../nube/sesion';
import { armarAceptaciones, Casillas, CASILLAS_VACIAS, type EstadoCasillas } from './Casillas';

/**
 * Pantalla bloqueante: la persona tiene sesión pero no ha aceptado la versión vigente de
 * términos o política (cuenta creada antes, o se publicó una versión nueva).
 */
export function ReAceptar() {
  const pendientes = useSesion((s) => s.pendientes);
  const [casillas, setCasillas] = useState<EstadoCasillas>(CASILLAS_VACIAS);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const ambas = casillas.terminos && casillas.privacidad;

  const aceptar = async () => {
    setOcupado(true);
    setError('');
    try {
      await llamarFuncion('aceptar', { aceptaciones: await armarAceptaciones() });
      await recargarSesion();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="fondo-dialogo">
      <div className="dialogo" role="dialog" aria-modal="true" aria-label="Actualización de documentos legales">
        <header className="dialogo-cabecera">
          <h2>Actualizamos nuestros documentos</h2>
        </header>
        <div className="dialogo-cuerpo">
          <p>
            Para seguir usando tu cuenta necesitamos que leas y aceptes la versión vigente de:{' '}
            {pendientes.map((p) => (p.tipo === 'terminos' ? 'Términos y Condiciones' : 'Política de Tratamiento de Datos')).join(' y ')}.
          </p>
          <Casillas valor={casillas} alCambiar={setCasillas} prefijo="re-" />
          {error && <p className="error-formulario" role="alert">{error}</p>}
        </div>
        <footer className="dialogo-pie">
          <button className="boton-texto primario" disabled={!ambas || ocupado} onClick={aceptar}>
            {ocupado ? 'Guardando…' : 'Aceptar y continuar'}
          </button>
          <button className="boton-texto" onClick={() => void cerrarSesion()}>
            No acepto (cerrar sesión)
          </button>
        </footer>
      </div>
    </div>
  );
}
