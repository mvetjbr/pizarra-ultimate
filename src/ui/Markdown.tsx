import type { ReactNode } from 'react';

// Markdown mínimo para los textos legales: títulos, párrafos, listas, tablas, citas, negrita y enlaces.
// Construye elementos de React (nunca innerHTML), así un texto no puede inyectar código.

const marcadorPendiente = /\[[A-ZÁÉÍÓÚÑ_]{4,}\]/;

function enLinea(texto: string, clave: string): ReactNode[] {
  const nodos: ReactNode[] = [];
  const patron = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]]+\]\((https?:\/\/[^)\s]+)\)|`[^`]+`|\[[A-ZÁÉÍÓÚÑ_]{4,}\])/g;
  let ultimo = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = patron.exec(texto))) {
    if (m.index > ultimo) nodos.push(texto.slice(ultimo, m.index));
    const t = m[0];
    const k = `${clave}-${i++}`;
    if (t.startsWith('**')) nodos.push(<strong key={k}>{enLinea(t.slice(2, -2), k)}</strong>);
    else if (t.startsWith('`')) nodos.push(<code key={k}>{t.slice(1, -1)}</code>);
    else if (marcadorPendiente.test(t) && !t.includes('](')) nodos.push(<mark key={k} title="Dato pendiente por llenar">{t}</mark>);
    else if (t.startsWith('[')) {
      const etiqueta = t.slice(1, t.indexOf(']'));
      nodos.push(
        <a key={k} href={m[2]} target="_blank" rel="noopener noreferrer">
          {etiqueta}
        </a>,
      );
    } else nodos.push(<em key={k}>{enLinea(t.slice(1, -1), k)}</em>);
    ultimo = m.index + t.length;
  }
  if (ultimo < texto.length) nodos.push(texto.slice(ultimo));
  return nodos;
}

export function Markdown({ texto }: { texto: string }) {
  const lineas = texto.split('\n');
  const bloques: ReactNode[] = [];
  let i = 0;
  let n = 0;
  while (i < lineas.length) {
    const linea = lineas[i];
    const k = `b${n++}`;
    if (!linea.trim()) {
      i++;
      continue;
    }
    const titulo = linea.match(/^(#{1,4})\s+(.*)$/);
    if (titulo) {
      const nivel = Math.min(titulo[1].length + 1, 5);
      const Etiqueta = `h${nivel}` as 'h2';
      bloques.push(<Etiqueta key={k}>{enLinea(titulo[2], k)}</Etiqueta>);
      i++;
      continue;
    }
    if (linea.trim().startsWith('|')) {
      const filas: string[][] = [];
      while (i < lineas.length && lineas[i].trim().startsWith('|')) {
        const celdas = lineas[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        if (!celdas.every((c) => /^:?-{2,}:?$/.test(c))) filas.push(celdas);
        i++;
      }
      const [cabeza, ...cuerpo] = filas;
      bloques.push(
        <div className="tabla-legal" key={k}>
          <table>
            <thead>
              <tr>{cabeza?.map((c, j) => <th key={j}>{enLinea(c, `${k}h${j}`)}</th>)}</tr>
            </thead>
            <tbody>
              {cuerpo.map((f, r) => (
                <tr key={r}>{f.map((c, j) => <td key={j}>{enLinea(c, `${k}${r}-${j}`)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    const lista = linea.match(/^\s*([-*]|\d+\.)\s+/);
    if (lista) {
      const ordenada = /\d/.test(lista[1]);
      const items: string[] = [];
      while (i < lineas.length && /^\s*([-*]|\d+\.)\s+/.test(lineas[i])) {
        items.push(lineas[i].replace(/^\s*([-*]|\d+\.)\s+/, ''));
        i++;
      }
      const Lista = ordenada ? 'ol' : 'ul';
      bloques.push(
        <Lista key={k}>
          {items.map((t, j) => (
            <li key={j}>{enLinea(t, `${k}${j}`)}</li>
          ))}
        </Lista>,
      );
      continue;
    }
    if (linea.startsWith('>')) {
      const citas: string[] = [];
      while (i < lineas.length && lineas[i].startsWith('>')) {
        citas.push(lineas[i].replace(/^>\s?/, ''));
        i++;
      }
      bloques.push(<blockquote key={k}>{enLinea(citas.join(' '), k)}</blockquote>);
      continue;
    }
    if (/^-{3,}$/.test(linea.trim())) {
      bloques.push(<hr key={k} />);
      i++;
      continue;
    }
    const parrafo: string[] = [];
    while (i < lineas.length && lineas[i].trim() && !/^(#|\||>|\s*([-*]|\d+\.)\s)/.test(lineas[i])) {
      parrafo.push(lineas[i]);
      i++;
    }
    bloques.push(<p key={k}>{enLinea(parrafo.join(' '), k)}</p>);
  }
  return <div className="markdown">{bloques}</div>;
}
