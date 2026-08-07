import re

import httpx
from defusedxml import ElementTree as ET

from app.models import LookupResult

DNB_SRU_URL = "https://services.dnb.de/sru/dnb"
MARC_NS = "{http://www.loc.gov/MARC21/slim}"
TIMEOUT_SECONDS = 5.0


def _clean_year(raw: str) -> str:
    match = re.search(r"\d{4}", raw)
    return match.group(0) if match else raw.strip()


def _subfield(record, tag: str, code: str) -> str | None:
    for datafield in record.findall(f"{MARC_NS}datafield[@tag='{tag}']"):
        subfield = datafield.find(f"{MARC_NS}subfield[@code='{code}']")
        if subfield is not None and subfield.text:
            return subfield.text.strip()
    return None


def _authors(record) -> str | None:
    names = []
    for tag in ("100", "700"):
        for datafield in record.findall(f"{MARC_NS}datafield[@tag='{tag}']"):
            subfield = datafield.find(f"{MARC_NS}subfield[@code='a']")
            if subfield is not None and subfield.text:
                name = subfield.text.strip().rstrip(",")
                if name not in names:
                    names.append(name)
    return ", ".join(names) if names else None


async def lookup_isbn(isbn: str) -> LookupResult:
    params = {
        "version": "1.1",
        "operation": "searchRetrieve",
        "query": f"ISBN={isbn}",
        "recordSchema": "MARC21-xml",
        "maximumRecords": "1",
    }
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
            response = await client.get(DNB_SRU_URL, params=params)
            response.raise_for_status()
            text = response.text
    except (httpx.TimeoutException, httpx.TransportError, httpx.HTTPStatusError):
        return LookupResult(found=False, isbn=isbn, reason="network_error")

    try:
        root = ET.fromstring(text)
    except ET.ParseError:
        return LookupResult(found=False, isbn=isbn, reason="network_error")

    record = root.find(f".//{MARC_NS}record")
    if record is None:
        return LookupResult(found=False, isbn=isbn, reason="not_found")

    title = _subfield(record, "245", "a")
    subtitle = _subfield(record, "245", "b")
    if title and subtitle:
        title = f"{title} {subtitle}"

    if not title:
        return LookupResult(found=False, isbn=isbn, reason="not_found")

    publisher = _subfield(record, "264", "b") or _subfield(record, "260", "b")
    year_raw = _subfield(record, "264", "c") or _subfield(record, "260", "c")

    return LookupResult(
        found=True,
        isbn=isbn,
        title=title,
        author=_authors(record),
        publisher=publisher,
        published_year=_clean_year(year_raw) if year_raw else None,
        cover_url=None,
    )
