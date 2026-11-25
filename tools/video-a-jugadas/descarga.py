"""Descarga de un tramo de video con yt-dlp + ffmpeg (el de imageio-ffmpeg)."""
from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path


def ffmpeg_exe(dir_bin: Path) -> Path:
    """Copia el ffmpeg de imageio-ffmpeg como bin/ffmpeg.exe para que yt-dlp lo reconozca."""
    import imageio_ffmpeg

    origen = Path(imageio_ffmpeg.get_ffmpeg_exe())
    dir_bin.mkdir(parents=True, exist_ok=True)
    destino = dir_bin / ("ffmpeg.exe" if sys.platform == "win32" else "ffmpeg")
    if not destino.exists() or destino.stat().st_size != origen.stat().st_size:
        shutil.copy2(origen, destino)
    return destino


def a_segundos(t: str) -> float:
    """'01:57' / '1:02:03' / '12.5' -> segundos."""
    partes = [float(p) for p in str(t).split(":")]
    s = 0.0
    for p in partes:
        s = s * 60 + p
    return s


def descargar_tramo(url: str, inicio: str, fin: str, destino: Path, dir_bin: Path, alto_max: int = 1080) -> Path:
    """Descarga [inicio, fin] del video en la mejor calidad <= alto_max (solo imagen)."""
    destino.parent.mkdir(parents=True, exist_ok=True)
    if destino.exists() and destino.stat().st_size > 0:
        return destino
    ff = ffmpeg_exe(dir_bin)
    a, b = a_segundos(inicio), a_segundos(fin)
    cmd = [
        sys.executable, "-m", "yt_dlp",
        "--no-playlist",
        "-f", f"bv*[height<={alto_max}][ext=mp4]/bv*[height<={alto_max}]/b[height<={alto_max}]/b",
        "--download-sections", f"*{a:.2f}-{b:.2f}",
        "--force-keyframes-at-cuts",
        "--ffmpeg-location", str(ff.parent),
        "--remux-video", "mp4",
        "--no-progress", "--downloader-args", "ffmpeg:-loglevel error",
        "-o", str(destino.with_suffix("")) + ".%(ext)s",
        url,
    ]
    print("[descarga]", " ".join(cmd[3:]))
    subprocess.run(cmd, check=True)
    candidatos = sorted(destino.parent.glob(destino.stem + ".*"))
    videos = [c for c in candidatos if c.suffix.lower() in (".mp4", ".mkv", ".webm")]
    if not videos:
        raise RuntimeError("yt-dlp terminó sin dejar un archivo de video")
    if videos[0] != destino:
        videos[0].replace(destino)
    return destino
