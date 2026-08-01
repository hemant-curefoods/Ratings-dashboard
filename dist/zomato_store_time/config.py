import json
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).parent
load_dotenv(BASE_DIR / ".env")

SHEET_ID = os.getenv("SHEET_ID", "")
VISIBLE_TAB = os.getenv("VISIBLE_TAB", "Visible_Sheet")
HIDDEN_TAB = os.getenv("HIDDEN_TAB", "Hidden_Sheet")

# local file path OR use GOOGLE_SERVICE_ACCOUNT_JSON on Railway
SERVICE_ACCOUNT_FILE = os.getenv("SERVICE_ACCOUNT_FILE", "")
SERVICE_ACCOUNT_JSON = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "")

# api | playwright
# Default is playwright per current automation requirement.
UPDATE_METHOD = os.getenv("UPDATE_METHOD", "playwright").lower()

HEADLESS = os.getenv("HEADLESS", "true").lower() in ("1", "true", "yes")
COOKIES_FILE = BASE_DIR / "cookies.json"
ZOMATO_COOKIES_JSON = os.getenv("ZOMATO_COOKIES_JSON", "")
ZOMATO_EMAIL = os.getenv("ZOMATO_EMAIL", "")
ZOMATO_PASSWORD = os.getenv("ZOMATO_PASSWORD", "")
LOG_FILE = BASE_DIR / "timings_update.log"

ZOMATO_BASE = "https://www.zomato.com"
CSRF_URL = f"{ZOMATO_BASE}/webroutes/auth/csrf"
UPDATE_URL = f"{ZOMATO_BASE}/merchant-api/restaurant/update-timings"

DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


def load_cookies_data() -> list[dict]:
    if ZOMATO_COOKIES_JSON:
        return json.loads(ZOMATO_COOKIES_JSON)
    if COOKIES_FILE.exists():
        return json.loads(COOKIES_FILE.read_text())
    return []


def save_cookies_data(cookies: list[dict]) -> None:
    COOKIES_FILE.write_text(json.dumps(cookies, indent=2))
