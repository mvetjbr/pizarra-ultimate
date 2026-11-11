import { useLayoutEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Punto, TipoFlecha } from '../modelo/tipos';
import { limitarPunto, regionVista, rotacionTexto, transformacion } from '../modelo/cancha';
import {
  buscarJugador,
  controlDe,
  distancia,
  extremos,
  jugadorCercano,
  OFFSET_DISCO,
  posDisco,
  RADIO_JUGADOR,
} from '../modelo/geometria';
import { pasoActivo, useEditor, type TipoSeleccion } from '../estado/editorStore';
import { usePreferencias } from '../estado/preferencias';
import { COLORES } from '../estilos/colores';
import { useReproduccion } from '../animacion/reproductor';
import { interpolar } from '../animacion/interpolar';
import { Cancha } from './Cancha';
import { CapaElementos } from './CapaElementos';
import { crearNombreDe } from './CanchaEstatica';
import { useRoster } from '../estado/rosterStore';
import { FlechaSVG, geometriaFlecha } from './FlechaSVG';

type Extremo = 'desde' | 'hasta' | 'control';

type Gesto =
  | { tipo: 'jugador' | 'zona' | 'texto'; pointerId: number; id: string; dx: number; dy: number }
  | { tipo: 'disco'; pointerId: number; dx: number; dy: number }
  | { tipo: 'redimensionar'; pointerId: number; id: string }
  | { tipo: 'extremo'; pointerId: number; id: string; extremo: Extremo }
  | { tipo: 'flecha'; pointerId: number; flecha: TipoFlecha; desde: Punto; desdeId?: string }
  | { tipo: 'nuevaZona'; pointerId: number; inicio: Punto };

type Borrador = { tipo: 'flecha'; flecha: TipoFlecha; a: Punto; b: Punto; anclado: boolean } | { tipo: 'zona'; a: Punto; b: Punto };

/** Tamaño mínimo del área táctil en píxeles de pantalla (radio de 22 px = 44 px). */
const RADIO_TOQUE_PX = 22;

function objetivo(e: ReactPointerEvent) {
  const el = (e.target as Element).closest('[data-tipo]');
  if (!el) return null;
  return {
    tipo: el.getAttribute('data-tipo') as TipoSeleccion | 'manija',
    id: el.getAttribute('data-id') ?? '',
    extremo: el.getAttribute('data-extremo') ?? '',
  };
}

export function Pizarra() {
  const jugada = useEditor((s) => s.jugada);
  const paso = useEditor(pasoActivo);
  const herramienta = useEditor((s) => s.herramienta);
  const seleccion = useEditor((s) => s.seleccion);
  const formaZona = useEditor((s) => s.formaZona);
  const prefs = usePreferencias();
  const miembros = useRoster((s) => s.miembros);
  // Durante la animación se dibuja un cuadro intermedio y la edición queda en pausa.
  const posicion = useReproduccion((s) => s.posicion);
  const cuadro = posicion !== null ? interpolar(jugada.pasos, posicion) : null;

  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const gesto = useRef<Gesto | null>(null);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [pxPorMetro, setPxPorMetro] = useState(10);

  const region = regionVista(jugada.vista, jugada.lado, jugada.orientacion);
  const rot = rotacionTexto(jugada.orientacion);

  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const calcular = () => {
      const r = svg.getBoundingClientRect();
      if (r.width && r.height) setPxPorMetro(Math.min(r.width / region.w, r.height / region.h));
    };
    calcular();
    const ro = new ResizeObserver(calcular);
    ro.observe(svg);
    return () => ro.disconnect();
  }, [region.w, region.h]);

  const radioToque = Math.max(RADIO_JUGADOR, RADIO_TOQUE_PX / pxPorMetro);

  /** Convierte la posición del puntero a metros de la cancha (considera zoom y rotación). */
  const aMetros = (e: { clientX: number; clientY: number }): Punto | null => {
    const ctm = gRef.current?.getScreenCTM();
    if (!ctm) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return limitarPunto(p.x, p.y);
  };

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (gesto.current || useReproduccion.getState().posicion !== null) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const p = aMetros(e);
    if (!p) return;
    const obj = objetivo(e);
    const st = useEditor.getState();
    const pasoAct = pasoActivo(st);
    const h = st.herramienta;
    const pointerId = e.pointerId;
    const capturar = () => svgRef.current?.setPointerCapture(pointerId);

    if (h === 'borrar') {
      if (obj && obj.tipo !== 'manija') st.eliminar({ tipo: obj.tipo, id: obj.id });
      return;
    }

    if (obj?.tipo === 'manija') {
      st.iniciarGesto();
      gesto.current =
        obj.extremo === 'tamano'
          ? { tipo: 'redimensionar', pointerId, id: obj.id }
          : { tipo: 'extremo', pointerId, id: obj.id, extremo: obj.extremo as Extremo };
      capturar();
      return;
    }

    if (h === 'corte' || h === 'pase' || h === 'defensa') {
      let desde = p;
      let desdeId: string | undefined;
      const idJugador =
        obj?.tipo === 'jugador' ? obj.id : obj?.tipo === 'disco' ? pasoAct.disco.poseedorId : undefined;
      const j = buscarJugador(pasoAct, idJugador);
      if (j) {
        desde = { x: j.x, y: j.y };
        desdeId = j.id;
      }
      gesto.current = { tipo: 'flecha', pointerId, flecha: h, desde, desdeId };
      setBorrador({ tipo: 'flecha', flecha: h, a: desde, b: desde, anclado: !!desdeId });
      capturar();
      return;
    }

    if (h === 'zona' && obj?.tipo !== 'zona') {
      gesto.current = { tipo: 'nuevaZona', pointerId, inicio: p };
      setBorrador({ tipo: 'zona', a: p, b: p });
      capturar();
      return;
    }

    if (h === 'texto' && obj?.tipo !== 'texto') {
      st.agregarTexto(p);
      return;
    }

    // Seleccionar y mover
    if (!obj) {
      st.seleccionar(null);
      return;
    }
    st.seleccionar({ tipo: obj.tipo, id: obj.id });
    if (obj.tipo === 'flecha') return;

    let origen: Punto | undefined;
    if (obj.tipo === 'jugador') origen = buscarJugador(pasoAct, obj.id);
    else if (obj.tipo === 'disco') origen = posDisco(pasoAct);
    else if (obj.tipo === 'zona') origen = pasoAct.zonas.find((z) => z.id === obj.id);
    else if (obj.tipo === 'texto') origen = pasoAct.textos.find((t) => t.id === obj.id);
    if (!origen) return;
    const dx = origen.x - p.x;
    const dy = origen.y - p.y;
    st.iniciarGesto();
    gesto.current =
      obj.tipo === 'disco'
        ? { tipo: 'disco', pointerId, dx, dy }
        : { tipo: obj.tipo as 'jugador' | 'zona' | 'texto', pointerId, id: obj.id, dx, dy };
    capturar();
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const g = gesto.current;
    if (!g || e.pointerId !== g.pointerId) return;
    const p = aMetros(e);
    if (!p) return;
    const { moverGesto } = useEditor.getState();
    switch (g.tipo) {
      case 'jugador':
      case 'texto':
      case 'zona':
        moverGesto((_, paso) => {
          const lista: { id: string; x: number; y: number }[] = g.tipo === 'jugador' ? paso.jugadores : g.tipo === 'texto' ? paso.textos : paso.zonas;
          const el = lista.find((x) => x.id === g.id);
          if (el) {
            el.x = p.x + g.dx;
            el.y = p.y + g.dy;
          }
        });
        break;
      case 'disco':
        moverGesto((_, paso) => {
          paso.disco = { x: p.x + g.dx, y: p.y + g.dy };
        });
        break;
      case 'redimensionar':
        moverGesto((_, paso) => {
          const z = paso.zonas.find((x) => x.id === g.id);
          if (z) {
            z.ancho = Math.max(1, p.x - z.x);
            z.alto = Math.max(1, p.y - z.y);
          }
        });
        break;
      case 'extremo':
        moverGesto((_, paso) => {
          const f = paso.flechas.find((x) => x.id === g.id);
          if (!f) return;
          if (g.extremo === 'control') f.control = p;
          else if (g.extremo === 'desde') {
            f.desde = p;
            f.desdeId = undefined;
          } else {
            f.hasta = p;
            f.hastaId = undefined;
          }
        });
        break;
      case 'flecha':
        setBorrador({ tipo: 'flecha', flecha: g.flecha, a: g.desde, b: p, anclado: !!g.desdeId });
        break;
      case 'nuevaZona':
        setBorrador({ tipo: 'zona', a: g.inicio, b: p });
        break;
    }
  };

  const terminar = (e: ReactPointerEvent<SVGSVGElement>, cancelado: boolean) => {
    const g = gesto.current;
    if (!g || e.pointerId !== g.pointerId) return;
    gesto.current = null;
    setBorrador(null);
    const st = useEditor.getState();
    const p = aMetros(e);
    if (cancelado || !p) {
      st.terminarGesto();
      return;
    }
    const pasoAct = pasoActivo(st);
    switch (g.tipo) {
      case 'disco': {
        const pos = { x: p.x + g.dx, y: p.y + g.dy };
        const j = jugadorCercano(pasoAct, pos, Math.max(2.2, radioToque));
        if (j) {
          st.moverGesto((_, paso) => {
            paso.disco = { x: j.x + OFFSET_DISCO.x, y: j.y + OFFSET_DISCO.y, poseedorId: j.id };
          });
        }
        st.terminarGesto();
        break;
      }
      case 'extremo': {
        if (g.extremo !== 'control') {
          const f = pasoAct.flechas.find((x) => x.id === g.id);
          const otro = g.extremo === 'desde' ? f?.hastaId : f?.desdeId;
          const j = jugadorCercano(pasoAct, p, radioToque, otro);
          if (j) {
            st.moverGesto((_, paso) => {
              const fl = paso.flechas.find((x) => x.id === g.id);
              if (!fl) return;
              if (g.extremo === 'desde') {
                fl.desdeId = j.id;
                fl.desde = { x: j.x, y: j.y };
              } else {
                fl.hastaId = j.id;
                fl.hasta = { x: j.x, y: j.y };
              }
            });
          }
        }
        st.terminarGesto();
        break;
      }
      case 'flecha': {
        if (distancia(g.desde, p) < 1.2) return;
        const j = jugadorCercano(pasoAct, p, radioToque, g.desdeId);
        st.agregarFlecha({
          tipo: g.flecha,
          desde: g.desde,
          desdeId: g.desdeId,
          hasta: j ? { x: j.x, y: j.y } : p,
          hastaId: j?.id,
        });
        break;
      }
      case 'nuevaZona': {
        const x = Math.min(g.inicio.x, p.x);
        const y = Math.min(g.inicio.y, p.y);
        const ancho = Math.abs(p.x - g.inicio.x);
        const alto = Math.abs(p.y - g.inicio.y);
        if (ancho < 1.5 || alto < 1.5) return;
        st.agregarZona({ forma: st.formaZona, x, y, ancho, alto, color: '#FFE066' });
        break;
      }
      default:
        st.terminarGesto();
    }
  };

  // Manijas de edición del elemento seleccionado
  let manijas: JSX.Element | null = null;
  if (seleccion && herramienta === 'seleccionar' && !cuadro) {
    const manija = (key: string, id: string, extremo: string, q: Punto, relleno = '#FFFFFF') => (
      <g key={key} data-tipo="manija" data-id={id} data-extremo={extremo} transform={`translate(${q.x} ${q.y})`}>
        <circle r={radioToque} fill="transparent" />
        <circle r={0.55} fill={relleno} stroke="#00838F" strokeWidth={0.18} />
      </g>
    );
    if (seleccion.tipo === 'flecha') {
      const f = paso.flechas.find((x) => x.id === seleccion.id);
      if (f) {
        const { a, b, ancladoA, ancladoB } = extremos(paso, f);
        const c = controlDe(f, a, b);
        const { a2, b2 } = geometriaFlecha(a, b, c, ancladoA, ancladoB);
        manijas = (
          <g>
            {c && (
              <polyline
                points={`${a.x},${a.y} ${c.x},${c.y} ${b.x},${b.y}`}
                fill="none"
                stroke={COLORES.seleccion}
                strokeWidth={1}
                strokeDasharray="4 4"
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            )}
            {manija('a', f.id, 'desde', a2)}
            {manija('b', f.id, 'hasta', b2)}
            {c && manija('c', f.id, 'control', c, COLORES.seleccion)}
          </g>
        );
      }
    } else if (seleccion.tipo === 'zona') {
      const z = paso.zonas.find((x) => x.id === seleccion.id);
      if (z) manijas = manija('t', z.id, 'tamano', { x: z.x + z.ancho, y: z.y + z.alto }, COLORES.seleccion);
    }
  }

  let vistaBorrador: JSX.Element | null = null;
  if (borrador?.tipo === 'flecha' && distancia(borrador.a, borrador.b) > 0.5) {
    vistaBorrador = (
      <FlechaSVG
        tipo={borrador.flecha}
        a={borrador.a}
        b={borrador.b}
        c={null}
        ancladoA={borrador.anclado}
        colorCorte={prefs.colorAtaque}
      />
    );
  } else if (borrador?.tipo === 'zona') {
    const x = Math.min(borrador.a.x, borrador.b.x);
    const y = Math.min(borrador.a.y, borrador.b.y);
    const w = Math.abs(borrador.b.x - borrador.a.x);
    const h = Math.abs(borrador.b.y - borrador.a.y);
    const comun = { fill: '#FFFFFF', fillOpacity: 0.15, stroke: '#FFFFFF', strokeWidth: 0.2, strokeDasharray: '0.6 0.4' };
    vistaBorrador =
      formaZona === 'elipse' ? (
        <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} {...comun} />
      ) : (
        <rect x={x} y={y} width={w} height={h} {...comun} />
      );
  }

  return (
    <svg
      ref={svgRef}
      className={`pizarra herramienta-${herramienta}`}
      viewBox={`${region.x} ${region.y} ${region.w} ${region.h}`}
      preserveAspectRatio="xMidYMid meet"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => terminar(e, false)}
      onPointerCancel={(e) => terminar(e, true)}
      role="application"
      aria-label="Cancha de ultimate"
    >
      <g ref={gRef} transform={transformacion(jugada.orientacion)}>
        <Cancha cuadricula={prefs.mostrarCuadricula} />
        <CapaElementos
          paso={cuadro?.paso ?? paso}
          rot={rot}
          colorAtaque={prefs.colorAtaque}
          colorDefensa={prefs.colorDefensa}
          mostrarMatch={prefs.mostrarMatch}
          seleccion={cuadro ? null : seleccion}
          radioToque={radioToque}
          opacidadFlechas={cuadro?.opacidadFlechas}
          nombreDe={crearNombreDe(prefs.mostrarNombres, miembros)}
        />
        <g pointerEvents="none">{vistaBorrador}</g>
        {manijas}
      </g>
    </svg>
  );
}
