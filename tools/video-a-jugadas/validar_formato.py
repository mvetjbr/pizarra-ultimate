"""Validador estricto del formato de jugadas de Pizarra Ultimate.

Refleja las reglas de src/modelo/validar.ts y docs/FORMATO_JUGADAS.md, pero en vez de
corregir en silencio (como hace la app al importar) reporta cada problema:

- errores: el archivo no cumple el formato o la app descartaría / cambiaría datos.
- avisos: la app lo acepta, pero probablemente no es lo que se quería
  (p. ej. un jugador fuera de la cancha o un id que no aparece en todos los pasos).

Uso:  python validar_formato.py archivo.json [otro.json ...]
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

CATEGORIAS = ("Ataque", "Defensa", "Pull", "Zona", "Punto final", "Otro")
VISTAS = ("completa", "media", "zona")
LADOS = ("izquierda", "derecha")
ORIENTACIONES = ("horizontal", "vertical")
EQUIPOS = ("ataque", "defensa")
TIPOS_FLECHA = ("corte", "pase", "defensa")
LARGO, ANCHO = 100.0, 37.0
COORD_MIN, COORD_MAX = -50.0, 150.0
MAX_POR_EQUIPO = 7


class Resultado:
    def __init__(self) -> None:
        self.errores: list[str] = []
        self.avisos: list[str] = []

    def error(self, donde: str, msg: str) -> None:
        self.errores.append(f"{donde}: {msg}")

    def aviso(self, donde: str, msg: str) -> None:
        self.avisos.append(f"{donde}: {msg}")

    @property
    def ok(self) -> bool:
        return not self.errores


def _es_num(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def _id_valido(v) -> bool:
    return isinstance(v, str) and 0 < len(v) <= 40


def _punto(r: Resultado, donde: str, v, en_cancha: bool = False) -> None:
    if not isinstance(v, dict):
        r.error(donde, "debe ser un objeto {x, y}")
        return
    for k in ("x", "y"):
        if not _es_num(v.get(k)):
            r.error(donde, f"'{k}' debe ser un número")
        elif not COORD_MIN <= v[k] <= COORD_MAX:
            r.error(donde, f"'{k}'={v[k]} fuera del rango aceptado [-50, 150]")
    if en_cancha and _es_num(v.get("x")) and _es_num(v.get("y")):
        if not (0 <= v["x"] <= LARGO and 0 <= v["y"] <= ANCHO):
            r.aviso(donde, f"({v['x']}, {v['y']}) queda fuera de la cancha 100 x 37")


def _texto(r: Resultado, donde: str, v, maximo: int, obligatorio: bool = True) -> None:
    if v is None and not obligatorio:
        return
    if not isinstance(v, str):
        r.error(donde, "debe ser texto")
    elif len(v) > maximo:
        r.error(donde, f"máximo {maximo} caracteres (tiene {len(v)}); la app lo recortaría")


def validar_jugador(r: Resultado, donde: str, j) -> str | None:
    if not isinstance(j, dict):
        r.error(donde, "el jugador debe ser un objeto")
        return None
    if not _id_valido(j.get("id")):
        r.error(donde, "'id' debe ser texto de 1 a 40 caracteres")
    if j.get("equipo") not in EQUIPOS:
        r.error(donde, f"'equipo' debe ser uno de {EQUIPOS}")
    et = j.get("etiqueta")
    if not isinstance(et, str) or not 1 <= len(et) <= 3:
        r.error(donde, "'etiqueta' debe tener de 1 a 3 caracteres")
    if "match" in j and j["match"] not in ("M", "F"):
        r.error(donde, "'match' debe ser 'M' o 'F' (u omitirse)")
    if "nombre" in j:
        _texto(r, f"{donde}.nombre", j["nombre"], 40)
    _punto(r, donde, j, en_cancha=True)
    return j.get("id") if _id_valido(j.get("id")) else None


def validar_paso(r: Resultado, donde: str, p) -> dict[str, str]:
    """Devuelve {id_jugador: equipo} del paso."""
    if not isinstance(p, dict):
        r.error(donde, "el paso debe ser un objeto")
        return {}
    if not _id_valido(p.get("id")):
        r.error(donde, "'id' debe ser texto de 1 a 40 caracteres")
    jugadores = p.get("jugadores")
    equipos: dict[str, str] = {}
    if not isinstance(jugadores, list):
        r.error(donde, "'jugadores' debe ser una lista")
        jugadores = []
    if len(jugadores) > 30:
        r.error(donde, "máximo 30 jugadores por paso")
    for i, j in enumerate(jugadores):
        jid = validar_jugador(r, f"{donde}.jugadores[{i}]", j)
        if jid is None:
            continue
        if jid in equipos:
            r.error(donde, f"id de jugador repetido: {jid}")
        equipos[jid] = j.get("equipo")
    for eq in EQUIPOS:
        n = sum(1 for e in equipos.values() if e == eq)
        if n > MAX_POR_EQUIPO:
            r.error(donde, f"{n} jugadores de {eq}; máximo {MAX_POR_EQUIPO} por equipo")

    disco = p.get("disco")
    if not isinstance(disco, dict):
        r.error(donde, "'disco' debe ser un objeto {x, y, poseedorId}")
    else:
        _punto(r, f"{donde}.disco", disco)
        pos = disco.get("poseedorId")
        if pos is not None:
            if not isinstance(pos, str) or pos not in equipos:
                r.error(f"{donde}.disco", f"poseedorId '{pos}' no es un jugador de este paso")

    flechas = p.get("flechas", [])
    if not isinstance(flechas, list):
        r.error(donde, "'flechas' debe ser una lista")
        flechas = []
    if len(flechas) > 60:
        r.error(donde, "máximo 60 flechas por paso")
    ids_f = set()
    for i, f in enumerate(flechas):
        d = f"{donde}.flechas[{i}]"
        if not isinstance(f, dict):
            r.error(d, "la flecha debe ser un objeto")
            continue
        if not _id_valido(f.get("id")):
            r.error(d, "'id' debe ser texto de 1 a 40 caracteres")
        elif f["id"] in ids_f:
            r.error(d, f"id de flecha repetido: {f['id']}")
        else:
            ids_f.add(f["id"])
        if f.get("tipo") not in TIPOS_FLECHA:
            r.error(d, f"'tipo' debe ser uno de {TIPOS_FLECHA}")
        _punto(r, f"{d}.desde", f.get("desde"))
        _punto(r, f"{d}.hasta", f.get("hasta"))
        for k in ("desdeId", "hastaId"):
            if k in f and f[k] is not None and f[k] not in equipos:
                r.aviso(d, f"{k} '{f[k]}' no es un jugador de este paso")
        if "curva" in f and not isinstance(f["curva"], bool):
            r.error(d, "'curva' debe ser true o false")
        if f.get("curva") is True:
            if f.get("tipo") != "pase":
                r.aviso(d, "solo los pases pueden ser curvos")
            if "control" not in f:
                r.error(d, "un pase curvo necesita 'control'")
        if "control" in f:
            _punto(r, f"{d}.control", f["control"])
        tipo = f.get("tipo")
        quien = equipos.get(f.get("desdeId")) if isinstance(f.get("desdeId"), str) else None
        if tipo == "corte" and quien == "defensa":
            r.aviso(d, "flecha 'corte' que sale de un defensor (¿debería ser 'defensa'?)")
        if tipo == "defensa" and quien == "ataque":
            r.aviso(d, "flecha 'defensa' que sale de un atacante (¿debería ser 'corte'?)")

    for clave, maximo in (("zonas", 30), ("textos", 30)):
        v = p.get(clave, [])
        if not isinstance(v, list):
            r.error(donde, f"'{clave}' debe ser una lista")
        elif len(v) > maximo:
            r.error(donde, f"máximo {maximo} {clave}")
    for i, z in enumerate(p.get("zonas", []) or []):
        d = f"{donde}.zonas[{i}]"
        if not isinstance(z, dict) or z.get("forma") not in ("rect", "elipse"):
            r.error(d, "zona inválida ('forma' debe ser 'rect' o 'elipse')")
            continue
        _punto(r, d, z)
    for i, t in enumerate(p.get("textos", []) or []):
        d = f"{donde}.textos[{i}]"
        if not isinstance(t, dict):
            r.error(d, "texto inválido")
            continue
        _texto(r, d + ".texto", t.get("texto"), 200)
        _punto(r, d, t)
    return equipos


def validar_jugada(r: Resultado, donde: str, j) -> None:
    if not isinstance(j, dict):
        r.error(donde, "la jugada debe ser un objeto")
        return
    if not _id_valido(j.get("id")):
        r.error(donde, "'id' debe ser texto de 1 a 40 caracteres")
    _texto(r, f"{donde}.nombre", j.get("nombre"), 80)
    if isinstance(j.get("nombre"), str) and not j["nombre"].strip():
        r.error(f"{donde}.nombre", "no puede estar vacío")
    if j.get("categoria") not in CATEGORIAS:
        r.error(donde, f"'categoria' debe ser uno de {CATEGORIAS}")
    et = j.get("etiquetas", [])
    if not isinstance(et, list) or not all(isinstance(e, str) for e in et):
        r.error(donde, "'etiquetas' debe ser una lista de textos")
    else:
        if len(et) > 20:
            r.error(donde, "máximo 20 etiquetas")
        for e in et:
            if len(e) > 30:
                r.error(donde, f"etiqueta '{e[:20]}…' supera 30 caracteres")
    _texto(r, f"{donde}.notas", j.get("notas", ""), 5000)
    for k in ("creada", "editada"):
        if k in j and not _es_num(j[k]):
            r.error(donde, f"'{k}' debe ser una fecha en milisegundos (número)")
    for k, opciones in (("vista", VISTAS), ("lado", LADOS), ("orientacion", ORIENTACIONES)):
        if k in j and j[k] not in opciones:
            r.error(donde, f"'{k}' debe ser uno de {opciones}")

    pasos = j.get("pasos")
    if not isinstance(pasos, list) or not pasos:
        r.error(donde, "'pasos' debe ser una lista con al menos un paso")
        return
    if len(pasos) > 100:
        r.error(donde, "máximo 100 pasos")
    por_paso = [validar_paso(r, f"{donde}.pasos[{i}]", p) for i, p in enumerate(pasos)]
    ids_pasos = [p.get("id") for p in pasos if isinstance(p, dict)]
    if len(set(ids_pasos)) != len(ids_pasos):
        r.error(donde, "hay ids de paso repetidos")

    # Regla clave: el mismo jugador lleva el mismo id (y equipo) en todos los pasos.
    todos = set().union(*[set(e) for e in por_paso]) if por_paso else set()
    for jid in sorted(todos):
        eqs = {e[jid] for e in por_paso if jid in e}
        if len(eqs) > 1:
            r.error(donde, f"el jugador {jid} cambia de equipo entre pasos: {sorted(eqs)}")
        faltan = [i + 1 for i, e in enumerate(por_paso) if jid not in e]
        if faltan:
            r.aviso(donde, f"el jugador {jid} no aparece en los pasos {faltan}; la app no podrá animarlo")


def jugadas_de(datos) -> list:
    if isinstance(datos, list):
        return datos
    if isinstance(datos, dict) and isinstance(datos.get("jugadas"), list):
        return datos["jugadas"]
    return [datos]


def validar(datos) -> Resultado:
    r = Resultado()
    if isinstance(datos, dict) and "jugadas" in datos:
        if datos.get("formato") != "pizarra-ultimate":
            r.error("raíz", "'formato' debe ser 'pizarra-ultimate'")
        if datos.get("version") != 1:
            r.error("raíz", "'version' debe ser 1")
    jugadas = jugadas_de(datos)
    if not jugadas:
        r.error("raíz", "no hay jugadas")
    if len(jugadas) > 1000:
        r.error("raíz", "máximo 1000 jugadas por archivo")
    ids = [j.get("id") for j in jugadas if isinstance(j, dict)]
    if len(set(ids)) != len(ids):
        r.aviso("raíz", "hay ids de jugada repetidos")
    for i, j in enumerate(jugadas):
        validar_jugada(r, f"jugadas[{i}]", j)
    return r


def validar_archivo(ruta: str | Path) -> Resultado:
    try:
        datos = json.loads(Path(ruta).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        r = Resultado()
        r.error(str(ruta), f"no es un JSON válido: {e}")
        return r
    return validar(datos)


def main(argv: list[str]) -> int:
    if not argv:
        print(__doc__)
        return 2
    codigo = 0
    for ruta in argv:
        r = validar_archivo(ruta)
        estado = "OK" if r.ok else "INVÁLIDO"
        print(f"{ruta}: {estado} ({len(r.errores)} errores, {len(r.avisos)} avisos)")
        for e in r.errores:
            print(f"  ERROR  {e}")
        for a in r.avisos:
            print(f"  aviso  {a}")
        if not r.ok:
            codigo = 1
    return codigo


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
