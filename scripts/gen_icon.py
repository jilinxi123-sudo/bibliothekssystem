"""Erzeugt das App-Icon (Favicon/Fenster-Icon) aus den bestehenden CSS-Farben.

Wird einmalig ausgeführt (oder erneut, falls das Icon angepasst werden soll):
    python scripts/gen_icon.py
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "app" / "static"

# Farben aus app/static/css/style.css (:root)
COLOR_PRIMARY = "#6FA287"
COLOR_PRIMARY_DARK = "#588C71"
COLOR_TEXT = "#3F4A42"
COLOR_PAGE = "#FBFCF9"
COLOR_LEMON = "#F5E28C"

CANVAS = 256


def build_icon() -> Image.Image:
    img = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Abgerundetes quadratisches Hintergrund-Badge in Grün.
    pad = 8
    draw.rounded_rectangle(
        [pad, pad, CANVAS - pad, CANVAS - pad],
        radius=56,
        fill=COLOR_PRIMARY,
    )

    # Aufgeschlagenes Buch: zwei leicht geneigte "Seiten", die sich mittig treffen.
    cx = CANVAS / 2
    top_y = 88
    bottom_outer_y = 176
    bottom_inner_y = 196
    half_width = 78

    left_page = [
        (cx - half_width, top_y),
        (cx, top_y + 10),
        (cx, bottom_inner_y),
        (cx - half_width, bottom_outer_y),
    ]
    right_page = [
        (cx + half_width, top_y),
        (cx, top_y + 10),
        (cx, bottom_inner_y),
        (cx + half_width, bottom_outer_y),
    ]

    draw.polygon(left_page, fill=COLOR_PAGE, outline=COLOR_PRIMARY_DARK)
    draw.polygon(right_page, fill=COLOR_PAGE, outline=COLOR_PRIMARY_DARK)

    # Seitenlinien als Andeutung von Textzeilen.
    for i in range(3):
        offset = 24 + i * 20
        draw.line(
            [(cx - half_width + 16, top_y + 34 + offset * 0.55),
             (cx - 10, top_y + 20 + offset * 0.7)],
            fill=COLOR_PRIMARY_DARK, width=3,
        )
        draw.line(
            [(cx + half_width - 16, top_y + 34 + offset * 0.55),
             (cx + 10, top_y + 20 + offset * 0.7)],
            fill=COLOR_PRIMARY_DARK, width=3,
        )

    # Buchrücken in der Mitte.
    draw.line([(cx, top_y + 6), (cx, bottom_inner_y)], fill=COLOR_TEXT, width=4)

    # Kleines Lesezeichen als Farbtupfer.
    ribbon_w = 16
    draw.polygon(
        [
            (cx - ribbon_w / 2, 40),
            (cx + ribbon_w / 2, 40),
            (cx + ribbon_w / 2, 96),
            (cx, 84),
            (cx - ribbon_w / 2, 96),
        ],
        fill=COLOR_LEMON,
        outline=COLOR_PRIMARY_DARK,
    )

    return img


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    STATIC_DIR.mkdir(parents=True, exist_ok=True)
    icon = build_icon()

    png_path = STATIC_DIR / "icon-256.png"
    icon.save(png_path, "PNG")

    ico_path = STATIC_DIR / "icon.ico"
    icon.save(
        ico_path,
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )

    # Zusaetzliche Groessen fuer das PWA-Manifest (Installierbarkeits-Kriterien
    # der Browser verlangen u. a. 192x192 und 512x512).
    icon.resize((192, 192), Image.LANCZOS).save(STATIC_DIR / "icon-192.png", "PNG")
    icon.resize((512, 512), Image.LANCZOS).save(STATIC_DIR / "icon-512.png", "PNG")

    print(f"Icon gespeichert: {ico_path}")
    print(f"PNG gespeichert:  {png_path}")
    print(f"PWA-Icons gespeichert: icon-192.png, icon-512.png")


if __name__ == "__main__":
    main()
