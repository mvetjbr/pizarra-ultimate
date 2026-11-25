/*
 * Un tema solo cambia la apariencia: colores, fuentes, radios, bordes y la FORMA de los jugadores.
 * Nunca la funcionalidad ni los datos de las jugadas. Las reglas de cada uno están en DESIGN.md.
 */

export type IdTema = 'clasico' | 'minimalista' | 'organico' | 'electronic' | 'afro';

/** Ataque y defensa se distinguen por forma en todos los temas (no solo por color). */
export type FormaJugador = 'circulo' | 'anillo' | 'triangulo' | 'triangulo-redondeado';

export interface EstiloJugador {
  forma: FormaJugador;
  relleno: string;
  borde: string;
  /** Grosor del borde en metros de la cancha. */
  anchoBorde: number;
  /** Color del número. */
  texto: string;
  /** Tamaño relativo al de siempre (1 = igual). */
  escala?: number;
  /** Anillo exterior (p. ej. Orgánico). */
  anillo?: string;
  /** Brillo alrededor (p. ej. Electronic). */
  brillo?: string;
}

export interface TemaCancha {
  /** Fondo detrás de la cancha (también en las imágenes exportadas). */
  fondo: string;
  cesped: string;
  zona: string;
  /** Zonas de anotación con rayas diagonales [color1, color2]. */
  zonaRayas?: [string, string];
  lineas: string;
  /** Grosor de las líneas en píxeles de pantalla. */
  anchoLinea: number;
  /** Líneas de gol en otro color (y con brillo opcional). */
  lineaGol?: { color: string; brillo?: boolean };
  /** Borde exterior en otro color, con brillo opcional. */
  borde?: { color: string; brillo?: boolean };
  /** Esquinas redondeadas de la cancha (metros). */
  radio?: number;
  /** Cuadrícula opcional. */
  cuadricula: string;
}

export interface Tema {
  id: IdTema;
  nombre: string;
  frase: string;
  /** Fuentes: familias CSS con respaldo y la consulta de Google Fonts (css2?family=…). */
  fuentes: { titulo: string; texto: string; google: string };
  /** Variables CSS de la interfaz (sin el prefijo --). */
  css: Record<string, string>;
  cancha: TemaCancha;
  ataque: EstiloJugador;
  defensa: EstiloJugador;
  flechas: { corteAtaque: string; corteDefensa: string; pase: string; defensa: string };
  disco: { relleno: string; borde: string };
  /** Marca de selección (halo de elementos elegidos). */
  seleccion: string;
  /** Color de la barra del navegador en el celular. */
  barraNavegador: string;
}
