// Revisa que el texto de cada tema tenga contraste de al menos 4,5:1 (y 3:1 en íconos y formas grandes).
// Uso: node scripts/contraste-temas.mjs
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const salida = await build({
  entryPoints: [`${raiz}src/temas/index.ts`],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  logLevel: 'silent',
});
const { TEMAS } = await import(`data:text/javascript;base64,${Buffer.from(salida.outputFiles[0].text).toString('base64')}`);

const lum = (hex) => {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  return [0, 2, 4]
    .map((i) => {
      const v = parseInt(n.slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    })
    .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
};
const contraste = (a, b) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

const masVisible = (e, fondo) =>
  [e.forma === 'anillo' ? null : e.relleno, e.borde, e.anillo].filter(Boolean).sort((a, b) => contraste(b, fondo) - contraste(a, fondo))[0];

let fallos = 0;
for (const t of TEMAS) {
  const c = t.css;
  const pares = [
    ['texto sobre fondo', c.texto, c.fondo, 4.5],
    ['texto sobre superficie', c.texto, c.superficie, 4.5],
    ['texto sobre superficie-2', c.texto, c['superficie-2'], 4.5],
    ['texto-suave sobre fondo', c['texto-suave'], c.fondo, 4.5],
    ['texto-suave sobre superficie-2', c['texto-suave'], c['superficie-2'], 4.5],
    ['sobre-primario sobre primario', c['sobre-primario'], c.primario, 4.5],
    ['sobre-resalte sobre resalte', c['sobre-resalte'], c.resalte, 4.5],
    ['sobre-cabecera sobre cabecera', c['sobre-cabecera'], c.cabecera, 4.5],
    ['sobre-capa sobre capa', c['sobre-capa'], c.capa, 4.5],
    ['enlaces (primario) sobre fondo', c.primario, c.fondo, 4.5],
    ['número del atacante', t.ataque.texto, t.ataque.relleno, 4.5],
    [
      'número del defensor',
      t.defensa.texto,
      t.defensa.forma === 'anillo' ? t.cancha.cesped : t.defensa.relleno,
      t.defensa.forma === 'triangulo' || t.defensa.forma === 'triangulo-redondeado' ? 3 : 4.5,
    ],
    // Una forma se distingue por su parte más visible: relleno, borde o anillo exterior.
    ['atacante sobre césped (forma)', masVisible(t.ataque, t.cancha.cesped), t.cancha.cesped, 3],
    ['defensor sobre césped (forma)', masVisible(t.defensa, t.cancha.cesped), t.cancha.cesped, 3],
    ['líneas de la cancha', t.cancha.lineas, t.cancha.cesped, t.cancha.borde ? 1 : 3],
  ];
  console.log(`\n${t.nombre}`);
  for (const [nombre, a, b, min] of pares) {
    const r = contraste(a, b);
    const ok = r >= min;
    if (!ok) fallos++;
    console.log(`  ${ok ? '✓' : '✗'} ${nombre.padEnd(34)} ${r.toFixed(2)}:1 (mín. ${min})  ${a} / ${b}`);
  }
}
console.log(fallos ? `\n${fallos} pares no alcanzan el mínimo` : '\nTodos los pares cumplen');
process.exit(fallos ? 1 : 0);
