import httpx

from app.models import LookupResult

GOOGLE_BOOKS_URL = "https://www.googleapis.com/books/v1/volumes"
TIMEOUT_SECONDS = 5.0


async def lookup_isbn(isbn: str) -> LookupResult:
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
            response = await client.get(GOOGLE_BOOKS_URL, params={"q": f"isbn:{isbn}"})
            response.raise_for_status()
            data = response.json()
    except (httpx.TimeoutException, httpx.TransportError, httpx.HTTPStatusError):
        return LookupResult(found=False, isbn=isbn, reason="network_error")

    items = data.get("items") or []
    if not items:
        return LookupResult(found=False, isbn=isbn, reason="not_found")

    info = items[0].get("volumeInfo", {})
    authors = info.get("authors") or []
    image_links = info.get("imageLinks") or {}

    return LookupResult(
        found=True,
        isbn=isbn,
        title=info.get("title"),
        author=", ".join(authors) if authors else None,
        publisher=info.get("publisher"),
        published_year=info.get("publishedDate"),
        cover_url=image_links.get("thumbnail"),
    )
