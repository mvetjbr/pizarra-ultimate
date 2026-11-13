import { useEffect, useRef, useState } from 'react';
import { usePreferencias } from '../estado/preferencias';
import { useBiblioteca } from '../estado/bibliotecaStore';
import { DIBUJO_MUNECO, SVG_NUBE } from './munecosSvg';
import { msPorNumero, munecoVisible } from './munecos';

const reducirMovimiento = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Dibujo de un muñeco (SVG propio de la app, constante del código: no viene de afuera). */
export function DibujoMuneco({ clave, className }: { clave: string; className?: string }) {
  const d = DIBUJO_MUNECO[clave] ?? DIBUJO_MUNECO.alien;
  return (
    <svg className={className} viewBox="-6 -8 82 104" aria-hidden="true" dangerouslySetInnerHTML={{ __html: d.svg }} />
  );
}

/**
 * Muñeco que cuenta de 0 a 10 (conteo de stall). Al tocarlo aparece "Contando" y luego
 * cada número en un globo; tocarlo de nuevo reinicia.
 */
export function Conteo() {
  const mostrar = usePreferencias((s) => s.mostrarConteo);
  const elegido = usePreferencias((s) => s.muneco);
  const velocidad = usePreferencias((s) => s.velocidadConteo);
  const modoEditor = usePreferencias((s) => s.modoEditor);
  const jugadas = useBiblioteca((s) => s.jugadas.length);
  const clave = munecoVisible(elegido, jugadas, modoEditor);

  const [contando, setContando] = useState(false);
  const [texto, setTexto] = useState<string | null>(null);
  const [termino, setTermino] = useState(false);
  const temporizador = useRef<ReturnType<typeof setInterval> | null>(null);
  const n = useRef(0);
  const nube = useRef<HTMLDivElement>(null);
  const figura = useRef<HTMLButtonElement>(null);

  const reiniciar = () => {
    if (temporizador.current) clearInterval(temporizador.current);
    temporizador.current = null;
    n.current = 0;
    nube.current?.getAnimations?.().forEach((a) => a.cancel());
    setContando(false);
    setTexto(null);
    setTermino(false);
  };

  useEffect(() => () => {
    if (temporizador.current) clearInterval(temporizador.current);
  }, []);
  useEffect(() => {
    if (!mostrar) reiniciar();
  }, [mostrar]);

  if (!mostrar) return null;

  const ms = msPorNumero(velocidad);
  const tic = () => {
    const actual = n.current++;
    const ultimo = actual >= 10;
    setTexto(actual === 0 ? 'Contando' : String(actual));
    const reducir = reducirMovimiento();
    const cuadros: Keyframe[] = reducir
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [
          { opacity: 0, transform: 'scale(.2)' },
          { opacity: 1, transform: 'scale(1.12)', offset: 0.3 },
          { opacity: 1, transform: 'scale(1)', offset: 0.5 },
        ];
    if (!reducir && !ultimo) cuadros.push({ opacity: 1, transform: 'scale(1)', offset: 0.85 }, { opacity: 0.3, transform: 'scale(1)' });
    nube.current?.animate?.(cuadros, { duration: ms * 0.96, fill: 'forwards', easing: 'ease-out' });
    const boca = figura.current?.querySelector('.mth');
    if (boca && !reducir) {
      boca.animate([{ transform: 'scaleY(1)' }, { transform: 'scaleY(2.4)' }, { transform: 'scaleY(1)' }], {
        duration: Math.min(380, ms * 0.5),
      });
    }
    if (ultimo) {
      if (temporizador.current) clearInterval(temporizador.current);
      temporizador.current = null;
      setContando(false);
      setTermino(true);
    }
  };

  const alTocar = () => {
    if (temporizador.current) {
      reiniciar();
      return;
    }
    reiniciar();
    setContando(true);
    tic();
    temporizador.current = setInterval(tic, ms);
  };

  return (
    <div className="conteo" aria-live="polite">
      <div className="conteo-fila">
        <div ref={nube} className={`conteo-nube${texto === 'Contando' ? ' ancha' : ''}`}>
          <svg viewBox="0 0 100 70" preserveAspectRatio="none" aria-hidden="true" dangerouslySetInnerHTML={{ __html: SVG_NUBE }} />
          <span className={texto === 'Contando' ? 'palabra' : texto === '10' ? 'diez' : undefined}>{texto}</span>
        </div>
        <button
          ref={figura}
          type="button"
          className={`conteo-figura${contando ? ' contando' : ''}`}
          onClick={alTocar}
          aria-label={contando ? 'Reiniciar el conteo' : 'Contar de 0 a 10'}
          title={contando ? 'Reiniciar el conteo' : 'Contar de 0 a 10'}
        >
          <DibujoMuneco clave={clave} />
        </button>
      </div>
      {!contando && <span className="conteo-pastilla">{termino ? 'Otra vez' : 'Contar'}</span>}
    </div>
  );
}
