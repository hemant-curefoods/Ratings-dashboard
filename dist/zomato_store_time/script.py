"""
Zomato Store Timing Updater
----------------------------
Reads opening/closing times from Google Sheet and updates Zomato partner
outlet timings via the merchant API.

Run manually:   python3 script.py
Cron (hourly):  0 * * * * /usr/bin/python3 /Users/ajelhenry/zomato_store_time/script.py
"""

import json
import logging
import os
import re
import sys
from datetime import datetime
from pathlib import Path

import gspread
import requests
from dotenv import load_dotenv
from google.oauth2.service_account import Credentials

# ── Config ─────────────────────────────────────────────────────────────────────

BASE_DIR = Path(__file__).parent
load_dotenv(BASE_DIR / ".env")

SHEET_ID             = os.getenv("SHEET_ID")
TAB_NAME             = os.getenv("TAB_NAME")
SERVICE_ACCOUNT_FILE = os.getenv("SERVICE_ACCOUNT_FILE")
COOKIES_FILE         = BASE_DIR / "cookies.json"
LOG_FILE             = BASE_DIR / "timings_update.log"

ZOMATO_BASE      = "https://www.zomato.com"
CSRF_URL         = f"{ZOMATO_BASE}/webroutes/auth/csrf"
UPDATE_URL       = f"{ZOMATO_BASE}/merchant-api/restaurant/update-timings"
FETCH_URL        = f"{ZOMATO_BASE}/merchant-api/restaurant/fetch-timings"
ACCOUNTS_BASE    = "https://accounts.zomato.com"

DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

# ── Logging ────────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger(__name__)

# ── Time conversion ────────────────────────────────────────────────────────────

def to_hhmm(t: str) -> str:
    """Convert '10:00 AM' / '5:00 PM' / '23:00' → 'HH:MM' (24-hour, no seconds)."""
    if not t or str(t).lower() == "none":
        return ""
    t = str(t).strip()
    for fmt in ("%I:%M %p", "%I:%M%p", "%H:%M", "%H:%M:%S"):
        try:
            return datetime.strptime(t, fmt).strftime("%H:%M")
        except ValueError:
            continue
    raise ValueError(f"Cannot parse time: '{t}'")

# ── Google Sheet ───────────────────────────────────────────────────────────────

def read_sheet():
    creds = Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE,
        scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"],
    )
    gc = gspread.authorize(creds)
    ws = gc.open_by_key(SHEET_ID).worksheet(TAB_NAME)
    rows = ws.get_all_records()

    stores = []
    for row in rows:
        opening = str(row.get("Opening time ", "")).strip()
        closing = str(row.get("Closing time", "")).strip()
        if not opening or not closing:
            continue                          # skip — empty means do not touch
        zomato_id = str(row.get("Zomato", "")).strip()
        if not zomato_id:
            continue
        try:
            open_hhmm  = to_hhmm(opening)
            close_hhmm = to_hhmm(closing)
        except ValueError as e:
            log.warning("Skipping %s — %s", row.get("kitchen_id", zomato_id), e)
            continue
        stores.append({
            "kitchen_id": str(row.get("kitchen_id", "")).strip(),
            "res_id":     zomato_id,          # always string
            "last4":      zomato_id[-4:],
            "opening":    open_hhmm,
            "closing":    close_hhmm,
        })
    return stores

# ── Payload builder ────────────────────────────────────────────────────────────

def build_payload(res_id: str, opening: str, closing: str, opening2: str = None, closing2: str = None) -> dict:
    slots = []
    if opening and closing:
        slots.append({"start": opening, "end": closing})
    if opening2 and closing2:
        slots.append({"start": opening2, "end": closing2})
        
    return {
        "res_id": res_id,                     # string, not int
        "data": [{
            "action": "update",
            "service_type": "delivery",
            "timings": [
                {
                    "day":      day,
                    "active":   True,
                    "isEdited": True,         # must be true or Zomato ignores it
                    "slots":    slots,
                }
                for day in DAYS
            ],
        }],
    }

# ── Session / cookies ──────────────────────────────────────────────────────────

def save_cookies(session: requests.Session):
    data = [{"name": c.name, "value": c.value, "domain": c.domain, "path": c.path}
            for c in session.cookies]
    COOKIES_FILE.write_text(json.dumps(data, indent=2))
    log.info("Cookies saved → %s", COOKIES_FILE)


def load_cookies(session: requests.Session) -> bool:
    if not COOKIES_FILE.exists():
        return False
    try:
        for c in json.loads(COOKIES_FILE.read_text()):
            session.cookies.set(c["name"], c["value"], domain=c["domain"], path=c["path"])
        return True
    except Exception:
        return False


def do_playwright_login():
    """Open browser once for Google SSO, save cookies, close browser."""
    from playwright.sync_api import sync_playwright

    log.info("Opening browser for Google SSO login…")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        ctx     = browser.new_context()
        page    = ctx.new_page()
        page.goto(f"{ZOMATO_BASE}/partners/login")

        print("\n" + "="*60)
        print("ACTION REQUIRED:")
        print("  Log in with Google in the browser window.")
        print("  Wait until you see the Zomato partner dashboard.")
        print("  Then press Enter here to continue.")
        print("="*60 + "\n")
        input()

        # Persist playwright cookies into a requests session to save them
        pw_cookies = ctx.cookies()
        browser.close()

    # Write in requests-compatible format
    converted = [
        {"name": c["name"], "value": c["value"],
         "domain": c["domain"], "path": c["path"]}
        for c in pw_cookies
    ]
    COOKIES_FILE.write_text(json.dumps(converted, indent=2))
    log.info("Login complete. Cookies saved → %s", COOKIES_FILE)

# ── CSRF ───────────────────────────────────────────────────────────────────────

def get_csrf(session: requests.Session) -> str:
    """Fetch a fresh CSRF token every run — never hardcode."""
    resp = session.get(CSRF_URL, headers={"Accept": "application/json"}, timeout=15)
    resp.raise_for_status()
    token = resp.json().get("csrf", "")
    if not token:
        raise RuntimeError(f"Empty CSRF response: {resp.text}")
    return token

# ── API calls ──────────────────────────────────────────────────────────────────

def api_headers(csrf: str) -> dict:
    return {
        "Content-Type":          "application/json",
        "x-zomato-csrft":        csrf,
        "x-client-id":           "zomato_web_merchant",
        "x-zomato-app-version":  "2",
        "Accept":                "application/json",
        "Referer":               f"{ZOMATO_BASE}/partners/onlineordering",
    }


def update_timings(session: requests.Session, csrf: str, store: dict) -> bool:
    payload = build_payload(store["res_id"], store.get("opening"), store.get("closing"), store.get("opening2"), store.get("closing2"))
    resp    = session.post(
        UPDATE_URL,
        json=payload,
        headers=api_headers(csrf),
        timeout=20,
    )

    if resp.status_code == 401 or "login" in resp.url:
        raise PermissionError("401 / redirected to login")

    try:
        body = resp.json()
    except Exception:
        log.error("res_id=%s  Non-JSON response: %s", store["res_id"], resp.text[:300])
        return False

    # Success = empty data list AND empty message
    success = (body.get("data") == [] or body.get("data") is None) and body.get("message", "") == ""
    if success:
        log.info("SUCCESS  res_id=%-10s  last4=%s  %s→%s  %s",
                 store["res_id"], store["last4"],
                 store["opening"], store["closing"], store["kitchen_id"])
    else:
        log.error("FAILURE  res_id=%-10s  last4=%s  response=%s",
                  store["res_id"], store["last4"], json.dumps(body))
    return success

# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    log.info("─── Run started ───────────────────────────────────────")

    # 1. Read sheet
    stores = read_sheet()
    if not stores:
        log.info("No rows with both Opening time and Closing time filled. Nothing to do.")
        return
    log.info("Sheet rows to process: %d", len(stores))
    for s in stores:
        log.info("  res_id=%-10s  last4=%s  %s→%s  %s",
                 s["res_id"], s["last4"], s["opening"], s["closing"], s["kitchen_id"])

    # 2. Build requests session with saved cookies
    session = requests.Session()
    session.headers.update({"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                                          "AppleWebKit/537.36 Chrome/147.0.0.0 Safari/537.36"})

    if not load_cookies(session):
        do_playwright_login()
        load_cookies(session)

    # 3. Fetch fresh CSRF token
    try:
        csrf = get_csrf(session)
        log.info("CSRF token fetched: %s…", csrf[:10])
    except Exception as e:
        log.error("CSRF fetch failed: %s — re-logging in", e)
        COOKIES_FILE.unlink(missing_ok=True)
        do_playwright_login()
        load_cookies(session)
        csrf = get_csrf(session)

    # 4. Update each outlet
    success_count = 0
    for store in stores:
        try:
            ok = update_timings(session, csrf, store)
            if ok:
                success_count += 1
        except PermissionError:
            log.warning("Session expired mid-run — re-logging in and retrying")
            COOKIES_FILE.unlink(missing_ok=True)
            do_playwright_login()
            load_cookies(session)
            csrf = get_csrf(session)
            try:
                ok = update_timings(session, csrf, store)
                if ok:
                    success_count += 1
            except Exception as e2:
                log.error("Retry failed for res_id=%s: %s", store["res_id"], e2)
        except Exception as e:
            log.error("Unexpected error for res_id=%s: %s", store["res_id"], e)

    log.info("─── Run complete: %d/%d updated ────────────────────────\n",
             success_count, len(stores))


if __name__ == "__main__":
    main()
