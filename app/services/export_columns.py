from typing import Callable

from app.models import BookOut

TEXT_COLUMN_DEFS: dict[str, tuple[str, Callable[[BookOut], str]]] = {
    "isbn": ("ISBN", lambda b: b.isbn),
    "title": ("Titel", lambda b: b.title),
    "author": ("Autor", lambda b: b.author),
    "publisher": ("Verlag", lambda b: b.publisher),
    "published_year": ("Jahr", lambda b: b.published_year),
    "themes": ("Themen", lambda b: ", ".join(b.themes)),
    "source": ("Herkunft", lambda b: b.source),
    "location": ("Standort", lambda b: b.location),
    "notes": ("Notizen", lambda b: b.notes),
    "due_date": ("Rückgabe", lambda b: b.due_date),
    "created_at": ("Erfasst am", lambda b: b.created_at),
    "updated_at": ("Aktualisiert am", lambda b: b.updated_at),
}

IMAGE_COLUMN_KEY = "cover"
IMAGE_COLUMN_LABEL = "Cover"

HISTORY_COLUMN_KEY = "history"
HISTORY_COLUMN_LABEL = "Änderungsverlauf"
HISTORY_MAX_ENTRIES = 5

ALL_COLUMN_LABELS: dict[str, str] = {
    **{key: label for key, (label, _getter) in TEXT_COLUMN_DEFS.items()},
    IMAGE_COLUMN_KEY: IMAGE_COLUMN_LABEL,
    HISTORY_COLUMN_KEY: HISTORY_COLUMN_LABEL,
}

DEFAULT_COLUMNS = [
    "isbn", "title", "author", "publisher", "published_year",
    "themes", "source", "location", "notes", "due_date", "created_at",
]


def resolve_columns(columns: list[str] | None) -> list[str]:
    if not columns:
        return DEFAULT_COLUMNS
    valid = [c for c in columns if c in ALL_COLUMN_LABELS]
    return valid or DEFAULT_COLUMNS


def column_labels(columns: list[str]) -> list[str]:
    return [ALL_COLUMN_LABELS[c] for c in columns]


def is_image_column(key: str) -> bool:
    return key == IMAGE_COLUMN_KEY


def is_history_column(key: str) -> bool:
    return key == HISTORY_COLUMN_KEY


def text_value(book: BookOut, key: str) -> str:
    _label, getter = TEXT_COLUMN_DEFS[key]
    return getter(book) or ""


def history_text(entries: list[dict]) -> str:
    if not entries:
        return ""
    shown = entries[:HISTORY_MAX_ENTRIES]
    lines = []
    for entry in shown:
        date = (entry.get("changed_at") or "")[:10]
        old = entry.get("old_value") or "leer"
        new = entry.get("new_value") or "leer"
        lines.append(f"{date} {entry.get('field')}: {old} → {new}")
    if len(entries) > HISTORY_MAX_ENTRIES:
        lines.append(f"… ({len(entries) - HISTORY_MAX_ENTRIES} weitere)")
    return "\n".join(lines)
