import { create } from 'zustand';
import { hayEnlace } from '../exportar/enlace';

// Pantalla de inicio: sale cada vez que se abre la app (cada visita al enlace), con o sin cuenta.
// Pasarla (omitir, entrar o ingresar) vale solo para esta visita; al recargar o volver a abrir, sale otra vez.
// Quien llega con un enlace de jugada (#/ver/…) va directo a la jugada, sin pasar por el inicio.

export const useInicio = create<{ pasado: boolean }>(() => ({ pasado: hayEnlace() }));

/** Sigue a la pizarra (Omitir, Entrar, o después de ingresar o crear la contraseña). */
export function pasarInicio() {
  useInicio.setState({ pasado: true });
}

/** Vuelve a mostrar la pantalla de inicio (desde el menú «⋯»). */
export function volverAlInicio() {
  useInicio.setState({ pasado: false });
}
