import { useSyncExternalStore } from 'react';
import type { Orientacion } from '../modelo/tipos';

/** Celular en vertical: pantalla angosta y más alta que ancha. */
const CELULAR_VERTICAL = '(max-width: 760px) and (orientation: portrait)';
/** Celular acostado: poca altura y más ancho que alto. */
const CELULAR_ACOSTADO = '(max-height: 500px) and (orientation: landscape)';
/** Barra superior compacta (mismo corte que el CSS de celular). */
export const PANTALLA_ANGOSTA = '(max-width: 760px)';

function usarConsulta(consulta: string): boolean {
  return useSyncExternalStore(
    (avisar) => {
      const mq = window.matchMedia?.(consulta);
      mq?.addEventListener('change', avisar);
      return () => mq?.removeEventListener('change', avisar);
    },
    () => !!window.matchMedia?.(consulta).matches,
    () => false,
  );
}

export const usePantallaAngosta = () => usarConsulta(PANTALLA_ANGOSTA);

/**
 * En el celular la cancha sigue al aparato: vertical si lo sostienes de pie y horizontal
 * si lo acuestas. En computador y tablet se respeta la orientación guardada en la jugada.
 * No cambia la jugada: solo cómo se dibuja en el editor.
 */
export function useOrientacionEditor(guardada: Orientacion): Orientacion {
  const dePie = usarConsulta(CELULAR_VERTICAL);
  const acostado = usarConsulta(CELULAR_ACOSTADO);
  if (dePie) return 'vertical';
  if (acostado) return 'horizontal';
  return guardada;
}

/** true cuando la orientación la decide el aparato y el botón Rotar no tendría efecto. */
export function useOrientacionAutomatica(): boolean {
  // Las dos consultas se leen siempre (sin ||) para no cambiar el orden de los hooks.
  const dePie = usarConsulta(CELULAR_VERTICAL);
  const acostado = usarConsulta(CELULAR_ACOSTADO);
  return dePie || acostado;
}
