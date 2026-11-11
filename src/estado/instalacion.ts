import { create } from 'zustand';

interface EventoInstalacion extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface EstadoInstalacion {
  /** Evento guardado para mostrar el diálogo de instalación cuando el usuario quiera. */
  evento: EventoInstalacion | null;
  instalada: boolean;
}

const yaInstalada = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

export const useInstalacion = create<EstadoInstalacion>(() => ({ evento: null, instalada: yaInstalada() }));

// El navegador avisa una sola vez y muy temprano, por eso se escucha al cargar el módulo.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  useInstalacion.setState({ evento: e as EventoInstalacion });
});
window.addEventListener('appinstalled', () => useInstalacion.setState({ evento: null, instalada: true }));

export const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

/** Muestra el diálogo del navegador. Devuelve false si no hay forma de instalar desde la app. */
export async function instalar(): Promise<boolean> {
  const e = useInstalacion.getState().evento;
  if (!e) return false;
  await e.prompt();
  await e.userChoice;
  useInstalacion.setState({ evento: null });
  return true;
}
