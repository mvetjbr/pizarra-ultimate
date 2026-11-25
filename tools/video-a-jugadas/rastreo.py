"""Seguimiento de jugadores en coordenadas de cancha (metros), por equipo.

ByteTrack trabaja en píxeles y con la cámara moviéndose y haciendo zoom fragmenta mucho los ids.
En metros el movimiento de cámara desaparece: un jugador no se mueve más de ~9 m/s, así que la
asociación cuadro a cuadro (algoritmo húngaro con una compuerta que crece mientras el jugador no
se ve) es estable. Máximo 7 jugadores por equipo.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
from scipy.optimize import linear_sum_assignment

LARGO, ANCHO = 100.0, 37.0
VEL_MAX = 9.0  # m/s


@dataclass
class Det:
    k: int
    xy: tuple[float, float]  # metros (coords del video)
    caja: tuple
    conf: float
    color: str  # "blanco" | "oscuro" | "?"


@dataclass
class Jugador:
    uid: int
    equipo: str  # "ataque" | "defensa"
    pos: np.ndarray
    vel: np.ndarray = field(default_factory=lambda: np.zeros(2))
    perdido: int = 0  # cuadros sin verse
    hist: dict = field(default_factory=dict)  # k -> (x, y, visto: bool, caja|None)
    votos: dict = field(default_factory=lambda: {"blanco": 0, "oscuro": 0, "?": 0})


def en_cancha(xy, margen_x=1.0, margen_y=0.8) -> bool:
    x, y = xy
    return -margen_x < x < LARGO + margen_x and -margen_y < y < ANCHO + margen_y


class Rastreador:
    def __init__(self, color_ataque: str, dt: float, max_por_equipo: int = 7):
        self.color_ataque = color_ataque
        self.dt = dt
        self.max = max_por_equipo
        self.jugadores: list[Jugador] = []
        self.candidatos: list[dict] = []  # detecciones sin dueño que podrían ser un jugador nuevo
        self._uid = 0

    def equipo_de(self, color: str) -> str | None:
        if color == "?":
            return None
        return "ataque" if color == self.color_ataque else "defensa"

    def paso(self, k: int, dets: list[Det] | None):
        """dets=None: cuadro sin homografía confiable (los jugadores se arrastran sin verse)."""
        for j in self.jugadores:
            j.vel *= 0.85
            pred = j.pos + j.vel * self.dt
            j.pos = np.clip(pred, [-5, -5], [LARGO + 5, ANCHO + 5])
        if dets is None:
            for j in self.jugadores:
                j.perdido += 1
                j.hist[k] = (float(j.pos[0]), float(j.pos[1]), False, None)
            return
        dets = [d for d in dets if en_cancha(d.xy)]
        libres = set(range(len(dets)))
        for eq in ("ataque", "defensa"):
            js = [j for j in self.jugadores if j.equipo == eq]
            ds = [i for i in libres if self.equipo_de(dets[i].color) in (eq, None)]
            if not js or not ds:
                continue
            C = np.full((len(js), len(ds)), 1e6)
            for a, j in enumerate(js):
                compuerta = min(25.0, 2.0 + VEL_MAX * self.dt * (j.perdido + 1))
                for b, i in enumerate(ds):
                    d = float(np.hypot(*(np.array(dets[i].xy) - j.pos)))
                    if d <= compuerta:
                        # Un color '?' cuesta un poco más que el color del equipo.
                        C[a, b] = d + (0.8 if dets[i].color == "?" else 0.0)
            fil, col = linear_sum_assignment(C)
            for a, b in zip(fil, col):
                if C[a, b] >= 1e6:
                    continue
                j, det = js[a], dets[ds[b]]
                nuevo = np.array(det.xy)
                j.vel = 0.5 * j.vel + 0.5 * (nuevo - j.pos) / (self.dt * (j.perdido + 1))
                j.pos = nuevo
                j.perdido = 0
                j.votos[det.color] += 1
                j.hist[k] = (float(nuevo[0]), float(nuevo[1]), True, det.caja)
                libres.discard(ds[b])
        for j in self.jugadores:
            if k not in j.hist:
                j.perdido += 1
                j.hist[k] = (float(j.pos[0]), float(j.pos[1]), False, None)
        self._nacer(k, [dets[i] for i in libres])

    def _nacer(self, k: int, sueltas: list[Det]):
        """Una detección sin dueño que se repite en el mismo lugar 3 de 5 cuadros es un jugador nuevo."""
        vivos = []
        for c in self.candidatos:
            if k - c["ultimo"] <= 2:
                vivos.append(c)
        self.candidatos = vivos
        for d in sueltas:
            eq = self.equipo_de(d.color)
            if eq is None or not en_cancha(d.xy, -0.5, -0.3):
                continue
            mejor = None
            for c in self.candidatos:
                if c["equipo"] == eq and np.hypot(*(np.array(d.xy) - c["pos"])) < 2.5:
                    mejor = c
                    break
            if mejor is None:
                self.candidatos.append({"equipo": eq, "pos": np.array(d.xy), "hits": 1, "ultimo": k, "dets": [d]})
                continue
            mejor["pos"], mejor["ultimo"] = np.array(d.xy), k
            mejor["hits"] += 1
            mejor["dets"].append(d)
            n_eq = sum(1 for j in self.jugadores if j.equipo == eq)
            if mejor["hits"] >= 3:
                if n_eq < self.max:
                    self._uid += 1
                    j = Jugador(self._uid, eq, np.array(d.xy))
                    for dd in mejor["dets"]:
                        j.hist[dd.k] = (dd.xy[0], dd.xy[1], True, dd.caja)
                        j.votos[dd.color] += 1
                    self.jugadores.append(j)
                else:
                    # Equipo completo: el jugador que lleva más tiempo sin verse pasa a ser este.
                    perdidos = [j for j in self.jugadores if j.equipo == eq and j.perdido * self.dt > 1.0]
                    if perdidos:
                        j = max(perdidos, key=lambda j: j.perdido)
                        j.pos, j.vel, j.perdido = np.array(d.xy), np.zeros(2), 0
                        j.hist[k] = (d.xy[0], d.xy[1], True, d.caja)
                self.candidatos = [c for c in self.candidatos if c is not mejor]


def posicion_en(j: Jugador, k: int, ventana: int):
    """(x, y, estimada, caja) en el cuadro k: mediana de lo visto en ±ventana; si no, lo arrastrado."""
    vistos = [j.hist[i] for i in range(k - ventana, k + ventana + 1) if i in j.hist and j.hist[i][2]]
    if vistos:
        xy = np.median(np.array([(v[0], v[1]) for v in vistos]), 0)
        caja = j.hist[k][3] if k in j.hist and j.hist[k][2] else vistos[0][3]
        return float(xy[0]), float(xy[1]), False, caja
    # Sin verse: interpolación entre la última y la próxima vez que se vio (si las hay).
    antes = [i for i, v in j.hist.items() if i < k and v[2]]
    despues = [i for i, v in j.hist.items() if i > k and v[2]]
    if antes and despues:
        a, b = max(antes), min(despues)
        w = (k - a) / (b - a)
        pa, pb = np.array(j.hist[a][:2]), np.array(j.hist[b][:2])
        p = pa + (pb - pa) * w
        return float(p[0]), float(p[1]), True, None
    if antes or despues:
        i = max(antes) if antes else min(despues)
        return float(j.hist[i][0]), float(j.hist[i][1]), True, None
    return None
