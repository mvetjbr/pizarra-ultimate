import { create } from 'zustand';
import type { IdTema, Tema } from './tipos';
import { clasico } from './clasico';
import { minimalista } from './minimalista';
import { organico } from './organico';
import { electronic } from './electronic';
import { afro } from './afro';

export type { IdTema, Tema, EstiloJugador, FormaJugador, TemaCancha } from './tipos';

/** Los cinco estilos, en el orden en que se muestran. El primero es el predeterminado. */
export const TEMAS: Tema[] = [clasico, minimalista, organico, electronic, afro];
const POR_ID = Object.fromEntries(TEMAS.map((t) => [t.id, t])) as Record<IdTema, Tema>;

const CLAVE = 'pizarra:tema';

function leerGuardado(): IdTema {
  try {
    const v = localStorage.getItem(CLAVE);
    if (v && v in POR_ID) return v as IdTema;
  } catch {
    /* sin almacenamiento: clásico */
  }
  return 'clasico';
}

export const useTema = create<{ tema: Tema }>(() => ({ tema: POR_ID[leerGuardado()] }));

/** Carga desde Google Fonts solo las fuentes del tema (una vez por tema). */
function cargarFuentes(t: Tema) {
  const id = `fuentes-${t.id}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?${t.fuentes.google}&display=swap`;
  document.head.appendChild(link);
}

/** Pone las variables CSS del tema en <html> y su atributo data-tema (para las decoraciones). */
function pintar(t: Tema) {
  const raiz = document.documentElement;
  raiz.dataset.tema = t.id;
  for (const [nombre, valor] of Object.entries(t.css)) raiz.style.setProperty(`--${nombre}`, valor);
  raiz.style.setProperty('--fuente-titulo', t.fuentes.titulo);
  raiz.style.setProperty('--fuente-texto', t.fuentes.texto);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.barraNavegador);
  cargarFuentes(t);
}

/** Cambia el estilo al instante (sin recargar) y lo deja guardado en este dispositivo. */
export function elegirTema(id: IdTema) {
  const t = POR_ID[id];
  if (!t) return;
  try {
    localStorage.setItem(CLAVE, id);
  } catch {
    /* no se pudo guardar: igual se aplica */
  }
  useTema.setState({ tema: t });
}

/** Aplica el tema guardado y los cambios siguientes. Llamar una vez, antes de dibujar la app. */
export function iniciarTemas() {
  pintar(useTema.getState().tema);
  useTema.subscribe((s, prev) => {
    if (s.tema !== prev.tema) pintar(s.tema);
  });
}

/** Tema activo para código que no es un componente (exportaciones). */
export const temaActivo = () => useTema.getState().tema;
