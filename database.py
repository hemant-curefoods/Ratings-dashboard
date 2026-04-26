# =============================================================
# CUREFOODS — Persistent file storage  (SQLite)
#
# Stores raw file bytes + processing metadata so that uploaded
# files survive browser refreshes / session resets.
#
# For now:  UNIQUE(platform, file_name) → uploading the same
#           filename again replaces the old entry ("latest wins").
# Future:   remove the UNIQUE constraint + filter by date range.
# =============================================================
import io
import os
import sqlite3
from datetime import datetime

# DB lives next to this file in the project folder
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "curefoods_data.db")


# ---------------------------------------------------------------
def init_db() -> None:
    """Create tables if they don't exist yet."""
    con = sqlite3.connect(DB_PATH)
    con.execute("""
        CREATE TABLE IF NOT EXISTS stored_files (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            platform     TEXT    NOT NULL,
            file_name    TEXT    NOT NULL,
            file_bytes   BLOB    NOT NULL,
            file_size    INTEGER,
            uploaded_at  TEXT    NOT NULL,
            rows_loaded  INTEGER DEFAULT 0,
            avg_rating   REAL,
            date_min     TEXT,
            date_max     TEXT,
            UNIQUE(platform, file_name)
        )
    """)
    con.commit()
    con.close()


# ---------------------------------------------------------------
def save_file(
    platform: str,
    file_name: str,
    file_bytes: bytes,
    rows_loaded: int = 0,
    avg_rating: float | None = None,
    date_min=None,
    date_max=None,
) -> None:
    """Upsert a file.

    If a record with the same (platform, file_name) already exists
    it is replaced entirely — "latest upload wins".
    """
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    d_min = date_min.isoformat() if hasattr(date_min, "isoformat") else date_min
    d_max = date_max.isoformat() if hasattr(date_max, "isoformat") else date_max

    con = sqlite3.connect(DB_PATH)
    con.execute(
        """
        INSERT INTO stored_files
            (platform, file_name, file_bytes, file_size, uploaded_at,
             rows_loaded, avg_rating, date_min, date_max)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(platform, file_name) DO UPDATE SET
            file_bytes  = excluded.file_bytes,
            file_size   = excluded.file_size,
            uploaded_at = excluded.uploaded_at,
            rows_loaded = excluded.rows_loaded,
            avg_rating  = excluded.avg_rating,
            date_min    = excluded.date_min,
            date_max    = excluded.date_max
        """,
        (
            platform, file_name, file_bytes, len(file_bytes), now,
            rows_loaded, avg_rating, d_min, d_max,
        ),
    )
    con.commit()
    con.close()


# ---------------------------------------------------------------
def list_files(platform: str | None = None) -> list[dict]:
    """Return metadata rows (no byte payload) ordered newest-first."""
    con = sqlite3.connect(DB_PATH)
    if platform:
        rows = con.execute(
            "SELECT id, platform, file_name, file_size, uploaded_at, "
            "       rows_loaded, avg_rating, date_min, date_max "
            "FROM   stored_files "
            "WHERE  platform = ? "
            "ORDER BY uploaded_at DESC",
            (platform,),
        ).fetchall()
    else:
        rows = con.execute(
            "SELECT id, platform, file_name, file_size, uploaded_at, "
            "       rows_loaded, avg_rating, date_min, date_max "
            "FROM   stored_files "
            "ORDER BY platform, uploaded_at DESC"
        ).fetchall()
    con.close()
    cols = [
        "id", "platform", "file_name", "file_size", "uploaded_at",
        "rows_loaded", "avg_rating", "date_min", "date_max",
    ]
    return [dict(zip(cols, r)) for r in rows]


# ---------------------------------------------------------------
def get_file_bytes(file_id: int) -> io.BytesIO | None:
    """Fetch the raw bytes for one record, wrapped in a named BytesIO."""
    con = sqlite3.connect(DB_PATH)
    row = con.execute(
        "SELECT file_bytes, file_name FROM stored_files WHERE id = ?",
        (file_id,),
    ).fetchone()
    con.close()
    if row:
        bio = io.BytesIO(row[0])
        bio.name = row[1]
        return bio
    return None


# ---------------------------------------------------------------
def delete_file(file_id: int) -> None:
    """Permanently remove one file from the store."""
    con = sqlite3.connect(DB_PATH)
    con.execute("DELETE FROM stored_files WHERE id = ?", (file_id,))
    con.commit()
    con.close()


# ---------------------------------------------------------------
def db_version() -> str:
    """A short string that changes whenever the DB content changes.

    Used as a cache-busting parameter in @st.cache_data functions.
    """
    con = sqlite3.connect(DB_PATH)
    row = con.execute(
        "SELECT COUNT(*), COALESCE(MAX(uploaded_at), '') FROM stored_files"
    ).fetchone()
    con.close()
    return f"{row[0]}|{row[1]}"
