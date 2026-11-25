import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../nube/cliente';
import { useSesion } from '../../nube/sesion';
import { avisar } from '../../estado/avisos';
import { volverAlEditor } from '../../estado/ruta';

/*
 * Fase 5E · Administración (solo cuentas con es_admin = true, lo decide la base de datos).
 * - Reportes de contenido: retirar (borrado lógico y se cortan sus enlaces) o descartar.
 * - Consultas y reclamos de datos personales (Ley 1581): responder dentro del plazo.
 */

interface Reporte {
  id: string;
  tipo: 'play' | 'playbook';
  recurso_id: string;
  titulo: string | null;
  autor: string | null;
  motivo: string;
  estado: string;
  creado: string;
}
interface Solicitud {
  id: string;
  tipo: 'consulta' | 'reclamo';
  mensaje: string;
  recibido: string;
  limite: string;
  estado: string;
  respuesta: string | null;
}

const fecha = (s: string) => new Date(s).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

export function Admin() {
  const perfil = useSesion((s) => s.perfil);
  const listo = useSesion((s) => s.listo);
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);

  const cargar = useCallback(async () => {
    if (!supabase || !perfil?.es_admin) return;
    const [r, s] = await Promise.all([
      supabase.rpc('reportes_admin'),
      supabase.from('habeas_data_requests').select('*').order('recibido', { ascending: false }),
    ]);
    if (r.error || s.error) avisar('No se pudo cargar la administración.', true);
    setReportes((r.data as Reporte[]) ?? []);
    setSolicitudes((s.data as Solicitud[]) ?? []);
  }, [perfil?.es_admin]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const hacer = async (p: PromiseLike<{ error: unknown }>, ok: string) => {
    const { error } = await p;
    if (error) return avisar('No se pudo completar.', true);
    avisar(ok);
    await cargar();
  };

  if (!listo) return <div className="cargando">Cargando…</div>;
  if (!perfil?.es_admin || !supabase)
    return (
      <div className="pagina">
        <main className="pagina-cuerpo angosto">
          <h1>Administración</h1>
          <p>Esta sección es solo para la administración de la app.</p>
          <button className="boton-texto" onClick={volverAlEditor}>
            ← Volver a la app
          </button>
        </main>
      </div>
    );
  const sb = supabase;

  return (
    <div className="pagina">
      <header className="pagina-cabecera">
        <button className="boton-texto" onClick={volverAlEditor}>
          ← Volver a la app
        </button>
      </header>
      <main className="pagina-cuerpo">
        <h1>Administración</h1>

        <h2>Reportes de contenido</h2>
        {reportes.length === 0 ? (
          <p className="nota">No hay reportes.</p>
        ) : (
          <ul className="lista-filas">
            {reportes.map((r) => (
              <li key={r.id}>
                <div className="fila-principal">
                  <strong>
                    {r.tipo === 'playbook' ? '📚 ' : ''}
                    {r.titulo ?? '(sin título)'} <small>· de {r.autor ?? 'cuenta eliminada'}</small>
                  </strong>
                  <small>
                    {fecha(r.creado)} · <span className={`etiqueta-estado ${r.estado}`}>{r.estado}</span>
                  </small>
                  <p>{r.motivo}</p>
                </div>
                {r.estado === 'recibido' && (
                  <div className="fila-acciones">
                    <button
                      className="boton-texto peligro"
                      onClick={() => {
                        const nota = window.prompt('Motivo del retiro (queda registrado)');
                        if (nota !== null) void hacer(sb.rpc('retirar_contenido', { p_reporte: r.id, p_nota: nota }), 'Contenido retirado');
                      }}
                    >
                      Retirar contenido
                    </button>
                    <button
                      className="boton-texto"
                      onClick={() =>
                        void hacer(
                          sb.from('reportes').update({ estado: 'descartado', revisado: new Date().toISOString() }).eq('id', r.id),
                          'Reporte descartado',
                        )
                      }
                    >
                      Descartar
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <h2>Consultas y reclamos de datos personales</h2>
        {solicitudes.length === 0 ? (
          <p className="nota">No hay solicitudes.</p>
        ) : (
          <ul className="lista-filas">
            {solicitudes.map((s) => {
              const vencida = s.estado !== 'respondida' && new Date(s.limite) < new Date();
              return (
                <li key={s.id}>
                  <div className="fila-principal">
                    <strong>
                      {s.tipo === 'reclamo' ? 'Reclamo' : 'Consulta'} · <span className={`etiqueta-estado ${s.estado}`}>{s.estado}</span>
                    </strong>
                    <small className={vencida ? 'error' : undefined}>
                      Recibida {fecha(s.recibido)} · responder antes de {new Date(s.limite).toLocaleDateString('es-CO')}
                      {vencida ? ' · ¡VENCIDA!' : ''}
                    </small>
                    <p>{s.mensaje}</p>
                    {s.respuesta && <p className="nota">Respuesta: {s.respuesta}</p>}
                  </div>
                  {s.estado !== 'respondida' && (
                    <div className="fila-acciones">
                      <button
                        className="boton-texto primario"
                        onClick={() => {
                          const respuesta = window.prompt('Respuesta para la persona');
                          if (respuesta?.trim())
                            void hacer(
                              sb
                                .from('habeas_data_requests')
                                .update({ estado: 'respondida', respuesta: respuesta.trim(), respondido: new Date().toISOString() })
                                .eq('id', s.id),
                              'Solicitud respondida',
                            );
                        }}
                      >
                        Responder
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
