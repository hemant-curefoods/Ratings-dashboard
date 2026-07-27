# Automation Architecture & Context for Claude

Hello Claude. I am providing the architecture, logic, and code for my current Zomato Store Timing automation. 
I need your help building a new automation script for my **next partner website** (e.g., Swiggy or another food delivery platform) using this exact same architecture and structure.

## 1. System Architecture Overview
Our system is completely headless and runs in the cloud. It connects a Google Sheet to a Playwright Python script via GitHub Actions.

1. **Google Sheets (Frontend/Queue):** We have a Google Sheet with columns for `Opening_time`, `Closing_time`, `Platform_ID`, and a `Reset` column.
2. **Google Apps Script (Instant Trigger):** When a user types "reset" in the Reset column, a Google Apps Script instantly fires a POST request to a GitHub Actions webhook URL to wake up the server.
3. **GitHub Actions (Cloud Server):** Wakes up, boots a headless Chromium browser using Playwright, and triggers the Python worker.
4. **Python + Playwright (Worker):** 
   - Uses stored `cookies.json` to bypass login.
   - If cookies are expired, has a fallback to auto-login via Google SSO.
   - Navigates to the partner portal dashboard.
   - Searches for the correct restaurant/outlet using the last 4 digits of the restaurant ID.
   - Modifies the HTML `<select>` dropdowns for opening and closing timings for all days.
   - Clicks Save/Update.

---

## 2. Google Sheets Trigger Logic
This is the Apps Script attached to the Google Sheet. It watches for edits, updates the UI, and sends a webhook to GitHub Actions.

```javascript
/**
 * Store Timing Automation - Instant Trigger Logic
 */

function setupTrigger() {
  var sheet = SpreadsheetApp.getActive();
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }
  
  ScriptApp.newTrigger("processCheckboxClick")
    .forSpreadsheet(sheet)
    .onEdit()
    .create();
    
  SpreadsheetApp.getActiveSpreadsheet().toast("System is fully ready!", "Success", 5);
}

function processCheckboxClick(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  if (sheet.getName() !== "Visible_Sheet") return;

  var row = e.range.getRow();
  var col = e.range.getColumn();

  // Column G is index 7 (Reset column)
  if (col === 7 && row > 1) {
    var val = e.range.getValue();
    
    if (typeof val === "string" && val.toLowerCase().trim() === "reset") {
      e.range.setValue(""); // Clear cell
      sheet.getRange(row, 6).setValue("Pending"); // Set status to pending
      
      SpreadsheetApp.getActiveSpreadsheet().toast(
        "Signal sent to the cloud. The server is booting up!", 
        "Automation Triggered", 8
      );
      
      triggerGitHubAction();
    }
  }
}

function triggerGitHubAction() {
  var GITHUB_TOKEN = "YOUR_GITHUB_TOKEN_HERE"; 
  var url = "https://api.github.com/repos/YOUR_ORG/YOUR_REPO/actions/workflows/sync.yml/dispatches";
  
  var options = {
    "method": "post",
    "headers": {
      "Authorization": "Bearer " + GITHUB_TOKEN,
      "Accept": "application/vnd.github.v3+json"
    },
    "payload": JSON.stringify({ "ref": "main" }),
    "muteHttpExceptions": true
  };
  
  try {
    UrlFetchApp.fetch(url, options);
  } catch (e) {
    // Ignore failure to prevent breaking UI
  }
}
```

---

## 3. Playwright Automation Code (Python Worker)
This is the core engine running in GitHub Actions. For the new website, we need to adapt the selectors, URLs, and navigation logic in a file exactly like this one.

```python
import logging
import re
import time
from playwright.sync_api import sync_playwright

# These are imported from a local config.py file which handles loading env vars
from config import HEADLESS, ZOMATO_BASE, load_cookies_data, save_cookies_data, ZOMATO_EMAIL, ZOMATO_PASSWORD

log = logging.getLogger(__name__)

TIMINGS_URL = f"{ZOMATO_BASE}/partners/onlineordering/outletInfo/outletTimings?resId={{res_id}}"
DASHBOARD_URL = f"{ZOMATO_BASE}/partners/onlineordering"

def _pw_cookies_to_playwright(cookies: list[dict]) -> list[dict]:
    out = []
    for c in cookies:
        entry = {
            "name": c["name"],
            "value": c["value"],
            "domain": c["domain"],
            "path": c.get("path", "/"),
        }
        if c.get("expires"):
            entry["expires"] = c["expires"]
        out.append(entry)
    return out

def _playwright_cookies_to_file(cookies: list[dict]) -> list[dict]:
    return [
        {"name": c["name"], "value": c["value"], "domain": c["domain"], "path": c["path"]}
        for c in cookies
    ]

def select_outlet_by_last4(page, last4: str, _depth: int = 0) -> bool:
    """Search outlet switcher using last 4 digits of Partner ID."""
    if _depth > 1:
        return False
    search_selectors = [
        'input[placeholder*="Search" i]',
        '[class*="search"] input[type="text"]',
    ]
    for sel in search_selectors:
        inp = page.locator(sel).first
        try:
            if inp.count() == 0 or not inp.is_visible(timeout=2000):
                continue
            inp.click()
            inp.fill("")
            inp.fill(last4)
            page.wait_for_timeout(1500)
            
            option = page.get_by_text(re.compile(re.escape(last4))).first
            if option.is_visible(timeout=3000):
                option.click()
                page.wait_for_timeout(1000)
                return True
        except Exception:
            continue

    for trigger in ['[class*="outlet" i]', 'button:has-text("Outlet")']:
        try:
            el = page.locator(trigger).first
            if el.is_visible(timeout=1500):
                el.click()
                page.wait_for_timeout(500)
                return select_outlet_by_last4(page, last4, _depth + 1)
        except Exception:
            continue
    return False

def _fill_timing_selects(page, store: dict) -> None:
    o_h, o_m, o_p = store["o_hour"], store["o_min"], store["o_period"]
    c_h, c_m, c_p = store["c_hour"], store["c_min"], store["c_period"]

    day_rows = page.locator("[class*='day'], [class*='timing-row'], [data-testid*='day']").all()
    for row in day_rows:
        row_selects = row.locator("select").all()
        if len(row_selects) >= 6:
            row_selects[0].select_option(o_h)
            row_selects[1].select_option(o_m)
            row_selects[2].select_option(o_p)
            row_selects[3].select_option(c_h)
            row_selects[4].select_option(c_m)
            row_selects[5].select_option(c_p)
            time.sleep(0.15)

def automated_google_login(page):
    """Fallback for when cookies expire."""
    page.goto(DASHBOARD_URL, wait_until="domcontentloaded", timeout=45000)
    
    if "login" in page.url:
        try:
            btn = page.get_by_role("button", name=re.compile(r"(google|continue|login)", re.I)).first
            if btn.is_visible(timeout=5000):
                btn.click()
            page.wait_for_timeout(3000)
        except Exception:
            pass
            
    if "accounts.google.com" in page.url:
        try:
            page.locator('input[type="email"]').fill(ZOMATO_EMAIL)
            page.keyboard.press("Enter")
            page.wait_for_timeout(3000)
            
            page.locator('input[type="password"]').fill(ZOMATO_PASSWORD)
            page.keyboard.press("Enter")
            page.wait_for_timeout(5000)
        except Exception as e:
            raise PermissionError(f"Failed Google login: {e}")
            
def update_store_ui(page, store: dict) -> bool:
    last4 = store["last4"]
    res_id = store["res_id"]

    page.goto(DASHBOARD_URL, wait_until="domcontentloaded", timeout=45000)
    if "login" in page.url:
        automated_google_login(page)

    searched = select_outlet_by_last4(page, last4)

    page.goto(TIMINGS_URL.format(res_id=res_id), wait_until="domcontentloaded", timeout=45000)
    page.wait_for_timeout(2000)

    _fill_timing_selects(page, store)

    saved = False
    for pattern in [re.compile(r"save", re.I), re.compile(r"update", re.I)]:
        try:
            btn = page.get_by_role("button", name=pattern).first
            if btn.is_visible(timeout=2000):
                btn.click()
                page.wait_for_timeout(2000)
                saved = True
                break
        except Exception:
            continue

    return saved

def run_updates(stores: list[dict]) -> list[dict]:
    cookies = load_cookies_data()
    ok_stores = []
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=HEADLESS)
        ctx = browser.new_context()
        if cookies:
            for c in _pw_cookies_to_playwright(cookies):
                try: ctx.add_cookies([c])
                except: pass
        page = ctx.new_page()

        if not cookies:
            automated_google_login(page)
            fresh = _playwright_cookies_to_file(ctx.cookies())
            if fresh: save_cookies_data(fresh)

        for store in stores:
            try:
                if update_store_ui(page, store):
                    ok_stores.append(store)
            except Exception as e:
                log.error("UI error: %s", e)

        fresh = _playwright_cookies_to_file(ctx.cookies())
        if fresh: save_cookies_data(fresh)
        browser.close()
        
    return ok_stores
```