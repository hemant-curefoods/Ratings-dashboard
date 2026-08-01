import json
import logging
import os
import re

import gspread
from gspread.cell import Cell
from google.oauth2.service_account import Credentials
from config import SERVICE_ACCOUNT_FILE

log = logging.getLogger(__name__)

# Column Indices (1-based)
KITCHEN_ID_COL = 1
SWIGGY_COL = 2
ZOMATO_COL = 3
OPENING_COL = 4
CLOSING_COL = 5
SYNC_STATUS_COL = 6
RESET_COL = 7

# Scopes required for Google Sheets API
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

_gc = None

def get_client():
    global _gc
    if _gc is None:
        try:
            if "GOOGLE_SERVICE_ACCOUNT_JSON" in os.environ:
                creds_dict = json.loads(os.environ["GOOGLE_SERVICE_ACCOUNT_JSON"])
                creds = Credentials.from_service_account_info(creds_dict, scopes=SCOPES)
            else:
                creds = Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE, scopes=SCOPES)
            _gc = gspread.authorize(creds)
        except Exception as e:
            raise RuntimeError(f"Failed to authenticate with Google Sheets: {e}")
    return _gc

def get_worksheet(tab_name: str):
    sheet_id = os.environ.get("SHEET_ID")
    if not sheet_id:
        raise ValueError("SHEET_ID not set in environment.")
    client = get_client()
    return client.open_by_key(sheet_id).worksheet(tab_name)

def parse_time(opening: str, closing: str) -> dict:
    def _parse(t_str: str):
        t_str = t_str.strip().upper()
        # Remove internal spaces like "06: 30 PM"
        t_str = re.sub(r"\s*:\s*", ":", t_str)
        t_str = re.sub(r"\s+", " ", t_str)

        match = re.match(r"(\d{1,2}):(\d{2})\s*(AM|PM)", t_str)
        if match:
            h, m, p = match.groups()
            # Zomato format: "01", "30", "PM"
            return {"hour": f"{int(h):02d}", "min": m, "period": p}
        return {"hour": "12", "min": "00", "period": "AM"}

    o_parts = _parse(opening)
    c_parts = _parse(closing)
    return {
        "o_hour": o_parts["hour"],
        "o_min": o_parts["min"],
        "o_period": o_parts["period"],
        "c_hour": c_parts["hour"],
        "c_min": c_parts["min"],
        "c_period": c_parts["period"],
    }

def read_stores() -> list[dict]:
    visible_tab = os.environ.get("VISIBLE_TAB", "Visible_Sheet")
    ws = get_worksheet(visible_tab)
    records = ws.get_all_values()

    if not records or len(records) < 2:
        return []

    stores = []
    # records[0] is header, start index at 2 to match Google Sheets row numbers
    for i, row in enumerate(records[1:], start=2):
        if len(row) < 7:
            row.extend([""] * (7 - len(row)))

        kitchen_id = row[KITCHEN_ID_COL - 1].strip()
        zomato_id = row[ZOMATO_COL - 1].strip()
        opening = row[OPENING_COL - 1].strip()
        closing = row[CLOSING_COL - 1].strip()
        sync_status = row[SYNC_STATUS_COL - 1].strip()

        # Check for Pending status
        if sync_status.lower() == "pending" and opening and closing and zomato_id:
            stores.append({
                "row_idx": i,
                "kitchen_id": kitchen_id,
                "res_id": zomato_id,
                "last4": zomato_id[-4:] if len(zomato_id) >= 4 else zomato_id,
                "opening_raw": opening,
                "closing_raw": closing,
                **parse_time(opening, closing),
            })
    
    return stores

def mark_updating_stores(stores: list[dict]):
    if not stores:
        return
    visible_tab = os.environ.get("VISIBLE_TAB", "Visible_Sheet")
    ws = get_worksheet(visible_tab)
    cells = []
    for s in stores:
        cells.append(Cell(row=s["row_idx"], col=SYNC_STATUS_COL, value="in process"))
    ws.update_cells(cells)
    log.info("Marked %d stores as 'in process'", len(stores))

def mark_failed_stores(stores: list[dict]):
    if not stores:
        return
    visible_tab = os.environ.get("VISIBLE_TAB", "Visible_Sheet")
    ws = get_worksheet(visible_tab)
    cells = []
    for s in stores:
        cells.append(Cell(row=s["row_idx"], col=SYNC_STATUS_COL, value="failure"))
    ws.update_cells(cells)
    log.info("Marked %d stores as 'failure'", len(stores))

def mark_completed(stores: list[dict]):
    if not stores:
        return
    visible_tab = os.environ.get("VISIBLE_TAB", "Visible_Sheet")
    ws = get_worksheet(visible_tab)
    cells = []
    for s in stores:
        cells.append(Cell(row=s["row_idx"], col=SYNC_STATUS_COL, value="success"))
    ws.update_cells(cells)
    log.info("Marked %d stores as 'success'", len(stores))
