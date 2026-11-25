"""Convierte posiciones en metros (por paso) en una JUGADA del formato de Pizarra Ultimate."""
from __future__ import annotations

import math
import time
from dataclasses import dataclass, field

LARGO, ANCHO = 100.0, 37.0
MAX_POR_EQUIPO = 7
UMBRAL_FLECHA_M = 2.0  # desplazamientos menores no llevan flecha


@dataclass
class Posicion:
    x: float
    y: float
    confianza: float  # 0..1
    estimada: bool = False  # True si no se vio en ese paso y se interpoló / arrastró


@dataclass
class PasoCrudo:
    """Posiciones de un paso en metros de cancha, ya en la dirección final (ataque a la derecha)."""
    nombre: str  # "formación inicial", "arranque del corte", ...
    t_video: float  # segundo del video original
    posiciones: dict[str, Posicion] = field(default_factory=dict)  # id final (a1, d3) -> posición
    poseedor: str | None = None
    poseedor_confianza: float = 0.0
    confianza_homografia: float = 0.0
    notas: list[str] = field(default_factory=list)


def reflejar(x: float, y: float) -> tuple[float, float]:
    return LARGO - x, ANCHO - y


def _r(v: float) -> float:
    return round(float(v), 2)


def _limitar(v: float) -> float:
    return max(-50.0, min(150.0, v))


def construir_jugada(
    pasos: list[PasoCrudo],
    *,
    id_jugada: str,
    nombre: str,
    etiquetas: list[str],
    notas: str,
    categoria: str = "Ataque",
) -> dict:
    ids = sorted({j for p in pasos for j in p.posiciones}, key=lambda s: (s[0] != "a", int(s[1:])))
    pasos_json = []
    for i, p in enumerate(pasos):
        jugadores = []
        for jid in ids:
            pos = p.posiciones.get(jid)
            if pos is None:
                continue
            jugadores.append({
                "id": jid,
                "equipo": "ataque" if jid.startswith("a") else "defensa",
                "etiqueta": jid[1:],
                "x": _r(_limitar(pos.x)),
                "y": _r(_limitar(pos.y)),
            })
        if p.poseedor and p.poseedor in p.posiciones:
            pp = p.posiciones[p.poseedor]
            disco = {"x": _r(pp.x + 0.95), "y": _r(pp.y - 0.95), "poseedorId": p.poseedor}
        else:
            disco = {"x": _r(LARGO / 2), "y": _r(ANCHO / 2), "poseedorId": None}

        flechas = []
        if i + 1 < len(pasos):
            sig = pasos[i + 1]
            n = 1
            for jid in ids:
                a, b = p.posiciones.get(jid), sig.posiciones.get(jid)
                if a is None or b is None:
                    continue
                if math.hypot(b.x - a.x, b.y - a.y) < UMBRAL_FLECHA_M:
                    continue
                flechas.append({
                    "id": f"f{n}",
                    "tipo": "corte" if jid.startswith("a") else "defensa",
                    "desde": {"x": _r(_limitar(a.x)), "y": _r(_limitar(a.y))},
                    "hasta": {"x": _r(_limitar(b.x)), "y": _r(_limitar(b.y))},
                    "desdeId": jid,
                })
                n += 1
            # Pase: el disco cambia de poseedor entre este paso y el siguiente.
            if p.poseedor and sig.poseedor and p.poseedor != sig.poseedor \
                    and p.poseedor in p.posiciones and sig.poseedor in sig.posiciones:
                a, b = p.posiciones[p.poseedor], sig.posiciones[sig.poseedor]
                flechas.append({
                    "id": f"f{n}",
                    "tipo": "pase",
                    "desde": {"x": _r(a.x), "y": _r(a.y)},
                    "hasta": {"x": _r(b.x), "y": _r(b.y)},
                    "desdeId": p.poseedor,
                })
        pasos_json.append({
            "id": f"p{i + 1}",
            "jugadores": jugadores,
            "disco": disco,
            "flechas": flechas,
            "zonas": [],
            "textos": [],
        })

    ahora = int(time.time() * 1000)
    return {
        "id": id_jugada[:40],
        "nombre": nombre[:80],
        "categoria": categoria,
        "etiquetas": [e[:30] for e in etiquetas][:20],
        "notas": notas[:5000],
        "creada": ahora,
        "editada": ahora,
        "vista": "completa",
        "lado": "derecha",
        "orientacion": "horizontal",
        "pasos": pasos_json,
    }


def archivo(jugadas: list[dict]) -> dict:
    return {"formato": "pizarra-ultimate", "version": 1, "jugadas": jugadas}
