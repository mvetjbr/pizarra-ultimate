"""Clases de YOLO (COCO) y clasificación de equipo por color de camiseta."""
from __future__ import annotations

import cv2
import numpy as np

CLASE_PERSONA = 0
CLASE_FRISBEE = 29  # COCO "frisbee"


def color_camiseta(img: np.ndarray, caja) -> tuple[str, float, float]:
    """Clasifica el torso: devuelve (etiqueta, fracción blanca, fracción roja/negra).

    etiqueta: "blanco", "oscuro" (rojo o negro) o "?" si no es claro.
    """
    h_img, w_img = img.shape[:2]
    x1, y1, x2, y2 = caja
    w, h = x2 - x1, y2 - y1
    # Torso: 18%-50% de la altura, 30%-70% del ancho (evita brazos, cabeza y pasto).
    tx1, tx2 = int(max(0, x1 + 0.3 * w)), int(min(w_img, x1 + 0.7 * w))
    ty1, ty2 = int(max(0, y1 + 0.18 * h)), int(min(h_img, y1 + 0.5 * h))
    if tx2 - tx1 < 2 or ty2 - ty1 < 2:
        return "?", 0.0, 0.0
    hsv = cv2.cvtColor(img[ty1:ty2, tx1:tx2], cv2.COLOR_BGR2HSV).reshape(-1, 3).astype(np.float32)
    hh, s, v = hsv[:, 0], hsv[:, 1] / 255, hsv[:, 2] / 255
    pasto = (hh > 8) & (hh < 90) & (s > 0.12) & (s < 0.5) & (v < 0.75)  # verde o seco
    validos = ~pasto
    n = max(1, int(validos.sum()))
    blanco = ((s < 0.25) & (v > 0.6) & validos).sum() / n
    es_rojo = ((hh < 10) | (hh > 165)) & (s > 0.4) & (v > 0.2) & validos
    # Rosa (observadores, staff): mismo tono que el rojo pero mucho más brillante (V≈0.9 contra
    # V≈0.4-0.5 de una camiseta roja de equipo, medido en T Slash). No es de ningún equipo.
    if es_rojo.sum() >= 6 and float(np.median(v[es_rojo])) > 0.75:
        return "?", 0.0, 0.0
    rojo = es_rojo.sum() / n
    negro = ((v < 0.22) & validos).sum() / n
    oscuro = rojo + negro
    if validos.sum() < 6:
        return "?", blanco, oscuro
    if blanco > 0.35 and blanco > 1.5 * oscuro:
        return "blanco", blanco, oscuro
    if oscuro > 0.35 and oscuro > 1.5 * blanco:
        return "oscuro", blanco, oscuro
    return "?", blanco, oscuro
