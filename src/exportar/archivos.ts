/** Nombre de archivo seguro a partir del nombre de la jugada. */
export function nombreArchivo(nombre: string, extension: string): string {
  const base =
    nombre
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'jugada';
  return `${base}.${extension}`;
}

export function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** ¿El navegador puede compartir archivos (celular → WhatsApp)? */
export function puedeCompartirArchivos(): boolean {
  try {
    const prueba = new File([new Blob(['x'], { type: 'image/png' })], 'x.png', { type: 'image/png' });
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [prueba] });
  } catch {
    return false;
  }
}

/** Abre el menú de compartir del sistema con un archivo. Devuelve false si el usuario canceló. */
export async function compartirArchivo(blob: Blob, nombre: string, titulo: string): Promise<boolean> {
  const archivo = new File([blob], nombre, { type: blob.type });
  try {
    await navigator.share({ files: [archivo], title: titulo });
    return true;
  } catch (e) {
    if ((e as DOMException)?.name === 'AbortError') return false;
    throw e;
  }
}
