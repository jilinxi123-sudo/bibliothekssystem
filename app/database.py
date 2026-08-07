import os
import sqlite3
from pathlib import Path
from typing import Iterator

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = Path(os.environ.get("BIBLIOTHEK_DB_PATH", str(BASE_DIR / "data" / "library.db")))

SCHEMA = """
CREATE TABLE IF NOT EXISTS books (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    isbn              TEXT NOT NULL UNIQUE,
    title             TEXT,
    author            TEXT,
    publisher         TEXT,
    published_year    TEXT,
    cover_url         TEXT,
    source            TEXT,
    location          TEXT,
    notes             TEXT,
    due_date          TEXT,
    cover_image       TEXT,
    metadata_fetched  INTEGER NOT NULL DEFAULT 0,
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    kind  TEXT NOT NULL CHECK (kind IN ('source', 'location', 'theme')),
    label TEXT NOT NULL,
    color TEXT,
    UNIQUE(kind, label)
);

CREATE TABLE IF NOT EXISTS book_themes (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    isbn  TEXT NOT NULL REFERENCES books(isbn) ON DELETE CASCADE,
    label TEXT NOT NULL,
    UNIQUE(isbn, label)
);

CREATE TABLE IF NOT EXISTS book_history (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    isbn       TEXT NOT NULL REFERENCES books(isbn) ON DELETE CASCADE,
    changed_at TEXT NOT NULL,
    field      TEXT NOT NULL,
    old_value  TEXT,
    new_value  TEXT
);
"""

TAG_COLOR_PALETTE = [
    "#F7B6C2",  # Macaron Pink
    "#FBC99B",  # Macaron Peach
    "#F5E28C",  # Macaron Lemon
    "#A8DFC9",  # Macaron Mint
    "#A9D3EC",  # Macaron Sky
    "#C9B6E4",  # Macaron Lavender
    "#F0A6B8",  # Macaron Rose
    "#A3B4A2",  # Morandi Sage
    "#92A8B8",  # Morandi Dusty Blue
    "#B99CA3",  # Morandi Mauve
    "#C9B79C",  # Morandi Sand
    "#B0A69A",  # Morandi Taupe
    "#FF8FA3",  # Bright Coral
    "#FFAB4C",  # Bright Tangerine
    "#FFDD57",  # Bright Sunflower
    "#7ED957",  # Bright Lime
    "#4FD9C7",  # Bright Turquoise
    "#6EC6FF",  # Bright Sky Blue
    "#B583FF",  # Bright Violet
    "#FF6FB0",  # Bright Magenta
]

DEFAULT_TAGS = [
    ("source", "Gekauft"),
    ("source", "Geschenkt"),
    ("source", "Stadtbücherei Flörsheim am Main"),
    ("location", "Leseraum"),
    ("location", "Fuchsgruppe"),
    ("location", "Igelgruppe"),
    ("location", "Eulengruppe"),
    ("location", "Pinguingruppe"),
    ("location", "Büro"),
    ("theme", "Frühling"),
    ("theme", "Sommer"),
    ("theme", "Winter"),
    ("theme", "Weihnachten"),
]


def _seed_default_tags(conn: sqlite3.Connection) -> None:
    kinds_with_tags = {
        row["kind"] for row in conn.execute("SELECT DISTINCT kind FROM tags").fetchall()
    }
    to_insert = [
        (kind, label, TAG_COLOR_PALETTE[i % len(TAG_COLOR_PALETTE)])
        for i, (kind, label) in enumerate(DEFAULT_TAGS)
        if kind not in kinds_with_tags
    ]
    if not to_insert:
        return
    conn.executemany("INSERT INTO tags (kind, label, color) VALUES (?, ?, ?)", to_insert)
    conn.commit()


def _migrate_tags_check_constraint(conn: sqlite3.Connection) -> None:
    row = conn.execute(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'tags'"
    ).fetchone()
    if row is None or "'theme'" in row["sql"]:
        return
    conn.execute("ALTER TABLE tags RENAME TO tags_old")
    conn.execute(
        """
        CREATE TABLE tags (
            id    INTEGER PRIMARY KEY AUTOINCREMENT,
            kind  TEXT NOT NULL CHECK (kind IN ('source', 'location', 'theme')),
            label TEXT NOT NULL,
            color TEXT,
            UNIQUE(kind, label)
        )
        """
    )
    old_cols = {row["name"] for row in conn.execute("PRAGMA table_info(tags_old)").fetchall()}
    if "color" in old_cols:
        conn.execute("INSERT INTO tags (id, kind, label, color) SELECT id, kind, label, color FROM tags_old")
    else:
        conn.execute("INSERT INTO tags (id, kind, label) SELECT id, kind, label FROM tags_old")
    conn.execute("DROP TABLE tags_old")
    conn.commit()


def _backfill_tag_colors(conn: sqlite3.Connection) -> None:
    rows = conn.execute(
        "SELECT id FROM tags WHERE color IS NULL OR color = '' ORDER BY id ASC"
    ).fetchall()
    if not rows:
        return
    for i, row in enumerate(rows):
        color = TAG_COLOR_PALETTE[i % len(TAG_COLOR_PALETTE)]
        conn.execute("UPDATE tags SET color = ? WHERE id = ?", (color, row["id"]))
    conn.commit()


def _ensure_column(conn: sqlite3.Connection, table: str, column: str, coltype: str) -> None:
    existing = {row["name"] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}
    if column not in existing:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {coltype}")
        conn.commit()


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA busy_timeout = 5000;")
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db() -> None:
    conn = connect()
    try:
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.executescript(SCHEMA)
        conn.commit()
        _ensure_column(conn, "books", "due_date", "TEXT")
        _ensure_column(conn, "books", "cover_image", "TEXT")
        _migrate_tags_check_constraint(conn)
        _ensure_column(conn, "tags", "color", "TEXT")
        _backfill_tag_colors(conn)
        _seed_default_tags(conn)
    finally:
        conn.close()


def get_db() -> Iterator[sqlite3.Connection]:
    conn = connect()
    try:
        yield conn
    finally:
        conn.close()
