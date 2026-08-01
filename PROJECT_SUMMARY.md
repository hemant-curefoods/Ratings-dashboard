# CFI Website Development Summary

This document summarizes the major features and improvements built across all tabs of the CFI Dashboard application.

## 1. Toggle Tab (Store Management)
The Toggle Tab was entirely rebuilt to support bulk operations and rate-limit compliance with beautiful, responsive UI features.

*   **Draggable Bulk Progress Island:** A highly interactive floating widget (`BulkProgressIsland.jsx`) that displays the real-time progress of bulk toggle jobs. It is fully draggable, minimizable, and elegantly slides away after completion.
*   **Job Management (Pause/Resume/Cancel):** Bulk jobs can be paused, resumed, or cancelled mid-execution. A cancelled job intelligently stops further API calls while preserving the already-toggled stores to save rate limits.
*   **Intelligent Search Autocomplete:** Real-time dropdown search filtering for Store Names and Location IDs.
*   **Audit Log & History Modal:** 
    *   Tracks all manual and automated toggle events.
    *   **"Show System Syncs" Toggle:** Allows filtering out automated bot events to prevent dashboard clutter.
    *   **48-Hour Auto-Purge:** The Postgres database automatically deletes old logs to prevent bloat.
    *   **CSV Report Export:** Users can download the full 48-hour history (including all filters and locations applied) instantly as an Excel-ready CSV.
*   **Backend Queue & Rate Limiting:** Built a robust background worker (`server/toggle/queue.js`) that automatically adheres to the strict 18 requests/minute rate limit from Swiggy/Zomato, pausing and resuming jobs dynamically.
*   **Dashboard Sidebar:** Displays real-time API health, recent activity, and lists "Problem Stores" that failed to sync so they can be manually re-tried.

## 2. Insights Tab (Ratings & Reviews Dashboard)
The Insights Tab transforms daily raw data into actionable dashboards.

*   **Database Integration:** Migrated the data source to a high-performance Postgres Database (`order_reviews`), significantly speeding up query times over the previous Supabase architecture.
*   **Data Completeness:** The database is continuously fed with parsed emails. It is fully up-to-date with all GMV, ratings, and customer comments pushed till **July 26, 2026**.
*   **Brand & Location Dashboards:** Implemented dynamic components (`BrandDashboard.jsx`, `LocationMatrixAndSummary.jsx`) to analyze performance across zones, cities, and individual stores.
*   **AI-Powered Insights:** Integrated tools to summarize negative reviews and generate human-readable reports on store performance using AI (`TextAIInsight.jsx`).

## 3. Core Architecture
*   **Tech Stack:** React (Vite) frontend with a Node.js Express backend.
*   **Database:** PostgreSQL (replacing legacy Supabase tables for speed and complex querying).
*   **Design System:** Built using a custom, premium "Royal Blue & White" color palette with smooth micro-animations, glassmorphism, and responsive layouts.
