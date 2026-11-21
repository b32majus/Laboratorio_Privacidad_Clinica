#!/usr/bin/env python3
"""Genera láminas maestro / V4 F8 / propuesta R3 a partir de activos del mismo repositorio.

Solo imágenes sintéticas ya versionadas; ninguna fuente ni dato clínico real.
El maestro es ilustrativo, no un contrato de flujo ni un estado idéntico al trabajo V4.
No altera originales ni archivos de app-v4.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps
from hashlib import sha256

here = Path(__file__).resolve().parent
repo = here.parents[2]       # repo root: docs/evidence/<artifact> -> repo
f8 = here.parent / "issue92-f8"
assert (f8 / "README.md").is_file()
output = here / "comparaciones"
output.mkdir(exist_ok=True)

for view in ("revision", "celdas", "resultado"):
    name = "resultado-listo" if view == "resultado" else view
    for w in (1440, 375):
        images = [
            f8 / "referencias" / f"{view}-{w}.png",
            f8 / "actual" / f"{view}-{w}-viewport.png",
            here / "capturas" / f"{name}-{w}.png",
        ]
        for img in images:
            assert img.is_file(), img
        cw, ch = (760, 475) if w == 1440 else (375, 800)
        outer = 14
        heading = 58
        width = len(images) * (cw + outer) + outer
        canvas = Image.new("RGB", (width, ch + heading + outer), (239, 234, 230))
        pen = ImageDraw.Draw(canvas)
        titles = ("01 · MAESTRO APROBADO", "02 · V4 EN F8", "03 · PROPUESTA R3")
        for i, (source, title) in enumerate(zip(images, titles)):
            x = outer + i * (cw + outer)
            pen.text((x+4, 10), title, fill=(43, 42, 43))
            pen.text((x+4, 29), f"{view.capitalize()} · {w}px", fill=(104, 100, 98))
            screenshot = Image.open(source).convert("RGB")
            if w == 1440:
                screenshot = ImageOps.contain(screenshot, (cw, ch), Image.Resampling.LANCZOS)
            else:
                screenshot = screenshot.crop((0, 0, min(screenshot.width, cw), min(screenshot.height, ch)))
            canvas.paste(screenshot, (x, heading))
        p = output / f"{view}-{w}-comparacion.png"
        canvas.save(p, optimize=True)
        print(p.name, p.stat().st_size)
