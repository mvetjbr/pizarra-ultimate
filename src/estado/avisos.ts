import { create } from 'zustand';

interface EstadoAviso {
  mensaje: string | null;
  error: boolean;
}

export const useAviso = create<EstadoAviso>(() => ({ mensaje: null, error: false }));

let temporizador: ReturnType<typeof setTimeout> | undefined;

/** Muestra un mensaje corto abajo de la pantalla. */
export function avisar(mensaje: string, error = false) {
  clearTimeout(temporizador);
  useAviso.setState({ mensaje, error });
  temporizador = setTimeout(() => useAviso.setState({ mensaje: null }), error ? 5000 : 3000);
}
