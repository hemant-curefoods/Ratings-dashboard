# Zomato Store Timing Automation

Reads **Opening time**, **Closing time**, and **Zomato ID** from a Google Sheet and updates Zomato partner outlet timings automatically. 

This automation is designed to run locally on your Mac using `cron`.

## How it works (Google Sheets Architecture)
The project uses a simple manual queue setup:
1. **`Visible_Sheet`**: The interface where you change timings and manage the queue.

The Google Apps Script (`google_apps_script.js`) instantly flags checked rows as **Pending**. The Python backend running on GitHub Actions then processes these rows, updates Zomato, and writes back the **success** (or **failure**) status.

## Fully Automated Cloud Login

The system uses an automated headless Google login script to authenticate with Zomato Partner. It logs in entirely inside GitHub Actions. You don't need to run `login_export.py` on your computer unless you want to log in locally.

## GitHub Actions (Cloud Execution)

This project is configured to run automatically in the cloud using **GitHub Actions**.

### How to Deploy
1. Create a private repository on GitHub and push all of these files to it.
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```
2. Generate your secrets strings by running:
   ```bash
   python export_github_secrets.py
   ```
3. Go to your GitHub repository -> **Settings** -> **Secrets and variables** -> **Actions**.
4. Click **New repository secret** and add the following:
   * `SHEET_ID`: (Your Google Sheet ID)
   * `VISIBLE_TAB`: `Visible_Sheet`
   * `GOOGLE_SERVICE_ACCOUNT_JSON`: (Paste from the export script)
   * `ZOMATO_EMAIL`: (Your Google/Zomato Email)
   * `ZOMATO_PASSWORD`: (Your Google Password)
   * `ZOMATO_COOKIES_JSON`: (Leave blank unless you exported manually)

Once pushed, GitHub will automatically trigger the script every hour based on the `.github/workflows/sync.yml` file!

### Manual Run
You can trigger a manual sync anytime by going to the **Actions** tab in GitHub, clicking **Zomato Timings Sync**, and clicking **Run workflow**.

## Files Explained

| File | Purpose |
|------|---------|
| `main.py` | Entry point. Reads pending rows and processes them in batches. |
| `google_apps_script.js` | Code pasted into Google Sheets Extensions. Turns the Reset checkbox into a queue button. |
| `sheet.py` | Connects to Google Sheets via `gspread` to read/write statuses (`Pending`, `in process`, `success`). |
| `zomato_playwright.py` | The headless Playwright script that navigates Zomato and types the new timings. |
| `login_export.py` | One-time browser login to capture `cookies.json`. |
