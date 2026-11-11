import { useEffect, useRef, type ReactNode } from 'react';
import { IconoCerrar } from './Iconos';

interface Props {
  titulo: string;
  alCerrar: () => void;
  children: ReactNode;
  pie?: ReactNode;
  grande?: boolean;
}

/** Ventana modal: se cierra con Esc, con la X o tocando fuera. */
export function Dialogo({ titulo, alCerrar, children, pie, grande }: Props) {
  const caja = useRef<HTMLDivElement>(null);
  // Ref para no reinstalar el efecto (y robar el foco) cada vez que el padre se vuelve a dibujar.
  const cerrar = useRef(alCerrar);
  cerrar.current = alCerrar;

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    caja.current?.focus();
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        cerrar.current();
      }
    };
    window.addEventListener('keydown', alPresionar, true);
    return () => {
      window.removeEventListener('keydown', alPresionar, true);
      anterior?.focus?.();
    };
  }, []);

  return (
    <div
      className="fondo-dialogo"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) alCerrar();
      }}
    >
      <div
        ref={caja}
        className={`dialogo${grande ? ' grande' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
      >
        <header className="dialogo-cabecera">
          <h2>{titulo}</h2>
          <button className="boton-icono pequeno" onClick={alCerrar} aria-label="Cerrar">
            <IconoCerrar />
          </button>
        </header>
        <div className="dialogo-cuerpo">{children}</div>
        {pie && <footer className="dialogo-pie">{pie}</footer>}
      </div>
    </div>
  );
}
