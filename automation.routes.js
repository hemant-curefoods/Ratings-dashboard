import express from "express";
import pipeline from "./server/ratings/run_pipeline.js";

const router = express.Router();

router.post("/run", async (req, res) => {
  console.log("[AUTOMATION] API trigger received");
  
  try {
    // Trigger the pipeline in the background so the UI doesn't hang
    pipeline.runPipeline().catch(err => {
      console.error("[AUTOMATION BACKGROUND ERROR]", err);
    });
    
    // Respond immediately to the frontend
    res.json({ success: true, message: "Automation script is now running in the background." });
  } catch (err) {
    console.error("[AUTOMATION ERROR]", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;