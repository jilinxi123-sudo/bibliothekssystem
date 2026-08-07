"""Erzeugt die Bitmaps fuer den NSIS-Installer (Willkommens-/Header-Bild) im
Farbschema der App (macaron-lemon/mint/sky-Verlauf, Grün als Primaerfarbe).
Nutzt dasselbe Icon-Motiv wie scripts/gen_icon.py, damit Installer und App
gleich aussehen.

Einmalig ausfuehren (oder erneut bei Design-Aenderungen):
    python installer/gen_installer_assets.py
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR / "scripts"))
from gen_icon import build_icon  # noqa: E402

ASSETS_DIR = Path(__file__).resolve().parent / "assets"
FONT_PATH = BASE_DIR / "app" / "assets" / "fonts" / "DejaVuSans-Bold.ttf"

# Farben aus app/static/css/style.css (:root)
COLOR_TEXT = (63, 74, 66)
COLOR_LEMON = (245, 226, 140)
COLOR_MINT = (168, 223, 201)
COLOR_SKY = (169, 211, 236)
COLOR_SURFACE = (255, 255, 255)
COLOR_PRIMARY = (111, 162, 135)

# Standardgroessen fuer NSIS MUI2 (MUI_WELCOMEFINISHPAGE_BITMAP / MUI_HEADERIMAGE_BITMAP)
WELCOME_SIZE = (164, 314)
HEADER_SIZE = (150, 57)


def _vertical_gradient(size, stops):
    w, h = size
    n = len(stops) - 1
    rows = []
    for y in range(h):
        t = y / max(h - 1, 1)
        seg = min(int(t * n), n - 1)
        seg_t = (t * n) - seg
        c0, c1 = stops[seg], stops[seg + 1]
        rows.append(tuple(int(c0[i] + (c1[i] - c0[i]) * seg_t) for i in range(3)))
    img = Image.new("RGB", size)
    px = img.load()
    for y, color in enumerate(rows):
        for x in range(w):
            px[x, y] = color
    return img


def build_welcome_bitmap() -> Image.Image:
    img = _vertical_gradient(WELCOME_SIZE, [COLOR_LEMON, COLOR_MINT, COLOR_SKY]).convert("RGBA")

    icon = build_icon().resize((108, 108), Image.LANCZOS)
    icon_x = (WELCOME_SIZE[0] - icon.width) // 2
    icon_y = 40
    img.alpha_composite(icon, (icon_x, icon_y))

    draw = ImageDraw.Draw(img)
    font = ImageFont.truetype(str(FONT_PATH), 20)
    text = "Bibliothek"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    draw.text(((WELCOME_SIZE[0] - text_w) / 2, icon_y + icon.height + 20), text, fill=COLOR_TEXT, font=font)

    return img.convert("RGB")


def build_header_bitmap() -> Image.Image:
    img = Image.new("RGB", HEADER_SIZE, COLOR_SURFACE)
    draw = ImageDraw.Draw(img)
    draw.line([(0, HEADER_SIZE[1] - 2), (HEADER_SIZE[0], HEADER_SIZE[1] - 2)], fill=COLOR_PRIMARY, width=2)

    icon = build_icon().resize((40, 40), Image.LANCZOS)
    icon_pos = (HEADER_SIZE[0] - icon.width - 10, (HEADER_SIZE[1] - icon.height) // 2 - 1)
    img.paste(icon, icon_pos, icon)
    return img


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    ASSETS_DIR.mkdir(parents=True, exist_ok=True)

    welcome_path = ASSETS_DIR / "welcome.bmp"
    build_welcome_bitmap().save(welcome_path, "BMP")
    print(f"Gespeichert: {welcome_path}")

    header_path = ASSETS_DIR / "header.bmp"
    build_header_bitmap().save(header_path, "BMP")
    print(f"Gespeichert: {header_path}")


if __name__ == "__main__":
    main()
