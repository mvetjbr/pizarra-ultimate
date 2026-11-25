import { create } from 'zustand';
import { hayEnlace } from '../exportar/enlace';

// Pantalla de inicio (crear cuenta, iniciar sesión u omitir).
// "Omitir" se recuerda en este dispositivo: la pantalla no vuelve a salir hasta que se borren los datos del navegador.
// Quien llega con un enlace de jugada (#/ver/…) va directo a la jugada, sin pasar por el inicio.

const CLAVE = 'pizarra-inicio-omitido';

function leerOmitido(): boolean {
  try {
    return localStorage.getItem(CLAVE) === '1';
  } catch {
    return false;
  }
}

export const useInicio = create<{ omitido: boolean }>(() => ({ omitido: leerOmitido() || hayEnlace() }));

export function omitirInicio() {
  try {
    localStorage.setItem(CLAVE, '1');
  } catch {
    // Sin almacenamiento (ventana privada): se omite solo por esta visita.
  }
  useInicio.setState({ omitido: true });
}
