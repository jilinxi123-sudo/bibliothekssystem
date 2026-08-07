import sqlite3
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.database import TAG_COLOR_PALETTE, get_db
from app.models import TagCreate, TagKind, TagOut

router = APIRouter(prefix="/api/tags", tags=["tags"])

SINGLE_VALUE_COLUMNS = {"source": "source", "location": "location"}


class TagUpdate(BaseModel):
    label: Optional[str] = None
    color: Optional[str] = None


def _cascade_rename(db: sqlite3.Connection, kind: TagKind, old_label: str, new_label: str) -> None:
    if kind in SINGLE_VALUE_COLUMNS:
        column = SINGLE_VALUE_COLUMNS[kind]
        db.execute(f"UPDATE books SET {column} = ? WHERE {column} = ?", (new_label, old_label))
    elif kind == "theme":
        db.execute(
            "INSERT OR IGNORE INTO book_themes (isbn, label) "
            "SELECT isbn, ? FROM book_themes WHERE label = ?",
            (new_label, old_label),
        )
        db.execute("DELETE FROM book_themes WHERE label = ?", (old_label,))


def _cascade_delete(db: sqlite3.Connection, kind: TagKind, label: str) -> None:
    if kind in SINGLE_VALUE_COLUMNS:
        column = SINGLE_VALUE_COLUMNS[kind]
        db.execute(f"UPDATE books SET {column} = NULL WHERE {column} = ?", (label,))
    elif kind == "theme":
        db.execute("DELETE FROM book_themes WHERE label = ?", (label,))


@router.get("", response_model=list[TagOut])
def list_tags(kind: TagKind = Query(...), db: sqlite3.Connection = Depends(get_db)):
    rows = db.execute(
        "SELECT * FROM tags WHERE kind = ? ORDER BY id ASC", (kind,)
    ).fetchall()
    return [TagOut(**dict(r)) for r in rows]


@router.post("", response_model=TagOut, status_code=201)
def create_tag(payload: TagCreate, db: sqlite3.Connection = Depends(get_db)):
    label = payload.label.strip()
    if not label:
        raise HTTPException(status_code=400, detail="Tag darf nicht leer sein")

    existing = db.execute(
        "SELECT * FROM tags WHERE kind = ? AND label = ?", (payload.kind, label)
    ).fetchone()
    if existing is not None:
        return TagOut(**dict(existing))

    count = db.execute(
        "SELECT COUNT(*) AS c FROM tags WHERE kind = ?", (payload.kind,)
    ).fetchone()["c"]
    color = payload.color or TAG_COLOR_PALETTE[count % len(TAG_COLOR_PALETTE)]

    db.execute(
        "INSERT INTO tags (kind, label, color) VALUES (?, ?, ?)", (payload.kind, label, color)
    )
    db.commit()
    row = db.execute(
        "SELECT * FROM tags WHERE kind = ? AND label = ?", (payload.kind, label)
    ).fetchone()
    return TagOut(**dict(row))


@router.put("/{tag_id}", response_model=TagOut)
def update_tag(tag_id: int, payload: TagUpdate, db: sqlite3.Connection = Depends(get_db)):
    row = db.execute("SELECT * FROM tags WHERE id = ?", (tag_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Nicht gefunden")

    old_label = row["label"]
    kind = row["kind"]
    new_label = payload.label.strip() if payload.label is not None else old_label
    if not new_label:
        raise HTTPException(status_code=400, detail="Tag darf nicht leer sein")
    new_color = payload.color if payload.color is not None else row["color"]

    if new_label != old_label:
        try:
            db.execute("UPDATE tags SET label = ?, color = ? WHERE id = ?", (new_label, new_color, tag_id))
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=409, detail="Tag mit diesem Namen existiert bereits")
        _cascade_rename(db, kind, old_label, new_label)
    else:
        db.execute("UPDATE tags SET color = ? WHERE id = ?", (new_color, tag_id))

    db.commit()

    updated = db.execute("SELECT * FROM tags WHERE id = ?", (tag_id,)).fetchone()
    return TagOut(**dict(updated))


@router.delete("/{tag_id}", status_code=204)
def delete_tag(tag_id: int, db: sqlite3.Connection = Depends(get_db)):
    row = db.execute("SELECT * FROM tags WHERE id = ?", (tag_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Nicht gefunden")

    _cascade_delete(db, row["kind"], row["label"])
    db.execute("DELETE FROM tags WHERE id = ?", (tag_id,))
    db.commit()
