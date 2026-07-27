// ============================================================
// KitchenPulse Backend — Node.js + Express
// Deploy this on Railway.app (free tier)
// ============================================================

import "dotenv/config";
import express from "express";
import cors from "cors";
import toggleRoutes from "./server/toggle/toggle.routes.js";
import timingRoutes from "./server/timing/timing.routes.js";
import reviewsRouter from "./server/reviews/reviewsRouter.js";
import automationRoutes from "./server/ratings/automation.routes.js";
import insightsRoutes from "./server/ratings/insights.routes.js";
import authRoutes, { authMiddleware } from "./server/auth/auth.routes.js";
import { handleFilterRequest } from "./server/ratings/filters.js";
import { pool } from "./server/ratings/db.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.url} - Body:`, JSON.stringify(req.body));
  next();
});

// ─── HEALTH CHECK ─────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "Backend is running" });
});

// ─── DB TEST ENDPOINT ─────────────────────────────────────────
app.get("/test-db", async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM order_reviews LIMIT 1');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── MOUNT MODULAR ROUTES ─────────────────────────────────────
// Open route for login
app.use("/api/auth", authRoutes);

// Strictly secure all other API routes
app.use("/api", authMiddleware);

app.use("/api", toggleRoutes);
app.use("/api", timingRoutes);
app.use("/api/reviews", reviewsRouter);
app.use("/api/automation", automationRoutes);
app.use("/api/insights", insightsRoutes);

// New route for fetching filter dropdown options
app.get("/api/filters", handleFilterRequest);

// ─── START SERVER ─────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`KitchenPulse backend running on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
});
