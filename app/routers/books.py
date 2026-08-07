import sqlite3
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile

from app.database import get_db
from app.models import (
    BookListOut,
    BookOut,
    BookUpsert,
    BulkDueDateRequest,
    BulkIsbnRequest,
    BulkResult,
    HistoryEntry,
    HistoryUpdate,
    UpsertResponse,
)
from app.services.cover_storage import save_cover_image

router = APIRouter(prefix="/api/books", tags=["books"])

FIELD_LABELS = {
    "title": "Titel",
    "author": "Autor",
    "publisher": "Verlag",
    "published_year": "Erscheinungsjahr",
    "source": "Herkunft",
    "location": "Standort",
    "notes": "Notizen",
    "due_date": "Rückgabedatum",
    "cover_image": "Buchcover",
}


def _themes_for(db: sqlite3.Connection, isbn: str) -> list[str]:
    rows = db.execute(
        "SELECT label FROM book_themes WHERE isbn = ? ORDER BY label ASC", (isbn,)
    ).fetchall()
    return [r["label"] for r in rows]


def _themes_batch(db: sqlite3.Connection, isbns: list[str]) -> dict[str, list[str]]:
    if not isbns:
        return {}
    placeholders = ",".join("?" for _ in isbns)
    rows = db.execute(
        f"SELECT isbn, label FROM book_themes WHERE isbn IN ({placeholders}) ORDER BY label ASC",
        isbns,
    ).fetchall()
    result: dict[str, list[str]] = {}
    for row in rows:
        result.setdefault(row["isbn"], []).append(row["label"])
    return result


def history_batch(db: sqlite3.Connection, isbns: list[str]) -> dict[str, list[dict]]:
    if not isbns:
        return {}
    placeholders = ",".join("?" for _ in isbns)
    rows = db.execute(
        f"SELECT isbn, changed_at, field, old_value, new_value FROM book_history "
        f"WHERE isbn IN ({placeholders}) ORDER BY isbn, changed_at DESC, id DESC",
        isbns,
    ).fetchall()
    result: dict[str, list[dict]] = {}
    for row in rows:
        result.setdefault(row["isbn"], []).append(dict(row))
    return result


def _sync_themes(db: sqlite3.Connection, isbn: str, themes: list[str]) -> None:
    cleaned = sorted({t.strip() for t in themes if t and t.strip()})
    db.execute("DELETE FROM book_themes WHERE isbn = ?", (isbn,))
    db.executemany(
        "INSERT INTO book_themes (isbn, label) VALUES (?, ?)",
        [(isbn, label) for label in cleaned],
    )


def row_to_book(db: sqlite3.Connection, row: sqlite3.Row) -> BookOut:
    data = dict(row)
    data["metadata_fetched"] = bool(data["metadata_fetched"])
    data["themes"] = _themes_for(db, data["isbn"])
    return BookOut(**data)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _record_field_changes(
    db: sqlite3.Connection,
    isbn: str,
    old_row: sqlite3.Row,
    payload: BookUpsert,
    old_themes: list[str],
    new_themes: list[str],
) -> None:
    now = now_iso()
    entries = []

    for field, label in FIELD_LABELS.items():
        old_value = old_row[field]
        new_value = getattr(payload, field)
        if (old_value or None) != (new_value or None):
            entries.append((isbn, now, label, old_value, new_value))

    old_theme_set = set(old_themes)
    new_theme_set = set(new_themes)
    if old_theme_set != new_theme_set:
        entries.append((
            isbn, now, "Themen",
            ", ".join(sorted(old_theme_set)) or None,
            ", ".join(sorted(new_theme_set)) or None,
        ))

    if entries:
        db.executemany(
            "INSERT INTO book_history (isbn, changed_at, field, old_value, new_value) VALUES (?, ?, ?, ?, ?)",
            entries,
        )


def query_books(
    db: sqlite3.Connection,
    q: Optional[str] = None,
    location: Optional[list[str]] = None,
    source: Optional[list[str]] = None,
    theme: Optional[list[str]] = None,
    unenriched: Optional[bool] = None,
    limit: int = 1000,
    offset: int = 0,
) -> tuple[int, list[BookOut]]:
    clauses = []
    params: list = []

    if theme:
        placeholders = ",".join("?" for _ in theme)
        clauses.append(
            f"EXISTS (SELECT 1 FROM book_themes bt WHERE bt.isbn = books.isbn AND bt.label IN ({placeholders}))"
        )
        params.extend(theme)
    if q:
        for token in q.split():
            like = f"%{token}%"
            clauses.append(
                "(title LIKE ? OR author LIKE ? OR isbn LIKE ? OR publisher LIKE ? "
                "OR notes LIKE ? OR source LIKE ? OR location LIKE ? "
                "OR EXISTS (SELECT 1 FROM book_themes bt WHERE bt.isbn = books.isbn AND bt.label LIKE ?))"
            )
            params.extend([like, like, like, like, like, like, like, like])
    if location:
        placeholders = ",".join("?" for _ in location)
        clauses.append(f"location IN ({placeholders})")
        params.extend(location)
    if source:
        placeholders = ",".join("?" for _ in source)
        clauses.append(f"source IN ({placeholders})")
        params.extend(source)
    if unenriched:
        clauses.append("metadata_fetched = 0")

    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""

    total = db.execute(
        f"SELECT COUNT(*) AS c FROM books {where}", params
    ).fetchone()["c"]
    rows = db.execute(
        f"SELECT * FROM books {where} ORDER BY updated_at DESC LIMIT ? OFFSET ?",
        [*params, limit, offset],
    ).fetchall()

    isbns = [r["isbn"] for r in rows]
    themes_by_isbn = _themes_batch(db, isbns)
    items = []
    for r in rows:
        data = dict(r)
        data["metadata_fetched"] = bool(data["metadata_fetched"])
        data["themes"] = themes_by_isbn.get(data["isbn"], [])
        items.append(BookOut(**data))

    return total, items


def books_by_isbns(db: sqlite3.Connection, isbns: list[str]) -> list[BookOut]:
    if not isbns:
        return []
    placeholders = ",".join("?" for _ in isbns)
    rows = db.execute(
        f"SELECT * FROM books WHERE isbn IN ({placeholders})", isbns
    ).fetchall()
    by_isbn = {r["isbn"]: r for r in rows}
    themes_by_isbn = _themes_batch(db, isbns)
    items = []
    for isbn in isbns:
        row = by_isbn.get(isbn)
        if row is None:
            continue
        data = dict(row)
        data["metadata_fetched"] = bool(data["metadata_fetched"])
        data["themes"] = themes_by_isbn.get(isbn, [])
        items.append(BookOut(**data))
    return items


@router.get("", response_model=BookListOut)
def list_books(
    q: Optional[str] = None,
    location: Optional[list[str]] = Query(None),
    source: Optional[list[str]] = Query(None),
    theme: Optional[list[str]] = Query(None),
    unenriched: Optional[bool] = None,
    limit: int = 1000,
    offset: int = 0,
    db: sqlite3.Connection = Depends(get_db),
):
    total, items = query_books(db, q, location, source, theme, unenriched, limit, offset)
    return BookListOut(total=total, items=items)


@router.post("/bulk-delete", response_model=BulkResult)
def bulk_delete(payload: BulkIsbnRequest, db: sqlite3.Connection = Depends(get_db)):
    if not payload.isbns:
        return BulkResult(affected=0)
    placeholders = ",".join("?" for _ in payload.isbns)
    cursor = db.execute(f"DELETE FROM books WHERE isbn IN ({placeholders})", payload.isbns)
    db.commit()
    return BulkResult(affected=cursor.rowcount)


@router.post("/bulk-due-date", response_model=BulkResult)
def bulk_due_date(payload: BulkDueDateRequest, db: sqlite3.Connection = Depends(get_db)):
    if not payload.isbns:
        return BulkResult(affected=0)
    placeholders = ",".join("?" for _ in payload.isbns)
    cursor = db.execute(
        f"UPDATE books SET due_date = ?, updated_at = ? WHERE isbn IN ({placeholders})",
        [payload.due_date, now_iso(), *payload.isbns],
    )
    db.commit()
    return BulkResult(affected=cursor.rowcount)


@router.get("/{isbn}", response_model=BookOut)
def get_book(isbn: str, db: sqlite3.Connection = Depends(get_db)):
    row = db.execute("SELECT * FROM books WHERE isbn = ?", (isbn,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Nicht gefunden")
    return row_to_book(db, row)


@router.put("/{isbn}", response_model=UpsertResponse)
def upsert_book(
    isbn: str,
    payload: BookUpsert,
    response: Response,
    db: sqlite3.Connection = Depends(get_db),
):
    existing = db.execute("SELECT * FROM books WHERE isbn = ?", (isbn,)).fetchone()
    now = now_iso()
    old_themes = _themes_for(db, isbn) if existing is not None else []

    if existing is None:
        db.execute(
            """
            INSERT INTO books (
                isbn, title, author, publisher, published_year, cover_url, cover_image,
                source, location, notes, due_date, metadata_fetched, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                isbn, payload.title, payload.author, payload.publisher, payload.published_year,
                payload.cover_url, payload.cover_image, payload.source, payload.location,
                payload.notes, payload.due_date, int(payload.metadata_fetched), now, now,
            ),
        )
        response.status_code = 201
        created = True
    else:
        db.execute(
            """
            UPDATE books SET
                title = ?, author = ?, publisher = ?, published_year = ?, cover_url = ?, cover_image = ?,
                source = ?, location = ?, notes = ?, due_date = ?, metadata_fetched = ?, updated_at = ?
            WHERE isbn = ?
            """,
            (
                payload.title, payload.author, payload.publisher, payload.published_year,
                payload.cover_url, payload.cover_image, payload.source, payload.location,
                payload.notes, payload.due_date, int(payload.metadata_fetched), now, isbn,
            ),
        )
        response.status_code = 200
        created = False

    new_themes = sorted({t.strip() for t in payload.themes if t and t.strip()})
    if not created:
        _record_field_changes(db, isbn, existing, payload, old_themes, new_themes)
    _sync_themes(db, isbn, payload.themes)
    db.commit()

    row = db.execute("SELECT * FROM books WHERE isbn = ?", (isbn,)).fetchone()
    return UpsertResponse(created=created, book=row_to_book(db, row))


@router.get("/{isbn}/history", response_model=list[HistoryEntry])
def get_book_history(isbn: str, db: sqlite3.Connection = Depends(get_db)):
    rows = db.execute(
        "SELECT id, changed_at, field, old_value, new_value FROM book_history "
        "WHERE isbn = ? ORDER BY changed_at DESC, id DESC LIMIT 100",
        (isbn,),
    ).fetchall()
    return [HistoryEntry(**dict(r)) for r in rows]


@router.put("/{isbn}/history/{history_id}", response_model=HistoryEntry)
def update_history_entry(
    isbn: str, history_id: int, payload: HistoryUpdate, db: sqlite3.Connection = Depends(get_db)
):
    row = db.execute(
        "SELECT id FROM book_history WHERE id = ? AND isbn = ?", (history_id, isbn)
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Nicht gefunden")
    db.execute(
        "UPDATE book_history SET changed_at = ?, field = ?, old_value = ?, new_value = ? WHERE id = ?",
        (payload.changed_at, payload.field, payload.old_value, payload.new_value, history_id),
    )
    db.commit()
    updated = db.execute(
        "SELECT id, changed_at, field, old_value, new_value FROM book_history WHERE id = ?",
        (history_id,),
    ).fetchone()
    return HistoryEntry(**dict(updated))


@router.delete("/{isbn}/history/{history_id}", status_code=204)
def delete_history_entry(isbn: str, history_id: int, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.execute(
        "DELETE FROM book_history WHERE id = ? AND isbn = ?", (history_id, isbn)
    )
    db.commit()
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Nicht gefunden")
    return Response(status_code=204)


@router.post("/{isbn}/cover")
async def upload_cover(isbn: str, file: UploadFile = File(...)):
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Keine Bilddaten empfangen")
    try:
        cover_path = save_cover_image(isbn, content)
    except Exception:
        raise HTTPException(status_code=400, detail="Ungültiges Bildformat")
    return {"cover_image": cover_path}


@router.delete("/{isbn}", status_code=204)
def delete_book(isbn: str, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.execute("DELETE FROM books WHERE isbn = ?", (isbn,))
    db.commit()
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Nicht gefunden")
    return Response(status_code=204)
