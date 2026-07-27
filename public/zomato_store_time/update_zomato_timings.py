"""
Reads Opening/Closing times from Google Sheet (RID_master tab).
For each row where both Opening time AND Closing time are filled:
  - Takes the last 4 digits of the Zomato ID
  - Logs into https://www.zomato.com/partners/login
  - Navigates to the outlet timings page for that restaurant
  - Updates the opening and closing time for all days

Usage:
  python3 update_zomato_timings.py
"""

import json
import re
import time
from datetime import datetime
from pathlib import Path

import gspread
from google.oauth2.service_account import Credentials
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

SHEET_ID = "1cM1-Eotcjho0P9boOeSZXIYqbfisSRju0n802yAA3zo"
TAB_NAME = "RID_master"
SERVICE_ACCOUNT_FILE = "/Users/ajelhenry/Downloads/zomato_store_timing.json"
SESSION_FILE = Path(__file__).parent / "zomato_session.json"


# ── Google Sheet ───────────────────────────────────────────────────────────────

def read_stores():
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
        # Only process rows where BOTH times are filled
        if not opening or not closing:
            continue
        zomato_id = str(row.get("Zomato", "")).strip()
        if not zomato_id:
            continue
        last4 = zomato_id[-4:]
        stores.append({
            "kitchen_id": str(row.get("kitchen_id", "")).strip(),
            "zomato_id": zomato_id,
            "last4": last4,
            "opening": opening,
            "closing": closing,
        })
    return stores


# ── Time helpers ───────────────────────────────────────────────────────────────

def to_12h(t: str):
    """
    Parse time string and return (hour_str, minute_str, period) for UI dropdowns.
    Handles: '10:00 AM', '11:00 PM', '5:00 PM', '12:15 AM'
    Returns: ('10', '00', 'AM')
    """
    t = t.strip()
    try:
        dt = datetime.strptime(t, "%I:%M %p")
    except ValueError:
        try:
            dt = datetime.strptime(t, "%I:%M%p")
        except ValueError:
            try:
                dt = datetime.strptime(t, "%H:%M")
            except ValueError:
                raise ValueError(f"Cannot parse time: {t}")
    hour = dt.strftime("%I").lstrip("0") or "12"
    minute = dt.strftime("%M")
    period = dt.strftime("%p")
    return hour, minute, period


# ── Session management ─────────────────────────────────────────────────────────

def login_and_save(playwright):
    browser = playwright.chromium.launch(headless=False)
    ctx = browser.new_context()
    page = ctx.new_page()
    page.goto("https://www.zomato.com/partners/login")
    print("\n[ACTION] Log in with Google in the browser window.")
    print("Once you see the Zomato partner dashboard, press Enter here...")
    input()
    SESSION_FILE.write_text(json.dumps(ctx.cookies()))
    print(f"Session saved → {SESSION_FILE}\n")
    browser.close()


def get_context(playwright):
    browser = playwright.chromium.launch(headless=False)
    ctx = browser.new_context()
    if SESSION_FILE.exists():
        ctx.add_cookies(json.loads(SESSION_FILE.read_text()))
    return browser, ctx


# ── Timing UI automation ───────────────────────────────────────────────────────

def select_dropdown_option(page, label_text: str, value: str):
    """Click a dropdown that contains label_text and select the option matching value."""
    # Find the select element near the label
    page.get_by_text(label_text, exact=False).first.click()
    time.sleep(0.3)
    page.get_by_role("option", name=re.compile(f"^{re.escape(value)}$")).first.click()


def update_store_timings(page, store: dict):
    zomato_id = store["zomato_id"]
    last4 = store["last4"]
    opening = store["opening"]
    closing = store["closing"]

    print(f"\n{'─'*60}")
    print(f"Store   : {store['kitchen_id']}")
    print(f"Zomato  : {zomato_id}  (last 4: {last4})")
    print(f"Opening : {opening}   Closing : {closing}")

    # Navigate directly to the outlet timings page
    url = f"https://www.zomato.com/partners/onlineordering/outletInfo/outletTimings?resId={zomato_id}"
    page.goto(url, wait_until="networkidle", timeout=30000)
    time.sleep(2)

    # Verify we landed on the right page by checking last 4 digits appear somewhere
    page_text = page.inner_text("body")
    if last4 not in page_text:
        print(f"  ⚠ Could not verify restaurant {last4} on page — proceeding anyway")

    # Parse times
    try:
        o_hour, o_min, o_period = to_12h(opening)
        c_hour, c_min, c_period = to_12h(closing)
    except ValueError as e:
        print(f"  ✗ Time parse error: {e}")
        return

    print(f"  Parsed opening → {o_hour}:{o_min} {o_period}")
    print(f"  Parsed closing → {c_hour}:{c_min} {c_period}")

    # Take screenshot before
    page.screenshot(path=f"before_{zomato_id}.png")

    # The timings page has time slot rows for each day.
    # Each row has dropdowns: [hour] [minute] [AM/PM] — [hour] [minute] [AM/PM]
    # We update ALL day rows.

    # Find all time slot containers (one per day)
    day_rows = page.locator("[class*='day'], [class*='timing-row'], [data-testid*='day']").all()

    if not day_rows:
        # Fallback: find all select elements grouped in sets of 6 (open h/m/p + close h/m/p)
        selects = page.locator("select").all()
        print(f"  Found {len(selects)} select elements on page")

        # Group into sets of 6 per day (7 days × 6 selects = 42)
        for i in range(0, len(selects), 6):
            group = selects[i:i+6]
            if len(group) < 6:
                break
            # open: hour, minute, period
            group[0].select_option(o_hour)
            group[1].select_option(o_min)
            group[2].select_option(o_period)
            # close: hour, minute, period
            group[3].select_option(c_hour)
            group[4].select_option(c_min)
            group[5].select_option(c_period)
            time.sleep(0.2)
    else:
        print(f"  Found {len(day_rows)} day rows")
        for row in day_rows:
            selects = row.locator("select").all()
            if len(selects) >= 6:
                selects[0].select_option(o_hour)
                selects[1].select_option(o_min)
                selects[2].select_option(o_period)
                selects[3].select_option(c_hour)
                selects[4].select_option(c_min)
                selects[5].select_option(c_period)
                time.sleep(0.2)

    # Click Save button
    try:
        save_btn = page.get_by_role("button", name=re.compile("save|update", re.IGNORECASE)).first
        save_btn.click()
        time.sleep(2)
        print("  ✓ Saved")
    except PWTimeout:
        print("  ✗ Save button not found")

    page.screenshot(path=f"after_{zomato_id}.png")


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    stores = read_stores()
    if not stores:
        print("No stores found with both Opening time AND Closing time filled.")
        return

    print(f"Stores to update: {len(stores)}")
    for s in stores:
        print(f"  {s['kitchen_id']}  |  Zomato: {s['zomato_id']} (last4: {s['last4']})  |  {s['opening']} → {s['closing']}")

    with sync_playwright() as p:
        if not SESSION_FILE.exists():
            login_and_save(p)

        browser, ctx = get_context(p)
        page = ctx.new_page()

        # Verify session is valid
        page.goto("https://www.zomato.com/partners/onlineordering", wait_until="networkidle", timeout=30000)
        if "login" in page.url:
            print("Session expired. Please log in again.")
            browser.close()
            SESSION_FILE.unlink(missing_ok=True)
            login_and_save(p)
            browser, ctx = get_context(p)
            page = ctx.new_page()
            page.goto("https://www.zomato.com/partners/onlineordering", wait_until="networkidle")

        for store in stores:
            try:
                update_store_timings(page, store)
            except Exception as e:
                print(f"  ✗ Error for {store['kitchen_id']}: {e}")
                page.screenshot(path=f"error_{store['zomato_id']}.png")

        print("\n✓ All done.")
        browser.close()


if __name__ == "__main__":
    main()
