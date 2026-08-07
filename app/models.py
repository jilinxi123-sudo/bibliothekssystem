from typing import Literal, Optional

from pydantic import BaseModel

TagKind = Literal["source", "location", "theme"]


class BookUpsert(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    publisher: Optional[str] = None
    published_year: Optional[str] = None
    cover_url: Optional[str] = None
    cover_image: Optional[str] = None
    source: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None
    due_date: Optional[str] = None
    themes: list[str] = []
    metadata_fetched: bool = False


class BookOut(BaseModel):
    id: int
    isbn: str
    title: Optional[str] = None
    author: Optional[str] = None
    publisher: Optional[str] = None
    published_year: Optional[str] = None
    cover_url: Optional[str] = None
    cover_image: Optional[str] = None
    source: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None
    due_date: Optional[str] = None
    themes: list[str] = []
    metadata_fetched: bool
    created_at: str
    updated_at: str


class BookListOut(BaseModel):
    total: int
    items: list[BookOut]


class UpsertResponse(BaseModel):
    created: bool
    book: BookOut


class BulkIsbnRequest(BaseModel):
    isbns: list[str]


class BulkDueDateRequest(BaseModel):
    isbns: list[str]
    due_date: str


class BulkResult(BaseModel):
    affected: int


class TagOut(BaseModel):
    id: int
    kind: TagKind
    label: str
    color: Optional[str] = None


class TagCreate(BaseModel):
    kind: TagKind
    label: str
    color: Optional[str] = None


class HistoryEntry(BaseModel):
    id: int
    changed_at: str
    field: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None


class HistoryUpdate(BaseModel):
    changed_at: str
    field: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None


class LookupResult(BaseModel):
    found: bool
    isbn: str
    title: Optional[str] = None
    author: Optional[str] = None
    publisher: Optional[str] = None
    published_year: Optional[str] = None
    cover_url: Optional[str] = None
    reason: Optional[str] = None
