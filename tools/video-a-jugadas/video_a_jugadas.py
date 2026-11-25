"""Convierte una jugada de un video de ultimate en un JSON importable en Pizarra Ultimate.

Ejemplo:
  python video_a_jugadas.py --url https://www.youtube.com/watch?v=q58SO7VeE5U \
      --inicio 00:02 --fin 00:16 --nombre "T Slash" --salida out/

Las posiciones son APROXIMADAS (homografía estimada desde las líneas de la cancha y detección
automática de jugadores). Todo lo dudoso queda marcado en "notas" y en el reporte de confianza
para corregirlo a mano en el editor.
"""
from __future__ import annotations

import argparse
import json
import math
import re
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))

import cancha  # noqa: E402
import manual  # noqa: E402
from descarga import a_segundos, descargar_tramo  # noqa: E402
from jugada import ANCHO, LARGO, PasoCrudo, Posicion, archivo, construir_jugada, reflejar  # noqa: E402
from rastreo import Det, Rastreador, posicion_en  # noqa: E402
from validar_formato import validar  # noqa: E402
from scipy.optimize import linear_sum_assignment  # noqa: E402

ANCHO_TRABAJO = 1280  # la homografía se calcula a esta resolución (más rápido, suficiente)
NOMBRES_PASO = ["formación inicial", "arranque del corte", "pase", "recepción"]


# ----------------------------------------------------------------------------- utilidades

def fmt_t(s: float) -> str:
    m, s = divmod(max(0.0, s), 60)
    return f"{int(m):02d}:{s:04.1f}"


def slug(s: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s.lower()).strip("-")
    return s or "jugada"


def id_youtube(url: str) -> str:
    m = re.search(r"(?:v=|youtu\.be/|shorts/)([\w-]{6,})", url)
    return m.group(1) if m else slug(url)[-20:]


@dataclass
class Cuadro:
    idx: int  # índice de cuadro en el clip
    t: float  # segundos desde el inicio del clip
    gris: np.ndarray  # a ANCHO_TRABAJO
    jpg: bytes  # cuadro original comprimido (para las imágenes de verificación)


# ----------------------------------------------------------------------------- 1. tomas

def detectar_tomas(video: Path) -> list[tuple[float, float]]:
    from scenedetect import AdaptiveDetector, ContentDetector, detect

    cortes = set()
    for det in (ContentDetector(threshold=22), AdaptiveDetector()):
        for a, b in detect(str(video), det):
            cortes.add(round(_segundos(a), 2))
            cortes.add(round(_segundos(b), 2))
    cap = cv2.VideoCapture(str(video))
    dur = cap.get(cv2.CAP_PROP_FRAME_COUNT) / (cap.get(cv2.CAP_PROP_FPS) or 30)
    cortes |= {0.0, round(dur, 2)}
    c = sorted(cortes)
    # Fusiona cortes casi simultáneos (los dos detectores marcan el mismo corte).
    limpio = [c[0]]
    for v in c[1:]:
        if v - limpio[-1] > 0.25:
            limpio.append(v)
    limpio[-1] = round(dur, 2)
    # Un zoom o paneo rápido puede parecer corte. Si el fondo sigue siendo continuo (optical flow
    # con muchos inliers entre cuadros consecutivos alrededor del corte), no es un corte real.
    reales = [limpio[0]] + [c for c in limpio[1:-1] if not _continuo(cap, c)] + [limpio[-1]]
    return [(a, b) for a, b in zip(reales[:-1], reales[1:]) if b - a > 0.3]


def _segundos(tc) -> float:
    s = getattr(tc, "seconds", None)
    return float(s) if s is not None and not callable(s) else float(tc.get_seconds())


def _continuo(cap: cv2.VideoCapture, t: float) -> bool:
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    i = int(round(t * fps))
    cap.set(cv2.CAP_PROP_POS_FRAMES, max(0, i - 3))
    grises = []
    for _ in range(6):
        ok, img = cap.read()
        if not ok:
            break
        grises.append(cv2.cvtColor(cv2.resize(img, (640, 360)), cv2.COLOR_BGR2GRAY))
    peor = 1.0
    for a, b in zip(grises[:-1], grises[1:]):
        p0 = cv2.goodFeaturesToTrack(a, 400, 0.01, 8)
        if p0 is None or len(p0) < 20:
            return False
        p1, st, _ = cv2.calcOpticalFlowPyrLK(a, b, p0, None)
        ok = st.ravel() == 1
        if ok.sum() < 20:
            return False
        _, inl = cv2.findHomography(p0[ok], p1[ok], cv2.RANSAC, 2.0)
        peor = min(peor, float(inl.mean()) * ok.mean() if inl is not None else 0.0)
    return peor >= 0.5


# ----------------------------------------------------------------------------- 2. lectura

def leer_cuadros(video: Path, a: float, b: float, fps_analisis: float):
    cap = cv2.VideoCapture(str(video))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    paso = max(1, round(fps / fps_analisis))
    i0, i1 = int(a * fps), int(b * fps)
    cap.set(cv2.CAP_PROP_POS_FRAMES, i0)
    for i in range(i0, i1):
        ok, img = cap.read()
        if not ok:
            break
        if (i - i0) % paso == 0:
            yield i, i / fps, img


def mascara_rotulos(grises: list[np.ndarray]) -> np.ndarray:
    """Rótulos fijos (marcador, título): píxeles que no cambian mientras la cámara se mueve."""
    if len(grises) < 8:
        return np.zeros_like(grises[0])
    pila = np.stack([cv2.resize(g, (320, 180)).astype(np.float32) for g in grises[:: max(1, len(grises) // 40)]])
    quieto = (pila.std(0) < 3.0).astype(np.uint8) * 255
    quieto = cv2.morphologyEx(quieto, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    quieto = cv2.dilate(quieto, np.ones((5, 5), np.uint8))
    # Si la cámara casi no se movió, todo parece quieto: no enmascarar.
    if quieto.mean() / 255 > 0.5:
        return np.zeros_like(grises[0])
    return cv2.resize(quieto, grises[0].shape[::-1], interpolation=cv2.INTER_NEAREST)


# ----------------------------------------------------------------------------- 3. homografía

def preparar_toma(cuadros: list[Cuadro], cajas_por_cuadro: list[list], rotulos: np.ndarray, escala: float):
    """Máscaras de líneas y movimiento de cámara cuadro a cuadro (píxeles de trabajo)."""
    mascaras, M, calidad = [], [], []
    mov = cancha.MovimientoCamara()
    for c, cajas in zip(cuadros, cajas_por_cuadro):
        cj = [tuple(v * escala for v in caja) for caja in cajas]
        m = cancha.mascara_lineas(_color_trabajo(c), cj)
        m[rotulos > 0] = 0
        mascaras.append(m)
        mm, q = mov.paso(_color_trabajo(c), cj)
        M.append(mm)
        calidad.append(q)
    return mascaras, M, calidad


def homografias(cuadros: list[Cuadro], mascaras: list, M: list, calidad: list, cajas_por_cuadro: list[list],
                escala: float, log, ancla: tuple | None = None):
    """(H, confianza, motivo, incertidumbre en m) por cuadro. H en píxeles de trabajo.

    `ancla` = (k, H, confianza máxima, incertidumbre, etiqueta) viene de una calibración manual; sin
    ella se buscan anclas automáticas (4 líneas). Desde el ancla se propaga con el movimiento de cámara
    y se refina contra las líneas en cada cuadro.
    """
    n = len(cuadros)
    anclas: dict[int, cancha.Ajuste] = {}
    if ancla is None:
        for k in range(0, n, max(1, n // 30)):
            pies = np.array([[(c[0] + c[2]) / 2 * escala, c[3] * escala] for c in cajas_por_cuadro[k]]) if cajas_por_cuadro[k] else None
            aj = cancha.calibrar_auto(mascaras[k], pies)
            if aj is not None and aj.confianza >= 0.45:
                anclas[k] = aj
        if anclas:
            log("[cancha] anclas automáticas: " + ", ".join(f"t={cuadros[k].t:.1f}s ({a.confianza:.2f})" for k, a in sorted(anclas.items())))
        if not anclas:
            return [None] * n, [0.0] * n, ["sin calibración"] * n, [99.0] * n
        k0 = max(anclas, key=lambda k: anclas[k].confianza)
        H0, conf0, conf_max, inc0, etiqueta = anclas[k0].H, anclas[k0].confianza, 1.0, 1.0, "líneas"
    else:
        k0, H0, conf_max, inc0, etiqueta = ancla
        conf0 = conf_max

    H: list = [None] * n
    conf, motivo, inc = [0.0] * n, [""] * n, [99.0] * n
    H[k0], conf[k0], motivo[k0], inc[k0] = H0, conf0, ("ancla" if ancla is None else etiqueta), inc0

    def propagar(orden, sentido):
        prev = k0
        for k in orden:
            if sentido > 0:
                m, q = M[k], calidad[k]  # lleva cuadro k-1 -> k
            else:
                m = np.linalg.inv(M[prev]) if M[prev] is not None else None  # k+1 -> k
                q = calidad[prev]
            if m is None or H[prev] is None:
                H[k], conf[k], motivo[k], inc[k] = H[prev], conf[prev] * 0.5, "sin movimiento de cámara", inc[prev] + 1.0
                prev = k
                continue
            pred = m @ H[prev]
            pred /= pred[2, 2]
            if k in anclas and anclas[k].confianza > 0.6:
                aj = anclas[k]
            else:
                aj = cancha.refinar(pred, mascaras[k])
            # Con ancla manual basta con que las líneas visibles calcen (precisión); la cobertura falla con
            # líneas tenues o con público alrededor, y la confianza ya está topada por la calibración manual.
            calza = aj.confianza >= 0.45 if ancla is None else aj.sobre_linea >= 0.5
            if aj.direcciones == 2 and calza:
                H[k], conf[k], inc[k] = aj.H, (min(conf_max, aj.confianza) if ancla is None else conf_max), inc0
                motivo[k] = "líneas" if ancla is None else f"{etiqueta} + líneas"
            else:
                # Sin líneas en dos direcciones: solo el arrastre del movimiento de cámara (se degrada).
                H[k] = pred
                conf[k] = conf[prev] * (0.985 if q > 0.6 else 0.9)
                inc[k] = inc[prev] + 0.15
                motivo[k] = "arrastre (pocas líneas visibles)"
            prev = k

    propagar(range(k0 + 1, n), +1)
    propagar(range(k0 - 1, -1, -1), -1)
    return H, conf, motivo, inc


def ancla_manual(datos: dict, cuadros: list[Cuadro], cajas_por_cuadro: list[list], M: list, rotulos: np.ndarray,
                 escala: float, dt: float, log):
    """Resuelve una calibración manual (manual.py) y la devuelve como ancla para `homografias`.

    Además del cuadro marcado, usa otros cuadros de la misma toma (±1,5 s, encadenados por el
    movimiento de cámara) para fijar mejor la escala cuando solo hay 3 líneas.
    """
    k = min(range(len(cuadros)), key=lambda i: abs(cuadros[i].t - datos["_t"]))
    img = cv2.imdecode(np.frombuffer(cuadros[k].jpg, np.uint8), cv2.IMREAD_COLOR)
    h, w = img.shape[:2]
    S = np.diag([escala, escala, 1.0])
    A = [np.eye(3)]
    for j in range(1, len(M)):
        A.append((M[j] if M[j] is not None else np.eye(3)) @ A[-1])
    extra = []
    for j in range(len(cuadros)):
        if j != k and abs(j - k) * dt <= 1.5 and (j - k) % 3 == 0:
            G = np.linalg.inv(S) @ (A[j] @ np.linalg.inv(A[k])) @ S
            extra.append((G, cajas_por_cuadro[j]))
    excluir = cv2.resize(rotulos, (w, h), interpolation=cv2.INTER_NEAREST)
    r = manual.resolver(datos, w, h, cajas_por_cuadro[k], excluir, extra)
    log(f"[cancha] {datos['_ruta']} (t={cuadros[k].t:.1f}s del clip): {r.explicacion()}")
    # Confianza: suficiente para usar el cuadro, pero nunca tan alta como 4 líneas vistas.
    conf_max = 0.6 if r.incertidumbre_m <= 3.0 else 0.45
    return (k, S @ r.H, conf_max, r.incertidumbre_m, f"manual ±{r.incertidumbre_m:.1f} m"), r


_COLOR_CACHE: dict[int, np.ndarray] = {}


def _color_trabajo(c: Cuadro) -> np.ndarray:
    if c.idx not in _COLOR_CACHE:
        img = cv2.imdecode(np.frombuffer(c.jpg, np.uint8), cv2.IMREAD_COLOR)
        h = round(img.shape[0] * ANCHO_TRABAJO / img.shape[1])
        _COLOR_CACHE.clear() if len(_COLOR_CACHE) > 4 else None
        _COLOR_CACHE[c.idx] = cv2.resize(img, (ANCHO_TRABAJO, h), interpolation=cv2.INTER_AREA)
    return _COLOR_CACHE[c.idx]


# ----------------------------------------------------------------------------- 4. disco

def poseedor_en(k: int, discos: dict, atacantes: dict, ventana: int):
    """Atacante que tiene el disco cerca del cuadro k, según detecciones 'frisbee' de YOLO.

    `atacantes` = {id final: Jugador}. Solo cuenta un disco dentro de la caja (ensanchada) de un
    atacante visto en ese cuadro, por encima de las rodillas: así se descartan los carteles
    redondos de patrocinio y los discos de calentamiento fuera de la cancha.
    """
    votos = defaultdict(float)
    for j in range(k - ventana, k + ventana + 1):
        for (cx, cy, cf) in discos.get(j, []):
            for jid, jug in atacantes.items():
                h = jug.hist.get(j)
                if not h or not h[2] or h[3] is None:
                    continue
                x1, y1, x2, y2 = h[3]
                w, hh = x2 - x1, y2 - y1
                if x1 - 0.45 * w <= cx <= x2 + 0.45 * w and y1 - 0.1 * hh <= cy <= y1 + 0.75 * hh:
                    votos[jid] += cf
    if not votos:
        return None, 0.0
    jid = max(votos, key=votos.get)
    total = sum(votos.values())
    return jid, votos[jid] / total * min(1.0, votos[jid] / 0.3)



# ----------------------------------------------------------------------------- 6. dibujo

def dibujar_verificacion(img: np.ndarray, H_orig: np.ndarray | None, marcas: list, titulo: str,
                         paso: PasoCrudo, siguiente: PasoCrudo | None) -> np.ndarray:
    v = img.copy()
    if H_orig is not None:
        v = cancha.dibujar_modelo(v, H_orig, (0, 220, 255), 2)
    for (jid, caja, estimada, xy_img) in marcas:
        col = (255, 255, 255) if jid.startswith("a") else (40, 40, 230)
        if caja is not None:
            x1, y1, x2, y2 = map(int, caja)
            cv2.rectangle(v, (x1, y1), (x2, y2), col, 2)
        if xy_img is not None and np.isfinite(xy_img).all() and abs(xy_img).max() < 1e5:
            p = tuple(int(c) for c in xy_img)
            cv2.circle(v, p, 7, (0, 200, 255) if estimada else col, -1 if not estimada else 2)
            cv2.putText(v, jid + ("?" if estimada else ""), (p[0] + 8, p[1] + 22), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 4)
            cv2.putText(v, jid + ("?" if estimada else ""), (p[0] + 8, p[1] + 22), cv2.FONT_HERSHEY_SIMPLEX, 0.8, col, 2)
    cv2.rectangle(v, (0, 0), (v.shape[1], 44), (0, 0, 0), -1)
    cv2.putText(v, titulo, (12, 31), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)
    # Diagrama de la cancha (dirección final: el ataque anota a la derecha).
    W = v.shape[1]
    s = (W - 40) / LARGO
    Hd = int(ANCHO * s) + 40
    d = np.full((Hd, W, 3), (70, 140, 60), np.uint8)
    o = (20, 20)
    P = lambda x, y: (int(o[0] + x * s), int(o[1] + y * s))  # noqa: E731
    cv2.rectangle(d, P(0, 0), P(LARGO, ANCHO), (255, 255, 255), 2)
    for x in (18, 82):
        cv2.line(d, P(x, 0), P(x, ANCHO), (255, 255, 255), 2)
    if siguiente is not None:
        for jid, a in paso.posiciones.items():
            b = siguiente.posiciones.get(jid)
            if b is not None and math.hypot(b.x - a.x, b.y - a.y) >= 2:
                cv2.arrowedLine(d, P(a.x, a.y), P(b.x, b.y), (230, 230, 230) if jid[0] == "a" else (60, 60, 200), 2, tipLength=0.04)
    for jid, pz in paso.posiciones.items():
        col = (255, 255, 255) if jid[0] == "a" else (40, 40, 230)
        c = P(pz.x, pz.y)
        if jid[0] == "a":
            cv2.circle(d, c, 12, col, -1 if not pz.estimada else 2)
        else:
            tri = np.array([[c[0], c[1] - 13], [c[0] - 12, c[1] + 9], [c[0] + 12, c[1] + 9]])
            cv2.fillPoly(d, [tri], col) if not pz.estimada else cv2.polylines(d, [tri], True, col, 2)
        cv2.putText(d, jid[1:], (c[0] - 6, c[1] + 6), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 2)
    if paso.poseedor and paso.poseedor in paso.posiciones:
        pz = paso.posiciones[paso.poseedor]
        cv2.circle(d, P(pz.x + 0.95, pz.y - 0.95), 6, (0, 230, 255), -1)
    cv2.putText(d, "ataque -> (hueco = posición estimada, no vista)", (20, Hd - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
    return np.vstack([v, d])


# ----------------------------------------------------------------------------- principal

def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    fuente = ap.add_mutually_exclusive_group(required=True)
    fuente.add_argument("--url", help="URL del video (YouTube, etc.)")
    fuente.add_argument("--video", type=Path, help="archivo de video local")
    ap.add_argument("--inicio", required=True, help="inicio del tramo, mm:ss")
    ap.add_argument("--fin", required=True, help="fin del tramo, mm:ss")
    ap.add_argument("--nombre", required=True, help='nombre de la jugada, p. ej. "T Slash"')
    ap.add_argument("--salida", type=Path, default=Path("out"))
    ap.add_argument("--equipo-ataque", default="blanco", choices=["blanco", "oscuro"],
                    help="color del equipo atacante (por defecto blanco = Revolver)")
    ap.add_argument("--atacante", default="Revolver", help="nombre del equipo atacante (etiqueta)")
    ap.add_argument("--ataca", default="auto", choices=["auto", "izquierda", "derecha"],
                    help="hacia dónde ataca en el video; si es izquierda se refleja x→100−x, y→37−y")
    ap.add_argument("--tiempos", help="tiempos de los pasos en el video (mm:ss,mm:ss,...) en vez de detectarlos")
    ap.add_argument("--pasos", type=int, default=4, choices=[3, 4])
    ap.add_argument("--fps-analisis", type=float, default=10.0)
    ap.add_argument("--modelo", default=str(AQUI / "modelos" / "yolo11s.pt"))
    ap.add_argument("--imgsz", type=int, default=1920)
    ap.add_argument("--conf-min", type=float, default=0.4, help="confianza mínima de homografía para usar un cuadro")
    ap.add_argument("--calibracion", type=Path, action="append",
                    help="JSON de calibración manual (marcar_lineas.py); se puede repetir, uno por toma")
    ap.add_argument("--credito", default="Crédito del video: Ultiworld / Flatball Club. Uso personal.")
    args = ap.parse_args(argv)

    salida: Path = args.salida
    salida.mkdir(parents=True, exist_ok=True)
    (salida / "verificacion").mkdir(exist_ok=True)
    bitacora: list[str] = []

    def log(msg: str):
        print(msg, flush=True)
        bitacora.append(msg)

    t_ini, t_fin = a_segundos(args.inicio), a_segundos(args.fin)
    if args.url:
        vid = id_youtube(args.url)
        clip = salida / "cache" / f"{vid}_{int(t_ini * 10)}-{int(t_fin * 10)}.mp4"
        descargar_tramo(args.url, args.inicio, args.fin, clip, AQUI / ".bin")
        offset, fuente = t_ini, args.url
    else:
        clip, offset, fuente = args.video, 0.0, str(args.video)
    log(f"[video] {clip}")

    # ---- 1. tomas: la amplia más larga + las que tengan calibración manual
    from seguimiento import CLASE_FRISBEE, CLASE_PERSONA, color_camiseta
    from ultralytics import YOLO

    tomas = detectar_tomas(clip)
    if args.video:  # tramo dentro de un archivo largo
        tomas = [(max(a, t_ini), min(b, t_fin)) for a, b in tomas if b > t_ini and a < t_fin]
    log("[tomas] " + ", ".join(f"{fmt_t(a + offset)}–{fmt_t(b + offset)}" for a, b in tomas))
    modelo = YOLO(args.modelo)
    calibs = []
    for ruta in args.calibracion or []:
        d = json.loads(Path(ruta).read_text(encoding="utf-8"))
        if "imagen" in d and "cancha" in d and "puntos" not in d:  # formato anterior: solo puntos
            d["puntos"] = [{"imagen": i, "cancha": c} for i, c in zip(d["imagen"], d["cancha"])]
        d["_t"] = (a_segundos(d["t"]) if isinstance(d["t"], str) else float(d["t"])) - offset
        d["_ruta"] = Path(ruta).name
        calibs.append(d)
    elegidas: dict[tuple, dict | None] = {}
    for d in calibs:
        toma = next(((x, y) for x, y in tomas if x - 0.05 <= d["_t"] < y), None)
        if toma is None:
            log(f"[tomas] AVISO: la calibración {d['_ruta']} (t={fmt_t(d['_t'] + offset)}) cae fuera del tramo")
        else:
            elegidas[toma] = d
    amplias = []
    for a, b in tomas:
        if (a, b) in elegidas:
            continue
        alturas, cuenta = [], []
        muestra = list(leer_cuadros(clip, a, b, 2.0))
        for _, _, img in muestra[:: max(1, len(muestra) // 5)]:
            r = modelo.predict(img, imgsz=args.imgsz, conf=0.3, classes=[CLASE_PERSONA], verbose=False)[0]
            hs = (r.boxes.xyxy[:, 3] - r.boxes.xyxy[:, 1]).cpu().numpy() / img.shape[0]
            alturas += list(hs)
            cuenta.append(len(hs))
        med = float(np.median(alturas)) if alturas else 1.0
        amplia = bool(alturas) and med < 0.2 and np.median(cuenta) >= 6
        log(f"[tomas] {fmt_t(a + offset)}–{fmt_t(b + offset)}: {'AMPLIA' if amplia else 'primer plano / descartada'} "
            f"(altura mediana de persona {med:.2f} del cuadro, {np.median(cuenta) if cuenta else 0:.0f} personas)")
        if amplia:
            amplias.append((a, b))
    if amplias:
        principal = max(amplias, key=lambda ab: ab[1] - ab[0])
        elegidas.setdefault(principal, None)
        if len(amplias) > 1:
            log(f"[tomas] se usa la toma amplia más larga: {fmt_t(principal[0] + offset)}–{fmt_t(principal[1] + offset)}")
    if not elegidas:
        log("ERROR: no hay ninguna toma amplia en el tramo (y ninguna calibración manual).")
        _guardar_bitacora(salida, bitacora)
        return 1
    tramos = sorted(elegidas)
    for x, y in tramos:
        log(f"[tomas] se procesa {fmt_t(x + offset)}–{fmt_t(y + offset)}"
            + (f" con calibración manual ({elegidas[(x, y)]['_ruta']})" if elegidas[(x, y)] else " (calibración automática)"))
    primero = tramos[0][0]
    notas_tomas = [f"El tramo {fmt_t(x + offset)}–{fmt_t(y + offset)} no se usó (otra toma: primer plano, otra cámara "
                   f"o corte)" + ("; si la jugada empieza ahí, los pasos no la incluyen: marcar sus líneas con "
                                  "marcar_lineas.py o dibujarla a mano." if y <= primero + 0.05 else ".")
                   for x, y in tomas if (x, y) not in elegidas]

    # ---- 2 y 3. por toma: detección (YOLO, sin tracker) y homografía por cuadro
    cuadros: list[Cuadro] = []
    personas: dict[int, list] = defaultdict(list)  # k -> [(caja, conf, color)]
    discos: dict[int, list] = defaultdict(list)  # k -> [(cx, cy, conf)]
    Hs, confs, motivos, incert, toma_de = [], [], [], [], []
    calib_manuales = {}
    escala = None
    dt = 1.0 / args.fps_analisis
    log(f"[yolo] detectando personas y disco a {args.fps_analisis:g} cuadros/s (CPU, puede tardar)…")
    for nt, (a, b) in enumerate(tramos):
        k_ini = len(cuadros)
        for i, t, img in leer_cuadros(clip, a, b, args.fps_analisis):
            k = len(cuadros)
            if escala is None:
                escala = ANCHO_TRABAJO / img.shape[1]
            h_tr = round(img.shape[0] * escala)
            gris = cv2.cvtColor(cv2.resize(img, (ANCHO_TRABAJO, h_tr), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY)
            cuadros.append(Cuadro(i, t, gris, cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 92])[1].tobytes()))
            r = modelo.predict(img, imgsz=args.imgsz, conf=0.05, classes=[CLASE_PERSONA, CLASE_FRISBEE], verbose=False)[0]
            for caja, c, cf in zip(r.boxes.xyxy.cpu().numpy(), r.boxes.cls.cpu().numpy().astype(int), r.boxes.conf.cpu().numpy()):
                if c == CLASE_FRISBEE:
                    x1, y1, x2, y2 = caja
                    discos[k].append(((x1 + x2) / 2, (y1 + y2) / 2, float(cf)))
                elif cf >= 0.3:
                    personas[k].append((tuple(map(float, caja)), float(cf), color_camiseta(img, caja)[0]))
            if k % 20 == 0:
                log(f"  cuadro {k} (t={fmt_t(t + offset)})")
        cs = cuadros[k_ini:]
        cajas = [[p[0] for p in personas[k]] for k in range(k_ini, len(cuadros))]
        rotulos = mascara_rotulos([c.gris for c in cs])
        mascaras, M, calidad = preparar_toma(cs, cajas, rotulos, escala)
        ancla = None
        if elegidas[(a, b)] is not None:
            try:
                ancla, res = ancla_manual(elegidas[(a, b)], cs, cajas, M, rotulos, escala, dt, log)
                calib_manuales[nt] = res
            except ValueError as e:
                log(f"[cancha] ERROR en la calibración manual {elegidas[(a, b)]['_ruta']}: {e}")
                ancla = None
        H_t, c_t, m_t, i_t = homografias(cs, mascaras, M, calidad, cajas, escala, log, ancla)
        if elegidas[(a, b)] is not None and ancla is None:
            c_t = [0.0] * len(cs)  # calibración manual fallida: no usar esa toma
        Hs += H_t
        confs += c_t
        motivos += m_t
        incert += i_t
        toma_de += [nt] * len(cs)
    n = len(cuadros)
    usables = [c >= args.conf_min for c in confs]
    log(f"[cancha] cuadros usables: {sum(usables)}/{n} (confianza ≥ {args.conf_min}); "
        f"descartados: {', '.join(fmt_t(c.t + offset) for c, u in zip(cuadros, usables) if not u) or 'ninguno'}")
    if not any(usables):
        log("ERROR: no se pudo calibrar la cancha en ningún cuadro. Usa --calibracion (ver README).")
        _guardar_bitacora(salida, bitacora)
        return 1
    S = np.diag([escala, escala, 1.0])
    H_orig = [np.linalg.inv(S) @ H if H is not None else None for H in Hs]  # cancha -> imagen original

    # ---- 4. seguimiento en metros (equipo por color; fuera de la cancha = banca/público)
    rast = Rastreador(args.equipo_ataque, dt, max_por_equipo=10)  # se eligen 7 después
    for k in range(n):
        if not usables[k]:
            rast.paso(k, None)
            continue
        Hi = np.linalg.inv(H_orig[k])
        dets = []
        for caja, cf, color in personas[k]:
            x1, y1, x2, y2 = caja
            p = cancha.proyectar(Hi, np.array([[(x1 + x2) / 2, y2]]))[0]
            if np.isfinite(p).all():
                dets.append(Det(k, (float(p[0]), float(p[1])), caja, cf, color))
        rast.paso(k, dets)
    jugadores, apartados = elegir_siete(rast.jugadores)
    for j in apartados:
        log(f"[jugadores] descartado {j.equipo} #{j.uid}: {j.motivo_descarte}")
    log(f"[jugadores] ataque: {sum(j.equipo == 'ataque' for j in jugadores)}, "
        f"defensa: {sum(j.equipo == 'defensa' for j in jugadores)}")

    # ---- 5. dirección de ataque
    k_us = [k for k in range(n) if usables[k]]
    ataca, duda_direccion, motivo_dir = args.ataca, False, "dada a mano (--ataca)"
    if ataca == "auto":
        ataca, duda_direccion, motivo_dir = deducir_direccion(jugadores, k_us)
        log(f"[dirección] ataca hacia la {ataca}: {motivo_dir}" + (" (DUDOSO)" if duda_direccion else ""))
    reflejo = ataca == "izquierda"

    def final(x, y):
        return reflejar(x, y) if reflejo else (x, y)

    # ---- 6. tiempos de los pasos
    notas_auto: list[str] = list(notas_tomas)
    ventana = max(1, round(0.15 / dt))
    if args.tiempos:
        ts = [a_segundos(t) - offset for t in args.tiempos.split(",")]
        k_pasos = [min(range(n), key=lambda k: abs(cuadros[k].t - t)) for t in ts]
        nombres = NOMBRES_PASO if len(k_pasos) == 4 else [f"paso {i + 1}" for i in range(len(k_pasos))]
        origen_tiempos = "dados a mano (--tiempos)"
    else:
        k_pasos, nombres, origen_tiempos = elegir_pasos(cuadros, usables, jugadores, discos, args.pasos, dt, ventana, log)
    for i, k in enumerate(k_pasos):
        if not usables[k]:
            k2 = min(k_us, key=lambda j: abs(j - k))
            notas_auto.append(f"paso {i + 1}: el cuadro de {fmt_t(cuadros[k].t + offset)} tiene homografía dudosa; "
                              f"se usa {fmt_t(cuadros[k2].t + offset)}")
            k_pasos[i] = k2

    # ---- 7. ids estables: a1..a7 de atrás hacia adelante, dN = defensor que marca a aN
    ata = [j for j in jugadores if j.equipo == "ataque"]
    defe = [j for j in jugadores if j.equipo == "defensa"]
    for eq, lista in (("ataque", ata), ("defensa", defe)):
        if len(lista) < 7:
            notas_auto.append(f"{eq}: solo se identificaron {len(lista)} jugadores (faltan {7 - len(lista)}; agrégalos a mano)")
    pos0 = {}
    for j in ata + defe:
        p = posicion_en(j, k_pasos[0], ventana)
        pos0[j.uid] = final(p[0], p[1]) if p else (50.0, 18.5)
    ids: dict[int, str] = {}
    for i, j in enumerate(sorted(ata, key=lambda j: pos0[j.uid][0])):
        ids[j.uid] = f"a{i + 1}"
    if ata and defe:
        C = np.array([[math.dist(pos0[d.uid], pos0[g.uid]) for g in ata] for d in defe])
        fil, col = linear_sum_assignment(C)
        usados = set()
        for fi, co in zip(fil, col):
            n_at = int(ids[ata[co].uid][1:])
            ids[defe[fi].uid] = f"d{n_at}"
            usados.add(n_at)
        libres = [i for i in range(1, 8) if i not in usados]
        for d in defe:
            if d.uid not in ids:
                ids[d.uid] = f"d{libres.pop(0)}"
    else:
        for i, d in enumerate(defe):
            ids[d.uid] = f"d{i + 1}"
    por_id = {ids[j.uid]: j for j in jugadores}
    atacantes = {jid: j for jid, j in por_id.items() if jid.startswith("a")}

    # ---- 8. posiciones por paso
    pasos: list[PasoCrudo] = []
    cajas_paso: list[dict] = []
    for i, k in enumerate(k_pasos):
        p = PasoCrudo(nombres[i], cuadros[k].t + offset, confianza_homografia=confs[k])
        if incert[k] > 1.5:
            p.notas.append(f"posiciones con incertidumbre ≈ ±{incert[k]:.1f} m ({motivos[k]})")
        cajas = {}
        for jid, j in por_id.items():
            r = posicion_en(j, k, ventana)
            if r is None:
                continue
            x, y = final(r[0], r[1])
            votos = j.votos
            c_eq = max(votos["blanco"], votos["oscuro"]) / max(1, sum(votos.values()))
            p.posiciones[jid] = Posicion(x, y, confianza=confs[k] * (0.4 + 0.6 * c_eq) * (0.5 if r[2] else 1.0), estimada=r[2])
            cajas[jid] = r[3]
            if r[2]:
                p.notas.append(f"{jid}: no se vio en este momento; posición estimada (interpolada o copiada)")
        jid_pos, cpos = poseedor_en(k, discos, atacantes, max(1, round(0.3 / dt)))
        p.poseedor, p.poseedor_confianza = jid_pos, cpos
        if jid_pos is None:
            p.notas.append("disco no detectado: poseedorId nulo")
        pasos.append(p)
        cajas_paso.append(cajas)

    # ---- 9. JSON
    t_txt = f"{fmt_t(t_ini)}–{fmt_t(t_fin)}"
    sin_disco = [str(i + 1) for i, p in enumerate(pasos) if p.poseedor is None]
    estimados = [f"{jid} (paso {i + 1})" for i, p in enumerate(pasos) for jid, pz in sorted(p.posiciones.items()) if pz.estimada]
    notas = [
        f"{args.atacante} — {args.nombre}. Video {fuente}, minuto {t_txt} "
        f"(pasos en {', '.join(fmt_t(p.t_video) for p in pasos)}).",
        args.credito,
        "Generada automáticamente (tools/video-a-jugadas): posiciones APROXIMADAS, ±1-3 m donde se ven líneas en "
        "dos direcciones y peor con zoom. Revisar y corregir a mano en el editor.",
        f"Dirección: en el video ataca hacia la {ataca} ({motivo_dir})"
        + ("; se reflejó (x→100−x, y→37−y) para que anote a la derecha" if reflejo else "")
        + (". DUDOSO: verificar" if duda_direccion else "") + ".",
        f"Tiempos de los pasos: {origen_tiempos}.",
        "Números de etiqueta: a1..a7 ordenados de atrás hacia adelante en el paso 1; cada dN es el defensor más "
        "cercano a aN en el paso 1 (no son los dorsales).",
    ]
    if sin_disco:
        notas.append(f"Disco: no se detectó con seguridad en los pasos {', '.join(sin_disco)}; quedó sin poseedor "
                     "(poseedorId nulo). Asignar a mano.")
    dudosos_disco = [str(i + 1) for i, p in enumerate(pasos) if p.poseedor and p.poseedor_confianza < 0.5]
    if dudosos_disco:
        notas.append(f"Disco: poseedor con poca confianza en los pasos {', '.join(dudosos_disco)}.")
    if estimados:
        notas.append("Posiciones estimadas (no vistas en ese momento): " + ", ".join(estimados) + ".")
    for nt, res in calib_manuales.items():
        x, y = tramos[nt]
        notas.append(f"El tramo {fmt_t(x + offset)}–{fmt_t(y + offset)} se calibró a mano por líneas: {res.explicacion()}.")
    notas += notas_auto
    jug = construir_jugada(
        pasos, id_jugada=f"video-{id_youtube(fuente)}-{int(t_ini)}", nombre=args.nombre,
        etiquetas=[args.atacante, args.nombre], notas="\n".join(notas), categoria="Ataque",
    )
    datos = archivo([jug])
    r = validar(datos)
    ruta_json = salida / f"{slug(args.nombre)}.json"
    ruta_json.write_text(json.dumps(datos, ensure_ascii=False, indent=1), encoding="utf-8")
    log(f"[salida] {ruta_json} — validación: {'OK' if r.ok else 'INVÁLIDO'} ({len(r.errores)} errores, {len(r.avisos)} avisos)")
    for e in r.errores:
        log(f"  ERROR {e}")
    for e in r.avisos:
        log(f"  aviso {e}")

    # ---- 10. verificación: imágenes y reporte
    reporte = []
    for i, (k, p) in enumerate(zip(k_pasos, pasos)):
        img = cv2.imdecode(np.frombuffer(cuadros[k].jpg, np.uint8), cv2.IMREAD_COLOR)
        marcas = []
        for jid, pz in p.posiciones.items():
            xy_video = reflejar(pz.x, pz.y) if reflejo else (pz.x, pz.y)
            xy_img = cancha.proyectar(H_orig[k], np.array([xy_video]))[0] if H_orig[k] is not None else None
            marcas.append((jid, cajas_paso[i].get(jid) if not pz.estimada else None, pz.estimada, xy_img))
        for (cx, cy, cf) in discos.get(k, []):  # solo discos sobre la cancha (no carteles)
            q = cancha.proyectar(np.linalg.inv(H_orig[k]), np.array([[cx, cy]]))[0] if H_orig[k] is not None else None
            if q is not None and np.isfinite(q).all() and 0 <= q[0] <= LARGO and 0 <= q[1] <= ANCHO:
                cv2.circle(img, (int(cx), int(cy)), 14, (0, 230, 255), 2)
        titulo = (f"Paso {i + 1}: {p.nombre} - {fmt_t(p.t_video)} - homografia {confs[k]:.2f} ({motivos[k]})"
                  f" - disco: {p.poseedor or 'no detectado'}")
        v = dibujar_verificacion(img, H_orig[k], marcas, titulo, p, pasos[i + 1] if i + 1 < len(pasos) else None)
        cv2.imwrite(str(salida / "verificacion" / f"paso{i + 1}.jpg"), v, [cv2.IMWRITE_JPEG_QUALITY, 88])
        vistos = sum(1 for pz in p.posiciones.values() if not pz.estimada)
        reporte.append({
            "paso": i + 1, "nombre": p.nombre, "t_video": fmt_t(p.t_video),
            "homografia_confianza": round(confs[k], 2), "homografia_origen": motivos[k], "incertidumbre_m": round(incert[k], 1),
            "jugadores_vistos": vistos, "jugadores_estimados": len(p.posiciones) - vistos,
            "poseedor": p.poseedor, "poseedor_confianza": round(p.poseedor_confianza, 2),
            "confianza_paso": round(_conf_paso(p, confs[k]), 2),
            "jugadores": {jid: {"x": round(pz.x, 1), "y": round(pz.y, 1), "confianza": round(pz.confianza, 2),
                                "estimada": pz.estimada} for jid, pz in sorted(p.posiciones.items())},
            "notas": p.notas,
        })
    serie_conf = [{"t": round(c.t + offset, 2), "confianza": round(cf, 3), "origen": m} for c, cf, m in zip(cuadros, confs, motivos)]
    (salida / "reporte.json").write_text(json.dumps({"pasos": reporte, "homografia_por_cuadro": serie_conf,
                                                     "validacion": {"ok": r.ok, "errores": r.errores, "avisos": r.avisos}},
                                                    ensure_ascii=False, indent=1), encoding="utf-8")
    _reporte_md(salida, args, reporte, notas, confs, usables, cuadros, offset, r)
    _guardar_bitacora(salida, bitacora)
    log(f"[salida] reporte: {salida / 'reporte.md'} · imágenes: {salida / 'verificacion'}")
    return 0 if r.ok else 1


def elegir_siete(jugadores):
    """Hasta 7 por equipo, por actividad. Quien está quieto junto al borde todo el tramo (observadores,
    entrenadores, banca dentro de la línea) no es un jugador de la jugada."""
    elegidos, apartados = [], []
    for eq in ("ataque", "defensa"):
        puntuados = []
        for j in (j for j in jugadores if j.equipo == eq):
            vis = np.array([(h[0], h[1]) for h in j.hist.values() if h[2]])
            if len(vis) < 3:
                j.motivo_descarte = "visto en menos de 3 cuadros"
                apartados.append(j)
                continue
            recorrido = float(np.linalg.norm(vis.max(0) - vis.min(0)))
            med = np.median(vis, 0)
            borde = float(min(med[0], LARGO - med[0], med[1], ANCHO - med[1]))
            quieto_en_borde = borde < 4.0 and recorrido < 3.0
            puntaje = len(vis) * (1 + min(recorrido, 20) / 10) * (0.05 if quieto_en_borde else 1.0)
            if quieto_en_borde:
                j.motivo_descarte = (f"quieto junto al borde (recorrió {recorrido:.1f} m, a {borde:.1f} m del borde); "
                                     "probablemente observador o banca")
            puntuados.append((puntaje, j))
        puntuados.sort(key=lambda p: -p[0])
        for i, (_, j) in enumerate(puntuados):
            if i < 7 and getattr(j, "motivo_descarte", None) is None:
                elegidos.append(j)
            else:
                if getattr(j, "motivo_descarte", None) is None:
                    j.motivo_descarte = "sobra (ya hay 7 más activos)"
                apartados.append(j)
    return elegidos, apartados


def deducir_direccion(jugadores, k_us) -> tuple[str, bool, str]:
    """Hacia dónde ataca el equipo atacante en el video: (lado, dudoso, explicación)."""
    ata = [j for j in jugadores if j.equipo == "ataque"]
    k_a, k_b = k_us[0], k_us[-1]
    dxs, finales = [], []
    for j in ata:
        vistos = sorted(k for k, h in j.hist.items() if h[2] and k_a <= k <= k_b)
        if len(vistos) >= 3:
            dxs.append(j.hist[vistos[-1]][0] - j.hist[vistos[0]][0])
            finales.append(j.hist[vistos[-1]][0])
    media = float(np.mean(dxs)) if dxs else 0.0
    centro = float(np.mean(finales)) if finales else 50.0
    # 1) Avance del ataque; 2) si es poco, la zona de gol a la que está más cerca el ataque al final.
    if abs(media) >= 4:
        lado = "izquierda" if media < 0 else "derecha"
        return lado, False, f"el ataque avanzó {media:+.1f} m en x"
    lado = "izquierda" if centro < 50 else "derecha"
    dudoso = 30 < centro < 70
    return lado, dudoso, (f"el ataque avanzó poco ({media:+.1f} m); termina cerca de la zona "
                          f"{'izquierda' if centro < 50 else 'derecha'} (x media {centro:.0f} m)")


def _conf_paso(p: PasoCrudo, conf_h: float) -> float:
    if not p.posiciones:
        return 0.0
    vistos = np.mean([0.0 if pz.estimada else 1.0 for pz in p.posiciones.values()])
    return float(conf_h * (0.4 + 0.6 * vistos) * (1.0 if p.poseedor else 0.85))


def elegir_pasos(cuadros, usables, jugadores, discos, n_pasos, dt, ventana, log):
    """Formación inicial, arranque del corte, pase, recepción (heurístico).

    - formación: el cuadro usable con más jugadores vistos en el primer segundo;
    - si el disco se ve cambiar de manos (P -> Q): pase = última vez con P, recepción = primera con Q,
      y el cortador es Q;
    - si no: el cortador es el atacante con mayor velocidad sostenida, el pase su pico de velocidad
      y la recepción cuando frena;
    - arranque: el cortador acelera por encima de 3 m/s (último cuadro lento antes de su pico).
    """
    n = len(cuadros)
    k_us = [k for k in range(n) if usables[k]]
    vistos_k = {k: sum(1 for j in jugadores if k in j.hist and j.hist[k][2]) for k in k_us}
    # Formación: el PRIMER cuadro usable con al menos 6 jugadores vistos (lo antes posible, antes de que
    # empiece la acción); si no hay, el que más vea en el primer segundo.
    primeros = [k for k in k_us if k <= k_us[0] + round(1.0 / dt)]
    k0 = next((k for k in primeros if vistos_k[k] >= 6), max(primeros, key=lambda k: (vistos_k[k], -k)))
    ata = {j.uid: j for j in jugadores if j.equipo == "ataque"}
    vel = {}
    for u, j in ata.items():
        v = np.zeros(n)
        ks = sorted(k for k, h in j.hist.items() if h[2])
        for a, b in zip(ks[:-1], ks[1:]):
            if b - a <= 3:
                v[a:b + 1] = np.maximum(v[a:b + 1], min(12.0, math.dist(j.hist[a][:2], j.hist[b][:2]) / ((b - a) * dt)))
        vel[u] = np.convolve(v, np.ones(3) / 3, "same")

    # Línea de tiempo del disco: poseedor por cuadro (solo detecciones confiables).
    linea = []
    for k in k_us:
        u, c = poseedor_en(k, discos, ata, 0)
        if u is not None and c >= 0.3:
            linea.append((k, u))
    cambio = None
    for (k1, u1), (k2, u2) in zip(linea[:-1], linea[1:]):
        if k1 > k0 and u1 != u2 and k2 - k1 <= round(3.0 / dt):
            # Exige que P y Q se vean con el disco al menos 2 veces (evita parpadeos).
            if sum(1 for _, u in linea if u == u1) >= 2 and sum(1 for _, u in linea if u == u2) >= 2:
                cambio = (k1, u1, k2, u2)
                break
    k_arr = k_pase = k_rec = None
    if cambio:
        k_pase, _, k_rec, receptor = cambio
        vc = vel.get(receptor, np.zeros(n))
        lentos = [k for k in range(k0 + 1, k_pase) if vc[k] < 2.5]
        k_arr = (lentos[-1] if lentos else k0 + 1)
        # El arranque tiene que verse antes del pase (si el receptor ya venía corriendo, al menos 0,4 s antes).
        k_arr = max(k0 + 1, min(k_arr, k_pase - round(0.4 / dt)))
        origen = "pase y recepción por el cambio de poseedor del disco; arranque por la aceleración del receptor (revisar)"
    elif vel:
        sostenida = {u: np.percentile(v[k0:], 90) for u, v in vel.items()}
        vc = vel[max(sostenida, key=sostenida.get)]
        min_arr = k0 + round(0.5 / dt)
        k_arr = next((k for k in range(min_arr, n) if vc[k] > 3.0 and vc[k - 1] <= 3.0), None)
        if k_arr is not None:
            k_pase = k_arr + int(np.argmax(vc[k_arr:]))
            k_rec = next((k for k in range(k_pase, n) if vc[k] < 2.0), None)
        origen = "por la velocidad del cortador, sin disco (heurístico; revisar o usar --tiempos)"
    else:
        origen = ""
    if k_arr is None:
        k_arr = min(n - 1, k0 + round(1.5 / dt))
        origen = "repartidos en el tiempo (no se pudo medir el corte); revisar o usar --tiempos"
    if k_rec is None:
        k_rec = min(n - 1, (k_pase or k_arr) + round(1.0 / dt))
    if k_pase is None or not k_arr < k_pase < k_rec:
        k_pase = (k_arr + k_rec) // 2
    ks = [k0, k_arr, k_pase, k_rec]
    for i in range(1, 4):  # estrictamente crecientes
        ks[i] = min(n - 1, max(ks[i], ks[i - 1] + 1))
    nombres = list(NOMBRES_PASO)
    if n_pasos == 3:
        ks = [ks[0], ks[1], ks[3]]
        nombres = ["formación inicial", "arranque del corte", "recepción"]
    log(f"[disco] poseedor visto en {len(linea)} cuadros" + (f"; cambio de manos en t={cuadros[cambio[0]].t:.1f}→{cuadros[cambio[2]].t:.1f}s del clip" if cambio else "; sin cambio de manos claro"))
    log("[pasos] " + ", ".join(f"{nm} @ {cuadros[k].t:.1f}s del clip" for nm, k in zip(nombres, ks)))
    return ks, nombres, origen


def _reporte_md(salida, args, reporte, notas, confs, usables, cuadros, offset, r):
    L = [f"# Reporte: {args.nombre}", ""]
    L.append(f"Validación del formato: **{'OK' if r.ok else 'INVÁLIDO'}** ({len(r.errores)} errores, {len(r.avisos)} avisos).")
    L.append(f"Cuadros con homografía usable: {sum(usables)}/{len(usables)} (umbral {args.conf_min}).")
    L.append("")
    L.append("| Paso | Momento | Video | Homografía | Origen | ± m | Vistos | Estimados | Disco | Confianza |")
    L.append("|---|---|---|---|---|---|---|---|---|---|")
    for p in reporte:
        L.append(f"| {p['paso']} | {p['nombre']} | {p['t_video']} | {p['homografia_confianza']:.2f} | {p['homografia_origen']} | "
                 f"{p['incertidumbre_m']:.1f} | {p['jugadores_vistos']} | {p['jugadores_estimados']} | {p['poseedor'] or '—'} | {p['confianza_paso']:.2f} |")
    L.append("")
    L.append("Confianza del paso = homografía × (fracción de jugadores vistos) × (penalización si no hay disco). "
             "Por debajo de 0.5: tomarlo como boceto.")
    L.append("")
    L.append("## Notas que van en la jugada")
    L += [f"- {n}" for n in notas]
    for p in reporte:
        if p["notas"]:
            L.append(f"\n### Paso {p['paso']}")
            L += [f"- {n}" for n in p["notas"]]
    L.append("\n## Homografía por cuadro\n")
    L.append("```")
    for c, cf in zip(cuadros, confs):
        L.append(f"{fmt_t(c.t + offset)}  {cf:4.2f}  {'#' * int(cf * 40)}")
    L.append("```")
    (salida / "reporte.md").write_text("\n".join(L), encoding="utf-8")


def _guardar_bitacora(salida: Path, bitacora: list[str]):
    (salida / "bitacora.txt").write_text("\n".join(bitacora), encoding="utf-8")


if __name__ == "__main__":
    sys.exit(main())
