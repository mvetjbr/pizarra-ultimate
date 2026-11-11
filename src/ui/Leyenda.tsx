import { usePreferencias } from '../estado/preferencias';
import { useEditor } from '../estado/editorStore';
import { COLORES } from '../estilos/colores';
import { ESTILO_FLECHA } from '../cancha/FlechaSVG';
import { HERRAMIENTAS } from './BarraHerramientas';

function Linea({ color, tipo }: { color: string; tipo: keyof typeof ESTILO_FLECHA }) {
  const e = ESTILO_FLECHA[tipo];
  return (
    <svg viewBox="0 0 8 2" width="40" height="10" aria-hidden="true">
      <path d="M0 1H6" stroke={color} strokeWidth={e.ancho} strokeDasharray={e.guiones} strokeLinecap={e.extremo} />
      <polygon points="8,1 6.2,0.3 6.2,1.7" fill={color} />
    </svg>
  );
}

export function Leyenda() {
  const prefs = usePreferencias();
  if (!prefs.mostrarLeyenda) return null;
  return (
    <div className="leyenda" aria-label="Leyenda">
      <div>
        <svg viewBox="-1.5 -1.5 3 3" width="16" height="16" aria-hidden="true">
          <circle r="1.1" fill={prefs.colorAtaque} stroke="#fff" strokeWidth="0.18" />
        </svg>
        Ataque
      </div>
      <div>
        <svg viewBox="-1.7 -1.7 3.4 3.4" width="16" height="16" aria-hidden="true">
          <polygon points="0,-1.4 1.2,0.7 -1.2,0.7" fill="#fff" stroke={prefs.colorDefensa} strokeWidth="0.32" />
        </svg>
        Defensa
      </div>
      <div>
        <Linea color={prefs.colorAtaque} tipo="corte" /> Corte
      </div>
      <div>
        <Linea color={COLORES.pase} tipo="pase" /> Pase
      </div>
      <div>
        <Linea color={COLORES.movDefensa} tipo="defensa" /> Mov. defensivo
      </div>
    </div>
  );
}

export function Ayuda() {
  const h = useEditor((s) => s.herramienta);
  const sel = useEditor((s) => s.seleccion);
  // En Seleccionar no hace falta ayuda y así no tapa la cancha.
  if (sel || h === 'seleccionar') return null;
  const info = HERRAMIENTAS.find((x) => x.id === h);
  return <div className="ayuda">{info?.ayuda}</div>;
}
