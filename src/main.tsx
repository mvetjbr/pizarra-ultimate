import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { iniciarPersistencia } from './estado/persistencia';
import './estado/instalacion';
import { iniciarSesionNube } from './nube/sesion';
import { iniciarSincronizacion } from './nube/jugadas';
import { iniciarGuardadoCompartidas } from './nube/compartir';
import { iniciarMascotaEnCuenta } from './nube/mascota';
import { iniciarTemas } from './temas';
import './estilos/app.css';
import './estilos/pasos.css';
import './estilos/biblioteca.css';
import './estilos/conteo.css';
import './estilos/cuenta.css';
import './estilos/inicio.css';
import './estilos/nube.css';
import './estilos/tema.css'; // apariencia según el tema activo
import './estilos/temas-deco.css'; // decoraciones propias de cada tema: siempre el último

// El estilo elegido se aplica antes de dibujar para que no se vea un parpadeo de otro tema.
iniciarTemas();
void iniciarPersistencia().then(() => {
  // La sincronización arranca cuando la biblioteca local ya está cargada.
  iniciarSincronizacion();
  iniciarGuardadoCompartidas();
  iniciarMascotaEnCuenta(); // después de leer las preferencias, para que no las pise el guardado local

});
void iniciarSesionNube();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
