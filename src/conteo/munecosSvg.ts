// Dibujos propios de la app para el conteo de 10 (reglas en docs/adr/0013-munecos-y-premios.md).
// SVG en viewBox -6 -8 82 104, contorno en tinta, sombra en el piso en y = 93.
// Los brazos van en <g class="armL"> / <g class="armR"> (giran desde 26,46 y 44,46) y la boca
// tiene la clase "mth" para animarla. Son constantes del código: nunca contenido externo.

const T = '#1e2a33'; // tinta
const C = `stroke="${T}" stroke-width="2.2" stroke-linejoin="round"`; // contorno de cuerpos
const C2 = `stroke="${T}" stroke-width="1.5" stroke-linejoin="round"`; // contorno de detalles
const n = (v: number) => +v.toFixed(2);

const piso = (rx = 19) => `<ellipse cx="35" cy="93" rx="${rx}" ry="3.4" fill="${T}" opacity=".2"/>`;

/** Trazo con contorno: primero la tinta más gruesa y encima el color. */
function trazo(d: string, color: string, w: number) {
  const borde = w < 3 ? w + 2.4 : w + 4.4;
  const comun = `d="${d}" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
  return `<path ${comun} stroke="${T}" stroke-width="${borde}"/><path ${comun} stroke="${color}" stroke-width="${w}"/>`;
}

const brazos = (izq: string, der: string) => `<g class="armL">${izq}</g><g class="armR">${der}</g>`;

/** Brazos levantados con mano redonda: el gesto de todos los muñecos. */
function brazosArriba(color: string, mano: string, ancho = 6, y = 30, colorDer = color) {
  return brazos(
    trazo(`M26 48L9 ${y + 1}`, color, ancho) + `<circle cx="8" cy="${y}" r="4.6" fill="${mano}" ${C}/>`,
    trazo(`M44 48L61 ${y + 1}`, colorDer, ancho) + `<circle cx="62" cy="${y}" r="4.6" fill="${mano}" ${C}/>`,
  );
}

function ojo(x: number, y: number, r = 3.2, blanco = '#fff') {
  return (
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${blanco}" ${C2}/>` +
    `<circle cx="${n(x + r * 0.15)}" cy="${n(y + r * 0.2)}" r="${n(r * 0.58)}" fill="${T}"/>` +
    `<circle cx="${n(x - r * 0.05)}" cy="${n(y - r * 0.12)}" r="${n(r * 0.2)}" fill="#fff"/>`
  );
}
const ojos = (x1: number, x2: number, y: number, r = 3.2) => ojo(x1, y, r) + ojo(x2, y, r);

/** Ojos medio cerrados (párpado encima). */
function ojosSueno(x1: number, x2: number, y: number, r: number, parpado: string) {
  const uno = (x: number) =>
    ojo(x, y, r, '#fde3dc') + `<path d="M${n(x - r)} ${n(y + 0.4)}A${r} ${r} 0 0 1 ${n(x + r)} ${n(y + 0.4)}Z" fill="${parpado}" ${C2}/>`;
  return uno(x1) + uno(x2);
}

const boca = (cx: number, cy: number, rx = 3.4, ry = 1.6) =>
  `<ellipse class="mth" cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#8c2f39" ${C2}/>`;

const mejillas = (x1: number, x2: number, y: number, color = '#e6785e') =>
  `<ellipse cx="${x1}" cy="${y}" rx="3" ry="1.8" fill="${color}" opacity=".5"/><ellipse cx="${x2}" cy="${y}" rx="3" ry="1.8" fill="${color}" opacity=".5"/>`;

/** Dos piernas rectas con pie ovalado. */
const piernas = (color: string, pie: string, w = 7, y1 = 74, y2 = 86, x1 = 29.5, x2 = 40.5) =>
  trazo(`M${x1} ${y1}V${y2}`, color, w) +
  trazo(`M${x2} ${y1}V${y2}`, color, w) +
  `<ellipse cx="${x1 - 1}" cy="${y2 + 2}" rx="5.5" ry="3" fill="${pie}" ${C2}/><ellipse cx="${x2 + 1}" cy="${y2 + 2}" rx="5.5" ry="3" fill="${pie}" ${C2}/>`;

export const DIBUJO_MUNECO: Record<string, { nombre: string; svg: string }> = {
  alien: {
    nombre: 'Alien',
    svg:
      piso() +
      piernas('#4fa52c', '#4fa52c', 5, 70, 86) +
      brazosArriba('#6cc644', '#6cc644', 5) +
      `<ellipse cx="35" cy="57" rx="12.5" ry="17" fill="#6cc644" ${C}/><ellipse cx="35" cy="60" rx="7" ry="10" fill="#a6e87f"/>` +
      trazo('M28 9L22 -1', '#4fa52c', 2) +
      trazo('M42 9L48 -1', '#4fa52c', 2) +
      `<circle cx="21" cy="-3" r="3.4" fill="#ffd34d" ${C2}/><circle cx="49" cy="-3" r="3.4" fill="#ffd34d" ${C2}/>` +
      `<ellipse cx="35" cy="23" rx="21" ry="16.5" fill="#6cc644" ${C}/>` +
      `<ellipse cx="25.5" cy="23" rx="7.5" ry="4.8" fill="${T}" transform="rotate(-24 25.5 23)"/><ellipse cx="44.5" cy="23" rx="7.5" ry="4.8" fill="${T}" transform="rotate(24 44.5 23)"/>` +
      `<circle cx="23" cy="21.5" r="1.7" fill="#fff"/><circle cx="42" cy="21.5" r="1.7" fill="#fff"/><circle cx="27.5" cy="24.5" r=".7" fill="#fff"/><circle cx="46.5" cy="24.5" r=".7" fill="#fff"/>` +
      mejillas(19, 51, 30, '#2f7a3a') +
      boca(35, 33, 3.2, 1.3),
  },
  tronco: {
    nombre: 'Tronco',
    svg:
      piso() +
      brazos(
        trazo('M22 54L7 44', '#7a5230', 4) + `<path d="M9 45q-7-6-2-12q7 2 2 12z" fill="#5bbf4a" ${C2}/>`,
        trazo('M48 54L63 44', '#7a5230', 4) + `<path d="M61 45q7-6 2-12q-7 2-2 12z" fill="#5bbf4a" ${C2}/>`,
      ) +
      `<path d="M19 30H51V84Q35 92 19 84Z" fill="#a0673a" ${C}/>` +
      `<path d="M24 38V58M24 66V80M46 36V50M46 60V80M31 74Q33 79 31 84" stroke="#6e4425" stroke-width="1.6" stroke-linecap="round" fill="none"/>` +
      trazo('M38 29Q39 21 44 18', '#5bbf4a', 1.8) +
      `<path d="M44 18q6-5 10 0q-5 5-10 0z" fill="#5bbf4a" ${C2}/>` +
      `<ellipse cx="35" cy="30" rx="16" ry="6.5" fill="#ecc48f" ${C}/>` +
      `<ellipse cx="35" cy="30" rx="9.5" ry="3.6" fill="none" stroke="#c08a52" stroke-width="1.3"/><ellipse cx="35" cy="30" rx="4" ry="1.5" fill="none" stroke="#c08a52" stroke-width="1.2"/>` +
      ojos(28, 42, 51, 3.4) +
      mejillas(23, 47, 58) +
      boca(35, 63, 4, 1.9),
  },
  nieve: {
    nombre: 'Muñeco de nieve',
    svg:
      piso() +
      brazos(
        trazo('M26 50L6 38', '#7a5230', 3) + trazo('M12 42L7 48', '#7a5230', 2.2),
        trazo('M44 50L64 38', '#7a5230', 3) + trazo('M58 42L63 48', '#7a5230', 2.2),
      ) +
      `<circle cx="35" cy="73" r="17" fill="#fbf5e9" ${C}/><circle cx="35" cy="50" r="13" fill="#fbf5e9" ${C}/><circle cx="35" cy="28" r="11" fill="#fbf5e9" ${C}/>` +
      `<path d="M44 84Q50 79 50.5 71M42 59Q46.5 55.5 46.5 49M41 36Q44.5 33 44.5 28" stroke="#b8c9d6" stroke-width="2" stroke-linecap="round" fill="none"/>` +
      `<rect x="26" y="7" width="18" height="13" rx="1.5" fill="#2b3640" ${C2}/><rect x="21" y="18" width="28" height="4.5" rx="2.2" fill="#2b3640" ${C2}/><rect x="26.8" y="14.5" width="16.4" height="3" fill="#e6785e"/>` +
      `<circle cx="31" cy="27" r="2" fill="${T}"/><circle cx="39" cy="27" r="2" fill="${T}"/><circle cx="30.4" cy="26.3" r=".7" fill="#fff"/><circle cx="38.4" cy="26.3" r=".7" fill="#fff"/>` +
      `<path d="M35 30L47 32.5L35 34Z" fill="#e5853b" ${C2}/>` +
      mejillas(28, 42, 32) +
      boca(35, 36, 2.8, 1) +
      `<path d="M24 38Q35 44 46 38L46 42.5Q35 48.5 24 42.5Z" fill="#e6785e" ${C2}/><path d="M40 43.5L43 56L48.5 54.5L45.5 42Z" fill="#e6785e" ${C2}/>` +
      `<circle cx="35" cy="52" r="1.9" fill="${T}"/><circle cx="35" cy="59" r="1.9" fill="${T}"/><circle cx="35" cy="72" r="1.9" fill="${T}"/>`,
  },
  mico: {
    nombre: 'Mico',
    svg:
      piso() +
      trazo('M46 78Q68 76 63 58Q60 50 54 54', '#8b5a2b', 4) +
      piernas('#8b5a2b', '#e6c08f') +
      brazosArriba('#8b5a2b', '#e6c08f') +
      `<ellipse cx="35" cy="60" rx="13" ry="18" fill="#8b5a2b" ${C}/><ellipse cx="35" cy="63" rx="8" ry="12" fill="#e6c08f"/>` +
      `<circle cx="13" cy="24" r="7" fill="#8b5a2b" ${C}/><circle cx="13" cy="24" r="3.8" fill="#e6c08f"/><circle cx="57" cy="24" r="7" fill="#8b5a2b" ${C}/><circle cx="57" cy="24" r="3.8" fill="#e6c08f"/>` +
      `<path d="M29 8Q32 0 35 5Q38 -1 41 8Z" fill="#8b5a2b" ${C2}/>` +
      `<circle cx="35" cy="24" r="19" fill="#8b5a2b" ${C}/>` +
      `<path d="M35 16Q22 12 20 26Q20 39 35 39Q50 39 50 26Q48 12 35 16Z" fill="#e6c08f" ${C2}/>` +
      ojos(28, 42, 25, 3.2) +
      `<circle cx="33" cy="31" r=".9" fill="#5a2e12"/><circle cx="37" cy="31" r=".9" fill="#5a2e12"/>` +
      mejillas(23, 47, 31) +
      boca(35, 35, 3.6, 1.4),
  },
  salero: {
    nombre: 'Salero',
    svg:
      piso() +
      brazos(
        trazo('M22 50L7 38', '#8fa9b8', 4) + `<circle cx="6" cy="37" r="3.6" fill="#eaf4fa" ${C2}/>`,
        trazo('M48 50L63 38', '#8fa9b8', 4) + `<circle cx="64" cy="37" r="3.6" fill="#eaf4fa" ${C2}/>`,
      ) +
      `<path d="M22 26H48Q54 56 52 84Q35 92 18 84Q16 56 22 26Z" fill="#eaf4fa" ${C}/>` +
      `<path d="M17.9 66Q35 60 52.1 66Q52.6 76 52 84Q35 91 18 84Q17.4 76 17.9 66Z" fill="#fff"/>` +
      `<circle cx="26" cy="72" r=".9" fill="#b8c9d6"/><circle cx="33" cy="78" r=".9" fill="#b8c9d6"/><circle cx="42" cy="71" r=".9" fill="#b8c9d6"/><circle cx="46" cy="79" r=".9" fill="#b8c9d6"/>` +
      `<path d="M25.5 34Q23.5 48 24.5 60" stroke="#fff" stroke-width="2.4" stroke-linecap="round" fill="none"/>` +
      `<path d="M24 14Q35 4 46 14V25H24Z" fill="#b9c0c6" ${C2}/>` +
      `<circle cx="30" cy="16" r="1.2" fill="#2b3640"/><circle cx="35" cy="12.5" r="1.2" fill="#2b3640"/><circle cx="40" cy="16" r="1.2" fill="#2b3640"/>` +
      `<rect x="21" y="23.5" width="28" height="5" rx="2.5" fill="#9aa3aa" ${C2}/>` +
      ojos(29, 41, 46, 3.4) +
      mejillas(24, 46, 53) +
      boca(35, 56, 3.6, 1.7),
  },
  cerdo: {
    nombre: 'Cerdo',
    svg:
      piso() +
      trazo('M47 70q11-2 7-9q-4-3-6 2', '#f4a6b8', 2.6) +
      trazo('M29.5 76V85', '#f4a6b8', 7) +
      trazo('M40.5 76V85', '#f4a6b8', 7) +
      `<rect x="26" y="84" width="7" height="5" rx="1.5" fill="#b5546d" ${C2}/><rect x="37" y="84" width="7" height="5" rx="1.5" fill="#b5546d" ${C2}/>` +
      brazosArriba('#f4a6b8', '#f08aa3') +
      `<ellipse cx="35" cy="58" rx="15" ry="19" fill="#f9b8c8" ${C}/><ellipse cx="35" cy="62" rx="9" ry="12" fill="#fbd3dd"/>` +
      `<path d="M16 14L12 1L27 8Z" fill="#f4a6b8" ${C2}/><path d="M54 14L58 1L43 8Z" fill="#f4a6b8" ${C2}/>` +
      `<ellipse cx="35" cy="24" rx="21" ry="18" fill="#f9b8c8" ${C}/>` +
      `<ellipse cx="35" cy="29" rx="9.5" ry="6.5" fill="#f08aa3" ${C2}/><ellipse cx="31.5" cy="29" rx="1.6" ry="2.4" fill="#8a2d45"/><ellipse cx="38.5" cy="29" rx="1.6" ry="2.4" fill="#8a2d45"/>` +
      ojos(25, 45, 19, 3) +
      mejillas(19, 51, 27) +
      boca(35, 38, 3.2, 1.2),
  },
  oso: {
    nombre: 'Oso',
    svg:
      piso() +
      piernas('#7a4b27', '#d9b38c', 9) +
      brazosArriba('#7a4b27', '#8b5a33', 7) +
      `<ellipse cx="35" cy="58" rx="15" ry="19" fill="#8b5a33" ${C}/><ellipse cx="35" cy="62" rx="9.5" ry="12" fill="#d9b38c"/>` +
      `<circle cx="17" cy="9" r="7" fill="#8b5a33" ${C}/><circle cx="17" cy="9" r="3.6" fill="#d9b38c"/><circle cx="53" cy="9" r="7" fill="#8b5a33" ${C}/><circle cx="53" cy="9" r="3.6" fill="#d9b38c"/>` +
      `<circle cx="35" cy="23" r="19" fill="#8b5a33" ${C}/>` +
      `<ellipse cx="35" cy="29" rx="9" ry="7" fill="#d9b38c" ${C2}/><ellipse cx="35" cy="26" rx="3.6" ry="2.5" fill="${T}"/>` +
      ojos(27, 43, 19, 2.9) +
      mejillas(20, 50, 27) +
      boca(35, 32.8, 2.6, 1),
  },
  vikingo: {
    nombre: 'Vikingo',
    svg:
      piso() +
      piernas('#5b3a1e', '#3d2a1a', 7, 72) +
      brazosArriba('#2f6db5', '#f2c9a0') +
      `<path d="M20 46Q35 40 50 46L52 76H18Z" fill="#2f6db5" ${C}/>` +
      `<rect x="18.5" y="62" width="33" height="4.5" fill="#5b3a1e" ${C2}/><rect x="32" y="61" width="6" height="6.5" rx="1" fill="#dca43a" ${C2}/>` +
      `<path d="M17 28Q16 56 35 58Q54 56 53 28Z" fill="#e5853b" ${C}/>` +
      `<path d="M27 46Q29 51 28 55M35 48V56M43 46Q41 51 42 55" stroke="#b85f22" stroke-width="1.4" stroke-linecap="round" fill="none"/>` +
      `<ellipse cx="35" cy="27" rx="15" ry="13" fill="#f2c9a0" ${C2}/>` +
      `<path d="M19 16Q5 14 6 1Q12 8 21 9Z" fill="#f4efe3" ${C2}/><path d="M51 16Q65 14 64 1Q58 8 49 9Z" fill="#f4efe3" ${C2}/>` +
      `<path d="M18 24Q18 6 35 6Q52 6 52 24Z" fill="#9aa3aa" ${C}/><rect x="17.5" y="20" width="35" height="4.5" fill="#6b747b" ${C2}/>` +
      `<circle cx="22" cy="22.2" r=".9" fill="#d5dade"/><circle cx="35" cy="22.2" r=".9" fill="#d5dade"/><circle cx="48" cy="22.2" r=".9" fill="#d5dade"/>` +
      ojos(29, 41, 29, 2.8) +
      `<ellipse cx="35" cy="33" rx="2.4" ry="2" fill="#e6a77e" ${C2}/>` +
      `<path d="M27 38Q35 34 43 38Q39 41 35 39Q31 41 27 38Z" fill="#d0702e" ${C2}/>` +
      boca(35, 42, 3.2, 1.5),
  },
  jaguar: {
    nombre: 'Jaguar',
    svg:
      piso() +
      trazo('M47 78Q66 80 64 62', '#e8ae2d', 5.5) +
      `<circle cx="64" cy="61" r="3" fill="#3a1e0c"/>` +
      piernas('#d99a1f', '#f6e3b0', 9) +
      brazosArriba('#e8ae2d', '#f0bd4a', 7, 32) +
      `<ellipse cx="35" cy="58" rx="15" ry="19" fill="#e8ae2d" ${C}/><ellipse cx="35" cy="63" rx="9" ry="12" fill="#f6e3b0"/>` +
      `<g fill="none" stroke="#4a2a0a" stroke-width="1.6"><circle cx="24" cy="54" r="2.6"/><circle cx="46" cy="56" r="2.6"/><circle cx="25" cy="68" r="2.4"/><circle cx="45" cy="70" r="2.4"/></g>` +
      `<circle cx="18" cy="9" r="7" fill="#e8ae2d" ${C}/><circle cx="18" cy="9" r="3.4" fill="#4a2a0a"/><circle cx="52" cy="9" r="7" fill="#e8ae2d" ${C}/><circle cx="52" cy="9" r="3.4" fill="#4a2a0a"/>` +
      `<circle cx="35" cy="23" r="19" fill="#e8ae2d" ${C}/>` +
      `<g fill="#4a2a0a"><circle cx="22" cy="13" r="1.9"/><circle cx="29" cy="8" r="1.7"/><circle cx="42" cy="8" r="1.7"/><circle cx="49" cy="13" r="1.9"/><circle cx="20" cy="25" r="1.7"/><circle cx="50" cy="25" r="1.7"/></g>` +
      `<ellipse cx="35" cy="30" rx="9.5" ry="7.5" fill="#f6e3b0" ${C2}/>` +
      `<path d="M31.5 25.5h7l-3.5 4z" fill="#3a1e0c" stroke="#3a1e0c" stroke-width="1" stroke-linejoin="round"/>` +
      `<circle cx="27" cy="19" r="3.2" fill="#c9d84a" ${C2}/><circle cx="43" cy="19" r="3.2" fill="#c9d84a" ${C2}/>` +
      `<ellipse cx="27" cy="19" rx="1.1" ry="2.3" fill="${T}"/><ellipse cx="43" cy="19" rx="1.1" ry="2.3" fill="${T}"/>` +
      `<path d="M25 30.5H17M25 33L18 35.5M45 30.5H53M45 33L52 35.5" stroke="${T}" stroke-width="1" stroke-linecap="round"/>` +
      boca(35, 33.5, 2.8, 1.1),
  },
  toro: {
    nombre: 'Toro',
    svg:
      piso() +
      trazo('M29.5 74V84', '#4a2a12', 9) +
      trazo('M40.5 74V84', '#4a2a12', 9) +
      `<rect x="25" y="83" width="9" height="5.5" rx="1.5" fill="${T}" ${C2}/><rect x="36" y="83" width="9" height="5.5" rx="1.5" fill="${T}" ${C2}/>` +
      brazosArriba('#6b3e1f', '#4a2a12', 7, 33) +
      `<ellipse cx="35" cy="58" rx="16" ry="19" fill="#6b3e1f" ${C}/><ellipse cx="35" cy="62" rx="9" ry="11" fill="#8a5a34"/>` +
      `<path d="M21 14Q7 14 5 2Q14 5 26 10Z" fill="#f4ecd8" ${C2}/><path d="M49 14Q63 14 65 2Q56 5 44 10Z" fill="#f4ecd8" ${C2}/>` +
      `<ellipse cx="13" cy="24" rx="7" ry="3.6" fill="#4a2a12" transform="rotate(-20 13 24)" ${C2}/><ellipse cx="57" cy="24" rx="7" ry="3.6" fill="#4a2a12" transform="rotate(20 57 24)" ${C2}/>` +
      `<ellipse cx="35" cy="23" rx="18" ry="18" fill="#7a4624" ${C}/>` +
      `<path d="M35 6q-3.5 8 0 15q3.5-7 0-15z" fill="#f4ecd8"/>` +
      `<ellipse cx="35" cy="33" rx="11.5" ry="8.5" fill="#d9a98a" ${C2}/>` +
      `<ellipse cx="30.5" cy="31" rx="1.7" ry="1.2" fill="#3a1e0c"/><ellipse cx="39.5" cy="31" rx="1.7" ry="1.2" fill="#3a1e0c"/>` +
      ojos(27, 43, 19, 2.9) +
      `<circle cx="35" cy="36.8" r="3.2" fill="none" stroke="#dca43a" stroke-width="1.6"/>` +
      boca(35, 39.5, 2.8, 1),
  },
  fresa: {
    nombre: 'Fresa',
    svg:
      piso() +
      trazo('M29 82V88', '#8e1b1b', 5) +
      trazo('M41 82V88', '#8e1b1b', 5) +
      brazos(
        trazo('M20 52L7 38', '#d32f2f', 5) + `<circle cx="6" cy="37" r="3.9" fill="#f28b82" ${C2}/>`,
        trazo('M50 52L63 38', '#d32f2f', 5) + `<circle cx="64" cy="37" r="3.9" fill="#f28b82" ${C2}/>`,
      ) +
      `<path d="M35 90C19 83 13 68 13 55C13 44 22 38 35 38C48 38 57 44 57 55C57 68 51 83 35 90Z" fill="#e53935" ${C}/>` +
      `<g fill="#ffe08a"><ellipse cx="22" cy="48" rx="1.1" ry="1.8"/><ellipse cx="48" cy="48" rx="1.1" ry="1.8"/><ellipse cx="18" cy="60" rx="1.1" ry="1.8"/><ellipse cx="52" cy="60" rx="1.1" ry="1.8"/><ellipse cx="23" cy="72" rx="1.1" ry="1.8"/><ellipse cx="47" cy="72" rx="1.1" ry="1.8"/><ellipse cx="35" cy="81" rx="1.1" ry="1.8"/><ellipse cx="29" cy="76" rx="1.1" ry="1.8"/><ellipse cx="41" cy="76" rx="1.1" ry="1.8"/></g>` +
      `<ellipse cx="24" cy="38" rx="11" ry="4.6" fill="#43a047" transform="rotate(-22 24 38)" ${C2}/><ellipse cx="46" cy="38" rx="11" ry="4.6" fill="#43a047" transform="rotate(22 46 38)" ${C2}/>` +
      `<ellipse cx="35" cy="35" rx="4.4" ry="8" fill="#2e7d32" ${C2}/><rect x="33.6" y="19" width="2.8" height="9" rx="1.4" fill="#2e7d32" ${C2}/>` +
      ojos(27.5, 42.5, 56, 3.4) +
      mejillas(21, 49, 62, '#ff8a80') +
      boca(35, 64, 3.4, 1.7),
  },
  tornado: {
    nombre: 'Tornado',
    svg:
      `<ellipse cx="35" cy="92" rx="16" ry="3.2" fill="#b7a98f" opacity=".7"/>` +
      brazos(trazo('M22 50Q12 48 9 38Q8 30 14 29', '#a9b8c8', 4), trazo('M48 50Q58 48 61 38Q62 30 56 29', '#a9b8c8', 4)) +
      `<path d="M6 18Q35 6 64 18Q58 27 52 40Q46 62 40 82Q35 90 30 82Q24 62 18 40Q12 27 6 18Z" fill="#8fa0b3" ${C}/>` +
      `<ellipse cx="35" cy="18" rx="29" ry="7.5" fill="#a9b8c8" ${C2}/>` +
      `<path d="M11 27Q35 35 59 27M25 62Q35 67 45 62M28 72Q35 76 42 72" stroke="#5b6d80" stroke-width="2" fill="none" stroke-linecap="round"/>` +
      `<path d="M16 9L22 3M35 6V0M54 9L48 3" stroke="#c9d1d6" stroke-width="2" stroke-linecap="round"/>` +
      ojos(28, 42, 40, 3.2) +
      boca(35, 50, 3.4, 1.7) +
      `<rect x="9" y="52" width="3.2" height="3.2" fill="#a0673a" ${C2} transform="rotate(20 10 53)"/><rect x="58" y="60" width="3.2" height="3.2" fill="#a0673a" ${C2} transform="rotate(-15 59 61)"/><rect x="14" y="70" width="2.8" height="2.8" fill="#5bbf4a" ${C2}/>`,
  },
  disco: {
    nombre: 'Disco',
    svg:
      piso() +
      trazo('M29 72L28 86', '#2b3640', 4) +
      trazo('M41 72L42 86', '#2b3640', 4) +
      `<ellipse cx="27" cy="88.5" rx="5" ry="2.8" fill="#1e4fd8" ${C2}/><ellipse cx="43" cy="88.5" rx="5" ry="2.8" fill="#1e4fd8" ${C2}/>` +
      brazos(
        trazo('M12 50L4 35', '#ff8f1f', 4.5) + `<circle cx="3.5" cy="34" r="3.8" fill="#ffd1a0" ${C2}/>`,
        trazo('M58 50L66 35', '#ff8f1f', 4.5) + `<circle cx="66.5" cy="34" r="3.8" fill="#ffd1a0" ${C2}/>`,
      ) +
      `<circle cx="35" cy="48" r="26" fill="#ff8f1f" ${C}/><circle cx="35" cy="48" r="22" fill="none" stroke="#c96400" stroke-width="1.6"/>` +
      `<circle cx="35" cy="48" r="17" fill="#ffb866"/><circle cx="35" cy="48" r="17" fill="none" stroke="#fff3e0" stroke-width="1.4" stroke-dasharray="3 3"/>` +
      ojos(27, 43, 44, 3.4) +
      mejillas(21, 49, 52) +
      boca(35, 54, 3.8, 1.9),
  },

  // --- Mascotas nuevas (2026-11-25) ---
  porro: {
    nombre: 'Porro',
    svg:
      piso(14) +
      trazo('M30.5 82V87', '#e6dcc6', 3.4) +
      trazo('M39.5 82V87', '#e6dcc6', 3.4) +
      `<ellipse cx="29" cy="89" rx="4.6" ry="2.5" fill="#1f6874" ${C2}/><ellipse cx="41" cy="89" rx="4.6" ry="2.5" fill="#1f6874" ${C2}/>` +
      brazos(
        trazo('M27 50L10 36', '#e6dcc6', 3.4) + `<circle cx="9" cy="35" r="3.6" fill="#fbf5e9" ${C2}/>`,
        trazo('M43 50L60 36', '#e6dcc6', 3.4) + `<circle cx="61" cy="35" r="3.6" fill="#fbf5e9" ${C2}/>`,
      ) +
      `<path d="M36 9Q31 4 36 -1Q40 -4 36.5 -7" stroke="#b8c2ca" stroke-width="2.6" stroke-linecap="round" fill="none" opacity=".85"/>` +
      `<path d="M30 10Q27 6 30 2" stroke="#b8c2ca" stroke-width="2" stroke-linecap="round" fill="none" opacity=".7"/>` +
      `<path d="M23 16L47 16L42.5 82Q35 86 27.5 82Z" fill="#fbf5e9" ${C}/>` +
      `<path d="M44 20L29 66" stroke="#d8ccb3" stroke-width="1.3" stroke-linecap="round"/>` +
      `<g fill="#5bbf4a"><circle cx="29" cy="22" r=".9"/><circle cx="40" cy="24" r=".9"/><circle cx="34" cy="28" r=".8"/></g>` +
      `<path d="M26.5 70L43.5 70L42.5 82Q35 86 27.5 82Z" fill="#dca43a" ${C2}/>` +
      `<path d="M31 72.5V82M35 72.5V84M39 72.5V82" stroke="#b07e24" stroke-width="1" stroke-linecap="round"/>` +
      `<ellipse cx="35" cy="16" rx="12" ry="4" fill="#e5853b" ${C2}/>` +
      `<circle cx="31" cy="15.5" r="1.5" fill="#b8432f"/><circle cx="37.5" cy="15" r="1.8" fill="#ffd34d"/><circle cx="41" cy="16.8" r="1.1" fill="#b8432f"/>` +
      ojosSueno(29.5, 40.5, 41, 3.6, '#e6dcc6') +
      mejillas(25, 45, 47.5) +
      boca(35, 51, 3.4, 1.5),
  },
  planta: {
    nombre: 'Planta con ojos',
    svg:
      piso(16) +
      brazos(
        trazo('M30 54Q20 50 13 40', '#3f8f4a', 3) +
          `<path d="M13 40Q2 36 4 26Q14 28 13 40Z" fill="#6cbf5a" ${C2}/><path d="M12.4 38Q8 32 5.2 28" stroke="#3f8f4a" stroke-width="1" fill="none" stroke-linecap="round"/>`,
        trazo('M40 54Q50 50 57 40', '#3f8f4a', 3) +
          `<path d="M57 40Q68 36 66 26Q56 28 57 40Z" fill="#6cbf5a" ${C2}/><path d="M57.6 38Q62 32 64.8 28" stroke="#3f8f4a" stroke-width="1" fill="none" stroke-linecap="round"/>`,
      ) +
      trazo('M35 62V40', '#3f8f4a', 4.5) +
      `<path d="M21 64H49L45 89H25Z" fill="#c8643b" ${C}/>` +
      `<path d="M25.5 77l2.5 2.5 2.5-2.5 2.5 2.5 2.5-2.5 2.5 2.5 2.5-2.5 2.5 2.5 2.5-2.5" stroke="#fbf5e9" stroke-width="1.4" fill="none" stroke-linejoin="round" stroke-linecap="round"/>` +
      `<rect x="17.5" y="59" width="35" height="8" rx="2.5" fill="#d97a4f" ${C}/>` +
      `<path d="M30 13Q24 1 32 -4Q36 4 33 13Z" fill="#4fa84a" ${C2}/><path d="M40 13Q46 1 38 -4Q34 4 37 13Z" fill="#4fa84a" ${C2}/>` +
      `<circle cx="35" cy="27" r="17" fill="#6cbf5a" ${C}/>` +
      `<path d="M22 22Q25 15 31 13" stroke="#a6e87f" stroke-width="2" stroke-linecap="round" fill="none"/>` +
      `<g fill="#e6785e" ${C2}><circle cx="47" cy="10" r="2.6"/><circle cx="51.5" cy="12.5" r="2.6"/><circle cx="50.5" cy="17.5" r="2.6"/><circle cx="45.5" cy="18" r="2.6"/><circle cx="43.5" cy="13.5" r="2.6"/></g>` +
      `<circle cx="47.6" cy="14.3" r="2" fill="#ffd34d" ${C2}/>` +
      ojos(28.5, 41.5, 27, 4) +
      mejillas(23, 47, 34) +
      boca(35, 36, 3.4, 1.7),
  },
  duende: {
    nombre: 'Duende',
    svg:
      piso() +
      trazo('M30 74V85', '#2f6d4a', 5.5) +
      trazo('M40 74V85', '#2f6d4a', 5.5) +
      `<path d="M33 84.5V90H25Q20 90 20 85.5Q22 87 24.5 84.5Z" fill="#b8432f" ${C2}/><path d="M37 84.5V90H45Q50 90 50 85.5Q48 87 45.5 84.5Z" fill="#b8432f" ${C2}/>` +
      brazosArriba('#4f9a6a', '#f2c9a0', 5.5, 32) +
      `<path d="M24 44H46L51 76Q35 81 19 76Z" fill="#4f9a6a" ${C}/>` +
      `<rect x="21.5" y="58" width="27" height="4.5" fill="#7a5230" ${C2}/><rect x="32.5" y="57" width="5" height="6.5" rx="1" fill="#dca43a" ${C2}/>` +
      `<path d="M24 44L30 50L35 45L40 50L46 44Z" fill="#dca43a" ${C2}/>` +
      `<path d="M24 32L10 23L24 39Z" fill="#f2c9a0" ${C2}/><path d="M46 32L60 23L46 39Z" fill="#f2c9a0" ${C2}/>` +
      `<circle cx="35" cy="33" r="12.5" fill="#f2c9a0" ${C}/>` +
      `<path d="M25 40Q26 52 35 54Q44 52 45 40Q40 44.5 35 44Q30 44.5 25 40Z" fill="#f4efe3" ${C2}/>` +
      `<path d="M20 31Q25 14 37 0Q44 -6 54 -2Q46 0 44 8Q47 20 50 31Z" fill="#b8432f" ${C}/>` +
      `<rect x="18" y="27.5" width="34" height="5.5" rx="2.75" fill="#9e3726" ${C2}/>` +
      `<circle cx="55" cy="-1" r="3" fill="#dca43a" ${C2}/>` +
      ojos(30, 40, 36, 2.6) +
      `<circle cx="35" cy="39.5" r="2.2" fill="#e6a77e" ${C2}/>` +
      mejillas(26.5, 43.5, 40) +
      boca(35, 43, 2.8, 1.2),
  },
  chancla: {
    nombre: 'Chancla',
    svg:
      piso(17) +
      brazosArriba('#1f6874', '#5fb3c2', 4.5, 32) +
      `<path transform="translate(1.5 3)" d="M35 8C50 8 54 22 52 40C50 58 53 76 46 86C40 92 30 92 24 86C17 76 20 58 18 40C16 22 20 8 35 8Z" fill="#1f6874" ${C}/>` +
      `<path d="M35 8C50 8 54 22 52 40C50 58 53 76 46 86C40 92 30 92 24 86C17 76 20 58 18 40C16 22 20 8 35 8Z" fill="#5fb3c2" ${C}/>` +
      `<path d="M35 13C47 13 49 25 47.5 40C46 57 48.5 74 43 82.5C38.5 87 31.5 87 27 82.5C21.5 74 24 57 22.5 40C21 25 23 13 35 13Z" fill="none" stroke="#9fd6de" stroke-width="1.3" stroke-dasharray="3 2.4"/>` +
      trazo('M21 46L35 22L49 46', '#e6785e', 5) +
      `<circle cx="35" cy="22" r="3.2" fill="#e6785e" ${C2}/>` +
      ojos(28.5, 41.5, 57, 3.4) +
      mejillas(23, 47, 64) +
      boca(35, 67, 3.6, 1.8),
  },
  titere: {
    nombre: 'Títere',
    svg:
      `<path d="M28 76H42V97H28Z" fill="#f2c9a0" ${C}/>` +
      `<rect x="25.5" y="88" width="19" height="9" rx="1.5" fill="#1f6874" ${C2}/>` +
      brazos(
        trazo('M24 50L11 38', '#dca43a', 7) + `<circle cx="10" cy="37" r="4.4" fill="#f2c9a0" ${C2}/>`,
        trazo('M46 50L59 38', '#dca43a', 7) + `<circle cx="60" cy="37" r="4.4" fill="#f2c9a0" ${C2}/>`,
      ) +
      `<path d="M22 44Q35 38 48 44L52 80Q35 85 18 80Z" fill="#dca43a" ${C}/>` +
      `<path d="M20.7 58Q35 62 49.3 58M19.8 70Q35 74 50.2 70" stroke="#e6785e" stroke-width="3" fill="none"/>` +
      `<path d="M21 76.5Q35 81 49 76.5" stroke="${T}" stroke-width="1" stroke-dasharray="2 2" fill="none"/>` +
      `<circle cx="35" cy="51" r="1.8" fill="#1f6874" ${C2}/><circle cx="35" cy="65" r="1.8" fill="#1f6874" ${C2}/>` +
      `<path d="M24 44Q35 52 46 44Q35 41 24 44Z" fill="#fbf5e9" ${C2}/>` +
      `<g fill="#e5853b" ${C2}><circle cx="18" cy="23" r="6"/><circle cx="20" cy="13" r="6"/><circle cx="28" cy="6" r="6"/><circle cx="42" cy="6" r="6"/><circle cx="50" cy="13" r="6"/><circle cx="52" cy="23" r="6"/></g>` +
      `<circle cx="35" cy="24" r="16.5" fill="#f2c9a0" ${C}/>` +
      `<g fill="#e5853b" ${C2}><circle cx="26" cy="10.5" r="5"/><circle cx="35" cy="8.5" r="5"/><circle cx="44" cy="10.5" r="5"/></g>` +
      `<circle cx="28" cy="23" r="3.6" fill="${T}"/><circle cx="42" cy="23" r="3.6" fill="${T}"/>` +
      `<g fill="#fbf5e9"><circle cx="27" cy="22" r=".6"/><circle cx="29" cy="22" r=".6"/><circle cx="27" cy="24" r=".6"/><circle cx="29" cy="24" r=".6"/><circle cx="41" cy="22" r=".6"/><circle cx="43" cy="22" r=".6"/><circle cx="41" cy="24" r=".6"/><circle cx="43" cy="24" r=".6"/></g>` +
      `<circle cx="35" cy="29.5" r="3" fill="#e6785e" ${C2}/>` +
      mejillas(23, 47, 31) +
      boca(35, 35.5, 4, 1.8),
  },
  jesus: {
    nombre: 'Jesús',
    svg:
      piso() +
      `<circle cx="35" cy="22" r="21" fill="#f5d77e" ${C2}/>` +
      `<ellipse cx="29" cy="88" rx="5" ry="2.6" fill="#f2c9a0" ${C2}/><ellipse cx="41" cy="88" rx="5" ry="2.6" fill="#f2c9a0" ${C2}/>` +
      `<path d="M26 87.5H32M38 87.5H44" stroke="#7a5230" stroke-width="1.4" stroke-linecap="round"/>` +
      brazosArriba('#fbf5e9', '#f2c9a0', 6.5) +
      `<path d="M22 44Q35 38 48 44L53 86Q35 90 17 86Z" fill="#fbf5e9" ${C}/>` +
      `<path d="M25 60L23 82M45 62L47 82" stroke="#d8ccb3" stroke-width="1.3" stroke-linecap="round"/>` +
      `<path d="M41 43L30 64L33 87.5L39 87.8L36 66L47 45.5Z" fill="#b8432f" ${C2}/>` +
      `<path d="M19 22Q18 46 26 48L44 48Q52 46 51 22Q50 4 35 4Q20 4 19 22Z" fill="#7a5230" ${C}/>` +
      `<ellipse cx="35" cy="25" rx="12" ry="14" fill="#f2c9a0" ${C2}/>` +
      `<path d="M23 20Q24 8 35 8Q46 8 47 20Q42 13 35 13Q28 13 23 20Z" fill="#7a5230" ${C2}/>` +
      `<path d="M23.5 28Q24 44 35 46Q46 44 46.5 28Q44 36 35 36Q26 36 23.5 28Z" fill="#7a5230" ${C2}/>` +
      ojos(30, 40, 24, 2.4) +
      mejillas(26.5, 43.5, 30) +
      boca(35, 38.5, 2.6, 1.2),
  },
  buda: {
    nombre: 'Buda',
    svg:
      piso(23) +
      `<circle cx="35" cy="25" r="20" fill="#f5d77e" ${C2}/>` +
      brazos(
        trazo('M26 48L9 33', '#e5853b', 6.5) + `<circle cx="8" cy="32" r="4.4" fill="#f2c9a0" ${C}/>`,
        trazo('M44 48L61 33', '#f2c9a0', 6) + `<circle cx="62" cy="32" r="4.4" fill="#f2c9a0" ${C}/>`,
      ) +
      `<path d="M21 46Q35 40 49 46L53 78Q35 84 17 78Z" fill="#f2c9a0" ${C}/>` +
      `<path d="M21 46Q27 42 33 42L47 60L53 78Q35 84 17 78Z" fill="#e5853b" ${C2}/>` +
      `<path d="M26 52L24 74M33 50L40 76" stroke="#c96a2a" stroke-width="1.3" stroke-linecap="round"/>` +
      `<ellipse cx="35" cy="83" rx="22" ry="8.5" fill="#e5853b" ${C}/>` +
      `<path d="M16 83Q35 76 54 83" stroke="#c96a2a" stroke-width="1.3" fill="none" stroke-linecap="round"/>` +
      `<ellipse cx="27" cy="81" rx="4.2" ry="2.3" fill="#f2c9a0" ${C2}/><ellipse cx="43" cy="81" rx="4.2" ry="2.3" fill="#f2c9a0" ${C2}/>` +
      `<ellipse cx="21.5" cy="28" rx="3.4" ry="7" fill="#f2c9a0" ${C2}/><ellipse cx="48.5" cy="28" rx="3.4" ry="7" fill="#f2c9a0" ${C2}/>` +
      `<circle cx="35" cy="8" r="6" fill="#2b3640" ${C2}/>` +
      `<circle cx="35" cy="24" r="14" fill="#f2c9a0" ${C}/>` +
      `<path d="M21 22Q21 9 35 9Q49 9 49 22Q44 16 35 16Q26 16 21 22Z" fill="#2b3640" ${C2}/>` +
      `<g fill="#4a5862"><circle cx="27" cy="13" r="1.1"/><circle cx="31" cy="11.5" r="1.1"/><circle cx="35" cy="11" r="1.1"/><circle cx="39" cy="11.5" r="1.1"/><circle cx="43" cy="13" r="1.1"/><circle cx="33" cy="6" r="1.1"/><circle cx="37" cy="7.5" r="1.1"/></g>` +
      `<circle cx="35" cy="20" r="1.1" fill="#b8432f"/>` +
      `<path d="M27 26Q30 28.5 33 26M37 26Q40 28.5 43 26" stroke="${T}" stroke-width="1.6" stroke-linecap="round" fill="none"/>` +
      mejillas(26, 44, 30) +
      boca(35, 33, 2.4, 1),
  },
};

/** Nube del globo de conteo (viewBox 0 0 100 70). */
export const SVG_NUBE = "<g stroke=\"#14221A\" stroke-width=\"2.2\"><circle cx=\"24\" cy=\"38\" r=\"16\" vector-effect=\"non-scaling-stroke\"/><circle cx=\"42\" cy=\"26\" r=\"20\" vector-effect=\"non-scaling-stroke\"/><circle cx=\"62\" cy=\"32\" r=\"18\" vector-effect=\"non-scaling-stroke\"/><circle cx=\"44\" cy=\"44\" r=\"17\" vector-effect=\"non-scaling-stroke\"/><circle cx=\"87\" cy=\"36\" r=\"4.5\" vector-effect=\"non-scaling-stroke\"/><circle cx=\"96\" cy=\"33\" r=\"2.6\" vector-effect=\"non-scaling-stroke\"/></g><g fill=\"#fff\"><circle cx=\"24\" cy=\"38\" r=\"16\"/><circle cx=\"42\" cy=\"26\" r=\"20\"/><circle cx=\"62\" cy=\"32\" r=\"18\"/><circle cx=\"44\" cy=\"44\" r=\"17\"/><circle cx=\"87\" cy=\"36\" r=\"4.5\"/><circle cx=\"96\" cy=\"33\" r=\"2.6\"/></g>";
