from fastapi import APIRouter

from app.models import LookupResult
from app.services import dnb, google_books

router = APIRouter(prefix="/api/lookup", tags=["lookup"])


@router.get("/{isbn}", response_model=LookupResult)
async def lookup(isbn: str) -> LookupResult:
    dnb_result = await dnb.lookup_isbn(isbn)
    if dnb_result.found:
        return dnb_result

    google_result = await google_books.lookup_isbn(isbn)
    if google_result.found:
        return google_result

    if dnb_result.reason == "not_found" or google_result.reason == "not_found":
        return LookupResult(found=False, isbn=isbn, reason="not_found")
    return LookupResult(found=False, isbn=isbn, reason="network_error")
