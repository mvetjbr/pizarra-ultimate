"""Calibración manual por líneas.

La persona marca en un cuadro (con `marcar_lineas.py` o a mano en un JSON) dos o más puntos sobre
cada línea de la cancha que se ve, y dice cuál es. Con eso:

- Si las líneas (y puntos conocidos, si los hay) bastan para fijar la homografía (p. ej. las dos
  laterales + línea de gol + línea de fondo), se resuelve directamente.
- Si solo hay 3 líneas (lo típico en una toma con zoom: las dos laterales y una de gol), faltan 2
  grados de libertad. Se completan con dos restricciones medibles en el mismo cuadro:
    1. cámara pinhole (punto principal al centro, píxeles cuadrados): las dos estimaciones de la
       focal deben coincidir;
    2. estatura: una persona de ~1,78 m parada en (x, y) debe medir en la imagen lo que mide su caja.
  La solución se informa con su incertidumbre (cuánto se mueven los jugadores entre las soluciones
  casi igual de buenas), para que lo dudoso quede marcado.

Formato del JSON (coordenadas en píxeles del video original; nombres de línea en LINEAS_MANUALES):
{
  "t": "00:01.3",
  "lineas": {"lateral_lejana": [[503,183],[1430,190]], "lateral_cercana": [[0,595],[1430,603]],
             "gol_izquierda": [[0,350],[503,186]]},
  "puntos": [{"imagen": [x, y], "cancha": [X, Y]}]     (opcional)
}
Convención (como se ve en el video): x = 0 es el fondo de la IZQUIERDA de la imagen, y = 0 la
lateral LEJANA (arriba). Si la cámara está del otro lado de la cancha, usar "camara_opuesta": true.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import cv2
import numpy as np

import cancha

ESTATURA = 1.78
LARGO, ANCHO, ZONA = cancha.LARGO, cancha.ANCHO, cancha.ZONA

# Línea de la cancha -> recta homogénea en metros (a·X + b·Y + c = 0)
LINEAS_MANUALES = {
    "lateral_lejana": (0.0, 1.0, 0.0),            # Y = 0
    "lateral_cercana": (0.0, 1.0, -ANCHO),        # Y = 37
    "fondo_izquierda": (1.0, 0.0, 0.0),           # X = 0
    "gol_izquierda": (1.0, 0.0, -ZONA),           # X = 18
    "gol_derecha": (1.0, 0.0, -(LARGO - ZONA)),   # X = 82
    "fondo_derecha": (1.0, 0.0, -LARGO),          # X = 100
    "medio": (1.0, 0.0, -LARGO / 2),              # X = 50 (si hay una marca o cono a mitad de cancha)
}
LONGITUDINALES = {"lateral_lejana", "lateral_cercana"}


@dataclass
class ResultadoManual:
    H: np.ndarray  # cancha -> imagen (píxeles del video original)
    metodo: str
    focal: float | None
    error_pinhole: float | None
    error_estatura: float | None
    incertidumbre_m: float  # desplazamiento típico de los jugadores entre soluciones casi equivalentes
    n_personas: int
    residuo_lineas_px: float

    def explicacion(self) -> str:
        s = f"calibración manual por líneas ({self.metodo}); error en las líneas {self.residuo_lineas_px:.1f} px"
        if self.focal:
            s += (f", focal {self.focal:.0f} px, pinhole {self.error_pinhole:.3f}, "
                  f"estatura {self.error_estatura:.2f} con {self.n_personas} personas")
        s += f"; incertidumbre de posiciones ≈ {self.incertidumbre_m:.1f} m"
        return s


def recta_de_puntos(pts) -> np.ndarray:
    pts = np.asarray(pts, np.float32)
    if len(pts) == 2:
        l = np.cross([*pts[0], 1.0], [*pts[1], 1.0])
    else:
        vx, vy, x0, y0 = cv2.fitLine(pts, cv2.DIST_L2, 0, 0.01, 0.01).ravel()
        l = np.cross([x0, y0, 1.0], [x0 + vx, y0 + vy, 1.0])
    return l / np.hypot(l[0], l[1])


def _corte(l1, l2):
    p = np.cross(l1, l2)
    return None if abs(p[2]) < 1e-12 else p[:2] / p[2]


def focal_pinhole(H: np.ndarray, w: int, h: int) -> tuple[float, float]:
    """(focal, error): dos estimaciones cerradas de f² (ortogonalidad e igual norma) y su discrepancia."""
    cx, cy = w / 2, h / 2
    u = H[0, :2] - cx * H[2, :2]
    v = H[1, :2] - cy * H[2, :2]
    z = H[2, :2]
    den1, den2 = z[0] * z[1], z[0] ** 2 - z[1] ** 2
    if abs(den1) < 1e-18 or abs(den2) < 1e-18:
        return float("nan"), 9.0
    fa = -(u[0] * u[1] + v[0] * v[1]) / den1
    fb = (u[1] ** 2 + v[1] ** 2 - u[0] ** 2 - v[0] ** 2) / den2
    if fa <= 0 or fb <= 0:
        return float("nan"), 9.0
    return float(math.sqrt(math.sqrt(fa * fb))), abs(math.log(fa / fb))


def alto_predicho(H: np.ndarray, f: float, w: int, h: int, pies_cancha: np.ndarray) -> np.ndarray:
    """Alto en píxeles de una persona de ESTATURA parada en cada punto de la cancha."""
    K = np.array([[f, 0, w / 2], [0, f, h / 2], [0, 0, 1.0]])
    A = np.linalg.inv(K) @ H
    lam = 2.0 / (np.linalg.norm(A[:, 0]) + np.linalg.norm(A[:, 1]))
    r1, r2, t = A[:, 0] * lam, A[:, 1] * lam, A[:, 2] * lam
    if t[2] < 0:
        r1, r2, t = -r1, -r2, -t
    r3 = np.cross(r1, r2)
    altos = []
    for x, y in pies_cancha:
        base = x * r1 + y * r2 + t
        pie = K @ base
        if pie[2] <= 0:
            altos.append(np.nan)
            continue
        pie = pie[:2] / pie[2]
        mejor = np.nan
        for s in (1.0, -1.0):
            cab = K @ (base + s * ESTATURA * r3)
            if cab[2] > 0:
                cab = cab[:2] / cab[2]
                if cab[1] < pie[1]:
                    mejor = pie[1] - cab[1]
        altos.append(mejor)
    return np.array(altos)


def personas_utiles(cajas, w: int, h: int, excluir: np.ndarray | None = None) -> np.ndarray:
    """(x_pie, y_pie, alto) de cajas completas de gente de pie (no tocan bordes ni rótulos)."""
    out = []
    for (x1, y1, x2, y2) in cajas:
        if y1 < 3 or y2 > h - 3 or x1 < 3 or x2 > w - 3:
            continue
        if excluir is not None and excluir[int(min(h - 1, y2)), int(min(w - 1, (x1 + x2) / 2))] > 0:
            continue
        alto = y2 - y1
        if alto < 30 or (x2 - x1) > 0.9 * alto:  # agachados, caídos o con brazos abiertos: no
            continue
        out.append(((x1 + x2) / 2, y2, alto))
    return np.array(out).reshape(-1, 3)


def _h_de_lineas_y_puntos(lin_img: dict, lin_campo: dict, puntos: list) -> tuple[np.ndarray | None, int]:
    """DLT con correspondencias de rectas (l_img ~ H^-T l_campo) y puntos. Devuelve (H, rango)."""
    filas = []
    for nombre, l in lin_img.items():
        L = np.asarray(lin_campo[nombre], float)
        # H^T l_img ~ L  ->  (H^T l) x L = 0. Incógnita: vec(H) (fila por fila).
        a = np.zeros((3, 9))
        for j in range(3):  # (H^T l)_j = sum_i H_ij l_i
            for i in range(3):
                a[j, i * 3 + j] = l[i]
        cr = np.array([[0, -L[2], L[1]], [L[2], 0, -L[0]], [-L[1], L[0], 0]])
        filas.append(cr @ a)
    for p in puntos:
        X, Y = p["cancha"]
        x, y = p["imagen"]
        Pf = np.array([X, Y, 1.0])
        filas.append(np.array([np.r_[np.zeros(3), -Pf, y * Pf], np.r_[Pf, np.zeros(3), -x * Pf]]))
    if not filas:
        return None, 0
    Amat = np.vstack(filas)
    _, s, Vt = np.linalg.svd(Amat)
    rango = int((s > s[0] * 1e-8).sum())
    if rango < 8:
        return None, rango
    H = Vt[-1].reshape(3, 3)
    return H / H[2, 2], rango


def _residuo_lineas(H, lin_pts: dict, lin_campo: dict) -> float:
    """Distancia media (px) de los puntos marcados a la recta del modelo proyectada."""
    Hinv_T = np.linalg.inv(H).T
    ds = []
    for nombre, pts in lin_pts.items():
        l = Hinv_T @ np.asarray(lin_campo[nombre], float)
        l = l / np.hypot(l[0], l[1])
        for x, y in pts:
            ds.append(abs(l[0] * x + l[1] * y + l[2]))
    return float(np.mean(ds)) if ds else 0.0


def resolver(datos: dict, w: int, h: int, cajas=(), excluir: np.ndarray | None = None,
             extra: list | tuple = ()) -> ResultadoManual:
    """Resuelve la homografía (cancha -> imagen original) a partir de líneas marcadas a mano.

    `extra`: otros cuadros de la MISMA toma, como lista de (G, cajas), donde G lleva píxeles del
    cuadro marcado a ese cuadro (movimiento de cámara). La cámara panea y hace zoom: cada cuadro aporta
    su propia restricción pinhole (con otra focal) y más personas para la estatura.
    """
    lin_pts = {k: v for k, v in datos.get("lineas", {}).items() if len(v) >= 2}
    desconocidas = [k for k in lin_pts if k not in LINEAS_MANUALES]
    if desconocidas:
        raise ValueError(f"líneas desconocidas: {desconocidas}. Válidas: {list(LINEAS_MANUALES)}")
    lin_campo = dict(LINEAS_MANUALES)
    puntos = list(datos.get("puntos", []))
    if datos.get("camara_opuesta"):  # cancha girada 180°: X -> 100 - X, Y -> 37 - Y
        def girar(L):
            a, b, c = L
            return (-a, -b, c + a * LARGO + b * ANCHO)
        lin_campo = {k: girar(v) for k, v in lin_campo.items()}
        puntos = [{"imagen": p["imagen"], "cancha": [LARGO - p["cancha"][0], ANCHO - p["cancha"][1]]} for p in puntos]
    lin_img = {k: recta_de_puntos(v) for k, v in lin_pts.items()}

    H, rango = _h_de_lineas_y_puntos(lin_img, lin_campo, puntos)
    if H is not None:
        return ResultadoManual(H, "líneas y puntos suficientes", None, None, None, 0.3, 0,
                               _residuo_lineas(H, lin_pts, lin_campo))

    # Faltan grados de libertad: se requieren las dos laterales y una transversal.
    trans = [k for k in lin_img if k not in LONGITUDINALES]
    if not (LONGITUDINALES <= set(lin_img) and trans):
        raise ValueError("Con estas líneas la cancha queda indeterminada. Marca las dos laterales y al menos "
                         "una línea de gol o de fondo (o 4 líneas, o líneas + puntos conocidos).")
    far, near, T = lin_img["lateral_lejana"], lin_img["lateral_cercana"], lin_img[trans[0]]
    a, b, c = lin_campo[trans[0]]
    xt = -c / a  # la transversal es X = xt (en el sistema ya girado si corresponde)
    p1, p2 = _corte(far, T), _corte(near, T)
    if p1 is None or p2 is None:
        raise ValueError("las laterales no cortan a la línea transversal marcada; revisa los puntos")
    lado = 1.0 if p1[0] < w / 2 else -1.0  # dirección de X creciente en la imagen
    borde_x = w - 1.0 if lado > 0 else 0.0
    borde = np.cross([borde_x, 0, 1.0], [borde_x, 1, 1.0])
    p3, p4 = _corte(far, borde), _corte(near, borde)
    signo_x = 1.0 if not datos.get("camara_opuesta") else -1.0
    y_far, y_near = (0.0, ANCHO) if not datos.get("camara_opuesta") else (ANCHO, 0.0)
    personas = personas_utiles(cajas, w, h, excluir)
    img = np.array([p1, p2, p3, p4])

    def h_de(u, v):
        xs = xt + lado * signo_x * u, xt + lado * signo_x * v
        campo = np.array([[xt, y_far], [xt, y_near], [xs[0], y_far], [xs[1], y_near]], float)
        H, _ = cv2.findHomography(campo, img, 0)
        return H

    vistas = [(np.eye(3), personas)] + [(np.asarray(G, float), personas_utiles(cj, w, h, excluir)) for G, cj in extra]

    def costo(H):
        f, _ = focal_pinhole(H, w, h)
        if not np.isfinite(f):
            return 1e3, f, 9.0, 9.0, 0
        e_pins, logs = [], []
        for G, pers in vistas:
            Hk = G @ H
            fk, ek = focal_pinhole(Hk, w, h)
            e_pins.append(ek)
            if not np.isfinite(fk) or len(pers) < 1:
                continue
            pc = cancha.a_cancha(Hk, pers[:, :2])
            dentro = (pc[:, 0] > -2) & (pc[:, 0] < LARGO + 2) & (pc[:, 1] > -2) & (pc[:, 1] < ANCHO + 2)
            if dentro.any():
                pred = alto_predicho(Hk, fk, w, h, pc[dentro])
                ok = np.isfinite(pred) & (pred > 0)
                logs += list(np.log(pred[ok] / pers[dentro][ok, 2]))
        e_pin = float(np.sqrt(np.mean(np.square(np.minimum(e_pins, 9.0)))))
        n = len(logs)
        e_alt = abs(float(np.median(logs))) if n >= 3 else 9.0
        return (e_pin / 0.1) ** 2 + (e_alt / 0.06) ** 2, f, e_pin, e_alt, n

    # Grilla en u, v = metros que abarca cada lateral desde la transversal hasta el borde de la imagen.
    us = np.exp(np.linspace(np.log(2), np.log(100), 70))
    tabla = []
    for u in us:
        for v in us:
            if not (-3 <= xt + lado * signo_x * u <= 103 and -3 <= xt + lado * signo_x * v <= 103):
                continue
            H = h_de(u, v)
            if H is None:
                continue
            tabla.append((costo(H)[0], u, v))
    if not tabla:
        raise ValueError("no se encontró una cámara compatible con las líneas marcadas")
    tabla.sort()
    # Refinamiento continuo alrededor del mejor.
    from scipy.optimize import minimize
    _, u0, v0 = tabla[0]
    sol = minimize(lambda p: costo(h_de(math.exp(p[0]), math.exp(p[1])))[0], [math.log(u0), math.log(v0)],
                   method="Nelder-Mead", options={"xatol": 1e-3, "fatol": 1e-4, "maxiter": 300})
    u, v = math.exp(sol.x[0]), math.exp(sol.x[1])
    H = h_de(u, v)
    c_min, f, e_pin, e_alt, n = costo(H)
    if n < 3:
        raise ValueError("faltan personas de pie bien visibles en ese cuadro para fijar la escala; elige otro cuadro")
    # Incertidumbre: cuánto se mueven los pies entre las soluciones con costo < mínimo + 1
    # (grilla fina alrededor del óptimo; el costo está en "sigmas" al cuadrado).
    pies = personas[:, :2]
    base = cancha.a_cancha(H, pies)
    desv: list[float] = []
    rango = 0.7
    while rango > 0.002:  # grilla que se achica hasta resolver el mínimo
        desv = []
        for du in np.linspace(-rango, rango, 29):
            for dv in np.linspace(-rango, rango, 29):
                Hc = h_de(u * math.exp(du), v * math.exp(dv))
                if Hc is not None and costo(Hc)[0] < c_min + 1.0:
                    desv.append(float(np.median(np.linalg.norm(cancha.a_cancha(Hc, pies) - base, axis=1))))
        if len(desv) >= 15:
            break
        rango /= 4
    incert = float(np.percentile(desv, 90)) if len(desv) >= 3 else 10.0  # sin datos: asumir lo peor
    # La curvatura del mínimo no ve el sesgo del modelo (lente, recorte de la imagen). Piso empírico,
    # medido contra la calibración de 4 líneas en la toma amplia de T Slash (ver README):
    # con un solo cuadro el error llegó a ~7-8 m; con varios cuadros encadenados, a ~2,6 m.
    varios = len(vistas) >= 5 and n >= 60
    incert = max(incert, 2.5 if varios else 6.0)
    metodo = f"3 líneas + pinhole + estatura en {len(vistas)} cuadro{'s' if len(vistas) > 1 else ''}"
    return ResultadoManual(H / H[2, 2], metodo, f, e_pin, e_alt, incert, n,
                           _residuo_lineas(H, lin_pts, lin_campo))
