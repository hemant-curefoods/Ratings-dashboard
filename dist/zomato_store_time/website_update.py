import os
import logging
import re
import zomato_playwright
import zomato_api
import sys

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
)
log = logging.getLogger(__name__)

def parse_time_to_dict(t_str):
    if not t_str or t_str.lower() == "none":
        return {"hour": "12", "min": "00", "period": "AM"}
    t_str = t_str.strip().upper()
    match = re.match(r"(\d{1,2}):(\d{2})\s*(AM|PM)", t_str)
    if match:
        h, m, p = match.groups()
        return {"hour": str(int(h)), "min": m, "period": p}
    return {"hour": "12", "min": "00", "period": "AM"}

def to_24h(t_str, parsed):
    if not t_str or str(t_str).lower() == "none":
        return ""
    h = int(parsed["hour"])
    if parsed["period"] == "PM" and h < 12:
        h += 12
    if parsed["period"] == "AM" and h == 12:
        h = 0
    return f"{h:02d}:{parsed['min']}"

def main():
    zomato_id = os.getenv("ZOMATO_ID")
    opening = os.getenv("OPENING_TIME")
    closing = os.getenv("CLOSING_TIME")
    opening2 = os.getenv("OPENING_TIME_2")
    closing2 = os.getenv("CLOSING_TIME_2")
    slot = os.getenv("ZOMATO_SLOT", "1")
    store_name = os.getenv("STORE_NAME", "Unknown Store")
    
    if not zomato_id:
        log.error("ZOMATO_ID is missing. Make sure to add it to your STORES array in frontend.")
        return
        
    target_open = opening if str(slot) == "1" else opening2
    target_close = closing if str(slot) == "1" else closing2

    parsed_open = parse_time_to_dict(target_open)
    parsed_close = parse_time_to_dict(target_close)

    store = {
        "res_id": zomato_id,
        "last4": zomato_id[-4:] if len(zomato_id) >= 4 else zomato_id,
        "opening_raw": target_open,
        "closing_raw": target_close,
        "o_hour": parsed_open["hour"],
        "o_min": parsed_open["min"],
        "o_period": parsed_open["period"],
        "c_hour": parsed_close["hour"],
        "c_min": parsed_close["min"],
        "c_period": parsed_close["period"],
        "opening_24h": to_24h(target_open, parsed_open),
        "closing_24h": to_24h(target_close, parsed_close),
        "kitchen_id": store_name
    }
    
    log.info(f"Attempting lightning-fast API update for {store_name} ({zomato_id})")
    
    try:
        store["opening_raw"] = store["opening_24h"]
        store["closing_raw"] = store["closing_24h"]
        
        ok_api = zomato_api.run_updates([store])
        if ok_api:
            log.info(f"Successfully updated {store_name} via Zomato API!")
        else:
            log.warning(f"API failed for {store_name}. Attempting Playwright UI fallback...")
            store["opening_raw"] = target_open
            store["closing_raw"] = target_close
            
            ok_stores = zomato_playwright.run_updates([store])
            if ok_stores:
                log.info(f"Successfully updated {store_name} via Playwright fallback!")
            else:
                log.error(f"Failed to update {store_name} via both API and Playwright")
                sys.exit(1)
    except Exception as e:
        log.error(f"Automation error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()