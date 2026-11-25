# DESIGN.md — Estilos de Pizarra Ultimate

## Sistema de estilos (temas)

Cada persona elige el estilo en **⋯ → Estilos…**. El cambio se aplica al instante y queda guardado en el dispositivo (`localStorage`, clave `pizarra:tema`). Hay 5 estilos:

| Tema | Archivo | Frase |
|---|---|---|
| Clásico (predeterminado) | `src/temas/clasico.ts` | El de siempre. |
| Minimalista | `src/temas/minimalista.ts` | Blanco, negro y un solo rojo. |
| Orgánico | `src/temas/organico.ts` | Tonos tierra y formas redondas. |
| Electronic | `src/temas/electronic.ts` | Pista de baile: neón sobre negro. |
| Afro | `src/temas/afro.ts` | Textiles de África occidental: índigo, ocre y tierra. |

**Reglas para todos:**
- **Ningún componente lleva colores escritos a mano.**
  - La interfaz usa variables CSS con nombre de función, que cada tema define en su campo `css`: `--fondo`, `--superficie`, `--superficie-2`, `--texto`, `--texto-suave`, `--borde`, `--ancho-borde`, `--primario` / `--sobre-primario`, `--resalte` / `--sobre-resalte`, `--acento`, `--peligro`, `--cabecera` / `--sobre-cabecera`, `--capa` / `--sobre-capa`, `--sombra`, `--sombra-grande`, `--radio`, `--radio-grande`, `--radio-chip`, `--fuente-titulo`, `--fuente-texto`, `--peso-titulo`, `--mayus-titulo`, `--mayus-etiqueta`, `--icono-circulo`, `--texto-cancha`, `--velo`, etc.
  - La cancha, los jugadores, las flechas y el disco se dibujan con el objeto del tema (`cancha`, `ataque`, `defensa`, `flechas`, `disco`). Así las imágenes, GIF y videos exportados salen con los colores reales.
- **Ataque y defensa se distinguen por FORMA en todos los temas,** no solo por color, y la leyenda muestra esa forma:
  - Clásico: círculo / triángulo.
  - Minimalista: círculo relleno / anillo.
  - Orgánico: círculo / triángulo redondeado.
  - Electronic y Afro: círculo / triángulo.
- **Lo que solo cambia la apariencia:** un tema nunca cambia la funcionalidad ni los datos de las jugadas.
- **Fuentes:** solo se cargan las del tema activo, desde Google Fonts, cuando se elige. Respaldo: `system-ui`, `Georgia` o `monospace`.
- **Decoraciones propias** (ecualizador, kente, zigzag, panel salvia…): están en `src/estilos/temas-deco.css`, bajo `[data-tema="…"]`. Sus colores son los de la especificación de cada tema.
- **Contraste:** `node scripts/contraste-temas.mjs` revisa cada tema. El texto de la interfaz debe dar al menos 4,5:1, y las formas e íconos al menos 3:1.
- **Tema nuevo o cambio de colores:** se agrega el archivo en `src/temas/`, se suma a `TEMAS` en `src/temas/index.ts`, se corre el script de contraste y se documenta aquí.

**Resumen de cada tema:**
- **Minimalista**
  - Colores: blanco `#ffffff`, superficie `#eeeeee`, texto `#111111`, secundario `#666666`, acento rojo `#d9211a`.
  - Fuente: Archivo. Títulos en 800 con espaciado -0.01em; etiquetas en mayúsculas con 0.12em.
  - Forma: radios 0, bordes de 1,5 px y sin sombras.
  - Jugadores: ataque en círculo negro con número blanco; defensa en anillo rojo.
  - El rojo solo se usa en la defensa, la herramienta activa (con una barra de 3 px arriba) y "Presentar".
- **Orgánico**
  - Colores: fondo `#f3ece0`, superficie `#e6d9c3`, texto `#3a2e24`, terracota `#a8502c`, azul cielo `#5d8ea3`.
  - Fuentes: Young Serif en los títulos y Outfit en el resto.
  - Botones en píldora. La cancha va en un panel salvia `#5e7d57` con radio de 32 px y círculos `#6d8c65`.
  - Jugadores: ataque en círculo terracota con anillo crema; defensa en triángulo redondeado arena con borde azul cielo.
  - Barra de herramientas flotante. Reproducir: círculo terracota de 52 px. Presentar: azul cielo.
- **Electronic**
  - Colores: negro `#0a0a0f`, superficies `#100d1a` / `#14111f`, texto `#f3f0ff`, magenta `#ff3ea5`, cian `#29e0ff`, amarillo `#f5ff3d`.
  - Fuentes: Unbounded 800 en mayúsculas para los títulos y Space Mono para el resto.
  - Cancha: borde cian con brillo y zonas en rayas.
  - Jugadores: ataque en círculo amarillo con brillo; defensa en triángulo cian.
  - Ecualizador y "TRACK 01" en el encabezado, reproducir en forma de vinilo y paso activo "01".
  - Las animaciones respetan `prefers-reduced-motion`.
- **Afro**
  - Colores: fondo `#f6ecd9`, texto `#1d140d`, índigo `#23305e`, ocre `#e0a526`, terracota `#b8482a`, verde `#1f6b45`.
  - Fuentes: Bricolage Grotesque 800 en los títulos y DM Sans en el resto.
  - Decoración: franja kente de 14 px bajo el encabezado y zigzag ocre sobre los controles.
  - Jugadores: ataque en círculo ocre; defensa en triángulo terracota con contorno crema.
  - Botones índigo con ícono ocre; "Jugadores" y "Presentar" en terracota. Barra de herramientas oscura con la herramienta activa en ocre.
  - Patrones geométricos y abstractos; nada de caricaturas ni estereotipos.

El resto de este documento es el detalle del tema **Clásico** (vintage).

---

# Tema Clásico — estilo vintage

Afiche deportivo de los 70-80: fondo crema, bloques planos de color, bordes gruesos en tinta y sombras sólidas desplazadas.

**Bases:**
- Sistema [Estilo Bold Gráfico](https://claude.ai/artifact/XQecMsCdzDxN4MP4RMyN2X): estructura, bloques planos, sombras desplazadas y bordes de 3 px.
- Íconos del [Estilo Orgánico](https://claude.ai/artifact/SdkjUDQmwnkWP1KAN4mAxM): trazo redondeado con un círculo de color detrás.

**Ajustes vintage:**
- Colores menos saturados.
- Títulos en Shrikhand.
- Sin marrones ni olivas oscuros.

Toda pantalla, componente o cambio visual debe seguir este documento. Si algo no está aquí, se decide con estas mismas reglas y después se agrega a este archivo.

## Colores (variables CSS)

Valores del tema Clásico (`src/temas/clasico.ts`). Los nombres de abajo son los de la paleta vintage; en el código se usan las variables con nombre de función del sistema de estilos (por ejemplo, `--fondo` = crema, `--primario` = petróleo, `--resalte` = mostaza, `--acento` = coral, `--borde` = tinta).

```css
:root {
  /* Fondos */
  --crema: #f5ead3;        /* fondo de la app */
  --crema-2: #ecd9b4;      /* bloques secundarios, barras, chips inactivos */
  --papel: #fbf5e9;        /* superficies elevadas: ventanas, tarjetas, inputs */

  /* Tinta */
  --tinta: #1e2a33;        /* texto, bordes de 3 px y sombras sólidas */
  --tinta-suave: #4a5862;  /* texto secundario (6,1:1 sobre crema; 5,3:1 sobre crema-2) */

  /* Acentos (menos saturados que Bold Gráfico) */
  --coral: #e6785e;        /* acento cálido principal: selección, alertas suaves, círculo de íconos activos */
  --petroleo: #1f6874;     /* azul petróleo: botón primario, estados activos (texto crema encima, 5,35:1) */
  --mostaza: #dca43a;      /* resaltes, ataque, círculo detrás de los íconos */
  --naranja: #e5853b;      /* tercer cálido: avisos, insignias */
  --peligro: #b8432f;      /* borrar / eliminar (coral oscuro, nunca rojo puro) */

  /* Cancha */
  --cesped: #3f7f5e;       /* verde azulado medio, NO oliva */
  --cesped-zona: #356b50;  /* zonas de anotación */
  --linea-cancha: #f5ead3; /* líneas en crema */
}
```

**Pares de texto permitidos (contraste comprobado):**

| Texto | Fondo | Contraste |
|---|---|---|
| tinta | crema | 12,3:1 |
| tinta | crema-2 | 10,6:1 |
| tinta-suave | crema | 6,1:1 |
| crema | petróleo | 5,35:1 |
| tinta | mostaza | 6,6:1 |
| tinta | naranja | 5,4:1 |
| tinta | coral | 5,0:1 |

**No permitidos:**
- Texto crema sobre coral, mostaza o naranja: no llega a 4,5:1. Sobre esos bloques el texto va siempre en **tinta**.
- Marrones, olivas oscuros, grises tímidos, degradados, neón y negro puro (la tinta es azul muy oscuro).

## Tipografía

| Uso | Fuente | Notas |
|---|---|---|
| Títulos de ventanas y páginas, nombre de la app, encabezados grandes | **Shrikhand** (Google Fonts) | Solo tamaños ≥ 18 px; nunca en botones ni en texto corrido |
| Todo lo demás (texto, botones, etiquetas, datos) | **Work Sans** (Google Fonts) | 400 texto, 600 botones, 700 cifras y pestañas activas |

Variables: `--fuente-titulo: 'Shrikhand', 'Work Sans', system-ui, sans-serif;` y `--fuente-texto: 'Work Sans', system-ui, sans-serif;`. Sin conexión, la app cae en las fuentes del sistema sin romperse.

## Forma

- **Bordes:** 3 px en `--tinta` para botones, tarjetas, ventanas, chips e inputs. Los separadores internos van en 2 px.
- **Sombras:** sólidas y desplazadas, **nunca difuminadas**:
  - controles: `--sombra: 3px 3px 0 var(--tinta)`;
  - tarjetas y ventanas: `--sombra-grande: 6px 6px 0 var(--tinta)`.
  - **Al presionar,** el botón se desplaza 2 px y la sombra se acorta, como si se hundiera.
- **Radios:**
  - `--radio: 10px` en botones, tarjetas e inputs;
  - `--radio-grande: 16px` en ventanas;
  - `999px` en chips y píldoras.
- **Bloques planos:** cada zona va en un color plano (barras en crema-2, activo en petróleo), sin degradados ni transparencias decorativas.
- **Estado activo / elegido:** fondo `--petroleo` con texto `--crema`. Si el bloque es claro, fondo `--mostaza` con texto `--tinta`.
- **Foco del teclado:** contorno de 3 px en `--coral` con 2 px de separación.

## Tamaños (densidad compacta: la cancha manda)

La cancha es lo principal, así que los controles se hacen pequeños para dejarle espacio.

**Controles:**
- Botones e íconos de `--toque: 38px`, con el ícono a 20 px.
- Sombra de los controles de 2 px (`--sombra: 2px 2px 0 var(--tinta)`).
- Texto de botones a 0,85–0,9 rem.

**Barras:**
- Herramientas de 46 px de alto (42 en el celular) con etiqueta de 0,7 rem.
- Barras superior e inferior con relleno de 4 px.
- Miniaturas de pasos de 76 × 36.

**Biblioteca y ventanas:**
- Pestañas a 0,85 rem, chips de 30 px a 0,8 rem.
- En las tarjetas, la cancha va a todo el ancho (también en el celular), el nombre a 0,88 rem, los datos a 0,72 rem y los botones de 30–32 px.

Antes de agrandar un control, pregúntate si le quita espacio a la cancha.

## Íconos

Siguen la regla del Estilo Orgánico, recoloreada con los acentos de este estilo:
- **Cuadrícula:** 24 × 24, trazo de 1,8 px, terminaciones y uniones redondeadas, sin relleno.
- **Círculo detrás:** centro (13.5, 13.5), radio 9, en `--mostaza` (`--icono-circulo`). En estado activo pasa a `--coral`.
- **Trazo:** `currentColor` (tinta, o crema sobre petróleo), para que siempre contraste con su fondo.
- **Ícono nuevo:** se dibuja con esta misma regla (por ejemplo, el muñequito de "Formación y jugadores").

## Cancha

- **Césped y líneas:** el césped va en `--cesped` y las zonas en `--cesped-zona`, con líneas en `--linea-cancha`.
- **Colores por defecto:**
  - ataque: `--mostaza` con borde crema;
  - defensa: triángulo crema con borde `--coral`;
  - pase: crema;
  - movimiento defensivo: `--coral`.
- Cada persona puede cambiar los colores de equipo en el menú; estos son solo los valores iniciales.

## Evitar

- Sombras difuminadas, degradados y brillos.
- Tipografía fina, y Shrikhand en tamaños pequeños o en párrafos.
- Grises fríos sin tinte, marrones y olivas oscuros.
- Emojis como decoración de la interfaz. Los emojis de las carpetas los elige la persona y sí se respetan.
