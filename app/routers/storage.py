import shutil
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

import psutil
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.database import BASE_DIR, DB_PATH, get_db
from app.services.cover_storage import COVERS_DIR

router = APIRouter(prefix="/api/storage", tags=["storage"])

CERTS_DIR = BASE_DIR / "certs"

# Oberste Projektordner/-dateien, die über die App gefahrlos gelöscht werden
# dürfen: reine Build-Artefakte, die beim naechsten "Installer bauen" automatisch
# neu heruntergeladen bzw. neu erstellt werden. Alles, was hier NICHT drinsteht,
# wird zum Betrieb der App gebraucht und darf nicht über die App geloescht werden.
_DELETABLE_ENTRIES = {
    "installer": (
        "Wird nur zum Erstellen der Installationsdatei gebraucht, nicht zum "
        "taeglichen Betrieb der App. Beim naechsten Bauen des Installers werden "
        "die Werkzeuge automatisch neu heruntergeladen."
    ),
}


def _dir_stats(path: Path) -> tuple[int, int]:
    if not path.exists():
        return 0, 0
    total = 0
    count = 0
    for f in path.rglob("*"):
        if f.is_file():
            try:
                total += f.stat().st_size
            except OSError:
                continue
            count += 1
    return total, count


def _project_breakdown() -> list[dict]:
    """Größe jedes obersten Ordners/Datei im Programmordner (BASE_DIR)."""
    items = []
    for entry in BASE_DIR.iterdir():
        if entry.is_dir():
            size, _ = _dir_stats(entry)
        elif entry.is_file():
            try:
                size = entry.stat().st_size
            except OSError:
                size = 0
        else:
            continue
        reason = _DELETABLE_ENTRIES.get(entry.name)
        items.append({
            "name": entry.name,
            "bytes": size,
            "is_dir": entry.is_dir(),
            "deletable": reason is not None,
            "delete_reason": reason,
        })
    items.sort(key=lambda i: i["bytes"], reverse=True)
    return items


def _db_bytes() -> int:
    total = 0
    for suffix in ("", "-wal", "-shm"):
        p = Path(str(DB_PATH) + suffix)
        if p.exists():
            total += p.stat().st_size
    return total


def _ram_bytes() -> int:
    try:
        return psutil.Process().memory_info().rss
    except Exception:
        return 0


@router.get("/summary")
def storage_summary(db: sqlite3.Connection = Depends(get_db)):
    covers_bytes, covers_count = _dir_stats(COVERS_DIR)
    certs_bytes, _ = _dir_stats(CERTS_DIR)
    db_bytes = _db_bytes()

    book_count = db.execute("SELECT COUNT(*) AS c FROM books").fetchone()["c"]
    history_count = db.execute("SELECT COUNT(*) AS c FROM book_history").fetchone()["c"]

    project_breakdown = _project_breakdown()
    project_bytes = sum(item["bytes"] for item in project_breakdown)

    return {
        "install_path": str(BASE_DIR),
        "ram_bytes": _ram_bytes(),
        "db_bytes": db_bytes,
        "covers_bytes": covers_bytes,
        "covers_count": covers_count,
        "certs_bytes": certs_bytes,
        "total_bytes": db_bytes + covers_bytes + certs_bytes,
        "project_bytes": project_bytes,
        "project_breakdown": project_breakdown,
        "book_count": book_count,
        "history_count": history_count,
    }


@router.delete("/project-item/{name}")
def delete_project_item(name: str):
    if name not in _DELETABLE_ENTRIES:
        raise HTTPException(status_code=400, detail="Dieser Ordner kann nicht über die App gelöscht werden.")

    target = BASE_DIR / name
    if target.parent.resolve() != BASE_DIR.resolve() or not target.exists():
        raise HTTPException(status_code=404, detail="Ordner nicht gefunden.")

    if target.is_dir():
        shutil.rmtree(target)
    else:
        target.unlink()
    return {"deleted": name}


class HistoryCleanupRequest(BaseModel):
    older_than_days: int


@router.post("/cleanup-history")
def cleanup_history(payload: HistoryCleanupRequest, db: sqlite3.Connection = Depends(get_db)):
    if payload.older_than_days < 1:
        raise HTTPException(status_code=400, detail="Ungültiger Zeitraum")
    cutoff = (datetime.now(timezone.utc) - timedelta(days=payload.older_than_days)).isoformat()
    cursor = db.execute("DELETE FROM book_history WHERE changed_at < ?", (cutoff,))
    db.commit()
    return {"deleted": cursor.rowcount}
