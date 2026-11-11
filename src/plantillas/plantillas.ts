import type { Arrow, Categoria, Label, Match, Play, Player, Step, TipoFlecha, Vista, Zone } from '../modelo/tipos';
import { crearJugada, crearPasoSiguiente, nuevoId } from '../modelo/fabrica';
import { OFFSET_DISCO } from '../modelo/geometria';

// Convenciones: el ataque avanza hacia la derecha (zona de anotación en x = 82–100).
// Lanzador diestro mirando hacia +x: su lado de forehand es el de abajo (y mayor).

type Pos = [number, number];

interface Mov {
  tipo: TipoFlecha;
  /** Id del jugador: a1..a7 (ataque), d1..d7 (defensa). */
  de: string;
  /** Punto de destino o id de otro jugador. */
  a: Pos | string;
  curva?: boolean;
  control?: Pos;
}

export interface Plantilla {
  id: string;
  nombre: string;
  categoria: Categoria;
  descripcion: string;
  etiquetas: string[];
  vista?: Vista;
  ataque: Pos[];
  defensa?: Pos[];
  /** Quién tiene el disco al inicio. */
  disco: string;
  zonas?: Omit<Zone, 'id'>[];
  textos?: Omit<Label, 'id'>[];
  /** Movimientos de cada paso; el paso siguiente se genera ejecutándolos. */
  pasos: Mov[][];
}

const MATCH: Match[] = ['M', 'F', 'M', 'F', 'M', 'F', 'M'];
const Y = 18.5; // centro de la cancha a lo ancho

function flechas(paso: Step, movs: Mov[]): Arrow[] {
  const pos = (id: string) => paso.jugadores.find((j) => j.id === id);
  return movs.flatMap((m) => {
    const origen = pos(m.de);
    if (!origen) return [];
    const destino = typeof m.a === 'string' ? pos(m.a) : undefined;
    const hasta = destino ? { x: destino.x, y: destino.y } : Array.isArray(m.a) ? { x: m.a[0], y: m.a[1] } : null;
    if (!hasta) return [];
    return [
      {
        id: nuevoId(),
        tipo: m.tipo,
        desde: { x: origen.x, y: origen.y },
        desdeId: origen.id,
        hasta,
        hastaId: destino?.id,
        curva: m.curva,
        control: m.control ? { x: m.control[0], y: m.control[1] } : undefined,
      },
    ];
  });
}

/** Crea una jugada nueva (ids nuevos) a partir de una plantilla. */
export function construirPlantilla(p: Plantilla): Play {
  const jugadores: Player[] = [
    ...p.ataque.map(([x, y], i) => ({ id: `a${i + 1}`, equipo: 'ataque' as const, etiqueta: String(i + 1), match: MATCH[i], x, y })),
    ...(p.defensa ?? []).map(([x, y], i) => ({ id: `d${i + 1}`, equipo: 'defensa' as const, etiqueta: String(i + 1), match: MATCH[i], x, y })),
  ];
  const portador = jugadores.find((j) => j.id === p.disco) ?? jugadores[0];
  const inicial: Step = {
    id: nuevoId(),
    jugadores,
    disco: { x: portador.x + OFFSET_DISCO.x, y: portador.y + OFFSET_DISCO.y, poseedorId: portador.id },
    flechas: [],
    zonas: (p.zonas ?? []).map((z) => ({ ...z, id: nuevoId() })),
    textos: (p.textos ?? []).map((t) => ({ ...t, id: nuevoId() })),
  };
  const pasos: Step[] = [];
  let actual = inicial;
  p.pasos.forEach((movs, i) => {
    if (i > 0) actual = crearPasoSiguiente(pasos[i - 1]);
    actual.flechas = flechas(actual, movs);
    pasos.push(actual);
  });
  if (pasos.length === 0) pasos.push(inicial);
  else pasos.push(crearPasoSiguiente(pasos[pasos.length - 1]));

  return {
    ...crearJugada(p.nombre),
    categoria: p.categoria,
    etiquetas: p.etiquetas,
    notas: p.descripcion,
    vista: p.vista ?? 'completa',
    pasos,
  };
}

// ---------- Formaciones base ----------

const VERTICAL: Pos[] = [
  [30, Y], // 1 handler con disco
  [26, 24], // 2 dump
  [40, Y],
  [44, Y],
  [48, Y],
  [52, Y],
  [56, Y],
];

/** Marca individual forzando forehand: el marcador tapa el backhand (arriba) y los demás defienden el lado abierto. */
function marcaForehand(ataque: Pos[]): Pos[] {
  return ataque.map(([x, y], i) => (i === 0 ? [x + 1.2, y - 1.6] : [x + 1.2, y + 1.8]));
}

/** Ataque contra zona: 3 handlers, 2 poppers, 2 alas. */
const ATAQUE_ZONA: Pos[] = [
  [30, Y],
  [28, 8],
  [28, 29],
  [40, 14],
  [40, 23],
  [56, 6],
  [56, 31],
];

const LINEA_RECEPCION: Pos[] = [3.5, 8.5, 13.5, 18.5, 23.5, 28.5, 33.5].map((y) => [18, y]);
const LINEA_PULL: Pos[] = [3.5, 8.5, 13.5, 18.5, 23.5, 28.5, 33.5].map((y) => [82, y]);

export const PLANTILLAS: Plantilla[] = [
  // ---------- Ataque ----------
  {
    id: 'vertical-stack',
    nombre: 'Vertical stack',
    categoria: 'Ataque',
    descripcion:
      'Stack en el centro, dos handlers. El primero del stack hace un corte por debajo hacia el lado abierto (forehand); después un corte profundo para el huck.',
    etiquetas: ['stack', 'vertical', 'forehand'],
    ataque: VERTICAL,
    disco: 'a1',
    pasos: [
      [
        { tipo: 'corte', de: 'a3', a: [38, 30] },
        { tipo: 'pase', de: 'a1', a: [38, 30] },
      ],
      [
        { tipo: 'corte', de: 'a7', a: [76, 29] },
        { tipo: 'pase', de: 'a3', a: [76, 29], curva: true, control: [60, 36] },
      ],
    ],
  },
  {
    id: 'ho-stack',
    nombre: 'Horizontal stack (ho-stack)',
    categoria: 'Ataque',
    descripcion:
      'Tres handlers atrás y cuatro cortadores en línea a lo ancho. Un cortador viene por debajo y el del lado contrario ataca lo profundo.',
    etiquetas: ['stack', 'horizontal'],
    ataque: [
      [30, Y],
      [28, 8],
      [28, 29],
      [50, 6],
      [50, 14],
      [50, 23],
      [50, 31],
    ],
    disco: 'a1',
    pasos: [
      [
        { tipo: 'corte', de: 'a5', a: [40, 12] },
        { tipo: 'pase', de: 'a1', a: [40, 12] },
      ],
      [
        { tipo: 'corte', de: 'a6', a: [74, 27] },
        { tipo: 'pase', de: 'a5', a: [74, 27], curva: true, control: [60, 10] },
      ],
    ],
  },
  {
    id: 'side-stack',
    nombre: 'Side stack',
    categoria: 'Ataque',
    descripcion:
      'Stack pegado a una línea lateral y un cortador aislado con todo el espacio del otro lado. Ideal para jugadas de inicio de punto.',
    etiquetas: ['stack', 'iso', 'inicio'],
    ataque: [
      [30, 12],
      [26, 17],
      [40, 31],
      [44, 31],
      [48, 31],
      [52, 31],
      [52, 12],
    ],
    disco: 'a1',
    zonas: [{ forma: 'rect', x: 36, y: 2, ancho: 30, alto: 22, color: '#FFE066', texto: 'Espacio del iso' }],
    pasos: [
      [
        { tipo: 'corte', de: 'a7', a: [40, 6] },
        { tipo: 'pase', de: 'a1', a: [40, 6] },
      ],
      [
        { tipo: 'corte', de: 'a3', a: [72, 18] },
        { tipo: 'pase', de: 'a7', a: [72, 18], curva: true, control: [58, 4] },
      ],
    ],
  },
  {
    id: 'split-stack',
    nombre: 'Split stack',
    categoria: 'Ataque',
    descripcion:
      'Dos stacks, uno a cada lado, que abren un carril por el centro. Los cortes salen hacia el carril central y se alternan.',
    etiquetas: ['stack', 'split'],
    ataque: [
      [30, Y],
      [26, 24],
      [42, 10],
      [47, 10],
      [42, 27],
      [47, 27],
      [52, 27],
    ],
    disco: 'a1',
    zonas: [{ forma: 'rect', x: 38, y: 14, ancho: 30, alto: 9, color: '#4DABF7', texto: 'Carril central' }],
    pasos: [
      [
        { tipo: 'corte', de: 'a3', a: [40, Y] },
        { tipo: 'pase', de: 'a1', a: [40, Y] },
      ],
      [
        { tipo: 'corte', de: 'a7', a: [70, Y] },
        { tipo: 'pase', de: 'a3', a: [70, Y] },
      ],
    ],
  },

  // ---------- Defensa ----------
  {
    id: 'man-forehand',
    nombre: 'Man-to-man forzando forehand',
    categoria: 'Defensa',
    descripcion:
      'Marca individual. El marcador tapa el backhand y obliga a lanzar de forehand; los demás defienden un paso hacia el lado abierto y siguen a su jugador en cada corte.',
    etiquetas: ['marca', 'man', 'forehand'],
    ataque: VERTICAL,
    defensa: marcaForehand(VERTICAL),
    disco: 'a1',
    textos: [{ x: 30, y: 11, texto: 'Forzar forehand ↓' }],
    pasos: [
      [
        { tipo: 'corte', de: 'a3', a: [38, 30] },
        { tipo: 'defensa', de: 'd3', a: [38.5, 27.8] },
        { tipo: 'pase', de: 'a1', a: [38, 30] },
      ],
    ],
  },
  {
    id: 'zona-331',
    nombre: 'Zona 3-3-1',
    categoria: 'Defensa',
    descripcion:
      'Copa de tres alrededor del lanzador, tres medios (dos alas y un centro) y un profundo. Toda la zona se desplaza con cada pase lateral.',
    etiquetas: ['zona', 'copa'],
    ataque: ATAQUE_ZONA,
    defensa: [
      [32, 16.5],
      [32, 20.5],
      [34, Y],
      [44, 8],
      [46, Y],
      [44, 29],
      [65, Y],
    ],
    disco: 'a1',
    zonas: [{ forma: 'elipse', x: 30.5, y: 14, ancho: 6, alto: 9, color: '#FF6B6B', texto: 'Copa' }],
    pasos: [
      [
        { tipo: 'pase', de: 'a1', a: 'a2' },
        { tipo: 'defensa', de: 'd1', a: [30, 6] },
        { tipo: 'defensa', de: 'd2', a: [30.5, 10.5] },
        { tipo: 'defensa', de: 'd3', a: [32.5, 8] },
        { tipo: 'defensa', de: 'd4', a: [42, 4.5] },
        { tipo: 'defensa', de: 'd5', a: [44, 13] },
        { tipo: 'defensa', de: 'd6', a: [44, 23] },
        { tipo: 'defensa', de: 'd7', a: [63, 14] },
      ],
    ],
  },
  {
    id: 'cup-421',
    nombre: 'Cup 4-2-1',
    categoria: 'Defensa',
    descripcion:
      'Copa de cuatro (marcador, dos laterales y un centro de copa), dos alas y un profundo. Cierra el centro y obliga a pases laterales lentos.',
    etiquetas: ['zona', 'copa', 'cup'],
    ataque: ATAQUE_ZONA,
    defensa: [
      [31.5, 17],
      [33, 13.5],
      [33, 23.5],
      [37, Y],
      [50, 8],
      [50, 29],
      [68, Y],
    ],
    disco: 'a1',
    zonas: [{ forma: 'elipse', x: 30, y: 12, ancho: 9, alto: 13, color: '#FF6B6B', texto: 'Copa' }],
    pasos: [
      [
        { tipo: 'pase', de: 'a1', a: 'a3' },
        { tipo: 'defensa', de: 'd1', a: [30, 27] },
        { tipo: 'defensa', de: 'd2', a: [31.5, 23] },
        { tipo: 'defensa', de: 'd3', a: [31.5, 33] },
        { tipo: 'defensa', de: 'd4', a: [35, 28.5] },
        { tipo: 'defensa', de: 'd5', a: [48, 15] },
        { tipo: 'defensa', de: 'd6', a: [48, 33] },
        { tipo: 'defensa', de: 'd7', a: [66, 23] },
      ],
    ],
  },

  // ---------- Pull ----------
  {
    id: 'pull-recepcion',
    nombre: 'Recepción de pull',
    categoria: 'Pull',
    descripcion:
      'El equipo receptor espera en su línea. Un handler recibe el pull y los demás arman el vertical stack mientras el disco está en el aire.',
    etiquetas: ['pull', 'recepción', 'inicio'],
    ataque: LINEA_RECEPCION,
    defensa: LINEA_PULL,
    disco: 'd4',
    pasos: [
      [
        { tipo: 'pase', de: 'd4', a: [24, 16], curva: true, control: [52, 2] },
        { tipo: 'corte', de: 'a4', a: [24, 16] },
        { tipo: 'corte', de: 'a3', a: [22, 23] },
        { tipo: 'corte', de: 'a1', a: [40, Y] },
        { tipo: 'corte', de: 'a2', a: [44, Y] },
        { tipo: 'corte', de: 'a5', a: [48, Y] },
        { tipo: 'corte', de: 'a6', a: [52, Y] },
        { tipo: 'corte', de: 'a7', a: [56, Y] },
      ],
    ],
  },
  {
    id: 'pull-cobertura',
    nombre: 'Cobertura de pull',
    categoria: 'Pull',
    descripcion:
      'El equipo que pullea sale en línea apenas suelta el disco, sin dejar huecos, y cada uno toma a su jugador al llegar. El que pullea va al final como seguridad.',
    etiquetas: ['pull', 'cobertura', 'defensa'],
    ataque: LINEA_RECEPCION,
    defensa: LINEA_PULL,
    disco: 'd4',
    pasos: [
      [
        { tipo: 'pase', de: 'd4', a: [26, Y], curva: true, control: [55, 34] },
        { tipo: 'defensa', de: 'd1', a: [38, 5] },
        { tipo: 'defensa', de: 'd2', a: [36, 10] },
        { tipo: 'defensa', de: 'd3', a: [34, 15] },
        { tipo: 'defensa', de: 'd5', a: [34, 22] },
        { tipo: 'defensa', de: 'd6', a: [36, 27] },
        { tipo: 'defensa', de: 'd7', a: [38, 32] },
        { tipo: 'defensa', de: 'd4', a: [55, Y] },
        { tipo: 'corte', de: 'a4', a: [26, Y] },
      ],
    ],
  },
];
