import { useState } from 'react';
import type { Categoria } from '../modelo/tipos';
import { CATEGORIAS } from '../modelo/tipos';
import { useEditor } from '../estado/editorStore';
import { Dialogo } from './Dialogo';

const aEtiquetas = (texto: string) =>
  Array.from(
    new Set(
      texto
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean)
        .map((e) => e.slice(0, 30)),
    ),
  ).slice(0, 20);

/** Nombre, categoría, etiquetas y notas del entrenador. */
export function DetallesJugada({ alCerrar }: { alCerrar: () => void }) {
  const jugada = useEditor((s) => s.jugada);
  const st = useEditor.getState;
  // Las etiquetas se escriben como texto libre y se convierten al salir del campo.
  const [textoEtiquetas, setTextoEtiquetas] = useState(jugada.etiquetas.join(', '));

  const enGesto = {
    onFocus: () => st().iniciarGesto(),
    onBlur: () => st().terminarGesto(),
  };

  return (
    <Dialogo
      titulo="Detalles de la jugada"
      alCerrar={alCerrar}
      pie={
        <button className="boton-texto primario" onClick={alCerrar}>
          Listo
        </button>
      }
    >
      <div className="formulario">
        <label className="campo">
          <span>Nombre</span>
          <input
            value={jugada.nombre}
            maxLength={80}
            {...enGesto}
            onChange={(e) => {
              const v = e.target.value;
              st().moverGesto((j) => {
                j.nombre = v;
              });
            }}
          />
        </label>
        <label className="campo">
          <span>Categoría</span>
          <select
            value={jugada.categoria}
            onChange={(e) => {
              const v = e.target.value as Categoria;
              st().cambiar((j) => {
                j.categoria = v;
              });
            }}
          >
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>Etiquetas (separadas por coma)</span>
          <input
            value={textoEtiquetas}
            placeholder="stack, inicio de punto, viento"
            onChange={(e) => setTextoEtiquetas(e.target.value)}
            onBlur={() => {
              const etiquetas = aEtiquetas(textoEtiquetas);
              setTextoEtiquetas(etiquetas.join(', '));
              if (etiquetas.join('|') !== jugada.etiquetas.join('|')) {
                st().cambiar((j) => {
                  j.etiquetas = etiquetas;
                });
              }
            }}
          />
        </label>
        <label className="campo">
          <span>Notas del entrenador</span>
          <textarea
            rows={6}
            value={jugada.notas}
            maxLength={5000}
            placeholder="Qué buscar, a quién va el disco, errores comunes…"
            {...enGesto}
            onChange={(e) => {
              const v = e.target.value;
              st().moverGesto((j) => {
                j.notas = v;
              });
            }}
          />
        </label>
      </div>
    </Dialogo>
  );
}
