import sqlite3

from fastapi import APIRouter, Depends, HTTPException, Response

from app.database import get_db
from app.models import BulkIsbnRequest
from app.routers.books import query_books, row_to_book
from app.services.calendar_ics import build_feed_ics, build_single_event_ics

router = APIRouter(tags=["calendar"])


@router.get("/api/books/{isbn}/calendar.ics")
def book_calendar(isbn: str, db: sqlite3.Connection = Depends(get_db)):
    row = db.execute("SELECT * FROM books WHERE isbn = ?", (isbn,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Nicht gefunden")
    book = row_to_book(db, row)
    if not book.due_date:
        raise HTTPException(status_code=400, detail="Kein Rückgabedatum gesetzt")

    content = build_single_event_ics(book)
    return Response(
        content=content,
        media_type="text/calendar; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="rueckgabe-{isbn}.ics"'},
    )


@router.get("/api/calendar.ics")
def calendar_feed(db: sqlite3.Connection = Depends(get_db)):
    _, items = query_books(db, limit=100000, offset=0)
    content = build_feed_ics(items)
    return Response(
        content=content,
        media_type="text/calendar; charset=utf-8",
        headers={"Content-Disposition": 'inline; filename="bibliothek-kalender.ics"'},
    )


@router.post("/api/calendar/batch.ics")
def calendar_batch(payload: BulkIsbnRequest, db: sqlite3.Connection = Depends(get_db)):
    if not payload.isbns:
        raise HTTPException(status_code=400, detail="Keine Bücher ausgewählt")
    placeholders = ",".join("?" for _ in payload.isbns)
    rows = db.execute(
        f"SELECT * FROM books WHERE isbn IN ({placeholders})", payload.isbns
    ).fetchall()
    items = [row_to_book(db, r) for r in rows]
    content = build_feed_ics(items)
    return Response(
        content=content,
        media_type="text/calendar; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="rueckgabe-auswahl.ics"'},
    )
