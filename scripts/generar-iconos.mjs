// Genera los íconos PNG de la PWA sin dependencias (zlib de Node + rasterizado propio).
// Uso: node scripts/generar-iconos.mjs
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(raiz, { recursive: true });

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const VERDE = hex('#2F7D3A');
const VERDE_OSCURO = hex('#276B31');
const BLANCO = [255, 255, 255];
const AMARILLO = hex('#F2A900');
const AZUL = hex('#1E4FD8');
const GRIS = hex('#8A8A8A');

/** Dibuja en una grilla de 0..1 con supermuestreo 4x4 por píxel (bordes suaves). */
function dibujar(tam, maskable) {
  const px = new Uint8Array(tam * tam * 4);
  const SS = 4;
  // Contenido dentro de la zona segura (maskable: 80 % central).
  const escala = maskable ? 0.72 : 0.86;
  const off = (1 - escala) / 2;
  const radio = maskable ? 0 : 0.2;

  const fondoRedondeado = (x, y) => {
    if (radio === 0) return true;
    const cx = Math.min(Math.max(x, radio), 1 - radio);
    const cy = Math.min(Math.max(y, radio), 1 - radio);
    return (x - cx) ** 2 + (y - cy) ** 2 <= radio * radio;
  };

  // Coordenadas del contenido (u, v en 0..1 dentro del área segura).
  const color = (x, y) => {
    if (!fondoRedondeado(x, y)) return null;
    const u = (x - off) / escala;
    const v = (y - off) / escala;
    // Cancha: 0.04..0.96 de ancho, alto proporcional 37/100 → usamos 0.24..0.76
    const c = { x0: 0.04, x1: 0.96, y0: 0.24, y1: 0.76 };
    const g = 0.022; // grosor de línea
    const dentro = u >= c.x0 && u <= c.x1 && v >= c.y0 && v <= c.y1;
    const zona = 0.18 * (c.x1 - c.x0);
    // Disco
    const disco = { x: 0.78, y: 0.42, r: 0.075 };
    const dd = Math.hypot(u - disco.x, v - disco.y);
    if (dd <= disco.r) return dd >= disco.r - 0.018 ? GRIS : BLANCO;
    // Jugador de ataque (círculo amarillo)
    if (Math.hypot(u - 0.26, v - 0.58) <= 0.085) return Math.hypot(u - 0.26, v - 0.58) >= 0.068 ? BLANCO : AMARILLO;
    // Defensor (triángulo azul con relleno blanco)
    const t = { x: 0.42, y: 0.6, r: 0.09 };
    const dy = v - t.y;
    const dx = Math.abs(u - t.x);
    const enTri = (k) => dy >= -k && dy <= k * 0.5 && dx <= ((dy + k) / (1.5 * k)) * k * 0.866;
    if (enTri(t.r)) return enTri(t.r - 0.03) ? BLANCO : AZUL;
    // Pase curvo discontinuo: Bézier de (0.3,0.5) a (0.74,0.4) con control (0.5,0.18)
    for (let s = 0; s <= 1; s += 0.004) {
      const tramo = Math.floor(s * 9) % 2 === 0;
      if (!tramo) continue;
      const a = 1 - s;
      const bx = a * a * 0.3 + 2 * a * s * 0.5 + s * s * 0.72;
      const by = a * a * 0.5 + 2 * a * s * 0.16 + s * s * 0.4;
      if (Math.hypot(u - bx, v - by) <= 0.016) return BLANCO;
    }
    // Líneas de la cancha
    if (dentro) {
      const borde = u - c.x0 < g || c.x1 - u < g || v - c.y0 < g || c.y1 - v < g;
      const lineaZona = Math.abs(u - (c.x0 + zona)) < g / 2 || Math.abs(u - (c.x1 - zona)) < g / 2;
      if (borde || lineaZona) return BLANCO;
      if (u < c.x0 + zona || u > c.x1 - zona) return VERDE_OSCURO;
    }
    return VERDE;
  };

  for (let py = 0; py < tam; py++) {
    for (let pxl = 0; pxl < tam; pxl++) {
      let r = 0, gg = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const col = color((pxl + (sx + 0.5) / SS) / tam, (py + (sy + 0.5) / SS) / tam);
          if (!col) continue;
          r += col[0];
          gg += col[1];
          b += col[2];
          a += 1;
        }
      }
      const i = (py * tam + pxl) * 4;
      const n = SS * SS;
      px[i] = a ? Math.round(r / a) : 0;
      px[i + 1] = a ? Math.round(gg / a) : 0;
      px[i + 2] = a ? Math.round(b / a) : 0;
      px[i + 3] = Math.round((a / n) * 255);
    }
  }
  return px;
}

// --- Codificador PNG mínimo ---
const TABLA_CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = TABLA_CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function bloque(tipo, datos) {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, crc]);
}
function png(tam, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(tam, 0);
  ihdr.writeUInt32BE(tam, 4);
  ihdr[8] = 8; // bits
  ihdr[9] = 6; // RGBA
  const filas = Buffer.alloc(tam * (tam * 4 + 1));
  for (let y = 0; y < tam; y++) {
    filas[y * (tam * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, y * tam * 4, tam * 4).copy(filas, y * (tam * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloque('IHDR', ihdr),
    bloque('IDAT', deflateSync(filas, { level: 9 })),
    bloque('IEND', Buffer.alloc(0)),
  ]);
}

const salidas = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['maskable-512.png', 512, true],
  ['apple-touch-icon.png', 180, true],
];
for (const [nombre, tam, maskable] of salidas) {
  writeFileSync(join(raiz, nombre), png(tam, dibujar(tam, maskable)));
  console.log('ok', nombre);
}
