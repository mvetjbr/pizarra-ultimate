import type { ReactNode } from 'react';

function Icono({ children, tam = 24 }: { children: ReactNode; tam?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={tam}
      height={tam}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

type P = { tam?: number };

export const IconoPlay = ({ tam }: P) => (
  <Icono tam={tam}>
    <path d="M7 4.5v15l12-7.5z" fill="currentColor" />
  </Icono>
);
export const IconoPausa = ({ tam }: P) => (
  <Icono tam={tam}>
    <rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" />
    <rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" />
  </Icono>
);
export const IconoAnterior = ({ tam }: P) => (
  <Icono tam={tam}>
    <path d="M18 5L9 12l9 7z" fill="currentColor" />
    <path d="M6 5v14" />
  </Icono>
);
export const IconoSiguiente = ({ tam }: P) => (
  <Icono tam={tam}>
    <path d="M6 5l9 7-9 7z" fill="currentColor" />
    <path d="M18 5v14" />
  </Icono>
);
export const IconoDuplicar = () => (
  <Icono>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3" />
  </Icono>
);
export const IconoIzquierda = () => (
  <Icono>
    <path d="M15 5l-7 7 7 7" />
  </Icono>
);
export const IconoDerecha = () => (
  <Icono>
    <path d="M9 5l7 7-7 7" />
  </Icono>
);
export const IconoPresentar = () => (
  <Icono>
    <rect x="3" y="4" width="18" height="12" rx="1.5" />
    <path d="M12 16v4M8 20h8M10 8l4 2-4 2z" />
  </Icono>
);
