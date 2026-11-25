import { useEffect, useState } from 'react';
import { usePreferencias } from '../estado/preferencias';
import { useBiblioteca } from '../estado/bibliotecaStore';
import { avisar } from '../estado/avisos';
import { Dialogo } from '../ui/Dialogo';
import { DIBUJO_MUNECO } from './munecosSvg';
import { mascotasBloqueadas, premiosPendientes } from './munecos';
import { DibujoMuneco } from './Conteo';

/**
 * Ventana para gastar un premio: la persona elige qué mascota bloqueada desbloquear (ADR 0013).
 * Si sigue teniendo premios después de elegir, la ventana sigue abierta.
 */
export function ElegirMascota({ alCerrar, inicial }: { alCerrar: () => void; inicial?: string }) {
  const elegidas = usePreferencias((s) => s.mascotasElegidas);
  const modoEditor = usePreferencias((s) => s.modoEditor);
  const actualizar = usePreferencias((s) => s.actualizar);
  const jugadas = useBiblioteca((s) => s.jugadas.length);
  const pendientes = premiosPendientes(jugadas, elegidas, modoEditor);
  const bloqueadas = mascotasBloqueadas(elegidas, modoEditor);
  const [seleccion, setSeleccion] = useState<string | null>(inicial && bloqueadas.includes(inicial) ? inicial : null);

  const desbloquear = () => {
    if (!seleccion || pendientes < 1) return;
    actualizar({ mascotasElegidas: [...elegidas, seleccion], muneco: seleccion });
    avisar(`Desbloqueaste: ${DIBUJO_MUNECO[seleccion].nombre}`);
    setSeleccion(null);
    if (pendientes - 1 < 1) alCerrar();
  };

  return (
    <Dialogo
      titulo="¡Ganaste un muñeco!"
      alCerrar={alCerrar}
      pie={
        <>
          <button className="boton-texto primario" onClick={desbloquear} disabled={!seleccion}>
            {seleccion ? `Desbloquear: ${DIBUJO_MUNECO[seleccion].nombre}` : 'Desbloquear'}
          </button>
          <button className="boton-texto" onClick={alCerrar}>
            Luego
          </button>
        </>
      }
    >
      <p className="texto-premio">
        {pendientes > 1
          ? `Tienes ${pendientes} premios. Elige la primera mascota que quieres desbloquear.`
          : 'Guardaste 5 jugadas más. Elige qué mascota quieres desbloquear.'}
      </p>
      <div className="grilla-munecos" role="radiogroup" aria-label="Mascotas para desbloquear">
        {bloqueadas.map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={k === seleccion}
            className={`con-nombre${k === seleccion ? ' elegido' : ''}`}
            title={DIBUJO_MUNECO[k].nombre}
            onClick={() => setSeleccion(k)}
          >
            <DibujoMuneco clave={k} />
            <span className="nombre-muneco">{DIBUJO_MUNECO[k].nombre}</span>
          </button>
        ))}
      </div>
    </Dialogo>
  );
}

// Fuera del componente para que no se pierda si el editor se desmonta (presentación, cuenta…).
let pendientesVistos: number | null = null;

/** Abre la ventana de premio cuando la persona gana uno nuevo (montado una sola vez en el editor). */
export function AvisoPremio() {
  const jugadas = useBiblioteca((s) => s.jugadas.length);
  const elegidas = usePreferencias((s) => s.mascotasElegidas);
  const modoEditor = usePreferencias((s) => s.modoEditor);
  const pendientes = premiosPendientes(jugadas, elegidas, modoEditor);
  const [abierta, setAbierta] = useState(false);

  useEffect(() => {
    if (pendientesVistos !== null && pendientes > pendientesVistos) setAbierta(true);
    pendientesVistos = pendientes;
  }, [pendientes]);

  if (!abierta || pendientes < 1) return null;
  return <ElegirMascota alCerrar={() => setAbierta(false)} />;
}
