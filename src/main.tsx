import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { iniciarPersistencia } from './estado/persistencia';
import './estado/instalacion';
import { iniciarSesionNube } from './nube/sesion';
import './estilos/app.css';
import './estilos/pasos.css';
import './estilos/biblioteca.css';
import './estilos/conteo.css';
import './estilos/cuenta.css';

iniciarPersistencia();
void iniciarSesionNube();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
