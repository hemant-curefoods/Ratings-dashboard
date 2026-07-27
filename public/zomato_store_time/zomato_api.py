import json
import logging

import requests

from config import CSRF_URL, DAYS, UPDATE_URL, ZOMATO_BASE, load_cookies_data

log = logging.getLogger(__name__)


def build_payload(res_id: str, opening: str, closing: str) -> dict:
    return {
        "res_id": res_id,
        "data": [{
            "action": "update",
            "service_type": "delivery",
            "timings": [
                {
                    "day": day,
                    "active": True,
                    "isEdited": True,
                    "slots": [{"start": opening, "end": closing}],
                }
                for day in DAYS
            ],
        }],
    }


def _session() -> requests.Session:
    session = requests.Session()
    session.headers.update({
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 Chrome/147.0.0.0 Safari/537.36"
        ),
    })
    cookies = load_cookies_data()
    if not cookies:
        raise RuntimeError("No Zomato cookies. Run: python login_export.py")
    for c in cookies:
        session.cookies.set(c["name"], c["value"], domain=c["domain"], path=c["path"])
    return session


def get_csrf(session: requests.Session) -> str:
    resp = session.get(CSRF_URL, headers={"Accept": "application/json"}, timeout=15)
    resp.raise_for_status()
    token = resp.json().get("csrf", "")
    if not token:
        raise RuntimeError(f"Empty CSRF response: {resp.text[:200]}")
    return token


def api_headers(csrf: str) -> dict:
    return {
        "Content-Type": "application/json",
        "x-zomato-csrft": csrf,
        "x-client-id": "zomato_web_merchant",
        "x-zomato-app-version": "2",
        "Accept": "application/json",
        "Referer": f"{ZOMATO_BASE}/partners/onlineordering",
    }


def update_store(session: requests.Session, csrf: str, store: dict) -> bool:
    payload = build_payload(store["res_id"], store["opening_raw"], store["closing_raw"])
    resp = session.post(UPDATE_URL, json=payload, headers=api_headers(csrf), timeout=20)

    if resp.status_code == 401 or "login" in resp.url:
        raise PermissionError("Session expired — refresh ZOMATO_COOKIES_JSON on Railway")

    try:
        body = resp.json()
    except Exception:
        log.error("res_id=%s  Non-JSON: %s", store["res_id"], resp.text[:300])
        return False

    ok = (body.get("data") in (None, [])) and body.get("message", "") == ""
    if ok:
        log.info(
            "SUCCESS [api]  res_id=%s  last4=%s  %s→%s  %s",
            store["res_id"], store["last4"], store["opening_raw"], store["closing_raw"], store["kitchen_id"],
        )
    else:
        log.error("FAILURE [api]  res_id=%s  last4=%s  %s", store["res_id"], store["last4"], json.dumps(body))
    return ok


def run_updates(stores: list[dict]) -> list[dict]:
    session = _session()
    csrf = get_csrf(session)
    log.info("CSRF token: %s…", csrf[:10])
    ok_stores = []
    for store in stores:
        try:
            if update_store(session, csrf, store):
                ok_stores.append(store)
        except Exception as e:
            log.error("res_id=%s  %s", store["res_id"], e)
    return ok_stores
