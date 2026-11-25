"""Homografía imagen <-> cancha (metros) a partir de las líneas blancas y del movimiento de cámara.

Convención: H es la homografía 3x3 que lleva puntos de la CANCHA (metros) a la IMAGEN (píxeles).
Para proyectar los pies de un jugador a metros se usa inv(H).

Estrategia por toma:
1. Calibración de un cuadro de referencia: puntos imagen<->cancha (manual, archivo JSON) o
   automática (líneas detectadas + búsqueda de hipótesis).
2. Propagación cuadro a cuadro: homografía del fondo con optical flow (se enmascaran los jugadores).
3. Refinamiento en cada cuadro: se ajusta H para que las líneas del modelo caigan sobre las
   líneas blancas detectadas (transformada de distancia + mínimos cuadrados robustos).
4. Confianza: fracción de puntos del modelo visibles que caen sobre una línea blanca y si hay
   líneas en dos direcciones (con una sola dirección la homografía no queda determinada).
"""
from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np
from scipy.optimize import least_squares

LARGO, ANCHO = 100.0, 37.0
ZONA = 18.0

# Segmentos del modelo de cancha (metros). Nombre -> ((x1,y1),(x2,y2)).
LINEAS = {
    "lateral_y0": ((0, 0), (LARGO, 0)),
    "lateral_y37": ((0, ANCHO), (LARGO, ANCHO)),
    "fondo_x0": ((0, 0), (0, ANCHO)),
    "gol_x18": ((ZONA, 0), (ZONA, ANCHO)),
    "gol_x82": ((LARGO - ZONA, 0), (LARGO - ZONA, ANCHO)),
    "fondo_x100": ((LARGO, 0), (LARGO, ANCHO)),
}
LONGITUDINALES = {"lateral_y0", "lateral_y37"}


def muestras_modelo(paso_m: float = 0.5) -> tuple[np.ndarray, np.ndarray]:
    """Puntos (N,2) sobre las líneas del modelo y el índice de línea de cada uno."""
    pts, idx = [], []
    for k, ((x1, y1), (x2, y2)) in enumerate(LINEAS.values()):
        n = max(2, int(np.hypot(x2 - x1, y2 - y1) / paso_m))
        t = np.linspace(0, 1, n)
        pts.append(np.stack([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t], 1))
        idx.append(np.full(n, k))
    return np.concatenate(pts), np.concatenate(idx)


MUESTRAS, MUESTRAS_LINEA = muestras_modelo()
NOMBRES_LINEA = list(LINEAS)


def proyectar(H: np.ndarray, pts: np.ndarray) -> np.ndarray:
    p = np.c_[pts, np.ones(len(pts))] @ H.T
    with np.errstate(divide="ignore", invalid="ignore"):
        return p[:, :2] / p[:, 2:3]


def a_cancha(H: np.ndarray, pts_img: np.ndarray) -> np.ndarray:
    return proyectar(np.linalg.inv(H), np.asarray(pts_img, float).reshape(-1, 2))


def mascara_pasto(img: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    m = cv2.inRange(hsv, (3, 15, 50), (95, 255, 235))  # pasto verde o seco
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((25, 25), np.uint8))
    return m


def mascara_lineas(img: np.ndarray, cajas=()) -> np.ndarray:
    """Píxeles de línea blanca sobre pasto (top-hat para quedarse con trazos finos y claros)."""
    gris = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    k = max(9, img.shape[1] // 120) | 1
    tophat = cv2.morphologyEx(gris, cv2.MORPH_TOPHAT, cv2.getStructuringElement(cv2.MORPH_RECT, (k, k)))
    blanco = (tophat > 14) & (hsv[..., 1] < 70) & (hsv[..., 2] > 115)
    pasto = cv2.dilate(mascara_pasto(img), np.ones((15, 15), np.uint8)) > 0
    m = (blanco & pasto).astype(np.uint8) * 255
    for (x1, y1, x2, y2) in cajas:  # los jugadores de blanco no son líneas
        cv2.rectangle(m, (int(x1) - 3, int(y1) - 3), (int(x2) + 3, int(y2) + 3), 0, -1)
    # Quita manchas pequeñas: una línea es un componente alargado.
    n, lab, stats, _ = cv2.connectedComponentsWithStats(m, 8)
    largo_min = img.shape[1] * 0.02
    lado = np.maximum(stats[:, cv2.CC_STAT_WIDTH], stats[:, cv2.CC_STAT_HEIGHT])
    # Una línea pintada es delgada: área / longitud ~ grosor (pocos px). El público es una mancha gruesa.
    grosor = stats[:, cv2.CC_STAT_AREA] / np.maximum(1, lado)
    grosor_max = max(4.0, img.shape[1] / 200)
    conservar = (lado >= largo_min) & (grosor <= grosor_max)
    conservar[0] = False
    return np.where(conservar[lab], 255, 0).astype(np.uint8)


# ---------------------------------------------------------------- calibración automática

def lineas_rectas(mascara: np.ndarray, max_lineas: int = 7) -> list[np.ndarray]:
    """Rectas largas (homogéneas a,b,c normalizadas) a partir de la máscara de líneas."""
    h, w = mascara.shape
    segs = cv2.HoughLinesP(mascara, 1, np.pi / 360, threshold=60, minLineLength=int(w * 0.07), maxLineGap=int(w * 0.02))
    if segs is None:
        return []
    segs = segs.reshape(-1, 4).astype(float)
    largos = np.hypot(segs[:, 2] - segs[:, 0], segs[:, 3] - segs[:, 1])
    orden = np.argsort(-largos)
    grupos: list[dict] = []
    for i in orden:
        x1, y1, x2, y2 = segs[i]
        ang = np.arctan2(y2 - y1, x2 - x1) % np.pi
        for g in grupos:
            d_ang = min(abs(ang - g["ang"]), np.pi - abs(ang - g["ang"]))
            # distancia de los extremos del segmento a la recta del grupo
            a, b, c = g["l"]
            d = max(abs(a * x1 + b * y1 + c), abs(a * x2 + b * y2 + c))
            if d_ang < np.radians(3) and d < 6:
                g["pts"] += [(x1, y1), (x2, y2)]
                g["largo"] += largos[i]
                break
        else:
            l = np.cross([x1, y1, 1.0], [x2, y2, 1.0])
            l /= np.hypot(l[0], l[1])
            grupos.append({"ang": ang, "l": l, "pts": [(x1, y1), (x2, y2)], "largo": largos[i]})
    ys, xs = np.nonzero(mascara)
    candidatas = []
    for g in grupos:
        pts = np.array(g["pts"], np.float32)
        vx, vy, x0, y0 = cv2.fitLine(pts, cv2.DIST_HUBER, 0, 0.01, 0.01).ravel()
        l = np.cross([x0, y0, 1.0], [x0 + vx, y0 + vy, 1.0])
        l = l / np.hypot(l[0], l[1])
        d = np.abs(l[0] * xs + l[1] * ys + l[2])
        cerca, banda = int((d <= 2.5).sum()), int(((d > 4) & (d <= 12)).sum())
        nitidez = cerca / max(1, cerca + banda)
        # Una línea de cancha: muchos píxeles pegados a la recta y casi nada alrededor.
        if nitidez >= 0.6 and cerca >= w * 0.06:
            candidatas.append((cerca * nitidez, l))
    candidatas.sort(key=lambda c: -c[0])
    return [l for _, l in candidatas[:max_lineas]]


def _interseccion(l1, l2):
    p = np.cross(l1, l2)
    if abs(p[2]) < 1e-9:
        return None
    return p[:2] / p[2]


def _y_en(l, x):
    a, b, c = l
    return -(a * x + c) / b if abs(b) > 1e-9 else np.inf


def calibrar_auto(mascara: np.ndarray, pies: np.ndarray | None = None, refinar_top: int = 6) -> Ajuste | None:
    """Prueba hipótesis (2 laterales + 2 transversales) y devuelve la mejor homografía.

    Las laterales son 'far' (y=0 de la cancha, arriba en la imagen) y 'near' (y=37).
    El extremo de la cancha que se ve a la izquierda de la imagen es x=0.
    """
    h, w = mascara.shape
    L = lineas_rectas(mascara)
    if len(L) < 4:
        return None
    dist = np.minimum(cv2.distanceTransform(255 - mascara, cv2.DIST_L2, 3), 20).astype(np.float32)
    px = pixeles_linea(mascara, 1500)
    cx = w / 2
    pares_x = [(0.0, ZONA), (ZONA, LARGO - ZONA), (LARGO - ZONA, LARGO), (0.0, LARGO - ZONA), (ZONA, LARGO)]
    candidatos = []
    import itertools
    for i, j in itertools.permutations(range(len(L)), 2):
        far, near = L[i], L[j]
        if not (_y_en(far, cx) < _y_en(near, cx)):
            continue
        resto = [k for k in range(len(L)) if k not in (i, j)]
        for p, q in itertools.permutations(resto, 2):
            t1, t2 = L[p], L[q]  # t1 a la izquierda de t2 sobre la lateral lejana
            a1, a2 = _interseccion(far, t1), _interseccion(far, t2)
            b1, b2 = _interseccion(near, t1), _interseccion(near, t2)
            if any(v is None for v in (a1, a2, b1, b2)) or not a1[0] < a2[0] or not b1[0] < b2[0]:
                continue
            img_pts = np.array([a1, a2, b2, b1])
            if np.abs(img_pts).max() > 20 * w:
                continue
            for xa, xb in pares_x:
                cancha_pts = np.array([[xa, 0], [xb, 0], [xb, ANCHO], [xa, ANCHO]], float)
                H, _ = cv2.findHomography(cancha_pts, img_pts, 0)
                if H is None:
                    continue
                aj = evaluar(H, dist, px)
                if aj.direcciones < 2:
                    continue
                candidatos.append((aj.confianza * _dentro(H, pies), H))
    if not candidatos:
        return None
    candidatos.sort(key=lambda c: -c[0])
    mejores = []
    for _, H in candidatos[:refinar_top]:
        aj = refinar(H, mascara)
        aj.confianza *= _dentro(aj.H, pies)
        mejores.append(aj)
    return max(mejores, key=lambda a: a.confianza)


def _dentro(H: np.ndarray, pies: np.ndarray | None) -> float:
    """Fracción de pies que caen dentro de la cancha (con margen). 1.0 si no hay pies."""
    if pies is None or len(pies) < 4:
        return 1.0
    try:
        m = a_cancha(H, pies)
    except np.linalg.LinAlgError:
        return 0.0
    ok = (m[:, 0] > -5) & (m[:, 0] < LARGO + 5) & (m[:, 1] > -4) & (m[:, 1] < ANCHO + 4)
    return float(ok.mean())


@dataclass
class Ajuste:
    H: np.ndarray
    confianza: float  # 0..1
    visibles: int
    sobre_linea: float  # fracción de puntos visibles sobre línea blanca
    direcciones: int  # cuántas direcciones de línea (longitudinal / transversal) se ven
    lineas_vistas: list[str]
    cobertura: float = 1.0  # fracción de líneas blancas detectadas que explica el modelo


def _h_de_params(p: np.ndarray) -> np.ndarray:
    return np.append(p, 1.0).reshape(3, 3)


def pixeles_linea(mascara: np.ndarray, max_n: int = 4000) -> np.ndarray:
    """Muestra de píxeles de línea blanca (x, y) para medir cobertura."""
    ys, xs = np.nonzero(mascara)
    if len(xs) > max_n:
        sel = np.random.default_rng(0).choice(len(xs), max_n, replace=False)
        xs, ys = xs[sel], ys[sel]
    return np.stack([xs, ys], 1)


def render_modelo(H: np.ndarray, forma: tuple[int, int], grosor: int = 9) -> np.ndarray:
    """Máscara con las líneas del modelo proyectadas (solo puntos delante de la cámara)."""
    h, w = forma
    m = np.zeros((h, w), np.uint8)
    for (a, b) in LINEAS.values():
        t = np.linspace(0, 1, 80)
        seg = np.stack([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], 1)
        p = np.c_[seg, np.ones(len(seg))] @ H.T
        delante = p[:, 2] > 1e-9
        q = p[:, :2] / np.where(np.abs(p[:, 2:3]) < 1e-12, 1e-12, p[:, 2:3])
        for i in range(len(q) - 1):
            if delante[i] and delante[i + 1] and np.abs(q[i:i + 2]).max() < 10 * w:
                cv2.line(m, tuple(q[i].astype(int)), tuple(q[i + 1].astype(int)), 255, grosor)
    return m


def evaluar(H: np.ndarray, dist: np.ndarray, px_linea: np.ndarray | None = None, umbral_px: float = 4.0) -> Ajuste:
    """precisión (modelo sobre líneas) x cobertura (líneas explicadas por el modelo)."""
    h, w = dist.shape
    p = np.c_[MUESTRAS, np.ones(len(MUESTRAS))] @ H.T
    delante = p[:, 2] > 1e-9
    q = p[:, :2] / np.where(np.abs(p[:, 2:3]) < 1e-12, 1e-12, p[:, 2:3])
    dentro = delante & np.isfinite(q).all(1) & (q[:, 0] >= 0) & (q[:, 0] < w) & (q[:, 1] >= 0) & (q[:, 1] < h)
    if dentro.sum() < 10:
        return Ajuste(H, 0.0, int(dentro.sum()), 0.0, 0, [])
    qi = q[dentro].astype(int)
    ok = dist[qi[:, 1], qi[:, 0]] < umbral_px
    vistas = []
    for k in np.unique(MUESTRAS_LINEA[dentro]):
        sel = MUESTRAS_LINEA[dentro] == k
        if sel.sum() >= 8 and ok[sel].mean() > 0.35:
            vistas.append(NOMBRES_LINEA[k])
    direcciones = int(any(v in LONGITUDINALES for v in vistas)) + int(any(v not in LONGITUDINALES for v in vistas))
    precision = float(ok.mean())
    cobertura = 1.0
    if px_linea is not None and len(px_linea) > 20:
        r = render_modelo(H, (h, w))
        cobertura = float((r[px_linea[:, 1], px_linea[:, 0]] > 0).mean())
    # Si solo hay líneas en una dirección la homografía queda indeterminada: confianza baja.
    conf = precision * cobertura * (1.0 if direcciones == 2 else 0.35)
    aj = Ajuste(H, conf, int(dentro.sum()), precision, direcciones, vistas)
    aj.cobertura = cobertura
    return aj


def refinar(H0: np.ndarray, lineas: np.ndarray, tope_px: float = 20.0, iter_max: int = 80,
            ancla_px: float = 40.0) -> Ajuste:
    """Ajusta H para que las líneas del modelo caigan sobre las líneas blancas de `lineas`.

    Lleva un ancla suave (las esquinas de la imagen no se mueven más de ~ancla_px respecto de H0)
    para que el ajuste no colapse la cancha sobre una sola línea.
    """
    h, w = lineas.shape
    dist = np.minimum(cv2.distanceTransform(255 - lineas, cv2.DIST_L2, 3), tope_px).astype(np.float32)
    px = pixeles_linea(lineas)
    H0 = H0 / H0[2, 2]
    q0 = proyectar(H0, MUESTRAS)
    vis = np.isfinite(q0).all(1) & (q0[:, 0] >= 2) & (q0[:, 0] < w - 2) & (q0[:, 1] >= 2) & (q0[:, 1] < h - 2)
    a0 = evaluar(H0, dist, px)
    if vis.sum() < 20:
        return a0
    pts = MUESTRAS[vis]
    esquinas_img = np.array([[0, 0], [w, 0], [w, h], [0, h], [w / 2, h / 2]], float)
    try:
        esquinas_cancha = proyectar(np.linalg.inv(H0), esquinas_img)
    except np.linalg.LinAlgError:
        return a0

    def residuo(p):
        H = _h_de_params(p)
        q = np.nan_to_num(proyectar(H, pts), nan=-1e3, posinf=-1e3, neginf=-1e3)
        x = np.clip(q[:, 0], 0, w - 1.001).astype(np.float32).reshape(1, -1)
        y = np.clip(q[:, 1], 0, h - 1.001).astype(np.float32).reshape(1, -1)
        r_lin = cv2.remap(dist, x, y, cv2.INTER_LINEAR).ravel()
        e = np.nan_to_num(proyectar(H, esquinas_cancha) - esquinas_img, nan=1e3).ravel()
        return np.r_[r_lin, e * (tope_px / ancla_px) * np.sqrt(len(pts) / 40)]

    p0 = H0.ravel()[:8]
    escala = np.abs(p0) * 0.05 + 1e-6
    try:
        sol = least_squares(residuo, p0, x_scale=escala, loss="soft_l1", f_scale=3.0,
                            max_nfev=iter_max, diff_step=1e-4)
        H = _h_de_params(sol.x)
    except Exception:
        H = H0
    a1 = evaluar(H, dist, px)
    return a1 if a1.confianza >= a0.confianza else a0


class MovimientoCamara:
    """Homografía entre cuadros consecutivos del fondo (pasto + líneas), sin los jugadores."""

    def __init__(self) -> None:
        self.prev_gris = None

    def paso(self, img: np.ndarray, cajas=()) -> tuple[np.ndarray | None, float]:
        """Devuelve (M, calidad) con M que lleva píxeles del cuadro anterior al actual."""
        gris = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        if self.prev_gris is None:
            self.prev_gris = gris
            return np.eye(3), 1.0
        mask = np.full(gris.shape, 255, np.uint8)
        for (x1, y1, x2, y2) in cajas:
            cv2.rectangle(mask, (int(x1) - 8, int(y1) - 8), (int(x2) + 8, int(y2) + 8), 0, -1)
        p0 = cv2.goodFeaturesToTrack(self.prev_gris, 600, 0.01, 12, mask=mask)
        if p0 is None or len(p0) < 20:
            self.prev_gris = gris
            return None, 0.0
        p1, st, _ = cv2.calcOpticalFlowPyrLK(self.prev_gris, gris, p0, None, winSize=(21, 21), maxLevel=4)
        self.prev_gris = gris
        ok = st.ravel() == 1
        if ok.sum() < 20:
            return None, 0.0
        M, inl = cv2.findHomography(p0[ok], p1[ok], cv2.RANSAC, 2.0)
        if M is None:
            return None, 0.0
        return M, float(inl.mean())


def homografia_de_puntos(img_pts, cancha_pts) -> np.ndarray:
    H, _ = cv2.findHomography(np.asarray(cancha_pts, float), np.asarray(img_pts, float), 0)
    return H


def dibujar_modelo(img: np.ndarray, H: np.ndarray, color=(0, 255, 255), grosor: int = 2) -> np.ndarray:
    out = img.copy()
    h, w = img.shape[:2]
    for (a, b) in LINEAS.values():
        t = np.linspace(0, 1, 60)
        seg = np.stack([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], 1)
        q = proyectar(H, seg)
        for p, r in zip(q[:-1], q[1:]):
            if np.isfinite(p).all() and np.isfinite(r).all() and abs(p).max() < 5 * w and abs(r).max() < 5 * w:
                cv2.line(out, tuple(map(int, p)), tuple(map(int, r)), color, grosor, cv2.LINE_AA)
    return out

