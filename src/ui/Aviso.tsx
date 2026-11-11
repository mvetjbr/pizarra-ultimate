import { useAviso } from '../estado/avisos';

export function Aviso() {
  const { mensaje, error } = useAviso();
  return (
    <div className="contenedor-aviso" aria-live="polite" role={error ? 'alert' : 'status'}>
      {mensaje && <div className={`aviso${error ? ' error' : ''}`}>{mensaje}</div>}
    </div>
  );
}
