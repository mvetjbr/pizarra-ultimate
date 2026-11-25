# Pizarra Ultimate

App web para diseñar, animar y mostrar jugadas de ultimate frisbee mixto.
Funciona en celular, tablet y PC, se instala como app y sirve sin internet.
Toda la interfaz está en español.

## Qué hace

- **Cancha a escala WFDF** (100 × 37 m, zonas de 18 m, bricks a 20 m). Vista completa, media cancha o
  zona de anotación, horizontal o vertical, y cuadrícula opcional cada 5 m.
- **7 de ataque y 7 de defensa** arrastrables (ataque = círculo relleno, defensa = triángulo), con dorsal o
  iniciales, indicador de match **M/F** y nombre del roster debajo de la ficha.
- **Flechas** de corte, pase (recto o curvo para IO/OI/hammer) y movimiento defensivo, pegadas a los jugadores.
  Además zonas, notas sobre la cancha, deshacer y rehacer.
- **Pasos y animación**: línea de tiempo con miniaturas. El botón **+ Paso** ejecuta los cortes y el pase del
  paso actual. La reproducción va a 0.5x, 1x o 2x y el disco viaja por la curva del pase.
- **Modo presentación** a pantalla completa para TV, proyector o celular: botones grandes, se desliza con el
  dedo y muestra las notas del entrenador.
- **Biblioteca** con búsqueda, categorías, etiquetas y **9 plantillas** (vertical, ho-stack, side y split stack;
  man forzando forehand, zona 3-3-1, cup 4-2-1; recepción y cobertura de pull).
- **Roster del equipo**: nombres reales, dorsal y match. Marcas 7 jugadores y quedan en el ataque. La barra
  superior muestra la proporción (por ejemplo, **4M-3F**) y se pone en rojo si la línea no es 4-3.
- **Compartir**: enlace comprimido que abre la jugada en modo presentación, PNG del paso, **GIF** o **video**
  de la animación completa, y respaldo JSON.

## Requisitos

- [Node.js](https://nodejs.org) 20 o superior (incluye `npm`).

## Probar en tu computador

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`. Para probarla en el celular, conéctalo al mismo wifi y abre la dirección
**Network** que muestra la terminal (por ejemplo `http://192.168.1.20:5173`).

En modo desarrollo **no** hay modo sin internet. Para probar la versión final (PWA) sigue estos pasos:

```bash
npm run build
npm run preview
```

y abre `http://localhost:4173/pizarra-ultimate/`.

### Atajos de teclado

| Tecla | Acción |
|---|---|
| V · C · P · D · Z · T · B | Seleccionar · Corte · Pase · Defensa · Zona · Texto · Borrar |
| Ctrl+Z / Ctrl+Y | Deshacer / rehacer |
| Supr | Borrar el elemento seleccionado |
| Esc | Quitar la selección / salir de la presentación |
| Espacio | Reproducir / pausar |
| ← / → | Paso anterior / siguiente (animado) |

## Compartir con el equipo

- **Enlace:** **Compartir → Compartir / Copiar enlace**. La jugada completa va comprimida dentro del enlace
  (`#/ver/...`) y se abre directo en modo presentación. No necesita servidor, pero la app tiene que estar
  publicada (ver abajo) para que el enlace abra en otros celulares. Los nombres del roster asignados a las
  fichas viajan con el enlace.
- **Imagen:** PNG del paso actual con título y leyenda. En el celular, **Compartir imagen** abre WhatsApp.
- **Animación:** GIF (se ve en cualquier lado) o video WebM/MP4 (pesa menos). El video se graba en tiempo
  real, así que hay que dejar la pestaña abierta hasta que termine.
- **Respaldo:** JSON de una jugada (Compartir) o de toda la biblioteca (Biblioteca → Exportar todas).
  Se importa desde **Biblioteca → Importar JSON**.

Las jugadas y el roster se guardan **solo en el navegador de cada dispositivo** (IndexedDB). Haz un respaldo
JSON de vez en cuando, sobre todo antes de borrar los datos del navegador o de cambiar de celular.

## Instalar como app

- **Android / Chrome / Edge:** menú **⋯ → Instalar en este dispositivo** dentro de la app, o el menú del
  navegador **Instalar app**.
- **iPhone / iPad (Safari):** botón **Compartir ⬆️ → Agregar a inicio**.

Después de abrirla una vez con internet, funciona sin conexión: en la cancha, en el bus o donde sea.
Cuando publiques una versión nueva, la app se actualiza sola la próxima vez que se abra con internet.

## Desplegar gratis en GitHub Pages

1. Crea un repositorio en GitHub, por ejemplo `pizarra-ultimate`.
2. Sube el proyecto desde la carpeta `pizarra-ultimate`:
   ```bash
   git init
   git add .
   git commit -m "Pizarra Ultimate"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/pizarra-ultimate.git
   git push -u origin main
   ```
3. En GitHub entra a **Settings → Pages** y en **Source** elige **GitHub Actions**.
4. El flujo `.github/workflows/deploy.yml` compila y publica la app en cada `push` a `main`
   (se ve en la pestaña **Actions**). En unos minutos queda en
   `https://TU_USUARIO.github.io/pizarra-ultimate/`.
5. Abre esa dirección en tu celular, instálala y comparte el primer enlace de prueba por WhatsApp.

La ruta base se toma automáticamente del nombre del repositorio, así que puedes llamarlo como quieras.
Si usas un repositorio de usuario (`TU_USUARIO.github.io`), la app queda en la raíz: cambia en
`.github/workflows/deploy.yml` la línea `BASE_PATH` por `BASE_PATH: /`.

### Netlify (alternativa)

Compila con la base en la raíz y arrastra la carpeta `dist` a <https://app.netlify.com/drop>.

En PowerShell (Windows):

```powershell
$env:BASE_PATH = "/"; npm run build
```

En macOS o Linux:

```bash
BASE_PATH=/ npm run build
```

## Pasar jugadas a la app (por ejemplo, sacadas de un video)

El formato del archivo está explicado en [docs/FORMATO_JUGADAS.md](docs/FORMATO_JUGADAS.md), con un ejemplo probado en [docs/ejemplo-jugadas.json](docs/ejemplo-jugadas.json). Se importa en **Biblioteca → Importar JSON**.

## Pruebas de la base de datos

```bash
npm run prueba:sql
```

Corre las migraciones en un Postgres local (PGlite) y prueba los permisos con varias cuentas: textos legales, consentimientos, y quién puede ver, editar, compartir y borrar.

## Decisiones de arquitectura

Las decisiones importantes del proyecto (por qué Vite, por qué Supabase, cómo se guardan los consentimientos, etc.) están en [docs/adr](docs/adr/README.md).

## Estructura

```
src/
  modelo/     tipos, medidas de la cancha, geometría y validación (todo en metros)
  estado/     editor (Zustand) con historial, biblioteca, roster, preferencias, IndexedDB
  cancha/     dibujo SVG de la cancha y los elementos, gestos táctiles
  animacion/  interpolación entre pasos y reproductor
  plantillas/ formaciones de ataque, defensa y pull
  exportar/   PNG, GIF, video, JSON y enlace comprimido (lz-string)
  ui/         barras, línea de tiempo, presentación, diálogos
  estilos/    colores y CSS
scripts/
  generar-iconos.mjs   regenera los íconos PNG de la app (node scripts/generar-iconos.mjs)
```
