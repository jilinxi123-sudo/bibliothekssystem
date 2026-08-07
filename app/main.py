import socket
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.database import init_db
from app.routers import backup, books, calendar, export, lookup, storage, system, tags
from app.services.cover_storage import COVERS_DIR

STATIC_DIR = Path(__file__).resolve().parent / "static"
PORT = 8000


COVERS_DIR.mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Bibliothekssystem", lifespan=lifespan)

app.include_router(books.router)
app.include_router(lookup.router)
app.include_router(export.router)
app.include_router(tags.router)
app.include_router(calendar.router)
app.include_router(backup.router)
app.include_router(system.router)
app.include_router(storage.router)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
app.mount("/covers", StaticFiles(directory=COVERS_DIR), name="covers")


@app.get("/")
def scan_page():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/katalog")
def katalog_page():
    return FileResponse(STATIC_DIR / "katalog.html")


@app.get("/speicher")
def speicher_page():
    return FileResponse(STATIC_DIR / "speicher.html")


def _lan_ip() -> str:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


@app.get("/api/lan-info")
def lan_info():
    ip = _lan_ip()
    return {"ip": ip, "url": f"https://{ip}:{PORT}"}
