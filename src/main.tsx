import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { iniciarPersistencia } from './estado/persistencia';
import './estado/instalacion';
import { iniciarSesionNube } from './nube/sesion';
import { iniciarSincronizacion } from './nube/jugadas';
import { iniciarGuardadoCompartidas } from './nube/compartir';
import './estilos/app.css';
import './estilos/pasos.css';
import './estilos/biblioteca.css';
import './estilos/conteo.css';
import './estilos/cuenta.css';
import './estilos/nube.css';
import './estilos/vintage.css'; // tema de DESIGN.md: siempre el último

void iniciarPersistencia().then(() => {
  // La sincronización arranca cuando la biblioteca local ya está cargada.
  iniciarSincronizacion();
  iniciarGuardadoCompartidas();
});
void iniciarSesionNube();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
