import { supabase } from './cliente';
import { useSesion } from './sesion';
import { usePreferencias } from '../estado/preferencias';

// Mascota en la cuenta (migración 20261126000100_mascota_en_perfil.sql).
// Al ingresar: la mascota de la cuenta pasa a este dispositivo y las desbloqueadas se juntan (las de aquí y las de allá).
// Al cambiarla con la sesión iniciada: se guarda en la cuenta. Sin sesión, sigue guardándose solo en el dispositivo.
// Si la base aún no tiene las columnas, falla en silencio y todo sigue como antes.

let ultimoGuardado = '';
const huella = (muneco: string, elegidas: readonly string[]) => `${muneco}|${[...elegidas].sort().join(',')}`;

async function guardarEnCuenta() {
  const usuario = useSesion.getState().usuario;
  if (!supabase || !usuario) return;
  const { muneco, mascotasElegidas } = usePreferencias.getState();
  const h = huella(muneco, mascotasElegidas);
  if (h === ultimoGuardado) return;
  ultimoGuardado = h;
  const { error } = await supabase
    .from('profiles')
    .update({ muneco, mascotas_elegidas: mascotasElegidas })
    .eq('id', usuario.id);
  if (error) {
    ultimoGuardado = '';
    console.warn('No se pudo guardar la mascota en la cuenta', error.message);
  }
}

/** Trae la mascota de la cuenta a este dispositivo y sube lo que la cuenta no tenga. */
function traerDeLaCuenta() {
  const perfil = useSesion.getState().perfil;
  if (!perfil) return;
  const prefs = usePreferencias.getState();
  const deLaCuenta = perfil.mascotas_elegidas ?? [];
  const juntas = [...new Set([...prefs.mascotasElegidas, ...deLaCuenta])];
  const muneco = perfil.muneco || prefs.muneco;
  if (muneco !== prefs.muneco || juntas.length !== prefs.mascotasElegidas.length) {
    prefs.actualizar({ muneco, mascotasElegidas: juntas });
  }
  ultimoGuardado = perfil.muneco ? huella(perfil.muneco, deLaCuenta) : '';
  void guardarEnCuenta(); // primera vez, o si este dispositivo tenía mascotas que la cuenta no
}

/** Se llama cuando las preferencias del dispositivo ya están cargadas. */
export function iniciarMascotaEnCuenta() {
  if (!supabase) return;
  let perfilActual: string | null = null;
  const revisar = () => {
    const id = useSesion.getState().perfil?.id ?? null;
    if (id === perfilActual) return;
    perfilActual = id;
    ultimoGuardado = '';
    if (id) traerDeLaCuenta();
  };
  revisar();
  useSesion.subscribe(revisar);

  let espera: ReturnType<typeof setTimeout> | undefined;
  usePreferencias.subscribe((s, antes) => {
    if (s.muneco === antes.muneco && s.mascotasElegidas === antes.mascotasElegidas) return;
    clearTimeout(espera);
    espera = setTimeout(() => void guardarEnCuenta(), 800);
  });
}
