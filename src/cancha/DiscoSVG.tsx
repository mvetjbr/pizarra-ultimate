import type { Punto } from '../modelo/tipos';
import { COLORES } from '../estilos/colores';

export function DiscoSVG({ p, seleccionado, radioToque }: { p: Punto; seleccionado: boolean; radioToque?: number }) {
  return (
    <g transform={`translate(${p.x} ${p.y})`} data-tipo="disco" data-id="disco" className="elemento">
      {radioToque && <circle r={radioToque} fill="transparent" />}
      {seleccionado && <circle r={1.05} fill="none" stroke={COLORES.seleccion} strokeWidth={0.22} />}
      <circle r={0.65} fill={COLORES.disco} stroke={COLORES.bordeDisco} strokeWidth={0.15} />
      <circle r={0.4} fill="none" stroke="#C8C8C8" strokeWidth={0.07} />
    </g>
  );
}
