// Colores de la cancha (SVG y exportaciones). Reflejan las variables de DESIGN.md:
// --cesped, --cesped-zona, --linea-cancha, --mostaza (ataque) y --coral (defensa).
export const COLORES = {
  cesped: '#3F7F5E',
  zonaAnotacion: '#356B50',
  lineas: '#F5EAD3',
  ataque: '#DCA43A',
  defensa: '#E6785E',
  disco: '#FFFFFF',
  bordeDisco: '#8A8A8A',
  pase: '#FFFFFF',
  movDefensa: '#E6785E',
  seleccion: '#00E5FF',
  matchM: '#5B2A86',
  matchF: '#C2185B',
} as const;

export const COLORES_ZONA = [
  { nombre: 'Amarillo', valor: '#FFE066' },
  { nombre: 'Azul', valor: '#4DABF7' },
  { nombre: 'Rojo', valor: '#FF6B6B' },
  { nombre: 'Blanco', valor: '#FFFFFF' },
  { nombre: 'Verde', valor: '#69DB7C' },
];

/** Luminancia relativa (0 = negro, 1 = blanco). */
export function luminancia(hex: string): number {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(n.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Color de texto legible sobre un fondo dado. */
export const textoSobre = (fondo: string) => (luminancia(fondo) > 0.35 ? '#111111' : '#FFFFFF');
