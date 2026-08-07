from pathlib import Path
from typing import Optional

from fpdf import FPDF

from app.models import BookOut
from app.services.export_columns import (
    column_labels,
    history_text,
    is_history_column,
    is_image_column,
    text_value,
)

COL_WIDTHS_MM = {
    "isbn": 20, "title": 42, "author": 32, "publisher": 26, "published_year": 10,
    "themes": 20, "source": 20, "location": 20, "notes": 34, "due_date": 16,
    "created_at": 30, "updated_at": 30, "cover": 18, "history": 60,
}

FONT_DIR = Path(__file__).resolve().parent.parent / "assets" / "fonts"


def build_pdf_export(
    books: list[BookOut],
    columns: list[str],
    covers_dir: Optional[Path] = None,
    history_by_isbn: Optional[dict[str, list[dict]]] = None,
) -> bytes:
    history_by_isbn = history_by_isbn or {}
    pdf = FPDF(orientation="L", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=10)
    pdf.add_font("DejaVu", "", str(FONT_DIR / "DejaVuSans.ttf"))
    pdf.add_font("DejaVu", "B", str(FONT_DIR / "DejaVuSans-Bold.ttf"))
    pdf.add_page()
    pdf.set_font("DejaVu", size=8)

    col_widths = tuple(COL_WIDTHS_MM.get(key, 24) for key in columns)

    with pdf.table(col_widths=col_widths, text_align="LEFT", line_height=5) as table:
        header_row = table.row()
        for header in column_labels(columns):
            header_row.cell(header)

        for book in books:
            row = table.row()
            for key in columns:
                if is_image_column(key):
                    cover_path = covers_dir / f"{book.isbn}.jpg" if covers_dir else None
                    if cover_path and cover_path.exists():
                        row.cell("", img=str(cover_path))
                    else:
                        row.cell("")
                elif is_history_column(key):
                    row.cell(history_text(history_by_isbn.get(book.isbn, [])))
                else:
                    row.cell(text_value(book, key))

    return bytes(pdf.output())
