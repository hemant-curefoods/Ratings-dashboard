"""
Zomato store timing automation — Google Sheet → Zomato (hourly on GitHub Actions).

Local:   python main.py
Cloud:   cron runs this headlessly every hour.

One-time login (local only):
  python login_export.py
  → paste printed JSON into GitHub Actions variable ZOMATO_COOKIES_JSON
"""

import logging
import sys
import time

from config import LOG_FILE, UPDATE_METHOD
from sheet import read_stores, mark_updating_stores, mark_failed_stores, mark_completed
import zomato_api
import zomato_playwright

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


def chunker(seq, size):
    return (seq[pos:pos + size] for pos in range(0, len(seq), size))

def main():
    log.info("─── Run started  method=%s ───", UPDATE_METHOD)

    stores = read_stores()
    if not stores:
        log.info("No 'Pending' rows found in the queue. Nothing to do.")
        return

    log.info("Stores to process: %d", len(stores))
    for s in stores:
        log.info(
            "  res_id=%-10s  last4=%s  %s→%s  %s",
            s["res_id"], s["last4"], s["opening_raw"], s["closing_raw"], s["kitchen_id"],
        )

    BATCH_SIZE = 15
    total_ok = 0
    total_failed = 0

    batches = list(chunker(stores, BATCH_SIZE))
    for i, batch in enumerate(batches):
        log.info("Processing batch %d of %d (size: %d)", i + 1, len(batches), len(batch))
        mark_updating_stores(batch)

        try:
            if UPDATE_METHOD == "playwright":
                ok_stores = zomato_playwright.run_updates(batch)
            else:
                ok_stores = zomato_api.run_updates(batch)
        except PermissionError as pe:
            log.error("Halting execution due to session error: %s", pe)
            mark_failed_stores(batch)
            total_failed += len(batch)
            break
        except Exception as e:
            log.error("CRITICAL CRASH: %s", e)
            mark_failed_stores(batch)
            total_failed += len(batch)
            break
            
        failed_stores = [s for s in batch if s not in ok_stores]

        if ok_stores:
            mark_completed(ok_stores)
            total_ok += len(ok_stores)
            
        if failed_stores:
            mark_failed_stores(failed_stores)
            total_failed += len(failed_stores)

        if i < len(batches) - 1:
            time.sleep(5)

    log.info("─── Run complete: %d success, %d failure ───\n", total_ok, total_failed)


if __name__ == "__main__":
    main()
