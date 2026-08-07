from datetime import date, datetime, timedelta, timezone

from icalendar import Alarm, Calendar, Event

from app.models import BookOut

PRODID = "-//Bibliothekssystem//DE"


def _build_event(book: BookOut) -> Event:
    due = date.fromisoformat(book.due_date)
    title = book.title or book.isbn

    if book.source:
        summary = f"Buch zurückgeben an {book.source}: {title}"
        alarm_text = f"Buch morgen zurückgeben an {book.source}"
    else:
        summary = f"Buch zurückgeben: {title}"
        alarm_text = "Buch morgen zurückgeben"

    event = Event()
    event.add("summary", summary)
    event.add("dtstart", due)
    event.add("dtend", due + timedelta(days=1))
    event.add("dtstamp", datetime.now(timezone.utc))
    event.add("uid", f"{book.isbn}-{book.due_date}@bibliothekssystem.local")

    description_lines = [f"ISBN: {book.isbn}"]
    if book.author:
        description_lines.append(f"Autor: {book.author}")
    if book.location:
        description_lines.append(f"Standort: {book.location}")
    if book.source:
        description_lines.append(f"Herkunft: {book.source}")
    event.add("description", "\n".join(description_lines))

    alarm = Alarm()
    alarm.add("action", "DISPLAY")
    alarm.add("description", alarm_text)
    alarm.add("trigger", timedelta(days=-1))
    event.add_component(alarm)

    return event


def build_single_event_ics(book: BookOut) -> bytes:
    cal = Calendar()
    cal.add("prodid", PRODID)
    cal.add("version", "2.0")
    cal.add_component(_build_event(book))
    return cal.to_ical()


def build_feed_ics(books: list[BookOut]) -> bytes:
    cal = Calendar()
    cal.add("prodid", PRODID)
    cal.add("version", "2.0")
    cal.add("x-wr-calname", "Bibliothek Rückgabetermine")
    for book in books:
        if book.due_date:
            cal.add_component(_build_event(book))
    return cal.to_ical()
