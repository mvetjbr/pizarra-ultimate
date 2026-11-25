// Los colores de la cancha, los jugadores y las flechas los pone el tema activo (src/temas).
// Aquí quedan solo los que son iguales en todos los temas: la insignia de match y los colores
// que la persona elige para sus zonas (son datos de la jugada, no apariencia).
export const COLORES = {
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
