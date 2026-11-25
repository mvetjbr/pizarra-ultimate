import { useEffect } from 'react';
import { DIBUJO_MUNECO } from '../../conteo/munecosSvg';
import { irA } from '../../estado/ruta';
import { omitirInicio } from '../../estado/inicio';

/** Carita de perro que reemplaza la palabra «perro» en el saludo. */
function Perro() {
  return (
    <svg className="inicio-perro" viewBox="0 0 24 24" role="img" aria-label="perro">
      <path className="oreja" d="M6.5 7.5C3.6 7 2.2 11.8 3.8 15.6C5.6 14.6 7 11.4 6.5 7.5Z" />
      <path className="oreja" d="M17.5 7.5C20.4 7 21.8 11.8 20.2 15.6C18.4 14.6 17 11.4 17.5 7.5Z" />
      <ellipse className="cabeza" cx="12" cy="13" rx="6.6" ry="6.4" />
      <ellipse className="hocico" cx="12" cy="16" rx="3.6" ry="2.8" />
      <circle className="tinta" cx="9.4" cy="11.6" r="1.1" />
      <circle className="tinta" cx="14.6" cy="11.6" r="1.1" />
      <ellipse className="tinta" cx="12" cy="14.6" rx="1.5" ry="1.05" />
      <path className="boca" d="M12 15.6v1.1M10.7 17.2q1.3 .9 2.6 0" />
    </svg>
  );
}

/** Cancha de Ultimate en perspectiva, con pasto, donde se para la mascota. */
function Cancha() {
  return (
    <svg className="inicio-cancha" viewBox="0 0 320 210" preserveAspectRatio="none" aria-hidden="true">
      <path className="zona" d="M70 40L250 40L258 62L62 62Z" />
      <path className="zona" d="M23 170L297 170L310 205L10 205Z" />
      <path className="linea" d="M70 40L250 40L310 205L10 205Z" />
      <path className="linea" d="M62 62L258 62M23 170L297 170" />
      <path className="brick" d="M155 84l10 6m0-6l-10 6M151 142l18 8m0-8l-18 8" />
      <path
        className="pasto"
        d="M18 120l4-10l4 10M30 60l3-8l3 8M290 118l4-10l4 10M282 54l3-8l3 8M96 196l4-10l4 10M220 196l4-10l4 10M110 112l3-8l3 8M214 120l3-8l3 8"
      />
    </svg>
  );
}

/** Primera pantalla para quien no ha iniciado sesión: crear cuenta, ingresar u omitir. */
export function PantallaInicio() {
  useEffect(() => {
    document.title = 'Pizarra Ultimate';
  }, []);
  const alien = DIBUJO_MUNECO.alien;
  return (
    <main className="inicio">
      <h1 className="inicio-titulo">
        Pizarra <br />
        Ultimate
      </h1>
      <div className="inicio-escena">
        <p className="inicio-globo">
          <span>¡Hola mi</span>
          <Perro />
          <span>!</span>
        </p>
        <div className="inicio-ilustracion">
          <Cancha />
          {alien && (
            <svg
              className="inicio-mascota"
              viewBox="-6 -8 82 104"
              role="img"
              aria-label="La mascota, un alien verde, saluda parada en la cancha"
              dangerouslySetInnerHTML={{ __html: alien.svg }}
            />
          )}
        </div>
      </div>
      <p className="inicio-lema">Diseña, guarda y comparte las jugadas de tu equipo.</p>
      <div className="inicio-botones">
          <button className="boton-texto primario grande" onClick={() => irA('/cuenta/registro')}>
            Crear cuenta nueva
          </button>
          <button className="boton-texto grande" onClick={() => irA('/cuenta')}>
            Iniciar sesión
          </button>
          <button className="inicio-omitir" onClick={omitirInicio}>
            Omitir por ahora
          </button>
      </div>
    </main>
  );
}
