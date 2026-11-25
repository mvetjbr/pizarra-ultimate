import type { Punto } from '../modelo/tipos';
import type { Tema } from '../temas';

export function DiscoSVG({ p, tema, seleccionado, radioToque }: { p: Punto; tema: Tema; seleccionado: boolean; radioToque?: number }) {
  return (
    <g transform={`translate(${p.x} ${p.y})`} data-tipo="disco" data-id="disco" className="elemento">
      {radioToque && <circle r={radioToque} fill="transparent" />}
      {seleccionado && <circle r={1.05} fill="none" stroke={tema.seleccion} strokeWidth={0.22} />}
      <circle r={0.65} fill={tema.disco.relleno} stroke={tema.disco.borde} strokeWidth={0.15} />
      <circle r={0.4} fill="none" stroke={tema.disco.borde} strokeOpacity={0.35} strokeWidth={0.07} />
    </g>
  );
}
