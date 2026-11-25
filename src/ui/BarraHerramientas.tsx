import type { ReactNode } from 'react';
import { useEditor, type Herramienta } from '../estado/editorStore';
import {
  IconoBorrar,
  IconoCorte,
  IconoDefensa,
  IconoPase,
  IconoSeleccionar,
  IconoTexto,
  IconoZona,
} from './Iconos';

export const HERRAMIENTAS: { id: Herramienta; nombre: string; atajo: string; icono: ReactNode; ayuda: string }[] = [
  {
    id: 'seleccionar',
    nombre: 'Seleccionar',
    atajo: 'V',
    icono: <IconoSeleccionar />,
    ayuda: 'Toca un elemento para seleccionarlo. Arrastra jugadores, disco, zonas y textos.',
  },
  {
    id: 'corte',
    nombre: 'Corte',
    atajo: 'C',
    icono: <IconoCorte />,
    ayuda: 'Toca un jugador y arrastra hasta el destino del corte.',
  },
  {
    id: 'pase',
    nombre: 'Pase',
    atajo: 'P',
    icono: <IconoPase />,
    ayuda: 'Toca al lanzador (o el disco) y arrastra hasta el receptor. Luego elige recta o curva.',
  },
  {
    id: 'defensa',
    nombre: 'Defensa',
    atajo: 'D',
    icono: <IconoDefensa />,
    ayuda: 'Toca un defensor y arrastra para marcar su movimiento.',
  },
  { id: 'zona', nombre: 'Zona', atajo: 'Z', icono: <IconoZona />, ayuda: 'Arrastra sobre la cancha para marcar una zona.' },
  { id: 'texto', nombre: 'Texto', atajo: 'T', icono: <IconoTexto />, ayuda: 'Toca la cancha donde quieras poner una nota.' },
  { id: 'borrar', nombre: 'Borrar', atajo: 'B', icono: <IconoBorrar />, ayuda: 'Toca un elemento para borrarlo.' },
];

export function BarraHerramientas() {
  const actual = useEditor((s) => s.herramienta);
  const setHerramienta = useEditor((s) => s.setHerramienta);
  return (
    <nav className="herramientas" aria-label="Herramientas">
      {HERRAMIENTAS.map((h) => (
        <button
          key={h.id}
          className={`boton-herramienta${actual === h.id ? ' activa' : ''}${h.id === 'borrar' ? ' peligro' : ''}`}
          aria-pressed={actual === h.id}
          title={`${h.nombre} (${h.atajo})`}
          aria-label={`${h.nombre} (${h.atajo})`}
          onClick={() => setHerramienta(h.id)}
        >
          {h.icono}
          <span className={h.id === 'seleccionar' ? 'nombre-largo' : undefined}>{h.nombre}</span>
          {h.id === 'seleccionar' && <span className="nombre-corto">Mover</span>}
        </button>
      ))}
    </nav>
  );
}
