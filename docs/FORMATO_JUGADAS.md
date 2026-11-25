# Formato de las jugadas (JSON) — para pasar jugadas a Pizarra Ultimate

Para importar el archivo: **Biblioteca → Importar JSON**. Ejemplo completo y probado: [ejemplo-jugadas.json](ejemplo-jugadas.json).

## La cancha (todo en metros)

```
 y=0  ┌────────┬──────────────────────────────┬────────┐
      │ zona   │                              │ zona   │
      │ izq.   │        cancha central        │ der.   │   ancho: 37 m (y de 0 a 37)
      │ 0-18   │           18 a 82            │ 82-100 │
 y=37 └────────┴──────────────────────────────┴────────┘
      x=0                                          x=100   largo: 100 m
```

- **x** va de 0 a 100 a lo largo y **y** de 0 a 37 a lo ancho; el centro es (50, 18.5).
- El ataque **anota a la derecha** (zona de x = 82 a 100).
- Se aceptan valores un poco por fuera de la cancha (de -50 a 150) para jugadores en la banca o la línea.

## Archivo

```json
{ "formato": "pizarra-ultimate", "version": 1, "jugadas": [ JUGADA, JUGADA, ... ] }
```

También sirve una lista `[JUGADA, ...]` o una sola `JUGADA`.

## JUGADA

| Campo | Valor |
|---|---|
| `id` | texto único (máx. 40 caracteres), ej. `"video-001"` |
| `nombre` | título de la jugada |
| `categoria` | `"Ataque"`, `"Defensa"`, `"Pull"`, `"Zona"`, `"Punto final"` u `"Otro"` |
| `carpeta` | (opcional) carpeta de la biblioteca donde queda, ej. `"Videos Nacionales 2025"` (máx. 40 caracteres) |
| `etiquetas` | lista de textos cortos, ej. `["vertical", "video Nacionales"]` |
| `notas` | texto libre (minuto del video, explicación) |
| `creada`, `editada` | fecha en milisegundos (ej. `1764000000000`) |
| `vista` | `"completa"`, `"media"` o `"zona"` |
| `lado` | `"derecha"` o `"izquierda"` (qué mitad o zona se ve si la vista no es completa) |
| `orientacion` | `"horizontal"` o `"vertical"` |
| `pasos` | lista de PASOS en orden (la animación va de uno al siguiente) |

## PASO (una foto de la jugada en un momento)

```json
{ "id": "p1", "jugadores": [...], "disco": {...}, "flechas": [...], "zonas": [], "textos": [] }
```

**Regla clave:** el mismo jugador lleva **el mismo `id` en todos los pasos**. Así la app anima su recorrido de un paso al siguiente.

### Jugador
```json
{ "id": "a3", "equipo": "ataque", "etiqueta": "3", "match": "M", "x": 45, "y": 18.5 }
```
- `equipo`: `"ataque"` (círculo) o `"defensa"` (triángulo).
- `etiqueta`: número o letras que se ven en la ficha (1 a 3 caracteres).
- `match` (opcional): `"M"` o `"F"`; se omite si no aplica.
- `nombre` (opcional): nombre corto que se ve debajo.

### Disco
```json
{ "x": 30.95, "y": 17.55, "poseedorId": "a1" }
```
`poseedorId` es el `id` del jugador que lo tiene: la app lo dibuja pegado a ese jugador, sin importar x e y (pon las del jugador + 0.95 en x y − 0.95 en y). Sin poseedor, el disco queda suelto en (x, y).

### Flechas
```json
{ "id": "f1", "tipo": "corte", "desde": {"x":45,"y":18.5}, "hasta": {"x":38,"y":30}, "desdeId": "a3" }
```
- `tipo`: `"corte"` (movimiento de un atacante), `"pase"` (vuelo del disco) o `"defensa"` (movimiento de un defensor).
- `desdeId` / `hastaId` (opcionales): `id` del jugador al que se pega cada punta. Si se mueve el jugador, la flecha lo sigue.
- Solo pases: `"curva": true` y `"control": {x, y}` para un pase curvo (IO, OI, hammer). El disco pasa por el punto medio entre el centro de la recta y `control`. Para que pase por un punto P, usa `control = 2·P − (desde + hasta)/2`.

### Zonas y textos (opcionales)
```json
{ "id": "z1", "forma": "rect", "x": 82, "y": 0, "ancho": 18, "alto": 37, "color": "#FFE066", "texto": "Endzone" }
{ "id": "t1", "texto": "Break por afuera", "x": 34, "y": 33 }
```
`forma` puede ser `"rect"` o `"elipse"`; (x, y) es la esquina superior izquierda.

## Cómo describir una jugada de video en pasos

1. **Paso 1:** dónde está cada jugador al empezar y quién tiene el disco. Las **flechas** de este paso muestran lo que va a pasar: cortes, pase y movimientos de la defensa.
2. **Paso 2:** cada jugador ya está donde terminó su flecha, y el disco está con quien recibió. Este paso tiene las flechas del siguiente movimiento, y así sigue.
3. Usa los mismos `id` de jugador en todos los pasos.
4. Máximo 7 por equipo en cancha.
