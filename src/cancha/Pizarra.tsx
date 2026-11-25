import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
import { useOrientacionEditor } from '../estado/pantalla';

type Extremo = 'desde' | 'hasta' | 'control';

type Gesto =
  | { tipo: 'jugador' | 'zona' | 'texto'; pointerId: number; id: string; dx: number; dy: number }
  | { tipo: 'disco'; pointerId: number; dx: number; dy: number }
  | { tipo: 'redimensionar'; pointerId: number; id: string }
  | { tipo: 'extremo'; pointerId: number; id: string; extremo: Extremo }
  | { tipo: 'flecha'; pointerId: number; flecha: TipoFlecha; desde: Punto; desdeId?: string }
  | { tipo: 'nuevaZona'; pointerId: number; inicio: Punto }
  // Borrar y Texto actúan al levantar el dedo: así un zoom con dos dedos no borra ni crea nada.
  | { tipo: 'toque'; pointerId: number; accion: 'borrar' | 'texto'; p: Punto; tipoObj?: TipoSeleccion; id?: string }
  // Arrastrar la cancha con un dedo cuando hay zoom (u = punto de la cancha bajo el dedo).
  | { tipo: 'arrastre'; pointerId: number; u: Punto };

/** Zoom del editor: cuánto se acerca y qué punto de la cancha queda al centro. */
type Zoom = { escala: number; cx: number; cy: number };
type Rect = { x: number; y: number; w: number; h: number };
const ZOOM_MAXIMO = 5;

/**
 * Caja visible (viewBox) con el mismo aspecto que la pantalla. Sin zoom es toda la región,
 * centrada como antes; con zoom no deja salirse de la cancha.
 */
function cajaVisible(region: Rect, ancho: number, alto: number, zoom: Zoom | null): Rect {
  if (!zoom || !ancho || !alto) return region;
  const k = Math.min(ancho / region.w, alto / region.h) * zoom.escala;
  const w = ancho / k;
  const h = alto / k;
  const centrar = (c: number, inicio: number, largo: number, visible: number) =>
    visible >= largo ? inicio + largo / 2 : Math.min(inicio + largo - visible / 2, Math.max(inicio + visible / 2, c));
  const cx = centrar(zoom.cx, region.x, region.w, w);
  const cy = centrar(zoom.cy, region.y, region.h, h);
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

type Borrador = { tipo: 'flecha'; flecha: TipoFlecha; a: Punto; b: Punto; anclado: boolean } | { tipo: 'zona'; a: Punto; b: Punto };

/** Tamaño mínimo del área táctil en píxeles de pantalla (radio de 22 px = 44 px). */
const RADIO_TOQUE_PX = 22;
/** Diámetro mínimo con que se ve una ficha en pantalla y cuánto se puede agrandar como máximo. */
const DIAMETRO_FICHA_PX = 26;
const ESCALA_MAXIMA = 1.5;

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
  const [tam, setTam] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState<Zoom | null>(null);
  const zoomRef = useRef<Zoom | null>(null);
  zoomRef.current = zoom;
  /** Dedos apoyados en la cancha (posición en pantalla). Con dos empieza el zoom. */
  const toques = useRef(new Map<number, { x: number; y: number }>());
  const pinza = useRef<{ d0: number; e0: number; u: Punto } | null>(null);

  const orientacion = useOrientacionEditor(jugada.orientacion);
  const region = regionVista(jugada.vista, jugada.lado, orientacion);
  const rot = rotacionTexto(orientacion);

  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const calcular = () => {
      const r = svg.getBoundingClientRect();
      if (r.width && r.height) setTam({ w: r.width, h: r.height });
    };
    calcular();
    const ro = new ResizeObserver(calcular);
    ro.observe(svg);
    return () => ro.disconnect();
  }, []);

  // Al cambiar de vista, de lado o de orientación se vuelve a ver toda la región.
  useEffect(() => setZoom(null), [region.x, region.y, region.w, region.h]);

  const caja = cajaVisible(region, tam.w, tam.h, zoom);
  const pxPorMetro = tam.w && tam.h ? Math.min(tam.w / region.w, tam.h / region.h) * (zoom?.escala ?? 1) : 10;

  /** Punto de la cancha en coordenadas del dibujo (antes de rotar) bajo una posición de pantalla. */
  const aDibujo = (x: number, y: number): Punto | null => {
    const ctm = svgRef.current?.getScreenCTM();
    if (!ctm) return null;
    const p = new DOMPoint(x, y).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  /** Zoom con `escala` que deja el punto `u` del dibujo bajo la posición de pantalla `m`. */
  const fijarZoom = (escala: number, u: Punto, m: { x: number; y: number }) => {
    const svg = svgRef.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const e = Math.min(ZOOM_MAXIMO, Math.max(1, escala));
    if (e < 1.02) {
      setZoom(null);
      return;
    }
    const k = Math.min(r.width / region.w, r.height / region.h) * e;
    const deseado = { escala: e, cx: u.x - (m.x - r.left) / k + r.width / k / 2, cy: u.y - (m.y - r.top) / k + r.height / k / 2 };
    const c = cajaVisible(region, r.width, r.height, deseado);
    setZoom({ escala: e, cx: c.x + c.w / 2, cy: c.y + c.h / 2 });
  };

  // Rueda del mouse o pellizco en el touchpad (llega como rueda con Ctrl).
  const fijarZoomRef = useRef(fijarZoom);
  fijarZoomRef.current = fijarZoom;
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const alGirar = (e: WheelEvent) => {
      e.preventDefault();
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
      fijarZoomRef.current((zoomRef.current?.escala ?? 1) * factor, { x: p.x, y: p.y }, { x: e.clientX, y: e.clientY });
    };
    svg.addEventListener('wheel', alGirar, { passive: false });
    return () => svg.removeEventListener('wheel', alGirar);
  }, []);

  const puntoMedio = () => {
    const [a, b] = [...toques.current.values()];
    return { m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, d: Math.hypot(a.x - b.x, a.y - b.y) };
  };

  /** Corta lo que estuviera haciendo el primer dedo y deja la jugada como estaba. */
  const cancelarGesto = () => {
    const g = gesto.current;
    if (!g) return;
    gesto.current = null;
    setBorrador(null);
    svgRef.current?.releasePointerCapture?.(g.pointerId);
    useEditor.getState().cancelarGesto();
  };

  // En pantallas pequeñas las fichas se dibujan más grandes para que se vean y se puedan tocar.
  const escalaFichas = Math.min(ESCALA_MAXIMA, Math.max(1, DIAMETRO_FICHA_PX / (2 * RADIO_JUGADOR * pxPorMetro)));
  const radioToque = Math.max(RADIO_JUGADOR * escalaFichas, RADIO_TOQUE_PX / pxPorMetro);

  /** Convierte la posición del puntero a metros de la cancha (considera zoom y rotación). */
  const aMetros = (e: { clientX: number; clientY: number }): Punto | null => {
    const ctm = gRef.current?.getScreenCTM();
    if (!ctm) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return limitarPunto(p.x, p.y);
  };

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'touch') {
      // El primer dedo de un toque nuevo: olvida dedos que se hayan quedado sin levantar.
      if (e.isPrimary) {
        toques.current.clear();
        pinza.current = null;
      }
      toques.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (toques.current.size === 2) {
        cancelarGesto();
        const { m, d } = puntoMedio();
        const u = aDibujo(m.x, m.y);
        if (u && d > 0) pinza.current = { d0: d, e0: zoomRef.current?.escala ?? 1, u };
        return;
      }
      if (toques.current.size > 2) return;
    }
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
      if (obj && obj.tipo !== 'manija') gesto.current = { tipo: 'toque', pointerId, accion: 'borrar', p, tipoObj: obj.tipo, id: obj.id };
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
      gesto.current = { tipo: 'toque', pointerId, accion: 'texto', p };
      return;
    }

    // Seleccionar y mover
    if (!obj) {
      st.seleccionar(null);
      // Con zoom, arrastrar en un espacio vacío mueve la cancha.
      const u = zoomRef.current ? aDibujo(e.clientX, e.clientY) : null;
      if (u) {
        gesto.current = { tipo: 'arrastre', pointerId, u };
        capturar();
      }
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
    if (toques.current.has(e.pointerId)) toques.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pz = pinza.current;
    if (pz && toques.current.size === 2) {
      const { m, d } = puntoMedio();
      fijarZoom(pz.e0 * (d / pz.d0), pz.u, m);
      return;
    }
    const g = gesto.current;
    if (!g || e.pointerId !== g.pointerId) return;
    if (g.tipo === 'arrastre') {
      fijarZoom(zoomRef.current?.escala ?? 1, g.u, { x: e.clientX, y: e.clientY });
      return;
    }
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
    toques.current.delete(e.pointerId);
    if (toques.current.size < 2) pinza.current = null;
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
      case 'arrastre':
        return;
      case 'toque':
        // Solo cuenta si el dedo no se desplazó (si se movió, era otra cosa).
        if (distancia(g.p, p) > Math.max(1.5, radioToque)) return;
        if (g.accion === 'borrar' && g.tipoObj && g.id) st.eliminar({ tipo: g.tipoObj, id: g.id });
        if (g.accion === 'texto') st.agregarTexto(g.p);
        return;
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
    <>
    <svg
      ref={svgRef}
      className={`pizarra herramienta-${herramienta}`}
      viewBox={`${caja.x} ${caja.y} ${caja.w} ${caja.h}`}
      preserveAspectRatio="xMidYMid meet"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => terminar(e, false)}
      onPointerCancel={(e) => terminar(e, true)}
      role="application"
      aria-label="Cancha de ultimate"
    >
      <g ref={gRef} transform={transformacion(orientacion)}>
        <Cancha cuadricula={prefs.mostrarCuadricula} />
        <CapaElementos
          paso={cuadro?.paso ?? paso}
          rot={rot}
          colorAtaque={prefs.colorAtaque}
          colorDefensa={prefs.colorDefensa}
          mostrarMatch={prefs.mostrarMatch}
          seleccion={cuadro ? null : seleccion}
          radioToque={radioToque}
          escalaFichas={escalaFichas}
          opacidadFlechas={cuadro?.opacidadFlechas}
          nombreDe={crearNombreDe(prefs.mostrarNombres, miembros)}
        />
        <g pointerEvents="none">{vistaBorrador}</g>
        {manijas}
      </g>
    </svg>
    {zoom && (
      <button className="boton-zoom" onClick={() => setZoom(null)} aria-label="Ver toda la cancha (quitar zoom)" title="Ver toda la cancha">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="M20 20l-4.8-4.8M7.5 10.5h6" />
        </svg>
        {Math.round(zoom.escala * 10) / 10}x
      </button>
    )}
    </>
  );
}
