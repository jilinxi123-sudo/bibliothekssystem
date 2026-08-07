import io

from PIL import Image

from app.database import BASE_DIR

COVERS_DIR = BASE_DIR / "data" / "covers"
MAX_DIMENSION = 1000
JPEG_QUALITY = 85


def save_cover_image(isbn: str, file_bytes: bytes) -> str:
    COVERS_DIR.mkdir(parents=True, exist_ok=True)

    image = Image.open(io.BytesIO(file_bytes))
    image = image.convert("RGB")
    image.thumbnail((MAX_DIMENSION, MAX_DIMENSION))

    filename = f"{isbn}.jpg"
    image.save(COVERS_DIR / filename, "JPEG", quality=JPEG_QUALITY)
    return f"/covers/{filename}"
