"""Marca a mano las líneas de la cancha en un cuadro del video y guarda un JSON de calibración.

Uso:
  python marcar_lineas.py --video out/cache/q58SO7VeE5U_20-160.mp4 --t 00:00.5 --salida calib_cerrada.json
  (o --url ... --inicio 00:02 --fin 00:16, y --t es el tiempo del VIDEO ORIGINAL)

Ventana:
  1..7       elige la línea que vas a marcar (ver la lista en pantalla)
  clic izq.  agrega un punto a esa línea (2 o más puntos por línea, lo más separados posible)
  clic der.  borra el último punto de esa línea
  , / .      cuadro anterior / siguiente (0.1 s)   — las marcas se borran al cambiar de cuadro
  o          la cámara está en la lateral opuesta (alterna)
  v          verificar: resuelve y dibuja la cancha completa encima (con la incertidumbre)
  s          guardar y salir        q / Esc   salir sin guardar

Convención: x = 0 es el fondo que queda a la IZQUIERDA de la imagen; "lejana" es la lateral de arriba.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import cv2
import numpy as np

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))

import cancha  # noqa: E402
import manual  # noqa: E402
from descarga import a_segundos, descargar_tramo  # noqa: E402

TECLAS = list(manual.LINEAS_MANUALES)  # 1..7
COLORES = [(0, 200, 255), (0, 255, 0), (255, 0, 255), (255, 128, 0), (0, 0, 255), (255, 255, 0), (128, 128, 255)]
ANCHO_VENTANA = 1600


def fmt(s: float) -> str:
    m, s = divmod(max(0.0, s), 60)
    return f"{int(m):02d}:{s:04.1f}"


def leer(cap, t: float) -> np.ndarray | None:
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    cap.set(cv2.CAP_PROP_POS_FRAMES, int(round(t * fps)))
    ok, img = cap.read()
    return img if ok else None


def personas(img: np.ndarray, modelo_ruta: str) -> list:
    from ultralytics import YOLO

    r = YOLO(modelo_ruta).predict(img, imgsz=1920, conf=0.3, classes=[0], verbose=False)[0]
    return [tuple(map(float, b)) for b in r.boxes.xyxy.cpu().numpy()]


def dibujar(img, marcas: dict, activa: int, t_video: float, opuesta: bool, resultado=None, error: str = "") -> np.ndarray:
    v = img.copy()
    if resultado is not None:
        v = cancha.dibujar_modelo(v, resultado.H, (0, 255, 255), 2)
    for i, nombre in enumerate(TECLAS):
        pts = marcas.get(nombre, [])
        for p in pts:
            cv2.circle(v, tuple(int(c) for c in p), 6, COLORES[i], -1)
        if len(pts) >= 2:
            l = manual.recta_de_puntos(pts)
            a, b, c = l
            h, w = v.shape[:2]
            if abs(b) > abs(a):
                p1, p2 = (0, int(-c / b)), (w, int(-(a * w + c) / b))
            else:
                p1, p2 = (int(-c / a), 0), (int(-(b * h + c) / a), h)
            cv2.line(v, p1, p2, COLORES[i], 1, cv2.LINE_AA)
    escala = ANCHO_VENTANA / v.shape[1]
    v = cv2.resize(v, (ANCHO_VENTANA, int(v.shape[0] * escala)))
    y = 26
    cv2.rectangle(v, (0, 0), (430, 30 + 24 * (len(TECLAS) + 4)), (0, 0, 0), -1)
    cv2.putText(v, f"t = {fmt(t_video)}   camara {'OPUESTA' if opuesta else 'normal'}", (8, y), 0, 0.6, (255, 255, 255), 1)
    for i, nombre in enumerate(TECLAS):
        y += 24
        n = len(marcas.get(nombre, []))
        txt = f"{i + 1} {nombre} ({n})" + ("  <" if i == activa else "")
        cv2.putText(v, txt, (8, y), 0, 0.6, COLORES[i], 2 if i == activa else 1)
    y += 30
    if resultado is not None:
        cv2.putText(v, f"+/- {resultado.incertidumbre_m:.1f} m ({resultado.metodo})", (8, y), 0, 0.55, (0, 255, 255), 1)
    if error:
        cv2.putText(v, error[:60], (8, y + 24), 0, 0.5, (0, 0, 255), 1)
    return v


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--video", type=Path, help="video local (por ejemplo el tramo en out/cache)")
    ap.add_argument("--url")
    ap.add_argument("--inicio", help="con --url: inicio del tramo descargado (mm:ss)")
    ap.add_argument("--fin", help="con --url: fin del tramo descargado (mm:ss)")
    ap.add_argument("--t", required=True, help="tiempo del cuadro a marcar (del video original si usas --url)")
    ap.add_argument("--salida", type=Path, required=True)
    ap.add_argument("--modelo", default=str(AQUI / "modelos" / "yolo11s.pt"))
    args = ap.parse_args(argv)

    offset = 0.0
    if args.url:
        if not (args.inicio and args.fin):
            ap.error("--url necesita --inicio y --fin (los mismos que usarás en video_a_jugadas.py)")
        import video_a_jugadas as vj
        t_ini, t_fin = a_segundos(args.inicio), a_segundos(args.fin)
        video = Path("out") / "cache" / f"{vj.id_youtube(args.url)}_{int(t_ini * 10)}-{int(t_fin * 10)}.mp4"
        descargar_tramo(args.url, args.inicio, args.fin, video, AQUI / ".bin")
        offset = t_ini
    elif args.video:
        video = args.video
    else:
        ap.error("usa --video o --url")
    cap = cv2.VideoCapture(str(video))
    t = a_segundos(args.t) - offset
    img = leer(cap, t)
    if img is None:
        print("no se pudo leer ese cuadro")
        return 1
    marcas: dict[str, list] = {}
    activa, opuesta, resultado, error = 0, False, None, ""
    cajas = None
    escala = ANCHO_VENTANA / img.shape[1]

    def al_clic(evento, x, y, flags, _):
        nonlocal resultado
        nombre = TECLAS[activa]
        if evento == cv2.EVENT_LBUTTONDOWN:
            marcas.setdefault(nombre, []).append([x / escala, y / escala])
            resultado = None
        elif evento == cv2.EVENT_RBUTTONDOWN and marcas.get(nombre):
            marcas[nombre].pop()
            resultado = None

    cv2.namedWindow("marcar lineas", cv2.WINDOW_AUTOSIZE)
    cv2.setMouseCallback("marcar lineas", al_clic)
    while True:
        cv2.imshow("marcar lineas", dibujar(img, marcas, activa, t + offset, opuesta, resultado, error))
        k = cv2.waitKey(30) & 0xFF
        if k in (ord("q"), 27):
            return 1
        if ord("1") <= k <= ord(str(len(TECLAS))):
            activa = k - ord("1")
        elif k in (ord(","), ord(".")):
            t = max(0.0, t + (0.1 if k == ord(".") else -0.1))
            nuevo = leer(cap, t)
            if nuevo is not None:
                img, marcas, resultado, cajas, error = nuevo, {}, None, None, ""
        elif k == ord("o"):
            opuesta, resultado = not opuesta, None
        elif k in (ord("v"), ord("s")):
            datos = {"t": fmt(t + offset), "lineas": {n: p for n, p in marcas.items() if len(p) >= 2},
                     "camara_opuesta": opuesta}
            try:
                if cajas is None:
                    cajas = personas(img, args.modelo)
                resultado = manual.resolver(datos, img.shape[1], img.shape[0], cajas)
                error = ""
            except ValueError as e:
                resultado, error = None, str(e)
                print("No se puede resolver:", e)
            if k == ord("s") and resultado is not None:
                args.salida.write_text(json.dumps(datos, ensure_ascii=False, indent=1), encoding="utf-8")
                print(f"Guardado {args.salida}: {resultado.explicacion()}")
                return 0


if __name__ == "__main__":
    sys.exit(main())
