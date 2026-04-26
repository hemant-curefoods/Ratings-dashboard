# Deploying the Curefoods Rating Dashboard

Step-by-step guide to push the code to a **private GitHub repo** and deploy
on **Streamlit Community Cloud** (free).

End result: a private URL like `https://curefoods-rating.streamlit.app` that
only the people you invite can access.

---

## Part 1 — Push to GitHub (one time, ~5 min)

### 1.1 · Create the GitHub repo

1. Go to <https://github.com/new>
2. **Repository name:** `curefoods-dashboard`
3. **Description:** `Curefoods rating intelligence dashboard`
4. ⭐ **Important:** Choose **Private** (not Public)
5. **Do not** initialize with README, .gitignore, or license
6. Click **Create repository**

GitHub will show you a page with setup commands — keep it open.

### 1.2 · Initialise the local folder

Open Terminal (macOS: `Cmd + Space`, type "Terminal", hit Enter), then:

```bash
cd ~/Desktop/curefoods-dashboard
git init
git add .
git commit -m "Initial commit — rating dashboard"
git branch -M main
```

### 1.3 · Connect to GitHub and push

Replace `YOUR_USERNAME` with your GitHub username:

```bash
git remote add origin https://github.com/YOUR_USERNAME/curefoods-dashboard.git
git push -u origin main
```

GitHub will ask for credentials. **Do not paste your password** — use a
**Personal Access Token** instead:

1. <https://github.com/settings/tokens/new>
2. Note: `dashboard-deploy` · Expiration: 90 days · Scopes: ✅ `repo`
3. Click **Generate token**, copy the long string
4. Paste that string when git asks for your password

After this, `git push` should succeed and your code appears at
`https://github.com/YOUR_USERNAME/curefoods-dashboard`.

---

## Part 2 — Deploy on Streamlit Community Cloud (~3 min)

### 2.1 · Sign in

1. Go to <https://share.streamlit.io>
2. Click **Continue with GitHub** and authorise it. Streamlit needs read
   access to your private repos so it can deploy them.

### 2.2 · Create the app

1. Click **New app** (top right)
2. **Repository:** `YOUR_USERNAME/curefoods-dashboard`
3. **Branch:** `main`
4. **Main file path:** `app.py`
5. **App URL:** pick something memorable like `curefoods-rating`
6. Click **Deploy**

Streamlit Cloud will install `requirements.txt` and start the app. First
deploy takes ~2–3 minutes.

### 2.3 · Make it private

By default the app URL is publicly visible. To restrict access:

1. Open the app's settings (`⋮` menu → **Settings** → **Sharing**)
2. Toggle **Only specific people can view this app**
3. Add team-member emails: `alekh.rastogi@curefoods.in`, `sumant@curefoods.in`, etc.
4. Each invitee will get an email with a sign-in link. They sign in with
   their Google or GitHub account associated with that email.

Done. Your dashboard is at `https://curefoods-rating.streamlit.app`,
viewable only by invitees.

---

## Part 3 — Updating the dashboard

When you change any file (e.g. add a brand to `BRAND_MAP`):

```bash
cd ~/Desktop/curefoods-dashboard
git add .
git commit -m "Add new brand mapping"
git push
```

Streamlit Cloud auto-detects the push and redeploys in ~30 seconds.

---

## Troubleshooting

**`fatal: not a git repository`**
You're not inside the project folder. Run `cd ~/Desktop/curefoods-dashboard` first.

**`Authentication failed` when pushing**
You're using your GitHub password. Generate a Personal Access Token (Part 1.3)
and paste *that* instead of your password.

**App shows "Module not found" after deploy**
Edit `requirements.txt` to add the missing package, commit, push.

**Upload fails with "File too large"**
Streamlit Cloud's free tier caps uploads at 200 MB. If your monthly file is
bigger, either zip it (the loader handles `.zip`) or upgrade to Streamlit
for Teams.

**App is slow / sleeps**
Free Streamlit Cloud apps go to sleep after 7 days of no traffic. First
visit after sleep takes ~30s to wake up. Set up a daily cron-job that
pings the URL if you want to keep it warm.

---

## What gets pushed (and what doesn't)

`.gitignore` already excludes:
- `__pycache__/`, `.DS_Store`, virtualenvs
- All `.xlsx` / `.csv` / `.zip` files (so you never accidentally commit
  customer data)
- `.streamlit/secrets.toml` (if you ever add API keys)

Files that *do* get pushed:
- `app.py`, `processing.py`, `config.py`
- `requirements.txt`
- `.streamlit/config.toml` (theme + server settings)
- `README.md`, `DEPLOY.md`

---

## Optional: custom domain

Streamlit Cloud's free tier gives you `*.streamlit.app` URLs only. If you
want `dashboard.curefoods.in`, you'll need Streamlit for Teams (paid) or
self-host (use the included files with `streamlit run app.py` on any
Linux box / Docker container).
