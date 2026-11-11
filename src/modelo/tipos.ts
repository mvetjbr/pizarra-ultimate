// Modelo de datos. Todas las coordenadas están en METROS de la cancha:
// x de 0 a 100 (largo), y de 0 a 37 (ancho).

export type Equipo = 'ataque' | 'defensa';
export type Match = 'M' | 'F';
export type TipoFlecha = 'corte' | 'pase' | 'defensa';
export type FormaZona = 'rect' | 'elipse';
export type Vista = 'completa' | 'media' | 'zona';
export type Lado = 'izquierda' | 'derecha';
export type Orientacion = 'horizontal' | 'vertical';
export type Categoria = 'Ataque' | 'Defensa' | 'Pull' | 'Zona' | 'Punto final' | 'Otro';

export const CATEGORIAS: Categoria[] = ['Ataque', 'Defensa', 'Pull', 'Zona', 'Punto final', 'Otro'];

export interface Punto {
  x: number;
  y: number;
}

export interface Player extends Punto {
  id: string;
  equipo: Equipo;
  etiqueta: string;
  match?: Match;
  /** Jugador del roster asociado. */
  rosterId?: string;
  /** Nombre copiado del roster (para que viaje en enlaces y archivos). */
  nombre?: string;
}

export interface Disco extends Punto {
  poseedorId?: string;
}

export interface Arrow {
  id: string;
  tipo: TipoFlecha;
  /** Último punto conocido de cada extremo (se usa si no está anclado a un jugador). */
  desde: Punto;
  hasta: Punto;
  desdeId?: string;
  hastaId?: string;
  /** Solo para pases: curva con punto de control. */
  curva?: boolean;
  control?: Punto;
}

export interface Zone {
  id: string;
  forma: FormaZona;
  x: number;
  y: number;
  ancho: number;
  alto: number;
  color: string;
  texto?: string;
}

export interface Label extends Punto {
  id: string;
  texto: string;
}

export interface Step {
  id: string;
  jugadores: Player[];
  disco: Disco;
  flechas: Arrow[];
  zonas: Zone[];
  textos: Label[];
}

export interface Play {
  id: string;
  nombre: string;
  categoria: Categoria;
  etiquetas: string[];
  notas: string;
  creada: number;
  editada: number;
  vista: Vista;
  /** Qué mitad o zona de anotación se muestra cuando la vista no es completa. */
  lado: Lado;
  orientacion: Orientacion;
  pasos: Step[];
}
