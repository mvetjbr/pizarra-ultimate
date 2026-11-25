import { useState, type ReactNode } from 'react';
import { instalar, useInstalacion } from '../estado/instalacion';
import { avisar } from '../estado/avisos';
import { Dialogo } from './Dialogo';

/*
 * Instructivo para instalar la app (es una PWA: se instala desde el navegador, sin tienda).
 * Abre en la pestaña del sistema que se detecta, pero se pueden ver las cuatro.
 */

type Sistema = 'android' | 'iphone' | 'windows' | 'mac';

const SISTEMAS: { id: Sistema; nombre: string }[] = [
  { id: 'android', nombre: 'Android' },
  { id: 'iphone', nombre: 'iPhone / iPad' },
  { id: 'windows', nombre: 'Windows' },
  { id: 'mac', nombre: 'Mac' },
];

function detectar(): Sistema {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'android';
  // El iPad nuevo dice ser Mac, pero tiene pantalla táctil.
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'iphone';
  if (/mac os x|macintosh/i.test(ua)) return 'mac';
  return 'windows';
}

interface Guia {
  pasos: { navegador: string; pasos: ReactNode[] }[];
  problemas: ReactNode[];
}

const GUIAS: Record<Sistema, Guia> = {
  android: {
    pasos: [
      {
        navegador: 'Chrome (recomendado)',
        pasos: [
          'Abre el enlace de la app en Chrome.',
          <>Toca el menú <b>⋮</b> (arriba a la derecha).</>,
          <>Elige <b>Instalar app</b> (o <b>Agregar a la pantalla principal</b>).</>,
          <>Confirma con <b>Instalar</b>. El ícono queda con tus otras apps.</>,
        ],
      },
      {
        navegador: 'Samsung Internet',
        pasos: [
          <>Toca el menú <b>≡</b> (abajo a la derecha).</>,
          <>Elige <b>Agregar página a</b> → <b>Pantalla de inicio</b>.</>,
        ],
      },
    ],
    problemas: [
      <>¿No aparece «Instalar app»? Recarga la página, espera unos segundos y vuelve a abrir el menú. Si usas Firefox u otro navegador, ábrela en Chrome.</>,
      <>Para quitarla: mantén presionado el ícono → <b>Desinstalar</b>. Tus jugadas guardadas en el teléfono se borran con ella; exporta antes las que quieras conservar.</>,
    ],
  },
  iphone: {
    pasos: [
      {
        navegador: 'Safari (recomendado)',
        pasos: [
          'Abre el enlace de la app en Safari.',
          <>Toca <b>Compartir</b> (el cuadro con la flecha ⬆️, abajo en el iPhone o arriba en el iPad).</>,
          <>Baja y elige <b>Agregar a inicio</b>. Si no lo ves, toca <b>Editar acciones</b> y actívalo.</>,
          <>Toca <b>Agregar</b>. El ícono queda en tu pantalla de inicio.</>,
        ],
      },
      {
        navegador: 'Chrome o Edge (iOS 16.4 o más nuevo)',
        pasos: [<>Toca <b>Compartir</b> ⬆️ junto a la barra de direcciones → <b>Agregar a inicio</b>.</>],
      },
    ],
    problemas: [
      <>Abre siempre la app desde el ícono de inicio, no desde Safari: son dos copias separadas y las jugadas no se pasan solas de una a otra.</>,
      <>Si el iPhone no se usa por varias semanas, puede borrar los datos de la app. Exporta tus jugadas importantes de vez en cuando (o guárdalas en la nube con tu cuenta).</>,
      <>Para quitarla: mantén presionado el ícono → <b>Eliminar app</b>.</>,
    ],
  },
  windows: {
    pasos: [
      {
        navegador: 'Edge o Chrome',
        pasos: [
          'Abre el enlace de la app.',
          <>En la barra de direcciones, a la derecha, haz clic en el ícono de <b>instalar</b> (una pantalla con una flecha ⊕).</>,
          <>Si no lo ves: menú <b>⋯</b> / <b>⋮</b> → <b>Aplicaciones</b> → <b>Instalar este sitio como aplicación</b> (en Chrome: <b>Transmitir, guardar y compartir</b> → <b>Instalar página como app</b>).</>,
          <>Confirma con <b>Instalar</b>. Queda en el menú Inicio y la puedes anclar a la barra de tareas.</>,
        ],
      },
    ],
    problemas: [
      <>Firefox no instala apps web: usa Edge o Chrome.</>,
      <>Para quitarla: abre la app → menú <b>⋯</b> arriba → <b>Desinstalar</b>, o desde Configuración → Aplicaciones.</>,
    ],
  },
  mac: {
    pasos: [
      {
        navegador: 'Safari (macOS Sonoma o más nuevo)',
        pasos: [
          'Abre el enlace de la app en Safari.',
          <>En la barra de menú: <b>Archivo</b> → <b>Agregar al Dock</b>.</>,
          <>Toca <b>Agregar</b>. Queda en el Dock y en Aplicaciones.</>,
        ],
      },
      {
        navegador: 'Chrome o Edge',
        pasos: [
          <>Haz clic en el ícono de <b>instalar</b> a la derecha de la barra de direcciones, o menú <b>⋮</b> → <b>Transmitir, guardar y compartir</b> → <b>Instalar página como app</b>.</>,
        ],
      },
    ],
    problemas: [
      <>Firefox no instala apps web: usa Safari, Chrome o Edge.</>,
      <>Para quitarla: arrastra el ícono desde Aplicaciones a la papelera (Safari) o abre la app → menú → <b>Desinstalar</b> (Chrome/Edge).</>,
    ],
  },
};

/** Ventana "Instalar la app": botón directo cuando el navegador lo permite y pasos para cada sistema. */
export function Instalar({ alCerrar }: { alCerrar: () => void }) {
  const [sistema, setSistema] = useState<Sistema>(detectar);
  const puedeInstalar = useInstalacion((s) => !!s.evento);
  const instalada = useInstalacion((s) => s.instalada);
  const guia = GUIAS[sistema];

  return (
    <Dialogo
      titulo="Instalar la app"
      alCerrar={alCerrar}
      pie={
        <button className="boton-texto primario" onClick={alCerrar}>
          Listo
        </button>
      }
    >
      {instalada ? (
        <p className="nota">✓ Ya la estás usando instalada en este dispositivo.</p>
      ) : puedeInstalar ? (
        <div className="instalar-directo">
          <p>Este navegador puede instalarla con un toque:</p>
          <button
            className="boton-texto primario"
            onClick={async () => {
              if (await instalar()) alCerrar();
              else avisar('No se pudo abrir el instalador. Sigue los pasos de abajo.', true);
            }}
          >
            Instalar ahora
          </button>
        </div>
      ) : (
        <p className="nota">
          Se instala desde el navegador, sin tienda de apps y gratis. Después abre sin barra de direcciones y funciona sin
          internet.
        </p>
      )}

      <div className="pestanas" role="tablist" aria-label="Sistema">
        {SISTEMAS.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={sistema === s.id}
            className={sistema === s.id ? 'activa' : undefined}
            onClick={() => setSistema(s.id)}
          >
            {s.nombre}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="guia-instalar">
        {guia.pasos.map((g) => (
          <section key={g.navegador}>
            <h3>{g.navegador}</h3>
            <ol>
              {g.pasos.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ol>
          </section>
        ))}
        <section>
          <h3>Si algo falla</h3>
          <ul>
            <li>
              ¿No ves lo último que se agregó? Cierra la app del todo y ábrela otra vez (a veces dos veces): se actualiza
              sola.
            </li>
            {guia.problemas.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </section>
      </div>
    </Dialogo>
  );
}
