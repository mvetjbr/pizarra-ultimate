import { useEffect, useState } from 'react';

// Rutas por hash (#/legal/terminos, #/cuenta, #/mis-datos…): funcionan en GitHub Pages sin servidor.
// Los fragmentos de Supabase (#access_token=…) y los enlaces de jugadas (#/ver/…) no son rutas de pantalla.

export type Ruta =
  | { pantalla: 'editor' }
  | { pantalla: 'legal'; tipo: string; version?: string }
  | { pantalla: 'cuenta'; modo: 'ingresar' | 'registro' | 'recuperar' }
  | { pantalla: 'mis-datos' };

export function leerRuta(hash = location.hash): Ruta {
  const partes = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (partes[0] === 'legal') return { pantalla: 'legal', tipo: partes[1] ?? 'terminos', version: partes[2] };
  if (partes[0] === 'cuenta') {
    const modo = partes[1] === 'registro' || partes[1] === 'recuperar' ? partes[1] : 'ingresar';
    return { pantalla: 'cuenta', modo };
  }
  if (partes[0] === 'mis-datos') return { pantalla: 'mis-datos' };
  return { pantalla: 'editor' };
}

export function irA(ruta: string) {
  location.hash = ruta;
}

/** Vuelve al editor sin dejar un "#" vacío en la dirección. */
export function volverAlEditor() {
  history.pushState(null, '', `${location.pathname}${location.search}`);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function useRuta(): Ruta {
  const [ruta, setRuta] = useState(leerRuta);
  useEffect(() => {
    const alCambiar = () => setRuta(leerRuta());
    window.addEventListener('hashchange', alCambiar);
    window.addEventListener('popstate', alCambiar);
    return () => {
      window.removeEventListener('hashchange', alCambiar);
      window.removeEventListener('popstate', alCambiar);
    };
  }, []);
  return ruta;
}
