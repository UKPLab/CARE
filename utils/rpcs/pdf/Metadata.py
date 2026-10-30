"""Helpers for writing metadata in PDF-compatible formats."""

from datetime import datetime, timezone
from typing import Optional, Union


DateValue = Union[str, datetime]


def to_pdf_datetime(value: Optional[DateValue]) -> Optional[str]:
    """Convert an ISO 8601 value to a PDF datetime string.

    Socket.IO serializes the Sequelize ``createdAt`` and ``updatedAt`` values as
    ISO 8601 strings. PDF annotation metadata instead expects the format
    ``D:YYYYMMDDHHmmSSOHH'mm'``. Naive datetime values are treated as UTC.

    Invalid or missing values return ``None`` so callers can omit the metadata
    field instead of accidentally writing the Unix epoch.
    """
    if value is None:
        return None

    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str):
        normalized = value.strip()
        if not normalized:
            return None

        # Python 3.10's datetime.fromisoformat() does not accept the trailing Z
        # emitted for UTC timestamps, but it does accept an explicit offset.
        if normalized.endswith(("Z", "z")):
            normalized = normalized[:-1] + "+00:00"

        try:
            parsed = datetime.fromisoformat(normalized)
        except ValueError:
            return None
    else:
        return None

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)

    offset = parsed.utcoffset()
    if offset is None:
        offset = timezone.utc.utcoffset(parsed)

    offset_minutes = int(offset.total_seconds() // 60)
    sign = "+" if offset_minutes >= 0 else "-"
    absolute_minutes = abs(offset_minutes)
    offset_hours, offset_remainder = divmod(absolute_minutes, 60)

    return (
        f"D:{parsed.strftime('%Y%m%d%H%M%S')}"
        f"{sign}{offset_hours:02d}'{offset_remainder:02d}'"
    )


def build_comment_annotation_info(comment: dict, title: str, subject: str) -> dict:
    """Build the metadata dictionary for a PDF comment annotation."""
    info = {
        "title": title,
        "subject": subject,
    }

    creation_date = to_pdf_datetime(comment.get("createdAt"))
    modification_date = to_pdf_datetime(comment.get("updatedAt"))

    if creation_date:
        info["creationDate"] = creation_date
    if modification_date:
        info["modDate"] = modification_date

    return info
