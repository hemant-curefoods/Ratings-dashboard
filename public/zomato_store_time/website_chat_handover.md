# Chat Handover — Automation Control Center Website

Use this document to provide context in a new Cursor chat tab for building the central automation website.

## 1. Project Goal
We are building a **web application** that will act as the central hub for all our food delivery partner automations (Zomato, Swiggy, etc.). 
This website will replace the current Google Sheets frontend, allowing users to manage store timings, view logs, and trigger automation runs directly from a custom dashboard.

## 2. Existing Automation Context
To understand how the backend automations work, here is the current architecture:
- **Core Engine:** Python + Playwright. Headless browsers log into partner dashboards (via stored `cookies.json` or fallback Google SSO), search for stores using the last 4 digits of their ID, and update the `<select>` dropdowns for opening/closing times.
- **Current Trigger:** Google Sheets Apps Script sends a webhook to GitHub Actions (`sync.yml` repository dispatch) to wake up the server.
- **Current Data Store:** A Google Sheet (`Visible_Sheet` tab) tracking `kitchen_id`, `Platform_ID`, `Opening_time`, `Closing_time`, and `Sync_Status`.

## 3. Website Objectives
The new website should implement the following:
1. **Database:** Replace the Google Sheet with a proper database (e.g., PostgreSQL, SQLite, or Firebase) to store restaurants, platform IDs, timings, and sync statuses.
2. **Dashboard UI:** A clean interface to list stores, edit their timings, and show status tags (Pending, In Process, Success, Failure).
3. **Execution Integration:** 
   - *Option A:* The website backend runs the Python Playwright scripts directly via background workers (e.g., Celery/Redis).
   - *Option B:* The website acts as the trigger, sending the API webhook to GitHub Actions just like the old Google Apps Script did.
4. **Credential Management:** Safely store Google SSO credentials and active session cookies.

## 4. Proposed Tech Stack
*(Agent: Please ask the user to confirm their preferred stack before generating boilerplate).*
- **Backend Options:** FastAPI / Django / Flask (Native Python support makes integrating the existing Playwright scripts very straightforward).
- **Frontend Options:** Next.js / React / HTML templates with Tailwind CSS.

## 5. First Tasks for the AI Assistant
1. Help me choose the best tech stack for this website based on my current Python automations.
2. Generate the initial project structure and database models.
3. Build the primary dashboard UI to list and edit store timings.
4. Implement the logic to trigger the existing Playwright automations from the web UI.

---

**To start:**
1. Copy the contents of this file or type `@website_chat_handover.md`.
2. Tell the AI what tech stack you'd prefer to use (e.g., "Let's build this using FastAPI and React").

*End of handover.*