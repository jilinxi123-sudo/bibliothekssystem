import sqlite3
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel

from app.database import get_db
from app.routers.books import books_by_isbns, history_batch, query_books
from app.services.cover_storage import COVERS_DIR
from app.services.export_columns import HISTORY_COLUMN_KEY, resolve_columns
from app.services.export_excel import build_excel_export
from app.services.export_pdf import build_pdf_export
from app.services.export_word import build_word_export

router = APIRouter(prefix="/api/export", tags=["export"])

_BUILDERS = {
    "excel": (
        build_excel_export,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "xlsx",
    ),
    "word": (
        build_word_export,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "docx",
    ),
    "pdf": (build_pdf_export, "application/pdf", "pdf"),
}


class SelectedExportRequest(BaseModel):
    isbns: list[str]
    columns: Optional[list[str]] = None


def _export_filename(extension: str) -> str:
    return f"Kitabibliothek {datetime.now().strftime('%Y%m%d')}.{extension}"


def _books_for_export(
    db: sqlite3.Connection,
    q: Optional[str],
    location: Optional[list[str]],
    source: Optional[list[str]],
    theme: Optional[list[str]],
    unenriched: Optional[bool],
):
    _, items = query_books(
        db, q=q, location=location, source=source, theme=theme,
        unenriched=unenriched, limit=100000, offset=0,
    )
    return items


def _export_response(fmt: str, books, columns: Optional[list[str]], db: sqlite3.Connection) -> Response:
    if fmt not in _BUILDERS:
        raise HTTPException(status_code=404, detail="Unbekanntes Format")
    builder, media_type, extension = _BUILDERS[fmt]
    resolved_columns = resolve_columns(columns)

    history_by_isbn = {}
    if HISTORY_COLUMN_KEY in resolved_columns:
        history_by_isbn = history_batch(db, [b.isbn for b in books])

    content = builder(books, resolved_columns, COVERS_DIR, history_by_isbn)
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{_export_filename(extension)}"'},
    )


@router.get("/excel")
def export_excel(
    q: Optional[str] = None,
    location: Optional[list[str]] = Query(None),
    source: Optional[list[str]] = Query(None),
    theme: Optional[list[str]] = Query(None),
    unenriched: Optional[bool] = None,
    columns: Optional[list[str]] = Query(None),
    db: sqlite3.Connection = Depends(get_db),
):
    books = _books_for_export(db, q, location, source, theme, unenriched)
    return _export_response("excel", books, columns, db)


@router.get("/word")
def export_word(
    q: Optional[str] = None,
    location: Optional[list[str]] = Query(None),
    source: Optional[list[str]] = Query(None),
    theme: Optional[list[str]] = Query(None),
    unenriched: Optional[bool] = None,
    columns: Optional[list[str]] = Query(None),
    db: sqlite3.Connection = Depends(get_db),
):
    books = _books_for_export(db, q, location, source, theme, unenriched)
    return _export_response("word", books, columns, db)


@router.get("/pdf")
def export_pdf(
    q: Optional[str] = None,
    location: Optional[list[str]] = Query(None),
    source: Optional[list[str]] = Query(None),
    theme: Optional[list[str]] = Query(None),
    unenriched: Optional[bool] = None,
    columns: Optional[list[str]] = Query(None),
    db: sqlite3.Connection = Depends(get_db),
):
    books = _books_for_export(db, q, location, source, theme, unenriched)
    return _export_response("pdf", books, columns, db)


@router.post("/selected/{fmt}")
def export_selected(fmt: str, payload: SelectedExportRequest, db: sqlite3.Connection = Depends(get_db)):
    books = books_by_isbns(db, payload.isbns)
    return _export_response(fmt, books, payload.columns, db)
