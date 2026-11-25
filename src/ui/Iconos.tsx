import type { ReactNode } from 'react';

function Icono({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="icono"
    >
      {/* Círculo de color detrás, desplazado (regla de íconos de DESIGN.md) */}
      <circle className="icono-circulo" cx="13.5" cy="13.5" r="9" />
      {children}
    </svg>
  );
}

export const IconoSeleccionar = () => (
  <Icono>
    <path d="M5 3l14 8-6.5 1.8L10 19z" fill="currentColor" fillOpacity="0.15" />
  </Icono>
);
export const IconoCorte = () => (
  <Icono>
    <path d="M4 20L18 6" />
    <path d="M10 6h8v8" />
  </Icono>
);
export const IconoPase = () => (
  <Icono>
    <path d="M4 20L18 6" strokeDasharray="3 3" />
    <path d="M10 6h8v8" />
  </Icono>
);
export const IconoDefensa = () => (
  <Icono>
    <path d="M4 20L18 6" strokeDasharray="0.1 4" strokeWidth="2.6" />
    <path d="M10 6h8v8" />
  </Icono>
);
export const IconoZona = () => (
  <Icono>
    <rect x="3" y="5" width="18" height="14" rx="2" strokeDasharray="3 2" fill="currentColor" fillOpacity="0.15" />
  </Icono>
);
export const IconoTexto = () => (
  <Icono>
    <path d="M5 6V4h14v2M12 4v16M9 20h6" />
  </Icono>
);
export const IconoBorrar = () => (
  <Icono>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </Icono>
);
export const IconoDeshacer = () => (
  <Icono>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 010 11H11" />
  </Icono>
);
export const IconoRehacer = () => (
  <Icono>
    <path d="M15 14l5-5-5-5" />
    <path d="M20 9H9.5a5.5 5.5 0 000 11H13" />
  </Icono>
);
/** Muñequito: abre Formación y jugadores. */
export const IconoJugadores = () => (
  <Icono>
    <circle cx="12" cy="5" r="2.2" />
    <path d="M12 8v6M7 10.5l5-1.5 5 1.5M12 14l-3.5 6M12 14l3.5 6" />
  </Icono>
);
export const IconoRotar = () => (
  <Icono>
    <path d="M21 12a9 9 0 11-3-6.7" />
    <path d="M21 3v6h-6" />
  </Icono>
);
export const IconoCuadricula = () => (
  <Icono>
    <path d="M3 3h18v18H3zM9 3v18M15 3v18M3 9h18M3 15h18" />
  </Icono>
);
export const IconoMenu = () => (
  <Icono>
    <circle cx="5" cy="12" r="1.2" fill="currentColor" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    <circle cx="19" cy="12" r="1.2" fill="currentColor" />
  </Icono>
);
export const IconoCerrar = () => (
  <Icono>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icono>
);

export const IconoBiblioteca = () => (
  <Icono>
    <path d="M4 5a1 1 0 011-1h4v16H5a1 1 0 01-1-1zM9 4h4v16H9zM14.5 4.6l3.8-1 3.2 15.4-3.8 1z" />
  </Icono>
);
export const IconoCompartir = () => (
  <Icono>
    <circle cx="18" cy="5" r="2.5" />
    <circle cx="6" cy="12" r="2.5" />
    <circle cx="18" cy="19" r="2.5" />
    <path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4" />
  </Icono>
);
export const IconoNotas = () => (
  <Icono>
    <path d="M6 3h9l4 4v14H6z" />
    <path d="M14 3v5h5M9 12h7M9 16h7" />
  </Icono>
);
export const IconoUsuario = () => (
  <Icono>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
  </Icono>
);
