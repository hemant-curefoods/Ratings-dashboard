"""
One-time local login → export cookies for Railway.

  python login_export.py

After Google login, prints ZOMATO_COOKIES_JSON to paste into Railway env vars.
Also saves cookies.json for local runs.
"""

import json
import sys

from playwright.sync_api import sync_playwright

from config import ZOMATO_BASE, save_cookies_data

COOKIES_FILE = __import__("config").COOKIES_FILE


def main():
    print("Opening browser for Zomato Google login…")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        ctx = browser.new_context()
        page = ctx.new_page()
        page.goto(f"{ZOMATO_BASE}/partners/login")

        print("\n" + "=" * 60)
        print("1. Log in with Google in the browser")
        print("2. Wait for the Zomato partner dashboard")
        print("3. Press Enter here")
        print("=" * 60 + "\n")
        input()

        cookies = [
            {"name": c["name"], "value": c["value"], "domain": c["domain"], "path": c["path"]}
            for c in ctx.cookies()
        ]
        browser.close()

    save_cookies_data(cookies)
    one_line = json.dumps(cookies, separators=(",", ":"))

    print(f"\nSaved → {COOKIES_FILE}\n")
    print("Add this to Railway as variable ZOMATO_COOKIES_JSON:\n")
    print(one_line[:120] + "…" if len(one_line) > 120 else one_line)
    print(f"\n(Full JSON length: {len(one_line)} chars — copy from {COOKIES_FILE} if needed)")


if __name__ == "__main__":
    main()
