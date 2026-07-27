import express from "express";

const router = express.Router();

// ─── GITHUB ACTIONS CONFIG (for store timing) ────────────────
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const GITHUB_REPO  = process.env.GITHUB_REPO  || "ajelhenry-office/CFI_website";

// ─── TIMING ENDPOINT ──────────────────────────────────────────
router.post("/timing", async (req, res) => {
  const { store_id, location_id, zomato_id, store_name, opening_time, closing_time, opening_time_2, closing_time_2, slot } = req.body;

  if (!(location_id || zomato_id || store_id) || (!opening_time && !opening_time_2)) {
    return res.status(400).json({ error: "Store identifier and at least one opening_time required" });
  }
  if (!GITHUB_TOKEN) {
    return res.status(500).json({ error: "GITHUB_TOKEN not configured" });
  }

  console.log(`[TIMING] ${store_name} → open ${opening_time} close ${closing_time}`);

  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/sync.yml/dispatches`,
      {
        method  : "POST",
        headers : {
          Authorization  : `Bearer ${GITHUB_TOKEN}`,
          Accept         : "application/vnd.github.v3+json",
          "Content-Type" : "application/json",
        },
        body: JSON.stringify({
          ref    : "main",
          inputs : {
            store_id     : String(store_id || location_id),
            location_id  : String(location_id || store_id || ""),
            zomato_id    : String(zomato_id || ""),
            store_name   : store_name || "",
            opening_time : opening_time || "",
            closing_time : closing_time || "",
            opening_time_2: opening_time_2 || "",
            closing_time_2: closing_time_2 || "",
            slot         : String(slot || "1"),
          },
        }),
      }
    );

    if (response.status === 204) {
      return res.json({ success: true, message: "GitHub Actions triggered. Changes apply in ~60 seconds." });
    }
    const body = await response.text();
    return res.status(response.status).json({ success: false, error: body });

  } catch (err) {
    console.error("[TIMING ERROR]", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;