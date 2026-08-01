# Chat handover — Zomato store timing automation

Use this document to continue work in a new Cursor chat. Paste or attach it at the start of the new conversation.

**Workspace:** `/Users/ajelhenry/zomato_store_time`  
**User:** ajelhenry (macOS)  
**Last updated in chat:** May 20, 2026

---

## 1. Goal (what the user wants)

Fully automatic updates of **Zomato Partner** outlet opening/closing times based on a **Google Sheet**:

1. User fills **Opening time**, **Closing time**, and **Zomato** (restaurant ID) in the sheet.
2. Automation reads those rows (skip rows with empty opening or closing).
3. Uses the **last 4 digits** of the Zomato ID to search/verify the correct outlet on the partner site.
4. Updates timings on Zomato for **all days** with those hours.
5. Runs **automatically on a schedule** (hourly) via **Railway**, using **Playwright** for the partner website flow.

The user explicitly asked for Playwright + Railway (not only local cron). API-based updates were also built and proven working locally.

---

## 2. Google Sheet

| Setting | Value |
|---------|--------|
| Sheet ID | `1cM1-Eotcjho0P9boOeSZXIYqbfisSRju0n802yAA3zo` |
| Tab name | `RID_master` |

### Columns used (exact header names matter)

| Column | Notes |
|--------|--------|
| `Opening time ` | Trailing space in header name |
| `Closing time` | |
| `Zomato` | Full restaurant ID (string) |
| `kitchen_id` | Human-readable store name (logging only) |

### Row logic

- Process row only if **both** Opening and Closing are non-empty.
- Skip if `Zomato` is empty.
- `last4` = last 4 characters of Zomato ID (used for UI search/verification).

### Stores verified working (as of May 19, 2026)

| kitchen_id | Zomato res_id | last4 | Hours (24h) |
|------------|---------------|-------|-------------|
| Shivajinagar - Cheesecakes By CakeZone - Online | 20366294 | 6294 | 10:00 → 17:00 |
| Andheri West - Cheesecakes By CakeZone - Online | 20405575 | 5575 | 10:00 → 23:00 |

---

## 3. What was accomplished in this chat

### Working locally (API path — `script.py` / `zomato_api.py`)

- User completed **one-time Google SSO login** in browser; cookies saved to `cookies.json`.
- **2/2 stores updated successfully** via Zomato merchant API (May 19, 10:19 and 16:10).
- Second run used saved cookies with **no re-login**.

### Refactor for Railway + Playwright

- Split into modules: `config.py`, `sheet.py`, `zomato_api.py`, `zomato_playwright.py`, `main.py`.
- Added `login_export.py` (one-time login → export cookies for Railway).
- Added `export_railway_vars.py` (prints `GOOGLE_SERVICE_ACCOUNT_JSON` and `ZOMATO_COOKIES_JSON` from local files).
- Railway files: `Dockerfile`, `railway.toml` (hourly cron `0 * * * *`), `README.md`, `.env.example`.
- **Default update method set to `playwright`** per user request (`config.py`, `.env`, `Dockerfile`).

### Not confirmed done in chat

- **Railway project actually deployed** with all env vars set (config files exist; user may still need to connect GitHub and paste secrets).
- **Playwright UI path** run end-to-end on Railway (heavier, UI selectors may need tuning).
- **HTTP backend endpoint** (user asked “yes connect it with railways” — cron deploy was done, not a separate FastAPI/health server).

---

## 4. Architecture

```
Google Sheet (RID_master)
        │
        ▼
   sheet.read_stores()
        │
        ▼
     main.py  ── UPDATE_METHOD ──┬── playwright → zomato_playwright.run_updates()
                                  └── api        → zomato_api.run_updates()
```

### `UPDATE_METHOD=api` (Zomato merchant HTTP API)

- Uses saved session cookies + fresh CSRF from `https://www.zomato.com/webroutes/auth/csrf`.
- POST `https://www.zomato.com/merchant-api/restaurant/update-timings`.
- Payload: all 7 days, `service_type: delivery`, `isEdited: true`, single slot per day.
- Success: response `data` empty/null and `message` empty string.
- **Proven working locally** with `cookies.json`.

### `UPDATE_METHOD=playwright` (default now)

- Headless Chromium (Playwright Docker image on Railway).
- Loads cookies from `ZOMATO_COOKIES_JSON` or `cookies.json`.
- For each store:
  1. Go to partner dashboard.
  2. Search/select outlet by **last 4 digits** (`select_outlet_by_last4`).
  3. Open timings URL: `/partners/onlineordering/outletInfo/outletTimings?resId={res_id}`.
  4. Fill `<select>` dropdowns for all days (6 selects per day: open h/m/AM-PM + close h/m/AM-PM).
  5. Click Save/Update button.
- Refreshes `cookies.json` after run if possible.

---

## 5. Project files (root — ignore `venv/`)

| File | Role |
|------|------|
| `main.py` | **Entry point** — read sheet, dispatch api or playwright |
| `config.py` | Env vars, cookie load/save, Zomato URLs |
| `sheet.py` | Google Sheets read + time parsing |
| `zomato_api.py` | API updater |
| `zomato_playwright.py` | Playwright UI updater (last4 search) |
| `login_export.py` | One-time local login → `cookies.json` + hint for Railway |
| `export_railway_vars.py` | Print Railway-ready env JSON from local files |
| `script.py` | **Legacy** monolithic API script (still works) |
| `update_zomato_timings.py` | **Legacy** Playwright UI script (superseded by `zomato_playwright.py`) |
| `cookies.json` | Zomato session (gitignored) — **exists, login done** |
| `.env` | Local secrets (gitignored) |
| `Dockerfile` | Playwright Python image, `UPDATE_METHOD=playwright` |
| `railway.toml` | Dockerfile build, cron hourly, `python main.py` |
| `requirements.txt` | gspread, google-auth, python-dotenv, requests, playwright |
| `timings_update.log` | Run logs |
| `README.md` | Deploy instructions |

---

## 6. Environment variables

### Local (`.env` — current)

```
SHEET_ID=1cM1-Eotcjho0P9boOeSZXIYqbfisSRju0n802yAA3zo
TAB_NAME=RID_master
SERVICE_ACCOUNT_FILE=/Users/ajelhenry/Downloads/zomato_store_timing.json
UPDATE_METHOD=playwright
HEADLESS=true
```

### Railway (required)

| Variable | Description |
|----------|-------------|
| `SHEET_ID` | Same as above |
| `TAB_NAME` | `RID_master` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Full service account JSON **one line** (not file path) |
| `ZOMATO_COOKIES_JSON` | Full `cookies.json` contents **one line** |
| `UPDATE_METHOD` | `playwright` (user choice) or `api` (more reliable on server) |
| `HEADLESS` | `true` |

Generate Railway values locally:

```bash
cd /Users/ajelhenry/zomato_store_time
python3 export_railway_vars.py
```

Refresh cookies when session expires:

```bash
python3 login_export.py
# then update ZOMATO_COOKIES_JSON on Railway
```

### Service account file (local only)

Path: `/Users/ajelhenry/Downloads/zomato_store_timing.json`  
Scope: `https://www.googleapis.com/auth/spreadsheets.readonly`

---

## 7. Login / auth constraints (important)

- **Google SSO cannot be automated** on Railway (no password/2FA access for the agent).
- **One-time manual login** on the user’s Mac saves `cookies.json`.
- That JSON is copied to Railway as `ZOMATO_COOKIES_JSON`.
- When cookies expire (401 / redirect to login), user must run `login_export.py` again and update Railway.
- Agent **cannot** complete initial login without the user at the machine.

---

## 8. Commands

```bash
# Local run (uses .env + cookies.json)
cd /Users/ajelhenry/zomato_store_time
python3 main.py

# Force API mode locally
UPDATE_METHOD=api python3 main.py

# One-time login export
python3 login_export.py

# Print Railway env blobs
python3 export_railway_vars.py

# Legacy (still works)
python3 script.py
```

### Local hourly cron (Mac — optional)

```
0 * * * * /usr/bin/python3 /Users/ajelhenry/zomato_store_time/main.py
```

---

## 9. Railway deployment checklist (likely next steps)

1. Push repo to GitHub (ensure `cookies.json` and `.env` are **not** committed — see `.gitignore`).
2. Railway → New Project → Deploy from GitHub repo root `zomato_store_time`.
3. Set all variables from section 6.
4. Confirm cron service runs `python main.py` every hour (`railway.toml`).
5. Check deploy logs for `SUCCESS [ui]` or `SUCCESS [api]` lines.
6. If Playwright fails on Railway (selectors, timeout), try `UPDATE_METHOD=api` — same sheet logic, proven API path.

### Dockerfile note

- Base: `mcr.microsoft.com/playwright/python:v1.49.0-jammy`
- Copies: `config.py`, `sheet.py`, `zomato_api.py`, `zomato_playwright.py`, `main.py`
- Does **not** copy `login_export.py` (login is local-only by design).

---

## 10. Known issues / risks

| Issue | Detail |
|-------|--------|
| Playwright UI fragility | Zomato DOM may change; `select_outlet_by_last4` and save button selectors are heuristic |
| `Opening time ` column | Header has trailing space — must match exactly in code |
| Cookie expiry | Sessions die periodically; refresh `ZOMATO_COOKIES_JSON` |
| Railway Playwright | Heavier than API; may need more memory/time |
| `export_railway_vars.py` | Was planned; file exists at project root |
| Prior chat limit | User hit Cursor limit mid-task; work resumed in follow-up chats |

---

## 11. User conversation timeline (summary)

1. User asked to continue after hitting chat limit — project had `script.py` + sheet integration.
2. Playwright Chromium install was needed; user logged in manually; **2/2 API updates succeeded**.
3. User asked if agent could login alone — **no**, only user for first SSO; then cookies automate runs.
4. User wanted **fully automatic** with Playwright + Railway + last4 search on partner site.
5. Backend modules + Railway config were added.
6. User asked to **connect backend to Playwright** — default `UPDATE_METHOD=playwright`.
7. User asked to **connect to Railway** — `railway.toml`, `Dockerfile`, docs updated for Playwright default.
8. User requested **`chat_handover.md`** (this file).

---

## 12. Suggested prompts for the next chat

Copy one of these:

> Read `chat_handover.md` and deploy this project to Railway. Walk me through setting env vars using `export_railway_vars.py`.

> Read `chat_handover.md`. Run `main.py` with Playwright locally and fix any UI selector failures on the timings page.

> Read `chat_handover.md`. Switch Railway to `UPDATE_METHOD=api` if Playwright fails, and verify hourly cron logs.

> Read `chat_handover.md`. Add a small HTTP server (health + manual trigger) for Railway in addition to cron.

---

## 13. Secrets — do not commit

- `.env`
- `cookies.json`
- `/Users/ajelhenry/Downloads/zomato_store_timing.json`
- Any `ZOMATO_COOKIES_JSON` / `GOOGLE_SERVICE_ACCOUNT_JSON` values in docs or git

`.gitignore` already excludes: `.env`, `cookies.json`, `zomato_session.json`, `timings_update.log`, `*.png`, `__pycache__/`.

---

## 14. Git status

Project was **not** a git repo at conversation start. User may have added git later — confirm before push.

---

*End of handover. Attach this file in the new chat: `@chat_handover.md`*
