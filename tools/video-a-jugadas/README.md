# video-a-jugadas

Herramienta aparte de la app (no toca su código). Convierte una jugada de un video de ultimate
en un JSON que se importa en Pizarra Ultimate con **Biblioteca → Importar JSON**. El formato
está en [docs/FORMATO_JUGADAS.md](../../docs/FORMATO_JUGADAS.md).

> **Las posiciones son aproximadas.** Sirven de boceto: hay que revisarlas en el editor. Lo
> dudoso queda marcado en el campo `notas` de la jugada, en `reporte.md` y en las imágenes de
> verificación.

## Instalación (Windows, solo CPU)

```powershell
cd tools/video-a-jugadas
py -3.12 -m venv .venv
.venv\Scripts\python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
.venv\Scripts\python -m pip install -r requirements.txt
```

ffmpeg viene con `imageio-ffmpeg` (no hay que instalarlo aparte). Los pesos de YOLO
(`yolo11s.pt`, ~19 MB) se descargan solos la primera vez en `modelos/`.

## Uso

```powershell
.venv\Scripts\python video_a_jugadas.py --url "https://www.youtube.com/watch?v=q58SO7VeE5U" --inicio 00:02 --fin 00:16 --nombre "T Slash" --salida out/
```

Opciones útiles:

| Opción | Para qué |
|---|---|
| `--tiempos 00:03,00:06.5,00:09,00:11` | fija a mano los momentos de los pasos (tiempo del video) en vez de detectarlos |
| `--pasos 3` | 3 pasos (formación, arranque, recepción) en vez de 4 |
| `--ataca izquierda` / `derecha` | fuerza la dirección de ataque (por defecto se deduce del movimiento) |
| `--equipo-ataque oscuro` | si el equipo atacante viste de rojo/negro |
| `--atacante Revolver` | nombre del equipo atacante (va en etiquetas) |
| `--calibracion calib.json` | calibración manual por líneas de una toma (ver abajo); se puede repetir |
| `--video archivo.mp4` | usa un video local en vez de descargar |
| `--conf-min 0.4` | confianza mínima de la homografía para usar un cuadro |

Salida en `--salida`:

- `t-slash.json` — el archivo para importar (validado contra el formato).
- `reporte.md` / `reporte.json` — confianza por paso, jugadores vistos/estimados, homografía por cuadro.
- `verificacion/pasoN.jpg` — el fotograma original con las líneas de la cancha proyectadas
  (amarillo) y cada jugador marcado con su id; debajo, el diagrama resultante. Un punto
  naranja hueco o un `?` significa posición estimada (no vista en ese cuadro).
- `bitacora.txt` — todo lo que hizo el programa.

## Cómo funciona

1. **Descarga** del tramo con yt-dlp (`--download-sections`, ≤1080p) + ffmpeg.
2. **Tomas** con PySceneDetect (un zoom rápido no cuenta como corte si el fondo sigue continuo); con
   YOLO se descartan los primeros planos. Se usa la toma amplia más larga, más cada toma que tenga
   una calibración manual (`--calibracion`); todas se procesan como un solo tramo.
3. **Detección**: YOLO11 (ultralytics) a 10 cuadros/s, sin tracker de imagen. Equipo por color del
   torso (blanco contra rojo/negro).
4. **Homografía cuadro a cuadro** (`cancha.py`):
   - máscara de líneas blancas (top-hat; sirve para pasto verde o seco) sin jugadores ni rótulos
     fijos (marcador, título, detectados porque no se mueven cuando la cámara sí);
   - rectas con Hough, filtradas por grosor y nitidez (el público no pasa);
   - **ancla**: se prueban hipótesis (lateral lejana/cercana × línea de gol/fondo) y se queda la que
     mejor explica las líneas (precisión × cobertura);
   - **propagación** hacia adelante y atrás con optical flow del fondo, y **refinamiento** contra
     las líneas en cada cuadro. Si en un cuadro no se ven líneas en dos direcciones, la confianza
     decae y, por debajo de `--conf-min`, ese cuadro **no se usa**.
5. **Jugadores** (`rastreo.py`): el seguimiento se hace en metros sobre la cancha (asignación
   húngara por equipo, con una compuerta que crece mientras el jugador no se ve), así el movimiento
   de cámara y los cortes de toma no lo confunden. Se descartan los que están fuera de la cancha
   (banca, público) y se eligen hasta 7 por equipo. Ids `a1..a7` de atrás hacia
   adelante; cada defensor `dN` toma el número del atacante que marca en el paso 1.
6. **Disco**: clase "frisbee" de YOLO; poseedor = atacante con el disco en la mano cerca de ese
   momento. Si no se detecta, `poseedorId` queda nulo y se avisa en `notas` (no se inventa).
7. **Pasos**: formación inicial, arranque del corte (el cortador pasa de 3 m/s), pase (pico de
   velocidad) y recepción (el cortador frena). Es heurístico: usa `--tiempos` si no cuadra.
   Las flechas salen del desplazamiento entre pasos (≥ 2 m). Si el equipo ataca hacia la
   izquierda se refleja `x → 100 − x`, `y → 37 − y`.

## Calibración manual por líneas

Para una toma que no se calibra sola (con zoom, pocas líneas), marca las líneas en un cuadro:

```powershell
.venv\Scripts\python marcar_lineas.py --url "https://www.youtube.com/watch?v=q58SO7VeE5U" --inicio 00:02 --fin 00:16 --t 00:02.0 --salida calib_t-slash.json
```

En la ventana: teclas `1`–`7` eligen la línea, clic izquierdo agrega un punto (2 o más por línea,
bien separados), clic derecho borra el último, `,` y `.` cambian de cuadro, `o` indica que la cámara
está en la lateral opuesta, `v` verifica (dibuja la cancha resuelta y su ±) y `s` guarda.
Después:

```powershell
.venv\Scripts\python video_a_jugadas.py --url "https://www.youtube.com/watch?v=q58SO7VeE5U" --inicio 00:02 --fin 00:16 --nombre "T Slash" --salida out/ --calibracion calib_t-slash.json
```

El JSON (también se puede escribir a mano; píxeles del video original):

```json
{
  "t": "00:02.0",
  "lineas": {
    "lateral_lejana": [[1000, 184], [1880, 174]],
    "lateral_cercana": [[300, 791], [1800, 803]],
    "gol_izquierda": [[60, 390], [560, 225]]
  },
  "puntos": [{"imagen": [x, y], "cancha": [X, Y]}],
  "camara_opuesta": false
}
```

Líneas: `lateral_lejana`, `lateral_cercana`, `fondo_izquierda`, `gol_izquierda`, `gol_derecha`,
`fondo_derecha`, `medio`. Convención, tal como se ve en el video: `x = 0` es el fondo de la
izquierda de la imagen y la lateral lejana es la de arriba. `puntos` es opcional (cualquier punto
de la cancha cuya posición conozcas).

Qué tan buena queda:

- **4 líneas, o 3 líneas + 1 punto conocido**: la homografía queda determinada (exacta salvo los clics).
- **Solo 3 líneas** (las dos laterales + una de gol, lo típico con zoom): faltan 2 grados de libertad.
  Se completan con la geometría de la cámara (pinhole) y la estatura de los jugadores (~1,78 m),
  usando además los cuadros de la misma toma ±1,5 s (la cámara panea y cambia el zoom, y cada
  cuadro aporta otra restricción). Control contra la calibración de 4 líneas en la toma amplia de
  T Slash, simulando los clics:

  | cuadro | 1 cuadro: error mediano | varios cuadros: error mediano (máx.) |
  |---|---|---|
  | 0:10 | 6,9 m | 0,9 m (1,0) |
  | 0:11 | 2,4 m | 1,9 m (2,6) |
  | 0:12 | 4,1 m | 1,2 m (2,3) |
  | 0:13 | 1,7 m | 1,6 m (1,9) |

  La incertidumbre que se declara tiene un piso empírico de ±2,5 m (varios cuadros) o ±6 m (uno
  solo); va en `notas`, en `reporte.md` (columna `± m`) y en cada paso afectado.
- Desde el cuadro marcado se propaga con el movimiento de cámara mientras se vean líneas; cuando la
  cámara hace zoom sin líneas, la confianza decae y esos cuadros se descartan.

## Validador

```powershell
.venv\Scripts\python validar_formato.py ..\..\docs\ejemplo-jugadas.json out\t-slash.json
```

Reporta errores (lo que la app descartaría o cambiaría al importar) y avisos (lo que acepta pero
probablemente no es lo que se quería, como un jugador fuera de la cancha).

## Limitaciones conocidas

- Precisión típica de ±1-3 m cuando se ven líneas en dos direcciones; peor con mucho zoom, donde
  la homografía se arrastra desde otro cuadro.
- Dos jugadores del mismo equipo que se cruzan pueden intercambiar ids. Revísalo en las imágenes
  de verificación.
- El color de camiseta falla con sombras fuertes o camisetas parecidas (árbitros/observadores).
- El disco mide pocos píxeles: se detecta a veces cuando está en la mano, casi nunca en vuelo.
- Los tiempos automáticos de los pasos son una heurística sobre la velocidad del cortador.
- **Tomas cerradas (zoom)**: no se calibran solas. Con `marcar_lineas.py` se pueden usar, con la
  precisión de la sección anterior. Se probaron y descartaron dos métodos automáticos: la
  continuidad de jugadores en el corte (el encadenado por optical flow deriva durante el zoom y las
  soluciones que mejor cierran el corte invierten la perspectiva) y pinhole + estatura sin líneas
  marcadas (con la asignación de líneas automática erró 10–32 m sin reconocerlo).
- Asume cancha de 100 × 37 m con zonas de 18 m (WFDF/USAU). Con otras medidas habría que
  cambiar `LINEAS` en `cancha.py`.
- Solo CPU: unos 2-4 minutos para un tramo de 15 s.
