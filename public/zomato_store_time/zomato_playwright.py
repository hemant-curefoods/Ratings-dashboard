import logging
import re
import time

from playwright.sync_api import sync_playwright

from config import HEADLESS, ZOMATO_BASE, load_cookies_data, save_cookies_data, ZOMATO_EMAIL, ZOMATO_PASSWORD
from config import COOKIES_FILE

log = logging.getLogger(__name__)

TIMINGS_URL = (
    f"{ZOMATO_BASE}/partners/onlineordering/outletInfo/outletTimings?resId={{res_id}}"
)
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
    """Search outlet switcher using last 4 digits of Zomato ID."""
    if _depth > 1:
        return False
    search_selectors = [
        'input[placeholder*="Search" i]',
        'input[placeholder*="search" i]',
        'input[placeholder*="outlet" i]',
        'input[placeholder*="restaurant" i]',
        '[class*="search"] input[type="text"]',
        '[class*="Search"] input',
    ]
    for sel in search_selectors:
        inp = page.locator(sel).first
        try:
            if inp.count() == 0 or not inp.is_visible(timeout=2000):
                continue
            inp.click(timeout=2000)
            inp.fill("", timeout=2000)
            inp.fill(last4, timeout=2000)
            page.wait_for_timeout(500)
            # Click first result that contains the last 4 digits
            option = page.get_by_text(re.compile(re.escape(last4))).first
            if option.is_visible(timeout=1500):
                option.click(timeout=2000)
                page.wait_for_timeout(500)
                log.info("Selected outlet via search last4=%s", last4)
                return True
        except Exception:
            continue

    # Try opening outlet dropdown then search
    for trigger in [
        '[class*="outlet" i]',
        '[class*="restaurant" i]',
        'button:has-text("Outlet")',
        '[data-testid*="outlet"]',
    ]:
        try:
            el = page.locator(trigger).first
            if el.is_visible(timeout=1500):
                el.click(timeout=2000)
                page.wait_for_timeout(500)
                return select_outlet_by_last4(page, last4, _depth + 1)
        except Exception:
            continue
    return False


def _fill_timing_selects(page, store: dict) -> None:
    o_h, o_m, o_p = store["o_hour"], store["o_min"], store["o_period"]
    c_h, c_m, c_p = store["c_hour"], store["c_min"], store["c_period"]

    selects = page.locator("select").all()
    if len(selects) >= 6:
        for i in range(0, len(selects), 6):
            group = selects[i : i + 6]
            if len(group) < 6:
                break
            group[0].select_option(o_h)
            group[1].select_option(o_m)
            group[2].select_option(o_p)
            group[3].select_option(c_h)
            group[4].select_option(c_m)
            group[5].select_option(c_p)
            time.sleep(0.02)
        return

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
            time.sleep(0.02)


def automated_google_login(page):
    if not ZOMATO_EMAIL or not ZOMATO_PASSWORD:
        raise PermissionError("No cookies found and ZOMATO_EMAIL/ZOMATO_PASSWORD are not set. Cannot login.")
        
    log.info("Starting automated Google SSO login...")
    try:
        page.goto(DASHBOARD_URL, wait_until="domcontentloaded", timeout=5000)
    except Exception as e:
        log.warning("Dashboard page load timeout, proceeding anyway: %s", e)
    
    if "login" in page.url:
        try:
            btn = page.get_by_role("button", name=re.compile(r"(google|continue|login)", re.I)).first
            if btn.is_visible(timeout=5000):
                btn.click()
            page.wait_for_timeout(3000)
        except Exception:
            pass
            
    if "accounts.google.com" in page.url:
        log.info("Entering email...")
        try:
            page.locator('input[type="email"]').fill(ZOMATO_EMAIL)
            page.keyboard.press("Enter")
            page.wait_for_timeout(3000)
            
            log.info("Entering password...")
            page.locator('input[type="password"]').fill(ZOMATO_PASSWORD)
            page.keyboard.press("Enter")
            page.wait_for_timeout(5000)
        except Exception as e:
            raise PermissionError(f"Failed to enter credentials on Google login: {e}")
            
    if "login" in page.url or "accounts.google.com" in page.url:
        raise PermissionError("Automated Google login failed. Google might be blocking the headless browser, or email/password is incorrect.")
        
    log.info("Automated Google login successful!")

def update_store_ui(page, store: dict) -> bool:
    last4 = store["last4"]
    res_id = store["res_id"]
    log.info(
        "UI update  res_id=%s  last4=%s  %s→%s  %s",
        res_id, last4, store["opening_raw"], store["closing_raw"], store["kitchen_id"],
    )

    try:
        page.goto(DASHBOARD_URL, wait_until="domcontentloaded", timeout=5000)
    except Exception as e:
        log.warning("Dashboard page load timeout, proceeding anyway: %s", e)
    if "login" in page.url:
        log.warning("Session expired. Attempting automated re-login...")
        automated_google_login(page)

    searched = select_outlet_by_last4(page, last4)

    try:
        page.goto(TIMINGS_URL.format(res_id=res_id), wait_until="domcontentloaded", timeout=5000)
    except Exception as e:
        log.warning("Timings page load timeout, proceeding anyway: %s", e)
    page.wait_for_timeout(500)

    try:
        body = page.inner_text("body", timeout=5000)
        if last4 not in body:
            log.warning("last4=%s not found on timings page — check res_id", last4)
    except Exception:
        log.warning("Could not read page body (likely blocked by Cloudflare).")

    _fill_timing_selects(page, store)

    saved = False
    for pattern in [re.compile(r"save", re.I), re.compile(r"update", re.I)]:
        try:
            btn = page.get_by_role("button", name=pattern).first
            if btn.is_visible(timeout=2000):
                btn.click()
                # Give Zomato extra time to process the save request before closing
                page.wait_for_timeout(4000)
                saved = True
                break
        except Exception:
            continue

    if saved:
        log.info("SUCCESS [ui]  res_id=%s  last4=%s", res_id, last4)
    else:
        log.error("FAILURE [ui]  res_id=%s  last4=%s — Save button not found", res_id, last4)
    return saved


def run_updates(stores: list[dict]) -> list[dict]:
    cookies = load_cookies_data()

    ok_stores = []
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=HEADLESS, 
            args=["--disable-http2", "--disable-blink-features=AutomationControlled"]
        )
        ctx = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/147.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 800}
        )
        if cookies:
            for c in _pw_cookies_to_playwright(cookies):
                try:
                    ctx.add_cookies([c])
                except Exception as e:
                    pass # Silently skip any invalid individual cookies
        page = ctx.new_page()
        
        # Hide the webdriver footprint so Zomato doesn't know it's a bot
        page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        
        # Set a strict global timeout so Cloudflare cannot freeze the script indefinitely
        page.set_default_timeout(15000)
        page.set_default_navigation_timeout(15000)

        if not cookies:
            log.info("No cookies found. Attempting initial automated login...")
            automated_google_login(page)
            # Save fresh cookies immediately
            fresh = _playwright_cookies_to_file(ctx.cookies())
            if fresh:
                save_cookies_data(fresh)

        for store in stores:
            try:
                if update_store_ui(page, store):
                    ok_stores.append(store)
            except PermissionError as pe:
                log.error("CRITICAL: %s", pe)
                # Try to save whatever cookies we currently have before dying
                fresh = _playwright_cookies_to_file(ctx.cookies())
                if fresh:
                    save_cookies_data(fresh)
                raise pe
            except Exception as e:
                log.error("UI error res_id=%s: %s", store["res_id"], e)

        # Refresh cookies after run (session may rotate)
        fresh = _playwright_cookies_to_file(ctx.cookies())
        if fresh:
            save_cookies_data(fresh)

        browser.close()
    return ok_stores
