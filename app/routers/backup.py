import json
import sqlite3
import zipfile
from datetime import datetime
from io import BytesIO
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response

from app.database import get_db
from app.routers.books import now_iso
from app.services.cover_storage import COVERS_DIR

router = APIRouter(prefix="/api/backup", tags=["backup"])

BACKUP_VERSION = 1


def _export_filename() -> str:
    return f"Bibliothek-Backup-{datetime.now().strftime('%Y%m%d')}.zip"


@router.get("/export")
def export_backup(db: sqlite3.Connection = Depends(get_db)):
    books = [dict(r) for r in db.execute("SELECT * FROM books").fetchall()]
    theme_rows = db.execute("SELECT isbn, label FROM book_themes").fetchall()
    tags = [dict(r) for r in db.execute("SELECT kind, label, color FROM tags").fetchall()]
    history = [
        dict(r)
        for r in db.execute(
            "SELECT isbn, changed_at, field, old_value, new_value FROM book_history"
        ).fetchall()
    ]

    themes_by_isbn: dict[str, list[str]] = {}
    for row in theme_rows:
        themes_by_isbn.setdefault(row["isbn"], []).append(row["label"])
    for book in books:
        book["themes"] = themes_by_isbn.get(book["isbn"], [])

    payload = {
        "version": BACKUP_VERSION,
        "exported_at": datetime.now().isoformat(),
        "books": books,
        "tags": tags,
        "history": history,
    }

    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("backup.json", json.dumps(payload, ensure_ascii=False, indent=2))
        if COVERS_DIR.exists():
            for cover_path in COVERS_DIR.iterdir():
                if cover_path.is_file():
                    zf.write(cover_path, arcname=f"covers/{cover_path.name}")

    return Response(
        content=buffer.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{_export_filename()}"'},
    )


@router.post("/import")
async def import_backup(file: UploadFile = File(...), db: sqlite3.Connection = Depends(get_db)):
    content = await file.read()
    try:
        zf = zipfile.ZipFile(BytesIO(content))
        payload = json.loads(zf.read("backup.json").decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Ungültige Backup-Datei")

    books = payload.get("books") or []
    tags = payload.get("tags") or []
    history = payload.get("history") or []

    now = now_iso()
    books_imported = 0
    for book in books:
        isbn = (book.get("isbn") or "").strip()
        if not isbn:
            continue
        themes = [t for t in (book.get("themes") or []) if t]
        db.execute(
            """
            INSERT INTO books (
                isbn, title, author, publisher, published_year, cover_url, cover_image,
                source, location, notes, due_date, metadata_fetched, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(isbn) DO UPDATE SET
                title=excluded.title, author=excluded.author, publisher=excluded.publisher,
                published_year=excluded.published_year, cover_url=excluded.cover_url,
                cover_image=excluded.cover_image, source=excluded.source, location=excluded.location,
                notes=excluded.notes, due_date=excluded.due_date,
                metadata_fetched=excluded.metadata_fetched, updated_at=excluded.updated_at
            """,
            (
                isbn, book.get("title"), book.get("author"), book.get("publisher"),
                book.get("published_year"), book.get("cover_url"), book.get("cover_image"),
                book.get("source"), book.get("location"), book.get("notes"), book.get("due_date"),
                int(book.get("metadata_fetched") or 0),
                book.get("created_at") or now, book.get("updated_at") or now,
            ),
        )
        db.execute("DELETE FROM book_themes WHERE isbn = ?", (isbn,))
        db.executemany(
            "INSERT OR IGNORE INTO book_themes (isbn, label) VALUES (?, ?)",
            [(isbn, t) for t in themes],
        )
        books_imported += 1

    tags_imported = 0
    for tag in tags:
        kind = tag.get("kind")
        label = (tag.get("label") or "").strip()
        if kind not in ("source", "location", "theme") or not label:
            continue
        existing = db.execute(
            "SELECT id FROM tags WHERE kind = ? AND label = ?", (kind, label)
        ).fetchone()
        if existing is None:
            db.execute(
                "INSERT INTO tags (kind, label, color) VALUES (?, ?, ?)",
                (kind, label, tag.get("color")),
            )
            tags_imported += 1

    history_imported = 0
    for entry in history:
        isbn = (entry.get("isbn") or "").strip()
        changed_at = entry.get("changed_at")
        field = entry.get("field")
        if not isbn or not changed_at or not field:
            continue
        old_value = entry.get("old_value")
        new_value = entry.get("new_value")
        exists = db.execute(
            "SELECT 1 FROM book_history WHERE isbn = ? AND changed_at = ? AND field = ? "
            "AND IFNULL(old_value, '') = IFNULL(?, '') AND IFNULL(new_value, '') = IFNULL(?, '')",
            (isbn, changed_at, field, old_value, new_value),
        ).fetchone()
        if exists:
            continue
        db.execute(
            "INSERT INTO book_history (isbn, changed_at, field, old_value, new_value) VALUES (?, ?, ?, ?, ?)",
            (isbn, changed_at, field, old_value, new_value),
        )
        history_imported += 1

    covers_imported = 0
    COVERS_DIR.mkdir(parents=True, exist_ok=True)
    for name in zf.namelist():
        if not name.startswith("covers/") or name.endswith("/"):
            continue
        filename = Path(name).name
        if not filename:
            continue
        (COVERS_DIR / filename).write_bytes(zf.read(name))
        covers_imported += 1

    db.commit()

    return {
        "books": books_imported,
        "tags": tags_imported,
        "history": history_imported,
        "covers": covers_imported,
    }
